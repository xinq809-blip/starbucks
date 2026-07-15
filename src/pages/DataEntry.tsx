import { useState, useEffect, useMemo, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import { getAvailableWeeks } from '../data/mockData';
import { Save, Check, Search, Copy, Trash2 } from 'lucide-react';

export default function DataEntry() {
  const { state, saveWeek, addRestock, deleteRestock } = useApp();
  const { products, distributors, snapshots, restocks } = state;
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const availableWeeks = useMemo(() => getAvailableWeeks(snapshots), [snapshots]);

  // --- State ---
  const [selectedDate, setSelectedDate] = useState(today);
  const [activeDist, setActiveDist] = useState(distributors[0]?.id || '');
  const [search, setSearch] = useState('');
  const [saved, setSaved] = useState(false);

  // Form data: stock counts
  const [stockData, setStockData] = useState<Record<string, number>>({});
  // Restocks being entered this session: key = productId_distId, value = quantity
  const [restockInputs, setRestockInputs] = useState<Record<string, { val: string; added: number }>>({});

  // Load existing data for selected date
  const loadDate = useCallback((date: string) => {
    const sd: Record<string, number> = {};
    const ri: Record<string, { val: string; added: number }> = {};
    for (const p of products) {
      for (const d of distributors) {
        const key = `${p.id}_${d.id}`;
        const sn = snapshots.find(s => s.weekStart === date && s.productId === p.id && s.distributorId === d.id);
        sd[key] = sn ? sn.quantity : -1;
        // Sum existing restocks for this date+product+dist
        const existing = restocks.filter(r => r.date === date && r.productId === p.id && r.distributorId === d.id).reduce((s: number, r: any) => s + r.quantity, 0);
        ri[key] = { val: '', added: existing };
      }
    }
    setStockData(sd);
    setRestockInputs(ri);
    setSaved(false);
  }, [products, distributors, snapshots, restocks]);

  useEffect(() => { loadDate(selectedDate); }, [selectedDate, loadDate]);

  // Previous date for comparison
  const prevDate = availableWeeks.filter(w => w < selectedDate).sort().reverse()[0] || null;
  const prevStock: Record<string, number> = {};
  if (prevDate) {
    for (const p of products) for (const d of distributors) {
      const key = `${p.id}_${d.id}`;
      const sn = snapshots.find(s => s.weekStart === prevDate && s.productId === p.id && s.distributorId === d.id);
      prevStock[key] = sn ? sn.quantity : 0;
    }
  }

  const filtered = useMemo(() => {
    if (!search) return products;
    const q = search.toLowerCase();
    return products.filter(p => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q));
  }, [products, search]);

  // --- Handlers ---
  const getStock = (pid: string) => { const v = stockData[`${pid}_${activeDist}`]; return v >= 0 ? v : ''; };
  const getRestockVal = (pid: string) => restockInputs[`${pid}_${activeDist}`]?.val ?? '';
  const getRestockAdded = (pid: string) => restockInputs[`${pid}_${activeDist}`]?.added ?? 0;

  const setStock = (pid: string, v: string) => {
    const n = v === '' ? -1 : parseInt(v);
    setStockData(prev => ({ ...prev, [`${pid}_${activeDist}`]: isNaN(n) ? -1 : n }));
  };

  const setRestock = (pid: string, v: string) => {
    const key = `${pid}_${activeDist}`;
    setRestockInputs(prev => ({ ...prev, [key]: { ...prev[key], val: v } }));
  };

  const addOneRestock = (pid: string) => {
    const key = `${pid}_${activeDist}`;
    const n = parseInt(restockInputs[key]?.val || '');
    if (!n || n <= 0) return;
    addRestock({ id: 'R' + Date.now() + Math.random().toString(36), date: selectedDate, productId: pid, distributorId: activeDist, quantity: n, weekStart: selectedDate });
    setRestockInputs(prev => ({ ...prev, [key]: { val: '', added: (prev[key]?.added || 0) + n } }));
  };

  const removeOneRestock = (rid: string) => {
    const r = restocks.find(x => x.id === rid);
    if (r) {
      const key = `${r.productId}_${r.distributorId}`;
      setRestockInputs(prev => ({ ...prev, [key]: { ...prev[key], added: Math.max(0, (prev[key]?.added || 0) - r.quantity) } }));
    }
    deleteRestock(rid);
  };

  const handleSave = () => {
    const entries = Object.entries(stockData).filter(([, q]) => q >= 0).map(([k, q]) => { const [pid, did] = k.split('_'); return { productId: pid, distributorId: did, quantity: q }; });
    saveWeek(selectedDate, entries);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleCopyPrev = () => {
    if (!prevDate) return;
    const sd: Record<string, number> = {};
    for (const p of products) for (const d of distributors) {
      const key = `${p.id}_${d.id}`;
      const sn = snapshots.find(s => s.weekStart === prevDate && s.productId === p.id && s.distributorId === d.id);
      sd[key] = sn ? sn.quantity : -1;
    }
    setStockData(sd);
  };

  const overallPct = Math.round((Object.values(stockData).filter(v => v >= 0).length / (products.length * distributors.length)) * 100);
  const distProgress = distributors.map(d => ({ name: d.name, pct: Math.round((products.filter(p => stockData[`${p.id}_${d.id}`] >= 0).length / products.length) * 100) }));
  const activeDistName = distributors.find(d => d.id === activeDist)?.name || '';

  return (
    <div className="p-3 md:p-5 space-y-3 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-gray-800">库存+进货录入</h1>
          <p className="text-xs text-gray-400 mt-0.5">{selectedDate} · {activeDistName}</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden hidden sm:block"><div className={`h-full rounded-full ${overallPct===100?'bg-emerald-500':'bg-starbucks-500'}`} style={{width:`${overallPct}%`}} /></div>
          <span className="text-[11px] text-gray-500 hidden sm:inline">{overallPct}%</span>
          {saved && <span className="text-xs text-emerald-600"><Check size={14} className="inline mr-0.5" />已保存</span>}
          <button onClick={handleSave} className="px-4 py-2 bg-gray-900 text-white rounded-xl text-sm font-medium hover:bg-gray-800"><Save size={14} className="inline mr-1" />保存库存</button>
        </div>
      </div>

      {/* Date + toolbar */}
      <div className="flex flex-wrap items-center gap-2 bg-white rounded-xl border border-gray-100 shadow-sm px-3 py-2">
        <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs font-medium" />
        <div className="flex gap-0.5">{availableWeeks.filter(w => w >= '2026-05').slice(0, 5).map(w => <button key={w} onClick={() => setSelectedDate(w)} className={`px-1.5 py-1 rounded text-[10px] font-medium ${w===selectedDate?'bg-gray-900 text-white':'bg-gray-50 text-gray-600'}`}>{w.slice(5)}</button>)}</div>
        <div className="flex-1" />
        <button onClick={handleCopyPrev} disabled={!prevDate} className="text-[10px] px-2 py-1 border border-gray-200 rounded-lg text-gray-500 hover:bg-gray-50 disabled:opacity-30"><Copy size={11} className="inline mr-0.5" />复制上次库存</button>
      </div>

      {/* Distributor tabs */}
      <div className="flex gap-1.5">
        {distributors.map(d => { const p = distProgress.find(dp=>dp.name===d.name); return (
          <button key={d.id} onClick={()=>setActiveDist(d.id)} className={`flex-1 px-3 py-2 rounded-xl text-xs font-medium text-left transition-all ${activeDist===d.id?'bg-white border border-gray-200 shadow-sm':'bg-white/60 border border-transparent text-gray-500 hover:bg-white'}`}>
            <div className="flex justify-between"><span>{d.name}</span><span className={p?.pct===100?'text-emerald-600':'text-gray-400'}>{p?.pct}%</span></div>
          </button>
        )})}
      </div>

      {/* Search */}
      <div className="relative"><Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" /><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="搜索产品..." className="pl-8 pr-3 py-1.5 border border-gray-200 rounded-lg text-xs w-full max-w-[220px] focus:outline-none" /></div>

      {/* Entry table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {/* Column headers */}
        <div className="grid grid-cols-12 gap-2 px-4 py-2 bg-gray-50/30 border-b border-gray-100 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
          <div className="col-span-4">产品</div>
          <div className="col-span-2 text-center">{prevDate ? `上次(${prevDate.slice(5)})` : '期初'}</div>
          <div className="col-span-2 text-center">进货</div>
          <div className="col-span-2 text-center">本次库存</div>
          <div className="col-span-2 text-center">预估销量</div>
        </div>

        <div className="divide-y divide-gray-50 max-h-[55vh] overflow-y-auto scrollbar-thin">
          {filtered.map(p => {
            const key = `${p.id}_${activeDist}`;
            const prev = prevStock[key] || 0;
            const curr = getStock(p.id);
            const currNum = curr === '' ? 0 : (curr as number);
            const restockAdded = getRestockAdded(p.id);
            const restockVal = getRestockVal(p.id);
            // Sales estimate: prev + restock - curr
            const sales = Math.max(0, prev + restockAdded - currNum);
            const changed = prev !== currNum;

            // Existing restocks for this product+dist+date

            return (
              <div key={p.id} className="grid grid-cols-12 gap-2 px-4 py-2 items-center hover:bg-gray-50/30">
                {/* Product name */}
                <div className="col-span-4 min-w-0">
                  <p className="text-xs font-medium text-gray-800 truncate">{p.name}</p>
                  <p className="text-[9px] text-gray-400">{p.spec}</p>
                </div>

                {/* Prev stock */}
                <div className="col-span-2 text-center text-xs text-gray-400">{prev}</div>

                {/* Restock input + badge */}
                <div className="col-span-2 flex items-center justify-center gap-1">
                  <div className="relative">
                    <input type="number" min="0" value={restockVal} onChange={e => setRestock(p.id, e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') addOneRestock(p.id); }}
                      placeholder="0" className="w-14 text-center border border-dashed border-amber-200 rounded-lg px-1 py-1 text-xs focus:outline-none focus:border-amber-400 focus:bg-amber-50/20" />
                    {restockVal && parseInt(restockVal) > 0 && (
                      <button onClick={() => addOneRestock(p.id)} className="absolute -right-5 top-1/2 -translate-y-1/2 text-[10px] text-amber-600 font-bold">+</button>
                    )}
                  </div>
                  {restockAdded > 0 && <span className="text-[10px] text-amber-700 font-bold bg-amber-50 px-1 rounded">+{restockAdded}</span>}
                </div>

                {/* Current stock */}
                <div className="col-span-2 flex justify-center">
                  <input type="number" min="0" value={curr} onChange={e => setStock(p.id, e.target.value)}
                    placeholder="0" className={`w-16 text-center text-sm font-bold rounded-lg border-2 px-2 py-1.5 focus:outline-none ${changed && curr !== '' ? 'border-amber-300 bg-amber-50 text-amber-700' : curr !== '' ? 'border-gray-200 bg-white text-gray-800' : 'border-dashed border-gray-200 text-gray-300'}`} />
                </div>

                {/* Sales estimate */}
                <div className="col-span-2 text-center">
                  <span className={`text-xs font-bold ${sales > 0 ? 'text-emerald-600' : 'text-gray-300'}`}>{sales > 0 ? sales : '—'}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Existing restocks summary */}
      {restocks.filter(r => r.date === selectedDate && r.distributorId === activeDist).length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-4 py-2 bg-amber-50/50 border-b border-gray-50 text-xs font-semibold text-gray-700">
            今日进货明细 · {selectedDate} · {activeDistName}
          </div>
          <div className="flex flex-wrap gap-1.5 p-3">
            {restocks.filter(r => r.date === selectedDate && r.distributorId === activeDist).map((r: any) => {
              const p = products.find((x: any) => x.id === r.productId);
              return (
                <div key={r.id} className="flex items-center gap-1.5 bg-gray-50 rounded-lg px-2.5 py-1.5 text-xs group">
                  <span className="font-medium text-gray-700 max-w-[100px] truncate">{p?.name || r.productId}</span>
                  <span className="font-bold text-amber-700">×{r.quantity}</span>
                  <button onClick={() => removeOneRestock(r.id)} className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100"><Trash2 size={11} /></button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
