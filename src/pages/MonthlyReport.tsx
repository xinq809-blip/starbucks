import { useState, useMemo, useEffect } from 'react';
import { Plus, X, Edit3, Trash2, CheckCircle2, Target, Users, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useApp } from '../context/AppContext';

function genId() { return 'MR' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
function ml(m: string) { return m.replace('-', '年') + '月'; }

interface Initiative { id: string; month: string; title: string; detail: string; progress: number; status: 'doing' | 'done'; result: string; }

const ALL_MONTHS = Array.from({length: 12}, (_,i) => `2026-${String(i+1).padStart(2,'0')}`);

export default function MonthlyReportPage() {
  const { state: { distributors, snapshots, restocks } } = useApp();
  const [month, setMonth] = useState(ALL_MONTHS[new Date().getMonth()] || '2026-07');
  const [items, setItems] = useState<Initiative[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<Initiative | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const r = await supabase.from('monthly_report').select('*');
        setItems((r.data || []).map((row: any) => row.data));
      } catch {}
      setLoaded(true);
    })();
  }, []);

  useEffect(() => {
    if (!loaded) return;
    try { supabase.from('monthly_report').upsert(items.map(d => ({ id: d.id, data: d })), { onConflict: 'id' }).then(() => {}); } catch {}
  }, [items, loaded]);

  // Auto-pull system data for the month
  const systemData = useMemo(() => {
    const mStart = month + '-01';
    const mEnd = month + '-31';

    // New distributors this month (check by looking at when they first appear in snapshots)
    const distWithData = new Set(snapshots.filter(s => s.weekStart >= mStart && s.weekStart <= mEnd).map(s => s.distributorId));
    const prevDistWithData = new Set(snapshots.filter(s => s.weekStart < mStart).map(s => s.distributorId));
    const newDists = [...distWithData].filter(d => !prevDistWithData.has(d)).map(d => distributors.find(x => x.id === d)?.name || d);

    // Sales summary
    const mRestock = (restocks || []).filter(r => r.date >= mStart && r.date <= mEnd).reduce((s, r) => s + r.quantity, 0);
    const mStock = snapshots.filter(s => s.weekStart >= mStart && s.weekStart <= mEnd).reduce((a, s) => a + s.quantity, 0);
    const mSales = Math.max(0, mRestock - mStock);

    // Active distributors
    const activeDists = new Set((restocks || []).filter(r => r.date >= mStart && r.date <= mEnd).map(r => r.distributorId)).size;

    return { newDists, mSales, mRestock, activeDists };
  }, [month, distributors, snapshots, restocks]);

  const monthItems = items.filter(i => i.month === month);
  const save = (d: Initiative) => {
    setItems(prev => prev.find(i => i.id === d.id) ? prev.map(i => i.id === d.id ? d : i) : [...prev, d]);
    setModal(false); setEditing(null);
  };
  const del = (id: string) => setItems(prev => prev.filter(i => i.id !== id));

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      <div className="p-4 md:p-6 space-y-5 max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">月度工作汇报</h1>
            <p className="text-sm text-gray-400 mt-0.5">成果展示 · 事项跟进 · 汇报用</p>
          </div>
          <select value={month} onChange={e => setMonth(e.target.value)}
            className="border border-gray-200 rounded-xl px-4 py-2 text-sm font-medium bg-white focus:outline-none focus:ring-2 focus:ring-gray-200">
            {ALL_MONTHS.map(m => <option key={m} value={m}>{ml(m)}</option>)}
          </select>
        </div>

        {/* System Data Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            ['本月出货', systemData.mSales.toLocaleString() + ' 件', '📦', 'bg-blue-50'],
            ['进货量', systemData.mRestock.toLocaleString() + ' 件', '🚚', 'bg-emerald-50'],
            ['活跃客户', systemData.activeDists + ' 家', '🤝', 'bg-amber-50'],
            ['新增网点', systemData.newDists.length + ' 个', '🏪', 'bg-violet-50'],
          ].map(k => (
            <div key={k[0] as string} className={`${k[3]} rounded-2xl p-5 text-center`}>
              <p className="text-2xl mb-1">{k[2]}</p>
              <p className="text-xl font-bold text-gray-800">{k[1] as string}</p>
              <p className="text-xs text-gray-500 mt-0.5">{k[0]}</p>
            </div>
          ))}
        </div>

        {/* New distributors detail */}
        {systemData.newDists.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <h3 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
              <Users size={16} className="text-violet-500" />本月新开分销商
            </h3>
            <div className="flex flex-wrap gap-2">
              {systemData.newDists.map((n: string) => (
                <span key={n} className="px-3 py-1.5 bg-violet-50 text-violet-700 rounded-full text-xs font-medium">{n}</span>
              ))}
            </div>
          </div>
        )}

        {/* Key Initiatives */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-50 flex items-center justify-between">
            <h3 className="text-sm font-bold text-gray-700 flex items-center gap-2">
              <Target size={16} className="text-starbucks-500" />重点事项跟进
            </h3>
            <button onClick={() => { setEditing(null); setModal(true); }}
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-gray-900 text-white rounded-lg hover:bg-gray-800">
              <Plus size={14} />添加事项
            </button>
          </div>

          {monthItems.length === 0 ? (
            <div className="py-12 text-center text-sm text-gray-400">点击右上角添加本月重点事项</div>
          ) : (
            <div className="divide-y divide-gray-50">
              {monthItems.map(item => (
                <div key={item.id} className="p-5 hover:bg-gray-50/30 transition-colors group">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <span className={`w-8 h-8 rounded-xl flex items-center justify-center text-sm ${
                        item.status === 'done' ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'
                      }`}>{item.status === 'done' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}</span>
                      <div>
                        <h4 className="text-sm font-bold text-gray-800">{item.title}</h4>
                        {item.detail && <p className="text-xs text-gray-500 mt-0.5">{item.detail}</p>}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => { setEditing(item); setModal(true); }} className="p-1.5 text-gray-300 hover:text-blue-500"><Edit3 size={14} /></button>
                      <button onClick={() => del(item.id)} className="p-1.5 text-gray-300 hover:text-red-500"><Trash2 size={14} /></button>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="flex items-center gap-3 mt-3">
                    <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all ${item.progress >= 100 ? 'bg-emerald-500' : item.progress >= 50 ? 'bg-starbucks-500' : 'bg-amber-400'}`}
                        style={{ width: `${Math.min(item.progress, 100)}%` }} />
                    </div>
                    <span className="text-xs font-bold text-gray-600 w-10 text-right">{item.progress}%</span>
                  </div>

                  {/* Result */}
                  {item.result && (
                    <div className="mt-2 p-2.5 bg-gray-50 rounded-lg text-xs text-gray-600">
                      <span className="font-semibold text-gray-700">成果：</span>{item.result}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Export hint */}
        <div className="text-center text-xs text-gray-400">
          截图或打印本页即可作为月度汇报材料 · {ml(month)}
        </div>

        {/* Modal */}
        {modal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => { setModal(false); setEditing(null); }} />
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-50 bg-gray-50/50">
                <h3 className="text-sm font-semibold text-gray-800">{editing ? '编辑事项' : '添加事项'}</h3>
                <button onClick={() => { setModal(false); setEditing(null); }} className="p-1.5 rounded-full hover:bg-gray-200"><X size={16} className="text-gray-400" /></button>
              </div>
              <InitForm init={editing} month={month} onSave={save} onCancel={() => { setModal(false); setEditing(null); }} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function InitForm({ init, month, onSave, onCancel }: { init: Initiative | null; month: string; onSave: (d: Initiative) => void; onCancel: () => void }) {
  const [f, setF] = useState(init || { id: genId(), month, title: '', detail: '', progress: 0, status: 'doing' as const, result: '' });
  const cls = "w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-gray-50 focus:outline-none focus:bg-white focus:border-gray-400 transition-all";
  const lbl = "text-[11px] text-gray-400 mb-1 block font-medium";
  return (
    <div className="p-6 space-y-4">
      <div><label className={lbl}>事项标题 *</label><input value={f.title} onChange={e => setF({ ...f, title: e.target.value })} placeholder="如：完成唐山区域铺货" className={cls} autoFocus /></div>
      <div><label className={lbl}>详细描述</label><textarea value={f.detail} onChange={e => setF({ ...f, detail: e.target.value })} placeholder="具体做了什么..." rows={2} className={cls} /></div>
      <div className="grid grid-cols-2 gap-4">
        <div><label className={lbl}>进度 (%)</label><input type="number" min="0" max="100" value={f.progress} onChange={e => setF({ ...f, progress: parseInt(e.target.value) || 0 })} className={cls} /></div>
        <div><label className={lbl}>状态</label><select value={f.status} onChange={e => setF({ ...f, status: e.target.value as 'doing' | 'done' })} className={cls}><option value="doing">进行中</option><option value="done">已完成</option></select></div>
      </div>
      <div><label className={lbl}>成果/产出</label><input value={f.result} onChange={e => setF({ ...f, result: e.target.value })} placeholder="量化成果，如：新增3家网点" className={cls} /></div>
      <div className="flex justify-end gap-3 pt-2">
        <button onClick={onCancel} className="px-5 py-2.5 text-sm text-gray-500 hover:bg-gray-50 rounded-xl">取消</button>
        <button onClick={() => { if (f.title) onSave(f); }} className="px-6 py-2.5 bg-gray-900 text-white rounded-xl text-sm font-medium hover:bg-gray-800 shadow-sm">保存</button>
      </div>
    </div>
  );
}
