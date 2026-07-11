import { useState, useMemo, useEffect } from 'react';
import { Plus, X, Search, Calendar, AlertCircle, Trash2, CheckCircle2 } from 'lucide-react';
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

const L_STATUS = [
  { key: 'negotiating', label: '洽谈中', color: '#f59e0b', bg: '#fffbeb' },
  { key: 'approved', label: '已通过', color: '#3b82f6', bg: '#eff6ff' },
  { key: 'listed', label: '已上架', color: '#10b981', bg: '#ecfdf5' },
];
const P_STATUS = [
  { key: 'planned', label: '已规划', color: '#6b7280', bg: '#f9fafb' },
  { key: 'confirmed', label: '已确认', color: '#3b82f6', bg: '#eff6ff' },
  { key: 'executing', label: '执行中', color: '#f59e0b', bg: '#fffbeb' },
  { key: 'done', label: '已完成', color: '#10b981', bg: '#ecfdf5' },
];
const R_STATUS = [
  { key: 'pending', label: '待处理', color: '#6b7280', bg: '#f9fafb' },
  { key: 'in_progress', label: '推进中', color: '#3b82f6', bg: '#eff6ff' },
  { key: 'online', label: '已上线', color: '#10b981', bg: '#ecfdf5' },
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

  // ---- Computed ----
  const report = useMemo(() => {
    const lDone = listings.filter(l => l.status === 'listed').length;
    const rDone = rollouts.filter(r => r.status === 'online').length;
    const pActive = promos.filter(p => p.status === 'executing' || p.status === 'confirmed').length;

    // Per store
    const stores = STORES.map(s => ({
      ...s,
      listingTotal: listings.filter(l => l.supermarketId === s.id).length,
      listingDone: listings.filter(l => l.supermarketId === s.id && l.status === 'listed').length,
      listingApproved: listings.filter(l => l.supermarketId === s.id && l.status === 'approved').length,
      listingNeg: listings.filter(l => l.supermarketId === s.id && l.status === 'negotiating').length,
      rolloutTotal: rollouts.filter(r => r.supermarketId === s.id).length,
      rolloutDone: rollouts.filter(r => r.supermarketId === s.id && r.status === 'online').length,
      promoTotal: promos.filter(p => p.supermarketId === s.id).length,
      promoActive: promos.filter(p => p.supermarketId === s.id && (p.status === 'executing' || p.status === 'confirmed')).length,
    }));

    // Stuck items (listing: negotiating for too long, no target date)
    const stuckListing = listings.filter(l => l.status === 'negotiating' && !l.targetDate);

    // Recent completions
    const recentListed = listings.filter(l => l.status === 'listed' && l.actualDate).sort((a, b) => b.actualDate.localeCompare(a.actualDate)).slice(0, 5);
    const recentOnline = rollouts.filter(r => r.status === 'online' && r.actualDate).sort((a, b) => b.actualDate.localeCompare(a.actualDate)).slice(0, 5);

    // Upcoming promos
    const now = new Date().toISOString().slice(0, 10);
    const upcomingPromos = promos.filter(p => p.startDate >= now && p.status !== 'done').sort((a, b) => a.startDate.localeCompare(b.startDate)).slice(0, 5);

    const totalSkus = new Set([
      ...listings.map(l => l.productName),
      ...rollouts.map(r => r.productName),
      ...promos.map(p => p.productName),
    ]).size;

    return { lDone, rDone, pActive, stores, stuckListing, recentListed, recentOnline, upcomingPromos, totalSkus,
      lTotal: listings.length, rTotal: rollouts.length, pTotal: promos.length };
  }, [listings, promos, rollouts]);

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
      {/* ====== Header ====== */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 tracking-tight">商超渠道 · 汇报看板</h1>
          <p className="text-xs text-gray-400 mt-0.5">{new Date().toLocaleDateString('zh-CN')} · {STORES.length} 家商超 · {report.totalSkus} 个在跟 SKU</p>
        </div>
      </div>

      {/* ====== KPI Row ====== */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          ['在跟 SKU', report.totalSkus, '个', 'bg-slate-50', '📦'],
          ['新品上架率', report.lTotal > 0 ? Math.round((report.lDone / report.lTotal) * 100) : 0, '%', 'bg-blue-50', '🏪'],
          ['平台翻单率', report.rTotal > 0 ? Math.round((report.rDone / report.rTotal) * 100) : 0, '%', 'bg-violet-50', '🌐'],
          ['进行中档期', report.pActive, '个', 'bg-amber-50', '📅'],
          ['卡点/待办', report.stuckListing.length, '项', 'bg-red-50', '⚠️'],
        ].map(([l, v, u, bg, icon]) => (
          <div key={l as string} className={`${bg} rounded-2xl p-4 text-center`}>
            <p className="text-2xl mb-1">{icon}</p>
            <p className="text-2xl font-bold text-gray-800">{v as number}<span className="text-sm font-normal text-gray-400"> {u}</span></p>
            <p className="text-[11px] text-gray-500 mt-0.5">{l}</p>
          </div>
        ))}
      </div>

      {/* ====== Per-Store Progress ====== */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-50">
          <h2 className="text-sm font-bold text-gray-700">各商超推进情况</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50/50 text-[11px] text-gray-400">
                <th className="text-left px-6 py-3 font-medium">商超</th>
                <th className="text-center px-4 py-3 font-medium" colSpan={3}>新品上架</th>
                <th className="text-center px-4 py-3 font-medium" colSpan={2}>平台翻单</th>
                <th className="text-center px-4 py-3 font-medium" colSpan={2}>档期活动</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {report.stores.map(s => {
                const lpct = s.listingTotal > 0 ? Math.round((s.listingDone / s.listingTotal) * 100) : 0;
                const rpct = s.rolloutTotal > 0 ? Math.round((s.rolloutDone / s.rolloutTotal) * 100) : 0;
                return (
                  <tr key={s.id} className="hover:bg-gray-50/30 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: s.color }} />
                        <span className="font-bold text-gray-800 text-xs">{s.name}</span>
                      </div>
                    </td>
                    {/* Listing: 3 mini bars */}
                    <td className="px-1 py-4 text-center">
                      <div className="flex items-center gap-0.5 justify-center">
                        <div className="w-6 h-4 rounded bg-amber-100" title={`洽谈 ${s.listingNeg}`} style={{ opacity: s.listingNeg > 0 ? 1 : 0.15 }} />
                        <div className="w-6 h-4 rounded bg-blue-100" title={`通过 ${s.listingApproved}`} style={{ opacity: s.listingApproved > 0 ? 1 : 0.15 }} />
                        <div className="w-6 h-4 rounded bg-emerald-200" title={`上架 ${s.listingDone}`} style={{ opacity: s.listingDone > 0 ? 1 : 0.15 }} />
                      </div>
                    </td>
                    <td className="px-1 py-4 text-center">
                      <span className="text-xs font-bold text-gray-700">{s.listingDone}/{s.listingTotal}</span>
                    </td>
                    <td className="px-3 py-4">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden max-w-[80px]">
                          <div className="h-full rounded-full" style={{ width: `${lpct}%`, backgroundColor: s.color }} />
                        </div>
                        <span className="text-[10px] text-gray-400 w-7">{lpct}%</span>
                      </div>
                    </td>
                    {/* Rollout */}
                    <td className="px-3 py-4 text-center">
                      <span className="text-xs font-bold text-gray-700">{s.rolloutDone}/{s.rolloutTotal}</span>
                    </td>
                    <td className="px-3 py-4">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden max-w-[80px]">
                          <div className="h-full rounded-full" style={{ width: `${rpct}%`, backgroundColor: s.color }} />
                        </div>
                        <span className="text-[10px] text-gray-400 w-7">{rpct}%</span>
                      </div>
                    </td>
                    {/* Promo */}
                    <td className="px-3 py-4 text-center">
                      <span className="text-xs font-bold text-gray-700">{s.promoActive}</span>
                      <span className="text-[10px] text-gray-400">/{s.promoTotal}</span>
                    </td>
                    <td className="px-3 py-4 text-center">
                      {s.promoTotal > 0 ? (
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${s.promoActive > 0 ? 'bg-amber-50 text-amber-600' : 'bg-gray-50 text-gray-400'}`}>
                          {s.promoActive > 0 ? '进行中' : '暂无'}
                        </span>
                      ) : <span className="text-gray-300">—</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ====== Bottom Row: Stuck + Recent + Upcoming ====== */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Stuck items */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-3">
            <AlertCircle size={16} className="text-red-400" />
            <h3 className="text-sm font-bold text-gray-700">待办卡点</h3>
            <span className="text-[11px] text-red-400 font-medium ml-auto">{report.stuckListing.length} 项</span>
          </div>
          {report.stuckListing.length > 0 ? (
            <div className="space-y-2">
              {report.stuckListing.map(i => (
                <div key={i.id} className="text-xs p-2 bg-red-50 rounded-lg">
                  <p className="font-medium text-gray-800">{i.productName}</p>
                  <p className="text-[10px] text-gray-500 mt-0.5">{storeById(i.supermarketId)?.name} · 未设目标日期</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-gray-300">暂无卡点，所有项目正常推进</p>
          )}
          {/* Also show listings that are negotiating */}
          {listings.filter(l => l.status === 'negotiating').length > report.stuckListing.length && (
            <p className="text-[10px] text-gray-400 mt-3">另有 {listings.filter(l => l.status === 'negotiating').length - report.stuckListing.length} 项正常洽谈中</p>
          )}
        </div>

        {/* Recent completions */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle2 size={16} className="text-emerald-400" />
            <h3 className="text-sm font-bold text-gray-700">近期完成</h3>
          </div>
          <div className="space-y-2.5">
            {report.recentListed.length === 0 && report.recentOnline.length === 0 && (
              <p className="text-xs text-gray-300">暂无完成记录</p>
            )}
            {report.recentListed.map(i => (
              <div key={i.id} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  <span className="text-gray-700">{i.productName}</span>
                  <span className="text-[10px] text-gray-400">{storeById(i.supermarketId)?.name}</span>
                </div>
                <span className="text-[10px] text-gray-400">上架 {i.actualDate}</span>
              </div>
            ))}
            {report.recentOnline.map(i => (
              <div key={i.id} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-violet-400" />
                  <span className="text-gray-700">{i.productName}</span>
                  <span className="text-[10px] text-gray-400">{storeById(i.supermarketId)?.name}</span>
                </div>
                <span className="text-[10px] text-gray-400">上线 {i.actualDate}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Upcoming promos */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-3">
            <Calendar size={16} className="text-amber-400" />
            <h3 className="text-sm font-bold text-gray-700">即将开始档期</h3>
          </div>
          {report.upcomingPromos.length > 0 ? (
            <div className="space-y-2">
              {report.upcomingPromos.map(p => (
                <div key={p.id} className="flex items-center justify-between text-xs p-2 bg-amber-50/50 rounded-lg">
                  <div>
                    <p className="font-medium text-gray-800">{p.productName}</p>
                    <p className="text-[10px] text-gray-500">{storeById(p.supermarketId)?.name} · {p.type || '档期'}</p>
                  </div>
                  <span className="text-[10px] font-medium text-amber-600">{p.startDate}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-gray-300">暂无即将开始的档期</p>
          )}
        </div>
      </div>

      {/* ====== Tab detail area ====== */}
      <div className="flex items-center justify-between">
        <div className="flex bg-gray-100 rounded-xl p-1">
          {([
            ['listing', '新品上架', report.lTotal],
            ['promotion', '档期进度', report.pTotal],
            ['rollout', '平台上翻', report.rTotal],
          ] as [Tab, string, number][]).map(([t, label, count]) => (
            <button key={t} onClick={() => setTab(t)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab === t ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
              {label}<span className={`text-[11px] px-1.5 py-0.5 rounded-full ${tab === t ? 'bg-gray-100 text-gray-500' : 'bg-white/50 text-gray-400'}`}>{count}</span>
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="搜索..." className="pl-8 pr-3 py-2 border border-gray-200 rounded-xl text-sm w-40 focus:outline-none focus:border-gray-300" />
          </div>
          <button onClick={() => setModal({ type: tab, edit: null })} className="flex items-center gap-1.5 px-4 py-2 bg-starbucks-500 text-white rounded-xl text-sm font-medium hover:bg-starbucks-600 shadow-sm">
            <Plus size={15} />新增
          </button>
        </div>
      </div>

      {/* Detail table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {tab === 'listing' && <DetailTable type="listing" items={listings} setItems={setListings} search={search} />}
        {tab === 'promotion' && <DetailTable type="promo" items={promos} setItems={setPromos} search={search} />}
        {tab === 'rollout' && <DetailTable type="rollout" items={rollouts} setItems={setRollouts} search={search} />}
        {((tab === 'listing' && listings.length === 0) || (tab === 'promotion' && promos.length === 0) || (tab === 'rollout' && rollouts.length === 0)) && (
          <div className="py-16 text-center text-gray-300 text-sm">暂无数据，点击上方「新增」按钮添加</div>
        )}
      </div>

      {/* Modal */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setModal(null)} />
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
  const lbl = "text-[11px] text-gray-400 mb-1 block";

  return (
    <div className="p-6 space-y-4">
      <div>
        <label className={lbl}>选择产品 *</label>
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
      <div><label className={lbl}>备注</label><input value={form.remark || ''} onChange={e => update('remark', e.target.value)} placeholder="选填备注" className={cls} /></div>
      <div className="flex justify-end gap-3 pt-2">
        <button onClick={() => setModal(null)} className="px-5 py-2.5 text-sm text-gray-500 hover:bg-gray-50 rounded-xl">取消</button>
        <button onClick={save} className="px-6 py-2.5 bg-gray-900 text-white rounded-xl text-sm font-medium hover:bg-gray-800 shadow-sm">保存</button>
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

  const cols = type === 'listing' ? ['产品', '商超', '状态', '目标', '实际', '备注'] :
    type === 'promo' ? ['产品', '商超', '类型', '档期', '状态', '备注'] :
    ['产品', '平台', '商超', '目标', '实际', '状态', '备注'];

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead><tr className="bg-gray-50/50 border-b border-gray-100 text-[11px] text-gray-400">{cols.map(c => <th key={c} className="text-left px-5 py-2.5 font-medium">{c}</th>)}<th className="text-center px-3 py-2.5 w-20 font-medium">操作</th></tr></thead>
        <tbody className="divide-y divide-gray-50">
          {filtered.map((i: any) => (
            <tr key={i.id} className="hover:bg-gray-50/30 transition-colors group">
              <td className="px-5 py-3 text-xs font-medium text-gray-800">{i.productName}</td>
              {type === 'rollout' && <td className="px-5 py-3 text-xs text-violet-600">{i.platform || '—'}</td>}
              <td className="px-5 py-3 text-xs text-gray-500">{storeById(i.supermarketId)?.name || '—'}</td>
              {type === 'promo' && <td className="px-5 py-3 text-xs text-gray-500">{i.type || '—'}</td>}
              {type !== 'promo' && <td className="px-5 py-3 text-xs text-gray-500">
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${(type === 'listing' ? L_STATUS : R_STATUS).find(s => s.key === i.status)?.bg}`}
                  style={{ color: (type === 'listing' ? L_STATUS : R_STATUS).find(s => s.key === i.status)?.color }}>
                  {(type === 'listing' ? L_STATUS : R_STATUS).find(s => s.key === i.status)?.label}
                </span>
              </td>}
              {type === 'promo' && <td className="px-5 py-3 text-xs text-gray-500">{i.startDate || '?'}→{i.endDate || '?'}</td>}
              {type !== 'promo' && <><td className="px-5 py-3 text-xs text-gray-500">{i.targetDate || '—'}</td><td className="px-5 py-3 text-xs text-gray-500">{i.actualDate || '—'}</td></>}
              {type === 'promo' && <td className="px-5 py-3"><span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${P_STATUS.find(s => s.key === i.status)?.bg}`}
                style={{ color: P_STATUS.find(s => s.key === i.status)?.color }}>{P_STATUS.find(s => s.key === i.status)?.label}</span></td>}
              <td className="px-5 py-3 text-xs text-gray-400 max-w-[100px] truncate">{i.remark || '—'}</td>
              <td className="px-3 py-3">
                <div className="flex items-center justify-center gap-1">
                  {((type === 'listing' ? NEXT.listing : type === 'promo' ? NEXT.promo : NEXT.rollout) as any)[i.status] && (
                    <button onClick={() => advance(i.id)} className="text-[10px] text-starbucks-600 hover:bg-starbucks-50 px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100">推进</button>
                  )}
                  <button onClick={() => del(i.id)} className="text-gray-300 hover:text-red-400 opacity-0 group-hover:opacity-100"><Trash2 size={13} /></button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
