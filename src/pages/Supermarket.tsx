import { useState, useMemo, useEffect } from 'react';
import { Plus, X, Search, Calendar, Globe, Building2, Package, AlertCircle, Trash2 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import type { NewProductListing, PromotionSlot, PlatformRollout } from '../types/supermarket';
import { supabase } from '../lib/supabase';
import { products as allProducts } from '../data/mockData';

const STORES = [
  { id: 's1', name: '唐百', color: '#3b82f6' },
  { id: 's2', name: '兆丰', color: '#f59e0b' },
  { id: 's3', name: '兴龙广缘', color: '#10b981' },
  { id: 's4', name: '宽广', color: '#8b5cf6' },
  { id: 's5', name: '福满家', color: '#ef4444' },
  { id: 's6', name: '宽广购', color: '#06b6d4' },
];

const storeById = (id: string) => STORES.find(s => s.id === id);

function genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

/* ---- Status configs ---- */
const L_STATUS = [
  { key: 'negotiating', label: '洽谈中', color: '#f59e0b', bg: '#fffbeb', border: '#fde68a' },
  { key: 'approved', label: '已通过', color: '#3b82f6', bg: '#eff6ff', border: '#bfdbfe' },
  { key: 'listed', label: '已上架', color: '#10b981', bg: '#ecfdf5', border: '#a7f3d0' },
];
const P_STATUS = [
  { key: 'planned', label: '已规划', color: '#6b7280', bg: '#f9fafb', border: '#e5e7eb' },
  { key: 'confirmed', label: '已确认', color: '#3b82f6', bg: '#eff6ff', border: '#bfdbfe' },
  { key: 'executing', label: '执行中', color: '#f59e0b', bg: '#fffbeb', border: '#fde68a' },
  { key: 'done', label: '已完成', color: '#10b981', bg: '#ecfdf5', border: '#a7f3d0' },
];
const R_STATUS = [
  { key: 'pending', label: '待处理', color: '#6b7280', bg: '#f9fafb', border: '#e5e7eb' },
  { key: 'in_progress', label: '推进中', color: '#3b82f6', bg: '#eff6ff', border: '#bfdbfe' },
  { key: 'online', label: '已上线', color: '#10b981', bg: '#ecfdf5', border: '#a7f3d0' },
];

const statusConfig = (status: string, type: 'listing' | 'promo' | 'rollout') => {
  const list = type === 'listing' ? L_STATUS : type === 'promo' ? P_STATUS : R_STATUS;
  return list.find(s => s.key === status) || list[0];
};

const NEXT: Record<string, Record<string, string>> = {
  listing: { negotiating: 'approved', approved: 'listed' },
  promo: { planned: 'confirmed', confirmed: 'executing', executing: 'done' },
  rollout: { pending: 'in_progress', in_progress: 'online' },
};

type Tab = 'listing' | 'promotion' | 'rollout';

export default function SupermarketPage() {
  const [tab, setTab] = useState<Tab>('listing');
  const [listings, setListings] = useState<NewProductListing[]>([]);
  const [promos, setPromos] = useState<PromotionSlot[]>([]);
  const [rollouts, setRollouts] = useState<PlatformRollout[]>([]);
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState<{ type: Tab; edit: any } | null>(null);
  const [smLoaded, setSmLoaded] = useState(false);

  // Load from Supabase
  useEffect(() => {
    (async () => {
      const [l, p, r] = await Promise.all([
        supabase.from('sm_listing').select('*'),
        supabase.from('sm_promotion').select('*'),
        supabase.from('sm_rollout').select('*'),
      ]);
      setListings((l.data || []).map((r: any) => r.data));
      setPromos((p.data || []).map((r: any) => r.data));
      setRollouts((r.data || []).map((r: any) => r.data));
      setSmLoaded(true);
    })();
  }, []);

  // Save to Supabase
  useEffect(() => { if (smLoaded) supabase.from('sm_listing').upsert(listings.map(d => ({ id: d.id || genId(), data: d })), { onConflict: 'id' }).then(() => {}); }, [listings]);
  useEffect(() => { if (smLoaded) supabase.from('sm_promotion').upsert(promos.map(d => ({ id: d.id || genId(), data: d })), { onConflict: 'id' }).then(() => {}); }, [promos]);
  useEffect(() => { if (smLoaded) supabase.from('sm_rollout').upsert(rollouts.map(d => ({ id: d.id || genId(), data: d })), { onConflict: 'id' }).then(() => {}); }, [rollouts]);

  // ---- Computed ----
  const overview = useMemo(() => {
    const lTotal = listings.length;
    const lDone = listings.filter(l => l.status === 'listed').length;
    const pTotal = promos.length;
    const pActive = promos.filter(p => p.status === 'executing' || p.status === 'confirmed').length;
    const rTotal = rollouts.length;
    const rDone = rollouts.filter(r => r.status === 'online').length;

    // Per store breakdown
    const storesData = STORES.map(s => ({
      ...s,
      listing: listings.filter(l => l.supermarketId === s.id).length,
      listed: listings.filter(l => l.supermarketId === s.id && l.status === 'listed').length,
      promo: promos.filter(p => p.supermarketId === s.id).length,
      promoActive: promos.filter(p => p.supermarketId === s.id && (p.status === 'executing' || p.status === 'confirmed')).length,
      rollout: rollouts.filter(r => r.supermarketId === s.id).length,
      online: rollouts.filter(r => r.supermarketId === s.id && r.status === 'online').length,
    }));

    return { lTotal, lDone, pTotal, pActive, rTotal, rDone, storesData };
  }, [listings, promos, rollouts]);

  // Pie data for listing
  const listingPie = useMemo(() => L_STATUS.map(s => ({
    name: s.label,
    value: listings.filter(l => l.status === s.key).length,
    color: s.color,
  })).filter(d => d.value > 0), [listings]);

  // Store bar chart for listing progress
  const storeBarData = useMemo(() => overview.storesData.map(s => ({
    name: s.name,
    已上架: s.listed,
    进行中: s.listing - s.listed,
  })), [overview.storesData]);

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-7xl mx-auto">
      {/* ====== Header ====== */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-gray-800">商超渠道管理系统</h1>
          <p className="text-xs text-gray-400 mt-0.5">新品上架追踪 · 档期活动管理 · 平台翻单进度 · 覆盖 6 家商超系统</p>
        </div>
        <div className="text-xs text-gray-400">
          数据更新: {new Date().toLocaleDateString('zh-CN')}
        </div>
      </div>

      {/* ====== KPI Cards ====== */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center"><Package size={20} className="text-blue-500" /></div>
            <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${overview.lDone === overview.lTotal && overview.lTotal > 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
              {overview.lTotal > 0 ? Math.round((overview.lDone / overview.lTotal) * 100) + '%' : '—'}
            </span>
          </div>
          <p className="text-2xl font-bold text-gray-800">{overview.lDone}<span className="text-sm font-normal text-gray-300">/{overview.lTotal}</span></p>
          <p className="text-xs text-gray-400 mt-1">新品已上架 / 总数</p>
          <div className="mt-3 h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-blue-400 to-blue-500 rounded-full transition-all duration-500" style={{ width: `${overview.lTotal > 0 ? (overview.lDone / overview.lTotal) * 100 : 0}%` }} />
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center"><Calendar size={20} className="text-amber-500" /></div>
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-600 font-medium">{overview.pActive} 进行中</span>
          </div>
          <p className="text-2xl font-bold text-gray-800">{overview.pTotal}<span className="text-sm font-normal text-gray-300"> 个</span></p>
          <p className="text-xs text-gray-400 mt-1">档期活动总数</p>
          <div className="mt-3 flex gap-1">
            {P_STATUS.map(s => {
              const cnt = promos.filter(p => p.status === s.key).length;
              return cnt > 0 ? (
                <div key={s.key} className="flex-1 h-1.5 rounded-full" style={{ backgroundColor: s.color }} title={`${s.label}: ${cnt}`} />
              ) : null;
            })}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-xl bg-violet-50 flex items-center justify-center"><Globe size={20} className="text-violet-500" /></div>
            <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${overview.rDone === overview.rTotal && overview.rTotal > 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-violet-50 text-violet-600'}`}>
              {overview.rTotal > 0 ? Math.round((overview.rDone / overview.rTotal) * 100) + '%' : '—'}
            </span>
          </div>
          <p className="text-2xl font-bold text-gray-800">{overview.rDone}<span className="text-sm font-normal text-gray-300">/{overview.rTotal}</span></p>
          <p className="text-xs text-gray-400 mt-1">平台已上线 / 总数</p>
          <div className="mt-3 h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-violet-400 to-violet-500 rounded-full transition-all duration-500" style={{ width: `${overview.rTotal > 0 ? (overview.rDone / overview.rTotal) * 100 : 0}%` }} />
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center"><Building2 size={20} className="text-emerald-500" /></div>
          </div>
          <p className="text-2xl font-bold text-gray-800">{STORES.length}<span className="text-sm font-normal text-gray-300"> 家</span></p>
          <p className="text-xs text-gray-400 mt-1">覆盖商超系统</p>
          <div className="mt-3 flex flex-wrap gap-1">
            {STORES.map(s => (
              <span key={s.id} className="text-[9px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500">{s.name}</span>
            ))}
          </div>
        </div>
      </div>

      {/* ====== Per-Store Cards: 上翻SKU数量 ====== */}
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">各商超平台上翻 SKU 数量</p>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {overview.storesData.map(s => (
          <div key={s.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 hover:shadow-md transition-shadow">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: s.color }} />
              <p className="text-sm font-bold text-gray-800 truncate">{s.name}</p>
            </div>
            <div className="text-center mb-2">
              <p className="text-3xl font-bold" style={{ color: s.color }}>{s.online}</p>
              <p className="text-[10px] text-gray-400">已上翻 SKU</p>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden mb-3">
              <div className="h-full rounded-full transition-all" style={{ width: `${s.rollout > 0 ? (s.online / Math.max(s.rollout, s.online)) * 100 : 0}%`, backgroundColor: s.color }} />
            </div>
            <div className="flex justify-between text-[10px] text-gray-400">
              <span>总计 {s.rollout} 个</span>
              <span>上架 {s.listed} 档期 {s.promo}</span>
            </div>
          </div>
        ))}
      </div>

      {/* ====== Charts Row ====== */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Store listing progress bar chart */}
        <div className="md:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">各商超上架进度</h3>
          {overview.lTotal > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={storeBarData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f5" />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={70} />
                <Tooltip />
                <Bar dataKey="已上架" stackId="a" fill="#10b981" radius={[0, 0, 0, 0]} />
                <Bar dataKey="进行中" stackId="a" fill="#e5e7eb" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[200px] text-gray-300 text-sm">暂无上架数据</div>
          )}
        </div>

        {/* Listing status pie */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">上架状态分布</h3>
          {listingPie.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={listingPie} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} innerRadius={35}
                  label={({ name, value }) => `${name} ${value}`} labelLine={{ stroke: '#d1d5db' }}>
                  {listingPie.map((d, i) => <Cell key={i} fill={d.color} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[200px] text-gray-300 text-sm">暂无数据</div>
          )}
        </div>
      </div>

      {/* ====== Tab Switcher ====== */}
      <div className="flex items-center justify-between">
        <div className="flex bg-gray-100 rounded-xl p-1">
          {([
            ['listing', '新品上架', overview.lTotal],
            ['promotion', '档期进度', overview.pTotal],
            ['rollout', '平台上翻', overview.rTotal],
          ] as [Tab, string, number][]).map(([t, label, count]) => (
            <button key={t} onClick={() => setTab(t)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                tab === t ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}>
              {label}
              <span className={`text-[11px] px-1.5 py-0.5 rounded-full ${tab === t ? 'bg-gray-100 text-gray-500' : 'bg-white/50 text-gray-400'}`}>{count}</span>
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="搜索产品..."
              className="pl-8 pr-3 py-2 border border-gray-200 rounded-xl text-sm w-44 focus:outline-none focus:border-gray-300 transition-colors" />
          </div>
          <button onClick={() => setModal({ type: tab, edit: null })}
            className="flex items-center gap-1.5 px-4 py-2 bg-starbucks-500 text-white rounded-xl text-sm font-medium hover:bg-starbucks-600 transition-colors shadow-sm">
            <Plus size={15} />新增
          </button>
        </div>
      </div>

      {/* ====== Tab Content ====== */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {tab === 'listing' && <ListingTable items={listings} setItems={setListings} search={search} />}
        {tab === 'promotion' && <PromoTable items={promos} setItems={setPromos} search={search} />}
        {tab === 'rollout' && <RolloutTable items={rollouts} setItems={setRollouts} search={search} />}

        {((tab === 'listing' && listings.length === 0) ||
          (tab === 'promotion' && promos.length === 0) ||
          (tab === 'rollout' && rollouts.length === 0)) && (
          <div className="py-20 text-center">
            <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-gray-50 flex items-center justify-center">
              <Package size={24} className="text-gray-300" />
            </div>
            <p className="text-sm text-gray-400 mb-1">暂无数据</p>
            <p className="text-xs text-gray-300">点击右上角「新增」按钮添加第一条记录</p>
          </div>
        )}
      </div>

      {/* ====== Modal ====== */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setModal(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-50 bg-gray-50/50">
              <h3 className="text-sm font-semibold text-gray-800">
                {modal.edit ? '编辑' : '新增'}
                {tab === 'listing' ? '上架产品' : tab === 'promotion' ? '档期活动' : '平台翻单'}
              </h3>
              <button onClick={() => setModal(null)} className="p-1.5 rounded-full hover:bg-gray-200 transition-colors">
                <X size={16} className="text-gray-400" />
              </button>
            </div>
            <FormBody modal={modal} setModal={setModal}
              listings={listings} setListings={setListings}
              promos={promos} setPromos={setPromos}
              rollouts={rollouts} setRollouts={setRollouts} />
          </div>
        </div>
      )}
    </div>
  );
}

/* ==================== Form ==================== */
function FormBody({ modal, setModal, listings, setListings, promos, setPromos, rollouts, setRollouts }: any) {
  const { type, edit } = modal;

  const defaults: Record<string, any> = {
    listing: { productName: '', supermarketId: 's1', targetDate: '', actualDate: '', status: 'negotiating', remark: '' },
    promotion: { productName: '', supermarketId: 's1', startDate: '', endDate: '', type: '', status: 'planned', remark: '' },
    rollout: { productName: '', platform: '', supermarketId: 's1', targetDate: '', actualDate: '', status: 'pending', remark: '' },
  };

  const [form, setForm] = useState(edit || defaults[type] || defaults.listing);

  const save = () => {
    if (!form.productName) return;
    const item = { ...form, id: edit?.id || genId() };
    if (type === 'listing') {
      setListings(edit ? listings.map((i: any) => i.id === edit.id ? item : i) : [...listings, item]);
    } else if (type === 'promotion') {
      setPromos(edit ? promos.map((i: any) => i.id === edit.id ? item : i) : [...promos, item]);
    } else {
      setRollouts(edit ? rollouts.map((i: any) => i.id === edit.id ? item : i) : [...rollouts, item]);
    }
    setModal(null);
  };

  const update = (k: string, v: any) => setForm({ ...form, [k]: v });

  const inputClass = "w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-gray-50 focus:outline-none focus:bg-white focus:border-gray-400 focus:ring-2 focus:ring-gray-100 transition-all";
  const labelClass = "text-[11px] text-gray-400 mb-1 block";

  return (
    <div className="p-6 space-y-4">
      <div>
        <label className={labelClass}>选择产品 *</label>
        <select value={form.productName} onChange={e => update('productName', e.target.value)} autoFocus className={inputClass}>
          <option value="">-- 选择 SKU --</option>
          {allProducts.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>商超系统</label>
          <select value={form.supermarketId} onChange={e => update('supermarketId', e.target.value)} className={inputClass}>
            {STORES.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>

        {type === 'promotion' ? (
          <div>
            <label className={labelClass}>活动类型</label>
            <input value={form.type || ''} onChange={e => update('type', e.target.value)}
              placeholder="堆头 / 端架 / 海报 / DM" className={inputClass} />
          </div>
        ) : type === 'rollout' ? (
          <div>
            <label className={labelClass}>平台名称</label>
            <input value={form.platform || ''} onChange={e => update('platform', e.target.value)}
              placeholder="多点 / 京东到家 / 美团" className={inputClass} />
          </div>
        ) : (
          <div>
            <label className={labelClass}>当前状态</label>
            <select value={form.status} onChange={e => update('status', e.target.value)} className={inputClass}>
              {L_STATUS.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
            </select>
          </div>
        )}
      </div>

      {(type === 'listing' || type === 'rollout') ? (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>{type === 'listing' ? '目标上架日期' : '目标上线日期'}</label>
            <input type="date" value={form.targetDate || ''} onChange={e => update('targetDate', e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>{type === 'listing' ? '实际上架日期' : '实际上线日期'}</label>
            <input type="date" value={form.actualDate || ''} onChange={e => update('actualDate', e.target.value)} className={inputClass} />
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>开始日期</label>
            <input type="date" value={form.startDate || ''} onChange={e => update('startDate', e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>结束日期</label>
            <input type="date" value={form.endDate || ''} onChange={e => update('endDate', e.target.value)} className={inputClass} />
          </div>
        </div>
      )}

      <div>
        <label className={labelClass}>备注</label>
        <input value={form.remark || ''} onChange={e => update('remark', e.target.value)}
          placeholder="选填备注信息" className={inputClass} />
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <button onClick={() => setModal(null)}
          className="px-5 py-2.5 text-sm text-gray-500 hover:bg-gray-50 rounded-xl transition-colors">取消</button>
        <button onClick={save}
          className="px-6 py-2.5 bg-gray-900 text-white rounded-xl text-sm font-medium hover:bg-gray-800 transition-colors shadow-sm">保存</button>
      </div>
    </div>
  );
}

/* ==================== Listing Table ==================== */
function ListingTable({ items, setItems, search }: { items: NewProductListing[]; setItems: (d: NewProductListing[]) => void; search: string }) {
  const filtered = useMemo(() => {
    if (!search) return items;
    const q = search.toLowerCase();
    return items.filter(i => i.productName.toLowerCase().includes(q));
  }, [items, search]);

  const del = (id: string) => setItems(items.filter(i => i.id !== id));
  const advance = (id: string) => {
    const item = items.find(i => i.id === id);
    if (!item || !NEXT.listing[item.status]) return;
    setItems(items.map(i => i.id === id ? {
      ...i,
      status: NEXT.listing[i.status] as NewProductListing['status'],
      actualDate: NEXT.listing[i.status] === 'listed' ? new Date().toISOString().slice(0, 10) : i.actualDate,
    } : i));
  };

  if (filtered.length === 0 && search) {
    return <div className="py-16 text-center text-gray-400 text-sm">没有找到匹配「{search}」的结果</div>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100 bg-gray-50/50">
            <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">产品名称</th>
            <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">商超</th>
            <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">状态</th>
            <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">目标日期</th>
            <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">实际上架</th>
            <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">备注</th>
            <th className="text-center px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider w-24">操作</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {filtered.map(i => {
            const cfg = statusConfig(i.status, 'listing');
            const s = storeById(i.supermarketId);
            return (
              <tr key={i.id} className="hover:bg-gray-50/30 transition-colors group">
                <td className="px-5 py-3.5">
                  <p className="font-medium text-gray-800">{i.productName}</p>
                </td>
                <td className="px-5 py-3.5">
                  {s && (
                    <span className="inline-flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }} />
                      <span className="text-gray-600">{s.name}</span>
                    </span>
                  )}
                </td>
                <td className="px-5 py-3.5">
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium"
                    style={{ backgroundColor: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}>
                    <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: cfg.color }} />
                    {cfg.label}
                  </span>
                </td>
                <td className="px-5 py-3.5 text-gray-500">{i.targetDate || '—'}</td>
                <td className="px-5 py-3.5 text-gray-500">{i.actualDate || '—'}</td>
                <td className="px-5 py-3.5 text-gray-400 text-xs max-w-[140px] truncate">{i.remark || '—'}</td>
                <td className="px-5 py-3.5">
                  <div className="flex items-center justify-center gap-1">
                    {NEXT.listing[i.status] && (
                      <button onClick={() => advance(i.id)}
                        className="text-[11px] text-starbucks-600 hover:bg-starbucks-50 px-2 py-1 rounded-lg transition-colors opacity-0 group-hover:opacity-100 font-medium">
                        推进
                      </button>
                    )}
                    <button onClick={() => del(i.id)}
                      className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ==================== Promo Table ==================== */
function PromoTable({ items, setItems, search }: { items: PromotionSlot[]; setItems: (d: PromotionSlot[]) => void; search: string }) {
  const filtered = useMemo(() => {
    if (!search) return items;
    const q = search.toLowerCase();
    return items.filter(i => i.productName.toLowerCase().includes(q) || i.type.toLowerCase().includes(q));
  }, [items, search]);

  const del = (id: string) => setItems(items.filter(i => i.id !== id));
  const advance = (id: string) => {
    const item = items.find(i => i.id === id);
    if (!item || !NEXT.promo[item.status]) return;
    setItems(items.map(i => i.id === id ? { ...i, status: NEXT.promo[i.status] as PromotionSlot['status'] } : i));
  };

  const upcoming = useMemo(() => {
    const now = new Date().toISOString().slice(0, 10);
    const week = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
    return filtered.filter(i => i.startDate >= now && i.startDate <= week && i.status !== 'done');
  }, [filtered]);

  if (filtered.length === 0 && search) {
    return <div className="py-16 text-center text-gray-400 text-sm">没有找到匹配「{search}」的结果</div>;
  }

  return (
    <div className="overflow-x-auto">
      {/* Upcoming alert */}
      {upcoming.length > 0 && (
        <div className="mx-5 mt-4 p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2">
          <AlertCircle size={16} className="text-amber-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-semibold text-amber-800">近期即将开始 ({upcoming.length} 个档期)</p>
            <p className="text-[11px] text-amber-600 mt-0.5">
              {upcoming.map(u => `${u.productName}@${storeById(u.supermarketId)?.name}(${u.startDate})`).join('、')}
            </p>
          </div>
        </div>
      )}

      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100 bg-gray-50/50">
            <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">产品名称</th>
            <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">商超</th>
            <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">活动类型</th>
            <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">档期</th>
            <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">状态</th>
            <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">备注</th>
            <th className="text-center px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider w-24">操作</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {filtered.map(i => {
            const cfg = statusConfig(i.status, 'promo');
            const s = storeById(i.supermarketId);
            return (
              <tr key={i.id} className="hover:bg-gray-50/30 transition-colors group">
                <td className="px-5 py-3.5 font-medium text-gray-800">{i.productName}</td>
                <td className="px-5 py-3.5">
                  {s && <span className="inline-flex items-center gap-1.5"><span className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }} />{s.name}</span>}
                </td>
                <td className="px-5 py-3.5">
                  {i.type ? <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{i.type}</span> : <span className="text-gray-300">—</span>}
                </td>
                <td className="px-5 py-3.5 text-gray-500 text-xs">
                  <span className="font-medium">{i.startDate || '?'}</span>
                  <span className="mx-1 text-gray-300">→</span>
                  <span className="font-medium">{i.endDate || '?'}</span>
                </td>
                <td className="px-5 py-3.5">
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium"
                    style={{ backgroundColor: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}>
                    <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: cfg.color }} />{cfg.label}
                  </span>
                </td>
                <td className="px-5 py-3.5 text-gray-400 text-xs max-w-[120px] truncate">{i.remark || '—'}</td>
                <td className="px-5 py-3.5">
                  <div className="flex items-center justify-center gap-1">
                    {NEXT.promo[i.status] && (
                      <button onClick={() => advance(i.id)}
                        className="text-[11px] text-starbucks-600 hover:bg-starbucks-50 px-2 py-1 rounded-lg transition-colors opacity-0 group-hover:opacity-100 font-medium">推进</button>
                    )}
                    <button onClick={() => del(i.id)}
                      className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ==================== Rollout Table ==================== */
function RolloutTable({ items, setItems, search }: { items: PlatformRollout[]; setItems: (d: PlatformRollout[]) => void; search: string }) {
  const filtered = useMemo(() => {
    if (!search) return items;
    const q = search.toLowerCase();
    return items.filter(i => i.productName.toLowerCase().includes(q) || i.platform.toLowerCase().includes(q));
  }, [items, search]);

  const del = (id: string) => setItems(items.filter(i => i.id !== id));
  const advance = (id: string) => {
    const item = items.find(i => i.id === id);
    if (!item || !NEXT.rollout[item.status]) return;
    setItems(items.map(i => i.id === id ? {
      ...i,
      status: NEXT.rollout[i.status] as PlatformRollout['status'],
      actualDate: NEXT.rollout[i.status] === 'online' ? new Date().toISOString().slice(0, 10) : i.actualDate,
    } : i));
  };

  // 品类上翻汇总
  const catSummary = useMemo(() => {
    const map: Record<string, { total: number; online: number; inProgress: number }> = {};
    for (const i of filtered) {
      const cat = i.productName.split(' ')[0] || '其他';
      if (!map[cat]) map[cat] = { total: 0, online: 0, inProgress: 0 };
      map[cat].total++;
      if (i.status === 'online') map[cat].online++;
      if (i.status === 'in_progress') map[cat].inProgress++;
    }
    return Object.entries(map).map(([cat, d]) => ({ cat, ...d })).sort((a, b) => b.total - a.total);
  }, [filtered]);

  // 各商超上翻单品数汇总
  const storeSummary = useMemo(() => {
    return STORES.map(s => {
      const items = filtered.filter(i => i.supermarketId === s.id);
      const online = items.filter(i => i.status === 'online').length;
      return { ...s, total: items.length, online };
    }).filter(s => s.total > 0).sort((a, b) => b.total - a.total);
  }, [filtered]);

  if (filtered.length === 0 && search) {
    return <div className="py-16 text-center text-gray-400 text-sm">没有找到匹配「{search}」的结果</div>;
  }

  return (
    <div>
      {/* 各商超上翻单品数 */}
      {storeSummary.length > 0 && (
        <div className="px-5 py-4 border-b border-gray-100 bg-gradient-to-r from-blue-50/50 to-white">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">各商超上翻单品数量</p>
          <div className="flex flex-wrap gap-3">
            {storeSummary.map(s => (
              <div key={s.id} className="bg-white rounded-xl border border-gray-100 shadow-sm px-4 py-2.5 flex items-center gap-3">
                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: s.color }} />
                <span className="text-xs font-bold text-gray-700">{s.name}</span>
                <span className="text-[11px] text-gray-500">{s.total} 个 SKU 上翻</span>
                <span className="text-[11px] text-emerald-600">已上线 {s.online}</span>
                <div className="w-20 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${s.total > 0 ? (s.online / s.total) * 100 : 0}%`, backgroundColor: s.color }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {catSummary.length > 0 && (
        <div className="px-5 py-4 border-b border-gray-100 bg-gradient-to-r from-violet-50/50 to-white">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">品类上翻数量汇总</p>
          <div className="flex flex-wrap gap-3">
            {catSummary.map(c => (
              <div key={c.cat} className="bg-white rounded-xl border border-gray-100 shadow-sm px-4 py-2.5 flex items-center gap-3">
                <span className="text-xs font-bold text-gray-700">{c.cat}</span>
                <span className="text-[11px] text-gray-500">总计 <b className="text-gray-800">{c.total}</b></span>
                <span className="text-[11px] text-emerald-600">已上线 <b>{c.online}</b></span>
                <span className="text-[11px] text-blue-500">推进中 <b>{c.inProgress}</b></span>
                <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-violet-400 rounded-full" style={{ width: `${c.total > 0 ? (c.online / c.total) * 100 : 0}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100 bg-gray-50/50">
            <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">产品名称</th>
            <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">平台</th>
            <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">商超</th>
            <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">目标日期</th>
            <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">实际上线</th>
            <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">状态</th>
            <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">备注</th>
            <th className="text-center px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider w-24">操作</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {filtered.map(i => {
            const cfg = statusConfig(i.status, 'rollout');
            const s = storeById(i.supermarketId);
            return (
              <tr key={i.id} className="hover:bg-gray-50/30 transition-colors group">
                <td className="px-5 py-3.5 font-medium text-gray-800">{i.productName}</td>
                <td className="px-5 py-3.5">
                  {i.platform ? (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-violet-600 bg-violet-50 px-2.5 py-1 rounded-full">
                      <Globe size={11} />{i.platform}
                    </span>
                  ) : <span className="text-gray-300">—</span>}
                </td>
                <td className="px-5 py-3.5">
                  {s && <span className="inline-flex items-center gap-1.5"><span className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }} />{s.name}</span>}
                </td>
                <td className="px-5 py-3.5 text-gray-500">{i.targetDate || '—'}</td>
                <td className="px-5 py-3.5 text-gray-500">{i.actualDate || '—'}</td>
                <td className="px-5 py-3.5">
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium"
                    style={{ backgroundColor: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}>
                    <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: cfg.color }} />{cfg.label}
                  </span>
                </td>
                <td className="px-5 py-3.5 text-gray-400 text-xs max-w-[120px] truncate">{i.remark || '—'}</td>
                <td className="px-5 py-3.5">
                  <div className="flex items-center justify-center gap-1">
                    {NEXT.rollout[i.status] && (
                      <button onClick={() => advance(i.id)}
                        className="text-[11px] text-starbucks-600 hover:bg-starbucks-50 px-2 py-1 rounded-lg transition-colors opacity-0 group-hover:opacity-100 font-medium">推进</button>
                    )}
                    <button onClick={() => del(i.id)}
                      className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
    </div>
  );
}
