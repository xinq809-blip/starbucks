import { useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { getAvailableWeeks, getCurrentWeekStart, getProductById, getProductGroupLabel } from '../data/mockData';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { TrendingUp, Package, DollarSign, MapPin, Calendar } from 'lucide-react';

const PIE_COLORS = ['#00704A','#2ea86e','#f59e0b','#8b5cf6','#ef4444','#3b82f6','#ec4899','#06b6d4','#84cc16','#f97316','#14b8a6','#6366f1'];
const FOCUS_IDS = ['p11', 'p20'];

export default function Dashboard() {
  const { state } = useApp();
  const { products, distributors, snapshots, restocks } = state;

  const weeks = useMemo(() => getAvailableWeeks(snapshots), [snapshots]);
  const activeDate = weeks.length > 0 ? weeks[weeks.length - 1] : getCurrentWeekStart();

  // 看板只显示分销商数据，唐山辰日只在总看板显示
  const subs = useMemo(() =>
    distributors.filter(d => d.role !== 'main' && !d.name.includes('辰日'))
  , [distributors]);
  const allIds = useMemo(() => subs.map(d => d.id), [subs]);

  // ====== 构建时间线：把所有进货日期和盘点日期合在一起排序 ======
  const timeline = useMemo(() => {
    // 收集所有进货日期和盘点日期
    const restockDates = [...new Set((restocks || []).map(r => r.date))].sort();
    const snapDates = [...new Set(snapshots.map(s => s.weekStart))].sort();

    // 合并去重排序
    const allDates = [...new Set([...restockDates, ...snapDates])].sort();

    // 为每个时间点计算各经销商的累计进货和库存
    // 累计：截至该日期的所有进货和库存
    const rows: {
      date: string;
      type: 'restock' | 'snap' | 'both';
      restock: number;      // 本期新增进货
      totalRestock: number;  // 累计进货
      stock: number;        // 盘点库存（仅snap有）
      label: string;
    }[] = [];

    for (const date of allDates) {
      const isSnap = snapDates.includes(date);
      const isRestock = restockDates.includes(date);
      const type = isSnap && isRestock ? 'both' : isSnap ? 'snap' : 'restock';

      // 本期进货 = 该日期的新增
      const periodRestock = (restocks || []).filter(r => r.date === date && allIds.includes(r.distributorId)).reduce((s, r) => s + r.quantity, 0);
      // 累计进货 = 截至该日期的全部
      const totalRestock = (restocks || []).filter(r => r.date <= date && allIds.includes(r.distributorId)).reduce((s, r) => s + r.quantity, 0);
      // 盘点库存
      const stock = isSnap ? snapshots.filter(s => s.weekStart === date && allIds.includes(s.distributorId)).reduce((a, s) => a + s.quantity, 0) : 0;
      rows.push({
        date,
        type,
        restock: periodRestock,
        totalRestock,
        stock: isSnap ? stock : 0,
        label: isSnap ? `盘点 ${date}` : `进货 ${date}`,
      });
    }
    return rows;
  }, [restocks, snapshots, allIds]);

  // 累计到最新
  const totalRestock = (restocks || []).filter(r => allIds.includes(r.distributorId)).reduce((s, r) => s + r.quantity, 0);
  const curStock = snapshots.filter(s => s.weekStart === activeDate && allIds.includes(s.distributorId)).reduce((a, s) => a + s.quantity, 0);
  const curValue = snapshots.filter(s => s.weekStart === activeDate && allIds.includes(s.distributorId)).reduce((a, s) => {
    const p = products.find(x => x.id === s.productId);
    return a + s.quantity * (p?.unitPrice || 0);
  }, 0);
  const totalSales = Math.max(0, totalRestock - curStock);

  // 区域
  const regionData = useMemo(() => {
    const map: Record<string, { stock: number; restock: number }> = {};
    for (const d of distributors.filter(d => d.role !== 'main' && !d.name.includes('辰日'))) {
      const r = d.region || '其他';
      if (!map[r]) map[r] = { stock: 0, restock: 0 };
      map[r].stock += snapshots.filter(s => s.weekStart === activeDate && s.distributorId === d.id).reduce((a, s) => a + s.quantity, 0);
      map[r].restock += (restocks || []).filter(x => x.distributorId === d.id).reduce((a, x) => a + x.quantity, 0);
    }
    return map;
  }, [distributors, snapshots, restocks, activeDate]);

  // 品类 → 改为分组标签
  const catData = useMemo(() => {
    const groups: Record<string, number> = {};
    for (const p of products) {
      const rs = (restocks || []).filter(r => allIds.includes(r.distributorId) && r.productId === p.id).reduce((a, r) => a + r.quantity, 0);
      const st = snapshots.filter(s => s.weekStart === activeDate && allIds.includes(s.distributorId) && s.productId === p.id).reduce((a, s) => a + s.quantity, 0);
      const sales = Math.max(0, rs - st);
      if (sales > 0) { const label = getProductGroupLabel(p.id) || p.name; groups[label] = (groups[label] || 0) + sales; }
    }
    return Object.entries(groups).map(([k, v]) => ({ name: k, value: v })).sort((a, b) => b.value - a.value);
  }, [allIds, activeDate, snapshots, restocks]);

  // 重点产品
  const focusData = useMemo(() => FOCUS_IDS.map(pid => {
    const p = getProductById(pid);
    const rs = (restocks || []).filter(r => allIds.includes(r.distributorId) && r.productId === pid).reduce((a, r) => a + r.quantity, 0);
    const st = snapshots.filter(s => s.weekStart === activeDate && allIds.includes(s.distributorId) && s.productId === pid).reduce((a, s) => a + s.quantity, 0);
    return { name: p?.name || pid, stock: st, restock: rs, sales: Math.max(0, rs - st) };
  }), [allIds, activeDate, snapshots, restocks]);

  return (
    <div className="p-3 md:p-6 space-y-4">
      <div>
        <h1 className="text-xl md:text-2xl font-bold text-gray-800">数据看板</h1>
        <p className="text-xs text-gray-400 mt-0.5">
          {timeline.length} 条记录 · {weeks.length} 次盘点 · {restocks.length} 条进货
        </p>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: '现有库存', v: curStock, unit: '件', icon: Package, color: 'text-violet-600', bg: 'bg-violet-50' },
          { label: '累计出货', v: totalSales, unit: '件', icon: TrendingUp, color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: '库存价值', v: '¥' + (curValue / 10000).toFixed(1), unit: '万', icon: DollarSign, color: 'text-amber-600', bg: 'bg-amber-50' },
          { label: '分销商', v: subs.length, unit: '家', icon: MapPin, color: 'text-blue-600', bg: 'bg-blue-50' },
        ].map(c => (
          <div key={c.label} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <div className="flex items-center justify-between mb-2"><span className="text-xs text-gray-500">{c.label}</span><div className={`p-1.5 rounded-lg ${c.bg}`}><c.icon size={15} className={c.color} /></div></div>
            <div className="text-2xl font-bold text-gray-800">{typeof c.v === 'number' ? c.v.toLocaleString() : c.v}<span className="text-sm font-normal text-gray-400 ml-1">{c.unit}</span></div>
          </div>
        ))}
      </div>

      {/* ====== 进销存时间线 ====== */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-3.5 border-b border-gray-50">
          <h3 className="text-sm font-bold text-gray-800">进销存时间线</h3>
          <p className="text-[11px] text-gray-400 mt-0.5">按时间排列：每次进货和盘点记录</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-100 text-gray-500">
                <th className="text-left px-5 py-2.5 font-medium">日期</th>
                <th className="text-center px-3 py-2.5 font-medium">类型</th>
                <th className="text-right px-3 py-2.5 font-medium">本次进货</th>
                <th className="text-right px-3 py-2.5 font-medium">累计进货</th>
                <th className="text-right px-3 py-2.5 font-medium">盘点库存</th>
                <th className="text-right px-3 py-2.5 font-medium">阶段出货</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {timeline.map((row, i) => {
                // 阶段出货 = 从上次盘点到本次盘点的出货
                const prevRow = i > 0 ? timeline.filter((_, j) => j < i && timeline[j].type !== 'restock').reverse()[0] : null;
                const prevStock = prevRow ? prevRow.stock : 0;
                const periodRestock = timeline.slice(prevRow ? timeline.indexOf(prevRow) + 1 : 0, i + 1).reduce((s, r) => s + r.restock, 0);
                const periodSales = row.type !== 'restock' ? Math.max(0, prevStock + periodRestock - row.stock) : 0;

                return (
                  <tr key={row.date + row.type} className={`hover:bg-gray-50/30 ${row.type !== 'restock' ? 'bg-gray-50/20' : ''}`}>
                    <td className="px-5 py-3 font-medium text-gray-800 flex items-center gap-2">
                      <Calendar size={12} className={row.type !== 'restock' ? 'text-violet-400' : 'text-blue-400'} />
                      {row.date}
                    </td>
                    <td className="px-3 py-3 text-center">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                        row.type === 'snap' ? 'bg-violet-50 text-violet-600' :
                        row.type === 'both' ? 'bg-starbucks-50 text-starbucks-600' :
                        'bg-blue-50 text-blue-600'
                      }`}>
                        {row.type === 'snap' ? '盘点' : row.type === 'both' ? '进货+盘点' : '进货'}
                      </span>
                    </td>
                    <td className={`px-3 py-3 text-right font-medium ${row.restock > 0 ? 'text-blue-600' : 'text-gray-300'}`}>
                      {row.restock > 0 ? '+' + row.restock.toLocaleString() : '—'}
                    </td>
                    <td className="px-3 py-3 text-right text-gray-700">{row.totalRestock.toLocaleString()}</td>
                    <td className={`px-3 py-3 text-right font-bold ${row.type !== 'restock' ? 'text-violet-700' : 'text-gray-300'}`}>
                      {row.type !== 'restock' ? row.stock.toLocaleString() : '—'}
                    </td>
                    <td className={`px-3 py-3 text-right font-bold ${row.type !== 'restock' ? (periodSales > 0 ? 'text-emerald-600' : 'text-gray-400') : 'text-gray-300'}`}>
                      {row.type !== 'restock' ? (periodSales > 0 ? periodSales.toLocaleString() : '—') : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 经销商明细 */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-3.5 border-b border-gray-50">
          <h3 className="text-sm font-bold text-gray-800">经销商明细</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead><tr className="border-b border-gray-100 text-gray-500">
              <th className="text-left px-5 py-2.5 font-medium">经销商</th>
              <th className="text-left px-3 py-2.5 font-medium">区域</th>
              <th className="text-right px-3 py-2.5 font-medium">累计进货</th>
              <th className="text-right px-3 py-2.5 font-medium">现有库存</th>
              <th className="text-right px-3 py-2.5 font-medium">累计出货</th>
            </tr></thead>
            <tbody className="divide-y divide-gray-50">
              {distributors.filter(d => d.role !== 'main' && !d.name.includes('辰日')).map(d => {
                const stock = snapshots.filter(s => s.weekStart === activeDate && s.distributorId === d.id).reduce((a, s) => a + s.quantity, 0);
                const restock = (restocks || []).filter(r => r.distributorId === d.id).reduce((a, r) => a + r.quantity, 0);
                const sales = Math.max(0, restock - stock);
                if (!restock && !stock) return null;
                return (
                  <tr key={d.id} className="hover:bg-gray-50/30">
                    <td className="px-5 py-3 font-medium text-gray-700">{d.name}</td>
                    <td className="px-3 py-3 text-xs text-gray-400">{d.region}</td>
                    <td className="px-3 py-3 text-right text-gray-700">{restock.toLocaleString()}</td>
                    <td className="px-3 py-3 text-right text-gray-700">{stock.toLocaleString()}</td>
                    <td className={`px-3 py-3 text-right font-bold ${sales > 0 ? 'text-emerald-600' : 'text-gray-300'}`}>{sales > 0 ? sales.toLocaleString() : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 区域 + 品类 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2 mb-3"><MapPin size={15} className="text-starbucks-500" />区域分布</h3>
          {Object.entries(regionData).map(([r, d]) => (
            <div key={r} className="flex items-center gap-3 mb-2.5 last:mb-0">
              <span className={`w-2.5 h-2.5 rounded-full ${r === '秦皇岛' ? 'bg-blue-500' : 'bg-amber-500'}`} />
              <span className="text-sm font-medium w-14">{r}</span>
              <div className="flex-1 grid grid-cols-2 gap-2 text-center">
                <div className="bg-gray-50 rounded-lg p-1.5"><p className="text-xs font-bold">{d.restock.toLocaleString()}</p><p className="text-[9px] text-gray-400">进货</p></div>
                <div className="bg-gray-50 rounded-lg p-1.5"><p className="text-xs font-bold">{d.stock.toLocaleString()}</p><p className="text-[9px] text-gray-400">库存</p></div>
              </div>
            </div>
          ))}
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h3 className="text-sm font-bold text-gray-800 mb-3">品类出货结构</h3>
          {catData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart><Pie data={catData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={75} innerRadius={30} label={({ name, percent }: any) => `${name} ${(percent * 100).toFixed(0)}%`}>{catData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}</Pie><Tooltip formatter={(v: any) => Number(v).toLocaleString() + ' 件'} /></PieChart>
            </ResponsiveContainer>
          ) : <div className="h-[220px] flex items-center justify-center text-gray-400 text-sm">暂无数据</div>}
        </div>
      </div>

      {/* 重点产品 */}
      <div className="space-y-3">
        <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-starbucks-500" />重点产品分析
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[
            { ...focusData[0], color: '#1e293b', bg: '#f8fafc', border: 'border-gray-200', tag: '黑咖啡系列' },
            { ...focusData[1], color: '#059669', bg: '#f0fdf4', border: 'border-emerald-200', tag: '拿铁系列' },
          ].map(f => (
            <div key={f.name} className={`bg-white rounded-2xl border ${f.border} shadow-sm p-6`}>
              {/* Header */}
              <div className="flex items-center gap-2.5 mb-6">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: f.color }} />
                <h3 className="text-sm font-bold text-gray-800">{f.name}</h3>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">{f.tag}</span>
              </div>

              {/* Hero: 出货 */}
              <div className="text-center mb-6">
                <p className="text-[11px] text-gray-400 mb-1">累计出货</p>
                <p className="text-4xl font-bold tracking-tight" style={{ color: f.color }}>
                  {f.sales.toLocaleString()}
                </p>
                <p className="text-xs text-gray-400 mt-1">件</p>
              </div>

              {/* 进货 + 库存 */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-50 rounded-xl p-3 text-center">
                  <p className="text-[10px] text-gray-400 mb-0.5">累计进货</p>
                  <p className="text-lg font-bold text-gray-700">{f.restock.toLocaleString()}</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-3 text-center">
                  <p className="text-[10px] text-gray-400 mb-0.5">现有库存</p>
                  <p className="text-lg font-bold text-gray-700">{f.stock.toLocaleString()}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* 分销商出货排名图表 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {FOCUS_IDS.map(pid => {
            const p = getProductById(pid);
            const distSales = distributors.filter(d => d.role !== 'main' && !d.name.includes('辰日')).map(d => {
              const st = snapshots.filter(s => s.weekStart === activeDate && s.distributorId === d.id && s.productId === pid).reduce((a: number, s: any) => a + s.quantity, 0);
              const rs = (restocks || []).filter((r: any) => r.distributorId === d.id && r.productId === pid).reduce((a: number, r: any) => a + r.quantity, 0);
              return { name: d.name, sales: Math.max(0, rs - st) };
            }).sort((a, b) => b.sales - a.sales);

            const is450 = pid === 'p11';
            const barColor = is450 ? '#1e293b' : '#059669';

            return (
              <div key={pid} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <h4 className="text-xs font-bold text-gray-700 mb-3">{p?.name} · 分销商出货排名</h4>
                {distSales.length > 0 ? (
                  <ResponsiveContainer width="100%" height={Math.max(100, distSales.length * 40)}>
                    <BarChart data={distSales} layout="vertical" margin={{ left: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis type="number" tick={{ fontSize: 10 }} />
                      <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={80} />
                      <Tooltip formatter={(v: any) => Number(v).toLocaleString() + ' 件'} />
                      <Bar dataKey="sales" name="出货" fill={barColor} radius={[0, 4, 4, 0]} label={{ position: 'right', fontSize: 10, formatter: (v: any) => v > 0 ? Number(v).toLocaleString() : '' }} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[100px] flex items-center justify-center text-gray-400 text-xs">暂无数据</div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
