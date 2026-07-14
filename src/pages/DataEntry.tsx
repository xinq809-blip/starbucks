import { useState, useEffect, useMemo, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import { getAvailableWeeks, getWeekLabel } from '../data/mockData';
import { Save, Copy, Check, Search, ChevronLeft, ChevronRight } from 'lucide-react';

export default function DataEntry() {
  const { state, saveWeek, addRestock } = useApp();
  const { products, distributors, snapshots, restocks } = state;
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
  const [restockQty, setRestockQty] = useState<Record<string, number>>({});

  // Load data for selected date
  const loadDate = useCallback((date: string) => {
    const data: Record<string, number> = {};
    const rs: Record<string, number> = {};
    for (const p of products) {
      for (const d of distributors) {
        const key = `${p.id}_${d.id}`;
        const sn = snapshots.find(s => s.weekStart === date && s.productId === p.id && s.distributorId === d.id);
        data[key] = sn ? sn.quantity : -1;
        rs[key] = 0;
      }
    }
    setFormData(data);
    setRestockQty(rs);
    setSaved(false);
  }, [products, distributors, snapshots]);

  useEffect(() => { loadDate(selectedDate); }, [selectedDate, loadDate]);

  const getVal = (productId: string) => {
    const v = formData[`${productId}_${activeDist}`];
    return v !== undefined && v >= 0 ? v : '';
  };

  const getRestockVal = (productId: string) => {
    return restockQty[`${productId}_${activeDist}`] || '';
  };

  const handleSave = () => {
    const entries = Object.entries(formData)
      .filter(([, qty]) => qty >= 0)
      .map(([key, qty]) => { const [productId, distributorId] = key.split('_'); return { productId, distributorId, quantity: qty }; });
    saveWeek(selectedDate, entries);

    // Save restocks
    for (const [key, qty] of Object.entries(restockQty)) {
      if (qty > 0) {
        const [productId, distributorId] = key.split('_');
        addRestock({ id: 'R' + Date.now() + Math.random().toString(36), date: selectedDate, productId, distributorId, quantity: qty as number, weekStart: selectedDate });
      }
    }
    // Clear restock inputs after save
    const rs: Record<string, number> = {};
    for (const k of Object.keys(restockQty)) rs[k] = 0;
    setRestockQty(rs);
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

  const handleQuickFill = () => {
    const v = parseInt((document.getElementById('quickFillInput') as HTMLInputElement)?.value || '');
    if (isNaN(v) || v < 0) return;
    setFormData(prev => {
      const next = { ...prev };
      for (const p of filteredProducts) next[`${p.id}_${activeDist}`] = v;
      return next;
    });
  };

  const filteredProducts = useMemo(() => {
    if (!search) return products;
    const q = search.toLowerCase();
    return products.filter(p => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q));
  }, [products, search]);

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

  const totalCells = products.length * distributors.length;
  const overallPct = Math.round((Object.values(formData).filter(v => v >= 0).length / totalCells) * 100);
  const distProgress = distributors.map(d => {
    const done = products.filter(p => formData[`${p.id}_${d.id}`] >= 0).length;
    return { name: d.name, done, total: products.length, pct: Math.round((done / products.length) * 100) };
  });

  // This week's restocks for display
  const weekRestocks = restocks.filter((r: any) => r.weekStart === selectedDate);
  const distRestockTotal = distributors.map((d: any) => ({
    name: d.name,
    total: weekRestocks.filter((r: any) => r.distributorId === d.id).reduce((s: number, r: any) => s + r.quantity, 0),
  }));

  return (
    <div className="p-3 md:p-5 space-y-4 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-gray-800">库存录入</h1>
          <p className="text-xs text-gray-400 mt-0.5">{getWeekLabel(selectedDate)}</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="hidden sm:flex items-center gap-1.5">
            <div className="w-20 h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div className={`h-full rounded-full ${overallPct === 100 ? 'bg-emerald-500' : 'bg-starbucks-500'}`} style={{ width: `${overallPct}%` }} />
            </div>
            <span className="text-[11px] text-gray-500 font-medium">{overallPct}%</span>
          </div>
          {saved && <span className="text-xs text-emerald-600 font-medium flex items-center gap-1"><Check size={14} />已保存</span>}
          <button onClick={handleSave} className="flex items-center gap-1.5 px-4 py-2 bg-gray-900 text-white rounded-xl text-sm font-medium hover:bg-gray-800 shadow-sm">
            <Save size={15} />保存
          </button>
        </div>
      </div>

      {/* Date selector */}
      <div className="flex flex-wrap items-center gap-2 bg-white rounded-xl border border-gray-100 shadow-sm p-2.5">
        <div className="flex items-center gap-1.5">
          <button onClick={() => { const idx = allWeeks.indexOf(selectedDate); if (idx > 0) setSelectedDate(allWeeks[idx - 1]); }}
            className="p-1 rounded-lg hover:bg-gray-100"><ChevronLeft size={15} /></button>
          <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)}
            className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs font-medium" />
          <button onClick={() => { const idx = allWeeks.indexOf(selectedDate); if (idx < allWeeks.length - 1) setSelectedDate(allWeeks[idx + 1]); }}
            className="p-1 rounded-lg hover:bg-gray-100"><ChevronRight size={15} /></button>
          <button onClick={() => setSelectedDate(today)} className="text-[11px] px-2 py-1.5 bg-gray-100 rounded-lg font-medium text-gray-600 hover:bg-gray-200">今天</button>
        </div>
        <div className="flex gap-1 flex-wrap">
          {availableWeeks.slice(0, 5).map(w => (
            <button key={w} onClick={() => setSelectedDate(w)}
              className={`px-2 py-1 rounded-md text-[10px] font-medium ${w === selectedDate ? 'bg-gray-900 text-white' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'}`}>{w.slice(5)}</button>
          ))}
        </div>
        <div className="flex-1" />
        <button onClick={handleCopyPrev} disabled={!prevDate}
          className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-medium text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-30"><Copy size={12} />复制上次</button>
      </div>

      {/* Distributor tabs */}
      <div className="flex gap-1.5">
        {distributors.map(d => {
          const prog = distProgress.find(dp => dp.name === d.name);
          return (
            <button key={d.id} onClick={() => setActiveDist(d.id)}
              className={`flex-1 px-3 py-2 rounded-xl text-xs font-medium transition-all text-left ${
                activeDist === d.id ? 'bg-white border border-gray-200 shadow-sm' : 'bg-white/60 border border-transparent text-gray-500 hover:bg-white'
              }`}>
              <div className="flex justify-between mb-1">
                <span>{d.name}</span>
                <span className={prog?.pct === 100 ? 'text-emerald-600' : 'text-gray-400'}>{prog?.pct}%</span>
              </div>
              <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
                <div className={`h-full rounded-full ${prog?.pct === 100 ? 'bg-emerald-500' : 'bg-starbucks-500'}`} style={{ width: `${prog?.pct || 0}%` }} />
              </div>
            </button>
          );
        })}
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-[200px]">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-300" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="搜索..."
            className="pl-7 pr-2.5 py-1.5 border border-gray-200 rounded-lg text-xs w-full focus:outline-none focus:border-gray-400" />
        </div>
        <input id="quickFillInput" type="number" min="0" placeholder="批量填"
          onKeyDown={e => e.key === 'Enter' && handleQuickFill()}
          className="w-20 border border-gray-200 rounded-lg px-2 py-1.5 text-xs" />
        <button onClick={handleQuickFill} className="px-2.5 py-1.5 text-[11px] bg-gray-100 rounded-lg font-medium text-gray-600 hover:bg-gray-200">批量</button>
        {/* Show existing restocks */}
        {weekRestocks.length > 0 && (
          <div className="flex-1 text-right text-[10px] text-gray-400">
            已录 {weekRestocks.length} 笔进货 ·
            {distRestockTotal.filter((d: any) => d.total > 0).map((d: any) => (
              <span key={d.name} className="ml-1.5">{d.name} <b className="text-gray-600">{d.total}</b>件</span>
            ))}
          </div>
        )}
      </div>

      {/* Entry list */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="grid grid-cols-12 gap-2 px-4 py-2.5 border-b border-gray-50 bg-gray-50/30 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
          <div className="col-span-5">产品</div>
          <div className="col-span-2 text-center">上周</div>
          <div className="col-span-2 text-center">进货</div>
          <div className="col-span-3 text-center">本次库存</div>
        </div>

        <div className="divide-y divide-gray-50 max-h-[55vh] overflow-y-auto scrollbar-thin">
          {filteredProducts.map(p => {
            const key = `${p.id}_${activeDist}`;
            const val = getVal(p.id);
            const prevVal = prevData[key];
            const changed = prevVal >= 0 && val !== '' && prevVal !== (val as number);
            const diff = changed ? (val as number) - prevVal : 0;

            // Get existing restocks for this product+dist
            const existingRestocks = weekRestocks.filter((r: any) => r.productId === p.id && r.distributorId === activeDist);
            const existingTotal = existingRestocks.reduce((s: number, r: any) => s + r.quantity, 0);

            return (
              <div key={p.id} className="grid grid-cols-12 gap-2 px-4 py-2.5 items-center hover:bg-gray-50/30 transition-colors group">
                {/* Product */}
                <div className="col-span-5 min-w-0">
                  <p className="text-xs font-medium text-gray-800 truncate">{p.name}</p>
                  <p className="text-[9px] text-gray-400">{p.spec}</p>
                </div>

                {/* Last stock */}
                <div className="col-span-2 text-center">
                  {prevDate && prevVal >= 0 ? (
                    <span className="text-xs text-gray-400">{prevVal}</span>
                  ) : (
                    <span className="text-[10px] text-gray-300">—</span>
                  )}
                </div>

                {/* Restock */}
                <div className="col-span-2 flex items-center justify-center gap-1">
                  <input
                    type="number" min="0"
                    value={getRestockVal(p.id)}
                    onChange={e => {
                      const n = parseInt(e.target.value) || 0;
                      setRestockQty(prev => ({ ...prev, [key]: n }));
                    }}
                    placeholder="0"
                    className="w-14 text-center border border-dashed border-gray-200 rounded-lg px-1 py-1.5 text-xs focus:outline-none focus:border-amber-400 focus:bg-amber-50/30"
                  />
                  {/* Existing restock badge */}
                  {existingTotal > 0 && (
                    <span className="text-[9px] text-amber-600 font-medium bg-amber-50 px-1 rounded" title="已录进货">
                      +{existingTotal}
                    </span>
                  )}
                </div>

                {/* Current stock */}
                <div className="col-span-3 flex justify-center">
                  <div className="relative">
                    <input
                      type="number" min="0"
                      value={val}
                      onChange={e => {
                        const v = e.target.value;
                        const num = v === '' ? -1 : parseInt(v);
                        setFormData(prev => ({ ...prev, [key]: isNaN(num) ? -1 : num }));
                      }}
                      placeholder="0"
                      className={`w-16 text-center text-sm font-bold rounded-lg border-2 px-2 py-1.5 focus:outline-none transition-colors ${
                        changed
                          ? 'border-amber-300 bg-amber-50 text-amber-700 focus:border-amber-400'
                          : val !== '' ? 'border-gray-200 bg-white text-gray-800 focus:border-gray-400' : 'border-dashed border-gray-200 text-gray-300'
                      }`}
                    />
                    {changed && (
                      <span className={`absolute -top-1.5 -right-2 text-[9px] font-bold px-1 rounded-full ${diff > 0 ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-500'}`}>
                        {diff > 0 ? '+' : ''}{diff}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
