import { useState, useEffect, useMemo, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import { getAvailableWeeks } from '../data/mockData';
import { Save, Check, Search, Copy, Trash2, Package, Truck } from 'lucide-react';

export default function DataEntry() {
  const { state, saveWeek, addRestock, editRestock, deleteRestock } = useApp();
  const { products, distributors, snapshots, restocks } = state;
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const availableWeeks = useMemo(() => getAvailableWeeks(snapshots), [snapshots]);

  const [tab, setTab] = useState<'stock' | 'restock'>('stock');

  // === 库存盘点 state ===
  const [stockDate, setStockDate] = useState(() => {
    try { return localStorage.getItem('sb_stock_date') || today; } catch { return today; }
  });
  useEffect(() => { localStorage.setItem('sb_stock_date', stockDate); }, [stockDate]);
  const [stockDist, setStockDist] = useState(distributors[0]?.id || '');
  const [stockData, setStockData] = useState<Record<string, number>>({});
  const [stockSearch, setStockSearch] = useState('');
  const [saved, setSaved] = useState(false);

  // === 进货录入 state ===
  const [restockDate, setRestockDate] = useState(() => {
    try { return localStorage.getItem('sb_restock_date') || today; } catch { return today; }
  });
  useEffect(() => { localStorage.setItem('sb_restock_date', restockDate); }, [restockDate]);
  const [restockDist, setRestockDist] = useState(distributors[0]?.id || '');
  const [restockInputs, setRestockInputs] = useState<Record<string, { val: string; added: number }>>({});
  const [restockSearch, setRestockSearch] = useState('');

  // Load stock data
  const loadStock = useCallback((date: string) => {
    const sd: Record<string, number> = {};
    for (const p of products) for (const d of distributors) {
      const sn = snapshots.find(s => s.weekStart === date && s.productId === p.id && s.distributorId === d.id);
      sd[`${p.id}_${d.id}`] = sn ? sn.quantity : -1;
    }
    setStockData(sd); setSaved(false);
  }, [products, distributors, snapshots]);

  // Load restocks
  const loadRestocks = useCallback((date: string) => {
    setRestockInputs(prev => {
      const next: Record<string, { val: string; added: number }> = {};
      for (const p of products) for (const d of distributors) {
        const key = `${p.id}_${d.id}`;
        const existing = restocks.filter(r => r.date === date && r.productId === p.id && r.distributorId === d.id).reduce((s: number, r: any) => s + r.quantity, 0);
        next[key] = { val: prev[key]?.val ?? '', added: existing };
      }
      return next;
    });
  }, [products, distributors, restocks]);

  useEffect(() => { loadStock(stockDate); }, [stockDate, loadStock]);
  useEffect(() => { loadRestocks(restockDate); }, [restockDate, loadRestocks]);

  // Previous stock for reference
  const prevDate = availableWeeks.filter(w => w < stockDate).sort().reverse()[0] || null;
  const prevStock: Record<string, number> = {};
  if (prevDate) {
    for (const p of products) for (const d of distributors) {
      const sn = snapshots.find(s => s.weekStart === prevDate && s.productId === p.id && s.distributorId === d.id);
      prevStock[`${p.id}_${d.id}`] = sn ? sn.quantity : 0;
    }
  }

  // === Stock handlers ===
  const getStock = (pid: string) => { const v = stockData[`${pid}_${stockDist}`]; return v >= 0 ? v : ''; };
  const setStock = (pid: string, v: string) => {
    const n = v === '' ? -1 : parseInt(v);
    setStockData(prev => ({ ...prev, [`${pid}_${stockDist}`]: isNaN(n) ? -1 : n }));
  };
  const handleSaveStock = () => {
    const entries = Object.entries(stockData).filter(([, q]) => q >= 0).map(([k, q]) => { const [pid, did] = k.split('_'); return { productId: pid, distributorId: did, quantity: q }; });
    saveWeek(stockDate, entries);
    setSaved(true); setTimeout(() => setSaved(false), 2000);
  };
  const copyPrev = () => {
    if (!prevDate) return;
    const sd: Record<string, number> = {};
    for (const p of products) for (const d of distributors) {
      const key = `${p.id}_${d.id}`;
      const sn = snapshots.find(s => s.weekStart === prevDate && s.productId === p.id && s.distributorId === d.id);
      sd[key] = sn ? sn.quantity : -1;
    }
    setStockData(sd);
  };

  // === Restock handlers ===
  const getRVal = (pid: string) => restockInputs[`${pid}_${restockDist}`]?.val ?? '';
  const getRAdded = (pid: string) => restockInputs[`${pid}_${restockDist}`]?.added ?? 0;
  const setRVal = (pid: string, v: string) => {
    const key = `${pid}_${restockDist}`;
    setRestockInputs(prev => ({ ...prev, [key]: { ...prev[key], val: v } }));
  };
  const addOne = (pid: string) => {
    const key = `${pid}_${restockDist}`;
    const n = parseInt(restockInputs[key]?.val || '');
    if (!n || n <= 0) return;
    addRestock({ id: 'R' + Date.now() + Math.random().toString(36), date: restockDate, productId: pid, distributorId: restockDist, quantity: n, weekStart: restockDate });
    setRestockInputs(prev => ({ ...prev, [key]: { val: '', added: (prev[key]?.added || 0) + n } }));
  };
  const removeOne = (rid: string) => {
    const r = restocks.find(x => x.id === rid);
    if (r) {
      const key = `${r.productId}_${r.distributorId}`;
      setRestockInputs(prev => ({ ...prev, [key]: { ...prev[key], added: Math.max(0, (prev[key]?.added || 0) - r.quantity) } }));
    }
    deleteRestock(rid);
  };

  // Product filters
  const stockProducts = useMemo(() => {
    if (!stockSearch) return products;
    const q = stockSearch.toLowerCase();
    return products.filter(p => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q));
  }, [products, stockSearch]);
  const restockProducts = useMemo(() => {
    if (!restockSearch) return products;
    const q = restockSearch.toLowerCase();
    return products.filter(p => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q));
  }, [products, restockSearch]);

  const stockPct = Math.round((Object.values(stockData).filter(v => v >= 0).length / (products.length * distributors.length)) * 100);
  const restockDistName = distributors.find(d => d.id === restockDist)?.name || '';

  // Shared distributor tabs component
  const DistTabs = ({ active, onChange, dataKey }: { active: string; onChange: (id: string) => void; dataKey: 'stock' | 'restock' }) => (
    <div className="flex gap-1.5 overflow-x-auto">
      {distributors.map(d => {
        const pct = dataKey === 'stock'
          ? Math.round((products.filter(p => stockData[`${p.id}_${d.id}`] >= 0).length / products.length) * 100)
          : 0;
        return (
          <button key={d.id} onClick={() => onChange(d.id)}
            className={`flex-shrink-0 px-3 py-2 rounded-xl text-xs font-medium transition-all ${
              active === d.id ? 'bg-white border border-gray-200 shadow-sm text-gray-800' : 'bg-white/60 border border-transparent text-gray-500 hover:bg-white'
            }`}>
            {d.name}{dataKey === 'stock' && <span className={`ml-1.5 ${pct === 100 ? 'text-emerald-500' : 'text-gray-400'}`}>{pct}%</span>}
          </button>
        );
      })}
    </div>
  );

  return (
    <div className="p-3 md:p-5 space-y-4 max-w-4xl mx-auto">

      {/* Header + Tabs */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl md:text-2xl font-bold text-gray-800">数据录入</h1>
        <div className="flex bg-gray-100 rounded-xl p-1 gap-1">
          <button onClick={() => setTab('stock')}
            className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg transition-all ${tab === 'stock' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500'}`}>
            <Package size={15} />库存盘点
          </button>
          <button onClick={() => setTab('restock')}
            className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg transition-all ${tab === 'restock' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500'}`}>
            <Truck size={15} />进货录入
          </button>
        </div>
      </div>

      {/* ==================== 库存盘点 ==================== */}
      {tab === 'stock' && (
        <div className="space-y-4">
          {/* Date + toolbar */}
          <div className="flex flex-wrap items-center gap-3 bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-3">
            <span className="text-xs font-medium text-gray-500">盘点日期</span>
            <input type="date" value={stockDate} onChange={e => setStockDate(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-2 text-sm font-medium focus:outline-none focus:border-gray-400" />
            {prevDate && (
              <button onClick={copyPrev} className="text-xs px-3 py-1.5 border border-gray-200 rounded-lg text-gray-500 hover:bg-gray-50 flex items-center gap-1">
                <Copy size={12} />从上次复制
              </button>
            )}
            <div className="flex-1" />
            <div className="flex items-center gap-3">
              <div className="w-24 h-2 bg-gray-100 rounded-full overflow-hidden"><div className={`h-full rounded-full ${stockPct === 100 ? 'bg-emerald-500' : 'bg-starbucks-500'}`} style={{ width: `${stockPct}%` }} /></div>
              <span className="text-xs text-gray-400">{stockPct}%</span>
              {saved && <span className="text-xs text-emerald-600 font-medium"><Check size={14} className="inline mr-0.5" />已保存</span>}
              <button onClick={handleSaveStock} className="px-5 py-2.5 bg-gray-900 text-white rounded-xl text-sm font-medium hover:bg-gray-800 flex items-center gap-1.5"><Save size={15} />保存库存</button>
            </div>
          </div>

          {/* Distributor tabs */}
          <DistTabs active={stockDist} onChange={setStockDist} dataKey="stock" />

          {/* Search */}
          <div className="relative"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" /><input value={stockSearch} onChange={e => setStockSearch(e.target.value)} placeholder="搜索产品..." className="pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm w-full max-w-[240px] focus:outline-none focus:border-gray-400" /></div>

          {/* Stock entry card */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="divide-y divide-gray-50 max-h-[60vh] overflow-y-auto">
              {stockProducts.map(p => {
                const key = `${p.id}_${stockDist}`;
                const prev = prevStock[key] || 0;
                const curr = getStock(p.id);
                const currNum = curr === '' ? 0 : (curr as number);
                const changed = prev !== currNum;
                return (
                  <div key={p.id} className="flex items-center gap-4 px-5 py-3 hover:bg-gray-50/30">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{p.name}</p>
                      <p className="text-[10px] text-gray-400">{p.spec} · ¥{p.unitPrice}</p>
                    </div>
                    {prevDate && (
                      <div className="text-center w-16 flex-shrink-0">
                        <p className="text-[10px] text-gray-400">上次</p>
                        <p className="text-sm text-gray-500 font-medium">{prev}</p>
                      </div>
                    )}
                    <input type="number" min="0" value={curr} onChange={e => setStock(p.id, e.target.value)}
                      placeholder="库存数" className={`w-20 text-center font-bold rounded-xl border-2 px-3 py-2.5 focus:outline-none text-sm ${changed && curr !== '' ? 'border-amber-300 bg-amber-50 text-amber-700' : curr !== '' ? 'border-gray-200 bg-white text-gray-800' : 'border-dashed border-gray-200 text-gray-300'}`} />
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ==================== 进货录入 ==================== */}
      {tab === 'restock' && (
        <div className="space-y-4">
          {/* Date + toolbar */}
          <div className="flex flex-wrap items-center gap-3 bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-3">
            <span className="text-xs font-medium text-gray-500">进货日期</span>
            <input type="date" value={restockDate} onChange={e => setRestockDate(e.target.value)} className="border border-amber-200 rounded-lg px-3 py-2 text-sm font-medium bg-amber-50/30 focus:outline-none focus:border-amber-400" />
            <span className="text-[11px] text-gray-400">按回车或点 + 确认每行</span>
          </div>

          {/* Distributor tabs */}
          <DistTabs active={restockDist} onChange={setRestockDist} dataKey="restock" />

          {/* Search */}
          <div className="relative"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" /><input value={restockSearch} onChange={e => setRestockSearch(e.target.value)} placeholder="搜索产品..." className="pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm w-full max-w-[240px] focus:outline-none focus:border-gray-400" /></div>

          {/* Restock entry card */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="divide-y divide-gray-50 max-h-[50vh] overflow-y-auto">
              {restockProducts.map(p => {
                const added = getRAdded(p.id);
                const val = getRVal(p.id);
                return (
                  <div key={p.id} className="flex items-center gap-4 px-5 py-3 hover:bg-gray-50/30">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{p.name}</p>
                      <p className="text-[10px] text-gray-400">{p.spec}</p>
                    </div>
                    {added > 0 && <span className="text-xs font-bold text-amber-700 bg-amber-50 px-2 py-1 rounded-lg">已录 +{added}</span>}
                    <div className="flex items-center gap-1">
                      <input type="number" min="0" value={val} onChange={e => setRVal(p.id, e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') addOne(p.id); }}
                        placeholder="进货量" className="w-20 text-center border border-dashed border-amber-200 rounded-xl px-2 py-2 text-sm focus:outline-none focus:border-amber-400 focus:bg-amber-50/20" />
                      {val && parseInt(val) > 0 && (
                        <button onClick={() => addOne(p.id)} className="w-6 h-6 rounded-full bg-amber-500 text-white flex items-center justify-center text-sm font-bold hover:bg-amber-600">+</button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Restock summary */}
          {restocks.filter(r => r.date === restockDate && r.distributorId === restockDist).length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-5 py-3 bg-amber-50/50 border-b border-gray-50 text-sm font-semibold text-gray-700">
                {restockDate} · {restockDistName} 进货明细
              </div>
              <div className="flex flex-wrap gap-2 p-4">
                {restocks.filter(r => r.date === restockDate && r.distributorId === restockDist).map((r: any) => {
                  const p = products.find((x: any) => x.id === r.productId);
                  return (
                    <div key={r.id} className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2 text-xs group">
                      <span className="font-medium text-gray-700 max-w-[120px] truncate">{p?.name || r.productId}</span>
                      <span className="font-bold text-amber-700 cursor-pointer hover:underline" onClick={() => {
                        const n = parseInt(prompt('修改数量:', String(r.quantity)) || '');
                        if (n && n > 0) editRestock(r.id, n);
                      }}>×{r.quantity}</span>
                      <button onClick={() => removeOne(r.id)} className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100"><Trash2 size={12} /></button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
