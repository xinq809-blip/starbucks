import { useState, useEffect, useMemo, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import { getAvailableWeeks, getWeekLabel } from '../data/mockData';
import { Save, Copy, Check, RotateCcw } from 'lucide-react';

const CAT_DOT_COLORS = [
  'bg-amber-400', 'bg-sky-400', 'bg-blue-400', 'bg-rose-400',
  'bg-orange-400', 'bg-emerald-400', 'bg-violet-400', 'bg-cyan-400',
  'bg-pink-400', 'bg-lime-400', 'bg-indigo-400', 'bg-teal-400',
];

function catColor(cat: string) {
  let h = 0;
  for (let i = 0; i < cat.length; i++) h = ((h << 5) - h + cat.charCodeAt(i)) | 0;
  return CAT_DOT_COLORS[Math.abs(h) % CAT_DOT_COLORS.length];
}

export default function DataEntry() {
  const { state, saveWeek } = useApp();
  const { products, distributors, snapshots } = state;

  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const availableWeeks = useMemo(() => getAvailableWeeks(snapshots), [snapshots]);

  const allWeeks = useMemo(() => {
    const ws = [...availableWeeks];
    if (!ws.includes(today)) ws.push(today);
    return ws.sort();
  }, [availableWeeks, today]);

  const [selectedWeek, setSelectedWeek] = useState(today);
  const [formData, setFormData] = useState<Record<string, number>>({});
  const [saved, setSaved] = useState(false);
  const [copying, setCopying] = useState(false);

  // Load form data from snapshots for selected date
  const loadWeek = useCallback((date: string) => {
    const data: Record<string, number> = {};
    for (const p of products) {
      for (const d of distributors) {
        const key = `${p.id}_${d.id}`;
        const sn = snapshots.find(
          (s) => s.weekStart === date && s.productId === p.id && s.distributorId === d.id
        );
        data[key] = sn ? sn.quantity : -1;
      }
    }
    setFormData(data);
    setSaved(false);
  }, [products, distributors, snapshots]);

  // Init form data for selected date
  useEffect(() => {
    loadWeek(selectedWeek);
  }, [selectedWeek, loadWeek]);

  const handleDateChange = (date: string) => {
    setSelectedWeek(date);
  };

  const handleInput = (productId: string, distributorId: string, value: string) => {
    const key = `${productId}_${distributorId}`;
    const num = value === '' ? -1 : parseInt(value, 10);
    setFormData((prev) => ({ ...prev, [key]: isNaN(num) ? -1 : num }));
  };

  const handleSave = () => {
    const entries = Object.entries(formData)
      .filter(([, qty]) => qty >= 0)
      .map(([key, qty]) => {
        const [productId, distributorId] = key.split('_');
        return { productId, distributorId, quantity: qty };
      });

    saveWeek(selectedWeek, entries);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  // Copy from previous week
  const handleCopyPrevWeek = () => {
    const idx = allWeeks.indexOf(selectedWeek);
    if (idx <= 0) return;
    setCopying(true);
    const prevWeek = allWeeks[idx - 1];
    const data: Record<string, number> = {};
    for (const p of products) {
      for (const d of distributors) {
        const key = `${p.id}_${d.id}`;
        const sn = snapshots.find(
          (s) => s.weekStart === prevWeek && s.productId === p.id && s.distributorId === d.id
        );
        data[key] = sn ? sn.quantity : -1;
      }
    }
    setFormData(data);
    setTimeout(() => setCopying(false), 600);
  };

  const handleReset = () => {
    loadWeek(selectedWeek);
  };

  const weekIndex = allWeeks.indexOf(selectedWeek);
  const enteredCount = Object.values(formData).filter((v) => v >= 0).length;
  const totalCells = products.length * distributors.length;
  const prevWeekStock = weekIndex > 0
    ? (() => {
        const prev = allWeeks[weekIndex - 1];
        const map: Record<string, number> = {};
        for (const p of products) {
          for (const d of distributors) {
            const key = `${p.id}_${d.id}`;
            const sn = snapshots.find((s) => s.weekStart === prev && s.productId === p.id && s.distributorId === d.id);
            map[key] = sn ? sn.quantity : -1;
          }
        }
        return map;
      })()
    : null;

  return (
    <div className="p-3 md:p-6 space-y-4 md:space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">库存录入</h1>
          <p className="text-sm text-gray-500 mt-0.5">盘点日期: {selectedWeek} · 已录入 {enteredCount}/{totalCells} 项</p>
        </div>
        <div className="flex items-center gap-2">
          {saved && (
            <span className="flex items-center gap-1 text-sm text-emerald-600 font-medium">
              <Check size={16} /> 已保存
            </span>
          )}
          <button
            onClick={handleSave}
            className="flex items-center gap-2 px-5 py-2.5 bg-starbucks-500 text-white rounded-lg text-sm font-medium hover:bg-starbucks-600 transition-colors"
          >
            <Save size={16} />
            保存
          </button>
        </div>
      </div>

      {/* Date Selector */}
      <div className="flex items-center gap-3 bg-white rounded-xl border border-gray-200 p-3 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">盘点日期:</span>
          <input
            type="date"
            value={selectedWeek}
            onChange={(e) => handleDateChange(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-starbucks-500/20"
          />
          <button onClick={() => handleDateChange(today)} className="px-2.5 py-1.5 text-xs font-medium text-starbucks-600 bg-starbucks-50 rounded-lg hover:bg-starbucks-100">今天</button>
          <span className="text-[11px] text-gray-400">
            {getWeekLabel(selectedWeek)}
          </span>
        </div>
        <div className="flex-1" />
        <div className="flex gap-1.5 flex-wrap">
          {/* Quick-select: last 5 entered dates */}
          {[...availableWeeks].reverse().slice(0, 5).map(w => (
            <button key={w} onClick={() => handleDateChange(w)}
              className={`px-2 py-1 rounded-md text-[11px] font-medium transition-all ${
                w === selectedWeek ? 'bg-starbucks-500 text-white' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
              }`}>
              {w.slice(5)}
            </button>
          ))}
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={handleCopyPrevWeek}
            disabled={weekIndex <= 0}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 transition-colors"
          >
            <Copy size={13} />
            {copying ? '已复制' : '复制上次数据'}
          </button>
          <button
            onClick={handleReset}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <RotateCcw size={13} />
            重置
          </button>
        </div>
      </div>

      {/* Entry Matrix */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-gray-50">
                <th className="text-left px-4 py-3 font-semibold text-gray-600 sticky left-0 bg-gray-50 z-10 border-b border-gray-200 min-w-[160px]">
                  产品
                </th>
                {distributors.map((d) => (
                  <th
                    key={d.id}
                    className="text-center px-3 py-3 font-semibold text-gray-600 border-b border-gray-200 min-w-[130px]"
                  >
                    <div>{d.name}</div>
                    <div className="text-[10px] font-normal text-gray-400">{d.region}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {products.map((p, pi) => (
                <tr key={p.id} className={pi % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'}>
                  <td className="px-4 py-2 sticky left-0 bg-inherit z-10">
                    <div className="flex items-center gap-2">
                      <span className={`w-1.5 h-1.5 rounded-full ${catColor(p.category)}`} />
                      <div>
                        <p className="font-medium text-gray-800 text-xs">{p.name}</p>
                        <p className="text-[10px] text-gray-400">{p.spec}</p>
                      </div>
                    </div>
                  </td>
                  {distributors.map((d) => {
                    const key = `${p.id}_${d.id}`;
                    const val = formData[key] ?? -1;
                    const prevVal = prevWeekStock?.[key];
                    const changed = prevVal !== undefined && prevVal >= 0 && val >= 0 && prevVal !== val;
                    const diff = changed ? val - prevVal! : 0;
                    return (
                      <td key={d.id} className="px-2 py-2 text-center">
                        <div className="relative inline-flex items-center">
                          <input
                            type="number"
                            min="0"
                            value={val >= 0 ? val : ''}
                            onChange={(e) => handleInput(p.id, d.id, e.target.value)}
                            placeholder="—"
                            className={`w-20 px-2 py-1.5 text-center text-sm rounded-lg border-2 focus:outline-none transition-colors ${
                              val < 0
                                ? 'border-dashed border-gray-200 text-gray-300 placeholder-gray-300'
                                : changed
                                ? 'border-amber-300 bg-amber-50/50 focus:border-starbucks-500 focus:ring-2 focus:ring-starbucks-500/20'
                                : 'border-gray-200 focus:border-starbucks-500 focus:ring-2 focus:ring-starbucks-500/20'
                            }`}
                          />
                          {changed && (
                            <span className={`absolute -top-1 -right-1 text-[9px] font-bold px-1 rounded ${
                              diff > 0 ? 'text-emerald-600 bg-emerald-50' : 'text-red-500 bg-red-50'
                            }`}>
                              {diff > 0 ? '+' : ''}{diff}
                            </span>
                          )}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Restock Entry */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <h2 className="text-base font-semibold text-gray-700 mb-3">补货入库记录</h2>
        <p className="text-xs text-gray-400 mb-3">记录本周各经销商的补货/入库数量，销售公式自动调整为：销量 = 上周库存 + 补货 − 本周库存</p>
        <RestockForm weekStart={selectedWeek} />
      </div>

      {/* Legend */}
      <div className="flex items-center gap-5 text-xs text-gray-500">
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded border-2 border-dashed border-gray-300" /> 未录入
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded border-2 border-amber-300 bg-amber-50/50" /> 较上周有变化
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded border-2 border-gray-200" /> 无变化
        </span>
        <span className="flex items-center gap-1">
          <span className="text-emerald-600 font-bold">+N</span> / <span className="text-red-500 font-bold">-N</span> 周环比增减
        </span>
      </div>
    </div>
  );
}

/** Inline restock entry form */
function RestockForm({ weekStart }: { weekStart: string }) {
  const { state, addRestock, deleteRestock } = useApp();
  const { products, distributors, restocks } = state;

  const weekRestocks = restocks.filter((r) => r.weekStart === weekStart);

  const [prodId, setProdId] = useState(products[0]?.id ?? '');
  const [distId, setDistId] = useState(distributors[0]?.id ?? '');
  const [qty, setQty] = useState('');

  const handleAddRestock = () => {
    const n = parseInt(qty, 10);
    if (!n || n <= 0) return;
    const id = 'R' + Date.now();
    addRestock({ id, date: new Date().toISOString().slice(0, 10), productId: prodId, distributorId: distId, quantity: n, weekStart });
    setQty('');
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 flex-wrap">
        <select value={prodId} onChange={(e) => setProdId(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-starbucks-500/20">
          {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <select value={distId} onChange={(e) => setDistId(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-starbucks-500/20">
          {distributors.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        <input type="number" min="1" value={qty} onChange={(e) => setQty(e.target.value)} placeholder="入库数量" className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm w-28 focus:outline-none focus:ring-2 focus:ring-starbucks-500/20" onKeyDown={(e) => e.key === 'Enter' && handleAddRestock()} />
        <button onClick={handleAddRestock} className="px-4 py-1.5 bg-starbucks-500 text-white rounded-lg text-sm font-medium hover:bg-starbucks-600 transition-colors">添加入库</button>
      </div>

      {weekRestocks.length > 0 && (
        <div className="max-h-[150px] overflow-y-auto scrollbar-thin">
          <table className="w-full text-xs">
            <thead><tr className="border-b border-gray-100 text-gray-400"><th className="text-left py-1">产品</th><th className="text-left py-1">经销商</th><th className="text-right py-1">数量</th><th className="text-right py-1">日期</th><th className="text-right py-1">操作</th></tr></thead>
            <tbody className="divide-y divide-gray-50">
              {weekRestocks.map((r) => {
                const p = products.find((x) => x.id === r.productId);
                const d = distributors.find((x) => x.id === r.distributorId);
                return (
                  <tr key={r.id}>
                    <td className="py-1 text-gray-700">{p?.name ?? r.productId}</td>
                    <td className="py-1 text-gray-500">{d?.name ?? r.distributorId}</td>
                    <td className="py-1 text-right font-medium text-gray-800">{r.quantity} 件</td>
                    <td className="py-1 text-right text-gray-400">{r.date}</td>
                    <td className="py-1 text-right"><button onClick={() => deleteRestock(r.id)} className="text-red-400 hover:text-red-600 text-[11px]">删除</button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
