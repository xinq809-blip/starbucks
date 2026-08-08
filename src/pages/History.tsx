import { useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import { getAvailableWeeks, getCurrentWeekStart } from '../data/mockData';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { TrendingUp, Package, Truck, MapPin, Trophy, Medal, ChevronDown, ChevronRight, AlertCircle } from 'lucide-react';

const CHART_COLORS = ['#00704A','#2ea86e','#3b82f6','#8b5cf6','#f59e0b','#ef4444','#ec4899','#06b6d4'];

const GROUPS = [
  { label: '星选系列', ids: ['p03','p04','p05','p06'] },
  { label: 'P450 黑咖啡', ids: ['p11'] },
  { label: 'P270 椰椰拿铁', ids: ['p20'] },
  { label: '其余产品', ids: ['p01','p02','p07','p08','p09','p10','p12','p13','p14','p15','p16','p17','p18','p19','p21','p22'] },
];

export default function DistributorRanking() {
  const { state } = useApp();
  const { distributors, snapshots, restocks } = state;

  const weeks = useMemo(() => getAvailableWeeks(snapshots), [snapshots]);
  const activeDate = weeks.length > 0 ? weeks[weeks.length - 1] : getCurrentWeekStart();
  const prevDate = weeks.length > 1 ? weeks[weeks.length - 2] : null;

  const subs = useMemo(() =>
    distributors.filter(d => d.role !== 'main' && !d.name.includes('辰日'))
  , [distributors]);

  const [expanded, setExpanded] = useState<string | null>(null);

  // Per-distributor data
  const distData = useMemo(() => subs.map(d => {
    let stock = 0, restock = 0, prevStock = 0;
    for (const s of snapshots) {
      if (s.distributorId === d.id) {
        if (s.weekStart === activeDate) stock += s.quantity;
        if (prevDate && s.weekStart === prevDate) prevStock += s.quantity;
      }
    }
    restock = (restocks || []).filter(r => r.distributorId === d.id).reduce((a, r) => a + r.quantity, 0);
    const sales = Math.max(0, prevStock + restock - stock);
    const stockRatio = sales > 0 ? Math.round((stock / sales) * 10) : 0; // 库存/出货比 ×10

    // Per-group breakdown
    const groups = GROUPS.map(g => {
      let gs = 0, gr = 0;
      for (const pid of g.ids) {
        gs += snapshots.filter(s => s.weekStart === activeDate && s.distributorId === d.id && s.productId === pid).reduce((a, s) => a + s.quantity, 0);
        gr += (restocks || []).filter(r => r.distributorId === d.id && r.productId === pid).reduce((a, r) => a + r.quantity, 0);
      }
      return { label: g.label, stock: gs, restock: gr, sales: Math.max(0, gr - gs) };
    });

    return { ...d, stock, restock, prevStock, sales, stockRatio, groups };
  }).sort((a, b) => b.sales - a.sales), [subs, snapshots, restocks, activeDate, prevDate]);

  const totalSales = distData.reduce((s, d) => s + d.sales, 0);
  const totalStock = distData.reduce((s, d) => s + d.stock, 0);
  const totalRestock = distData.reduce((s, d) => s + d.restock, 0);

  // Pie data
  const pieData = distData.filter(d => d.sales > 0).map(d => ({ name: d.name, value: d.sales }));

  return (
    <div className="p-3 md:p-6 space-y-4">
      <div>
        <h1 className="text-xl md:text-2xl font-bold text-gray-800">经销商排名</h1>
        <p className="text-xs text-gray-400 mt-0.5">
          {subs.length} 家分销商 · 最新盘点 {activeDate}
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: '分销商总数', v: subs.length, unit: '家', icon: MapPin, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: '累计出货', v: totalSales.toLocaleString(), unit: '件', icon: TrendingUp, color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: '现有库存', v: totalStock.toLocaleString(), unit: '件', icon: Package, color: 'text-violet-600', bg: 'bg-violet-50' },
          { label: '累计进货', v: totalRestock.toLocaleString(), unit: '件', icon: Truck, color: 'text-amber-600', bg: 'bg-amber-50' },
        ].map(c => (
          <div key={c.label} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-gray-500">{c.label}</span>
              <div className={`p-1.5 rounded-lg ${c.bg}`}><c.icon size={15} className={c.color} /></div>
            </div>
            <div className="text-2xl font-bold text-gray-800">{c.v}<span className="text-sm font-normal text-gray-400 ml-1">{c.unit}</span></div>
          </div>
        ))}
      </div>

      {/* Chart + Pie */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Bar chart */}
        <div className="md:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h3 className="text-sm font-bold text-gray-800 mb-3">出货量排名</h3>
          {distData.some(d => d.sales > 0) ? (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={distData} layout="vertical" margin={{ left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis type="number" tick={{ fontSize: 10 }} />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={90} />
                <Tooltip formatter={(v: any) => Number(v).toLocaleString() + ' 件'} />
                <Bar dataKey="sales" name="出货" radius={[0, 4, 4, 0]}>
                  {distData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : <div className="h-[240px] flex items-center justify-center text-gray-400 text-sm">暂无出货数据</div>}
        </div>

        {/* Pie */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h3 className="text-sm font-bold text-gray-800 mb-3">出货占比</h3>
          {pieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} innerRadius={30} label={({ percent }: any) => `${(percent * 100).toFixed(0)}%`}>
                  {pieData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v: any) => Number(v).toLocaleString() + ' 件'} />
              </PieChart>
            </ResponsiveContainer>
          ) : <div className="h-[240px] flex items-center justify-center text-gray-400 text-sm">暂无数据</div>}
        </div>
      </div>

      {/* Ranking Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-3.5 border-b border-gray-50">
          <h3 className="text-sm font-bold text-gray-800">排名明细</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead><tr className="border-b border-gray-100 text-gray-500">
              <th className="text-left px-5 py-2.5 font-medium w-10">#</th>
              <th className="text-left px-3 py-2.5 font-medium">分销商</th>
              <th className="text-left px-3 py-2.5 font-medium">区域</th>
              <th className="text-right px-3 py-2.5 font-medium">累计进货</th>
              <th className="text-right px-3 py-2.5 font-medium">现有库存</th>
              <th className="text-right px-3 py-2.5 font-medium">累计出货</th>
              <th className="text-right px-3 py-2.5 font-medium">出货占比</th>
              <th className="text-right px-3 py-2.5 font-medium">库存比</th>
              <th className="text-center px-3 py-2.5 font-medium w-10" />
            </tr></thead>
            <tbody className="divide-y divide-gray-50">
              {distData.map((d, i) => {
                const share = totalSales > 0 ? Math.round((d.sales / totalSales) * 100) : 0;
                const isExpanded = expanded === d.id;
                return (
                  <>
                    <tr key={d.id} className={`hover:bg-gray-50/30 cursor-pointer ${i === 0 ? 'bg-amber-50/30' : i === 1 ? 'bg-gray-50/20' : i === 2 ? 'bg-orange-50/20' : ''}`} onClick={() => setExpanded(isExpanded ? null : d.id)}>
                      <td className="px-5 py-3">
                        {i === 0 ? <Trophy size={16} className="text-amber-500" /> :
                         i === 1 ? <Medal size={16} className="text-gray-400" /> :
                         i === 2 ? <Medal size={16} className="text-orange-400" /> :
                         <span className="text-gray-400 font-medium pl-1">{i + 1}</span>}
                      </td>
                      <td className="px-3 py-3 font-bold text-gray-800">{d.name}</td>
                      <td className="px-3 py-3 text-gray-500">{d.region}</td>
                      <td className="px-3 py-3 text-right text-gray-600">{d.restock.toLocaleString()}</td>
                      <td className="px-3 py-3 text-right font-medium text-gray-700">{d.stock.toLocaleString()}</td>
                      <td className="px-3 py-3 text-right font-bold text-gray-800">{d.sales.toLocaleString()}</td>
                      <td className="px-3 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <div className="w-12 h-1.5 bg-gray-100 rounded-full overflow-hidden"><div className="h-full bg-starbucks-500 rounded-full" style={{ width: `${share}%` }} /></div>
                          <span className="text-gray-500 w-8">{share}%</span>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-right">
                        <span className={`${d.stockRatio > 20 ? 'text-red-500 font-bold' : d.stockRatio > 10 ? 'text-amber-600' : 'text-gray-400'}`}>
                          {d.stockRatio > 0 ? (d.stockRatio / 10).toFixed(1) + 'x' : '—'}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-center text-gray-400">
                        {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      </td>
                    </tr>
                    {/* Expand: group breakdown */}
                    {isExpanded && (
                      <tr key={d.id + '-exp'}>
                        <td colSpan={9} className="p-0">
                          <div className="bg-gray-50/50 px-8 py-3 border-t border-gray-100">
                            <div className="grid grid-cols-4 gap-3">
                              {d.groups.map(g => (
                                <div key={g.label} className="bg-white rounded-xl border border-gray-100 p-2.5 text-center">
                                  <p className="text-[10px] text-gray-400 mb-1.5">{g.label}</p>
                                  <div className="flex justify-center gap-3 text-[11px]">
                                    <span className="text-gray-500">进 <b className="text-blue-600">{g.restock.toLocaleString()}</b></span>
                                    <span className="text-gray-500">存 <b className="text-violet-600">{g.stock.toLocaleString()}</b></span>
                                    <span className="text-gray-500">出 <b className={g.sales > 0 ? 'text-emerald-600' : 'text-gray-400'}>{g.sales.toLocaleString()}</b></span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 库存健康提示 */}
      {distData.some(d => d.stockRatio > 20) && (
        <div className="bg-red-50 rounded-2xl border border-red-100 p-4 flex items-start gap-3">
          <AlertCircle size={16} className="text-red-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-red-700">库存积压预警</p>
            <p className="text-xs text-red-600 mt-0.5">
              {distData.filter(d => d.stockRatio > 20).map(d => d.name).join('、')} 库存/出货比超过2倍，建议关注库存消化
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
