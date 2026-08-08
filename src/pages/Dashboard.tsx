import { useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import { getAvailableWeeks, getWeekLabel, getCurrentWeekStart, getProductById, getCategoryLabel } from '../data/mockData';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { TrendingUp, Package, DollarSign, Truck, ArrowRight, MapPin } from 'lucide-react';

const PIE_COLORS = ['#00704A','#2ea86e','#f59e0b','#8b5cf6','#ef4444','#3b82f6','#ec4899','#06b6d4','#84cc16','#f97316','#14b8a6','#6366f1'];
const FOCUS_IDS = ['p11', 'p20'];

export default function Dashboard() {
  const { state } = useApp();
  const { products, distributors, snapshots, restocks } = state;

  const weeks = useMemo(() => getAvailableWeeks(snapshots), [snapshots]);

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
    for (let i = 0; i < weeks.length - 1; i++) p.push({ prev: weeks[i], curr: weeks[i + 1], label: `第${i + 1}→${i + 2}次` });
    return p;
  }, [weeks]);
  const [pairIdx, setPairIdx] = useState(Math.max(0, pairs.length - 1));
  const activePrev = pairs.length > 0 ? pairs[pairIdx]?.prev : null;
  const activeCurr = pairs.length > 0 ? pairs[pairIdx]?.curr : weeks.length > 0 ? weeks[weeks.length - 1] : getCurrentWeekStart();

  const allIds = useMemo(() => distributors.map(d => d.id), [distributors]);
  const mainId = mainDist?.id || '';
  const subIds = subDists.map(d => d.id);

  // 计算单经销商
  const calc = (distId: string) => {
    const stock = snapshots.filter(s => s.weekStart === activeCurr && s.distributorId === distId).reduce((a: number, s: any) => a + s.quantity, 0);
    const prevStock = activePrev ? snapshots.filter(s => s.weekStart === activePrev && s.distributorId === distId).reduce((a: number, s: any) => a + s.quantity, 0) : 0;
    const restock = (restocks || []).filter((x: any) => x.distributorId === distId && x.date <= activeCurr).reduce((a: number, x: any) => a + x.quantity, 0);
    return { stock, prevStock, restock, sales: Math.max(0, prevStock + restock - stock) };
  };

  // 汇总
  const total = useMemo(() => {
    let s = 0, p = 0, r = 0;
    for (const id of allIds) { const d = calc(id); s += d.stock; p += d.prevStock; r += d.restock; }
    return { stock: s, prevStock: p, restock: r, sales: Math.max(0, p + r - s) };
  }, [allIds, activeCurr, activePrev, snapshots, restocks]);

  // 总经销 = 分销商合计
  const mainTotal = useMemo(() => {
    const ids = subIds.length > 0 ? subIds : allIds.filter(id => id !== mainId);
    let s = 0, p = 0, r = 0;
    for (const id of ids) { const d = calc(id); s += d.stock; p += d.prevStock; r += d.restock; }
    return { stock: s, prevStock: p, restock: r, sales: Math.max(0, p + r - s) };
  }, [subIds, mainId, allIds, activeCurr, activePrev, snapshots, restocks]);

  // 区域数据
  const regionData = useMemo(() => {
    const map: Record<string, { stock: number; restock: number; sales: number }> = {};
    for (const d of distributors) {
      const r = d.region || '其他';
      if (!map[r]) map[r] = { stock: 0, restock: 0, sales: 0 };
      const dd = calc(d.id);
      map[r].stock += dd.stock; map[r].restock += dd.restock; map[r].sales += dd.sales;
    }
    return map;
  }, [distributors, activeCurr, activePrev, snapshots, restocks]);

  // 品类
  const catData = useMemo(() => {
    const cats: Record<string, number> = {};
    for (const p of products) {
      let s = 0;
      for (const id of allIds) {
        const stock = snapshots.filter(x => x.weekStart === activeCurr && x.distributorId === id && x.productId === p.id).reduce((a: number, x: any) => a + x.quantity, 0);
        const prevS = activePrev ? snapshots.filter(x => x.weekStart === activePrev && x.distributorId === id && x.productId === p.id).reduce((a: number, x: any) => a + x.quantity, 0) : 0;
        const rs = (restocks || []).filter((x: any) => x.distributorId === id && x.date <= activeCurr && x.productId === p.id).reduce((a: number, x: any) => a + x.quantity, 0);
        s += Math.max(0, prevS + rs - stock);
      }
      if (s > 0) { const c = getCategoryLabel(p.category); cats[c] = (cats[c] || 0) + s; }
    }
    return Object.entries(cats).map(([k, v]) => ({ name: k, value: v })).sort((a, b) => b.value - a.value);
  }, [allIds, activeCurr, activePrev, snapshots, restocks]);

  // 重点产品
  const focusData = useMemo(() => FOCUS_IDS.map(pid => {
    const p = getProductById(pid);
    let stock = 0, prevS = 0, rs = 0;
    for (const id of allIds) {
      stock += snapshots.filter(s => s.weekStart === activeCurr && s.distributorId === id && s.productId === pid).reduce((a: number, s: any) => a + s.quantity, 0);
      prevS += activePrev ? snapshots.filter(s => s.weekStart === activePrev && s.distributorId === id && s.productId === pid).reduce((a: number, s: any) => a + s.quantity, 0) : 0;
      rs += (restocks || []).filter((x: any) => x.distributorId === id && x.date <= activeCurr && x.productId === pid).reduce((a: number, x: any) => a + x.quantity, 0);
    }
    return { name: p?.name || pid, stock, restock: rs, sales: Math.max(0, prevS + rs - stock) };
  }), [allIds, activeCurr, activePrev, snapshots, restocks]);

  return (
    <div className="p-3 md:p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-gray-800">数据看板</h1>
          <p className="text-xs text-gray-400 mt-0.5">
            {weeks.length} 次盘点 · 当前 {getWeekLabel(activeCurr)} · {distributors.length} 家经销商
          </p>
        </div>
      </div>

      {/* ====== KPI 总览 ====== */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: '累计进货', v: total.restock, unit: '件', icon: Truck, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: '现有库存', v: total.stock, unit: '件', icon: Package, color: 'text-violet-600', bg: 'bg-violet-50' },
          { label: '累计出货', v: total.sales, unit: '件', icon: TrendingUp, color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: '库存价值', v: '¥' + (snapshots.filter(s => s.weekStart === activeCurr).reduce((a: number, s: any) => { const p = products.find(x => x.id === s.productId); return a + s.quantity * (p?.unitPrice || 0); }, 0) / 10000).toFixed(1), unit: '万', icon: DollarSign, color: 'text-amber-600', bg: 'bg-amber-50' },
        ].map(c => (
          <div key={c.label} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-gray-500">{c.label}</span>
              <div className={`p-1.5 rounded-lg ${c.bg}`}><c.icon size={15} className={c.color} /></div>
            </div>
            <div className="text-2xl font-bold text-gray-800">{typeof c.v === 'number' ? c.v.toLocaleString() : c.v}<span className="text-sm font-normal text-gray-400 ml-1">{c.unit}</span></div>
          </div>
        ))}
      </div>

      {/* ====== 盘点对比选择 ====== */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
        <div className="flex items-center gap-3">
          <span className="text-xs font-bold text-gray-600">盘点对比</span>
          {pairs.length > 0 ? (
            <div className="flex gap-1.5 flex-wrap">
              {pairs.map((p, i) => (
                <button key={i} onClick={() => setPairIdx(i)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${i === pairIdx ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
                  {p.label}: {getWeekLabel(p.prev)} <ArrowRight size={10} className="inline" /> {getWeekLabel(p.curr)}
                </button>
              ))}
            </div>
          ) : weeks.length === 1 ? (
            <span className="text-xs text-gray-400">仅1次盘点（{getWeekLabel(weeks[0])}），再录1次后显示对比</span>
          ) : <span className="text-xs text-gray-400">暂无数据</span>}
        </div>
      </div>

      {/* ====== 经销商对比表 ====== */}
      {activePrev && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-3.5 border-b border-gray-50">
            <h3 className="text-sm font-bold text-gray-800">经销商出货对比</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead><tr className="border-b border-gray-100 text-gray-500">
                <th className="text-left px-5 py-2.5 font-medium">经销商</th>
                <th className="text-right px-3 py-2.5 font-medium">区域</th>
                <th className="text-right px-3 py-2.5 font-medium">盘点前</th>
                <th className="text-right px-3 py-2.5 font-medium">进货</th>
                <th className="text-right px-3 py-2.5 font-medium">盘点时</th>
                <th className="text-right px-3 py-2.5 font-medium">出货</th>
              </tr></thead>
              <tbody className="divide-y divide-gray-50">
                {/* 总经销合计行 */}
                {mainDist && subDists.length > 0 && (
                  <tr className="bg-starbucks-50/60">
                    <td className="px-5 py-3 text-sm font-bold text-gray-800">{mainDist.name}<span className="text-[10px] text-starbucks-500 ml-1.5 font-normal">合计</span></td>
                    <td className="px-3 py-3 text-right text-xs text-gray-500">—</td>
                    <td className="px-3 py-3 text-right font-bold text-gray-700">{mainTotal.prevStock.toLocaleString()}</td>
                    <td className="px-3 py-3 text-right font-bold text-blue-600">{mainTotal.restock.toLocaleString()}</td>
                    <td className="px-3 py-3 text-right font-bold text-gray-700">{mainTotal.stock.toLocaleString()}</td>
                    <td className="px-3 py-3 text-right font-bold text-emerald-600">{mainTotal.sales.toLocaleString()}</td>
                  </tr>
                )}
                {(subDists.length > 0 ? subDists : distributors).map(d => {
                  const dd = calc(d.id);
                  if (!dd.prevStock && !dd.stock && !dd.restock) return null;
                  return (
                    <tr key={d.id} className="hover:bg-gray-50/30">
                      <td className="px-5 py-3 text-gray-700 font-medium">{d.name}{d.role === 'sub' && <span className="text-[10px] text-gray-400 ml-1">分销商</span>}</td>
                      <td className="px-3 py-3 text-right text-xs text-gray-400">{d.region}</td>
                      <td className="px-3 py-3 text-right text-gray-500">{dd.prevStock.toLocaleString()}</td>
                      <td className="px-3 py-3 text-right text-gray-700">{dd.restock.toLocaleString()}</td>
                      <td className="px-3 py-3 text-right text-gray-700 font-medium">{dd.stock.toLocaleString()}</td>
                      <td className={`px-3 py-3 text-right font-bold ${dd.sales > 0 ? 'text-emerald-600' : 'text-gray-300'}`}>{dd.sales > 0 ? dd.sales.toLocaleString() : '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ====== 区域 + 品类 ====== */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* 区域 */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2 mb-3"><MapPin size={15} className="text-starbucks-500" />区域分布</h3>
          {Object.entries(regionData).map(([r, d]) => (
            <div key={r} className="flex items-center gap-3 mb-2.5 last:mb-0">
              <span className={`w-2.5 h-2.5 rounded-full ${r === '秦皇岛' ? 'bg-blue-500' : 'bg-amber-500'}`} />
              <span className="text-sm text-gray-700 font-medium w-14">{r}</span>
              <div className="flex-1 grid grid-cols-3 gap-2 text-center">
                <div className="bg-gray-50 rounded-lg p-1.5"><p className="text-xs font-bold text-gray-700">{d.restock.toLocaleString()}</p><p className="text-[9px] text-gray-400">进货</p></div>
                <div className="bg-gray-50 rounded-lg p-1.5"><p className="text-xs font-bold text-gray-700">{d.stock.toLocaleString()}</p><p className="text-[9px] text-gray-400">库存</p></div>
                <div className="bg-gray-50 rounded-lg p-1.5"><p className="text-xs font-bold text-gray-700">{d.sales.toLocaleString()}</p><p className="text-[9px] text-gray-400">出货</p></div>
              </div>
            </div>
          ))}
        </div>

        {/* 品类饼图 */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h3 className="text-sm font-bold text-gray-800 mb-3">品类出货结构</h3>
          {catData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={catData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={75} innerRadius={30} label={({ name, percent }: any) => `${name} ${(percent * 100).toFixed(0)}%`}>
                  {catData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v: any) => Number(v).toLocaleString() + ' 件'} />
              </PieChart>
            </ResponsiveContainer>
          ) : <div className="h-[220px] flex items-center justify-center text-gray-400 text-sm">暂无出货数据</div>}
        </div>
      </div>

      {/* ====== 重点产品 ====== */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {focusData.map(f => (
          <div key={f.name} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <h3 className="text-sm font-bold text-starbucks-700 mb-3">{f.name}</h3>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="bg-blue-50 rounded-xl p-3"><p className="text-xl font-bold text-blue-600">{f.restock.toLocaleString()}</p><p className="text-[10px] text-blue-400 mt-0.5">进货</p></div>
              <div className="bg-violet-50 rounded-xl p-3"><p className="text-xl font-bold text-violet-600">{f.stock.toLocaleString()}</p><p className="text-[10px] text-violet-400 mt-0.5">库存</p></div>
              <div className="bg-emerald-50 rounded-xl p-3"><p className="text-xl font-bold text-emerald-600">{f.sales.toLocaleString()}</p><p className="text-[10px] text-emerald-400 mt-0.5">出货</p></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
