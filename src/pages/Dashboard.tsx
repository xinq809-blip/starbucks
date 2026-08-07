import { useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  getAvailableWeeks, getWeekLabel, getCurrentWeekStart, getProductById, getDistributorById,
  getAvailableMonths,
  getSlowMoving, getCategoryLabel,
} from '../data/mockData';
import { Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import {
  TrendingUp, Package, AlertCircle,
  DollarSign, Clock, Target, Download,
} from 'lucide-react';

const PIE_COLORS = ['#00704A', '#2ea86e', '#f59e0b', '#8b5cf6', '#ef4444', '#3b82f6', '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#14b8a6', '#6366f1'];
const FOCUS_IDS = ['p11', 'p20']; // P450 黑咖啡, P270 椰椰拿铁

export default function Dashboard() {
  const { state, saveTarget } = useApp();
  const { products, distributors, snapshots, restocks } = state;

  const weeks = useMemo(() => getAvailableWeeks(snapshots), [snapshots]);
  const months = useMemo(() => getAvailableMonths(snapshots), [snapshots]);
  const currentMonth = months.length > 0 ? months[months.length - 1] : (weeks.length > 0 ? weeks[weeks.length - 1] : getCurrentWeekStart()).slice(0, 7);
  // ====== 总经销 / 分销商 ======
  const mainDist = useMemo(() => {
    const m = distributors.find(d => d.role === 'main');
    if (m) return m;
    return distributors.find(d => d.name.includes('辰日')) || distributors.find(d => d.region === '唐山') || distributors[0] || null;
  }, [distributors]);
  const subDists = useMemo(() => {
    if (!mainDist) return [];
    const s = distributors.filter(d => d.role === 'sub');
    if (s.length > 0) return s;
    return distributors.filter(d => d.id !== mainDist.id);
  }, [distributors, mainDist]);

  // ====== 盘点对比：按录入时间配对 ======
  // Each recording = a 盘点. Compare consecutive pairs.
  const pairs = useMemo(() => {
    const p: { prev: string; curr: string; label: string }[] = [];
    for (let i = 0; i < weeks.length - 1; i++) {
      p.push({ prev: weeks[i], curr: weeks[i + 1], label: `第${i + 1}→${i + 2}次` });
    }
    return p;
  }, [weeks]);

  const [pairIdx, setPairIdx] = useState(Math.max(0, pairs.length - 1));
  const activePrev = pairs.length > 0 ? pairs[pairIdx]?.prev : null;
  const activeCurr = pairs.length > 0 ? pairs[pairIdx]?.curr : weeks.length > 0 ? weeks[weeks.length - 1] : getCurrentWeekStart();

  const [selectedDist, setSelectedDist] = useState(distributors[0]?.id ?? '');
  const [targetInput, setTargetInput] = useState('');
  const [editingTarget, setEditingTarget] = useState(false);

  // ====== 辅助函数：计算某经销商/某期 库存/进货/销量 ======
  const calcDist = (distId: string, curr: string, prev: string | null) => {
    const stock = snapshots.filter(s => s.weekStart === curr && s.distributorId === distId).reduce((a: number, s: any) => a + s.quantity, 0);
    const prevStock = prev ? snapshots.filter(s => s.weekStart === prev && s.distributorId === distId).reduce((a: number, s: any) => a + s.quantity, 0) : 0;
    const r = (restocks || []).filter((x: any) => x.distributorId === distId && x.date > (prev || '2000-01-01') && x.date <= curr).reduce((a: number, x: any) => a + x.quantity, 0);
    const sales = Math.max(0, prevStock + r - stock);
    return { stock, prevStock, restock: r, sales };
  };

  const calcGroup = (ids: string[], curr: string, prev: string | null) => {
    let stock = 0, prevStock = 0, restock = 0;
    for (const id of ids) {
      const d = calcDist(id, curr, prev);
      stock += d.stock; prevStock += d.prevStock; restock += d.restock;
    }
    const sales = Math.max(0, prevStock + restock - stock);
    return { stock, prevStock, restock, sales };
  };

  const calcProduct = (productId: string, ids: string[], curr: string, prev: string | null) => {
    let stock = 0, prevStock = 0, restock = 0;
    for (const id of ids) {
      stock += snapshots.filter(s => s.weekStart === curr && s.distributorId === id && s.productId === productId).reduce((a: number, s: any) => a + s.quantity, 0);
      prevStock += prev ? snapshots.filter(s => s.weekStart === prev && s.distributorId === id && s.productId === productId).reduce((a: number, s: any) => a + s.quantity, 0) : 0;
      restock += (restocks || []).filter((x: any) => x.distributorId === id && x.date > (prev || '2000-01-01') && x.date <= curr && x.productId === productId).reduce((a: number, x: any) => a + x.quantity, 0);
    }
    const sales = Math.max(0, prevStock + restock - stock);
    return { stock, prevStock, restock, sales };
  };

  // ====== Section 1: 总经销 vs 分销商 ======
  const mainIds = subDists.length > 0 ? subDists.map(d => d.id) : distributors.filter(d => d.id !== mainDist?.id).map(d => d.id);
  const subIds = subDists.map(d => d.id);

  const mainGroup = useMemo(() => calcGroup(mainIds, activeCurr, activePrev), [mainIds, activeCurr, activePrev, snapshots, restocks]);
  const subGroup = useMemo(() => subIds.length > 0 ? calcGroup(subIds, activeCurr, activePrev) : null, [subIds, activeCurr, activePrev, snapshots, restocks]);

  // Focus products: 450 黑咖啡 + 椰椰拿铁
  const mainFocus = useMemo(() => FOCUS_IDS.map(pid => {
    const p = getProductById(pid);
    const d = calcProduct(pid, mainIds, activeCurr, activePrev);
    return { name: p?.name || pid, ...d };
  }), [mainIds, activeCurr, activePrev, snapshots, restocks]);
  const subFocus = useMemo(() => subIds.length > 0 ? FOCUS_IDS.map(pid => {
    const p = getProductById(pid);
    const d = calcProduct(pid, subIds, activeCurr, activePrev);
    return { name: p?.name || pid, ...d };
  }) : null, [subIds, activeCurr, activePrev, snapshots, restocks]);

  // ====== Other data ======
  const firstRestockDate = useMemo(() => {
    const dates = (restocks || []).map(r => r.date).sort();
    return dates.length > 0 ? dates[0] : activeCurr;
  }, [restocks, activeCurr]);


  // ====== Export ======
  const exportCSV = () => {
    if (!activePrev) return;
    const rows = [['经销商', '上期库存', '期间进货', '本期库存', '本期销量']];
    for (const d of distributors) {
      const dd = calcDist(d.id, activeCurr, activePrev);
      rows.push([d.name, String(dd.prevStock), String(dd.restock), String(dd.stock), String(dd.sales)]);
    }
    const csv = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `盘点对比_${activePrev}_${activeCurr}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const KpiCard = ({ label, value, sub, icon: Icon, color, bg }: any) => (
    <div className="bg-white rounded-xl border border-gray-200 p-3.5">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs text-gray-500">{label}</span>
        <div className={`p-1 rounded-lg ${bg}`}><Icon size={14} className={color} /></div>
      </div>
      <div className="text-lg font-bold text-gray-800">{value}</div>
      <div className="text-[11px] text-gray-400">{sub}</div>
    </div>
  );

  return (
    <div className="p-3 md:p-6 space-y-3 md:space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-gray-800">数据看板</h1>
          <p className="text-[11px] md:text-xs text-gray-400">
            区间: {firstRestockDate} → {activeCurr} · 共{weeks.length}次盘点
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={exportCSV} className="flex items-center gap-1 px-2 py-1.5 text-[11px] md:text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50"><Download size={13} />导出</button>
          {editingTarget && (
            <div className="flex items-center gap-1">
              <input type="number" value={targetInput} onChange={e => setTargetInput(e.target.value)} placeholder="目标件数" className="border border-gray-200 rounded-lg px-2 py-1 text-xs w-24" onKeyDown={e => e.key === 'Enter' && (() => { const v = parseInt(targetInput); if (v > 0) { saveTarget({ month: currentMonth, salesTarget: v }); setTargetInput(''); setEditingTarget(false); } })()} />
              <button onClick={() => { const v = parseInt(targetInput); if (v > 0) { saveTarget({ month: currentMonth, salesTarget: v }); setTargetInput(''); setEditingTarget(false); } }} className="px-2 py-1 bg-starbucks-500 text-white rounded text-[10px]">保存</button>
              <button onClick={() => setEditingTarget(false)} className="text-[10px] text-gray-400">取消</button>
            </div>
          )}
        </div>
      </div>

      {/* ==================== TWO-COLUMN LAYOUT ==================== */}
      <div className="flex flex-col lg:flex-row gap-4">

        {/* ===== LEFT: 总看板 (fixed width) ===== */}
        <div className="lg:w-[380px] flex-shrink-0 space-y-3">
          <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-4 sticky top-4">
            <h2 className="text-sm font-bold text-gray-800 flex items-center gap-2">
              <Target size={15} className="text-starbucks-500" />总看板
            </h2>

            {/* 总经销 row */}
            {mainDist && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-starbucks-500" />
                  <h3 className="text-xs font-bold text-gray-800">{mainDist.name}<span className="text-[10px] text-gray-400 font-normal ml-1">总经销</span></h3>
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  <KpiCard label="累计进货" value={mainGroup.restock.toLocaleString() + ' 件'} sub="从公司进货" icon={Package} color="text-blue-500" bg="bg-blue-50" />
                  <KpiCard label="现有库存" value={mainGroup.stock.toLocaleString() + ' 件'} sub={getWeekLabel(activeCurr)} icon={Package} color="text-violet-500" bg="bg-violet-50" />
                  <KpiCard label="累计出货" value={mainGroup.sales.toLocaleString() + ' 件'} sub={activePrev ? `较上期` : ''} icon={TrendingUp} color="text-emerald-500" bg="bg-emerald-50" />
                  <KpiCard label="库存价值" value={'¥' + (snapshots.filter(s => mainIds.includes(s.distributorId) && s.weekStart === activeCurr).reduce((a: number, s: any) => { const p = products.find(x => x.id === s.productId); return a + s.quantity * (p?.unitPrice || 0); }, 0) / 10000).toFixed(1) + '万'} sub={getWeekLabel(activeCurr)} icon={DollarSign} color="text-amber-500" bg="bg-amber-50" />
                </div>

                {/* 450 + 椰椰 */}
                <div className="grid grid-cols-2 gap-1.5 mt-1.5">
                  {mainFocus.map(f => (
                    <div key={f.name} className="bg-starbucks-50 rounded-xl border border-starbucks-100 p-2.5">
                      <p className="text-[10px] font-bold text-starbucks-700 truncate">{f.name}</p>
                      <div className="flex flex-col gap-0.5 mt-1 text-[10px]">
                        <span className="text-gray-500">出货 <b className="text-gray-800">{f.sales.toLocaleString()}</b></span>
                        <span className="text-gray-500">库存 <b className="text-gray-800">{f.stock.toLocaleString()}</b></span>
                        <span className="text-gray-500">进货 <b className="text-gray-800">{f.restock.toLocaleString()}</b></span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 分销商 row */}
            {subGroup && (
              <div className="pt-3 border-t border-gray-100">
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-gray-400" />
                  <h3 className="text-xs font-bold text-gray-700">分销商<span className="text-[10px] text-gray-400 font-normal ml-1">{subDists.length} 家</span></h3>
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  <KpiCard label="分销商进货" value={subGroup.restock.toLocaleString() + ' 件'} sub="期间累计" icon={Package} color="text-blue-500" bg="bg-blue-50" />
                  <KpiCard label="分销商库存" value={subGroup.stock.toLocaleString() + ' 件'} sub={getWeekLabel(activeCurr)} icon={Package} color="text-violet-500" bg="bg-violet-50" />
                  <KpiCard label="分销商出货" value={subGroup.sales.toLocaleString() + ' 件'} sub={activePrev ? `较上期` : ''} icon={TrendingUp} color="text-emerald-500" bg="bg-emerald-50" />
                  <KpiCard label="库存价值" value={'¥' + (snapshots.filter(s => subIds.includes(s.distributorId) && s.weekStart === activeCurr).reduce((a: number, s: any) => { const p = products.find(x => x.id === s.productId); return a + s.quantity * (p?.unitPrice || 0); }, 0) / 10000).toFixed(1) + '万'} sub={getWeekLabel(activeCurr)} icon={DollarSign} color="text-amber-500" bg="bg-amber-50" />
                </div>
                {/* 450 + 椰椰 for subs */}
                {subFocus && (
                  <div className="grid grid-cols-2 gap-1.5 mt-1.5">
                    {subFocus.map(f => (
                      <div key={f.name} className="bg-gray-50 rounded-xl border border-gray-100 p-2.5">
                        <p className="text-[10px] font-bold text-gray-700 truncate">{f.name}</p>
                        <div className="flex flex-col gap-0.5 mt-1 text-[10px]">
                          <span className="text-gray-500">出货 <b className="text-gray-800">{f.sales.toLocaleString()}</b></span>
                          <span className="text-gray-500">库存 <b className="text-gray-800">{f.stock.toLocaleString()}</b></span>
                          <span className="text-gray-500">进货 <b className="text-gray-800">{f.restock.toLocaleString()}</b></span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ===== RIGHT: 盘点对比 ===== */}
        <div className="flex-1 min-w-0 space-y-3 md:space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <h2 className="text-sm font-bold text-gray-800 flex items-center gap-2 mb-3">
              <Clock size={15} className="text-starbucks-500" />盘点对比
            </h2>

            {/* Pair selector */}
            {pairs.length > 0 ? (
              <div className="flex items-center gap-1.5 mb-4 overflow-x-auto pb-1">
                {pairs.map((p, i) => (
                  <button key={i} onClick={() => setPairIdx(i)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                      i === pairIdx ? 'bg-starbucks-500 text-white shadow-sm' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                    }`}>
                    {p.label}<span className="ml-1 opacity-70">{getWeekLabel(p.prev)} → {getWeekLabel(p.curr)}</span>
                  </button>
                ))}
              </div>
            ) : weeks.length === 1 ? (
              <div className="text-xs text-gray-400 mb-4">仅有1次盘点（{getWeekLabel(weeks[0])}），录入第2次盘点后会显示对比</div>
            ) : (
              <div className="text-xs text-gray-400 mb-4">暂无盘点数据</div>
            )}

            {/* Comparison table */}
            {activePrev && (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-gray-100 text-gray-500">
                      <th className="text-left py-2 font-medium">经销商</th>
                      <th className="text-right py-2 font-medium">盘点前<br/><span className="text-[10px] font-normal text-gray-400">({getWeekLabel(activePrev)})</span></th>
                      <th className="text-right py-2 font-medium">期间进货</th>
                      <th className="text-right py-2 font-medium">盘点时<br/><span className="text-[10px] font-normal text-gray-400">({getWeekLabel(activeCurr)})</span></th>
                      <th className="text-right py-2 font-medium">期间出货</th>
                      <th className="text-right py-2 font-medium">变化</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {mainDist && subDists.length > 0 && (
                      <tr className="bg-starbucks-50/50">
                        <td className="py-2.5 font-bold text-sm text-gray-800">{mainDist.name}<span className="text-[10px] text-starbucks-500 ml-1 font-normal">合计</span></td>
                        <td className="py-2.5 text-right font-bold text-gray-700">{mainGroup.prevStock.toLocaleString()}</td>
                        <td className={`py-2.5 text-right font-bold ${mainGroup.restock > 0 ? 'text-blue-600' : 'text-gray-400'}`}>{mainGroup.restock > 0 ? '+' + mainGroup.restock.toLocaleString() : '—'}</td>
                        <td className="py-2.5 text-right font-bold text-gray-700">{mainGroup.stock.toLocaleString()}</td>
                        <td className={`py-2.5 text-right font-bold ${mainGroup.sales > 0 ? 'text-emerald-600' : 'text-gray-300'}`}>{mainGroup.sales > 0 ? mainGroup.sales.toLocaleString() : '—'}</td>
                        <td className={`py-2.5 text-right font-bold ${mainGroup.stock - mainGroup.prevStock >= 0 ? 'text-amber-600' : 'text-blue-600'}`}>
                          {mainGroup.stock - mainGroup.prevStock > 0 ? '+' + (mainGroup.stock - mainGroup.prevStock).toLocaleString() : mainGroup.stock - mainGroup.prevStock < 0 ? (mainGroup.stock - mainGroup.prevStock).toLocaleString() : '—'}
                        </td>
                      </tr>
                    )}
                    {(subDists.length > 0 ? subDists : distributors).map(d => {
                      const dd = calcDist(d.id, activeCurr, activePrev);
                      if (dd.prevStock === 0 && dd.stock === 0 && dd.restock === 0) return null;
                      return (
                        <tr key={d.id} className="hover:bg-gray-50/50">
                          <td className="py-2.5 text-gray-700 pl-4">{d.name}{d.role === 'sub' && <span className="text-[10px] text-gray-400 ml-1">分销商</span>}</td>
                          <td className="py-2.5 text-right text-gray-500">{dd.prevStock.toLocaleString()}</td>
                          <td className={`py-2.5 text-right font-medium ${dd.restock > 0 ? 'text-blue-600' : 'text-gray-400'}`}>{dd.restock > 0 ? '+' + dd.restock.toLocaleString() : '—'}</td>
                          <td className="py-2.5 text-right text-gray-700 font-medium">{dd.stock.toLocaleString()}</td>
                          <td className={`py-2.5 text-right font-bold ${dd.sales > 0 ? 'text-emerald-600' : 'text-gray-300'}`}>{dd.sales > 0 ? dd.sales.toLocaleString() : '—'}</td>
                          <td className={`py-2.5 text-right font-medium ${dd.stock - dd.prevStock >= 0 ? 'text-amber-600' : 'text-blue-600'}`}>
                            {dd.stock - dd.prevStock > 0 ? '+' + (dd.stock - dd.prevStock).toLocaleString() : dd.stock - dd.prevStock < 0 ? (dd.stock - dd.prevStock).toLocaleString() : '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* 单品分析 + 品类饼图 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-gray-700">单品分析</h3>
                <select value={selectedDist} onChange={(e) => setSelectedDist(e.target.value)} className="border border-gray-200 rounded-lg px-2 py-1 text-xs bg-white">
                  {distributors.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
              <div className="max-h-[300px] overflow-y-auto">
                <table className="w-full text-xs">
                  <thead><tr className="border-b border-gray-100 text-gray-400"><th className="text-left py-1 font-medium">产品</th><th className="text-right py-1 font-medium">盘点前</th><th className="text-right py-1 font-medium">盘点时</th><th className="text-right py-1 font-medium">出货</th></tr></thead>
                  <tbody className="divide-y divide-gray-50">
                    {products.map(p => {
                      if (!activePrev) return null;
                      const d = calcProduct(p.id, [selectedDist], activeCurr, activePrev);
                      if (d.prevStock === 0 && d.stock === 0 && d.restock === 0) return null;
                      return (
                        <tr key={p.id} className="hover:bg-gray-50/50">
                          <td className="py-1 text-gray-700 truncate max-w-[160px]">{p.name}</td>
                          <td className="py-1 text-right text-gray-500">{d.prevStock}</td>
                          <td className="py-1 text-right text-gray-700 font-medium">{d.stock}</td>
                          <td className={`py-1 text-right font-bold ${d.sales > 0 ? 'text-emerald-600' : 'text-gray-300'}`}>{d.sales > 0 ? d.sales : '—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">品类结构</h3>
              {(() => {
                const cats: Record<string, number> = {};
                if (activePrev) {
                  for (const p of products) {
                    const d = calcProduct(p.id, distributors.map(d => d.id), activeCurr, activePrev);
                    if (d.sales > 0) {
                      const cat = getCategoryLabel(p.category);
                      cats[cat] = (cats[cat] || 0) + d.sales;
                    }
                  }
                }
                const data = Object.entries(cats).map(([k, v]) => ({ name: k, value: v }));
                if (data.length === 0) return <div className="flex items-center justify-center h-[250px] text-gray-400 text-sm">暂无数据</div>;
                return (
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                      <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }: any) => `${name} ${(percent * 100).toFixed(0)}%`}>
                        {data.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                      </Pie>
                      <Tooltip formatter={(v: any) => Number(v).toLocaleString() + ' 件'} />
                    </PieChart>
                  </ResponsiveContainer>
                );
              })()}
            </div>
          </div>

          {/* 滞销预警 */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2"><AlertCircle size={14} className="text-amber-500" />滞销预警</h3>
            {(() => {
              const slow = getSlowMoving(snapshots, restocks, distributors);
              if (slow.length === 0) return <div className="text-xs text-gray-400 text-center py-4">所有产品均有动销</div>;
              return slow.slice(0, 8).map((sm, i) => {
                const p = getProductById(sm.productId);
                const d = getDistributorById(sm.distributorId);
                return (
                  <div key={i} className="flex items-center justify-between p-2 rounded-lg border border-amber-100 bg-amber-50/50 mb-1.5 last:mb-0">
                    <div><p className="text-xs font-medium text-gray-800">{p?.name}</p><p className="text-[10px] text-gray-400">{d?.name}</p></div>
                    <span className="text-xs font-bold text-amber-600">{sm.weeksStale} 周未动销</span>
                  </div>
                );
              });
            })()}
          </div>
        </div>
      </div>
    </div>
  );
}
