import { useState, useMemo, useEffect } from 'react';
import { Plus, Trash2, X, ChevronDown, ChevronRight } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useApp } from '../context/AppContext';
import type { ExpenseRecord } from '../types/expense';
import { EXPENSE_CATEGORIES } from '../types/expense';

function genId() { return 'E' + Date.now().toString(36); }
function getMonthLabel(m: string) { return m.replace('-', '年') + '月'; }
function fmt(n: number) { return '¥' + n.toLocaleString('zh-CN', { minimumFractionDigits: 0 }); }

export default function ExpensePage() {
  const { state: { distributors } } = useApp();
  const distNames = useMemo(() => distributors.map(d => d.name), [distributors]);
  const [items, setItems] = useState<ExpenseRecord[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState('2026-05');
  const [expandedCat, setExpandedCat] = useState<string | null>(null);
  const [editingBudget, setEditingBudget] = useState<string | null>(null);
  const [budgetInput, setBudgetInput] = useState('');
  const [modal, setModal] = useState(false);

  useEffect(() => {
    supabase.from('expenses').select('*').then(r => {
      const raw = (r.data || []).map((row: any) => row.data);
      // Migrate old format to new format
      const migrated = raw.map((d: any) => ({
        ...d,
        type: d.type || (d.location ? 'actual' : 'budget'),
        amount: d.amount ?? (d.type === 'actual' ? (d.actual || 0) : (d.projected || 0)),
      }));
      setItems(migrated);
      setLoaded(true);
    });
  }, []);

  // Dedup
  const deduped = useMemo(() => {
    const seen = new Set<string>();
    return items.filter(i => {
      const key = `${i.month}|${i.category}|${i.type}|${i.location || ''}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [items]);
  useEffect(() => { if (deduped.length !== items.length) setItems(deduped); }, [deduped]);

  // Save
  const flush = (data: ExpenseRecord[]) => {
    setItems(data);
    if (loaded) {
      // Clean old format before saving
      const clean = data.map(({ projected, actual, ...rest }: any) => rest);
      supabase.from('expenses').upsert(clean.map((d: any) => ({ id: d.id, data: d })), { onConflict: 'id' }).then(() => {});
    }
  };

  const allMonths = useMemo(() => {
    const ms: string[] = [];
    for (let m = 5; m <= 12; m++) ms.push(`2026-${String(m).padStart(2, '0')}`);
    return ms;
  }, []);

  // Budget items for selected month
  const budgets = useMemo(() =>
    deduped.filter(i => i.month === selectedMonth && i.type === 'budget'),
  [deduped, selectedMonth]);

  // Actual items for selected month
  const actuals = useMemo(() =>
    deduped.filter(i => i.month === selectedMonth && i.type === 'actual'),
  [deduped, selectedMonth]);

  const monthData = useMemo(() => EXPENSE_CATEGORIES.map(cat => {
    const budget = budgets.find(i => i.category === cat.key);
    const catActuals = actuals.filter(i => i.category === cat.key);
    const totalActual = catActuals.reduce((s, i) => s + (i.amount || 0), 0);
    const projected = budget?.amount || 0;
    return { category: cat, projected, totalActual, actuals: catActuals, balance: projected - totalActual };
  }), [budgets, actuals]);

  const totals = useMemo(() => {
    const p = monthData.reduce((s, d) => s + d.projected, 0);
    const a = monthData.reduce((s, d) => s + d.totalActual, 0);
    return { projected: p, actual: a, balance: p - a };
  }, [monthData]);

  const yearSummary = useMemo(() => {
    const allM = [...new Set(deduped.map(i => i.month))].sort();
    return allM.map(m => {
      const mItems = deduped.filter(i => i.month === m);
      const proj = mItems.filter(i => i.type === 'budget').reduce((s, i) => s + (i.amount || 0), 0);
      const act = mItems.filter(i => i.type === 'actual').reduce((s, i) => s + (i.amount || 0), 0);
      return { month: m, projected: proj, actual: act, balance: proj - act };
    });
  }, [deduped]);

  const saveBudget = (cat: string, amount: number) => {
    setEditingBudget(null);
    const existing = budgets.find(i => i.category === cat);
    if (amount <= 0) {
      if (existing) flush(deduped.filter(i => i.id !== existing.id));
    } else if (existing) {
      flush(deduped.map(i => i.id === existing.id ? { ...i, amount } : i));
    } else {
      flush([...deduped, { id: genId(), month: selectedMonth, category: cat, type: 'budget', location: '', amount, remark: '' }]);
    }
  };

  const saveActual = (data: ExpenseRecord) => {
    if (deduped.find(i => i.id === data.id)) {
      flush(deduped.map(i => i.id === data.id ? data : i));
    } else {
      flush([...deduped, data]);
    }
    setModal(false);
  };

  const delItem = (id: string) => flush(deduped.filter(i => i.id !== id));

  const copyPrevMonth = () => {
    const idx = allMonths.indexOf(selectedMonth);
    if (idx <= 0) return;
    const prevMonth = allMonths[idx - 1];
    const prev = deduped.filter(i => i.month === prevMonth);
    const cur = [...deduped];
    let n = 0;
    for (const p of prev) {
      const exists = cur.find(i => i.month === selectedMonth && i.category === p.category && i.type === p.type && (i.location || '') === (p.location || ''));
      if (!exists) { cur.push({ ...p, id: genId(), month: selectedMonth }); n++; }
    }
    flush(cur);
    if (n > 0) alert(`已从${getMonthLabel(prevMonth)}复制 ${n} 条记录`);
  };

  const clearMonth = () => {
    const n = deduped.filter(i => i.month === selectedMonth).length;
    if (n === 0) return;
    if (confirm(`删除${getMonthLabel(selectedMonth)}全部${n}条费用数据？`)) {
      flush(deduped.filter(i => i.month !== selectedMonth));
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      <div className="p-4 md:p-6 space-y-6 max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div><h1 className="text-2xl font-bold text-gray-800 tracking-tight">费用管理</h1><p className="text-sm text-gray-400 mt-0.5">预提总控 · 支出按门店归属</p></div>
          <div className="flex items-center gap-2">
            <select value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} className="border border-gray-200 rounded-xl px-4 py-2 text-sm font-medium bg-white">
              {allMonths.map(m => <option key={m} value={m}>{getMonthLabel(m)}</option>)}
            </select>
            <button onClick={copyPrevMonth} disabled={allMonths.indexOf(selectedMonth) <= 0}
              className="px-3 py-2 text-xs font-medium text-gray-500 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 disabled:opacity-30 transition-colors">延用上月</button>
            <button onClick={clearMonth} className="px-3 py-2 text-xs font-medium text-red-400 bg-white border border-red-200 rounded-xl hover:bg-red-50">清空</button>
            <button onClick={() => setModal(true)} className="flex items-center gap-1.5 px-4 py-2 bg-gray-900 text-white rounded-xl text-sm font-medium hover:bg-gray-800 shadow-sm"><Plus size={16} />新增支出</button>
          </div>
        </div>

        {/* YTD */}
        {(() => {
          const ytd = yearSummary.filter(m => m.month >= '2026-05' && m.month <= selectedMonth);
          const yp = ytd.reduce((s, m) => s + m.projected, 0);
          const ya = ytd.reduce((s, m) => s + m.actual, 0);
          return (
            <div className="bg-gradient-to-r from-gray-900 to-gray-800 rounded-2xl shadow-lg p-6 text-white">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">5月 - {getMonthLabel(selectedMonth)} 累计</p>
              <div className="grid grid-cols-3 gap-8">
                <div><p className="text-sm text-gray-400 mb-1">累计预提</p><p className="text-2xl font-bold text-blue-400">{fmt(yp)}</p></div>
                <div><p className="text-sm text-gray-400 mb-1">累计支出</p><p className="text-2xl font-bold text-red-400">{fmt(ya)}</p></div>
                <div><p className="text-sm text-gray-400 mb-1">累计结余</p><p className={`text-2xl font-bold ${(yp - ya) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{fmt(yp - ya)}</p></div>
              </div>
            </div>
          );
        })()}

        {/* Monthly KPI */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { l: '本月预提', v: fmt(totals.projected), icon: '💵', c: 'text-blue-600', bg: 'bg-blue-50' },
            { l: '实际支出', v: fmt(totals.actual), icon: '📉', c: 'text-red-600', bg: 'bg-red-50' },
            { l: '结余', v: fmt(totals.balance), icon: '💰', c: totals.balance >= 0 ? 'text-emerald-600' : 'text-red-600', bg: totals.balance >= 0 ? 'bg-emerald-50' : 'bg-red-50' },
          ].map(k => (
            <div key={k.l} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <div className="flex items-center justify-between mb-3"><p className="text-xs font-semibold text-gray-500 uppercase">{k.l}</p><div className={`w-9 h-9 rounded-xl ${k.bg} flex items-center justify-center text-lg`}>{k.icon}</div></div>
              <p className="text-2xl font-bold text-gray-800">{k.v}</p>
            </div>
          ))}
        </div>

        {/* Detail Table */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-50"><h2 className="text-sm font-bold text-gray-700">{getMonthLabel(selectedMonth)} 费用明细</h2></div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="bg-gray-50/30 border-b border-gray-100">
                <th className="text-left px-6 py-3 text-[11px] font-semibold text-gray-500 uppercase">类别</th>
                <th className="text-right px-5 py-3 text-[11px] font-semibold text-gray-500 uppercase">预提</th>
                <th className="text-right px-5 py-3 text-[11px] font-semibold text-gray-500 uppercase">实际支出</th>
                <th className="text-right px-5 py-3 text-[11px] font-semibold text-gray-500 uppercase">结余</th>
                <th className="text-right px-5 py-3 text-[11px] font-semibold text-gray-500 uppercase">支出率</th>
                <th className="text-center px-3 py-3 w-10"></th>
              </tr></thead>
              <tbody className="divide-y divide-gray-50">
                {monthData.map(({ category: cat, projected, totalActual, balance, actuals: catActuals }) => (
                  <>
                    <tr key={cat.key} className="hover:bg-gray-50/30 cursor-pointer"
                      onClick={() => setExpandedCat(expandedCat === cat.key ? null : cat.key)}>
                      <td className="px-6 py-3.5">
                        <div className="flex items-center gap-2">
                          {expandedCat === cat.key ? <ChevronDown size={14} className="text-gray-400" /> : <ChevronRight size={14} className="text-gray-400" />}
                          <span className="text-base">{cat.icon}</span><span className="text-xs font-semibold text-gray-800">{cat.label}</span>
                          {catActuals.length > 0 && <span className="text-[10px] text-gray-400">({catActuals.length}笔)</span>}
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-right" onClick={e => e.stopPropagation()}>
                        {editingBudget === cat.key ? (
                          <input type="number" min="0" value={budgetInput} autoFocus
                            onChange={e => setBudgetInput(e.target.value)}
                            onBlur={() => saveBudget(cat.key, parseInt(budgetInput) || 0)}
                            onKeyDown={e => { if (e.key === 'Enter') saveBudget(cat.key, parseInt(budgetInput) || 0); if (e.key === 'Escape') setEditingBudget(null); }}
                            className="w-24 text-right border border-gray-300 rounded-lg px-2 py-1 text-xs font-bold text-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-200" />
                        ) : (
                          <span onClick={() => { setEditingBudget(cat.key); setBudgetInput(String(projected || '')); }}
                            className={`font-bold cursor-pointer hover:underline ${projected > 0 ? 'text-blue-600' : 'text-gray-300'}`}>
                            {projected > 0 ? fmt(projected) : '点击设置'}
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <span className={`font-bold ${totalActual > 0 ? 'text-red-600' : 'text-gray-300'}`}>{totalActual > 0 ? fmt(totalActual) : '—'}</span>
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <span className={`font-bold ${projected > 0 ? (balance >= 0 ? 'text-emerald-600' : 'text-red-500') : 'text-gray-400'}`}>
                          {projected > 0 ? fmt(balance) : '—'}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-right text-xs text-gray-500">
                        {projected > 0 ? Math.round((totalActual / projected) * 100) + '%' : '—'}
                      </td>
                      <td className="px-3 py-3.5 text-center" onClick={e => e.stopPropagation()}>
                        <button onClick={() => setModal(true)}
                          className="p-1 rounded-lg text-gray-300 hover:text-starbucks-600 hover:bg-starbucks-50"><Plus size={15} /></button>
                      </td>
                    </tr>
                    {expandedCat === cat.key && catActuals.map(a => (
                      <tr key={a.id} className="bg-gray-50/30">
                        <td className="px-12 py-2.5 text-xs text-gray-500">● {a.location || '未指定门店'}</td>
                        <td></td>
                        <td className="px-5 py-2.5 text-right text-xs font-bold text-red-500">{fmt(a.amount)}</td>
                        <td></td>
                        <td className="px-5 py-2.5 text-xs text-gray-400">{a.remark || ''}</td>
                        <td className="px-3 py-2.5 text-center"><button onClick={() => delItem(a.id)} className="text-gray-300 hover:text-red-500"><Trash2 size={13} /></button></td>
                      </tr>
                    ))}
                    {expandedCat === cat.key && catActuals.length === 0 && (
                      <tr className="bg-gray-50/30"><td colSpan={6} className="px-12 py-3 text-xs text-gray-400">暂无支出记录</td></tr>
                    )}
                  </>
                ))}
              </tbody>
              <tfoot><tr className="bg-gray-50/80 border-t-2 border-gray-100 font-bold">
                <td className="px-6 py-3.5 text-xs text-gray-700">合计</td>
                <td className="px-5 py-3.5 text-right text-xs text-blue-600">{fmt(totals.projected)}</td>
                <td className="px-5 py-3.5 text-right text-xs text-red-600">{fmt(totals.actual)}</td>
                <td className="px-5 py-3.5 text-right text-xs text-emerald-600">{fmt(totals.balance)}</td>
                <td className="px-5 py-3.5"></td><td className="px-3 py-3.5"></td>
              </tr></tfoot>
            </table>
          </div>
        </div>

        {/* Per-location */}
        {(() => {
          const locMap: Record<string, number> = {};
          actuals.forEach(i => { locMap[i.location || '未指定'] = (locMap[i.location || '未指定'] || 0) + (i.amount || 0); });
          const locs = Object.entries(locMap).sort((a, b) => b[1] - a[1]);
          if (locs.length === 0) return null;
          return (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-50"><h2 className="text-sm font-bold text-gray-700">各门店支出分布</h2></div>
              <div className="p-4 grid grid-cols-2 md:grid-cols-4 gap-3">
                {locs.map(([loc, amt]) => (
                  <div key={loc} className="bg-gray-50 rounded-xl p-3 text-center">
                    <p className="text-xs font-medium text-gray-700 mb-1">{loc}</p><p className="text-lg font-bold text-red-600">{fmt(amt)}</p>
                  </div>
                ))}
              </div>
            </div>
          );
        })()}

        {/* Year Summary */}
        {yearSummary.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-50"><h2 className="text-sm font-bold text-gray-700">全年汇总</h2></div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="bg-gray-50/30 border-b border-gray-100"><th className="text-left px-6 py-3 text-[11px] font-semibold text-gray-500 uppercase">月份</th><th className="text-right px-5 py-3 text-[11px] font-semibold text-gray-500 uppercase">预提</th><th className="text-right px-5 py-3 text-[11px] font-semibold text-gray-500 uppercase">实际</th><th className="text-right px-5 py-3 text-[11px] font-semibold text-gray-500 uppercase">结余</th></tr></thead>
                <tbody className="divide-y divide-gray-50">
                  {yearSummary.map(m => (
                    <tr key={m.month} className="hover:bg-gray-50/30"><td className="px-6 py-3 text-xs font-medium text-gray-800">{getMonthLabel(m.month)}</td><td className="px-5 py-3 text-right text-xs font-bold text-blue-600">{fmt(m.projected)}</td><td className="px-5 py-3 text-right text-xs font-bold text-red-600">{fmt(m.actual)}</td><td className="px-5 py-3 text-right text-xs font-bold" style={{ color: m.balance >= 0 ? '#059669' : '#ef4444' }}>{fmt(m.balance)}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Modal for adding actual */}
        {modal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setModal(false)} />
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-50 bg-gray-50/50">
                <h3 className="text-sm font-semibold text-gray-800">新增支出</h3>
                <button onClick={() => setModal(false)} className="p-1.5 rounded-full hover:bg-gray-200"><X size={16} className="text-gray-400" /></button>
              </div>
              <AddActualForm
                month={selectedMonth}
                distNames={distNames}
                onSave={saveActual}
                onCancel={() => setModal(false)}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function AddActualForm({ month, distNames, onSave, onCancel }: { month: string; distNames: string[]; onSave: (d: ExpenseRecord) => void; onCancel: () => void }) {
  const [form, setForm] = useState({ category: 'display', location: '', amount: 0, remark: '' });
  const cls = "w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-gray-50 focus:outline-none focus:bg-white focus:border-gray-400 transition-all";
  const lbl = "text-[11px] text-gray-400 mb-1 block font-medium";
  return (
    <div className="p-6 space-y-4">
      <div>
        <label className={lbl}>费用类别</label>
        <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} className={cls}>
          {EXPENSE_CATEGORIES.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
        </select>
      </div>
      <div>
        <label className={lbl}>归属门店 *</label>
        <input value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} placeholder="输入门店名称" className={cls} list="loc-list" />
        <datalist id="loc-list">{distNames.map(l => <option key={l} value={l} />)}</datalist>
        <div className="flex flex-wrap gap-1 mt-1.5">
          {distNames.map(l => (
            <button key={l} onClick={() => setForm({ ...form, location: l })}
              className={`text-[10px] px-2 py-0.5 rounded-full border ${form.location === l ? 'bg-starbucks-500 text-white' : 'bg-gray-50 text-gray-500 border-gray-200'}`}>{l}</button>
          ))}
        </div>
      </div>
      <div>
        <label className={lbl}>支出金额 (元) *</label>
        <input type="number" min="0" value={form.amount || ''} onChange={e => setForm({ ...form, amount: parseInt(e.target.value) || 0 })} className={cls} autoFocus />
      </div>
      <div><label className={lbl}>备注</label><input value={form.remark} onChange={e => setForm({ ...form, remark: e.target.value })} placeholder="说明" className={cls} /></div>
      <div className="flex justify-end gap-3 pt-2">
        <button onClick={onCancel} className="px-5 py-2.5 text-sm text-gray-500 hover:bg-gray-50 rounded-xl">取消</button>
        <button onClick={() => { if (form.location && form.amount > 0) onSave({ id: genId(), month, type: 'actual', ...form }); }}
          className="px-6 py-2.5 bg-gray-900 text-white rounded-xl text-sm font-medium hover:bg-gray-800 shadow-sm">保存</button>
      </div>
    </div>
  );
}
