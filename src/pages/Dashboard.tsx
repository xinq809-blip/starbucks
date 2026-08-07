import { useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  getAvailableWeeks, getWeekLabel, getCurrentWeekStart, getProductById, getDistributorById,
  getSlowMoving, getCategoryLabel, getInventoryValue, getTurnoverDays,
} from '../data/mockData';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { TrendingUp, Package, Coffee, AlertCircle, DollarSign, Clock, Download, MapPin } from 'lucide-react';

const PIE_COLORS = ['#00704A', '#2ea86e', '#f59e0b', '#8b5cf6', '#ef4444', '#3b82f6', '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#14b8a6', '#6366f1'];
const FOCUS_IDS = ['p11', 'p20'];

export default function Dashboard() {
  const { state } = useApp();
  const { products, distributors, snapshots, restocks } = state;

  const weeks = useMemo(() => getAvailableWeeks(snapshots), [snapshots]);
  const hasData = weeks.length > 0;

  // 总经销 / 分销商
  const mainDist = useMemo(() => {
    const m = distributors.find(d => d.role === 'main');
    return m || distributors.find(d => d.name.includes('辰日')) || distributors.find(d => d.region === '唐山') || distributors[0] || null;
  }, [distributors]);
  const subDists = useMemo(() => {
    if (!mainDist) return [];
    const s = distributors.filter(d => d.role === 'sub');
    return s.length > 0 ? s : distributors.filter(d => d.id !== mainDist.id);
  }, [distributors, mainDist]);

  // 盘点配对
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

  const subIds = subDists.map(d => d.id);
  const allIds = subIds.length > 0 ? subIds : distributors.map(d => d.id);

  // 计算函数
  const calcDist = (distId: string) => {
    const stock = snapshots.filter(s => s.weekStart === activeCurr && s.distributorId === distId).reduce((a: number, s: any) => a + s.quantity, 0);
    const prevStock = activePrev ? snapshots.filter(s => s.weekStart === activePrev && s.distributorId === distId).reduce((a: number, s: any) => a + s.quantity, 0) : 0;
    const restock = (restocks || []).filter((x: any) => x.distributorId === distId && x.date > (activePrev || '2000-01-01') && x.date <= activeCurr).reduce((a: number, x: any) => a + x.quantity, 0);
    const sales = Math.max(0, prevStock + restock - stock);
    return { stock, prevStock, restock, sales };
  };

  const calcProd = (pid: string, ids: string[]) => {
    let stock = 0, prevStock = 0, restock = 0;
    for (const id of ids) {
      stock += snapshots.filter(s => s.weekStart === activeCurr && s.distributorId === id && s.productId === pid).reduce((a: number, s: any) => a + s.quantity, 0);
      prevStock += activePrev ? snapshots.filter(s => s.weekStart === activePrev && s.distributorId === id && s.productId === pid).reduce((a: number, s: any) => a + s.quantity, 0) : 0;
      restock += (restocks || []).filter((x: any) => x.distributorId === id && x.date > (activePrev || '2000-01-01') && x.date <= activeCurr && x.productId === pid).reduce((a: number, x: any) => a + x.quantity, 0);
    }
    return { stock, prevStock, restock, sales: Math.max(0, prevStock + restock - stock) };
  };

  // 汇总数据
  const totalData = useMemo(() => {
    let stock = 0, prevStock = 0, restock = 0;
    for (const id of allIds) { const d = calcDist(id); stock += d.stock; prevStock += d.prevStock; restock += d.restock; }
    return { stock, prevStock, restock, sales: Math.max(0, prevStock + restock - stock) };
  }, [allIds, activeCurr, activePrev, snapshots, restocks]);

  const invValue = hasData ? getInventoryValue(snapshots, activeCurr) : 0;
  const turnoverDays = hasData ? getTurnoverDays(snapshots, activeCurr, restocks, distributors) : null;

  // 区域对比
  const regionList = useMemo(() => [...new Set(distributors.map(d => d.region || '其他'))].filter(Boolean), [distributors]);

  // 品类分析
  const categoryData = useMemo(() => {
    const cats: Record<string, number> = {};
    for (const p of products) {
      const d = calcProd(p.id, allIds);
      if (d.sales > 0) { const c = getCategoryLabel(p.category); cats[c] = (cats[c] || 0) + d.sales; }
    }
    return Object.entries(cats).map(([cat, sales]) => ({ category: cat, sales })).sort((a, b) => b.sales - a.sales);
  }, [allIds, activeCurr, activePrev, snapshots, restocks]);

  // 单品分析
  const prodDetail = useMemo(() => products.map(p => {
    const d = calcProd(p.id, [selectedDist]);
    return { name: p.name, shortName: p.name.length > 14 ? p.name.slice(0, 13) + '…' : p.name, ...d };
  }).filter(p => p.sales > 0 || p.stock > 0).sort((a, b) => b.sales - a.sales), [selectedDist, activeCurr, activePrev]);

  // 滞销
  const slowMoving = useMemo(() => getSlowMoving(snapshots, restocks, distributors), [snapshots, restocks]);

  // 周趋势
  const weekTrend = useMemo(() => weeks.slice(1).map(w => {
    const prevW = weeks[weeks.indexOf(w) - 1];
    let sales = 0;
    for (const id of allIds) {
      const stock = snapshots.filter(s => s.weekStart === w && s.distributorId === id).reduce((a: number, s: any) => a + s.quantity, 0);
      const prevS = prevW ? snapshots.filter(s => s.weekStart === prevW && s.distributorId === id).reduce((a: number, s: any) => a + s.quantity, 0) : 0;
      const r = (restocks || []).filter((x: any) => x.distributorId === id && x.date > prevW && x.date <= w).reduce((a: number, x: any) => a + x.quantity, 0);
      sales += Math.max(0, prevS + r - stock);
    }
    return { week: getWeekLabel(w), sales };
  }), [weeks, allIds, snapshots, restocks]);

  const exportCSV = () => {
    const rows = [['经销商', '盘点前库存', '期间进货', '盘点库存', '出货']];
    for (const d of distributors) {
      const dd = calcDist(d.id);
      rows.push([d.name, String(dd.prevStock), String(dd.restock), String(dd.stock), String(dd.sales)]);
    }
    const csv = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv' })); a.download = `盘点对比_${activePrev}_${activeCurr}.csv`; a.click();
  };

  const KpiCard = ({ label, value, sub, icon: Icon, color, bg }: any) => (
    <div className="bg-white rounded-xl border border-gray-200 p-3.5">
      <div className="flex items-center justify-between mb-1.5"><span className="text-xs text-gray-500">{label}</span><div className={`p-1 rounded-lg ${bg}`}><Icon size={14} className={color} /></div></div>
      <div className="text-lg font-bold text-gray-800">{value}</div><div className="text-[11px] text-gray-400">{sub}</div>
    </div>
  );

  return (
    <div className="p-3 md:p-6 space-y-3 md:space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-gray-800">数据看板</h1>
          <p className="text-[11px] md:text-xs text-gray-400">共{weeks.length}次盘点 · {getWeekLabel(activeCurr)} · {allIds.length}家经销商</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={exportCSV} className="flex items-center gap-1 px-2 py-1.5 text-[11px] font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50"><Download size={13} />导出</button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2 md:gap-3">
        <KpiCard label="期间出货" value={totalData.sales.toLocaleString() + ' 件'} sub={activePrev ? `${getWeekLabel(activePrev)} → ${getWeekLabel(activeCurr)}` : ''} icon={TrendingUp} color="text-emerald-500" bg="bg-emerald-50" />
        <KpiCard label="盘点库存" value={totalData.stock.toLocaleString() + ' 件'} sub={getWeekLabel(activeCurr)} icon={Package} color="text-violet-500" bg="bg-violet-50" />
        <KpiCard label="库存价值" value={'¥' + (invValue / 10000).toFixed(1) + '万'} sub={getWeekLabel(activeCurr)} icon={DollarSign} color="text-blue-500" bg="bg-blue-50" />
        <KpiCard label="周转天数" value={turnoverDays !== null ? turnoverDays + ' 天' : '—'} sub="库存/日均出货" icon={Clock} color="text-cyan-500" bg="bg-cyan-50" />
        <KpiCard label="期间进货" value={totalData.restock.toLocaleString() + ' 件'} sub="两次盘点之间" icon={Package} color="text-amber-500" bg="bg-amber-50" />
        <KpiCard label="动销产品" value={`${products.filter(p => calcProd(p.id, allIds).sales > 0).length}/${products.length}`} sub="有出货的产品" icon={Coffee} color="text-orange-500" bg="bg-orange-50" />
      </div>

      {/* 盘点对比选择器 */}
      <div className="bg-white rounded-xl border border-gray-200 p-3">
        <div className="flex items-center gap-2 mb-1"><Clock size={14} className="text-starbucks-500" /><span className="text-xs font-semibold text-gray-700">盘点对比</span></div>
        {pairs.length > 0 ? (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            {pairs.map((p, i) => (
              <button key={i} onClick={() => setPairIdx(i)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${i === pairIdx ? 'bg-starbucks-500 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
                {p.label} <span className="opacity-70">{getWeekLabel(p.curr)}</span>
              </button>
            ))}
          </div>
        ) : weeks.length === 1 ? (
          <p className="text-xs text-gray-400">仅1次盘点（{getWeekLabel(weeks[0])}），录入第2次后显示对比</p>
        ) : <p className="text-xs text-gray-400">暂无盘点数据</p>}
      </div>

      {/* 对比表 + 区域 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 md:gap-4">
        {/* 对比表 */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">经销商出货对比</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead><tr className="border-b border-gray-100 text-gray-500">
                <th className="text-left py-2 font-medium">经销商</th>
                <th className="text-right py-2 font-medium">盘点前</th><th className="text-right py-2 font-medium">进货</th>
                <th className="text-right py-2 font-medium">盘点时</th><th className="text-right py-2 font-medium">出货</th>
              </tr></thead>
              <tbody className="divide-y divide-gray-50">
                {mainDist && subDists.length > 0 && (
                  <tr className="bg-starbucks-50/50">
                    <td className="py-2.5 font-bold text-gray-800">{mainDist.name} <span className="text-[10px] text-starbucks-500 font-normal">合计</span></td>
                    <td className="py-2.5 text-right font-bold">{totalData.prevStock.toLocaleString()}</td>
                    <td className={`py-2.5 text-right font-bold ${totalData.restock > 0 ? 'text-blue-600' : ''}`}>{totalData.restock > 0 ? '+' + totalData.restock.toLocaleString() : '—'}</td>
                    <td className="py-2.5 text-right font-bold">{totalData.stock.toLocaleString()}</td>
                    <td className={`py-2.5 text-right font-bold ${totalData.sales > 0 ? 'text-emerald-600' : ''}`}>{totalData.sales > 0 ? totalData.sales.toLocaleString() : '—'}</td>
                  </tr>
                )}
                {(subDists.length > 0 ? subDists : distributors).map(d => {
                  const dd = calcDist(d.id);
                  if (!dd.prevStock && !dd.stock && !dd.restock) return null;
                  return (
                    <tr key={d.id} className="hover:bg-gray-50/50">
                      <td className="py-2.5 text-gray-700 pl-4">{d.name}<span className="text-[10px] text-gray-400 ml-1">{d.region}</span></td>
                      <td className="py-2.5 text-right text-gray-500">{dd.prevStock.toLocaleString()}</td>
                      <td className={`py-2.5 text-right ${dd.restock > 0 ? 'text-blue-600 font-medium' : 'text-gray-400'}`}>{dd.restock > 0 ? '+' + dd.restock.toLocaleString() : '—'}</td>
                      <td className="py-2.5 text-right font-medium text-gray-700">{dd.stock.toLocaleString()}</td>
                      <td className={`py-2.5 text-right font-bold ${dd.sales > 0 ? 'text-emerald-600' : 'text-gray-300'}`}>{dd.sales > 0 ? dd.sales.toLocaleString() : '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* 区域分布 */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2"><MapPin size={14} className="text-starbucks-500" />区域分布</h3>
          {regionList.map(r => {
            const rIds = distributors.filter(d => d.region === r).map(d => d.id);
            let stock = 0, restock = 0, sales = 0;
            for (const id of rIds) { const d = calcDist(id); stock += d.stock; restock += d.restock; sales += d.sales; }
            return (
              <div key={r} className="mb-3 last:mb-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`w-2.5 h-2.5 rounded-full ${r === '秦皇岛' ? 'bg-blue-500' : 'bg-amber-500'}`} />
                  <span className="text-xs font-bold text-gray-700">{r}</span>
                  <span className="text-[10px] text-gray-400">{rIds.length}家</span>
                </div>
                <div className="grid grid-cols-3 gap-1 text-center text-[11px] ml-4">
                  <div className="bg-gray-50 rounded-lg p-1.5"><p className="font-bold text-gray-800">{stock.toLocaleString()}</p><p className="text-gray-400">库存</p></div>
                  <div className="bg-gray-50 rounded-lg p-1.5"><p className="font-bold text-gray-800">{restock.toLocaleString()}</p><p className="text-gray-400">进货</p></div>
                  <div className="bg-gray-50 rounded-lg p-1.5"><p className="font-bold text-gray-800">{sales.toLocaleString()}</p><p className="text-gray-400">出货</p></div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 品类 + 单品 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 md:gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-2">品类出货分析</h3>
          {categoryData.length > 0 ? (
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={categoryData} layout="vertical"><CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" /><XAxis type="number" tick={{ fontSize: 10 }} /><YAxis dataKey="category" type="category" tick={{ fontSize: 10 }} width={70} /><Tooltip formatter={(v: any) => Number(v).toLocaleString() + ' 件'} /><Bar dataKey="sales" fill="#00704A" radius={[0, 3, 3, 0]} /></BarChart>
                </ResponsiveContainer>
              </div>
              <div className="w-[100px]">
                <ResponsiveContainer width="100%" height={160}>
                  <PieChart><Pie data={categoryData.filter(c => c.sales > 0)} dataKey="sales" nameKey="category" cx="50%" cy="50%" outerRadius={50} innerRadius={20}>{categoryData.filter(c => c.sales > 0).map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}</Pie><Tooltip formatter={(v: any) => Number(v).toLocaleString() + ' 件'} /></PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          ) : <div className="h-[160px] flex items-center justify-center text-gray-400 text-sm">暂无数据</div>}
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-700">单品分析</h3>
            <select value={selectedDist} onChange={e => setSelectedDist(e.target.value)} className="border border-gray-200 rounded-lg px-2 py-1 text-xs bg-white">
              {distributors.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
          <div className="max-h-[260px] overflow-y-auto">
            <table className="w-full text-xs">
              <thead><tr className="border-b border-gray-100 text-gray-400"><th className="text-left py-1">产品</th><th className="text-right py-1">盘点前</th><th className="text-right py-1">盘点时</th><th className="text-right py-1">出货</th></tr></thead>
              <tbody className="divide-y divide-gray-50">
                {prodDetail.slice(0, 15).map(p => (
                  <tr key={p.name} className="hover:bg-gray-50/50">
                    <td className="py-1 text-gray-700 truncate max-w-[140px]">{p.shortName}</td>
                    <td className="py-1 text-right text-gray-500">{p.prevStock}</td>
                    <td className="py-1 text-right font-medium text-gray-700">{p.stock}</td>
                    <td className={`py-1 text-right font-bold ${p.sales > 0 ? 'text-emerald-600' : 'text-gray-300'}`}>{p.sales > 0 ? p.sales : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* 周趋势 + 滞销 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 md:gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">周出货趋势</h3>
          {weekTrend.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={weekTrend}><CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" /><XAxis dataKey="week" tick={{ fontSize: 9 }} /><YAxis tick={{ fontSize: 10 }} /><Tooltip formatter={(v: any) => Number(v).toLocaleString() + ' 件'} /><Bar dataKey="sales" fill="#00704A" radius={[3, 3, 0, 0]} /></BarChart>
            </ResponsiveContainer>
          ) : <div className="h-[200px] flex items-center justify-center text-gray-400 text-sm">需要2次以上盘点</div>}
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2"><AlertCircle size={14} className="text-amber-500" />滞销预警</h3>
          {slowMoving.length === 0 ? <div className="text-xs text-gray-400 text-center py-8">所有产品均有动销</div> : (
            <div className="max-h-[200px] overflow-y-auto space-y-1.5">
              {slowMoving.slice(0, 6).map((sm, i) => {
                const p = getProductById(sm.productId); const d = getDistributorById(sm.distributorId);
                return <div key={i} className="flex items-center justify-between p-2 rounded-lg border border-amber-100 bg-amber-50/50"><div><p className="text-xs font-medium text-gray-800">{p?.name}</p><p className="text-[10px] text-gray-400">{d?.name}</p></div><span className="text-xs font-bold text-amber-600">{sm.weeksStale}周未动</span></div>;
              })}
            </div>
          )}
        </div>
      </div>

      {/* 重点产品: 450 + 椰椰 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {FOCUS_IDS.map(pid => {
          const p = getProductById(pid);
          const d = calcProd(pid, allIds);
          return (
            <div key={pid} className="bg-white rounded-xl border border-gray-200 p-4">
              <h3 className="text-sm font-bold text-starbucks-700 mb-3">{p?.name}</h3>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="bg-blue-50 rounded-xl p-2.5"><p className="text-lg font-bold text-blue-600">{d.restock.toLocaleString()}</p><p className="text-[10px] text-blue-400">进货</p></div>
                <div className="bg-violet-50 rounded-xl p-2.5"><p className="text-lg font-bold text-violet-600">{d.stock.toLocaleString()}</p><p className="text-[10px] text-violet-400">库存</p></div>
                <div className="bg-emerald-50 rounded-xl p-2.5"><p className="text-lg font-bold text-emerald-600">{d.sales.toLocaleString()}</p><p className="text-[10px] text-emerald-400">出货</p></div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
