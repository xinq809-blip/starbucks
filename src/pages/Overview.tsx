import { useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { getAvailableWeeks, getWeekLabel, getProductById, getCurrentWeekStart, getProductGroupLabel } from '../data/mockData';
import { TrendingUp, Package, DollarSign, Target, Truck, Calendar } from 'lucide-react';

const FOCUS_IDS = ['p11', 'p20'];

export default function Overview() {
  const { state } = useApp();
  const { products, distributors, snapshots, restocks } = state;

  const weeks = useMemo(() => getAvailableWeeks(snapshots), [snapshots]);
  const activeDate = weeks.length > 0 ? weeks[weeks.length - 1] : getCurrentWeekStart();

  const mainDist = useMemo(() => {
    const m = distributors.find(d => d.role === 'main');
    return m || distributors.find(d => d.name.includes('辰日')) || distributors.find(d => d.region === '唐山') || distributors[0] || null;
  }, [distributors]);

  const mainId = mainDist?.id || '';

  // 唐山辰日全部数据
  const mainRestocks = useMemo(() =>
    (restocks || []).filter(r => r.distributorId === mainId).sort((a, b) => a.date.localeCompare(b.date))
  , [restocks, mainId]);

  const mainSnaps = useMemo(() =>
    [...new Set(snapshots.filter(s => s.distributorId === mainId).map(s => s.weekStart))].sort()
  , [snapshots, mainId]);

  const totalRestock = mainRestocks.reduce((s, r) => s + r.quantity, 0);
  const curStock = snapshots.filter(s => s.weekStart === activeDate && s.distributorId === mainId).reduce((a, s) => a + s.quantity, 0);
  const totalSales = Math.max(0, totalRestock - curStock);
  const stockValue = snapshots.filter(s => s.weekStart === activeDate && s.distributorId === mainId).reduce((a, s) => {
    const p = products.find(x => x.id === s.productId);
    return a + s.quantity * (p?.unitPrice || 0);
  }, 0);

  // 进货按日期+分组
  const restockByDate = useMemo(() => {
    const map: Record<string, Record<string, number>> = {};
    for (const r of mainRestocks) {
      const label = getProductGroupLabel(r.productId) || '其他';
      if (!map[r.date]) map[r.date] = {};
      map[r.date][label] = (map[r.date][label] || 0) + r.quantity;
    }
    return Object.entries(map).sort((a, b) => a[0].localeCompare(b[0]));
  }, [mainRestocks]);

  // 按日期总计
  const restockTotalByDate = useMemo(() => {
    const map: Record<string, number> = {};
    for (const r of mainRestocks) map[r.date] = (map[r.date] || 0) + r.quantity;
    return map;
  }, [mainRestocks]);

  // 重点产品
  const focusData = useMemo(() => FOCUS_IDS.map(pid => {
    const p = getProductById(pid);
    const stock = snapshots.filter(s => s.weekStart === activeDate && s.distributorId === mainId && s.productId === pid).reduce((a, s) => a + s.quantity, 0);
    const restock = (restocks || []).filter(r => r.distributorId === mainId && r.productId === pid).reduce((a, r) => a + r.quantity, 0);
    const sales = Math.max(0, restock - stock);
    return { name: p?.name || pid, stock, restock, sales };
  }), [mainId, activeDate, snapshots, restocks]);

  // ====== 月度汇总 ======
  const monthlySummary = useMemo(() => {
    const months = new Set<string>();
    (restocks || []).forEach(r => { if (r.distributorId === mainId) months.add(r.date.slice(0, 7)); });
    snapshots.forEach(s => { if (s.distributorId === mainId) months.add(s.weekStart.slice(0, 7)); });
    const sortedMonths = [...months].sort();
    return sortedMonths.map((m, idx) => {
      const mRestock = (restocks || []).filter(r => r.distributorId === mainId && r.date.startsWith(m)).reduce((s, r) => s + r.quantity, 0);
      const mSnaps = snapshots.filter(s => s.distributorId === mainId && s.weekStart.startsWith(m)).sort((a, b) => a.weekStart.localeCompare(b.weekStart));
      const lastSnapDate = mSnaps.length > 0 ? mSnaps[mSnaps.length - 1].weekStart : null;
      const endStock = lastSnapDate ? snapshots.filter(s => s.weekStart === lastSnapDate && s.distributorId === mainId).reduce((a, s) => a + s.quantity, 0) : 0;
      let openingStock = 0;
      if (idx > 0) {
        const prevMonth = sortedMonths[idx - 1];
        const prevSnaps = snapshots.filter(s => s.distributorId === mainId && s.weekStart.startsWith(prevMonth)).sort((a, b) => a.weekStart.localeCompare(b.weekStart));
        const prevLastDate = prevSnaps.length > 0 ? prevSnaps[prevSnaps.length - 1].weekStart : null;
        openingStock = prevLastDate ? snapshots.filter(s => s.weekStart === prevLastDate && s.distributorId === mainId).reduce((a, s) => a + s.quantity, 0) : 0;
      }
      const mSales = Math.max(0, openingStock + mRestock - endStock);
      return { month: m, label: m.replace('-', '年') + '月', openingStock, restock: mRestock, endStock, sales: mSales };
    });
  }, [mainId, snapshots, restocks]);

  if (!mainDist) {
    return <div className="p-8 text-center text-gray-400">请先在经销商管理中添加总经销商（唐山辰日）</div>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      <div className="p-4 md:p-6 space-y-5 max-w-5xl mx-auto">

        <div>
          <h1 className="text-2xl font-bold text-gray-800">总看板</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            {mainDist.name} 总经销商 · {restockByDate.length} 次进货 · {mainSnaps.length} 次盘点
          </p>
        </div>

        {/* KPI 汇总 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: '累计进货', value: totalRestock.toLocaleString() + ' 件', sub: `${restockByDate.length} 次进货`, icon: Truck, color: 'text-blue-600', bg: 'bg-blue-50' },
            { label: '现有库存', value: curStock.toLocaleString() + ' 件', sub: getWeekLabel(activeDate), icon: Package, color: 'text-violet-600', bg: 'bg-violet-50' },
            { label: '累计出货', value: totalSales.toLocaleString() + ' 件', sub: `进货${totalRestock} - 库存${curStock}`, icon: TrendingUp, color: 'text-emerald-600', bg: 'bg-emerald-50' },
            { label: '库存价值', value: '¥' + (stockValue / 10000).toFixed(1) + '万', sub: getWeekLabel(activeDate), icon: DollarSign, color: 'text-amber-600', bg: 'bg-amber-50' },
          ].map(c => (
            <div key={c.label} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs text-gray-500">{c.label}</span>
                <div className={`p-1.5 rounded-lg ${c.bg}`}><c.icon size={15} className={c.color} /></div>
              </div>
              <div className="text-2xl font-bold text-gray-800">{c.value}</div>
              <div className="text-[11px] text-gray-400 mt-1">{c.sub}</div>
            </div>
          ))}
        </div>

        {/* 月度汇总 */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-3.5 border-b border-gray-50">
            <h3 className="text-sm font-bold text-gray-800">月度汇总</h3>
            <p className="text-[11px] text-gray-400 mt-0.5">每月进货、期初/期末库存、当月销售</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-gray-500 text-xs">
                  <th className="text-left px-5 py-2.5 font-medium">月份</th>
                  <th className="text-right px-3 py-2.5 font-medium">月初库存</th>
                  <th className="text-right px-3 py-2.5 font-medium">当月进货</th>
                  <th className="text-right px-3 py-2.5 font-medium">月底库存</th>
                  <th className="text-right px-3 py-2.5 font-medium">当月销售</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {monthlySummary.length === 0 ? (
                  <tr><td colSpan={5} className="text-center py-8 text-gray-400 text-sm">暂无数据，录入后自动生成</td></tr>
                ) : (
                  monthlySummary.map(row => (
                    <tr key={row.month} className="hover:bg-gray-50/30">
                      <td className="px-5 py-3 font-bold text-gray-800">{row.label}</td>
                      <td className="px-3 py-3 text-right text-gray-500">{row.openingStock > 0 ? row.openingStock.toLocaleString() : '—'}</td>
                      <td className="px-3 py-3 text-right text-blue-600 font-medium">{row.restock > 0 ? '+' + row.restock.toLocaleString() : '—'}</td>
                      <td className="px-3 py-3 text-right font-bold text-violet-700">{row.endStock > 0 ? row.endStock.toLocaleString() : '—'}</td>
                      <td className={`px-3 py-3 text-right font-bold ${row.sales > 0 ? 'text-emerald-600' : 'text-gray-300'}`}>{row.sales > 0 ? row.sales.toLocaleString() : '—'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* 进货明细 + 盘点记录 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* 进货明细 */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2 mb-4">
              <Truck size={15} className="text-blue-500" />进货明细
            </h3>
            {restockByDate.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-6">暂无进货数据</p>
            ) : (
              <div className="space-y-3">
                {restockByDate.map(([date, groups]) => (
                  <div key={date} className="bg-blue-50/50 rounded-xl p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <Calendar size={13} className="text-blue-400" />
                      <span className="text-sm font-bold text-gray-700">{date}</span>
                      <span className="text-xs text-blue-500 ml-auto font-bold">{restockTotalByDate[date]?.toLocaleString() || 0} 件</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {Object.entries(groups).map(([label, qty]) => (
                        <span key={label} className="text-[10px] px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full font-medium">
                          {label} +{qty.toLocaleString()}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
                <div className="flex items-center justify-between p-3 bg-blue-100 rounded-xl">
                  <span className="text-sm font-bold text-blue-700">合计</span>
                  <span className="text-sm font-bold text-blue-700">{totalRestock.toLocaleString()} 件</span>
                </div>
              </div>
            )}
          </div>

          {/* 盘点记录 */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2 mb-4">
              <Package size={15} className="text-violet-500" />库存盘点
            </h3>
            {mainSnaps.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-6">暂无盘点数据</p>
            ) : (
              <div className="space-y-2">
                {mainSnaps.map(date => {
                  const qty = snapshots.filter(s => s.weekStart === date && s.distributorId === mainId).reduce((a, s) => a + s.quantity, 0);
                  const isLatest = date === activeDate;
                  return (
                    <div key={date} className={`flex items-center justify-between p-3 rounded-xl ${isLatest ? 'bg-violet-100 ring-1 ring-violet-200' : 'bg-violet-50/50'}`}>
                      <div className="flex items-center gap-2">
                        <Calendar size={13} className="text-violet-400" />
                        <span className="text-sm text-gray-700">{date}</span>
                        {isLatest && <span className="text-[10px] px-1.5 py-0.5 bg-violet-200 text-violet-700 rounded font-medium">最新</span>}
                      </div>
                      <span className="text-sm font-bold text-violet-600">{qty.toLocaleString()} 件</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* 重点产品 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {focusData.map(f => (
            <div key={f.name} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <div className="flex items-center gap-2.5 mb-4">
                <div className="w-8 h-8 rounded-xl bg-starbucks-500 flex items-center justify-center">
                  <Target size={16} className="text-white" />
                </div>
                <h3 className="text-sm font-bold text-gray-800">{f.name}</h3>
              </div>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div className="bg-blue-50 rounded-xl p-3">
                  <p className="text-xl font-bold text-blue-600">{f.restock.toLocaleString()}</p>
                  <p className="text-[10px] text-blue-400 mt-0.5">进货</p>
                </div>
                <div className="bg-violet-50 rounded-xl p-3">
                  <p className="text-xl font-bold text-violet-600">{f.stock.toLocaleString()}</p>
                  <p className="text-[10px] text-violet-400 mt-0.5">库存</p>
                </div>
                <div className="bg-emerald-50 rounded-xl p-3">
                  <p className="text-xl font-bold text-emerald-600">{f.sales.toLocaleString()}</p>
                  <p className="text-[10px] text-emerald-400 mt-0.5">出货</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
