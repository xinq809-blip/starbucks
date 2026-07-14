import { useState, useEffect, useMemo, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import { getAvailableWeeks, getWeekLabel } from '../data/mockData';
import { Save, Copy, Check, Search, ChevronLeft, ChevronRight } from 'lucide-react';

export default function DataEntry() {
  const { state, saveWeek } = useApp();
  const { products, distributors, snapshots } = state;
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const availableWeeks = useMemo(() => getAvailableWeeks(snapshots), [snapshots]);

  const allWeeks = useMemo(() => {
    const ws = [...availableWeeks];
    if (!ws.includes(today)) ws.push(today);
    return ws.sort().reverse();
  }, [availableWeeks, today]);

  const [selectedDate, setSelectedDate] = useState(today);
  const [activeDist, setActiveDist] = useState(distributors[0]?.id || '');
  const [formData, setFormData] = useState<Record<string, number>>({});
  const [saved, setSaved] = useState(false);
  const [search, setSearch] = useState('');
  const [quickFill, setQuickFill] = useState('');

  // Load data for selected date
  const loadDate = useCallback((date: string) => {
    const data: Record<string, number> = {};
    for (const p of products) {
      for (const d of distributors) {
        const key = `${p.id}_${d.id}`;
        const sn = snapshots.find(s => s.weekStart === date && s.productId === p.id && s.distributorId === d.id);
        data[key] = sn ? sn.quantity : -1;
      }
    }
    setFormData(data);
    setSaved(false);
  }, [products, distributors, snapshots]);

  useEffect(() => { loadDate(selectedDate); }, [selectedDate, loadDate]);

  const handleInput = (productId: string, value: string) => {
    const key = `${productId}_${activeDist}`;
    const num = value === '' ? -1 : parseInt(value, 10);
    setFormData(prev => ({ ...prev, [key]: isNaN(num) ? -1 : num }));
  };

  const getVal = (productId: string) => {
    const v = formData[`${productId}_${activeDist}`];
    return v !== undefined && v >= 0 ? v : '';
  };

  const handleSave = () => {
    const entries = Object.entries(formData)
      .filter(([, qty]) => qty >= 0)
      .map(([key, qty]) => { const [productId, distributorId] = key.split('_'); return { productId, distributorId, quantity: qty }; });
    saveWeek(selectedDate, entries);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  // Copy from previous date
  const handleCopyPrev = () => {
    const idx = allWeeks.indexOf(selectedDate);
    if (idx < 0 || idx >= allWeeks.length - 1) return;
    const prevDate = allWeeks[idx + 1];
    const data: Record<string, number> = {};
    for (const p of products) {
      for (const d of distributors) {
        const key = `${p.id}_${d.id}`;
        const sn = snapshots.find(s => s.weekStart === prevDate && s.productId === p.id && s.distributorId === d.id);
        data[key] = sn ? sn.quantity : -1;
      }
    }
    setFormData(data);
  };

  // Quick fill: set all products for active distributor
  const handleQuickFill = () => {
    const v = parseInt(quickFill);
    if (isNaN(v) || v < 0) return;
    setFormData(prev => {
      const next = { ...prev };
      for (const p of filteredProducts) next[`${p.id}_${activeDist}`] = v;
      return next;
    });
    setQuickFill('');
  };

  const filteredProducts = useMemo(() => {
    if (!search) return products;
    const q = search.toLowerCase();
    return products.filter(p => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q));
  }, [products, search]);

  // Previous date data for comparison
  const prevIdx = allWeeks.indexOf(selectedDate);
  const prevDate = prevIdx < allWeeks.length - 1 ? allWeeks[prevIdx + 1] : null;
  const prevData: Record<string, number> = {};
  if (prevDate) {
    for (const p of products) {
      for (const d of distributors) {
        const key = `${p.id}_${d.id}`;
        const sn = snapshots.find(s => s.weekStart === prevDate && s.productId === p.id && s.distributorId === d.id);
        prevData[key] = sn ? sn.quantity : -1;
      }
    }
  }

  const activeDistName = distributors.find(d => d.id === activeDist)?.name || '';
  const enteredCount = Object.values(formData).filter(v => v >= 0).length;
  const totalCells = products.length * distributors.length;

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">库存录入</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            {getWeekLabel(selectedDate)} · 已录入 {enteredCount}/{totalCells} 项
          </p>
        </div>
        <div className="flex items-center gap-2">
          {saved && <span className="flex items-center gap-1 text-sm text-emerald-600 font-medium"><Check size={16} />已保存</span>}
          <button onClick={handleSave} className="flex items-center gap-2 px-5 py-2.5 bg-gray-900 text-white rounded-xl text-sm font-medium hover:bg-gray-800 shadow-sm">
            <Save size={16} />保存
          </button>
        </div>
      </div>

      {/* Date selector + toolbar */}
      <div className="flex flex-wrap items-center gap-3 bg-white rounded-2xl border border-gray-100 shadow-sm p-3">
        <div className="flex items-center gap-2">
          <button onClick={() => { const idx = allWeeks.indexOf(selectedDate); if (idx > 0) setSelectedDate(allWeeks[idx - 1]); }}
            className="p-1.5 rounded-lg hover:bg-gray-100"><ChevronLeft size={16} /></button>
          <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm font-medium text-gray-700" />
          <button onClick={() => { const idx = allWeeks.indexOf(selectedDate); if (idx < allWeeks.length - 1) setSelectedDate(allWeeks[idx + 1]); }}
            className="p-1.5 rounded-lg hover:bg-gray-100"><ChevronRight size={16} /></button>
          <button onClick={() => setSelectedDate(today)} className="text-xs px-2.5 py-1.5 bg-gray-100 rounded-lg font-medium text-gray-600 hover:bg-gray-200">今天</button>
        </div>

        <div className="flex gap-1.5 flex-wrap">
          {availableWeeks.slice(0, 7).map(w => (
            <button key={w} onClick={() => setSelectedDate(w)}
              className={`px-2 py-1 rounded-md text-[11px] font-medium transition-all ${w === selectedDate ? 'bg-gray-900 text-white' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'}`}>
              {w.slice(5)}
            </button>
          ))}
        </div>

        <div className="flex-1" />

        <button onClick={handleCopyPrev} disabled={!prevDate}
          className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-30">
          <Copy size={13} />复制上次数据
        </button>
      </div>

      {/* Distributor tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
        {distributors.map(d => {
          const dCount = products.filter(p => formData[`${p.id}_${d.id}`] >= 0).length;
          return (
            <button key={d.id} onClick={() => setActiveDist(d.id)}
              className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                activeDist === d.id ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}>
              {d.name}
              <span className={`ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full ${activeDist === d.id ? 'bg-gray-100 text-gray-500' : 'bg-white/50 text-gray-400'}`}>
                {dCount}/{products.length}
              </span>
            </button>
          );
        })}
      </div>

      {/* Search + Quick fill */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="搜索产品..."
            className="pl-8 pr-3 py-1.5 border border-gray-200 rounded-lg text-sm w-full focus:outline-none focus:border-gray-400" />
        </div>
        <div className="flex items-center gap-1">
          <input type="number" min="0" value={quickFill} onChange={e => setQuickFill(e.target.value)}
            placeholder="批量填入" onKeyDown={e => e.key === 'Enter' && handleQuickFill()}
            className="w-24 border border-gray-200 rounded-lg px-2 py-1.5 text-sm" />
          <button onClick={handleQuickFill} className="px-3 py-1.5 text-xs bg-gray-100 rounded-lg font-medium text-gray-600 hover:bg-gray-200">批量</button>
        </div>
      </div>

      {/* Entry cards */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-50 bg-gray-50/30 flex items-center justify-between">
          <span className="text-xs font-semibold text-gray-500">{activeDistName} · 库存录入</span>
          <span className="text-[10px] text-gray-400">产品名 / 本次库存 / {prevDate ? '上次库存' : ''}</span>
        </div>

        <div className="divide-y divide-gray-50 max-h-[60vh] overflow-y-auto scrollbar-thin">
          {filteredProducts.map(p => {
            const key = `${p.id}_${activeDist}`;
            const val = getVal(p.id);
            const prevVal = prevData[key];
            const changed = prevVal >= 0 && val !== '' && prevVal !== (val as number);
            const diff = changed ? (val as number) - prevVal : 0;

            return (
              <div key={p.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50/30 transition-colors">
                {/* Product info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{p.name}</p>
                  <p className="text-[10px] text-gray-400">{p.spec} · {p.sku}</p>
                </div>

                {/* Previous value */}
                {prevDate && (
                  <div className="text-right text-xs text-gray-400 min-w-[50px]">
                    {prevVal >= 0 ? <span>{prevVal}</span> : <span className="text-gray-300">—</span>}
                  </div>
                )}

                {/* Arrow */}
                {prevDate && (
                  <span className="text-gray-300 text-xs">→</span>
                )}

                {/* Current input */}
                <div className="relative">
                  <input
                    type="number" min="0"
                    value={val}
                    onChange={e => handleInput(p.id, e.target.value)}
                    placeholder="0"
                    className={`w-20 px-3 py-2 text-center text-sm font-bold rounded-xl border-2 focus:outline-none transition-colors ${
                      changed
                        ? 'border-amber-300 bg-amber-50 text-amber-700 focus:border-amber-400'
                        : val !== '' ? 'border-gray-200 bg-white text-gray-800 focus:border-gray-900' : 'border-dashed border-gray-200 bg-gray-50 text-gray-300'
                    }`}
                  />
                  {changed && (
                    <span className={`absolute -top-1.5 -right-1.5 text-[9px] font-bold px-1 rounded-full ${diff > 0 ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-500'}`}>
                      {diff > 0 ? '+' : ''}{diff}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
