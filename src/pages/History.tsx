import { useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { getAvailableWeeks, getCurrentWeekStart } from '../data/mockData';
import { TrendingUp, Package, Truck } from 'lucide-react';

const GROUPS = [
  { label: '星选系列4味合计', ids: ['p03','p04','p05','p06'] },
  { label: 'P450 黑咖啡', ids: ['p11'] },
  { label: 'P270 椰椰拿铁', ids: ['p20'] },
  { label: '其余产品', ids: ['p01','p02','p07','p08','p09','p10','p12','p13','p14','p15','p16','p17','p18','p19','p21','p22'] },
];

export default function DataOverview() {
  const { state } = useApp();
  const { distributors, snapshots, restocks } = state;

  const weeks = useMemo(() => getAvailableWeeks(snapshots), [snapshots]);
  const activeDate = weeks.length > 0 ? weeks[weeks.length - 1] : getCurrentWeekStart();

  // Only sub-distributors
  const subs = useMemo(() =>
    distributors.filter(d => d.role !== 'main' && !d.name.includes('辰日'))
  , [distributors]);

  // Per group per distributor: stock, restock, sales
  const data = useMemo(() => GROUPS.map(g => {
    const distRows = subs.map(d => {
      let stock = 0, restock = 0;
      for (const pid of g.ids) {
        stock += snapshots.filter(s => s.weekStart === activeDate && s.distributorId === d.id && s.productId === pid).reduce((a, s) => a + s.quantity, 0);
        restock += (restocks || []).filter(r => r.distributorId === d.id && r.productId === pid).reduce((a, r) => a + r.quantity, 0);
      }
      const sales = Math.max(0, restock - stock);
      return { name: d.name, stock, restock, sales };
    });
    const total = distRows.reduce((a, r) => ({ stock: a.stock + r.stock, restock: a.restock + r.restock, sales: a.sales + r.sales }), { stock: 0, restock: 0, sales: 0 });
    return { group: g.label, distRows, total };
  }), [subs, activeDate, snapshots, restocks]);

  return (
    <div className="p-3 md:p-6 space-y-4">
      <div>
        <h1 className="text-xl md:text-2xl font-bold text-gray-800">数据总览</h1>
        <p className="text-xs text-gray-400 mt-0.5">
          最新盘点 {activeDate} · {subs.length} 家分销商
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/30 text-gray-500">
                <th className="text-left px-5 py-2.5 font-medium">产品分组</th>
                {subs.map(d => (
                  <th key={d.id} className="text-right px-2 py-2.5 font-medium" colSpan={3}>{d.name}</th>
                ))}
                <th className="text-right px-2 py-2.5 font-medium text-starbucks-600" colSpan={3}>合计</th>
              </tr>
              <tr className="border-b border-gray-100 text-gray-400 text-[10px]">
                <th className="text-left px-5 py-1.5" />
                {subs.map(d => (
                  <th key={d.id} colSpan={3} className="text-center px-1 py-1.5">
                    <span className="inline-flex gap-2">
                      <span className="flex items-center gap-0.5"><Truck size={9} />进货</span>
                      <span className="flex items-center gap-0.5"><Package size={9} />库存</span>
                      <span className="flex items-center gap-0.5"><TrendingUp size={9} />出货</span>
                    </span>
                  </th>
                ))}
                <th colSpan={3} className="text-center px-1 py-1.5">
                  <span className="inline-flex gap-2 text-starbucks-600 font-bold">
                    <span>进货</span><span>库存</span><span>出货</span>
                  </span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {data.map(row => (
                <tr key={row.group} className="hover:bg-gray-50/30">
                  <td className="px-5 py-3 font-bold text-gray-800">{row.group}</td>
                  {row.distRows.map(d => (
                    <td key={d.name} colSpan={3} className="px-0 py-3">
                      <div className="grid grid-cols-3 gap-0 text-center text-[11px]">
                        <span className="text-gray-500">{d.restock > 0 ? d.restock.toLocaleString() : '—'}</span>
                        <span className="text-gray-600 font-medium">{d.stock > 0 ? d.stock.toLocaleString() : '—'}</span>
                        <span className={`font-bold ${d.sales > 0 ? 'text-emerald-600' : 'text-gray-300'}`}>{d.sales > 0 ? d.sales.toLocaleString() : '—'}</span>
                      </div>
                    </td>
                  ))}
                  <td colSpan={3} className="px-0 py-3 bg-starbucks-50/30">
                    <div className="grid grid-cols-3 gap-0 text-center text-[11px] font-bold">
                      <span className="text-blue-600">{row.total.restock.toLocaleString()}</span>
                      <span className="text-violet-700">{row.total.stock.toLocaleString()}</span>
                      <span className="text-emerald-600">{row.total.sales.toLocaleString()}</span>
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
