import { useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  getAvailableWeeks, getWeekLabel, getCurrentWeekStart, getProductById, getDistributorById,
  getWeeklySales, getProductWeeklySales, getDistributorWeeklySales,
  getTotalStock, getAvailableMonths, getInventoryValue, getTurnoverDays,
  getSlowMoving, getCategorySales, getCategoryLabel,
} from '../data/mockData';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Legend, PieChart, Pie, Cell,
} from 'recharts';
import {
  TrendingUp, TrendingDown, Package, Coffee, AlertCircle,
  DollarSign, Clock, Target, Download, Printer,
} from 'lucide-react';

const PIE_COLORS = ['#00704A', '#2ea86e', '#f59e0b', '#8b5cf6', '#ef4444', '#3b82f6', '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#14b8a6', '#6366f1'];

type Tab = 'early' | 'late' | 'monthly';

export default function Dashboard() {
  const { state, saveTarget } = useApp();
  const { products, distributors, snapshots, targets, restocks } = state;

  const weeks = useMemo(() => getAvailableWeeks(snapshots), [snapshots]);
  const months = useMemo(() => getAvailableMonths(snapshots), [snapshots]);
  const currentMonth = months.length > 0 ? months[months.length - 1] : (weeks.length > 0 ? weeks[weeks.length - 1] : getCurrentWeekStart()).slice(0, 7);
  const hasData = weeks.length > 0;
  const hasSales = weeks.length >= 2;

  const [tab, setTab] = useState<Tab>('early');

  // Regions for comparison
  const regionList = useMemo(() => [...new Set(distributors.map(d => d.region || '其他'))].filter(Boolean), [distributors]);

  // Pick relevant date based on period tab
  const activeDate = useMemo(() => {
    if (weeks.length === 0) return getCurrentWeekStart();
    const month = currentMonth;
    const earlyDates = weeks.filter(w => w.startsWith(month) && parseInt(w.slice(8,10)) <= 10);
    const lateDates = weeks.filter(w => w.startsWith(month) && parseInt(w.slice(8,10)) > 10);
    if (tab === 'early' && earlyDates.length > 0) return earlyDates[earlyDates.length - 1];
    if (tab === 'late' && lateDates.length > 0) return lateDates[lateDates.length - 1];
    return weeks[weeks.length - 1];
  }, [tab, weeks, currentMonth]);

  const prevDate = useMemo(() => {
    const idx = weeks.indexOf(activeDate);
    return idx > 0 ? weeks[idx - 1] : null;
  }, [activeDate, weeks]);
  const [selectedDist, setSelectedDist] = useState(distributors[0]?.id ?? '');
  const [targetInput, setTargetInput] = useState('');
  const [editingTarget, setEditingTarget] = useState(false);

  // ====== 通用数据 ======
  const invValue = hasData ? getInventoryValue(snapshots, activeDate) : 0;
  const turnoverDays = hasData ? getTurnoverDays(snapshots, activeDate, restocks) : null;
  const slowMoving = useMemo(() => hasSales ? getSlowMoving(snapshots, restocks) : [], [hasSales, snapshots, restocks]);
  const categorySales = useMemo(() => hasSales ? getCategorySales(snapshots, activeDate, restocks) : [], [activeDate, hasSales]);

  // ====== 周报数据 ======
  const weeklySales = useMemo(() => hasSales ? getWeeklySales(snapshots, activeDate, restocks) : [], [activeDate, hasSales]);
  const productSales = useMemo(() => hasSales ? getProductWeeklySales(snapshots, activeDate, restocks) : [], [activeDate, hasSales]);
  const distributorSales = useMemo(() => hasSales ? getDistributorWeeklySales(snapshots, activeDate, restocks) : [], [activeDate, hasSales]);

  const totalStock = hasData ? getTotalStock(snapshots, activeDate) : 0;
  const totalSales = weeklySales.reduce((s, r) => s + Math.max(0, r.sales), 0);
  const totalSalesValue = weeklySales.reduce((s, r) => {
    const p = getProductById(r.productId);
    return s + (p ? Math.max(0, r.sales) * p.unitPrice : 0);
  }, 0);

  const prevDatelySales = useMemo(() => {
    return prevDate ? getWeeklySales(snapshots, prevDate, restocks) : [];
  }, [prevDate, restocks]);
  const prevTotalSales = prevDatelySales.reduce((s, r) => s + Math.max(0, r.sales), 0);
  const salesChange = prevTotalSales > 0 ? ((totalSales - prevTotalSales) / prevTotalSales) * 100 : 0;
  const activeProducts = productSales.filter((p) => p.sales > 0).length;
  const activeDistributors = distributorSales.filter((d) => d.sales > 0).length;

  // Last week ranking for comparison
  const prevProductRank = useMemo(() => {
    if (!prevDate) return new Map<string, number>();
    const prevSales = getProductWeeklySales(snapshots, prevDate, restocks);
    const ranked = [...prevSales].sort((a, b) => b.sales - a.sales);
    return new Map(ranked.map((item, i) => [item.productId, i + 1]));
  }, [prevDate, restocks]);

  const productRanking = useMemo(() => [...productSales].sort((a, b) => b.sales - a.sales).map((ps, i) => {
    const p = getProductById(ps.productId);
    const prevRank = prevProductRank.get(ps.productId);
    const rankChange = prevRank ? prevRank - (i + 1) : 0; // positive = up, negative = down
    return {
      name: p?.name ?? ps.productId,
      shortName: (p?.name ?? '').length > 12 ? p!.name.slice(0, 11) + '…' : p?.name,
      sales: ps.sales,
      rank: i + 1,
      rankChange,
    };
  }), [productSales, prevProductRank]);

  // Distributor health analysis
  const distHealth = useMemo(() => {
    const prevDate = weeks.length > 1 ? weeks[weeks.length - 2] : null;
    const prevSales = prevDate ? getDistributorWeeklySales(snapshots, prevDate, restocks) : [];
    const prev2Week = weeks.length > 2 ? weeks[weeks.length - 3] : null;
    const prev2Sales = prev2Week ? getDistributorWeeklySales(snapshots, prev2Week, restocks) : [];

    return distributors.map((d) => {
      const cur = distributorSales.find((s) => s.distributorId === d.id);
      const curSales = cur ? Math.max(0, cur.sales) : 0;
      const prev = prevSales.find((s) => s.distributorId === d.id);
      const prevS = prev ? Math.max(0, prev.sales) : 0;
      const prev2 = prev2Sales.find((s) => s.distributorId === d.id);
      const prev2S = prev2 ? Math.max(0, prev2.sales) : 0;

      const dStock = hasData
        ? snapshots.filter((s) => s.weekStart === activeDate && s.distributorId === d.id).reduce((a, s) => a + s.quantity, 0)
        : 0;

      // Change %
      const changePct = prevS > 0 ? ((curSales - prevS) / prevS) * 100 : (curSales > 0 ? 100 : 0);
      // Stock-to-sales ratio (high = slow moving)
      const stockRatio = curSales > 0 ? dStock / curSales : (dStock > 0 ? 99 : 0);

      // Consecutive decline weeks
      let declineWeeks = 0;
      if (curSales < prevS && prevS > 0) {
        declineWeeks = 1;
        if (prevS < prev2S && prev2S > 0) declineWeeks = 2;
        // Check further back
        for (let i = weeks.length - 4; i >= 0 && declineWeeks >= 2; i--) {
          const ws = getDistributorWeeklySales(snapshots, weeks[i], restocks);
          const earlier = ws.find((s) => s.distributorId === d.id);
          const earlierS = earlier ? Math.max(0, earlier.sales) : 0;
          if (earlierS > 0) {
            const nextWeek = getDistributorWeeklySales(snapshots, weeks[i + 1], restocks);
            const nextS = nextWeek.find((s) => s.distributorId === d.id);
            if (nextS && Math.max(0, nextS.sales) < earlierS) declineWeeks++;
            else break;
          } else break;
        }
      }

      // Health status
      let status: 'green' | 'yellow' | 'red' = 'green';
      let problem = '';
      if (declineWeeks >= 2) { status = 'red'; problem = `连续${declineWeeks}周下滑`; }
      else if (stockRatio > 8) { status = 'red'; problem = '库存积压严重'; }
      else if (curSales === 0 && dStock > 50) { status = 'red'; problem = '本周未出货'; }
      else if (declineWeeks === 1) { status = 'yellow'; problem = '本期销量下滑'; }
      else if (stockRatio > 4) { status = 'yellow'; problem = '库存偏高'; }
      else if (curSales === 0) { status = 'yellow'; problem = '本周无动销'; }

      return {
        distributor: d,
        curSales,
        prevS,
        changePct,
        dStock,
        stockRatio,
        declineWeeks,
        status,
        problem,
        share: totalSales > 0 ? (curSales / totalSales) * 100 : 0,
      };
    }).sort((a, b) => b.curSales - a.curSales);
  }, [distributors, distributorSales, snapshots, activeDate, weeks, restocks, hasData, totalSales]);

  const distDrillDown = useMemo(() => {
    if (!hasSales) return { products: [], trend: [] };
    const ws = getWeeklySales(snapshots, activeDate, restocks);
    const detail = products.map((p) => {
      const row = ws.find((r) => r.productId === p.id && r.distributorId === selectedDist);
      return { name: p.name, shortName: p.name.length > 14 ? p.name.slice(0, 13) + '…' : p.name, sales: row ? Math.max(0, row.sales) : 0, prevQty: row?.prevQty ?? 0, currQty: row?.currQty ?? 0 };
    }).sort((a, b) => b.sales - a.sales);
    const trend = weeks.slice(1).map((w) => {
      const ws = getWeeklySales(snapshots, w, restocks);
      return { week: getWeekLabel(w), sales: ws.filter((r) => r.distributorId === selectedDist).reduce((sum, r) => sum + Math.max(0, r.sales), 0) };
    });
    return { products: detail, trend };
  }, [selectedDist, activeDate, weeks, hasSales, products]);

  // ====== 月报数据 ======
  const monthlyData = useMemo(() => months.map((m) => {
    const mWeeks = weeks.filter((w) => w.startsWith(m));
    let mSales = 0; let mValue = 0;
    const productMap: Record<string, number> = {};
    const distMap: Record<string, number> = {};
    const catMap: Record<string, number> = {};
    for (const w of mWeeks) {
      const ws = getWeeklySales(snapshots, w, restocks);
      for (const r of ws) {
        const s = Math.max(0, r.sales);
        mSales += s;
        const p = getProductById(r.productId);
        if (p) {
          mValue += s * p.unitPrice;
          catMap[p.category] = (catMap[p.category] || 0) + s;
        }
        productMap[r.productId] = (productMap[r.productId] || 0) + s;
        distMap[r.distributorId] = (distMap[r.distributorId] || 0) + s;
      }
    }
    const lastStock = mWeeks.length > 0 ? getTotalStock(snapshots, mWeeks[mWeeks.length - 1]) : 0;
    const lastValue = mWeeks.length > 0 ? getInventoryValue(snapshots, mWeeks[mWeeks.length - 1]) : 0;
    const days = mWeeks.length * 7;
    const dailyAvg = days > 0 ? mSales / days : 0;
    const turnover = dailyAvg > 0 && lastStock > 0 ? Math.round((lastStock / dailyAvg) * 10) / 10 : null;
    return { month: m, label: m.replace('-', '年') + '月', sales: mSales, value: Math.round(mValue * 100) / 100, stock: lastStock, stockValue: Math.round(lastValue * 100) / 100, turnover, productMap, distMap, catMap };
  }), [months, weeks]);

  const curMonth = monthlyData.find((m) => m.month === currentMonth);
  const prevMonthData = months.length > 1 ? monthlyData.find((m) => m.month === months[months.length - 2]) : null;
  const mSales = curMonth?.sales ?? 0;
  const mStock = curMonth?.stock ?? 0;
  const mValue = curMonth?.stockValue ?? 0;
  const mTurnover = curMonth?.turnover ?? null;
  const mSalesChange = prevMonthData?.sales ? ((mSales - prevMonthData.sales) / prevMonthData.sales) * 100 : 0;

  const curTarget = targets.find((t) => t.month === currentMonth);
  const targetRate = curTarget && curTarget.salesTarget > 0 ? Math.round((mSales / curTarget.salesTarget) * 100) : null;

  const mProductRanking = useMemo(() => {
    if (!curMonth) return [];
    return Object.entries(curMonth.productMap).sort((a, b) => b[1] - a[1]).map(([pid, s]) => {
      const p = getProductById(pid);
      return { name: p?.name ?? pid, shortName: (p?.name ?? '').length > 12 ? p!.name.slice(0, 11) + '…' : p?.name, sales: s };
    });
  }, [curMonth]);

  const mDistChart = useMemo(() => distributors.map((d) => {
    const lastWeek = weeks.filter((w) => w.startsWith(currentMonth)).reverse()[0];
    const dStock = lastWeek ? snapshots.filter((s) => s.weekStart === lastWeek && s.distributorId === d.id).reduce((a, s) => a + s.quantity, 0) : 0;
    return { name: d.name, sales: curMonth?.distMap[d.id] ?? 0, stock: dStock };
  }), [distributors, curMonth, currentMonth, weeks, snapshots]);

  const mCatPie = useMemo(() => {
    if (!curMonth) return [];
    return Object.entries(curMonth.catMap).filter(([, v]) => v > 0).map(([cat, v]) => ({ name: getCategoryLabel(cat), value: v }));
  }, [curMonth]);

  const monthlyTrend = useMemo(() => monthlyData.map((m) => ({
    month: m.label, sales: m.sales, stock: m.stock, value: m.stockValue,
  })), [monthlyData]);

  // ====== CSV Export ======
  const exportCSV = () => {
    const ws = getWeeklySales(snapshots, activeDate, restocks);
    const rows = [['产品', 'SKU', '经销商', '上周库存', '本周库存', '销量', '单价', '销售额']];
    for (const r of ws) {
      const p = getProductById(r.productId);
      const d = getDistributorById(r.distributorId);
      rows.push([p?.name ?? '', p?.sku ?? '', d?.name ?? '', String(r.prevQty), String(r.currQty), String(r.sales), String(p?.unitPrice ?? ''), String(Math.round(Math.max(0, r.sales) * (p?.unitPrice ?? 0) * 100) / 100)]);
    }
    const csv = rows.map((r) => r.map((c) => `"${c}"`).join(',')).join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `周报_${activeDate}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  // ====== Print Report ======
  const printReport = () => {
    window.print();
  };

  // ====== Target save ======
  const handleSetTarget = () => {
    const val = parseInt(targetInput, 10);
    if (!isNaN(val) && val > 0) {
      saveTarget({ month: currentMonth, salesTarget: val });
      setTargetInput('');
      setEditingTarget(false);
    }
  };

  // ====== Shared KPI card ======
  const KpiCard = ({ label, value, sub, icon: Icon, color, bg }: { label: string; value: string; sub: string; icon: React.ComponentType<{ size?: number; className?: string }>; color: string; bg: string }) => (
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
          <p className="text-[11px] md:text-xs text-gray-400">最新盘点: {getWeekLabel(activeDate)} · {weeks.length}周 · {months.length}月</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={exportCSV} className="flex items-center gap-1 px-2 py-1.5 text-[11px] md:text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 whitespace-nowrap"><Download size={13} /><span className="hidden sm:inline">导出</span></button>
          <button onClick={printReport} className="flex items-center gap-1 px-2 py-1.5 text-[11px] md:text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 whitespace-nowrap"><Printer size={13} /><span className="hidden sm:inline">打印</span></button>
          <div className="flex bg-gray-100 rounded-lg p-0.5">
            {([
              ['early', '上旬'],
              ['late', '下旬'],
              ['monthly', '月报'],
            ] as [Tab, string][]).map(([t, label]) => (
              <button key={t} onClick={() => setTab(t)} className={`px-2.5 md:px-3 py-1.5 rounded-md text-xs md:text-sm font-medium transition-all ${tab === t ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>{label}</button>
            ))}
          </div>
        </div>
      </div>

      {(tab === 'early' || tab === 'late') ? (
        <>
          {/* 周报 KPI: 6 cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2 md:gap-3">
            <KpiCard label="本期销量" value={totalSales.toLocaleString() + ' 件'} sub={`¥${Math.round(totalSalesValue).toLocaleString()}`} icon={TrendingUp} color="text-emerald-500" bg="bg-emerald-50" />
            <KpiCard label="总库存" value={totalStock.toLocaleString() + ' 件'} sub={getWeekLabel(activeDate)} icon={Package} color="text-violet-500" bg="bg-violet-50" />
            <KpiCard label="库存价值" value={'¥' + (invValue / 10000).toFixed(1) + '万'} sub={getWeekLabel(activeDate)} icon={DollarSign} color="text-blue-500" bg="bg-blue-50" />
            <KpiCard label="周转天数" value={turnoverDays !== null ? turnoverDays + ' 天' : '—'} sub="库存/日均销量" icon={Clock} color="text-cyan-500" bg="bg-cyan-50" />
            <KpiCard label="销量环比" value={(salesChange >= 0 ? '+' : '') + salesChange.toFixed(1) + '%'} sub="较上周" icon={salesChange >= 0 ? TrendingUp : TrendingDown} color={salesChange >= 0 ? 'text-emerald-500' : 'text-red-500'} bg={salesChange >= 0 ? 'bg-emerald-50' : 'bg-red-50'} />
            <KpiCard label="动销率" value={`${activeProducts}/${products.length}`} sub={`${activeDistributors}/${distributors.length} 客户`} icon={Coffee} color="text-orange-500" bg="bg-orange-50" />
          </div>

          {/* Row 1: 产品排行 + 品类分析 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 md:gap-4">
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">产品销售排行 Top 10</h3>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={productRanking.slice(0, 6)} layout="vertical" margin={{ left: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis type="number" tick={{ fontSize: 10 }} />
                  <YAxis dataKey="shortName" type="category" tick={(props: any) => {
                    const { x, y, payload } = props;
                    const item = productRanking.find((r) => r.shortName === payload.value);
                    const rc = item?.rankChange ?? 0;
                    const arrow = rc > 0 ? '↑' : rc < 0 ? '↓' : '─';
                    const color = rc > 0 ? '#059669' : rc < 0 ? '#ef4444' : '#9ca3af';
                    return (
                      <text x={x} y={y} dy={3} textAnchor="end" fill="#374151" fontSize={10}>
                        <tspan fill={color} fontWeight="bold">{arrow}</tspan>
                        <tspan> {payload.value}</tspan>
                      </text>
                    );
                  }} width={110} />
                  <Tooltip formatter={(v, _n, props: any) => {
                    const item = props.payload;
                    const rc = item.rankChange ?? 0;
                    const changeText = rc > 0 ? `↑${rc}` : rc < 0 ? `↓${Math.abs(rc)}` : '─';
                    return [[Number(v).toLocaleString() + ' 件', '销量'], [`第${item.rank}名 ${changeText}`, '排名']];
                  }} labelFormatter={(_, p) => p?.[0]?.payload?.name ?? ''} />
                  <Bar dataKey="sales" fill="#00704A" radius={[0, 3, 3, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            {/* 经销商健康度 - 按区域分 */}
            <div className="space-y-3">
              {regionList.map(r => {
                const rDists = distHealth.filter(dh => distributors.find(d => d.id === dh.distributor.id)?.region === r);
                if (rDists.length === 0) return null;
                return (
                  <div key={r} className="bg-white rounded-xl border border-gray-200 p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-semibold text-gray-700">{r} · 经销商健康度</h3>
                      <div className="flex items-center gap-2 text-[10px]">
                        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-400" />{rDists.filter(d => d.status === 'green').length}</span>
                        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400" />{rDists.filter(d => d.status === 'yellow').length}</span>
                        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-400" />{rDists.filter(d => d.status === 'red').length}</span>
                      </div>
                    </div>
                    <div className="space-y-2">
                      {rDists.map((dh) => (
                        <div key={dh.distributor.id} className={`flex items-center gap-3 p-2.5 rounded-lg border ${dh.status === 'red' ? 'border-red-200 bg-red-50/50' : dh.status === 'yellow' ? 'border-amber-200 bg-amber-50/50' : 'border-gray-100 bg-gray-50/30'}`}>
                          <div className="flex items-center gap-2 min-w-[80px]">
                            <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${dh.status === 'red' ? 'bg-red-400' : dh.status === 'yellow' ? 'bg-amber-400' : 'bg-emerald-400'}`} />
                            <div><p className="text-xs font-semibold text-gray-800">{dh.distributor.name}</p></div>
                          </div>
                          <div className="flex-1 grid grid-cols-4 gap-2 text-center">
                            <div><p className="text-[10px] text-gray-400">出货</p><p className="text-xs font-bold text-gray-800">{dh.curSales}</p></div>
                            <div><p className="text-[10px] text-gray-400">环比</p><p className={`text-xs font-bold ${dh.changePct >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>{dh.changePct >= 0 ? '+' : ''}{dh.changePct.toFixed(0)}%</p></div>
                            <div><p className="text-[10px] text-gray-400">库存</p><p className="text-xs font-bold text-gray-700">{dh.dStock}</p></div>
                            <div><p className="text-[10px] text-gray-400">存销比</p><p className={`text-xs font-bold ${dh.stockRatio > 4 ? 'text-amber-600' : 'text-gray-600'}`}>{dh.stockRatio >= 99 ? '∞' : dh.stockRatio.toFixed(1)}x</p></div>
                          </div>
                          {dh.problem && <span className={`flex-shrink-0 px-2 py-0.5 rounded-full text-[10px] font-medium ${dh.status === 'red' ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600'}`}>{dh.problem}</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Row 2: 品类分析 + 单客户分析 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 md:gap-4">
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">品类销售分析</h3>
              {categorySales.length > 0 ? (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={categorySales} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis type="number" tick={{ fontSize: 10 }} />
                    <YAxis dataKey="category" type="category" tick={{ fontSize: 10 }} width={100} />
                    <Tooltip formatter={(v, n) => [Number(v).toLocaleString() + (n === 'value' ? ' 元' : ' 件'), n === 'value' ? '销售额' : '销量']} />
                    <Bar dataKey="sales" fill="#00704A" radius={[0, 3, 3, 0]} name="销量" />
                  </BarChart>
                </ResponsiveContainer>
              ) : <div className="flex items-center justify-center h-[260px] text-gray-400 text-sm">暂无数据</div>}
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-gray-700">单客户分析</h3>
                <select value={selectedDist} onChange={(e) => setSelectedDist(e.target.value)} className="border border-gray-200 rounded-lg px-2 py-1 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-starbucks-500/20">
                  {distributors.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
              <div className="max-h-[260px] overflow-y-auto scrollbar-thin">
                <table className="w-full text-xs">
                  <thead><tr className="border-b border-gray-100 text-gray-400"><th className="text-left py-1 font-medium">产品</th><th className="text-right py-1 font-medium">上周</th><th className="text-right py-1 font-medium">本周</th><th className="text-right py-1 font-medium">销量</th></tr></thead>
                  <tbody className="divide-y divide-gray-50">
                    {distDrillDown.products.filter((p) => p.sales > 0 || p.currQty > 0).slice(0, 15).map((p) => (
                      <tr key={p.name} className="hover:bg-gray-50/50">
                        <td className="py-1 text-gray-700 truncate max-w-[140px]">{p.name}</td>
                        <td className="py-1 text-right text-gray-500">{p.prevQty}</td>
                        <td className="py-1 text-right text-gray-500">{p.currQty}</td>
                        <td className={`py-1 text-right font-bold ${p.sales > 0 ? 'text-emerald-600' : 'text-gray-300'}`}>{p.sales > 0 ? p.sales : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Row 3: ABC分类 + 库存价值 + 周转排行 + 动销率 */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* ABC 分类 */}
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-2">ABC 分类</h3>
              {(() => {
                const sorted = [...productSales].sort((a,b) => b.sales - a.sales);
                const total = sorted.reduce((s,x) => s + x.sales, 0);
                let cum = 0;
                const abc = { A: 0, B: 0, C: 0 };
                sorted.forEach(x => { cum += x.sales; const pct = cum / total; if (pct <= 0.7) abc.A++; else if (pct <= 0.9) abc.B++; else abc.C++; });
                return (
                  <div className="space-y-2">
                    {[{k:'A',v:abc.A,c:'bg-emerald-500',label:'高销量'},{k:'B',v:abc.B,c:'bg-amber-500',label:'中等'},{k:'C',v:abc.C,c:'bg-red-400',label:'滞销'}].map(x => (
                      <div key={x.k} className="flex items-center gap-2 text-xs">
                        <span className="font-bold text-gray-700 w-6">{x.k}</span>
                        <div className="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${x.c}`} style={{width:`${(x.v/Math.max(products.length,1))*100}%`}} />
                        </div>
                        <span className="text-gray-500 w-16 text-right">{x.v} SKU ({x.label})</span>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>

            {/* 库存价值分布 */}
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-2">库存价值</h3>
              {(() => {
                const catValue = categorySales.map(c => {
                  const stock = snapshots.filter(s => s.weekStart === activeDate).filter(s => { const p = getProductById(s.productId); return p?.category === c.category; }).reduce((a,s) => { const p = getProductById(s.productId); return a + s.quantity * (p?.unitPrice||0); }, 0);
                  return { name: c.category.length > 6 ? c.category.slice(0,5)+'…' : c.category, value: Math.round(stock) };
                }).filter(x => x.value > 0).sort((a,b) => b.value - a.value);
                const maxV = Math.max(...catValue.map(x => x.value), 1);
                return (
                  <div className="space-y-1.5">
                    {catValue.slice(0, 6).map(x => (
                      <div key={x.name} className="flex items-center gap-2 text-xs">
                        <span className="text-gray-600 w-14 truncate">{x.name}</span>
                        <div className="flex-1 h-2.5 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full bg-violet-400 rounded-full" style={{width:`${(x.value/maxV)*100}%`}} />
                        </div>
                        <span className="text-gray-500 text-[10px]">¥{(x.value/10000).toFixed(1)}万</span>
                      </div>
                    ))}
                    <div className="pt-2 border-t border-gray-100 text-xs font-bold text-gray-700">
                      总价值 ¥{(catValue.reduce((s,x)=>s+x.value,0)/10000).toFixed(1)}万
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* 周转天数排行 */}
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-2">周转天数 Top 5</h3>
              {(() => {
                const turnData = products.map(p => {
                  const curS = snapshots.filter(s => s.weekStart === activeDate && s.productId === p.id).reduce((a,s) => a + s.quantity, 0);
                  const sales = productSales.find(x => x.productId === p.id)?.sales || 0;
                  const days = sales > 0 ? Math.round((curS / (sales / 7)) * 10) / 10 : curS > 0 ? 99 : 0;
                  return { name: p.name.length > 10 ? p.name.slice(0,9)+'…' : p.name, days, stock: curS };
                }).sort((a,b) => b.days - a.days).slice(0, 5);
                return turnData.map((x, i) => (
                  <div key={i} className="flex items-center justify-between text-xs py-1 border-b border-gray-50 last:border-0">
                    <span className="text-gray-600 truncate flex-1">{x.name}</span>
                    <span className={`font-bold ml-2 ${x.days > 30 ? 'text-red-500' : x.days > 14 ? 'text-amber-600' : 'text-emerald-600'}`}>{x.days}天</span>
                  </div>
                ));
              })()}
            </div>

            {/* 动销率趋势 */}
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-2">动销率趋势</h3>
              {(() => {
                const mData = weeks.slice(1).map(w => {
                  const ws = getWeeklySales(snapshots, w, restocks);
                  const active = ws.filter(r => r.sales > 0).length;
                  const total = ws.length || 1;
                  return { w: w.slice(5), rate: Math.round((active / total) * 100) };
                });
                if (mData.length === 0) return <div className="text-xs text-gray-300 text-center py-6">数据不足</div>;
                return (
                  <div className="space-y-1">
                    {mData.slice(-6).map((x, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs">
                        <span className="text-gray-400 w-8">{x.w}</span>
                        <div className="flex-1 h-2.5 bg-gray-100 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${x.rate >= 50 ? 'bg-emerald-500' : x.rate >= 30 ? 'bg-amber-500' : 'bg-red-400'}`} style={{width:`${x.rate}%`}} />
                        </div>
                        <span className="font-bold text-gray-600 w-10 text-right">{x.rate}%</span>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
          </div>

          {/* Row 4: 安全库存预警 + 滞销预警 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 md:gap-4">
            {/* 安全库存预警 */}
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <AlertCircle size={14} className="text-red-400" />安全库存预警
              </h3>
              {(() => {
                const alertItems = products.map(p => {
                  const stock = snapshots.filter(s => s.weekStart === activeDate && s.productId === p.id).reduce((a,s) => a + s.quantity, 0);
                  const safeLine = 30; // default safety stock line
                  if (stock < safeLine) return { name: p.name, stock, safeLine };
                  return null;
                }).filter(Boolean) as { name: string; stock: number; safeLine: number }[];
                if (alertItems.length === 0) return <div className="text-xs text-gray-300 text-center py-4">所有产品库存充足</div>;
                return alertItems.map((x, i) => (
                  <div key={i} className="flex items-center justify-between text-xs py-1.5 border-b border-gray-50 last:border-0">
                    <span className="text-gray-700 truncate flex-1">{x.name}</span>
                    <span className="text-red-500 font-bold">{x.stock}</span>
                    <span className="text-gray-400 ml-1">/ {x.safeLine}件</span>
                  </div>
                ));
              })()}
            </div>

            {/* 周趋势 */}
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <AlertCircle size={14} className="text-amber-500" />滞销预警
              </h3>
              {slowMoving.length > 0 ? (
                <div className="max-h-[240px] overflow-y-auto scrollbar-thin space-y-1.5">
                  {slowMoving.map((sm, i) => {
                    const p = getProductById(sm.productId);
                    const d = getDistributorById(sm.distributorId);
                    return (
                      <div key={i} className="flex items-center justify-between p-2 rounded-lg border border-amber-100 bg-amber-50/50">
                        <div>
                          <p className="text-xs font-medium text-gray-800">{p?.name}</p>
                          <p className="text-[10px] text-gray-400">{d?.name}</p>
                        </div>
                        <span className="text-xs font-bold text-amber-600">{sm.weeksStale} 周未动销</span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex items-center justify-center h-[240px] text-gray-400 text-sm">所有产品均有动销</div>
              )}
            </div>
          </div>

          {/* Row 4: 椰椰拿铁 & P450 黑咖啡 重点产品分析 */}
          <FocusProducts snapshots={snapshots} restocks={restocks} distributors={distributors} activeDate={activeDate} weeks={weeks} />

          {/* Row 5: 经销商排名 */}
          <DistRanking snapshots={snapshots} restocks={restocks} activeDate={activeDate} weeks={weeks} products={products} />
        </>
      ) : (
        <>
          {/* 月报 KPI */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2 md:gap-3">
            <KpiCard label="本月销量" value={mSales.toLocaleString() + ' 件'} sub={(curMonth?.label ?? '')} icon={TrendingUp} color="text-emerald-500" bg="bg-emerald-50" />
            <KpiCard label="月末库存" value={mStock.toLocaleString() + ' 件'} sub={'¥' + (mValue / 10000).toFixed(1) + '万'} icon={Package} color="text-violet-500" bg="bg-violet-50" />
            <KpiCard label="库存价值" value={'¥' + (mValue / 10000).toFixed(1) + '万'} sub={(curMonth?.label ?? '')} icon={DollarSign} color="text-blue-500" bg="bg-blue-50" />
            <KpiCard label="周转天数" value={mTurnover !== null ? mTurnover + ' 天' : '—'} sub="库存/日均销量" icon={Clock} color="text-cyan-500" bg="bg-cyan-50" />
            <KpiCard label="销量环比" value={(mSalesChange >= 0 ? '+' : '') + mSalesChange.toFixed(1) + '%'} sub="较上月" icon={mSalesChange >= 0 ? TrendingUp : TrendingDown} color={mSalesChange >= 0 ? 'text-emerald-500' : 'text-red-500'} bg={mSalesChange >= 0 ? 'bg-emerald-50' : 'bg-red-50'} />
            <KpiCard label="目标达成率" value={targetRate !== null ? targetRate + '%' : '未设目标'} sub={curTarget ? `目标 ${curTarget.salesTarget} 件` : '点击设置'} icon={Target} color={targetRate !== null && targetRate >= 100 ? 'text-emerald-500' : 'text-amber-500'} bg={targetRate !== null && targetRate >= 100 ? 'bg-emerald-50' : 'bg-amber-50'} />
          </div>

          {/* 目标设置行 */}
          <div className="bg-white rounded-xl border border-gray-200 p-3 flex items-center gap-3">
            <Target size={16} className="text-gray-400" />
            <span className="text-sm text-gray-600">月度销售目标:</span>
            {!editingTarget && (
              <>
                <span className="text-sm font-bold text-gray-800">{curTarget ? `${curTarget.salesTarget.toLocaleString()} 件` : '未设置'}</span>
                <button onClick={() => { setEditingTarget(true); setTargetInput(curTarget ? String(curTarget.salesTarget) : ''); }} className="text-xs text-starbucks-600 hover:underline">修改</button>
              </>
            )}
            {editingTarget && (
              <>
                <input type="number" value={targetInput} onChange={(e) => setTargetInput(e.target.value)} placeholder="输入目标件数" className="border border-gray-200 rounded-lg px-2 py-1 text-sm w-32 focus:outline-none focus:ring-2 focus:ring-starbucks-500/20" onKeyDown={(e) => e.key === 'Enter' && handleSetTarget()} />
                <button onClick={handleSetTarget} className="px-3 py-1 bg-starbucks-500 text-white rounded-lg text-xs font-medium hover:bg-starbucks-600">保存</button>
                <button onClick={() => setEditingTarget(false)} className="text-xs text-gray-400 hover:text-gray-600">取消</button>
              </>
            )}
            {targetRate !== null && (
              <div className="flex-1 mx-4">
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all ${targetRate >= 100 ? 'bg-emerald-500' : targetRate >= 70 ? 'bg-amber-500' : 'bg-red-400'}`} style={{ width: `${Math.min(targetRate, 100)}%` }} />
                </div>
              </div>
            )}
          </div>

          {/* 月报 Row 1: 产品排行 + 品类饼图 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 md:gap-4">
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">月产品销售排行 Top 10</h3>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={mProductRanking.slice(0, 10)} layout="vertical" margin={{ left: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis type="number" tick={{ fontSize: 10 }} />
                  <YAxis dataKey="shortName" type="category" tick={{ fontSize: 10 }} width={100} />
                  <Tooltip formatter={(v) => [Number(v).toLocaleString() + ' 件', '销量']} labelFormatter={(_, p) => p?.[0]?.payload?.name ?? ''} />
                  <Bar dataKey="sales" fill="#00704A" radius={[0, 3, 3, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">品类销售结构</h3>
              {mCatPie.length > 0 ? (
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie data={mCatPie} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={85} label={(props: any) => `${props.name ?? ''} ${((props.percent ?? 0) * 100).toFixed(0)}%`}>
                      {mCatPie.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v) => Number(v).toLocaleString() + ' 件'} />
                  </PieChart>
                </ResponsiveContainer>
              ) : <div className="flex items-center justify-center h-[280px] text-gray-400 text-sm">暂无数据</div>}
            </div>
          </div>

          {/* 月报 Row 2: 经销商对比 + 月度趋势 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 md:gap-4">
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">月经销商对比</h3>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={mDistChart}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip formatter={(v) => Number(v).toLocaleString() + ' 件'} />
                  <Legend wrapperStyle={{ fontSize: 10 }} />
                  <Bar dataKey="sales" fill="#00704A" name="月销量" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="stock" fill="#e2e8f0" name="月末库存" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">月度趋势</h3>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={monthlyTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip formatter={(v) => Number(v).toLocaleString() + ' 件'} />
                  <Legend wrapperStyle={{ fontSize: 10 }} />
                  <Bar dataKey="sales" fill="#00704A" name="月销量" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="stock" fill="#e2e8f0" name="月末库存" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* 月报 Row 3: 月度明细表 */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">月度对比明细</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-100 text-gray-500"><th className="text-left py-2 font-medium">月份</th><th className="text-right py-2 font-medium">销量</th><th className="text-right py-2 font-medium">销售额</th><th className="text-right py-2 font-medium">月末库存</th><th className="text-right py-2 font-medium">库存价值</th><th className="text-right py-2 font-medium">周转天数</th><th className="text-right py-2 font-medium">环比</th></tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {monthlyData.map((m, i) => {
                    const prev = i > 0 ? monthlyData[i - 1] : null;
                    const chg = prev?.sales ? ((m.sales - prev.sales) / prev.sales) * 100 : null;
                    return (
                      <tr key={m.month} className="hover:bg-gray-50/50">
                        <td className="py-2.5 text-gray-800 font-medium">{m.label}</td>
                        <td className="py-2.5 text-right text-gray-700">{m.sales.toLocaleString()} 件</td>
                        <td className="py-2.5 text-right text-gray-700">¥{m.value.toLocaleString()}</td>
                        <td className="py-2.5 text-right text-gray-500">{m.stock.toLocaleString()} 件</td>
                        <td className="py-2.5 text-right text-gray-500">¥{(m.stockValue / 10000).toFixed(2)}万</td>
                        <td className="py-2.5 text-right text-gray-500">{m.turnover !== null ? m.turnover + '天' : '—'}</td>
                        <td className="py-2.5 text-right">{chg === null ? <span className="text-gray-300">—</span> : <span className={`font-bold ${chg >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>{chg >= 0 ? '+' : ''}{chg.toFixed(1)}%</span>}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* 月报导出 */}
          <div className="flex justify-end mt-3">
            <button onClick={() => {
              const rows = [['月份', '销量(件)', '月末库存(件)', '库存价值(万元)']];
              monthlyData.forEach((m: any) => rows.push([m.label, String(m.sales), String(m.stock), String((m.stockValue / 10000).toFixed(2))]));
              const csv = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n');
              const b = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
              const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = `月报_${currentMonth}.csv`; a.click();
            }} className="flex items-center gap-1 px-3 py-2 text-xs font-medium text-gray-500 bg-white border border-gray-200 rounded-lg hover:bg-gray-50">
              <Download size={13} />导出月报 CSV
            </button>
          </div>
        </>
      )}

      {/* Print-only report styles */}
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .p-6 { visibility: visible; position: absolute; left: 0; top: 0; width: 100%; }
          .p-6 * { visibility: visible; }
          button, select, nav, aside { display: none !important; }
          .grid { break-inside: avoid; }
        }
      `}</style>
    </div>
  );
}

/* ==================== 经销商排名 ==================== */
function DistRanking({ snapshots, restocks, activeDate, weeks, products }: any) {
  const dists = useMemo(() => {
    try { const r = localStorage.getItem('sb_distributors_v2'); if (r) return JSON.parse(r); } catch {}
    return [
      { id: 'd1', name: '山海关梁波' }, { id: 'd2', name: '杨子' },
      { id: 'd3', name: '速恩' }, { id: 'd4', name: '北戴河王总' },
    ];
  }, []);

  const ranking = useMemo(() => {
    if (weeks.length < 2) return [];
    const prevDate = weeks[weeks.length - 2];
    return dists.map((d: any) => {
      const ws = getWeeklySales(snapshots, activeDate, restocks);
      const sales = ws.filter((r: any) => r.distributorId === d.id).reduce((a: number, r: any) => a + Math.max(0, r.sales), 0);
      const stock = snapshots.filter((s: any) => s.weekStart === activeDate && s.distributorId === d.id).reduce((a: number, s: any) => a + s.quantity, 0);
      const prevWs = getWeeklySales(snapshots, prevDate, restocks);
      const prevSales = prevWs.filter((r: any) => r.distributorId === d.id).reduce((a: number, r: any) => a + Math.max(0, r.sales), 0);
      const value = ws.filter((r: any) => r.distributorId === d.id).reduce((a: number, r: any) => {
        const p = products.find((x: any) => x.id === r.productId);
        return a + Math.max(0, r.sales) * (p?.unitPrice ?? 0);
      }, 0);
      return { ...d, sales, stock, value, prevSales, change: prevSales > 0 ? ((sales - prevSales) / prevSales) * 100 : 0 };
    }).sort((a: any, b: any) => b.sales - a.sales);
  }, [snapshots, restocks, activeDate, weeks, dists]);

  if (ranking.length === 0) return null;
  const maxSales = Math.max(...ranking.map((r: any) => r.sales), 1);

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <h3 className="text-sm font-semibold text-gray-700 mb-4">经销商出货排名</h3>
      <div className="space-y-3">
        {ranking.map((d: any, i: number) => (
          <div key={d.id} className="flex items-center gap-4">
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0 ${
              i === 0 ? 'bg-amber-100 text-amber-700' : i === 1 ? 'bg-gray-100 text-gray-500' : i === 2 ? 'bg-orange-50 text-orange-600' : 'bg-gray-50 text-gray-400'
            }`}>{i + 1}</div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-800">{d.name}</span>
                  <span className={`text-[10px] font-bold ${d.change > 0 ? 'text-emerald-600' : d.change < 0 ? 'text-red-500' : 'text-gray-300'}`}>
                    {d.change > 0 ? '↑' : d.change < 0 ? '↓' : '─'} {d.change !== 0 ? Math.abs(d.change).toFixed(0) + '%' : ''}
                  </span>
                </div>
                <span className="text-xs text-gray-500">{d.sales} 件 · ¥{Math.round(d.value).toLocaleString()}</span>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div className={`h-full rounded-full transition-all ${
                  i === 0 ? 'bg-amber-400' : i === 1 ? 'bg-gray-400' : i === 2 ? 'bg-orange-400' : 'bg-starbucks-400'
                }`} style={{ width: `${(d.sales / maxSales) * 100}%` }} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ==================== 重点产品分析 ==================== */
function FocusProducts({ snapshots, restocks, distributors, activeDate, weeks }: any) {

  const products = [
    { id: 'p11', name: 'P450 黑咖啡', color: '#3b82f6', gradient: 'from-blue-500 to-indigo-500', bg: 'bg-blue-50', text: 'text-blue-700', icon: '☕' },
    { id: 'p20', name: 'P270 椰椰拿铁', color: '#10b981', gradient: 'from-emerald-500 to-teal-500', bg: 'bg-emerald-50', text: 'text-emerald-700', icon: '🥥' },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
      {products.map(prod => {
        const trend = weeks.slice(1).map((w: string) => {
          const prevSnaps = snapshots.filter((s: any) => s.weekStart === weeks[weeks.indexOf(w) - 1] && s.productId === prod.id);
          const currSnaps = snapshots.filter((s: any) => s.weekStart === w && s.productId === prod.id);
          const prevTotal = prevSnaps.reduce((a: number, s: any) => a + s.quantity, 0);
          const currTotal = currSnaps.reduce((a: number, s: any) => a + s.quantity, 0);
          const wRestocks = (restocks || []).filter((r: any) => r.weekStart === w && r.productId === prod.id).reduce((a: number, r: any) => a + r.quantity, 0);
          return { week: w.slice(5), sales: Math.max(0, prevTotal + wRestocks - currTotal), stock: currTotal };
        });

        const currWeekData = snapshots.filter((s: any) => s.weekStart === activeDate && s.productId === prod.id);
        const prevDateData = weeks.indexOf(activeDate) > 0 ? snapshots.filter((s: any) => s.weekStart === weeks[weeks.indexOf(activeDate) - 1] && s.productId === prod.id) : [];
        const distData = distributors.map((d: any) => {
          const curr = currWeekData.find((s: any) => s.distributorId === d.id);
          const prev = prevDateData.find((s: any) => s.distributorId === d.id);
          const r = (restocks || []).filter((x: any) => x.weekStart === activeDate && x.productId === prod.id && x.distributorId === d.id).reduce((a: number, x: any) => a + x.quantity, 0);
          return { name: d.name, prevQty: prev?.quantity ?? 0, currQty: curr?.quantity ?? 0, sales: Math.max(0, (prev?.quantity ?? 0) + r - (curr?.quantity ?? 0)) };
        });

        const totalSales = distData.reduce((a: number, d: any) => a + d.sales, 0);
        const totalStock = currWeekData.reduce((a: number, s: any) => a + s.quantity, 0);
        const maxSales = Math.max(...distData.map((d: any) => d.sales), 1);

        return (
          <div key={prod.id} className="relative overflow-hidden bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
            {/* Colored top bar */}
            <div className={`h-1 bg-gradient-to-r ${prod.gradient}`} />

            <div className="p-5">
              {/* Header */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl ${prod.bg} flex items-center justify-center text-lg`}>
                    {prod.icon}
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-gray-800 tracking-tight">{prod.name}</h3>
                    <p className="text-[10px] text-gray-400">重点产品 · 出货动态追踪</p>
                  </div>
                </div>
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${prod.bg} ${prod.text}`}>
                  {totalSales > 0 ? '动销中' : '待录入'}
                </span>
              </div>

              {/* Big numbers row */}
              <div className="grid grid-cols-3 gap-3 mb-5">
                <div className="bg-gradient-to-br from-gray-50 to-white rounded-xl border border-gray-100 p-3 text-center">
                  <p className="text-[10px] text-gray-400 mb-0.5">本周出货</p>
                  <p className={`text-xl font-bold ${totalSales > 0 ? 'text-gray-800' : 'text-gray-300'}`}>
                    {totalSales.toLocaleString()}
                  </p>
                  <p className="text-[10px] text-gray-400">件</p>
                </div>
                <div className="bg-gradient-to-br from-gray-50 to-white rounded-xl border border-gray-100 p-3 text-center">
                  <p className="text-[10px] text-gray-400 mb-0.5">当前库存</p>
                  <p className={`text-xl font-bold ${totalStock > 0 ? 'text-gray-800' : 'text-gray-300'}`}>
                    {totalStock.toLocaleString()}
                  </p>
                  <p className="text-[10px] text-gray-400">件</p>
                </div>
                <div className="bg-gradient-to-br from-gray-50 to-white rounded-xl border border-gray-100 p-3 text-center">
                  <p className="text-[10px] text-gray-400 mb-0.5">存销比</p>
                  <p className={`text-xl font-bold ${totalSales > 0 ? totalStock / totalSales < 2 ? 'text-emerald-600' : totalStock / totalSales < 5 ? 'text-amber-600' : 'text-red-500' : 'text-gray-300'}`}>
                    {totalSales > 0 ? (totalStock / totalSales).toFixed(1) : '—'}
                  </p>
                  <p className="text-[10px] text-gray-400">倍</p>
                </div>
              </div>

              {/* Distributor breakdown with bars */}
              <div className="space-y-2 mb-5">
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">各经销商出货明细</p>
                {distData.map((d: any) => (
                  <div key={d.name} className="flex items-center gap-2">
                    <span className="text-[11px] text-gray-500 w-20 truncate">{d.name}</span>
                    <div className="flex-1 h-5 bg-gray-50 rounded-full overflow-hidden relative">
                      <div
                        className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r opacity-80 transition-all duration-500"
                        style={{ width: `${(d.sales / maxSales) * 100}%`, backgroundImage: `linear-gradient(to right, ${prod.color}, ${prod.color}88)` }}
                      />
                      <span className="absolute inset-0 flex items-center justify-end pr-2 text-[10px] font-bold text-gray-600">
                        {d.sales > 0 ? d.sales : ''}
                      </span>
                    </div>
                    <span className="text-[10px] text-gray-300 w-20 text-right">{d.prevQty}→{d.currQty}</span>
                  </div>
                ))}
              </div>

              {/* Trend chart */}
              <div>
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">周出货趋势</p>
                <div className="h-36">
                  {trend.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={trend} barGap={2}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f5" vertical={false} />
                        <XAxis dataKey="week" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                        <Tooltip formatter={(v: any) => Number(v).toLocaleString() + ' 件'} cursor={{ fill: '#f9fafb' }} />
                        <Bar dataKey="sales" fill={prod.color} radius={[4, 4, 0, 0]} name="出货" maxBarSize={32} />
                        <Bar dataKey="stock" fill="#e5e7eb" radius={[4, 4, 0, 0]} name="库存" maxBarSize={32} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-full text-[11px] text-gray-300">
                      录入 2 周以上数据后显示趋势图
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
