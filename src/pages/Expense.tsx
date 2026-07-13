import { useState, useMemo, useEffect, useCallback } from 'react';
import { Plus, Trash2, X, ChevronDown, ChevronRight } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useApp } from '../context/AppContext';
import { EXPENSE_CATEGORIES } from '../types/expense';

type BudgetMap = Record<string, Record<string, number>>; // { month: { category: amount } }
type ActualItem = { id: string; month: string; category: string; location: string; amount: number; remark: string };
function genId() { return 'E' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
function ml(m: string) { return m.replace('-', '年') + '月'; }
function fmt(n: number) { return '¥' + n.toLocaleString('zh-CN', { minimumFractionDigits: 0 }); }

const ALL_MONTHS = Array.from({length:8}, (_,i) => `2026-${String(i+5).padStart(2,'0')}`);

export default function ExpensePage() {
  const { state: { distributors } } = useApp();
  const distNames = useMemo(() => distributors.map(d => d.name), [distributors]);

  // Separate state: budgets and actuals
  const [budgets, setBudgets] = useState<BudgetMap>({});
  const [actuals, setActuals] = useState<ActualItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [month, setMonth] = useState('2026-05');
  const [expand, setExpand] = useState<string | null>(null);
  const [editCat, setEditCat] = useState<string | null>(null);
  const [editVal, setEditVal] = useState('');
  const [modal, setModal] = useState(false);

  // Load
  useEffect(() => {
    supabase.from('expenses').select('*').then(r => {
      const data = (r.data || []).map((row: any) => row.data);
      const b: BudgetMap = {};
      const a: ActualItem[] = [];
      for (const d of data) {
        if (!d.month || !d.category) continue;
        if (d.type === 'actual' || (d.location && d.location !== '')) {
          a.push({ id: d.id, month: d.month, category: d.category, location: d.location || '', amount: d.amount || d.actual || 0, remark: d.remark || '' });
        } else {
          if (!b[d.month]) b[d.month] = {};
          b[d.month][d.category] = d.amount || d.projected || 0;
        }
      }
      setBudgets(b); setActuals(a); setLoaded(true);
    });
  }, []);

  // Save budgets
  const saveBudgets = useCallback((b: BudgetMap) => {
    setBudgets(b);
    if (!loaded) return;
    const rows: any[] = [];
    for (const [m, cats] of Object.entries(b)) {
      for (const [cat, amt] of Object.entries(cats)) {
        if (amt > 0) rows.push({ id: `BUDGET_${m}_${cat}`, data: { id: `BUDGET_${m}_${cat}`, month: m, category: cat, type: 'budget', location: '', amount: amt, remark: '' } });
      }
    }
    // Delete old budgets
    supabase.from('expenses').delete().like('id', 'BUDGET_%').then(() => {
      if (rows.length > 0) supabase.from('expenses').upsert(rows, { onConflict: 'id' }).then(() => {});
    });
  }, [loaded]);

  // Save actuals
  const flushActuals = useCallback((a: ActualItem[]) => {
    setActuals(a);
    if (!loaded) return;
    const rows = a.map(d => ({ id: d.id, data: { id: d.id, month: d.month, category: d.category, type: 'actual', location: d.location, amount: d.amount, remark: d.remark } }));
    if (rows.length > 0) supabase.from('expenses').upsert(rows, { onConflict: 'id' }).then(() => {});
  }, [loaded]);

  const setBudget = (cat: string, amt: number) => {
    setEditCat(null);
    const b = { ...budgets };
    if (amt <= 0) {
      if (b[month]) { delete b[month][cat]; if (Object.keys(b[month]).length === 0) delete b[month]; }
    } else {
      if (!b[month]) b[month] = {};
      b[month][cat] = amt;
    }
    saveBudgets(b);
  };

  const addActual = (item: ActualItem) => {
    flushActuals([...actuals, item]);
    setModal(false);
  };

  const delActual = (id: string) => flushActuals(actuals.filter(i => i.id !== id));
  const editActual = (id: string, updates: Partial<ActualItem>) => flushActuals(actuals.map(i => i.id === id ? { ...i, ...updates } : i));

  const [editActualId, setEditActualId] = useState<string | null>(null);
  const [editActualVal, setEditActualVal] = useState('');

  const copyPrev = () => {
    const idx = ALL_MONTHS.indexOf(month);
    if (idx <= 0) return;
    const pm = ALL_MONTHS[idx - 1];
    // Copy budgets
    const b = { ...budgets };
    if (budgets[pm]) {
      if (!b[month]) b[month] = {};
      for (const [cat, amt] of Object.entries(budgets[pm])) {
        if (!b[month][cat]) b[month][cat] = amt;
      }
    }
    // Copy actuals
    const prevActuals = actuals.filter(i => i.month === pm);
    const newActuals = [...actuals];
    let n = 0;
    for (const pa of prevActuals) {
      const exists = newActuals.find(i => i.month === month && i.category === pa.category && i.location === pa.location);
      if (!exists) { newActuals.push({ ...pa, id: genId(), month }); n++; }
    }
    saveBudgets(b);
    flushActuals(newActuals);
    if (n > 0 || (budgets[pm] && Object.keys(budgets[pm]).length > 0)) alert(`已从${ml(pm)}复制`);
  };

  const clearMonth = () => {
    const hasB = budgets[month] && Object.keys(budgets[month]).length > 0;
    const hasA = actuals.filter(i => i.month === month).length > 0;
    if (!hasB && !hasA) return;
    if (confirm(`删除${ml(month)}全部费用数据？`)) {
      const b = { ...budgets }; delete b[month]; saveBudgets(b);
      flushActuals(actuals.filter(i => i.month !== month));
    }
  };

  const monthBudgets = budgets[month] || {};
  const monthActuals = actuals.filter(i => i.month === month);

  const monthData = EXPENSE_CATEGORIES.map(cat => {
    const projected = monthBudgets[cat.key] || 0;
    const catActuals = monthActuals.filter(i => i.category === cat.key);
    const totalActual = catActuals.reduce((s, i) => s + i.amount, 0);
    return { cat, projected, totalActual, catActuals, balance: projected - totalActual };
  });

  const totals = monthData.reduce((s, d) => ({ p: s.p + d.projected, a: s.a + d.totalActual }), { p: 0, a: 0 });

  // Year summary
  const yearData = ALL_MONTHS.map(m => {
    const b = budgets[m] ? Object.values(budgets[m]).reduce((s, v) => s + v, 0) : 0;
    const a = actuals.filter(i => i.month === m).reduce((s, i) => s + i.amount, 0);
    return { month: m, projected: b, actual: a, balance: b - a };
  }).filter(d => d.projected > 0 || d.actual > 0);

  // YTD
  const ytd = yearData.filter(d => d.month >= '2026-05' && d.month <= month);
  const yp = ytd.reduce((s, d) => s + d.projected, 0);
  const ya = ytd.reduce((s, d) => s + d.actual, 0);

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      <div className="p-4 md:p-6 space-y-6 max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div><h1 className="text-2xl font-bold text-gray-800">费用管理</h1><p className="text-sm text-gray-400 mt-0.5">预提总控 · 支出按门店归属</p></div>
          <div className="flex items-center gap-2">
            <select value={month} onChange={e => setMonth(e.target.value)} className="border border-gray-200 rounded-xl px-4 py-2 text-sm font-medium bg-white">
              {ALL_MONTHS.map(m => <option key={m} value={m}>{ml(m)}</option>)}
            </select>
            <button onClick={copyPrev} disabled={ALL_MONTHS.indexOf(month) <= 0} className="px-3 py-2 text-xs font-medium text-gray-500 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 disabled:opacity-30">延用上月</button>
            <button onClick={clearMonth} className="px-3 py-2 text-xs font-medium text-red-400 bg-white border border-red-200 rounded-xl hover:bg-red-50">清空</button>
            <button onClick={() => setModal(true)} className="flex items-center gap-1.5 px-4 py-2 bg-gray-900 text-white rounded-xl text-sm font-medium hover:bg-gray-800 shadow-sm"><Plus size={16} />新增支出</button>
          </div>
        </div>

        {/* YTD */}
        <div className="bg-gradient-to-r from-gray-900 to-gray-800 rounded-2xl shadow-lg p-6 text-white">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">5月 - {ml(month)} 累计</p>
          <div className="grid grid-cols-3 gap-8">
            <div><p className="text-sm text-gray-400 mb-1">累计预提</p><p className="text-2xl font-bold text-blue-400">{fmt(yp)}</p></div>
            <div><p className="text-sm text-gray-400 mb-1">累计支出</p><p className="text-2xl font-bold text-red-400">{fmt(ya)}</p></div>
            <div><p className="text-sm text-gray-400 mb-1">累计结余</p><p className={`text-2xl font-bold ${(yp-ya) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{fmt(yp - ya)}</p></div>
          </div>
        </div>

        {/* KPI */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { l: '本月预提', v: fmt(totals.p), icon: '💵', bg: 'bg-blue-50' },
            { l: '实际支出', v: fmt(totals.a), icon: '📉', bg: 'bg-red-50' },
            { l: '结余', v: fmt(totals.p - totals.a), icon: '💰', bg: totals.p - totals.a >= 0 ? 'bg-emerald-50' : 'bg-red-50' },
          ].map(k => (
            <div key={k.l} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <div className="flex items-center justify-between mb-3"><p className="text-xs font-semibold text-gray-500 uppercase">{k.l}</p><div className={`w-9 h-9 rounded-xl ${k.bg} flex items-center justify-center text-lg`}>{k.icon}</div></div>
              <p className="text-2xl font-bold text-gray-800">{k.v}</p>
            </div>
          ))}
        </div>

        {/* Detail Table */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-50"><h2 className="text-sm font-bold text-gray-700">{ml(month)} 费用明细</h2></div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="bg-gray-50/30 border-b border-gray-100">
                <th className="text-left px-6 py-3 text-[11px] font-semibold text-gray-500 uppercase">类别</th>
                <th className="text-right px-5 py-3 text-[11px] font-semibold text-gray-500 uppercase">预提</th>
                <th className="text-right px-5 py-3 text-[11px] font-semibold text-gray-500 uppercase">实际支出</th>
                <th className="text-right px-5 py-3 text-[11px] font-semibold text-gray-500 uppercase">结余</th>
                <th className="text-center px-3 py-3 w-10"></th>
              </tr></thead>
              <tbody className="divide-y divide-gray-50">
                {monthData.map(({ cat, projected, totalActual, balance, catActuals }) => (
                  <>
                    <tr key={cat.key} className="hover:bg-gray-50/30 cursor-pointer" onClick={() => setExpand(expand === cat.key ? null : cat.key)}>
                      <td className="px-6 py-3.5">
                        <div className="flex items-center gap-2">
                          {expand === cat.key ? <ChevronDown size={14} className="text-gray-400" /> : <ChevronRight size={14} className="text-gray-400" />}
                          <span className="text-base">{cat.icon}</span><span className="text-xs font-semibold text-gray-800">{cat.label}</span>
                          {catActuals.length > 0 && <span className="text-[10px] text-gray-400">({catActuals.length}笔)</span>}
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-right" onClick={e => e.stopPropagation()}>
                        {editCat === cat.key ? (
                          <input type="number" min="0" value={editVal} autoFocus
                            onChange={e => setEditVal(e.target.value)}
                            onBlur={() => setBudget(cat.key, parseInt(editVal) || 0)}
                            onKeyDown={e => { if (e.key === 'Enter') setBudget(cat.key, parseInt(editVal) || 0); if (e.key === 'Escape') setEditCat(null); }}
                            className="w-24 text-right border border-gray-300 rounded-lg px-2 py-1 text-xs font-bold text-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-200" />
                        ) : (
                          <span onClick={() => { setEditCat(cat.key); setEditVal(String(projected || '')); }}
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
                      <td className="px-3 py-3.5 text-center" onClick={e => e.stopPropagation()}>
                        <button onClick={() => setModal(true)} className="p-1 rounded-lg text-gray-300 hover:text-starbucks-600 hover:bg-starbucks-50"><Plus size={15} /></button>
                      </td>
                    </tr>
                    {expand === cat.key && catActuals.map(a => (
                      <tr key={a.id} className="bg-gray-50/30">
                        <td className="px-12 py-2.5 text-xs text-gray-500" onClick={e => e.stopPropagation()}>
                          ● {a.location} {a.remark ? `· ${a.remark}` : ''}
                        </td>
                        <td></td>
                        <td className="px-5 py-2.5 text-right" onClick={e => e.stopPropagation()}>
                          {editActualId === a.id ? (
                            <input type="number" min="0" value={editActualVal} autoFocus
                              onChange={e => setEditActualVal(e.target.value)}
                              onBlur={() => { editActual(a.id, { amount: parseInt(editActualVal) || 0 }); setEditActualId(null); }}
                              onKeyDown={e => { if (e.key === 'Enter') { editActual(a.id, { amount: parseInt(editActualVal) || 0 }); setEditActualId(null); } if (e.key === 'Escape') setEditActualId(null); }}
                              className="w-24 text-right border border-gray-300 rounded-lg px-2 py-1 text-xs font-bold text-red-500 focus:outline-none focus:ring-2 focus:ring-red-200" />
                          ) : (
                            <span onClick={() => { setEditActualId(a.id); setEditActualVal(String(a.amount)); }}
                              className="font-bold text-red-500 cursor-pointer hover:underline text-xs">{fmt(a.amount)}</span>
                          )}
                        </td>
                        <td></td>
                        <td className="px-3 py-2.5 text-center"><button onClick={() => delActual(a.id)} className="text-gray-300 hover:text-red-500"><Trash2 size={13} /></button></td>
                      </tr>
                    ))}
                  </>
                ))}
              </tbody>
              <tfoot><tr className="bg-gray-50/80 border-t-2 border-gray-100 font-bold">
                <td className="px-6 py-3.5 text-xs text-gray-700">合计</td>
                <td className="px-5 py-3.5 text-right text-xs text-blue-600">{fmt(totals.p)}</td>
                <td className="px-5 py-3.5 text-right text-xs text-red-600">{fmt(totals.a)}</td>
                <td className="px-5 py-3.5 text-right text-xs text-emerald-600">{fmt(totals.p - totals.a)}</td>
                <td className="px-3 py-3.5"></td>
              </tr></tfoot>
            </table>
          </div>
        </div>

        {/* Per-location */}
        {(() => {
          const m: Record<string, number> = {};
          monthActuals.forEach(i => { m[i.location] = (m[i.location] || 0) + i.amount; });
          const locs = Object.entries(m).sort((a,b) => b[1] - a[1]);
          if (locs.length === 0) return null;
          return (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-50"><h2 className="text-sm font-bold text-gray-700">各门店支出分布</h2></div>
              <div className="p-4 grid grid-cols-2 md:grid-cols-4 gap-3">
                {locs.map(([loc, amt]) => (
                  <div key={loc} className="bg-gray-50 rounded-xl p-3 text-center"><p className="text-xs font-medium text-gray-700 mb-1">{loc}</p><p className="text-lg font-bold text-red-600">{fmt(amt)}</p></div>
                ))}
              </div>
            </div>
          );
        })()}

        {/* Year */}
        {yearData.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-50"><h2 className="text-sm font-bold text-gray-700">全年汇总</h2></div>
            <div className="overflow-x-auto"><table className="w-full text-sm">
              <thead><tr className="bg-gray-50/30 border-b border-gray-100"><th className="text-left px-6 py-3 text-[11px] font-semibold text-gray-500 uppercase">月份</th><th className="text-right px-5 py-3 text-[11px] font-semibold text-gray-500 uppercase">预提</th><th className="text-right px-5 py-3 text-[11px] font-semibold text-gray-500 uppercase">实际</th><th className="text-right px-5 py-3 text-[11px] font-semibold text-gray-500 uppercase">结余</th></tr></thead>
              <tbody className="divide-y divide-gray-50">
                {yearData.map(d => (
                  <tr key={d.month} className="hover:bg-gray-50/30"><td className="px-6 py-3 text-xs font-medium text-gray-800">{ml(d.month)}</td><td className="px-5 py-3 text-right text-xs font-bold text-blue-600">{fmt(d.projected)}</td><td className="px-5 py-3 text-right text-xs font-bold text-red-600">{fmt(d.actual)}</td><td className="px-5 py-3 text-right text-xs font-bold" style={{ color: d.balance >= 0 ? '#059669' : '#ef4444' }}>{fmt(d.balance)}</td></tr>
                ))}
              </tbody>
            </table></div>
          </div>
        )}

        {/* Modal */}
        {modal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setModal(false)} />
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-50 bg-gray-50/50"><h3 className="text-sm font-semibold text-gray-800">新增支出</h3><button onClick={() => setModal(false)} className="p-1.5 rounded-full hover:bg-gray-200"><X size={16} className="text-gray-400" /></button></div>
              <ActualForm month={month} distNames={distNames} onSave={addActual} onCancel={() => setModal(false)} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ActualForm({ month, distNames, onSave, onCancel }: { month: string; distNames: string[]; onSave: (d: ActualItem) => void; onCancel: () => void }) {
  const [f, setF] = useState({ category: 'display', location: '', amount: 0, remark: '' });
  const cls = "w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-gray-50 focus:outline-none focus:bg-white focus:border-gray-400 transition-all";
  const lbl = "text-[11px] text-gray-400 mb-1 block font-medium";
  return (
    <div className="p-6 space-y-4">
      <div><label className={lbl}>费用类别</label><select value={f.category} onChange={e => setF({ ...f, category: e.target.value })} className={cls}>{EXPENSE_CATEGORIES.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}</select></div>
      <div>
        <label className={lbl}>归属门店 *</label>
        <input value={f.location} onChange={e => setF({ ...f, location: e.target.value })} placeholder="门店名称" className={cls} list="loc-list" />
        <datalist id="loc-list">{distNames.map(l => <option key={l} value={l} />)}</datalist>
        <div className="flex flex-wrap gap-1 mt-1.5">{distNames.map(l => <button key={l} onClick={() => setF({ ...f, location: l })} className={`text-[10px] px-2 py-0.5 rounded-full border ${f.location === l ? 'bg-starbucks-500 text-white' : 'bg-gray-50 text-gray-500'}`}>{l}</button>)}</div>
      </div>
      <div><label className={lbl}>支出金额 (元) *</label><input type="number" min="0" value={f.amount || ''} onChange={e => setF({ ...f, amount: parseInt(e.target.value) || 0 })} className={cls} autoFocus /></div>
      <div><label className={lbl}>备注</label><input value={f.remark} onChange={e => setF({ ...f, remark: e.target.value })} placeholder="说明" className={cls} /></div>
      <div className="flex justify-end gap-3 pt-2"><button onClick={onCancel} className="px-5 py-2.5 text-sm text-gray-500 hover:bg-gray-50 rounded-xl">取消</button><button onClick={() => { if (f.location && f.amount > 0) onSave({ id: genId(), month, ...f }); }} className="px-6 py-2.5 bg-gray-900 text-white rounded-xl text-sm font-medium hover:bg-gray-800 shadow-sm">保存</button></div>
    </div>
  );
}
