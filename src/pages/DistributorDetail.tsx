import { useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { useApp } from '../context/AppContext';
import { getAvailableWeeks, getWeekLabel, getWeeklySales, getTotalStock } from '../data/mockData';

const STORAGE_KEY = 'sb_distributors_v2';

function getDist(id: string) {
  try {
    const r = localStorage.getItem(STORAGE_KEY);
    if (r) return (JSON.parse(r) as any[]).find((d: any) => d.id === id);
  } catch {}
  return null;
}

export default function DistributorDetail() {
  const { id } = useParams<{ id: string }>();
  const nav = useNavigate();
  const { state } = useApp();
  const { products, snapshots, restocks } = state;
  const dist = id ? getDist(id) : null;

  const weeks = useMemo(() => getAvailableWeeks(snapshots), [snapshots]);
  const currentWeek = weeks.length > 0 ? weeks[weeks.length - 1] : '';
  const hasData = weeks.length >= 2;

  const distData = useMemo(() => {
    if (!id || !hasData) return { products: [], trend: [], summary: null };

    const productList = products.map(p => {
      const curSnaps = snapshots.filter(s => s.weekStart === currentWeek && s.productId === p.id && s.distributorId === id);
      const curStock = curSnaps.reduce((a, s) => a + s.quantity, 0);
      const sales = getWeeklySales(snapshots, currentWeek, restocks).filter(r => r.distributorId === id && r.productId === p.id);
      const totalSales = sales.reduce((a, r) => a + Math.max(0, r.sales), 0);
      const value = totalSales * p.unitPrice;
      return { product: p, curStock, sales: totalSales, value, salesList: sales };
    }).filter(p => p.curStock > 0 || p.sales > 0);

    const trend = weeks.slice(1).map(w => {
      const ws = getWeeklySales(snapshots, w, restocks).filter(r => r.distributorId === id);
      return {
        week: getWeekLabel(w),
        sales: ws.reduce((a, r) => a + Math.max(0, r.sales), 0),
        stock: getTotalStock(snapshots.filter(s => s.distributorId === id), w),
      };
    });

    const totalSales = productList.reduce((a, p) => a + p.sales, 0);
    const totalValue = productList.reduce((a, p) => a + p.value, 0);
    const totalStock = snapshots.filter(s => s.weekStart === currentWeek && s.distributorId === id).reduce((a, s) => a + s.quantity, 0);

    const summary = { totalSales, totalValue, totalStock, productCount: productList.length };

    return { products: productList, trend, summary };
  }, [id, products, snapshots, restocks, currentWeek, weeks, hasData]);

  if (!dist) {
    return <div className="p-10 text-center text-gray-400">经销商不存在</div>;
  }

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-6xl mx-auto">
      {/* Back */}
      <button onClick={() => nav('/distributors')} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800">
        <ArrowLeft size={16} /> 返回经销商列表
      </button>

      {/* Header */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-starbucks-50 flex items-center justify-center text-2xl">
            👤
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-800">{dist.name}</h1>
            <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-500">
              {dist.region && <span>📍 {dist.region}</span>}
              {dist.phone && <span>📞 {dist.phone}</span>}
              {dist.address && <span>🏠 {dist.address}</span>}
            </div>
          </div>
        </div>
      </div>

      {/* KPIs */}
      {distData.summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            ['本周出货', distData.summary.totalSales + ' 件', '📦'],
            ['出货金额', '¥' + distData.summary.totalValue.toLocaleString(), '💰'],
            ['当前库存', distData.summary.totalStock + ' 件', '📋'],
            ['在售品种', distData.summary.productCount + ' SKU', '☕'],
          ].map(([l, v, icon]) => (
            <div key={l as string} className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm text-center">
              <p className="text-2xl mb-1">{icon}</p>
              <p className="text-xs text-gray-500">{l}</p>
              <p className="text-lg font-bold text-gray-800">{v as string}</p>
            </div>
          ))}
        </div>
      )}

      {!hasData ? (
        <div className="text-center py-16 text-gray-400">录入 2 周以上库存后显示分析数据</div>
      ) : (
        <>
          {/* Charts */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">各产品出货明细</h3>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={distData.products.slice(0, 12)} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f5" />
                  <XAxis type="number" tick={{ fontSize: 10 }} />
                  <YAxis dataKey="product.name" type="category" tick={{ fontSize: 10 }} width={130}
                    tickFormatter={(v: string) => v.length > 14 ? v.slice(0,13)+'…' : v} />
                  <Tooltip formatter={(v: any) => Number(v).toLocaleString()+' 件'} />
                  <Bar dataKey="sales" fill="#00704A" radius={[0, 3, 3, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">周出货趋势</h3>
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={distData.trend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f5" />
                  <XAxis dataKey="week" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip formatter={(v: any) => Number(v).toLocaleString()+' 件'} />
                  <Line type="monotone" dataKey="sales" stroke="#00704A" strokeWidth={2} dot={{ r: 4 }} name="出货" />
                  <Line type="monotone" dataKey="stock" stroke="#94a3b8" strokeWidth={2} dot={{ r: 4 }} strokeDasharray="5 5" name="库存" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Statement table */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-50">
              <h3 className="text-sm font-semibold text-gray-700">对账明细（{getWeekLabel(currentWeek)}）</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="bg-gray-50/50 border-b border-gray-100 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  <th className="text-left px-5 py-3">产品</th><th className="text-right px-5 py-3">出货量</th><th className="text-right px-5 py-3">单价</th><th className="text-right px-5 py-3">金额</th><th className="text-right px-5 py-3">当前库存</th>
                </tr></thead>
                <tbody className="divide-y divide-gray-50">
                  {distData.products.map(p => (
                    <tr key={p.product.id} className="hover:bg-gray-50/30">
                      <td className="px-5 py-3 text-gray-800 text-xs">{p.product.name}</td>
                      <td className="px-5 py-3 text-right font-medium text-gray-800">{p.sales}</td>
                      <td className="px-5 py-3 text-right text-gray-500">¥{p.product.unitPrice}</td>
                      <td className="px-5 py-3 text-right font-bold text-gray-800">¥{p.value.toLocaleString()}</td>
                      <td className="px-5 py-3 text-right text-gray-500">{p.curStock}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-gray-50/80 font-bold text-xs">
                    <td className="px-5 py-3 text-gray-700">合计</td>
                    <td className="px-5 py-3 text-right text-gray-800">{distData.summary?.totalSales} 件</td>
                    <td className="px-5 py-3"></td>
                    <td className="px-5 py-3 text-right text-gray-800">¥{distData.summary?.totalValue.toLocaleString()}</td>
                    <td className="px-5 py-3 text-right text-gray-800">{distData.summary?.totalStock} 件</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
