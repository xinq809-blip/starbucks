import { useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { getAvailableWeeks, getWeekLabel, getProductById, getCurrentWeekStart } from '../data/mockData';
import { TrendingUp, Package, DollarSign, Target } from 'lucide-react';

const FOCUS_IDS = ['p11', 'p20'];

export default function Overview() {
  const { state } = useApp();
  const { products, distributors, snapshots, restocks } = state;

  const weeks = useMemo(() => getAvailableWeeks(snapshots), [snapshots]);
  const activeDate = weeks.length > 0 ? weeks[weeks.length - 1] : getCurrentWeekStart();

  // 总经销商
  const mainDist = useMemo(() => {
    const m = distributors.find(d => d.role === 'main');
    return m || distributors.find(d => d.name.includes('辰日')) || distributors.find(d => d.region === '唐山') || distributors[0] || null;
  }, [distributors]);

  // 总经销自身ID — 数据来自录入时选择唐山辰日
  const mainId = mainDist?.id || '';

  const prevDate = weeks.length > 1 ? weeks[weeks.length - 2] : null;

  const totalRestock = (restocks || []).filter(r => r.distributorId === mainId).reduce((s, r) => s + r.quantity, 0);
  const curStock = snapshots.filter(s => s.weekStart === activeDate && s.distributorId === mainId).reduce((a, s) => a + s.quantity, 0);
  const prevStock = prevDate ? snapshots.filter(s => s.weekStart === prevDate && s.distributorId === mainId).reduce((a, s) => a + s.quantity, 0) : 0;
  const totalSales = Math.max(0, prevStock + totalRestock - curStock);
  const stockValue = snapshots.filter(s => s.weekStart === activeDate && s.distributorId === mainId).reduce((a, s) => {
    const p = products.find(x => x.id === s.productId);
    return a + s.quantity * (p?.unitPrice || 0);
  }, 0);

  // 重点产品（唐山辰日自身数据）
  const focusData = useMemo(() => FOCUS_IDS.map(pid => {
    const p = getProductById(pid);
    const stock = snapshots.filter(s => s.weekStart === activeDate && s.distributorId === mainId && s.productId === pid).reduce((a, s) => a + s.quantity, 0);
    const restock = (restocks || []).filter(r => r.distributorId === mainId && r.productId === pid).reduce((a, r) => a + r.quantity, 0);
    const prevS = prevDate ? snapshots.filter(s => s.weekStart === prevDate && s.distributorId === mainId && s.productId === pid).reduce((a, s) => a + s.quantity, 0) : 0;
    const sales = Math.max(0, prevS + restock - stock);
    return { name: p?.name || pid, stock, restock, sales };
  }), [mainId, activeDate, prevDate, snapshots, restocks]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      <div className="p-4 md:p-6 space-y-5 max-w-4xl mx-auto">

        <div>
          <h1 className="text-2xl font-bold text-gray-800">总看板</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            {mainDist?.name} 总经销商 · 最新盘点 {getWeekLabel(activeDate)}
          </p>
        </div>

        {/* 总经销 KPI */}
        {mainDist && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: '累计进货', value: totalRestock.toLocaleString() + ' 件', sub: '全部进货总量', icon: Package, color: 'text-blue-600', bg: 'bg-blue-50' },
                { label: '现有库存', value: curStock.toLocaleString() + ' 件', sub: getWeekLabel(activeDate), icon: Package, color: 'text-violet-600', bg: 'bg-violet-50' },
                { label: '累计出货', value: totalSales.toLocaleString() + ' 件', sub: prevDate ? `上次盘点 ${getWeekLabel(prevDate)}` : '首次盘点', icon: TrendingUp, color: 'text-emerald-600', bg: 'bg-emerald-50' },
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

            {/* 重点产品: 450黑咖啡 + 椰椰拿铁 */}
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
                      <p className="text-[10px] text-blue-400 mt-0.5">累计进货</p>
                    </div>
                    <div className="bg-violet-50 rounded-xl p-3">
                      <p className="text-xl font-bold text-violet-600">{f.stock.toLocaleString()}</p>
                      <p className="text-[10px] text-violet-400 mt-0.5">现有库存</p>
                    </div>
                    <div className="bg-emerald-50 rounded-xl p-3">
                      <p className="text-xl font-bold text-emerald-600">{f.sales.toLocaleString()}</p>
                      <p className="text-[10px] text-emerald-400 mt-0.5">累计出货</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
