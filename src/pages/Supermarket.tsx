import { useState, useMemo, useEffect } from 'react';
import { Plus, X, Search, AlertCircle, Trash2, Calendar, Globe, Package, Store } from 'lucide-react';
import type { NewProductListing, PromotionSlot, PlatformRollout } from '../types/supermarket';
import { supabase } from '../lib/supabase';
import { products as allProducts } from '../data/mockData';

const STORES = [
  { id: 's1', name: '唐百', color: '#3b82f6', bg: 'bg-blue-50' },
  { id: 's2', name: '兆丰', color: '#f59e0b', bg: 'bg-amber-50' },
  { id: 's3', name: '兴龙广缘', color: '#10b981', bg: 'bg-emerald-50' },
  { id: 's4', name: '宽广', color: '#8b5cf6', bg: 'bg-violet-50' },
  { id: 's5', name: '福满家', color: '#ef4444', bg: 'bg-red-50' },
  { id: 's6', name: '宽广购', color: '#06b6d4', bg: 'bg-cyan-50' },
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

type Tab = 'matrix' | 'listing' | 'promotion' | 'rollout';

export default function SupermarketPage() {
  const [tab, setTab] = useState<Tab>('matrix');
  const [listings, setListings] = useState<NewProductListing[]>([]);
  const [promos, setPromos] = useState<PromotionSlot[]>([]);
  const [rollouts, setRollouts] = useState<PlatformRollout[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState<{ type: string; edit: any } | null>(null);
  const [smLoaded, setSmLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      const [l, p, r] = await Promise.all([
        supabase.from('sm_listing').select('*'), supabase.from('sm_promotion').select('*'),
        supabase.from('sm_rollout').select('*'),
      ]);
      setListings((l.data || []).map((r: any) => r.data));
      setPromos((p.data || []).map((r: any) => r.data));
      setRollouts((r.data || []).map((r: any) => r.data));
      try { const nd = JSON.parse(localStorage.getItem('sm_notes') || '{}'); setNotes(nd); } catch {}
      setSmLoaded(true);
    })();
  }, []);
  useEffect(() => { if (smLoaded) supabase.from('sm_listing').upsert(listings.map(d => ({ id: d.id || genId(), data: d })), { onConflict: 'id' }).then(() => {}); }, [listings]);
  useEffect(() => { if (smLoaded) supabase.from('sm_promotion').upsert(promos.map(d => ({ id: d.id || genId(), data: d })), { onConflict: 'id' }).then(() => {}); }, [promos]);
  useEffect(() => { if (smLoaded) supabase.from('sm_rollout').upsert(rollouts.map(d => ({ id: d.id || genId(), data: d })), { onConflict: 'id' }).then(() => {}); }, [rollouts]);
  useEffect(() => { localStorage.setItem('sm_notes', JSON.stringify(notes)); }, [notes]);

  const saveNote = (sku: string, text: string) => {
    setNotes(prev => ({ ...prev, [sku]: text }));
  };

  // 追踪的SKU：所有出现在listing中的品项
  const trackedSkus = useMemo(() =>
    [...new Set(listings.map(l => l.productName))].sort()
  , [listings]);

  // SKU × Store 矩阵
  const skuMatrix = useMemo(() => trackedSkus.map(sku => ({
    sku,
    stores: STORES.map(s => {
      const item = listings.find(l => l.productName === sku && l.supermarketId === s.id);
      return item ? { status: item.status, id: item.id, targetDate: item.targetDate, actualDate: item.actualDate } : null;
    }),
    note: notes[sku] || '',
  })), [trackedSkus, listings, notes]);

  const report = useMemo(() => {
    const lDone = listings.filter(l => l.status === 'listed').length;
    const rDone = rollouts.filter(r => r.status === 'online').length;
    const pActive = promos.filter(p => p.status === 'executing' || p.status === 'confirmed').length;
    const stuckListing = listings.filter(l => l.status === 'negotiating' && !l.targetDate);
    const totalSkus = trackedSkus.length;

    const storeSummary = STORES.map(s => ({
      ...s,
      listingTotal: listings.filter(l => l.supermarketId === s.id).length,
      listingDone: listings.filter(l => l.supermarketId === s.id && l.status === 'listed').length,
      rolloutTotal: rollouts.filter(r => r.supermarketId === s.id).length,
      rolloutDone: rollouts.filter(r => r.supermarketId === s.id && r.status === 'online').length,
      promoTotal: promos.filter(p => p.supermarketId === s.id).length,
      promoActive: promos.filter(p => p.supermarketId === s.id && (p.status === 'executing' || p.status === 'confirmed')).length,
    }));

    return { lDone, rDone, pActive, stuckListing, totalSkus, storeSummary,
      lTotal: listings.length, rTotal: rollouts.length, pTotal: promos.length };
  }, [listings, promos, rollouts, trackedSkus]);

  const tabs: [Tab, string, number][] = [
    ['matrix', 'SKU追踪', trackedSkus.length],
    ['listing', '新品上架', report.lTotal],
    ['promotion', '档期进度', report.pTotal],
    ['rollout', '平台上翻', report.rTotal],
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      <div className="p-4 md:p-6 space-y-5 max-w-7xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">商超渠道管理</h1>
            <p className="text-sm text-gray-400 mt-0.5">
              {STORES.length} 家商超 · {report.totalSkus} 个追踪品项 · {report.lDone} 已上架
            </p>
          </div>
          <button onClick={() => setModal({ type: tab === 'matrix' ? 'listing' : tab, edit: null })}
            className="flex items-center gap-1.5 px-5 py-2.5 bg-gray-900 text-white rounded-xl text-sm font-medium hover:bg-gray-800">
            <Plus size={16} />新增记录
          </button>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          {[
            { label: '追踪品项', value: report.totalSkus, unit: 'SKU', icon: Package, color: 'text-gray-600', bg: 'bg-gray-50' },
            { label: '已上架', value: report.lDone, unit: `/${report.lTotal}`, icon: Store, color: 'text-blue-600', bg: 'bg-blue-50',
              bar: report.lTotal > 0 ? Math.round((report.lDone / report.lTotal) * 100) : 0 },
            { label: '已上线', value: report.rDone, unit: `/${report.rTotal}`, icon: Globe, color: 'text-violet-600', bg: 'bg-violet-50',
              bar: report.rTotal > 0 ? Math.round((report.rDone / report.rTotal) * 100) : 0 },
            { label: '进行中档期', value: report.pActive, unit: '个', icon: Calendar, color: 'text-amber-600', bg: 'bg-amber-50' },
            { label: '卡点', value: report.stuckListing.length, unit: '项', icon: AlertCircle,
              color: report.stuckListing.length > 0 ? 'text-red-600' : 'text-emerald-600',
              bg: report.stuckListing.length > 0 ? 'bg-red-50' : 'bg-emerald-50' },
          ].map(k => (
            <div key={k.label} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-gray-500">{k.label}</span>
                <div className={`w-8 h-8 rounded-lg ${k.bg} flex items-center justify-center`}><k.icon size={15} className={k.color} /></div>
              </div>
              <p className="text-2xl font-bold text-gray-800">{k.value}<span className="text-sm font-normal text-gray-400 ml-0.5">{k.unit}</span></p>
              {k.bar !== undefined && <div className="mt-2 h-1.5 bg-gray-100 rounded-full overflow-hidden"><div className={`h-full rounded-full ${k.label.includes('上架') ? 'bg-blue-500' : 'bg-violet-500'}`} style={{ width: `${k.bar}%` }} /></div>}
            </div>
          ))}
        </div>

        {/* Stuck items alert */}
        {report.stuckListing.length > 0 && (
          <div className="bg-red-50 rounded-2xl border border-red-100 p-4 flex items-start gap-3">
            <AlertCircle size={16} className="text-red-500 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-bold text-red-700">待办卡点 {report.stuckListing.length} 项 — 需协调推进</p>
              <div className="flex flex-wrap gap-2 mt-2">
                {report.stuckListing.map(i => (
                  <span key={i.id} className="text-xs bg-white rounded-lg px-2.5 py-1.5 text-red-600 font-medium">
                    {i.productName} · {storeById(i.supermarketId)?.name}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* 各商超总览 */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-3.5 border-b border-gray-50">
            <h3 className="text-sm font-bold text-gray-700">各商超推进总览</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead><tr className="border-b border-gray-50 text-gray-400">
                <th className="text-left px-5 py-2.5 font-medium">商超</th>
                <th className="text-center px-3 py-2.5 font-medium">上架进度</th>
                <th className="text-center px-3 py-2.5 font-medium">翻单进度</th>
                <th className="text-center px-3 py-2.5 font-medium">档期活动</th>
              </tr></thead>
              <tbody className="divide-y divide-gray-50">
                {report.storeSummary.map(s => {
                  const lpct = s.listingTotal > 0 ? Math.round((s.listingDone / s.listingTotal) * 100) : 0;
                  const rpct = s.rolloutTotal > 0 ? Math.round((s.rolloutDone / s.rolloutTotal) * 100) : 0;
                  return (
                    <tr key={s.id} className="hover:bg-gray-50/30">
                      <td className="px-5 py-3"><span className="text-sm font-bold text-gray-800">{s.name}</span></td>
                      <td className="px-3 py-3"><div className="flex items-center gap-2"><div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden"><div className="h-full bg-blue-500 rounded-full" style={{ width: `${lpct}%` }} /></div><span className="text-gray-500 w-10 text-right">{s.listingDone}/{s.listingTotal}</span></div></td>
                      <td className="px-3 py-3"><div className="flex items-center gap-2"><div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden"><div className="h-full bg-violet-500 rounded-full" style={{ width: `${rpct}%` }} /></div><span className="text-gray-500 w-10 text-right">{s.rolloutDone}/{s.rolloutTotal}</span></div></td>
                      <td className="px-3 py-3"><span className="text-gray-500">{s.promoActive > 0 ? `${s.promoActive}个进行中` : <span className="text-gray-300">—</span>}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center justify-between">
          <div className="flex bg-gray-100 rounded-xl p-1">
            {tabs.map(([t, label, count]) => (
              <button key={t} onClick={() => setTab(t)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab === t ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                {label}<span className={`text-[11px] px-1.5 py-0.5 rounded-full ${tab === t ? 'bg-gray-100 text-gray-500' : 'bg-white/50 text-gray-400'}`}>{count}</span>
              </button>
            ))}
          </div>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="搜索..." className="pl-8 pr-3 py-2 border border-gray-200 rounded-xl text-sm w-40 focus:outline-none" />
          </div>
        </div>

        {/* Tab Content */}
        {tab === 'matrix' ? (
          /* ====== SKU 追踪矩阵 ====== */
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-3.5 border-b border-gray-50 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-gray-700">SKU × 商超 上架追踪</h3>
                <p className="text-[11px] text-gray-400 mt-0.5">横向：商超系统 / 纵向：追踪品项</p>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/30">
                    <th className="text-left px-5 py-2.5 font-medium text-gray-500 sticky left-0 bg-gray-50/30">品项</th>
                    {STORES.map(s => (
                      <th key={s.id} className="text-center px-2 py-2.5 font-medium text-gray-500 w-[90px]">{s.name}</th>
                    ))}
                    <th className="text-left px-4 py-2.5 font-medium text-gray-500 w-[200px]">汇报备注</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {skuMatrix.length === 0 ? (
                    <tr><td colSpan={STORES.length + 2} className="py-16 text-center text-gray-400">暂无追踪品项，请先在新品上架中添加</td></tr>
                  ) : (
                    skuMatrix.map(row => (
                      <tr key={row.sku} className="hover:bg-gray-50/30">
                        <td className="px-5 py-3 font-medium text-gray-800 sticky left-0 bg-white">{row.sku}</td>
                        {row.stores.map((st, i) => {
                          const cfg = st ? L_STATUS.find(s => s.key === st.status) : null;
                          return (
                            <td key={i} className="text-center px-1 py-3">
                              {cfg ? (
                                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-medium border"
                                  style={{ backgroundColor: cfg.bg, color: cfg.color, borderColor: cfg.border }}>
                                  <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: cfg.color }} />{cfg.label}
                                </span>
                              ) : (
                                <span className="text-[10px] text-gray-300">—</span>
                              )}
                            </td>
                          );
                        })}
                        <td className="px-4 py-2">
                          <div className="flex items-center gap-1">
                            <input
                              value={row.note}
                              onChange={e => saveNote(row.sku, e.target.value)}
                              placeholder="备注说明..."
                              className="w-full text-[11px] border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:border-gray-300 bg-gray-50"
                            />
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          /* ====== Detail Tables ====== */
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            {tab === 'listing' && <DetailTable type="listing" items={listings} setItems={setListings} search={search} statusList={L_STATUS} />}
            {tab === 'promotion' && <DetailTable type="promo" items={promos} setItems={setPromos} search={search} statusList={P_STATUS} />}
            {tab === 'rollout' && <DetailTable type="rollout" items={rollouts} setItems={setRollouts} search={search} statusList={R_STATUS} />}
          </div>
        )}

        {/* ====== Modal ====== */}
        {modal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setModal(null)} />
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-50 bg-gray-50/50">
                <h3 className="text-sm font-semibold text-gray-800">{modal.edit ? '编辑' : '新增'}{modal.type === 'listing' ? '上架产品' : modal.type === 'promotion' ? '档期活动' : '平台翻单'}</h3>
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
      <div><label className={lbl}>选择品项 *</label><select value={form.productName} onChange={e => update('productName', e.target.value)} className={cls}><option value="">-- 选择 SKU --</option>{allProducts.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}</select></div>
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
      <div><label className={lbl}>备注</label><input value={form.remark || ''} onChange={e => update('remark', e.target.value)} placeholder="补充说明" className={cls} /></div>
      <div className="flex justify-end gap-3 pt-2">
        <button onClick={() => setModal(null)} className="px-5 py-2.5 text-sm text-gray-500 hover:bg-gray-50 rounded-xl">取消</button>
        <button onClick={save} className="px-6 py-2.5 bg-gray-900 text-white rounded-xl text-sm font-medium hover:bg-gray-800">保存</button>
      </div>
    </div>
  );
}

function DetailTable({ type, items, setItems, search, statusList }: { type: string; items: any[]; setItems: (d: any[]) => void; search: string; statusList: any[] }) {
  const filtered = useMemo(() => {
    if (!search) return items;
    const q = search.toLowerCase();
    return items.filter((i: any) => i.productName?.toLowerCase().includes(q) || i.platform?.toLowerCase().includes(q));
  }, [items, search]);
  const del = async (id: string) => {
    setItems(items.filter((i: any) => i.id !== id));
    const table = type === 'listing' ? 'sm_listing' : type === 'promo' ? 'sm_promotion' : 'sm_rollout';
    try { await supabase.from(table).delete().eq('id', id); } catch {}
  };
  const advance = (id: string) => {
    const item = items.find((i: any) => i.id === id);
    const nextMap: Record<string, Record<string, string>> = {
      listing: { negotiating: 'approved', approved: 'listed' },
      promo: { planned: 'confirmed', confirmed: 'executing', executing: 'done' },
      rollout: { pending: 'in_progress', in_progress: 'online' },
    };
    const nm = nextMap[type] || {};
    if (!item || !nm[item.status]) return;
    setItems(items.map((i: any) => i.id === id ? { ...i, status: nm[item.status], actualDate: (nm[item.status] === 'listed' || nm[item.status] === 'online') ? new Date().toISOString().slice(0, 10) : i.actualDate } : i));
  };

  if (filtered.length === 0) {
    return <div className="py-16 text-center text-gray-400 text-sm">{search ? '未找到匹配结果' : '暂无数据，点击右上角新增'}</div>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-50/30 border-b border-gray-100">
            <th className="text-left px-5 py-3 text-[11px] font-semibold text-gray-500">品项</th>
            {type === 'rollout' && <th className="text-left px-3 py-3 text-[11px] font-semibold text-gray-500">平台</th>}
            <th className="text-left px-3 py-3 text-[11px] font-semibold text-gray-500">商超</th>
            {type === 'promo' && <th className="text-left px-3 py-3 text-[11px] font-semibold text-gray-500">类型</th>}
            <th className="text-left px-3 py-3 text-[11px] font-semibold text-gray-500">状态</th>
            {type !== 'promo' && <><th className="text-left px-3 py-3 text-[11px] font-semibold text-gray-500">目标</th><th className="text-left px-3 py-3 text-[11px] font-semibold text-gray-500">实际</th></>}
            {type === 'promo' && <th className="text-left px-3 py-3 text-[11px] font-semibold text-gray-500">档期</th>}
            <th className="text-left px-3 py-3 text-[11px] font-semibold text-gray-500">备注</th>
            <th className="text-center px-3 py-3 text-[11px] font-semibold text-gray-500 w-16">操作</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {filtered.map((i: any) => {
            const cfg = statusList.find(s => s.key === i.status);
            const nextMap: Record<string, Record<string, string>> = {
              listing: { negotiating: 'approved', approved: 'listed' },
              promo: { planned: 'confirmed', confirmed: 'executing', executing: 'done' },
              rollout: { pending: 'in_progress', in_progress: 'online' },
            };
            return (
              <tr key={i.id} className="hover:bg-gray-50/30 group">
                <td className="px-5 py-3 text-xs font-medium text-gray-800">{i.productName}</td>
                {type === 'rollout' && <td className="px-3 py-3 text-xs text-violet-600 font-medium">{i.platform || '—'}</td>}
                <td className="px-3 py-3 text-xs text-gray-600">{storeById(i.supermarketId)?.name}</td>
                {type === 'promo' && <td className="px-3 py-3 text-xs text-gray-500">{i.type || '—'}</td>}
                <td className="px-3 py-3">{cfg && <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border" style={{ backgroundColor: cfg.bg, color: cfg.color, borderColor: cfg.border }}><span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: cfg.color }} />{cfg.label}</span>}</td>
                {type !== 'promo' && <><td className="px-3 py-3 text-xs text-gray-500">{i.targetDate || '—'}</td><td className="px-3 py-3 text-xs text-gray-500">{i.actualDate || '—'}</td></>}
                {type === 'promo' && <td className="px-3 py-3 text-xs text-gray-500">{i.startDate || '?'} → {i.endDate || '?'}</td>}
                <td className="px-3 py-3 text-xs text-gray-400 max-w-[100px] truncate">{i.remark || '—'}</td>
                <td className="px-3 py-3"><div className="flex items-center justify-center gap-1">
                  {(nextMap[type] || {})[i.status] && <button onClick={() => advance(i.id)} className="text-[10px] text-starbucks-600 hover:bg-starbucks-50 px-1.5 py-0.5 rounded font-medium opacity-0 group-hover:opacity-100">推进</button>}
                  <button onClick={() => del(i.id)} className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100"><Trash2 size={13} /></button>
                </div></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
