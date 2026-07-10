import { useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import { getAvailableWeeks, getWeekLabel } from '../data/mockData';
import { ArrowUp, ArrowDown, Minus, Search } from 'lucide-react';

export default function History() {
  const { state } = useApp();
  const { products, distributors, snapshots } = state;

  const weeks = useMemo(() => getAvailableWeeks(snapshots), [snapshots]);
  const [compareA, setCompareA] = useState(weeks.length >= 2 ? weeks[weeks.length - 2] : weeks[0]);
  const [compareB, setCompareB] = useState(weeks[weeks.length - 1]);
  const [search, setSearch] = useState('');

  const comparison = useMemo(() => {
    const dataA = snapshots.filter((s) => s.weekStart === compareA);
    const dataB = snapshots.filter((s) => s.weekStart === compareB);

    return products
      .filter((p) => {
        if (!search) return true;
        return p.name.toLowerCase().includes(search.toLowerCase()) || p.sku.toLowerCase().includes(search.toLowerCase());
      })
      .map((p) => {
        const distData = distributors.map((d) => {
          const a = dataA.find((s) => s.productId === p.id && s.distributorId === d.id);
          const b = dataB.find((s) => s.productId === p.id && s.distributorId === d.id);
          return {
            distributor: d,
            qtyA: a ? a.quantity : -1,
            qtyB: b ? b.quantity : -1,
            change: (b && a) ? b.quantity - a.quantity : 0,
          };
        });

        const totalA = distData.reduce((s, d) => s + (d.qtyA >= 0 ? d.qtyA : 0), 0);
        const totalB = distData.reduce((s, d) => s + (d.qtyB >= 0 ? d.qtyB : 0), 0);

        return { product: p, distData, totalA, totalB, totalChange: totalB - totalA };
      });
  }, [snapshots, compareA, compareB, products, distributors, search]);

  return (
    <div className="p-3 md:p-6 space-y-4 md:space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">历史对比</h1>
        <p className="text-sm text-gray-500 mt-0.5">周环比库存变化分析</p>
      </div>

      {/* Week Selector */}
      <div className="flex items-center gap-4 bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">对比:</span>
          <select
            value={compareA}
            onChange={(e) => setCompareA(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm font-medium text-gray-700"
          >
            {weeks.map((w) => (
              <option key={w} value={w}>{getWeekLabel(w)}</option>
            ))}
          </select>
        </div>
        <span className="text-gray-400 text-lg">vs</span>
        <div className="flex items-center gap-2">
          <select
            value={compareB}
            onChange={(e) => setCompareB(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm font-medium text-gray-700"
          >
            {weeks.map((w) => (
              <option key={w} value={w}>{getWeekLabel(w)}</option>
            ))}
          </select>
        </div>
        <div className="flex-1" />
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
          <input
            type="text"
            placeholder="搜索产品..."
            className="pl-8 pr-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-starbucks-500/20 focus:border-starbucks-500 w-48"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Comparison Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-3 font-semibold text-gray-600 sticky left-0 bg-gray-50 z-10 min-w-[150px]">
                  产品
                </th>
                {distributors.map((d) => (
                  <th key={d.id} className="text-center px-3 py-3 font-semibold text-gray-600 min-w-[140px]" colSpan={2}>
                    {d.name}
                  </th>
                ))}
                <th className="text-center px-3 py-3 font-semibold text-gray-600 bg-starbucks-50 min-w-[100px]" colSpan={2}>
                  总计
                </th>
              </tr>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-2 font-normal text-xs text-gray-400 sticky left-0 bg-gray-50 z-10">
                  {getWeekLabel(compareA)} → {getWeekLabel(compareB)}
                </th>
                {distributors.map((d) => (
                  <th key={d.id} className="text-center px-2 py-2 font-normal text-xs text-gray-400" colSpan={2}>
                    库存 / 变化
                  </th>
                ))}
                <th className="text-center px-2 py-2 font-normal text-xs text-gray-400 bg-starbucks-50" colSpan={2}>
                  库存 / 变化
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {comparison.map(({ product, distData, totalB, totalChange }, ri) => (
                <tr key={product.id} className={ri % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'}>
                  <td className="px-4 py-3 sticky left-0 bg-inherit z-10">
                    <p className="font-medium text-gray-800 text-xs">{product.name}</p>
                    <p className="text-[10px] text-gray-400">{product.spec}</p>
                  </td>
                  {distData.map(({ distributor, qtyA, qtyB, change }) => (
                    <td key={distributor.id} className="text-center px-2 py-3" colSpan={2}>
                      <div className="flex items-center justify-center gap-1.5">
                        <span className="text-xs text-gray-500">{qtyB >= 0 ? qtyB : '—'}</span>
                        {qtyA >= 0 && qtyB >= 0 && change !== 0 && (
                          <span className={`flex items-center text-[10px] font-bold ${change > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                            {change > 0 ? <ArrowUp size={10} /> : <ArrowDown size={10} />}
                            {change > 0 ? '+' : ''}{change}
                          </span>
                        )}
                        {change === 0 && qtyA >= 0 && qtyB >= 0 && (
                          <Minus size={10} className="text-gray-300" />
                        )}
                      </div>
                    </td>
                  ))}
                  <td className="text-center px-2 py-3 bg-starbucks-50/30" colSpan={2}>
                    <div className="flex items-center justify-center gap-1.5">
                      <span className="font-semibold text-gray-800 text-xs">{totalB}</span>
                      {totalChange !== 0 && (
                        <span className={`flex items-center text-[10px] font-bold ${totalChange > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                          {totalChange > 0 ? <ArrowUp size={10} /> : <ArrowDown size={10} />}
                          {totalChange > 0 ? '+' : ''}{totalChange}
                        </span>
                      )}
                      {totalChange === 0 && <Minus size={10} className="text-gray-300" />}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
