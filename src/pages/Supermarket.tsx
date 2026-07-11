import { useState, useMemo, useEffect } from 'react';
import { Plus, X, Search, AlertCircle, Trash2, CheckCircle2, Calendar, Globe, Package, Store } from 'lucide-react';
import type { NewProductListing, PromotionSlot, PlatformRollout } from '../types/supermarket';
import { supabase } from '../lib/supabase';
import { products as allProducts } from '../data/mockData';

const STORES = [
  { id: 's1', name: '唐百', color: '#3b82f6', gradient: 'from-blue-400 to-blue-600', bg: 'bg-blue-50' },
  { id: 's2', name: '兆丰', color: '#f59e0b', gradient: 'from-amber-400 to-amber-600', bg: 'bg-amber-50' },
  { id: 's3', name: '兴龙广缘', color: '#10b981', gradient: 'from-emerald-400 to-emerald-600', bg: 'bg-emerald-50' },
  { id: 's4', name: '宽广', color: '#8b5cf6', gradient: 'from-violet-400 to-violet-600', bg: 'bg-violet-50' },
  { id: 's5', name: '福满家', color: '#ef4444', gradient: 'from-red-400 to-red-600', bg: 'bg-red-50' },
  { id: 's6', name: '宽广购', color: '#06b6d4', gradient: 'from-cyan-400 to-cyan-600', bg: 'bg-cyan-50' },
];
const storeById = (id: string) => STORES.find(s => s.id === id);
function genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

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

  useEffect(() => {
    (async () => {
      const [l, p, r] = await Promise.all([
        supabase.from('sm_listing').select('*'), supabase.from('sm_promotion').select('*'), supabase.from('sm_rollout').select('*'),
      ]);
      setListings((l.data || []).map((r: any) => r.data));
      setPromos((p.data || []).map((r: any) => r.data));
      setRollouts((r.data || []).map((r: any) => r.data));
      setSmLoaded(true);
    })();
  }, []);
  useEffect(() => { if (smLoaded) supabase.from('sm_listing').upsert(listings.map(d => ({ id: d.id || genId(), data: d })), { onConflict: 'id' }).then(() => {}); }, [listings]);
  useEffect(() => { if (smLoaded) supabase.from('sm_promotion').upsert(promos.map(d => ({ id: d.id || genId(), data: d })), { onConflict: 'id' }).then(() => {}); }, [promos]);
  useEffect(() => { if (smLoaded) supabase.from('sm_rollout').upsert(rollouts.map(d => ({ id: d.id || genId(), data: d })), { onConflict: 'id' }).then(() => {}); }, [rollouts]);

  const report = useMemo(() => {
    const lDone = listings.filter(l => l.status === 'listed').length;
    const rDone = rollouts.filter(r => r.status === 'online').length;
    const pActive = promos.filter(p => p.status === 'executing' || p.status === 'confirmed').length;

    const stores = STORES.map(s => ({
      ...s,
      listingTotal: listings.filter(l => l.supermarketId === s.id).length,
      listingDone: listings.filter(l => l.supermarketId === s.id && l.status === 'listed').length,
      listingApproved: listings.filter(l => l.supermarketId === s.id && l.status === 'approved').length,
      listingNeg: listings.filter(l => l.supermarketId === s.id && l.status === 'negotiating').length,
      rolloutTotal: rollouts.filter(r => r.supermarketId === s.id).length,
      rolloutDone: rollouts.filter(r => r.supermarketId === s.id && r.status === 'online').length,
      rolloutProg: rollouts.filter(r => r.supermarketId === s.id && r.status === 'in_progress').length,
      promoTotal: promos.filter(p => p.supermarketId === s.id).length,
      promoActive: promos.filter(p => p.supermarketId === s.id && (p.status === 'executing' || p.status === 'confirmed')).length,
    }));

    const stuckListing = listings.filter(l => l.status === 'negotiating' && !l.targetDate);
    const recentListed = listings.filter(l => l.status === 'listed' && l.actualDate).sort((a, b) => b.actualDate.localeCompare(a.actualDate)).slice(0, 4);
    const recentOnline = rollouts.filter(r => r.status === 'online' && r.actualDate).sort((a, b) => b.actualDate.localeCompare(a.actualDate)).slice(0, 4);
    const now = new Date().toISOString().slice(0, 10);
    const upcomingPromos = promos.filter(p => p.startDate >= now && p.status !== 'done').sort((a, b) => a.startDate.localeCompare(b.startDate)).slice(0, 5);
    const totalSkus = new Set([...listings.map(l => l.productName), ...rollouts.map(r => r.productName), ...promos.map(p => p.productName)]).size;

    return { lDone, rDone, pActive, stores, stuckListing, recentListed, recentOnline, upcomingPromos, totalSkus,
      lTotal: listings.length, rTotal: rollouts.length, pTotal: promos.length };
  }, [listings, promos, rollouts]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">

        {/* ====== Header ====== */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-800 tracking-tight">商超渠道管理</h1>
            <p className="text-sm text-gray-400 mt-0.5">{new Date().toLocaleDateString('zh-CN')} · 覆盖 {STORES.length} 家商超系统 · {report.totalSkus} 个在跟品项</p>
          </div>
          <button onClick={() => setModal({ type: tab, edit: null })}
            className="flex items-center gap-1.5 px-5 py-2.5 bg-gray-900 text-white rounded-xl text-sm font-medium hover:bg-gray-800 shadow-lg shadow-gray-200 transition-all">
            <Plus size={16} />新增记录
          </button>
        </div>

        {/* ====== KPI Cards ====== */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          {[
            { label: '在跟品项', value: report.totalSkus, unit: 'SKU', icon: Package, color: 'text-slate-600', bg: 'bg-slate-50', ring: 'ring-slate-100' },
            { label: '上架完成率', value: report.lTotal > 0 ? Math.round((report.lDone / report.lTotal) * 100) : 0, unit: '%', icon: Store, color: 'text-blue-600', bg: 'bg-blue-50', ring: 'ring-blue-100',
              sub: `${report.lDone}/${report.lTotal}`, subLabel: '已上架/总数' },
            { label: '翻单完成率', value: report.rTotal > 0 ? Math.round((report.rDone / report.rTotal) * 100) : 0, unit: '%', icon: Globe, color: 'text-violet-600', bg: 'bg-violet-50', ring: 'ring-violet-100',
              sub: `${report.rDone}/${report.rTotal}`, subLabel: '已上线/总数' },
            { label: '进行中档期', value: report.pActive, unit: '个', icon: Calendar, color: 'text-amber-600', bg: 'bg-amber-50', ring: 'ring-amber-100',
              sub: `共 ${report.pTotal} 个`, subLabel: '档期总数' },
            { label: '待办卡点', value: report.stuckListing.length, unit: '项', icon: AlertCircle, color: report.stuckListing.length > 0 ? 'text-red-600' : 'text-emerald-600', bg: report.stuckListing.length > 0 ? 'bg-red-50' : 'bg-emerald-50', ring: report.stuckListing.length > 0 ? 'ring-red-100' : 'ring-emerald-100',
              sub: report.stuckListing.length > 0 ? '需关注' : '无异常', subLabel: '' },
          ].map(k => (
            <div key={k.label} className={`relative overflow-hidden bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow p-5 ring-1 ${k.ring}`}>
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{k.label}</p>
                <div className={`w-9 h-9 rounded-xl ${k.bg} flex items-center justify-center`}>
                  <k.icon size={18} className={k.color} />
                </div>
              </div>
              <p className="text-3xl font-bold text-gray-800 tracking-tight">
                {k.value}<span className="text-lg font-normal text-gray-400 ml-0.5">{k.unit}</span>
              </p>
              {k.sub && <p className="text-xs text-gray-400 mt-1">{k.sub} <span className="text-gray-300">{k.subLabel}</span></p>}
              {/* Progress bar for percentage metrics */}
              {(k.label === '上架完成率' || k.label === '翻单完成率') && (
                <div className="mt-3 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full bg-gradient-to-r ${k.label === '上架完成率' ? 'from-blue-400 to-blue-600' : 'from-violet-400 to-violet-600'} transition-all duration-700`}
                    style={{ width: `${k.value}%` }} />
                </div>
              )}
            </div>
          ))}
        </div>

        {/* ====== Per-Store Progress ====== */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-50 flex items-center justify-between">
            <h2 className="text-sm font-bold text-gray-700">各商超推进总览</h2>
            <span className="text-[11px] text-gray-400">新品上架 · 平台翻单 · 档期活动</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-px bg-gray-50">
            {report.stores.map(s => {
              const rpct = s.rolloutTotal > 0 ? Math.round((s.rolloutDone / s.rolloutTotal) * 100) : 0;
              return (
                <div key={s.id} className="bg-white p-4 hover:bg-gray-50/30 transition-colors">
                  <div className="flex items-center gap-2 mb-3">
                    <div className={`w-8 h-8 rounded-xl ${s.bg} flex items-center justify-center text-sm font-bold`} style={{ color: s.color }}>{s.name.charAt(0)}</div>
                    <p className="text-xs font-bold text-gray-800">{s.name}</p>
                  </div>
                  <div className="space-y-2">
                    {/* Listing */}
                    <div>
                      <div className="flex justify-between text-[10px] mb-0.5"><span className="text-gray-400">上架</span><span className="font-medium text-gray-600">{s.listingDone}/{s.listingTotal}</span></div>
                      <div className="flex gap-0.5">
                        <div className="flex-1 h-1 rounded-full" style={{ backgroundColor: s.listingNeg > 0 ? L_STATUS[0].color : '#f3f4f6' }} />
                        <div className="flex-1 h-1 rounded-full" style={{ backgroundColor: s.listingApproved > 0 ? L_STATUS[1].color : '#f3f4f6' }} />
                        <div className="flex-1 h-1 rounded-full" style={{ backgroundColor: s.listingDone > 0 ? L_STATUS[2].color : '#f3f4f6' }} />
                      </div>
                    </div>
                    {/* Rollout */}
                    <div>
                      <div className="flex justify-between text-[10px] mb-0.5"><span className="text-gray-400">翻单</span><span className="font-medium text-gray-600">{s.rolloutDone}/{s.rolloutTotal}</span></div>
                      <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full rounded-full bg-gradient-to-r from-violet-400 to-violet-500 transition-all" style={{ width: `${rpct}%` }} />
                      </div>
                    </div>
                    {/* Promo */}
                    <div>
                      <div className="flex justify-between text-[10px] mb-0.5"><span className="text-gray-400">档期</span><span className="font-medium text-gray-600">{s.promoActive}/{s.promoTotal}</span></div>
                      <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full rounded-full bg-gradient-to-r from-amber-400 to-amber-500 transition-all"
                          style={{ width: `${s.promoTotal > 0 ? (s.promoActive / s.promoTotal) * 100 : 0}%` }} />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ====== Alerts & Timeline ====== */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Stuck items */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-xl bg-red-50 flex items-center justify-center"><AlertCircle size={16} className="text-red-500" /></div>
              <div><h3 className="text-sm font-bold text-gray-700">待办卡点</h3><p className="text-[10px] text-gray-400">需协调推进的项目</p></div>
              <span className="ml-auto text-lg font-bold text-red-500">{report.stuckListing.length}</span>
            </div>
            {report.stuckListing.length > 0 ? (
              <div className="space-y-2">
                {report.stuckListing.map(i => (
                  <div key={i.id} className="flex items-center gap-3 p-2.5 bg-red-50/50 rounded-xl border border-red-100">
                    <div className="w-1.5 h-1.5 rounded-full bg-red-400 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-gray-800 truncate">{i.productName}</p>
                      <p className="text-[10px] text-gray-500">{storeById(i.supermarketId)?.name} · 未设定目标日期</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex items-center justify-center py-6 text-emerald-500">
                <CheckCircle2 size={20} className="mr-2" />
                <span className="text-xs">所有项目正常推进中</span>
              </div>
            )}
          </div>

          {/* Recent completions */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-xl bg-emerald-50 flex items-center justify-center"><CheckCircle2 size={16} className="text-emerald-500" /></div>
              <div><h3 className="text-sm font-bold text-gray-700">近期完成</h3><p className="text-[10px] text-gray-400">最新上架 & 上线记录</p></div>
            </div>
            <div className="space-y-2.5">
              {report.recentListed.length === 0 && report.recentOnline.length === 0 && (
                <p className="text-xs text-gray-300 text-center py-4">暂无完成记录</p>
              )}
              {[...report.recentListed.map((i: any) => ({ ...i, _type: 'listed' })), ...report.recentOnline.map((i: any) => ({ ...i, _type: 'online' }))]
                .sort((a: any, b: any) => b.actualDate.localeCompare(a.actualDate)).slice(0, 6)
                .map((i: any) => (
                  <div key={i.id} className="flex items-center gap-3">
                    <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${i._type === 'listed' ? 'bg-blue-400' : 'bg-violet-400'}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-gray-700 truncate">{i.productName}</p>
                      <p className="text-[10px] text-gray-400">{storeById(i.supermarketId)?.name}</p>
                    </div>
                    <span className="text-[10px] text-gray-400 whitespace-nowrap">{i.actualDate}</span>
                  </div>
              ))}
            </div>
          </div>

          {/* Upcoming promos */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-xl bg-amber-50 flex items-center justify-center"><Calendar size={16} className="text-amber-500" /></div>
              <div><h3 className="text-sm font-bold text-gray-700">即将开始档期</h3><p className="text-[10px] text-gray-400">未来 7 天待执行</p></div>
            </div>
            {report.upcomingPromos.length > 0 ? (
              <div className="space-y-2.5">
                {report.upcomingPromos.map((p: any) => (
                  <div key={p.id} className="flex items-center gap-3 p-2.5 bg-amber-50/50 rounded-xl border border-amber-100">
                    <div className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-gray-800 truncate">{p.productName}</p>
                      <p className="text-[10px] text-gray-500">{storeById(p.supermarketId)?.name} · {p.type || '档期'}</p>
                    </div>
                    <span className="text-[10px] font-bold text-amber-600 whitespace-nowrap">{p.startDate}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-300 text-center py-4">暂无即将开始的档期</p>
            )}
          </div>
        </div>

        {/* ====== Tab Area ====== */}
        <div className="flex items-center justify-between">
          <div className="flex bg-gray-100 rounded-xl p-1">
            {([
              ['listing', '新品上架', report.lTotal],
              ['promotion', '档期进度', report.pTotal],
              ['rollout', '平台上翻', report.rTotal],
            ] as [Tab, string, number][]).map(([t, label, count]) => (
              <button key={t} onClick={() => setTab(t)}
                className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium transition-all ${tab === t ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                {label}<span className={`text-[11px] px-1.5 py-0.5 rounded-full ${tab === t ? 'bg-gray-100 text-gray-500' : 'bg-white/50 text-gray-400'}`}>{count}</span>
              </button>
            ))}
          </div>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="搜索品项..." className="pl-8 pr-3 py-2 border border-gray-200 rounded-xl text-sm w-44 focus:outline-none focus:border-gray-300 transition-colors" />
          </div>
        </div>

        {/* ====== Detail Table ====== */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          {tab === 'listing' && <DetailTable type="listing" items={listings} setItems={setListings} search={search} />}
          {tab === 'promotion' && <DetailTable type="promo" items={promos} setItems={setPromos} search={search} />}
          {tab === 'rollout' && <DetailTable type="rollout" items={rollouts} setItems={setRollouts} search={search} />}
          {((tab === 'listing' && listings.length === 0) || (tab === 'promotion' && promos.length === 0) || (tab === 'rollout' && rollouts.length === 0)) && (
            <div className="py-16 text-center">
              <div className="w-12 h-12 mx-auto mb-3 rounded-2xl bg-gray-50 flex items-center justify-center"><Package size={22} className="text-gray-300" /></div>
              <p className="text-sm text-gray-400">暂无数据</p>
              <p className="text-xs text-gray-300 mt-1">点击上方「新增记录」开始录入</p>
            </div>
          )}
        </div>

        {/* ====== Modal ====== */}
        {modal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setModal(null)} />
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-50 bg-gray-50/50">
                <h3 className="text-sm font-semibold text-gray-800">{modal.edit ? '编辑' : '新增'}{tab === 'listing' ? '上架产品' : tab === 'promotion' ? '档期活动' : '平台翻单'}</h3>
                <button onClick={() => setModal(null)} className="p-1.5 rounded-full hover:bg-gray-200"><X size={16} className="text-gray-400" /></button>
              </div>
              <FormBody modal={modal} setModal={setModal} listings={listings} setListings={setListings} promos={promos} setPromos={setPromos} rollouts={rollouts} setRollouts={setRollouts} />
            </div>
          </div>
        )}
      </div>
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
    if (type === 'listing') setListings(edit ? listings.map((i: any) => i.id === edit.id ? item : i) : [...listings, item]);
    else if (type === 'promotion') setPromos(edit ? promos.map((i: any) => i.id === edit.id ? item : i) : [...promos, item]);
    else setRollouts(edit ? rollouts.map((i: any) => i.id === edit.id ? item : i) : [...rollouts, item]);
    setModal(null);
  };
  const update = (k: string, v: any) => setForm({ ...form, [k]: v });
  const cls = "w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-gray-50 focus:outline-none focus:bg-white focus:border-gray-400 transition-all";
  const lbl = "text-[11px] text-gray-400 mb-1 block font-medium";

  return (
    <div className="p-6 space-y-4">
      <div>
        <label className={lbl}>选择品项 *</label>
        <select value={form.productName} onChange={e => update('productName', e.target.value)} autoFocus className={cls}>
          <option value="">-- 选择 SKU --</option>
          {allProducts.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div><label className={lbl}>商超系统</label><select value={form.supermarketId} onChange={e => update('supermarketId', e.target.value)} className={cls}>{STORES.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
        {type === 'promotion' ? <div><label className={lbl}>活动类型</label><input value={form.type || ''} onChange={e => update('type', e.target.value)} placeholder="堆头/端架/海报" className={cls} /></div>
        : type === 'rollout' ? <div><label className={lbl}>平台名称</label><input value={form.platform || ''} onChange={e => update('platform', e.target.value)} placeholder="多点/京东到家/美团" className={cls} /></div>
        : <div><label className={lbl}>当前状态</label><select value={form.status} onChange={e => update('status', e.target.value)} className={cls}>{L_STATUS.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}</select></div>}
      </div>
      {(type === 'listing' || type === 'rollout') ? (
        <div className="grid grid-cols-2 gap-4">
          <div><label className={lbl}>{type === 'listing' ? '目标上架日期' : '目标上线日期'}</label><input type="date" value={form.targetDate || ''} onChange={e => update('targetDate', e.target.value)} className={cls} /></div>
          <div><label className={lbl}>{type === 'listing' ? '实际上架日期' : '实际上线日期'}</label><input type="date" value={form.actualDate || ''} onChange={e => update('actualDate', e.target.value)} className={cls} /></div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          <div><label className={lbl}>开始日期</label><input type="date" value={form.startDate || ''} onChange={e => update('startDate', e.target.value)} className={cls} /></div>
          <div><label className={lbl}>结束日期</label><input type="date" value={form.endDate || ''} onChange={e => update('endDate', e.target.value)} className={cls} /></div>
        </div>
      )}
      <div><label className={lbl}>备注</label><input value={form.remark || ''} onChange={e => update('remark', e.target.value)} placeholder="选填备注信息" className={cls} /></div>
      <div className="flex justify-end gap-3 pt-2">
        <button onClick={() => setModal(null)} className="px-5 py-2.5 text-sm text-gray-500 hover:bg-gray-50 rounded-xl transition-colors">取消</button>
        <button onClick={save} className="px-6 py-2.5 bg-gray-900 text-white rounded-xl text-sm font-medium hover:bg-gray-800 shadow-sm transition-colors">保存</button>
      </div>
    </div>
  );
}

/* ==================== Detail Table ==================== */
function DetailTable({ type, items, setItems, search }: { type: string; items: any[]; setItems: (d: any[]) => void; search: string }) {
  const filtered = useMemo(() => {
    if (!search) return items;
    const q = search.toLowerCase();
    return items.filter((i: any) => i.productName?.toLowerCase().includes(q) || i.platform?.toLowerCase().includes(q));
  }, [items, search]);
  const del = (id: string) => setItems(items.filter((i: any) => i.id !== id));
  const advance = (id: string) => {
    const item = items.find((i: any) => i.id === id);
    const nextMap = type === 'listing' ? NEXT.listing : type === 'promo' ? NEXT.promo : NEXT.rollout;
    if (!item || !nextMap[item.status]) return;
    const newStatus = nextMap[item.status];
    setItems(items.map((i: any) => i.id === id ? { ...i, status: newStatus, actualDate: (newStatus === 'listed' || newStatus === 'online') ? new Date().toISOString().slice(0, 10) : i.actualDate } : i));
  };

  if (filtered.length === 0 && search) return <div className="py-16 text-center text-gray-400 text-sm">未找到匹配结果</div>;
  if (filtered.length === 0) return null;

  const statusList = type === 'listing' ? L_STATUS : type === 'promo' ? P_STATUS : R_STATUS;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-50/30 border-b border-gray-100">
            <th className="text-left px-6 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">品项名称</th>
            {type === 'rollout' && <th className="text-left px-4 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">平台</th>}
            <th className="text-left px-4 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">商超</th>
            {type === 'promo' && <th className="text-left px-4 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">类型</th>}
            <th className="text-left px-4 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">状态</th>
            {type !== 'promo' && <><th className="text-left px-4 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">目标日期</th><th className="text-left px-4 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">实际日期</th></>}
            {type === 'promo' && <th className="text-left px-4 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">档期时间</th>}
            <th className="text-left px-4 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">备注</th>
            <th className="text-center px-3 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider w-24">操作</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {filtered.map((i: any) => {
            const cfg = statusList.find(s => s.key === i.status);
            return (
              <tr key={i.id} className="hover:bg-gray-50/30 transition-colors group">
                <td className="px-6 py-3.5 text-xs font-medium text-gray-800">{i.productName}</td>
                {type === 'rollout' && <td className="px-4 py-3.5 text-xs font-medium text-violet-600">{i.platform || '—'}</td>}
                <td className="px-4 py-3.5 text-xs text-gray-600">{storeById(i.supermarketId)?.name || '—'}</td>
                {type === 'promo' && <td className="px-4 py-3.5 text-xs text-gray-500">{i.type || '—'}</td>}
                <td className="px-4 py-3.5">
                  {cfg && (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-medium border"
                      style={{ backgroundColor: cfg.bg, color: cfg.color, borderColor: cfg.border }}>
                      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: cfg.color }} />{cfg.label}
                    </span>
                  )}
                </td>
                {type !== 'promo' && <><td className="px-4 py-3.5 text-xs text-gray-500">{i.targetDate || '—'}</td><td className="px-4 py-3.5 text-xs text-gray-500">{i.actualDate || '—'}</td></>}
                {type === 'promo' && <td className="px-4 py-3.5 text-xs text-gray-500">{i.startDate || '?'} → {i.endDate || '?'}</td>}
                <td className="px-4 py-3.5 text-xs text-gray-400 max-w-[120px] truncate">{i.remark || '—'}</td>
                <td className="px-3 py-3.5">
                  <div className="flex items-center justify-center gap-1">
                    {((type === 'listing' ? NEXT.listing : type === 'promo' ? NEXT.promo : NEXT.rollout) as any)[i.status] && (
                      <button onClick={() => advance(i.id)} className="text-[10px] text-starbucks-600 hover:bg-starbucks-50 px-2 py-0.5 rounded font-medium opacity-0 group-hover:opacity-100 transition-opacity">推进</button>
                    )}
                    <button onClick={() => del(i.id)} className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 size={14} /></button>
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
