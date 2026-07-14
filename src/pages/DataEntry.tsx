import { useState, useEffect, useMemo, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import { getAvailableWeeks } from '../data/mockData';
import { Save, Copy, Check, Search, ChevronLeft, ChevronRight, Plus, Trash2, Package, Truck } from 'lucide-react';

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
            <button key={m} onClick={() => setMode(m)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${mode === m ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
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

  const handleQuickFill = () => {
    const v = parseInt((document.getElementById('qfill') as HTMLInputElement)?.value || '');
    if (isNaN(v) || v < 0) return;
    setFormData(prev => { const next = { ...prev }; for (const p of filtered) next[`${p.id}_${activeDist}`] = v; return next; });
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

  const totalCells = products.length * distributors.length;
  const overallPct = Math.round((Object.values(formData).filter(v => v >= 0).length / totalCells) * 100);
  const distProgress = distributors.map(d => ({ name: d.name, pct: Math.round((products.filter(p => formData[`${p.id}_${d.id}`] >= 0).length / products.length) * 100) }));

  return (
    <div className="space-y-3">
      {/* Date selector */}
      <div className="flex flex-wrap items-center gap-2 bg-white rounded-xl border border-gray-100 shadow-sm p-2.5">
        <button onClick={() => { const i = allWeeks.indexOf(selectedDate); if (i > 0) setSelectedDate(allWeeks[i-1]); }} className="p-1 rounded-lg hover:bg-gray-100"><ChevronLeft size={15} /></button>
        <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs font-medium" />
        <button onClick={() => { const i = allWeeks.indexOf(selectedDate); if (i < allWeeks.length-1) setSelectedDate(allWeeks[i+1]); }} className="p-1 rounded-lg hover:bg-gray-100"><ChevronRight size={15} /></button>
        <button onClick={() => setSelectedDate(today)} className="text-[11px] px-2 py-1.5 bg-gray-100 rounded-lg font-medium hover:bg-gray-200">今天</button>
        <div className="flex gap-1 flex-wrap">{availableWeeks.slice(0,5).map(w => <button key={w} onClick={() => setSelectedDate(w)} className={`px-2 py-1 rounded-md text-[10px] font-medium ${w===selectedDate?'bg-gray-900 text-white':'bg-gray-50 text-gray-600 hover:bg-gray-100'}`}>{w.slice(5)}</button>)}</div>
        <div className="flex-1" />
        <button onClick={handleCopyPrev} disabled={!prevDate} className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-medium text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-30"><Copy size={12} />复制上次</button>
        <div className="hidden sm:flex items-center gap-1.5"><div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden"><div className={`h-full rounded-full ${overallPct===100?'bg-emerald-500':'bg-starbucks-500'}`} style={{width:`${overallPct}%`}} /></div><span className="text-[11px] text-gray-500 font-medium">{overallPct}%</span></div>
        {saved && <span className="text-xs text-emerald-600 font-medium flex items-center gap-1"><Check size={14} />已保存</span>}
        <button onClick={handleSave} className="flex items-center gap-1.5 px-4 py-2 bg-gray-900 text-white rounded-xl text-sm font-medium hover:bg-gray-800 shadow-sm"><Save size={15} />保存</button>
      </div>

      {/* Distributor tabs */}
      <div className="flex gap-1.5">
        {distributors.map(d => { const p = distProgress.find(dp=>dp.name===d.name); return (
          <button key={d.id} onClick={()=>setActiveDist(d.id)} className={`flex-1 px-3 py-2 rounded-xl text-xs font-medium text-left transition-all ${activeDist===d.id?'bg-white border border-gray-200 shadow-sm':'bg-white/60 border border-transparent text-gray-500 hover:bg-white'}`}>
            <div className="flex justify-between mb-1"><span>{d.name}</span><span className={p?.pct===100?'text-emerald-600':'text-gray-400'}>{p?.pct}%</span></div>
            <div className="h-1 bg-gray-100 rounded-full overflow-hidden"><div className={`h-full rounded-full ${p?.pct===100?'bg-emerald-500':'bg-starbucks-500'}`} style={{width:`${p?.pct||0}%`}} /></div>
          </button>
        )})}
      </div>

      {/* Search + quick fill */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-[200px]"><Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-300" /><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="搜索..." className="pl-7 pr-2.5 py-1.5 border border-gray-200 rounded-lg text-xs w-full focus:outline-none focus:border-gray-400" /></div>
        <input id="qfill" type="number" min="0" placeholder="批量填" onKeyDown={e=>e.key==='Enter'&&handleQuickFill()} className="w-20 border border-gray-200 rounded-lg px-2 py-1.5 text-xs" />
        <button onClick={handleQuickFill} className="px-2.5 py-1.5 text-[11px] bg-gray-100 rounded-lg font-medium hover:bg-gray-200">批量</button>
      </div>

      {/* Entry list */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="grid grid-cols-12 gap-2 px-4 py-2.5 border-b border-gray-50 bg-gray-50/30 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
          <div className="col-span-5">产品</div><div className="col-span-3 text-center">上次库存</div><div className="col-span-4 text-center">本次库存</div>
        </div>
        <div className="divide-y divide-gray-50 max-h-[55vh] overflow-y-auto scrollbar-thin">
          {filtered.map(p => {
            const key = `${p.id}_${activeDist}`;
            const val = getVal(p.id);
            const prevVal = prevData[key];
            const changed = prevVal >= 0 && val !== '' && prevVal !== (val as number);
            const diff = changed ? (val as number) - prevVal : 0;
            return (
              <div key={p.id} className="grid grid-cols-12 gap-2 px-4 py-2.5 items-center hover:bg-gray-50/30">
                <div className="col-span-5 min-w-0"><p className="text-xs font-medium text-gray-800 truncate">{p.name}</p><p className="text-[9px] text-gray-400">{p.spec}</p></div>
                <div className="col-span-3 text-center">{prevDate && prevVal>=0 ? <span className="text-xs text-gray-400">{prevVal}</span> : <span className="text-[10px] text-gray-300">—</span>}</div>
                <div className="col-span-4 flex justify-center">
                  <div className="relative">
                    <input type="number" min="0" value={val} onChange={e=>{const v=e.target.value;const n=v===''?-1:parseInt(v);setFormData(prev=>({...prev,[key]:isNaN(n)?-1:n}));}} placeholder="0" className={`w-16 text-center text-sm font-bold rounded-lg border-2 px-2 py-1.5 focus:outline-none transition-colors ${changed?'border-amber-300 bg-amber-50 text-amber-700 focus:border-amber-400':val!==''?'border-gray-200 bg-white text-gray-800 focus:border-gray-400':'border-dashed border-gray-200 text-gray-300'}`} />
                    {changed && <span className={`absolute -top-1.5 -right-2 text-[9px] font-bold px-1 rounded-full ${diff>0?'bg-emerald-100 text-emerald-600':'bg-red-100 text-red-500'}`}>{diff>0?'+':''}{diff}</span>}
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

/* ==================== 进货录入 ==================== */
function RestockEntry() {
  const { state, addRestock, deleteRestock } = useApp();
  const { products, distributors, restocks } = state;
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const [selectedDate, setSelectedDate] = useState(today);
  const [activeDist, setActiveDist] = useState(distributors[0]?.id || '');
  const [search, setSearch] = useState('');
  const [qtyMap, setQtyMap] = useState<Record<string, number>>({});

  // Get existing restocks for this date + distributor
  const dateRestocks = restocks.filter((r: any) => r.date === selectedDate);
  const distRestocks = dateRestocks.filter((r: any) => r.distributorId === activeDist);

  const filtered = useMemo(() => {
    if (!search) return products;
    const q = search.toLowerCase();
    return products.filter(p => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q));
  }, [products, search]);

  const distProgress = distributors.map(d => {
    const count = dateRestocks.filter((r: any) => r.distributorId === d.id).length;
    return { name: d.name, count, pct: Math.round((count / Math.max(products.length, 1)) * 100) };
  });

  const handleQuickAdd = () => {
    const v = parseInt((document.getElementById('rfill') as HTMLInputElement)?.value || '');
    if (isNaN(v) || v <= 0) return;
    for (const p of filtered) {
      addRestock({ id: 'R' + Date.now() + Math.random().toString(36), date: selectedDate, productId: p.id, distributorId: activeDist, quantity: v, weekStart: selectedDate });
    }
  };

  return (
    <div className="space-y-3">
      {/* Date */}
      <div className="flex items-center gap-2 bg-white rounded-xl border border-gray-100 shadow-sm p-2.5">
        <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs font-medium" />
        <button onClick={() => setSelectedDate(today)} className="text-[11px] px-2 py-1.5 bg-gray-100 rounded-lg font-medium hover:bg-gray-200">今天</button>
        <span className="text-[10px] text-gray-400 ml-2">进货日期可独立于库存盘点日期</span>
      </div>

      {/* Distributor tabs */}
      <div className="flex gap-1.5">
        {distributors.map(d => { const p = distProgress.find(dp=>dp.name===d.name); return (
          <button key={d.id} onClick={()=>setActiveDist(d.id)} className={`flex-1 px-3 py-2 rounded-xl text-xs font-medium text-left transition-all ${activeDist===d.id?'bg-white border border-gray-200 shadow-sm':'bg-white/60 border border-transparent text-gray-500 hover:bg-white'}`}>
            <div className="flex justify-between mb-1"><span>{d.name}</span><span className="text-gray-400">{p?.count||0}笔</span></div>
            <div className="h-1 bg-gray-100 rounded-full overflow-hidden"><div className="h-full rounded-full bg-amber-500" style={{width:`${p?.pct||0}%`}} /></div>
          </button>
        )})}
      </div>

      {/* Search + quick add */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-[200px]"><Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-300" /><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="搜索..." className="pl-7 pr-2.5 py-1.5 border border-gray-200 rounded-lg text-xs w-full focus:outline-none focus:border-gray-400" /></div>
        <input id="rfill" type="number" min="1" placeholder="批量进货" onKeyDown={e=>e.key==='Enter'&&handleQuickAdd()} className="w-24 border border-gray-200 rounded-lg px-2 py-1.5 text-xs" />
        <button onClick={handleQuickAdd} className="px-2.5 py-1.5 text-[11px] bg-amber-100 text-amber-700 rounded-lg font-medium hover:bg-amber-200">批量添加</button>
      </div>

      {/* Restock list */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-4 py-2.5 border-b border-gray-50 bg-amber-50/50 flex items-center justify-between">
          <span className="text-xs font-semibold text-gray-700">已录进货 · {selectedDate}</span>
          <span className="text-[10px] text-gray-400">{distRestocks.reduce((s:number,r:any)=>s+r.quantity,0)} 件 / {distRestocks.length} 笔</span>
        </div>
        <div className="max-h-[55vh] overflow-y-auto scrollbar-thin">
          {distRestocks.length === 0 ? (
            <div className="py-12 text-center text-sm text-gray-300">
              <Truck size={32} className="mx-auto mb-2 text-gray-200" />
              <p>暂无进货记录</p>
              <p className="text-xs mt-1">搜索产品后输入数量快速添加</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {distRestocks.map((r: any) => {
                const p = products.find((x: any) => x.id === r.productId);
                return (
                  <div key={r.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50/30 group">
                    <div className="flex-1 min-w-0"><p className="text-xs font-medium text-gray-800 truncate">{p?.name || r.productId}</p><p className="text-[9px] text-gray-400">{p?.spec}</p></div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-amber-700">{r.quantity} 件</span>
                      <button onClick={() => deleteRestock(r.id)} className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 size={13} /></button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Quick add: product list */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-4 py-2.5 border-b border-gray-50 bg-gray-50/30">
          <span className="text-xs font-semibold text-gray-500">快速添加进货</span>
          <span className="text-[10px] text-gray-400 ml-2">选产品填数量，点击 + 添加</span>
        </div>
        <div className="divide-y divide-gray-50 max-h-[40vh] overflow-y-auto scrollbar-thin">
          {filtered.map(p => {
            const key = `${p.id}_${activeDist}`;
            const qty = qtyMap[key] || '';
            const existing = distRestocks.filter((r: any) => r.productId === p.id).reduce((s: number, r: any) => s + r.quantity, 0);
            const handleAdd = () => {
              const n = parseInt(qty as string);
              if (!n || n <= 0) return;
              addRestock({ id: 'R' + Date.now() + Math.random().toString(36), date: selectedDate, productId: p.id, distributorId: activeDist, quantity: n, weekStart: selectedDate });
              setQtyMap(prev => ({ ...prev, [key]: 0 }));
            };
            return (
              <div key={p.id} className="flex items-center gap-3 px-4 py-2 hover:bg-gray-50/30">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-gray-800 truncate">{p.name}</p>
                  {existing > 0 && <span className="text-[9px] text-amber-600 font-medium">已录 +{existing} 件</span>}
                </div>
                <input type="number" min="1" value={qty} onChange={e => setQtyMap(prev => ({ ...prev, [key]: parseInt(e.target.value) || '' as any }))}
                  onKeyDown={e => e.key === 'Enter' && handleAdd()}
                  placeholder="数量" className="w-16 text-center border border-dashed border-gray-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:border-amber-400" />
                <button onClick={handleAdd} className="p-1 rounded-lg text-gray-300 hover:text-amber-600 hover:bg-amber-50"><Plus size={15} /></button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
