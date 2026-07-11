import { useState, useMemo, useEffect } from 'react';
import { Plus, X, Search, Calendar, Globe, Package, AlertCircle, Trash2 } from 'lucide-react';
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

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-7xl mx-auto">
      {/* ====== Header ====== */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-gray-800">商超渠道管理系统</h1>
          <p className="text-xs text-gray-400 mt-0.5">{new Date().toLocaleDateString('zh-CN')} · 覆盖 {STORES.length} 家商超系统</p>
        </div>
      </div>

      {/* ====== 简洁概览 ====== */}
      <div className="flex flex-wrap items-center gap-4 bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-3">
        <div className="flex items-center gap-2 text-sm">
          <Package size={16} className="text-blue-500" />
          <span className="text-gray-600">新品上架</span>
          <span className="font-bold text-gray-800">{overview.lDone}/{overview.lTotal}</span>
          {overview.lTotal > 0 && <span className="text-[11px] text-blue-500 font-medium">{Math.round((overview.lDone/overview.lTotal)*100)}%</span>}
        </div>
        <span className="text-gray-200">|</span>
        <div className="flex items-center gap-2 text-sm">
          <Globe size={16} className="text-violet-500" />
          <span className="text-gray-600">平台翻单</span>
          <span className="font-bold text-gray-800">{overview.rDone}/{overview.rTotal}</span>
          {overview.rTotal > 0 && <span className="text-[11px] text-violet-500 font-medium">{Math.round((overview.rDone/overview.rTotal)*100)}%</span>}
        </div>
        <span className="text-gray-200">|</span>
        <div className="flex items-center gap-2 text-sm">
          <Calendar size={16} className="text-amber-500" />
          <span className="text-gray-600">档期活动</span>
          <span className="font-bold text-gray-800">{overview.pTotal} 个</span>
          {overview.pActive > 0 && <span className="text-[11px] text-amber-500 font-medium">{overview.pActive} 进行中</span>}
        </div>
        <div className="flex-1" />
        <div className="flex items-center gap-3">
          {overview.storesData.filter(s => s.rollout > 0 || s.listing > 0).map(s => (
            <div key={s.id} className="flex items-center gap-1.5 text-xs">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }} />
              <span className="text-gray-500">{s.name}</span>
              <span className="font-medium text-gray-700">{s.online}/{s.rollout}</span>
            </div>
          ))}
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

/* ==================== Listing Cards ==================== */
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
  const updateRemark = (id: string, remark: string) => {
    setItems(items.map(i => i.id === id ? { ...i, remark } : i));
  };

  // Group by status for progress overview
  const groups = useMemo(() => L_STATUS.map(s => ({
    ...s, items: filtered.filter(i => i.status === s.key),
  })), [filtered]);

  if (filtered.length === 0 && search) {
    return <div className="py-16 text-center text-gray-400 text-sm">没有找到匹配「{search}」的结果</div>;
  }

  return (
    <div>
      {/* Progress stepper header */}
      <div className="px-5 py-4 border-b border-gray-100 bg-gray-50/30">
        <div className="flex items-center gap-2">
          {L_STATUS.map((s, idx) => (
            <div key={s.key} className="flex items-center gap-2">
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium ${s.bg} border`} style={{ borderColor: s.border, color: s.color }}>
                <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold" style={{ backgroundColor: s.color, color: '#fff' }}>{groups[idx].items.length}</span>
                {s.label}
              </div>
              {idx < L_STATUS.length - 1 && <div className="w-6 h-px bg-gray-200" />}
            </div>
          ))}
        </div>
      </div>

      {/* Card grid */}
      <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {filtered.map(i => {
          const cfg = statusConfig(i.status, 'listing');
          const s = storeById(i.supermarketId);
          const stepIdx = L_STATUS.findIndex(x => x.key === i.status);
          return (
            <div key={i.id} className="bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow p-4 group">
              {/* Header: SKU + Store */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-gray-800 truncate">{i.productName}</p>
                  <div className="flex items-center gap-2 mt-1">
                    {s && <span className="inline-flex items-center gap-1 text-[11px] text-gray-500"><span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: s.color }} />{s.name}</span>}
                  </div>
                </div>
                <button onClick={() => del(i.id)} className="text-gray-300 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 size={14} /></button>
              </div>

              {/* Progress stepper */}
              <div className="flex items-center gap-1 mb-3">
                {L_STATUS.map((st, idx) => (
                  <div key={st.key} className="flex items-center gap-1 flex-1">
                    <button
                      onClick={() => idx <= stepIdx + 1 && idx > stepIdx ? advance(i.id) : null}
                      className={`flex-1 h-1.5 rounded-full transition-all ${idx <= stepIdx ? '' : 'bg-gray-100'}`}
                      style={idx <= stepIdx ? { backgroundColor: st.color } : {}}
                      title={st.label}
                    />
                  </div>
                ))}
              </div>
              <div className="flex justify-between text-[10px] text-gray-400 mb-3">
                <span>洽谈</span><span>通过</span><span>已上架</span>
              </div>

              {/* Dates */}
              <div className="flex justify-between text-[11px] text-gray-500 mb-3">
                <span>目标: {i.targetDate || '—'}</span>
                <span>实际: {i.actualDate || '—'}</span>
              </div>

              {/* Remark */}
              <div>
                <textarea
                  value={i.remark || ''}
                  onChange={e => updateRemark(i.id, e.target.value)}
                  placeholder="备注描述..."
                  rows={2}
                  className="w-full text-[11px] border border-gray-100 rounded-lg px-2 py-1.5 resize-none bg-gray-50 focus:outline-none focus:border-gray-300 focus:bg-white transition-colors"
                />
              </div>

              {/* Quick advance */}
              {NEXT.listing[i.status] && (
                <button onClick={() => advance(i.id)}
                  className="mt-2 w-full py-1.5 text-[11px] font-medium text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{ backgroundColor: cfg.color }}>
                  推进到 {L_STATUS[stepIdx + 1]?.label}
                </button>
              )}
            </div>
          );
        })}
      </div>
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

  if (filtered.length === 0 && search) {
    return <div className="py-16 text-center text-gray-400 text-sm">没有找到匹配「{search}」的结果</div>;
  }

  return (
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
  );
}
