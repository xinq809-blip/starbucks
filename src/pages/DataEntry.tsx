import { useState, useEffect, useMemo, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import { getAvailableWeeks } from '../data/mockData';
import { Save, Copy, Check, Search, Plus, Trash2, Package, Truck } from 'lucide-react';

type Mode = 'stock' | 'restock';

export default function DataEntry() {
  const [mode, setMode] = useState<Mode>('stock');
  return (
    <div className="p-3 md:p-5 space-y-4 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-xl md:text-2xl font-bold text-gray-800">数据录入</h1>
        <div className="flex bg-gray-100 rounded-xl p-1">
          {([
            ['stock', '库存盘点', Package],
            ['restock', '进货录入', Truck],
          ] as [Mode, string, any][]).map(([m, label, Icon]) => (
            <button key={m} onClick={() => setMode(m)} className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${mode === m ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
              <Icon size={15} />{label}
            </button>
          ))}
        </div>
      </div>
      {mode === 'stock' ? <StockEntry /> : <RestockEntry />}
    </div>
  );
}

/* ==================== 库存盘点 ==================== */
function StockEntry() {
  const { state, saveWeek } = useApp();
  const { products, distributors, snapshots } = state;
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const availableWeeks = useMemo(() => getAvailableWeeks(snapshots), [snapshots]);
  const allWeeks = useMemo(() => { const ws = [...availableWeeks]; if (!ws.includes(today)) ws.push(today); return ws.sort().reverse(); }, [availableWeeks, today]);

  const [selectedDate, setSelectedDate] = useState(today);
  const [activeDist, setActiveDist] = useState(distributors[0]?.id || '');
  const [formData, setFormData] = useState<Record<string, number>>({});
  const [saved, setSaved] = useState(false);
  const [search, setSearch] = useState('');
  const [expandedCat, setExpandedCat] = useState<string | null>(null);

  const loadDate = useCallback((date: string) => {
    const data: Record<string, number> = {};
    for (const p of products) for (const d of distributors) {
      const key = `${p.id}_${d.id}`;
      const sn = snapshots.find(s => s.weekStart === date && s.productId === p.id && s.distributorId === d.id);
      data[key] = sn ? sn.quantity : -1;
    }
    setFormData(data); setSaved(false);
  }, [products, distributors, snapshots]);

  useEffect(() => { loadDate(selectedDate); }, [selectedDate, loadDate]);

  const getVal = (pid: string) => { const v = formData[`${pid}_${activeDist}`]; return v >= 0 ? v : ''; };

  const handleSave = () => {
    const entries = Object.entries(formData).filter(([, q]) => q >= 0).map(([k, q]) => { const [pid, did] = k.split('_'); return { productId: pid, distributorId: did, quantity: q }; });
    saveWeek(selectedDate, entries);
    setSaved(true); setTimeout(() => setSaved(false), 2000);
  };

  const handleCopyPrev = () => {
    const idx = allWeeks.indexOf(selectedDate);
    if (idx < 0 || idx >= allWeeks.length - 1) return;
    const prevDate = allWeeks[idx + 1];
    const data: Record<string, number> = {};
    for (const p of products) for (const d of distributors) {
      const key = `${p.id}_${d.id}`;
      const sn = snapshots.find(s => s.weekStart === prevDate && s.productId === p.id && s.distributorId === d.id);
      data[key] = sn ? sn.quantity : -1;
    }
    setFormData(data);
  };

  const filtered = useMemo(() => {
    if (!search) return products;
    const q = search.toLowerCase();
    return products.filter(p => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q));
  }, [products, search]);

  const prevIdx = allWeeks.indexOf(selectedDate);
  const prevDate = prevIdx < allWeeks.length - 1 ? allWeeks[prevIdx + 1] : null;
  const prevData: Record<string, number> = {};
  if (prevDate) for (const p of products) for (const d of distributors) {
    const key = `${p.id}_${d.id}`;
    const sn = snapshots.find(s => s.weekStart === prevDate && s.productId === p.id && s.distributorId === d.id);
    prevData[key] = sn ? sn.quantity : -1;
  }

  // Group products by category for accordion
  const categories = useMemo(() => [...new Set(filtered.map(p => p.category))], [filtered]);

  const totalCells = products.length * distributors.length;
  const overallPct = Math.round((Object.values(formData).filter(v => v >= 0).length / totalCells) * 100);
  const distProgress = distributors.map(d => ({ name: d.name, pct: Math.round((products.filter(p => formData[`${p.id}_${d.id}`] >= 0).length / products.length) * 100) }));

  return (
    <div className="space-y-3">
      {/* Date + Toolbar - combined */}
      <div className="flex flex-wrap items-center gap-2 bg-white rounded-2xl border border-gray-100 shadow-sm px-3 py-2.5">
        <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs font-medium" />
        <div className="flex gap-0.5">{availableWeeks.slice(0,5).map(w => <button key={w} onClick={() => setSelectedDate(w)} className={`px-1.5 py-1 rounded text-[10px] font-medium ${w===selectedDate?'bg-gray-900 text-white':'bg-gray-50 text-gray-600 hover:bg-gray-100'}`}>{w.slice(5)}</button>)}</div>
        <button onClick={handleCopyPrev} disabled={!prevDate} className="text-[10px] px-2 py-1 border border-gray-200 rounded-lg text-gray-500 hover:bg-gray-50 disabled:opacity-30"><Copy size={11} className="inline mr-0.5" />复制上次</button>
        <div className="flex-1" />
        <div className="flex items-center gap-1.5"><div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden"><div className={`h-full rounded-full ${overallPct===100?'bg-emerald-500':'bg-starbucks-500'}`} style={{width:`${overallPct}%`}} /></div><span className="text-[10px] text-gray-500 font-medium">{overallPct}%</span></div>
        {saved && <span className="text-xs text-emerald-600 font-medium"><Check size={14} className="inline mr-0.5" />已保存</span>}
        <button onClick={handleSave} className="px-4 py-1.5 bg-gray-900 text-white rounded-lg text-xs font-medium hover:bg-gray-800"><Save size={13} className="inline mr-1" />保存</button>
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
      <div className="relative"><Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" /><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="搜索产品..." className="pl-8 pr-3 py-1.5 border border-gray-200 rounded-lg text-xs w-full max-w-[220px] focus:outline-none focus:border-gray-400" /></div>

      {/* Entry by category groups */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {categories.map(cat => {
          const catProducts = filtered.filter(p => p.category === cat);
          const isExpanded = expandedCat === cat || expandedCat === null;
          const catDone = catProducts.filter(p => formData[`${p.id}_${activeDist}`] >= 0).length;
          return (
            <div key={cat}>
              <button onClick={() => setExpandedCat(expandedCat === cat ? cat : null) as any}
                className="w-full flex items-center justify-between px-4 py-2 bg-gray-50/50 border-b border-gray-100 text-xs font-semibold text-gray-600 hover:bg-gray-50">
                <span>{cat} ({catProducts.length})</span>
                <span className="text-[10px] text-gray-400">{catDone}/{catProducts.length}</span>
              </button>
              {isExpanded && catProducts.map(p => {
                const key = `${p.id}_${activeDist}`;
                const val = getVal(p.id);
                const prevVal = prevData[key];
                const changed = prevVal >= 0 && val !== '' && prevVal !== (val as number);
                const diff = changed ? (val as number) - prevVal : 0;
                return (
                  <div key={p.id} className="flex items-center gap-2 px-4 py-2 border-b border-gray-50 hover:bg-gray-50/30">
                    <span className="flex-1 text-xs text-gray-800 truncate">{p.name}</span>
                    {prevDate && <span className="text-[10px] text-gray-400 w-8 text-right">{prevVal>=0?prevVal:'—'}</span>}
                    {prevDate && <span className="text-gray-300 text-[10px]">→</span>}
                    <div className="relative">
                      <input type="number" min="0" value={val} onChange={e=>{const v=e.target.value;const n=v===''?-1:parseInt(v);setFormData(prev=>({...prev,[key]:isNaN(n)?-1:n}));}} placeholder="0" className={changed ? 'w-16 text-center text-xs font-bold rounded-lg border-2 px-2 py-1.5 focus:outline-none border-amber-300 bg-amber-50 text-amber-700' : val!=='' ? 'w-16 text-center text-xs font-bold rounded-lg border-2 px-2 py-1.5 focus:outline-none border-gray-200 bg-white text-gray-800' : 'w-16 text-center text-xs font-bold rounded-lg border-2 px-2 py-1.5 focus:outline-none border-dashed border-gray-200 text-gray-300'} />
                      {changed && <span className={diff>0 ? 'absolute -top-1.5 -right-2 text-[9px] font-bold px-0.5 rounded-full bg-emerald-100 text-emerald-600' : 'absolute -top-1.5 -right-2 text-[9px] font-bold px-0.5 rounded-full bg-red-100 text-red-500'}>{diff>0?'+':''}{Math.abs(diff)}</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ==================== 进货录入 ==================== */
function RestockEntry() {
  const { state, addRestock, deleteRestock } = useApp();
  const { products, distributors, restocks } = state;
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const [selectedDate, setSelectedDate] = useState(today);
  const [activeDist, setActiveDist] = useState(distributors[0]?.id || '');
  const [search, setSearch] = useState('');
  const [qtyMap, setQtyMap] = useState<Record<string, number>>({});

  const dateRestocks = restocks.filter((r: any) => r.date === selectedDate);
  const distRestocks = dateRestocks.filter((r: any) => r.distributorId === activeDist);

  const filtered = useMemo(() => {
    if (!search) return products;
    const q = search.toLowerCase();
    return products.filter(p => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q));
  }, [products, search]);

  const categories = useMemo(() => [...new Set(filtered.map(p => p.category))], [filtered]);
  const [expandedCat, setExpandedCat] = useState<string | null>(null);

  return (
    <div className="space-y-3">
      {/* Date + toolbar */}
      <div className="flex items-center gap-2 bg-white rounded-2xl border border-gray-100 shadow-sm px-3 py-2.5">
        <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs font-medium" />
        <span className="text-[10px] text-gray-400">进货日期独立于盘点日期</span>
        <div className="flex-1" />
        <span className="text-[10px] text-gray-500">已录 {distRestocks.reduce((s:number,r:any)=>s+r.quantity,0)} 件 / {distRestocks.length} 笔</span>
      </div>

      {/* Distributor tabs */}
      <div className="flex gap-1.5">
        {distributors.map(d => {
          const count = dateRestocks.filter((r: any) => r.distributorId === d.id).length;
          return (
            <button key={d.id} onClick={()=>setActiveDist(d.id)} className={`flex-1 px-3 py-2 rounded-xl text-xs font-medium text-left transition-all ${activeDist===d.id?'bg-white border border-gray-200 shadow-sm':'bg-white/60 border border-transparent text-gray-500 hover:bg-white'}`}>
              <div className="flex justify-between"><span>{d.name}</span><span className="text-gray-400">{count}笔</span></div>
            </button>
          );
        })}
      </div>

      {/* Search */}
      <div className="relative"><Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" /><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="搜索产品..." className="pl-8 pr-3 py-1.5 border border-gray-200 rounded-lg text-xs w-full max-w-[220px] focus:outline-none focus:border-gray-400" /></div>

      {/* Product list grouped by category */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden max-h-[60vh] overflow-y-auto scrollbar-thin">
        {categories.map(cat => {
          const catProducts = filtered.filter(p => p.category === cat);
          const isExpanded = expandedCat === cat || expandedCat === null;
          return (
            <div key={cat}>
              <button onClick={() => setExpandedCat(expandedCat === cat ? cat : null) as any}
                className="w-full flex items-center justify-between px-4 py-2 bg-gray-50/50 border-b border-gray-100 text-xs font-semibold text-gray-600 hover:bg-gray-50 sticky top-0">
                <span>{cat} ({catProducts.length})</span>
              </button>
              {isExpanded && catProducts.map(p => {
                const key = `${p.id}_${activeDist}`;
                const existing = distRestocks.filter((r: any) => r.productId === p.id).reduce((s: number, r: any) => s + r.quantity, 0);
                const qty = qtyMap[key] || '';
                const handleAdd = () => {
                  const n = parseInt(qty as string);
                  if (!n || n <= 0) return;
                  addRestock({ id: 'R' + Date.now() + Math.random().toString(36), date: selectedDate, productId: p.id, distributorId: activeDist, quantity: n, weekStart: selectedDate });
                  setQtyMap(prev => ({ ...prev, [key]: 0 }));
                };
                return (
                  <div key={p.id} className="flex items-center gap-2 px-4 py-2 border-b border-gray-50 hover:bg-gray-50/30">
                    <span className="flex-1 text-xs text-gray-800 truncate">{p.name}</span>
                    {existing > 0 && <span className="text-[10px] text-amber-600 font-medium bg-amber-50 px-1.5 py-0.5 rounded">+{existing}</span>}
                    <input type="number" min="1" value={qty} onChange={e => setQtyMap(prev => ({ ...prev, [key]: parseInt(e.target.value) || '' as any }))}
                      onKeyDown={e => e.key === 'Enter' && handleAdd()} placeholder="数量"
                      className="w-14 text-center border border-dashed border-gray-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:border-amber-400" />
                    <button onClick={handleAdd} className="p-1 rounded-lg text-gray-300 hover:text-amber-600 hover:bg-amber-50"><Plus size={15} /></button>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* Existing restocks (if any) */}
      {distRestocks.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-4 py-2 bg-amber-50/50 border-b border-gray-50 text-xs font-semibold text-gray-700">
            今日已录 · {selectedDate}
          </div>
          <div className="flex flex-wrap gap-1.5 p-3">
            {distRestocks.map((r: any) => {
              const p = products.find((x: any) => x.id === r.productId);
              return (
                <div key={r.id} className="flex items-center gap-1.5 bg-gray-50 rounded-lg px-2.5 py-1.5 text-xs group">
                  <span className="font-medium text-gray-700 max-w-[100px] truncate">{p?.name || r.productId}</span>
                  <span className="font-bold text-amber-700">×{r.quantity}</span>
                  <button onClick={() => deleteRestock(r.id)} className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100"><Trash2 size={11} /></button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
