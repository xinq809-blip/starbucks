import { useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import { getLatestWeek, getWeekLabel } from '../data/mockData';
import { Coffee, Search } from 'lucide-react';

const CATEGORY_PALETTE = [
  'bg-amber-50 text-amber-700 border-amber-200',
  'bg-sky-50 text-sky-700 border-sky-200',
  'bg-blue-50 text-blue-700 border-blue-200',
  'bg-rose-50 text-rose-700 border-rose-200',
  'bg-orange-50 text-orange-700 border-orange-200',
  'bg-emerald-50 text-emerald-700 border-emerald-200',
  'bg-violet-50 text-violet-700 border-violet-200',
  'bg-cyan-50 text-cyan-700 border-cyan-200',
  'bg-pink-50 text-pink-700 border-pink-200',
  'bg-lime-50 text-lime-700 border-lime-200',
  'bg-indigo-50 text-indigo-700 border-indigo-200',
  'bg-teal-50 text-teal-700 border-teal-200',
];

function getCategoryColor(category: string): string {
  let hash = 0;
  for (let i = 0; i < category.length; i++) hash = ((hash << 5) - hash + category.charCodeAt(i)) | 0;
  return CATEGORY_PALETTE[Math.abs(hash) % CATEGORY_PALETTE.length];
}

export default function Products() {
  const { state } = useApp();
  const { products, distributors, snapshots } = state;
  const [search, setSearch] = useState('');

  const latestWeek = useMemo(() => getLatestWeek(snapshots), [snapshots]);
  const latestData = useMemo(
    () => snapshots.filter((s) => s.weekStart === latestWeek),
    [snapshots, latestWeek]
  );

  const productStats = useMemo(() => {
    return products
      .filter((p) => {
        if (!search) return true;
        return p.name.toLowerCase().includes(search.toLowerCase()) || p.sku.toLowerCase().includes(search.toLowerCase());
      })
      .map((p) => {
        const totalStock = latestData
          .filter((s) => s.productId === p.id)
          .reduce((a, s) => a + s.quantity, 0);
        const byDist = distributors.map((d) => {
          const s = latestData.find((sn) => sn.productId === p.id && sn.distributorId === d.id);
          return { name: d.name, qty: s ? s.quantity : -1 };
        });
        return { product: p, totalStock, byDist };
      });
  }, [products, latestData, distributors, search]);

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">产品目录</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            最新盘点 {getWeekLabel(latestWeek)} · {products.length} 款产品
          </p>
        </div>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
        <input
          type="text"
          placeholder="搜索产品..."
          className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-starbucks-500/20 focus:border-starbucks-500"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
        {productStats.map(({ product: p, totalStock, byDist }) => (
          <div key={p.id} className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md transition-shadow">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-10 h-10 rounded-lg bg-starbucks-50 flex items-center justify-center flex-shrink-0">
                <Coffee className="text-starbucks-500" size={18} />
              </div>
              <div>
                <h3 className="font-semibold text-gray-800 text-sm">{p.name}</h3>
                <p className="text-xs text-gray-400">{p.sku} · {p.spec}</p>
              </div>
            </div>

            <span className={`inline-block px-2 py-0.5 rounded-full text-xs border mb-3 ${getCategoryColor(p.category)}`}>
              {p.category}
            </span>

            <div className="flex items-center justify-between py-2 border-t border-gray-100 mb-2">
              <span className="text-xs text-gray-500">总库存</span>
              <span className="text-lg font-bold text-gray-800">{totalStock} <span className="text-xs font-normal text-gray-400">件</span></span>
            </div>

            <div className="space-y-1">
              {byDist.map(({ name, qty }) => (
                <div key={name} className="flex items-center justify-between text-xs">
                  <span className="text-gray-400">{name}</span>
                  <span className={`font-medium ${qty < 30 && qty >= 0 ? 'text-amber-600' : 'text-gray-600'}`}>
                    {qty >= 0 ? qty.toLocaleString() : '—'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
