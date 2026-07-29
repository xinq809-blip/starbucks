import { useState, useMemo, useEffect } from 'react';
import { Plus, X, Edit3, Trash2, CheckCircle2, Target, Users, Package, TrendingUp, Store, Trophy } from 'lucide-react';
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

  const systemData = useMemo(() => {
    const mStart = month + '-01';
    const mEnd = month + '-31';

    const distWithData = new Set(snapshots.filter(s => s.weekStart >= mStart && s.weekStart <= mEnd).map(s => s.distributorId));
    const prevDistWithData = new Set(snapshots.filter(s => s.weekStart < mStart).map(s => s.distributorId));
    const newDists = [...distWithData].filter(d => !prevDistWithData.has(d)).map(d => distributors.find(x => x.id === d)?.name || d);

    const mRestock = (restocks || []).filter(r => r.date >= mStart && r.date <= mEnd).reduce((s, r) => s + r.quantity, 0);
    const mStock = snapshots.filter(s => s.weekStart >= mStart && s.weekStart <= mEnd).reduce((a, s) => a + s.quantity, 0);
    const mSales = Math.max(0, mRestock - mStock);

    const activeDists = new Set((restocks || []).filter(r => r.date >= mStart && r.date <= mEnd).map(r => r.distributorId)).size;

    return { newDists, mSales, mRestock, activeDists };
  }, [month, distributors, snapshots, restocks]);

  const monthItems = items.filter(i => i.month === month);
  const doneCount = monthItems.filter(i => i.status === 'done').length;
  const avgProgress = monthItems.length > 0 ? Math.round(monthItems.reduce((s, i) => s + i.progress, 0) / monthItems.length) : 0;

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
            <p className="text-sm text-gray-400 mt-0.5">成果展示 · 事项跟进 · 向领导汇报</p>
          </div>
          <select value={month} onChange={e => setMonth(e.target.value)}
            className="border border-gray-200 rounded-xl px-4 py-2 text-sm font-medium bg-white focus:outline-none focus:ring-2 focus:ring-starbucks-200 hover:border-gray-300 transition-colors cursor-pointer">
            {ALL_MONTHS.map(m => <option key={m} value={m}>{ml(m)}</option>)}
          </select>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: '本月出货', value: systemData.mSales.toLocaleString(), unit: '件', icon: TrendingUp, color: 'blue' },
            { label: '进货总量', value: systemData.mRestock.toLocaleString(), unit: '件', icon: Package, color: 'emerald' },
            { label: '活跃客户', value: String(systemData.activeDists), unit: '家', icon: Users, color: 'amber' },
            { label: '新增网点', value: String(systemData.newDists.length), unit: '个', icon: Store, color: 'violet' },
          ].map(s => {
            const colors: Record<string, string> = {
              blue: 'bg-blue-50 text-blue-600',
              emerald: 'bg-emerald-50 text-emerald-600',
              amber: 'bg-amber-50 text-amber-600',
              violet: 'bg-violet-50 text-violet-600',
            };
            return (
              <div key={s.label} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 hover:shadow-md transition-shadow">
                <div className="flex items-center gap-3 mb-3">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${colors[s.color]}`}>
                    <s.icon size={17} />
                  </div>
                  <span className="text-xs text-gray-400">{s.label}</span>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-bold text-gray-800">{s.value}</span>
                  <span className="text-xs text-gray-400">{s.unit}</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Progress overview */}
        {monthItems.length > 0 && (
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-starbucks-50 flex items-center justify-center">
                <Target size={17} className="text-starbucks-500" />
              </div>
              <div>
                <p className="text-[11px] text-gray-400">重点事项</p>
                <p className="text-lg font-bold text-gray-800">{monthItems.length} <span className="text-xs font-normal text-gray-400">项</span></p>
              </div>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center">
                <CheckCircle2 size={17} className="text-emerald-500" />
              </div>
              <div>
                <p className="text-[11px] text-gray-400">已完成</p>
                <p className="text-lg font-bold text-gray-800">{doneCount} <span className="text-xs font-normal text-gray-400">/ {monthItems.length}</span></p>
              </div>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center">
                <TrendingUp size={17} className="text-amber-500" />
              </div>
              <div>
                <p className="text-[11px] text-gray-400">平均进度</p>
                <p className="text-lg font-bold text-gray-800">{avgProgress}%</p>
              </div>
            </div>
          </div>
        )}

        {/* New distributors */}
        {systemData.newDists.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-3.5 border-b border-gray-50 flex items-center gap-2.5">
              <Store size={15} className="text-violet-500" />
              <h3 className="text-sm font-bold text-gray-700">本月新开网点</h3>
              <span className="text-[11px] text-gray-400">当月新拓展的分销商及终端</span>
            </div>
            <div className="p-4">
              <div className="flex flex-wrap gap-2">
                {systemData.newDists.map((n: string, idx: number) => (
                  <span key={n} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-violet-50 text-violet-700 rounded-lg text-xs font-medium">
                    <span className="w-4 h-4 rounded-full bg-violet-200 text-violet-600 flex items-center justify-center text-[10px] font-bold">{idx + 1}</span>
                    {n}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Key Initiatives */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-3.5 border-b border-gray-50 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Target size={15} className="text-starbucks-500" />
              <h3 className="text-sm font-bold text-gray-700">重点事项跟进</h3>
              <span className="text-[11px] text-gray-400">本月关键工作及完成进度</span>
            </div>
            <button onClick={() => { setEditing(null); setModal(true); }}
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium bg-starbucks-500 text-white rounded-lg hover:bg-starbucks-600 transition-colors">
              <Plus size={14} />添加事项
            </button>
          </div>

          {monthItems.length === 0 ? (
            <div className="py-14 text-center">
              <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-gray-100 flex items-center justify-center">
                <Target size={20} className="text-gray-300" />
              </div>
              <p className="text-sm text-gray-400">本月暂无重点事项</p>
              <p className="text-xs text-gray-300 mt-1">点击右上角「添加事项」开始记录</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {monthItems.map((item, idx) => (
                <div key={item.id} className="p-5 hover:bg-gray-50/30 transition-colors group">
                  <div className="flex items-start gap-4">
                    <div className="flex flex-col items-center gap-2 pt-0.5 flex-shrink-0">
                      <span className="w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center text-[11px] font-bold text-gray-500">{idx + 1}</span>
                      {idx < monthItems.length - 1 && <div className="w-px flex-1 min-h-[16px] bg-gray-200" />}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="text-sm font-bold text-gray-800">{item.title}</h4>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                            item.status === 'done'
                              ? 'bg-emerald-50 text-emerald-600'
                              : 'bg-amber-50 text-amber-600'
                          }`}>
                            {item.status === 'done' ? '已完成' : '进行中'}
                          </span>
                        </div>
                        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => { setEditing(item); setModal(true); }} className="p-1.5 text-gray-300 hover:text-blue-500 hover:bg-blue-50 rounded-lg"><Edit3 size={14} /></button>
                          <button onClick={() => del(item.id)} className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg"><Trash2 size={14} /></button>
                        </div>
                      </div>

                      {item.detail && <p className="text-xs text-gray-500 mt-1 leading-relaxed">{item.detail}</p>}

                      <div className="mt-3 flex items-center gap-3">
                        <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${
                              item.progress >= 100 ? 'bg-emerald-500' : item.progress >= 50 ? 'bg-starbucks-500' : 'bg-amber-400'
                            }`}
                            style={{ width: `${Math.min(item.progress, 100)}%` }}
                          />
                        </div>
                        <span className={`text-xs font-bold w-10 text-right tabular-nums ${
                          item.progress >= 100 ? 'text-emerald-600' : item.progress >= 50 ? 'text-starbucks-600' : 'text-amber-600'
                        }`}>{item.progress}%</span>
                      </div>

                      {item.result && (
                        <div className="mt-3 p-3 bg-amber-50/50 rounded-xl border border-amber-100/50">
                          <div className="flex items-start gap-2">
                            <Trophy size={13} className="text-amber-500 flex-shrink-0 mt-px" />
                            <div>
                              <span className="text-[10px] text-amber-600 font-semibold">成果产出</span>
                              <p className="text-xs text-gray-700 mt-0.5 leading-relaxed">{item.result}</p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="text-center pb-4">
          <p className="text-[11px] text-gray-300">截图或打印本页即可作为月度汇报材料 · {ml(month)} · 星巴克即饮咖啡事业部</p>
        </div>

        {/* Modal */}
        {modal && (
          <div className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh] p-4">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => { setModal(false); setEditing(null); }} />
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100 bg-gray-50/50">
                <h3 className="text-sm font-semibold text-gray-800">{editing ? '编辑事项' : '添加重点事项'}</h3>
                <button onClick={() => { setModal(false); setEditing(null); }} className="p-1.5 rounded-full hover:bg-gray-200 transition-colors"><X size={16} className="text-gray-400" /></button>
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
    <div className="p-5 space-y-4">
      <div><label className={lbl}>事项标题 *</label><input value={f.title} onChange={e => setF({ ...f, title: e.target.value })} placeholder="如：完成唐山区域铺货" className={cls} autoFocus /></div>
      <div><label className={lbl}>详细描述</label><textarea value={f.detail} onChange={e => setF({ ...f, detail: e.target.value })} placeholder="具体做了什么..." rows={2} className={cls} /></div>
      <div className="grid grid-cols-2 gap-4">
        <div><label className={lbl}>进度 (%)</label><input type="number" min="0" max="100" value={f.progress} onChange={e => setF({ ...f, progress: parseInt(e.target.value) || 0 })} className={cls} /></div>
        <div><label className={lbl}>状态</label><select value={f.status} onChange={e => setF({ ...f, status: e.target.value as 'doing' | 'done' })} className={cls}><option value="doing">进行中</option><option value="done">已完成</option></select></div>
      </div>
      <div><label className={lbl}>成果/产出</label><input value={f.result} onChange={e => setF({ ...f, result: e.target.value })} placeholder="量化成果，如：新增3家网点" className={cls} /></div>
      <div className="flex justify-end gap-3 pt-2">
        <button onClick={onCancel} className="px-5 py-2.5 text-sm text-gray-500 hover:bg-gray-50 rounded-xl transition-colors">取消</button>
        <button onClick={() => { if (f.title) onSave(f); }} className="px-6 py-2.5 bg-starbucks-500 text-white rounded-xl text-sm font-medium hover:bg-starbucks-600 shadow-sm transition-colors">保存</button>
      </div>
    </div>
  );
}
