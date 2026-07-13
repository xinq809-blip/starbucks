import { useState, useMemo, useEffect } from 'react';
import { Plus, Trash2, X, DollarSign, TrendingDown, Wallet, ChevronDown, ChevronRight } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useApp } from '../context/AppContext';
import type { ExpenseRecord } from '../types/expense';
import { EXPENSE_CATEGORIES } from '../types/expense';

function genId() { return 'E' + Date.now().toString(36); }
function getMonthLabel(m: string) { return m.replace('-', '年') + '月'; }
function format(n: number) { return '¥' + n.toLocaleString('zh-CN', { minimumFractionDigits: 0 }); }

export default function ExpensePage() {
  const { state: { distributors } } = useApp();
  const distNames = useMemo(() => distributors.map(d => d.name), [distributors]);
  const [items, setItems] = useState<ExpenseRecord[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState('2026-05');
  const [expandedCat, setExpandedCat] = useState<string | null>(null);
  const [modal, setModal] = useState<{ type: 'budget' | 'actual'; entry?: ExpenseRecord } | null>(null);

  useEffect(() => {
    supabase.from('expenses').select('*').then(r => {
      setItems((r.data || []).map((row: any) => row.data));
      setLoaded(true);
    });
  }, []);
  useEffect(() => { if (loaded) supabase.from('expenses').upsert(items.map(d => ({ id: d.id, data: d })), { onConflict: 'id' }).then(() => {}); }, [items, loaded]);

  const allMonths = useMemo(() => {
    const ms: string[] = [];
    for (let m = 5; m <= 12; m++) ms.push(`2026-${String(m).padStart(2, '0')}`);
    return ms;
  }, []);

  // Budget entries (no location) and actual entries (with location)
  const budgetItems = useMemo(() => items.filter(i => i.month === selectedMonth && !i.location), [items, selectedMonth]);
  const actualItems = useMemo(() => items.filter(i => i.month === selectedMonth && i.location), [items, selectedMonth]);

  const monthData = useMemo(() => {
    return EXPENSE_CATEGORIES.map(cat => {
      const budget = budgetItems.find(i => i.category === cat.key);
      const actuals = actualItems.filter(i => i.category === cat.key);
      const totalActual = actuals.reduce((s, i) => s + (i.actual || 0), 0);
      const projected = budget?.projected || 0;
      return { category: cat, budget, actuals, totalActual, projected, balance: projected - totalActual };
    });
  }, [budgetItems, actualItems]);

  const totals = useMemo(() => {
    const p = monthData.reduce((s, d) => s + d.projected, 0);
    const a = monthData.reduce((s, d) => s + d.totalActual, 0);
    return { projected: p, actual: a, balance: p - a };
  }, [monthData]);

  // Year summary: aggregate all months
  const yearSummary = useMemo(() => {
    const allM = [...new Set(items.map(i => i.month))].sort();
    return allM.map(m => {
      const mItems = items.filter(i => i.month === m);
      const budgets = mItems.filter(i => !i.location);
      const actuals = mItems.filter(i => i.location);
      const proj = budgets.reduce((s, i) => s + (i.projected || 0), 0);
      const act = actuals.reduce((s, i) => s + (i.actual || 0), 0);
      return { month: m, projected: proj, actual: act, balance: proj - act };
    });
  }, [items]);

  const saveBudget = (cat: string, projected: number) => {
    const existing = budgetItems.find(i => i.category === cat);
    if (projected <= 0 && existing) {
      setItems(items.filter(i => i.id !== existing.id));
    } else if (existing) {
      setItems(items.map(i => i.id === existing.id ? { ...i, projected } : i));
    } else if (projected > 0) {
      setItems([...items, { id: genId(), month: selectedMonth, category: cat, location: '', projected, actual: 0, remark: '' }]);
    }
  };

  const saveActual = (data: ExpenseRecord) => {
    if (items.find(i => i.id === data.id)) {
      setItems(items.map(i => i.id === data.id ? data : i));
    } else {
      setItems([...items, data]);
    }
    setModal(null);
  };

  const delItem = (id: string) => setItems(items.filter(i => i.id !== id));

  const copyPrevMonth = () => {
    const idx = allMonths.indexOf(selectedMonth);
    if (idx <= 0) return;
    const prevMonth = allMonths[idx - 1];
    const prevItems = items.filter(i => i.month === prevMonth);
    const newItems = [...items];
    let copied = 0;
    for (const pi of prevItems) {
      const exists = newItems.find(i => i.month === selectedMonth && i.category === pi.category && (i.location || '') === (pi.location || ''));
      if (!exists) {
        newItems.push({ ...pi, id: genId(), month: selectedMonth });
        copied++;
      }
    }
    setItems(newItems);
    alert(`已从${getMonthLabel(prevMonth)}复制 ${copied} 条记录`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      <div className="p-4 md:p-6 space-y-6 max-w-6xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-800 tracking-tight">费用管理</h1>
            <p className="text-sm text-gray-400 mt-0.5">预提总控 · 支出按门店归属 · 结余追踪</p>
          </div>
          <div className="flex items-center gap-3">
            <select value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)}
              className="border border-gray-200 rounded-xl px-4 py-2 text-sm font-medium bg-white focus:outline-none focus:ring-2 focus:ring-gray-200">
              {allMonths.map(m => <option key={m} value={m}>{getMonthLabel(m)}</option>)}
            </select>
            <button onClick={copyPrevMonth}
              disabled={allMonths.indexOf(selectedMonth) <= 0}
              className="px-4 py-2 text-xs font-medium text-gray-500 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
              延用上月数据
            </button>
            <button onClick={() => {
              const monthItems = items.filter(i => i.month === selectedMonth);
              if (monthItems.length === 0) return;
              if (confirm(`删除${getMonthLabel(selectedMonth)}全部${monthItems.length}条费用数据？`)) {
                setItems(items.filter(i => i.month !== selectedMonth));
              }
            }}
              className="px-3 py-2 text-xs font-medium text-red-400 bg-white border border-red-200 rounded-xl hover:bg-red-50 transition-colors">
              清空本月
            </button>
            <button onClick={() => setModal({ type: 'actual' })}
              className="flex items-center gap-1.5 px-5 py-2.5 bg-gray-900 text-white rounded-xl text-sm font-medium hover:bg-gray-800 shadow-lg shadow-gray-200 transition-all">
              <Plus size={16} />新增支出
            </button>
          </div>
        </div>

        {/* YTD Summary */}
        {(() => {
          const ytd = yearSummary.filter(m => m.month >= '2026-05' && m.month <= selectedMonth);
          const yp = ytd.reduce((s, m) => s + m.projected, 0);
          const ya = ytd.reduce((s, m) => s + m.actual, 0);
          const yb = yp - ya;
          return (
            <div className="bg-gradient-to-r from-gray-900 to-gray-800 rounded-2xl shadow-lg p-6 text-white">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">5月 - {getMonthLabel(selectedMonth)} 累计汇总</p>
              <div className="grid grid-cols-3 gap-8">
                <div><p className="text-sm text-gray-400 mb-1">累计预提</p><p className="text-2xl font-bold text-blue-400">{format(yp)}</p></div>
                <div><p className="text-sm text-gray-400 mb-1">累计实际支出</p><p className="text-2xl font-bold text-red-400">{format(ya)}</p></div>
                <div><p className="text-sm text-gray-400 mb-1">累计结余</p><p className={`text-2xl font-bold ${yb >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{format(yb)}</p><p className="text-xs text-gray-500 mt-0.5">支出率 {yp > 0 ? Math.round((ya / yp) * 100) : 0}%</p></div>
              </div>
            </div>
          );
        })()}

        {/* KPI */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { label: '本月预提总额', value: format(totals.projected), icon: DollarSign, color: 'text-blue-600', bg: 'bg-blue-50', ring: 'ring-blue-100' },
            { label: '实际支出总计', value: format(totals.actual), icon: TrendingDown, color: 'text-red-600', bg: 'bg-red-50', ring: 'ring-red-100' },
            { label: '本月结余', value: format(totals.balance), icon: Wallet, color: totals.balance >= 0 ? 'text-emerald-600' : 'text-red-600', bg: totals.balance >= 0 ? 'bg-emerald-50' : 'bg-red-50', ring: totals.balance >= 0 ? 'ring-emerald-100' : 'ring-red-100',
              sub: totals.projected > 0 ? `支出率 ${Math.round((totals.actual / totals.projected) * 100)}%` : '' },
          ].map(k => (
            <div key={k.label} className={`relative bg-white rounded-2xl border border-gray-100 shadow-sm p-5 ring-1 ${k.ring}`}>
              <div className="flex items-center justify-between mb-3"><p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{k.label}</p><div className={`w-9 h-9 rounded-xl ${k.bg} flex items-center justify-center`}><k.icon size={18} className={k.color} /></div></div>
              <p className="text-2xl font-bold text-gray-800 tracking-tight">{k.value}</p>
              {k.sub && <p className="text-xs text-gray-400 mt-1">{k.sub}</p>}
            </div>
          ))}
        </div>

        {/* Monthly Detail */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-50 flex items-center justify-between">
            <h2 className="text-sm font-bold text-gray-700">{getMonthLabel(selectedMonth)} 费用明细</h2>
            <span className="text-[10px] text-gray-400">点击预提金额可编辑 · 点击类别展开支出明细</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50/30 border-b border-gray-100">
                  <th className="text-left px-6 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">费用类别</th>
                  <th className="text-right px-5 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">预提费用</th>
                  <th className="text-right px-5 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">实际支出</th>
                  <th className="text-right px-5 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">结余</th>
                  <th className="text-right px-5 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">支出率</th>
                  <th className="text-center px-3 py-3 w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {monthData.map(({ category: cat, projected, totalActual, balance, actuals }) => (
                  <>
                    <tr key={cat.key} className="hover:bg-gray-50/30 transition-colors cursor-pointer"
                      onClick={() => setExpandedCat(expandedCat === cat.key ? null : cat.key)}>
                      <td className="px-6 py-3.5">
                        <div className="flex items-center gap-2">
                          {expandedCat === cat.key ? <ChevronDown size={14} className="text-gray-400" /> : <ChevronRight size={14} className="text-gray-400" />}
                          <span className="text-base">{cat.icon}</span>
                          <span className="text-xs font-semibold text-gray-800">{cat.label}</span>
                          {actuals.length > 0 && <span className="text-[10px] text-gray-400">({actuals.length} 笔)</span>}
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <span onClick={e => { e.stopPropagation(); const v = projected || 0; const n = parseInt(prompt('预提费用:', String(v)) || '') || 0; saveBudget(cat.key, n); }}
                          className={`font-bold cursor-pointer hover:underline ${projected > 0 ? 'text-blue-600' : 'text-gray-300'}`}>
                          {projected > 0 ? format(projected) : '点击设置'}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <span className={`font-bold ${totalActual > 0 ? 'text-red-600' : 'text-gray-300'}`}>
                          {totalActual > 0 ? format(totalActual) : '—'}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <span className={`font-bold ${balance > 0 ? 'text-emerald-600' : balance < 0 ? 'text-red-500' : 'text-gray-400'}`}>
                          {projected > 0 ? format(balance) : '—'}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-right text-xs text-gray-500">
                        {projected > 0 ? Math.round((totalActual / projected) * 100) + '%' : '—'}
                      </td>
                      <td className="px-3 py-3.5 text-center">
                        <button onClick={e => { e.stopPropagation(); setModal({ type: 'actual', entry: { id: genId(), month: selectedMonth, category: cat.key, location: '', projected: 0, actual: 0, remark: '' } }); }}
                          className="p-1 rounded-lg text-gray-300 hover:text-starbucks-600 hover:bg-starbucks-50" title="新增支出">
                          <Plus size={15} />
                        </button>
                      </td>
                    </tr>
                    {/* Expanded: show per-location actuals */}
                    {expandedCat === cat.key && actuals.map(a => (
                      <tr key={a.id} className="bg-gray-50/30 hover:bg-gray-50/50">
                        <td className="px-12 py-2.5 text-xs text-gray-500 flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-gray-300" />
                          {a.location}
                        </td>
                        <td className="px-5 py-2.5"></td>
                        <td className="px-5 py-2.5 text-right text-xs font-bold text-red-500">{format(a.actual)}</td>
                        <td className="px-5 py-2.5"></td>
                        <td className="px-5 py-2.5 text-xs text-gray-400">{a.remark || ''}</td>
                        <td className="px-3 py-2.5 text-center">
                          <button onClick={() => delItem(a.id)} className="text-gray-300 hover:text-red-500"><Trash2 size={13} /></button>
                        </td>
                      </tr>
                    ))}
                    {expandedCat === cat.key && actuals.length === 0 && (
                      <tr className="bg-gray-50/30"><td colSpan={6} className="px-12 py-3 text-xs text-gray-400">暂无支出记录，点击右侧 + 添加</td></tr>
                    )}
                  </>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-gray-50/80 border-t-2 border-gray-100 font-bold">
                  <td className="px-6 py-3.5 text-xs text-gray-700">合计</td>
                  <td className="px-5 py-3.5 text-right text-xs text-blue-600">{format(totals.projected)}</td>
                  <td className="px-5 py-3.5 text-right text-xs text-red-600">{format(totals.actual)}</td>
                  <td className="px-5 py-3.5 text-right text-xs text-emerald-600">{format(totals.balance)}</td>
                  <td className="px-5 py-3.5"></td><td className="px-3 py-3.5"></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Per-location overview */}
        {(() => {
          const locMap: Record<string, number> = {};
          actualItems.forEach(i => { locMap[i.location] = (locMap[i.location] || 0) + (i.actual || 0); });
          const locs = Object.entries(locMap).sort((a, b) => b[1] - a[1]);
          if (locs.length === 0) return null;
          return (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-50"><h2 className="text-sm font-bold text-gray-700">{getMonthLabel(selectedMonth)} 各门店支出分布</h2></div>
              <div className="p-4 grid grid-cols-2 md:grid-cols-4 gap-3">
                {locs.map(([loc, amt]) => (
                  <div key={loc} className="bg-gray-50 rounded-xl p-3 text-center">
                    <p className="text-xs font-medium text-gray-700 mb-1">{loc}</p>
                    <p className="text-lg font-bold text-red-600">{format(amt)}</p>
                  </div>
                ))}
              </div>
            </div>
          );
        })()}

        {/* Year Summary */}
        {yearSummary.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-50"><h2 className="text-sm font-bold text-gray-700">全年费用汇总</h2></div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="bg-gray-50/30 border-b border-gray-100"><th className="text-left px-6 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">月份</th><th className="text-right px-5 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">预提</th><th className="text-right px-5 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">实际</th><th className="text-right px-5 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">结余</th><th className="text-right px-5 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">支出率</th></tr></thead>
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
                <tfoot><tr className="bg-gray-50/80 border-t-2 border-gray-100 font-bold">
                  <td className="px-6 py-3.5 text-xs text-gray-700">全年合计</td>
                  <td className="px-5 py-3.5 text-right text-xs text-blue-600">{format(yearSummary.reduce((s, m) => s + m.projected, 0))}</td>
                  <td className="px-5 py-3.5 text-right text-xs text-red-600">{format(yearSummary.reduce((s, m) => s + m.actual, 0))}</td>
                  <td className="px-5 py-3.5 text-right text-xs text-emerald-600">{format(yearSummary.reduce((s, m) => s + m.balance, 0))}</td>
                  <td className="px-5 py-3.5"></td>
                </tr></tfoot>
              </table>
            </div>
          </div>
        )}

        {/* Modal for adding actual expense */}
        {modal && modal.type === 'actual' && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setModal(null)} />
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-50 bg-gray-50/50">
                <h3 className="text-sm font-semibold text-gray-800">新增支出记录</h3>
                <button onClick={() => setModal(null)} className="p-1.5 rounded-full hover:bg-gray-200"><X size={16} className="text-gray-400" /></button>
              </div>
              <ActualForm initial={modal.entry!} onSave={saveActual} onCancel={() => setModal(null)} distNames={distNames} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ActualForm({ initial, onSave, onCancel, distNames }: { initial: ExpenseRecord; onSave: (d: ExpenseRecord) => void; onCancel: () => void; distNames: string[] }) {
  const [form, setForm] = useState(initial);
  const cls = "w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-gray-50 focus:outline-none focus:bg-white focus:border-gray-400 transition-all";
  const lbl = "text-[11px] text-gray-400 mb-1 block font-medium";

  return (
    <div className="p-6 space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div><label className={lbl}>月份</label><input type="month" value={form.month} onChange={e => setForm({ ...form, month: e.target.value })} className={cls} /></div>
        <div><label className={lbl}>费用类别</label><select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} className={cls}>{EXPENSE_CATEGORIES.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}</select></div>
      </div>
      <div>
        <label className={lbl}>归属门店 *</label>
        <input value={form.location || ''} onChange={e => setForm({ ...form, location: e.target.value })} placeholder="输入门店名称" className={cls} list="loc-list" />
        <datalist id="loc-list">{distNames.map(l => <option key={l} value={l} />)}</datalist>
        <div className="flex flex-wrap gap-1 mt-1.5">
          {distNames.map(l => (
            <button key={l} onClick={() => setForm({ ...form, location: l })}
              className={`text-[10px] px-2 py-0.5 rounded-full border ${form.location === l ? 'bg-starbucks-500 text-white border-starbucks-500' : 'bg-gray-50 text-gray-500 border-gray-200 hover:border-gray-400'}`}>{l}</button>
          ))}
        </div>
      </div>
      <div>
        <label className={lbl}>实际支出金额 (元) *</label>
        <input type="number" min="0" value={form.actual || ''} onChange={e => setForm({ ...form, actual: parseInt(e.target.value) || 0 })} className={cls} autoFocus />
      </div>
      <div><label className={lbl}>备注</label><input value={form.remark || ''} onChange={e => setForm({ ...form, remark: e.target.value })} placeholder="支出说明..." className={cls} /></div>
      <div className="flex justify-end gap-3 pt-2">
        <button onClick={onCancel} className="px-5 py-2.5 text-sm text-gray-500 hover:bg-gray-50 rounded-xl">取消</button>
        <button onClick={() => { if (form.location && form.actual > 0) onSave(form); }} className="px-6 py-2.5 bg-gray-900 text-white rounded-xl text-sm font-medium hover:bg-gray-800 shadow-sm">保存</button>
      </div>
    </div>
  );
}
