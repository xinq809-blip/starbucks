import { useState, useMemo, useEffect } from 'react';
import { Plus, Trash2, X, DollarSign, TrendingDown, Wallet } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { ExpenseRecord } from '../types/expense';
import { EXPENSE_CATEGORIES } from '../types/expense';

function genId() { return 'E' + Date.now().toString(36); }
function getMonthLabel(m: string) { return m.replace('-', '年') + '月'; }

function loadLocations(): string[] {
  try {
    const r = localStorage.getItem('sb_distributors_v2');
    if (r) return (JSON.parse(r) as any[]).map((d: any) => d.name);
  } catch {}
  return ['山海关梁波', '杨子', '速恩', '北戴河王总'];
}

export default function ExpensePage() {
  const currentMonth = '2026-05';
  const [items, setItems] = useState<ExpenseRecord[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [modal, setModal] = useState<ExpenseRecord | null>(null);
  const [adding, setAdding] = useState(false);

  // Load
  useEffect(() => {
    supabase.from('expenses').select('*').then(r => {
      setItems((r.data || []).map((row: any) => row.data));
      setLoaded(true);
    });
  }, []);

  // Save
  useEffect(() => {
    if (loaded) supabase.from('expenses').upsert(items.map(d => ({ id: d.id, data: d })), { onConflict: 'id' }).then(() => {});
  }, [items, loaded]);

  // Generate months from May 2026 to current
  const allMonths = useMemo(() => {
    const ms: string[] = [];
    for (let y = 2026; y <= 2026; y++) {
      for (let m = 5; m <= 12; m++) {
        ms.push(`${y}-${String(m).padStart(2, '0')}`);
      }
    }
    // Also include months from existing data
    const existing = [...new Set(items.map(i => i.month))];
    existing.forEach(m => { if (!ms.includes(m)) ms.push(m); });
    return ms.sort();
  }, [items]);

  const monthData = useMemo(() => {
    return EXPENSE_CATEGORIES.map(cat => {
      const entry = items.find(i => i.month === selectedMonth && i.category === cat.key);
      return { category: cat, entry };
    });
  }, [items, selectedMonth]);

  const totals = useMemo(() => {
    const m = monthData;
    const projected = m.reduce((s, d) => s + (d.entry?.projected || 0), 0);
    const actual = m.reduce((s, d) => s + (d.entry?.actual || 0), 0);
    return { projected, actual, balance: projected - actual };
  }, [monthData]);

  // Full year summary
  const yearSummary = useMemo(() => {
    const allMonths = [...new Set(items.map(i => i.month))].sort();
    return allMonths.map(m => {
      const mItems = items.filter(i => i.month === m);
      const projected = mItems.reduce((s, i) => s + (i.projected || 0), 0);
      const actual = mItems.reduce((s, i) => s + (i.actual || 0), 0);
      return { month: m, projected, actual, balance: projected - actual };
    });
  }, [items]);

  const saveEntry = (data: ExpenseRecord) => {
    if (items.find(i => i.id === data.id)) {
      setItems(items.map(i => i.id === data.id ? data : i));
    } else {
      setItems([...items, data]);
    }
    setModal(null); setAdding(false);
  };

  const delEntry = (id: string) => setItems(items.filter(i => i.id !== id));

  const format = (n: number) => '¥' + n.toLocaleString('zh-CN', { minimumFractionDigits: 0 });

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      <div className="p-4 md:p-6 space-y-6 max-w-6xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-800 tracking-tight">费用管理</h1>
            <p className="text-sm text-gray-400 mt-0.5">预提费用 · 实际支出 · 结余分析</p>
          </div>
          <div className="flex items-center gap-3">
            <select value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)}
              className="border border-gray-200 rounded-xl px-4 py-2 text-sm font-medium bg-white focus:outline-none focus:ring-2 focus:ring-gray-200">
              {allMonths.map(m => <option key={m} value={m}>{getMonthLabel(m)}</option>)}
            </select>
            <button onClick={() => setAdding(true)}
              className="flex items-center gap-1.5 px-5 py-2.5 bg-gray-900 text-white rounded-xl text-sm font-medium hover:bg-gray-800 shadow-lg shadow-gray-200 transition-all">
              <Plus size={16} />新增费用
            </button>
          </div>
        </div>

        {/* YTD Summary */}
        {(() => {
          const ytd = yearSummary.filter(m => m.month >= '2026-05' && m.month <= (selectedMonth));
          const ytdProj = ytd.reduce((s, m) => s + m.projected, 0);
          const ytdAct = ytd.reduce((s, m) => s + m.actual, 0);
          const ytdBal = ytdProj - ytdAct;
          return (
            <div className="bg-gradient-to-r from-gray-900 to-gray-800 rounded-2xl shadow-lg p-6 text-white">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">5月 - {getMonthLabel(selectedMonth)} 累计汇总</p>
              <div className="grid grid-cols-3 gap-8">
                <div>
                  <p className="text-sm text-gray-400 mb-1">累计预提</p>
                  <p className="text-2xl font-bold text-blue-400">{format(ytdProj)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-400 mb-1">累计实际支出</p>
                  <p className="text-2xl font-bold text-red-400">{format(ytdAct)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-400 mb-1">累计结余</p>
                  <p className={`text-2xl font-bold ${ytdBal >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{format(ytdBal)}</p>
                  <p className="text-xs text-gray-500 mt-0.5">支出率 {ytdProj > 0 ? Math.round((ytdAct / ytdProj) * 100) : 0}%</p>
                </div>
              </div>
            </div>
          );
        })()}

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { label: '本月预提', value: format(totals.projected), icon: DollarSign, color: 'text-blue-600', bg: 'bg-blue-50', ring: 'ring-blue-100' },
            { label: '实际支出', value: format(totals.actual), icon: TrendingDown, color: 'text-red-600', bg: 'bg-red-50', ring: 'ring-red-100' },
            { label: '结余', value: format(totals.balance), icon: Wallet, color: totals.balance >= 0 ? 'text-emerald-600' : 'text-red-600', bg: totals.balance >= 0 ? 'bg-emerald-50' : 'bg-red-50', ring: totals.balance >= 0 ? 'ring-emerald-100' : 'ring-red-100',
              sub: totals.projected > 0 ? `支出率 ${Math.round((totals.actual / totals.projected) * 100)}%` : '' },
          ].map(k => (
            <div key={k.label} className={`relative bg-white rounded-2xl border border-gray-100 shadow-sm p-5 ring-1 ${k.ring}`}>
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{k.label}</p>
                <div className={`w-9 h-9 rounded-xl ${k.bg} flex items-center justify-center`}><k.icon size={18} className={k.color} /></div>
              </div>
              <p className="text-2xl font-bold text-gray-800 tracking-tight">{k.value}</p>
              {k.sub && <p className="text-xs text-gray-400 mt-1">{k.sub}</p>}
            </div>
          ))}
        </div>

        {/* Monthly Detail Table */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-50">
            <h2 className="text-sm font-bold text-gray-700">{getMonthLabel(selectedMonth)} 费用明细</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50/30 border-b border-gray-100">
                  <th className="text-left px-5 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">费用类别</th>
                  <th className="text-left px-4 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">归属门店</th>
                  <th className="text-right px-4 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">预提费用</th>
                  <th className="text-right px-4 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">实际支出</th>
                  <th className="text-right px-4 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">结余</th>
                  <th className="text-left px-4 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">备注</th>
                  <th className="text-center px-2 py-3 w-12"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {monthData.map(({ category: cat, entry }) => {
                  const bal = (entry?.projected || 0) - (entry?.actual || 0);
                  const hasData = !!entry;
                  return (
                    <tr key={cat.key} className={`hover:bg-gray-50/30 transition-colors ${!hasData ? 'opacity-40' : ''}`}
                      onClick={() => { setModal(entry || { id: genId(), month: selectedMonth, category: cat.key, location: '', projected: 0, actual: 0, remark: '' }); }}>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2">
                          <span className="text-base">{cat.icon}</span>
                          <span className="text-xs font-semibold text-gray-800">{cat.label}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-xs text-gray-600">{entry?.location || <span className="text-gray-300">—</span>}</td>
                      <td className="px-5 py-3.5 text-right text-xs">
                        <span className={`font-bold ${entry?.projected ? 'text-blue-600' : 'text-gray-300'}`}>
                          {entry?.projected ? format(entry.projected) : '—'}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-right text-xs">
                        <span className={`font-bold ${entry?.actual ? 'text-red-600' : 'text-gray-300'}`}>
                          {entry?.actual ? format(entry.actual) : '—'}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-right text-xs">
                        {hasData ? (
                          <span className={`font-bold ${bal >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                            {bal >= 0 ? '+' : ''}{format(bal)}
                          </span>
                        ) : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-5 py-3.5 text-xs text-gray-400 max-w-[160px] truncate">
                        {entry?.remark || (hasData ? '—' : '点击录入')}
                      </td>
                      <td className="px-3 py-3.5 text-center">
                        {hasData && (
                          <button onClick={e => { e.stopPropagation(); delEntry(entry!.id); }}
                            className="text-gray-300 hover:text-red-500 transition-colors"><Trash2 size={14} /></button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-gray-50/80 border-t-2 border-gray-100">
                  <td className="px-6 py-3.5 text-xs font-bold text-gray-700">合计</td>
                  <td className="px-5 py-3.5 text-right text-xs font-bold text-blue-600">{format(totals.projected)}</td>
                  <td className="px-5 py-3.5 text-right text-xs font-bold text-red-600">{format(totals.actual)}</td>
                  <td className="px-5 py-3.5 text-right text-xs font-bold text-emerald-600">{format(totals.balance)}</td>
                  <td className="px-5 py-3.5"></td>
                  <td className="px-3 py-3.5"></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Per-location breakdown */}
        {(() => {
          const locations = [...new Set(items.filter(i => i.month === selectedMonth).map(i => i.location).filter(Boolean))] as string[];
          if (locations.length === 0) return null;
          const locData = locations.map(loc => {
            const locItems = items.filter(i => i.month === selectedMonth && i.location === loc);
            const proj = locItems.reduce((s, i) => s + (i.projected || 0), 0);
            const act = locItems.reduce((s, i) => s + (i.actual || 0), 0);
            return { loc, proj, act, bal: proj - act };
          }).sort((a, b) => b.proj - a.proj);
          return (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-50">
                <h2 className="text-sm font-bold text-gray-700">{getMonthLabel(selectedMonth)} 各门店费用分布</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50/30 border-b border-gray-100">
                      <th className="text-left px-6 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">门店</th>
                      <th className="text-right px-5 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">预提费用</th>
                      <th className="text-right px-5 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">实际支出</th>
                      <th className="text-right px-5 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">结余</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {locData.map(d => (
                      <tr key={d.loc}>
                        <td className="px-6 py-3 text-xs font-medium text-gray-800">{d.loc}</td>
                        <td className="px-5 py-3 text-right text-xs font-bold text-blue-600">{format(d.proj)}</td>
                        <td className="px-5 py-3 text-right text-xs font-bold text-red-600">{format(d.act)}</td>
                        <td className="px-5 py-3 text-right text-xs font-bold" style={{ color: d.bal >= 0 ? '#059669' : '#ef4444' }}>{format(d.bal)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })()}

        {/* Year Summary */}
        {yearSummary.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-50">
              <h2 className="text-sm font-bold text-gray-700">全年费用汇总</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50/30 border-b border-gray-100">
                    <th className="text-left px-6 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">月份</th>
                    <th className="text-right px-5 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">预提费用</th>
                    <th className="text-right px-5 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">实际支出</th>
                    <th className="text-right px-5 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">结余</th>
                    <th className="text-right px-5 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">支出率</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {yearSummary.map(m => (
                    <tr key={m.month} className="hover:bg-gray-50/30">
                      <td className="px-6 py-3 text-xs font-medium text-gray-800">{getMonthLabel(m.month)}</td>
                      <td className="px-5 py-3 text-right text-xs font-bold text-blue-600">{format(m.projected)}</td>
                      <td className="px-5 py-3 text-right text-xs font-bold text-red-600">{format(m.actual)}</td>
                      <td className="px-5 py-3 text-right text-xs font-bold" style={{ color: m.balance >= 0 ? '#059669' : '#ef4444' }}>{format(m.balance)}</td>
                      <td className="px-5 py-3 text-right text-xs text-gray-500">{m.projected > 0 ? Math.round((m.actual / m.projected) * 100) + '%' : '—'}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-gray-50/80 border-t-2 border-gray-100">
                    <td className="px-6 py-3.5 text-xs font-bold text-gray-700">全年合计</td>
                    <td className="px-5 py-3.5 text-right text-xs font-bold text-blue-600">{format(yearSummary.reduce((s, m) => s + m.projected, 0))}</td>
                    <td className="px-5 py-3.5 text-right text-xs font-bold text-red-600">{format(yearSummary.reduce((s, m) => s + m.actual, 0))}</td>
                    <td className="px-5 py-3.5 text-right text-xs font-bold text-emerald-600">{format(yearSummary.reduce((s, m) => s + m.balance, 0))}</td>
                    <td className="px-5 py-3.5"></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}

        {/* Modal */}
        {(modal || adding) && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => { setModal(null); setAdding(false); }} />
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-50 bg-gray-50/50">
                <h3 className="text-sm font-semibold text-gray-800">新增费用记录</h3>
                <button onClick={() => { setModal(null); setAdding(false); }} className="p-1.5 rounded-full hover:bg-gray-200"><X size={16} className="text-gray-400" /></button>
              </div>
              <ExpenseForm
                initial={modal || { id: genId(), month: selectedMonth, category: 'display', location: '', projected: 0, actual: 0, remark: '' }}
                onSave={saveEntry}
                onCancel={() => { setModal(null); setAdding(false); }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ExpenseForm({ initial, onSave, onCancel }: { initial: ExpenseRecord; onSave: (d: ExpenseRecord) => void; onCancel: () => void }) {
  const [form, setForm] = useState(initial);
  const cls = "w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-gray-50 focus:outline-none focus:bg-white focus:border-gray-400 transition-all";
  const lbl = "text-[11px] text-gray-400 mb-1 block font-medium";

  return (
    <div className="p-6 space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={lbl}>月份</label>
          <input type="month" value={form.month} onChange={e => setForm({ ...form, month: e.target.value })} className={cls} />
        </div>
        <div>
          <label className={lbl}>费用类别</label>
          <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} className={cls}>
            {EXPENSE_CATEGORIES.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label className={lbl}>归属门店</label>
        <div className="flex gap-2">
          <input
            value={form.location || ''}
            onChange={e => setForm({ ...form, location: e.target.value })}
            placeholder="输入门店名称"
            className={cls}
            list="loc-list"
          />
          <datalist id="loc-list">
            {loadLocations().map(l => <option key={l} value={l} />)}
          </datalist>
        </div>
        <div className="flex flex-wrap gap-1 mt-1.5">
          {loadLocations().map(l => (
            <button key={l} onClick={() => setForm({ ...form, location: l })}
              className={`text-[10px] px-2 py-0.5 rounded-full border transition-colors ${form.location === l ? 'bg-starbucks-500 text-white border-starbucks-500' : 'bg-gray-50 text-gray-500 border-gray-200 hover:border-gray-400'}`}>
              {l}
            </button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={lbl}>预提费用 (元)</label>
          <input type="number" min="0" value={form.projected || ''} onChange={e => setForm({ ...form, projected: parseInt(e.target.value) || 0 })} className={cls} />
        </div>
        <div>
          <label className={lbl}>实际支出 (元)</label>
          <input type="number" min="0" value={form.actual || ''} onChange={e => setForm({ ...form, actual: parseInt(e.target.value) || 0 })} className={cls} />
        </div>
      </div>
      <div>
        <label className={lbl}>备注</label>
        <input value={form.remark || ''} onChange={e => setForm({ ...form, remark: e.target.value })} placeholder="费用说明..." className={cls} />
      </div>
      <div className="flex justify-end gap-3 pt-2">
        <button onClick={onCancel} className="px-5 py-2.5 text-sm text-gray-500 hover:bg-gray-50 rounded-xl">取消</button>
        <button onClick={() => onSave(form)} className="px-6 py-2.5 bg-gray-900 text-white rounded-xl text-sm font-medium hover:bg-gray-800 shadow-sm">保存</button>
      </div>
    </div>
  );
}
