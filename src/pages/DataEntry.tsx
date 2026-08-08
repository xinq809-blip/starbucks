import { useState, useEffect, useMemo, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import { getAvailableWeeks, getProductGroupLabel } from '../data/mockData';
import { Save, Check, Copy, Trash2, Package, Truck } from 'lucide-react';

// Simplified groups for main distributor entry
const MAIN_GROUPS = [
  { key: 'star', label: '星选系列4味合计', ids: ['p03','p04','p05','p06'], price: 93.75 },
  { key: 'coconut', label: 'P270 椰椰拿铁', ids: ['p20'], price: 75 },
  { key: 'p450', label: 'P450 黑咖啡', ids: ['p11'], price: 93.75 },
  { key: 'other', label: '其余产品', ids: ['p01','p02','p07','p08','p09','p10','p12','p13','p14','p15','p16','p17','p18','p19','p21','p22'], price: 60 },
];


export default function DataEntry() {
  const { state, saveWeek, addRestock, editRestock, deleteRestock } = useApp();
  const { products, distributors, snapshots, restocks } = state;
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const availableWeeks = useMemo(() => getAvailableWeeks(snapshots), [snapshots]);

  const [tab, setTab] = useState<'stock' | 'restock'>('stock');

  // Stock state
  const [stockDate, setStockDate] = useState(() => {
    try { return localStorage.getItem('sb_stock_date') || today; } catch { return today; }
  });
  useEffect(() => { localStorage.setItem('sb_stock_date', stockDate); }, [stockDate]);
  const [stockDist, setStockDist] = useState(distributors[0]?.id || '');
  const [stockData, setStockData] = useState<Record<string, number>>({});
  const [saved, setSaved] = useState(false);

  // Restock state
  const [restockDate, setRestockDate] = useState(() => {
    try { return localStorage.getItem('sb_restock_date') || today; } catch { return today; }
  });
  useEffect(() => { localStorage.setItem('sb_restock_date', restockDate); }, [restockDate]);
  const [restockDist, setRestockDist] = useState(distributors[0]?.id || '');
  const [restockInputs, setRestockInputs] = useState<Record<string, { val: string; added: number }>>({});
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

  // Previous date
  const prevDate = availableWeeks.filter(w => w < stockDate).sort().reverse()[0] || null;
  const prevStock: Record<string, number> = {};
  if (prevDate) {
    for (const p of products) for (const d of distributors) {
      const sn = snapshots.find(s => s.weekStart === prevDate && s.productId === p.id && s.distributorId === d.id);
      prevStock[`${p.id}_${d.id}`] = sn ? sn.quantity : 0;
    }
  }

  // --- Helpers: aggregate group data from product-level ---
  const getGroupStock = (grp: typeof MAIN_GROUPS[0]) => {
    const v = stockData[`${grp.ids[0]}_${stockDist}`];
    return v >= 0 ? v : 0;
  };
  const getGroupPrevStock = (grp: typeof MAIN_GROUPS[0]) => {
    return prevStock[`${grp.ids[0]}_${stockDist}`] || 0;
  };

  // --- Stock handlers ---
  const setStock = (pid: string, v: string) => {
    const n = v === '' ? -1 : parseInt(v);
    setStockData(prev => ({ ...prev, [`${pid}_${stockDist}`]: isNaN(n) ? -1 : n }));
  };
  const setGroupStock = (grp: typeof MAIN_GROUPS[0], v: string) => {
    // Store to first product only, clear others, so sum = user's number
    setStock(grp.ids[0], v);
    for (let i = 1; i < grp.ids.length; i++) setStock(grp.ids[i], '0');
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

  // --- Restock handlers ---
  const removeOne = (rid: string) => {
    const r = restocks.find(x => x.id === rid);
    if (r) {
      const key = `${r.productId}_${r.distributorId}`;
      setRestockInputs(prev => ({ ...prev, [key]: { ...prev[key], added: Math.max(0, (prev[key]?.added || 0) - r.quantity) } }));
    }
    deleteRestock(rid);
  };

  // Product filters
  const restockDistName = distributors.find(d => d.id === restockDist)?.name || '';

  const DistTabs = ({ active, onChange }: { active: string; onChange: (id: string) => void }) => (
    <div className="flex gap-1.5 overflow-x-auto">
      {distributors.map(d => (
        <button key={d.id} onClick={() => onChange(d.id)}
          className={`flex-shrink-0 px-3 py-2 rounded-xl text-xs font-medium transition-all ${
            active === d.id ? 'bg-white border border-gray-200 shadow-sm text-gray-800' : 'bg-white/60 border border-transparent text-gray-500 hover:bg-white'
          }`}>
          {d.name}
        </button>
      ))}
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
          <div className="flex flex-wrap items-center gap-3 bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-3">
            <span className="text-xs font-medium text-gray-500">盘点日期</span>
            <input type="date" value={stockDate} onChange={e => setStockDate(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-2 text-sm font-medium focus:outline-none focus:border-gray-400" />
            {prevDate && <button onClick={copyPrev} className="text-xs px-3 py-1.5 border border-gray-200 rounded-lg text-gray-500 hover:bg-gray-50 flex items-center gap-1"><Copy size={12} />从上次复制</button>}
            <div className="flex-1" />
            <div className="flex items-center gap-3">
              {saved && <span className="text-xs text-emerald-600 font-medium"><Check size={14} className="inline mr-0.5" />已保存</span>}
              <button onClick={handleSaveStock} className="px-5 py-2.5 bg-gray-900 text-white rounded-xl text-sm font-medium hover:bg-gray-800 flex items-center gap-1.5"><Save size={15} />保存库存</button>
            </div>
          </div>

          <DistTabs active={stockDist} onChange={setStockDist} />

          {/* All distributors: grouped entry */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="divide-y divide-gray-50">
              {MAIN_GROUPS.map(grp => {
                const total = getGroupStock(grp);
                const prev = getGroupPrevStock(grp);
                return (
                  <div key={grp.key} className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50/30">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-gray-800">{grp.label}</p>
                      <p className="text-[10px] text-gray-400">{grp.ids.length}款产品 · ¥{grp.price}/件</p>
                    </div>
                    {prevDate && (
                      <div className="text-center w-16 flex-shrink-0">
                        <p className="text-[10px] text-gray-400">上次</p>
                        <p className="text-sm text-gray-500 font-medium">{prev}</p>
                      </div>
                    )}
                    <input type="number" min="0" value={total > 0 ? total : ''} onChange={e => setGroupStock(grp, e.target.value)}
                      placeholder="合计数量" className="w-24 text-center font-bold rounded-xl border-2 px-3 py-3 focus:outline-none text-sm border-gray-200 bg-white text-gray-800" />
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
          <div className="flex flex-wrap items-center gap-3 bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-3">
            <span className="text-xs font-medium text-gray-500">进货日期</span>
            <input type="date" value={restockDate} onChange={e => setRestockDate(e.target.value)} className="border border-amber-200 rounded-lg px-3 py-2 text-sm font-medium bg-amber-50/30 focus:outline-none focus:border-amber-400" />
            <span className="text-[11px] text-gray-400">填数量后回车或点 + </span>
          </div>

          <DistTabs active={restockDist} onChange={setRestockDist} />

          {/* 4-group restock entry - same as stock */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="divide-y divide-gray-50 max-h-[50vh] overflow-y-auto">
              {MAIN_GROUPS.map(grp => {
                const added = restockInputs[`${grp.ids[0]}_${restockDist}`]?.added ?? 0;
                const val = restockInputs[`${grp.ids[0]}_${restockDist}`]?.val ?? '';
                return (
                  <div key={grp.key} className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50/30">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-gray-800">{grp.label}</p>
                      <p className="text-[10px] text-gray-400">{grp.ids.length}款 · ¥{grp.price}/件</p>
                    </div>
                    {added > 0 && <span className="text-xs font-bold text-amber-700 bg-amber-50 px-2 py-1 rounded-lg">已录 +{added}</span>}
                    <div className="flex items-center gap-1">
                      <input type="number" min="0" value={val} onChange={e => {
                        const key0 = `${grp.ids[0]}_${restockDist}`;
                        setRestockInputs(prev => ({ ...prev, [key0]: { ...prev[key0], val: e.target.value } }));
                      }}
                        onKeyDown={e => { if (e.key === 'Enter') {
                          const n = parseInt(val || '') || 0;
                          if (n <= 0) return;
                          // Store to first product only
                          const pid0 = grp.ids[0];
                          addRestock({ id: 'R' + Date.now() + Math.random().toString(36), date: restockDate, productId: pid0, distributorId: restockDist, quantity: n, weekStart: restockDate });
                          const key0 = `${pid0}_${restockDist}`;
                          setRestockInputs(prev => ({ ...prev, [key0]: { val: '', added: (prev[key0]?.added || 0) + n } }));
                        }}}
                        placeholder="数量" className="w-24 text-center border border-dashed border-amber-200 rounded-xl px-2 py-2 text-sm focus:outline-none focus:border-amber-400 focus:bg-amber-50/20" />
                      {val && parseInt(val) > 0 && (
                        <button onClick={() => {
                          const n = parseInt(val || '') || 0;
                          if (n <= 0) return;
                          const pid0 = grp.ids[0];
                          addRestock({ id: 'R' + Date.now() + Math.random().toString(36), date: restockDate, productId: pid0, distributorId: restockDist, quantity: n, weekStart: restockDate });
                          const key0 = `${pid0}_${restockDist}`;
                          setRestockInputs(prev => ({ ...prev, [key0]: { val: '', added: (prev[key0]?.added || 0) + n } }));
                        }} className="w-7 h-7 rounded-full bg-amber-500 text-white flex items-center justify-center text-sm font-bold hover:bg-amber-600">+</button>
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
                  const label = getProductGroupLabel(r.productId) || products.find((x: any) => x.id === r.productId)?.name || r.productId;
                  return (
                    <div key={r.id} className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2 text-xs group">
                      <span className="font-medium text-gray-700 max-w-[120px] truncate">{label}</span>
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
