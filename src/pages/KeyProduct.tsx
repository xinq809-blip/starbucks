import { useState, useMemo, useEffect } from 'react';
import { Plus, Trash2, Pencil, X, Package, TrendingUp, Store, Target, Settings2, Users, MapPin, ClipboardList } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { ProductOverview, DistributorDistribution, MarketPlan } from '../types/keyproduct';

function genId(p: string) { return p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

interface KeyProduct { id: string; name: string; color: string; }
const COLOR_PALETTE = ['#1e293b', '#059669', '#3b82f6', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4', '#ec4899', '#f97316', '#6366f1'];
const DEFAULT_PRODUCTS: KeyProduct[] = [
  { id: 'p11', name: 'P450 黑咖啡', color: '#1e293b' },
  { id: 'p20', name: 'P270 椰椰拿铁', color: '#059669' },
];

type Tab = 'overview' | 'distribution' | 'plan';

export default function KeyProductPage() {
  const [tab, setTab] = useState<Tab>('overview');
  const [productList, setProductList] = useState<KeyProduct[]>(DEFAULT_PRODUCTS);
  const [overviews, setOverviews] = useState<ProductOverview[]>([]);
  const [distributions, setDistributions] = useState<DistributorDistribution[]>([]);
  const [plans, setPlans] = useState<MarketPlan[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [filter, setFilter] = useState<string>('all');

  // modals
  const [overviewModal, setOverviewModal] = useState(false);
  const [distModal, setDistModal] = useState(false);
  const [planModal, setPlanModal] = useState(false);
  const [productModal, setProductModal] = useState(false);
  const [editingOverview, setEditingOverview] = useState<ProductOverview | null>(null);
  const [editingDist, setEditingDist] = useState<DistributorDistribution | null>(null);
  const [editingPlan, setEditingPlan] = useState<MarketPlan | null>(null);
  const [newProductName, setNewProductName] = useState('');

  const productById = (id: string) => productList.find(p => p.id === id);

  useEffect(() => {
    Promise.all([
      supabase.from('key_products').select('*'),
      supabase.from('key_products_list').select('*'),
      supabase.from('key_distribution').select('*'),
      supabase.from('key_market_plan').select('*'),
    ]).then(([ovRes, listRes, distRes, planRes]) => {
      setOverviews((ovRes.data || []).map((row: any) => row.data));
      setDistributions((distRes.data || []).map((row: any) => row.data));
      setPlans((planRes.data || []).map((row: any) => row.data));
      const list = (listRes.data || []).map((row: any) => row.data);
      if (list.length > 0) setProductList(list);
      setLoaded(true);
    });
  }, []);

  // 保存到 Supabase
  useEffect(() => {
    if (!loaded) return;
    supabase.from('key_products').upsert(overviews.map(d => ({ id: d.id, data: d })), { onConflict: 'id' }).then(() => {});
  }, [overviews, loaded]);
  useEffect(() => {
    if (!loaded) return;
    supabase.from('key_distribution').upsert(distributions.map(d => ({ id: d.id, data: d })), { onConflict: 'id' }).then(() => {});
  }, [distributions, loaded]);
  useEffect(() => {
    if (!loaded) return;
    supabase.from('key_market_plan').upsert(plans.map(d => ({ id: d.id, data: d })), { onConflict: 'id' }).then(() => {});
  }, [plans, loaded]);
  useEffect(() => {
    if (!loaded) return;
    supabase.from('key_products_list').upsert(productList.map(d => ({ id: d.id, data: d })), { onConflict: 'id' }).then(() => {});
  }, [productList, loaded]);

  const saveOverview = (d: ProductOverview) => {
    setOverviews(prev => prev.find(i => i.id === d.id) ? prev.map(i => i.id === d.id ? d : i) : [...prev, d]);
    setOverviewModal(false); setEditingOverview(null);
  };
  const delOverview = async (id: string) => {
    setOverviews(overviews.filter(i => i.id !== id));
    try { await supabase.from('key_products').delete().eq('id', id); } catch {}
  };

  const saveDist = (d: DistributorDistribution) => {
    setDistributions(prev => prev.find(i => i.id === d.id) ? prev.map(i => i.id === d.id ? d : i) : [...prev, d]);
    setDistModal(false); setEditingDist(null);
  };
  const delDist = async (id: string) => {
    setDistributions(distributions.filter(i => i.id !== id));
    try { await supabase.from('key_distribution').delete().eq('id', id); } catch {}
  };

  const savePlan = (d: MarketPlan) => {
    setPlans(prev => prev.find(i => i.id === d.id) ? prev.map(i => i.id === d.id ? d : i) : [...prev, d]);
    setPlanModal(false); setEditingPlan(null);
  };
  const delPlan = async (id: string) => {
    setPlans(plans.filter(i => i.id !== id));
    try { await supabase.from('key_market_plan').delete().eq('id', id); } catch {}
  };

  const addProduct = () => {
    const name = newProductName.trim();
    if (!name) return;
    const p: KeyProduct = { id: genId('PP'), name, color: COLOR_PALETTE[productList.length % COLOR_PALETTE.length] };
    setProductList([...productList, p]);
    setNewProductName(''); setProductModal(false);
  };
  const delProduct = async (id: string) => {
    if (!confirm('确认删除该单品？')) return;
    setProductList(productList.filter(p => p.id !== id));
    try { await supabase.from('key_products_list').delete().eq('id', id); } catch {}
  };

  // 筛选后的总览
  const filteredOverview = filter === 'all' ? overviews : overviews.filter(o => o.productId === filter);
  const overviewSummary = useMemo(() => {
    const restock = filteredOverview.reduce((s, o) => s + (o.restockQty || 0), 0);
    const stock = filteredOverview.reduce((s, o) => s + (o.stockQty || 0), 0);
    const dist = filteredOverview.reduce((s, o) => s + (o.distributeQty || 0), 0);
    return { restock, stock, dist, rate: restock > 0 ? Math.round((dist / restock) * 100) : 0 };
  }, [filteredOverview]);

  const filteredDist = filter === 'all' ? distributions : distributions.filter(d => d.productId === filter);
  const distSummary = useMemo(() => {
    const qty = filteredDist.reduce((s, d) => s + (d.quantity || 0), 0);
    const outlet = filteredDist.reduce((s, d) => s + (d.outletCount || 0), 0);
    const strong = filteredDist.filter(d => d.strength === '强').length;
    const mid = filteredDist.filter(d => d.strength === '中').length;
    const weak = filteredDist.filter(d => d.strength === '弱').length;
    return { qty, outlet, strong, mid, weak };
  }, [filteredDist]);

  const filteredPlans = filter === 'all' ? plans : plans.filter(p => p.productId === filter);

  const STRENGTH_MAP: Record<string, string> = { '强': 'bg-emerald-50 text-emerald-600', '中': 'bg-amber-50 text-amber-600', '弱': 'bg-gray-100 text-gray-500' };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      <div className="p-4 md:p-6 space-y-5 max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">重点单品追踪</h1>
            <p className="text-sm text-gray-400 mt-0.5">单品总览 · 分销明细 · 市场计划</p>
          </div>
          <button onClick={() => setProductModal(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-white border border-gray-200 text-gray-600 rounded-xl text-sm font-medium hover:bg-gray-50">
            <Settings2 size={16} />管理单品
          </button>
        </div>

        {/* 单品筛选 + Tab */}
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={() => setFilter('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium ${filter === 'all' ? 'bg-gray-900 text-white' : 'bg-white border border-gray-200 text-gray-500'}`}>全部</button>
          {productList.map(p => (
            <button key={p.id} onClick={() => setFilter(p.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium ${filter === p.id ? 'bg-gray-900 text-white' : 'bg-white border border-gray-200 text-gray-500'}`}>
              <span className="w-2 h-2 rounded-full inline-block mr-1" style={{ backgroundColor: p.color }} />{p.name}
            </button>
          ))}
          <div className="flex-1" />
          <div className="flex bg-gray-100 rounded-xl p-1 gap-1">
            {([
              ['overview', '单品总览'],
              ['distribution', '分销明细'],
              ['plan', '市场计划'],
            ] as [Tab, string][]).map(([t, label]) => (
              <button key={t} onClick={() => setTab(t)}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${tab === t ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500'}`}>{label}</button>
            ))}
          </div>
        </div>

        {/* ====== Tab 1: 单品总览 ====== */}
        {tab === 'overview' && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: '进货总量', v: overviewSummary.restock, unit: '件', icon: Package, color: 'text-blue-600', bg: 'bg-blue-50' },
                { label: '库存总量', v: overviewSummary.stock, unit: '件', icon: Package, color: 'text-violet-600', bg: 'bg-violet-50' },
                { label: '分销总量', v: overviewSummary.dist, unit: '件', icon: TrendingUp, color: 'text-emerald-600', bg: 'bg-emerald-50' },
                { label: '分销率', v: overviewSummary.rate + '%', unit: '', icon: Target, color: 'text-starbucks-600', bg: 'bg-starbucks-50' },
              ].map(c => (
                <div key={c.label} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                  <div className="flex items-center justify-between mb-2"><span className="text-xs text-gray-500">{c.label}</span><div className={`p-1.5 rounded-lg ${c.bg}`}><c.icon size={15} className={c.color} /></div></div>
                  <div className="text-2xl font-bold text-gray-800">{c.v.toLocaleString()}{c.unit && <span className="text-sm font-normal text-gray-400 ml-1">{c.unit}</span>}</div>
                </div>
              ))}
            </div>

            <div className="flex justify-end">
              <button onClick={() => { setEditingOverview(null); setOverviewModal(true); }}
                className="flex items-center gap-1.5 px-4 py-2 bg-gray-900 text-white rounded-xl text-sm font-medium hover:bg-gray-800">
                <Plus size={16} />录入整体数据
              </button>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="bg-gray-50/50 border-b border-gray-100 text-xs text-gray-500">
                    <th className="text-left px-5 py-3">单品</th><th className="text-left px-3 py-3">日期</th>
                    <th className="text-right px-3 py-3">进货</th><th className="text-right px-3 py-3">库存</th>
                    <th className="text-right px-3 py-3">分销</th><th className="text-right px-3 py-3">分销率</th>
                    <th className="text-center px-3 py-3 w-16">操作</th>
                  </tr></thead>
                  <tbody className="divide-y divide-gray-50">
                    {filteredOverview.length === 0 ? <tr><td colSpan={7} className="text-center py-10 text-gray-400">暂无整体数据</td></tr> :
                      filteredOverview.map(o => {
                        const p = productById(o.productId);
                        const rate = o.restockQty > 0 ? Math.round((o.distributeQty / o.restockQty) * 100) : 0;
                        return (
                          <tr key={o.id} className="hover:bg-gray-50/30 group">
                            <td className="px-5 py-3"><span className="inline-flex items-center gap-1.5 text-xs font-bold" style={{ color: p?.color }}><span className="w-2 h-2 rounded-full" style={{ backgroundColor: p?.color }} />{p?.name || o.productId}</span></td>
                            <td className="px-3 py-3 text-gray-500">{o.date}</td>
                            <td className="px-3 py-3 text-right text-gray-600">{o.restockQty.toLocaleString()}</td>
                            <td className="px-3 py-3 text-right text-gray-600">{o.stockQty.toLocaleString()}</td>
                            <td className="px-3 py-3 text-right font-bold text-emerald-600">{o.distributeQty.toLocaleString()}</td>
                            <td className="px-3 py-3 text-right font-bold text-gray-800">{rate}%</td>
                            <td className="px-3 py-3 text-center"><div className="flex justify-center gap-1 opacity-0 group-hover:opacity-100">
                              <button onClick={() => { setEditingOverview(o); setOverviewModal(true); }} className="p-1.5 text-gray-300 hover:text-blue-500"><Pencil size={14} /></button>
                              <button onClick={() => delOverview(o.id)} className="p-1.5 text-gray-300 hover:text-red-500"><Trash2 size={14} /></button>
                            </div></td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {/* ====== Tab 2: 分销明细 ====== */}
        {tab === 'distribution' && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: '发货总量', v: distSummary.qty, unit: '件', icon: TrendingUp, color: 'text-emerald-600', bg: 'bg-emerald-50' },
                { label: '网点总数', v: distSummary.outlet, unit: '家', icon: Store, color: 'text-amber-600', bg: 'bg-amber-50' },
                { label: '强实力', v: distSummary.strong, unit: '家', icon: Users, color: 'text-emerald-600', bg: 'bg-emerald-50' },
                { label: '中/弱', v: distSummary.mid + '/' + distSummary.weak, unit: '家', icon: Users, color: 'text-amber-600', bg: 'bg-amber-50' },
              ].map(c => (
                <div key={c.label} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                  <div className="flex items-center justify-between mb-2"><span className="text-xs text-gray-500">{c.label}</span><div className={`p-1.5 rounded-lg ${c.bg}`}><c.icon size={15} className={c.color} /></div></div>
                  <div className="text-2xl font-bold text-gray-800">{c.v.toLocaleString()}{c.unit && <span className="text-sm font-normal text-gray-400 ml-1">{c.unit}</span>}</div>
                </div>
              ))}
            </div>

            <div className="flex justify-end">
              <button onClick={() => { setEditingDist(null); setDistModal(true); }}
                className="flex items-center gap-1.5 px-4 py-2 bg-gray-900 text-white rounded-xl text-sm font-medium hover:bg-gray-800">
                <Plus size={16} />录入分销明细
              </button>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="bg-gray-50/50 border-b border-gray-100 text-xs text-gray-500">
                    <th className="text-left px-5 py-3">单品</th><th className="text-left px-3 py-3">分销商</th>
                    <th className="text-right px-3 py-3">发货量</th><th className="text-right px-3 py-3">下游客户</th>
                    <th className="text-right px-3 py-3">网点数</th>
                    <th className="text-center px-3 py-3">实力</th><th className="text-center px-3 py-3 w-16">操作</th>
                  </tr></thead>
                  <tbody className="divide-y divide-gray-50">
                    {filteredDist.length === 0 ? <tr><td colSpan={7} className="text-center py-10 text-gray-400">暂无分销明细</td></tr> :
                      filteredDist.map(d => {
                        const p = productById(d.productId);
                        return (
                          <tr key={d.id} className="hover:bg-gray-50/30 group">
                            <td className="px-5 py-3"><span className="inline-flex items-center gap-1.5 text-xs font-bold" style={{ color: p?.color }}><span className="w-2 h-2 rounded-full" style={{ backgroundColor: p?.color }} />{p?.name || d.productId}</span></td>
                            <td className="px-3 py-3 text-gray-700 font-medium">{d.distributorName}</td>
                            <td className="px-3 py-3 text-right font-bold text-emerald-600">{d.quantity.toLocaleString()}</td>
                            <td className="px-3 py-3 text-right text-gray-600">{d.downstreamCount.toLocaleString()}</td>
                            <td className="px-3 py-3 text-right text-gray-600">{d.outletCount.toLocaleString()}</td>
                            <td className="px-3 py-3 text-center"><span className={`text-xs font-bold px-2 py-0.5 rounded-full ${STRENGTH_MAP[d.strength] || STRENGTH_MAP['中']}`}>{d.strength}</span></td>
                            <td className="px-3 py-3 text-center"><div className="flex justify-center gap-1 opacity-0 group-hover:opacity-100">
                              <button onClick={() => { setEditingDist(d); setDistModal(true); }} className="p-1.5 text-gray-300 hover:text-blue-500"><Pencil size={14} /></button>
                              <button onClick={() => delDist(d.id)} className="p-1.5 text-gray-300 hover:text-red-500"><Trash2 size={14} /></button>
                            </div></td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {/* ====== Tab 3: 市场计划 ====== */}
        {tab === 'plan' && (
          <>
            <div className="flex justify-end">
              <button onClick={() => { setEditingPlan(null); setPlanModal(true); }}
                className="flex items-center gap-1.5 px-4 py-2 bg-gray-900 text-white rounded-xl text-sm font-medium hover:bg-gray-800">
                <Plus size={16} />新增市场计划
              </button>
            </div>

            {filteredPlans.length === 0 ? (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm py-16 text-center">
                <ClipboardList size={28} className="text-gray-300 mx-auto mb-3" />
                <p className="text-sm text-gray-400">暂无市场计划</p>
                <p className="text-xs text-gray-300 mt-1">记录每个单品在市场上怎么做</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredPlans.map(pl => {
                  const p = productById(pl.productId);
                  return (
                    <div key={pl.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 group hover:shadow-md transition-shadow">
                      <div className="flex items-center justify-between mb-3">
                        <span className="inline-flex items-center gap-1.5 text-sm font-bold" style={{ color: p?.color }}>
                          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: p?.color }} />{p?.name || pl.productId}
                        </span>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100">
                          <button onClick={() => { setEditingPlan(pl); setPlanModal(true); }} className="p-1.5 text-gray-300 hover:text-blue-500"><Pencil size={14} /></button>
                          <button onClick={() => delPlan(pl.id)} className="p-1.5 text-gray-300 hover:text-red-500"><Trash2 size={14} /></button>
                        </div>
                      </div>

                      {pl.title && <p className="text-base font-bold text-gray-800 mb-2">{pl.title}</p>}

                      {/* 目标指标 */}
                      <div className="grid grid-cols-2 gap-2 mb-3">
                        {pl.targetDistributor > 0 && <div className="bg-gray-50 rounded-lg p-2.5 text-center"><p className="text-lg font-bold text-gray-800">{pl.targetDistributor}</p><p className="text-[10px] text-gray-400">目标分销商</p></div>}
                        {pl.monthlyNewDistributor > 0 && <div className="bg-gray-50 rounded-lg p-2.5 text-center"><p className="text-lg font-bold text-blue-600">{pl.monthlyNewDistributor}</p><p className="text-[10px] text-gray-400">每月新增</p></div>}
                        {pl.targetOutlet > 0 && <div className="bg-gray-50 rounded-lg p-2.5 text-center"><p className="text-lg font-bold text-emerald-600">{pl.targetOutlet}</p><p className="text-[10px] text-gray-400">目标网点</p></div>}
                        {pl.targetSales > 0 && <div className="bg-gray-50 rounded-lg p-2.5 text-center"><p className="text-lg font-bold text-violet-600">{pl.targetSales}</p><p className="text-[10px] text-gray-400">目标销量</p></div>}
                        {pl.budget > 0 && <div className="bg-gray-50 rounded-lg p-2.5 text-center"><p className="text-lg font-bold text-red-500">¥{pl.budget.toLocaleString()}</p><p className="text-[10px] text-gray-400">预算</p></div>}
                      </div>

                      {pl.keyRegion && (
                        <div className="flex items-center gap-1.5 text-xs text-gray-600 mb-1.5"><MapPin size={13} className="text-blue-500" />重点区域：{pl.keyRegion}</div>
                      )}
                      {pl.promotionMethod && (
                        <div className="flex items-center gap-1.5 text-xs text-gray-600 mb-1.5"><Target size={13} className="text-starbucks-500" />推广方式：{pl.promotionMethod}</div>
                      )}
                      {pl.strategy && (
                        <div className="bg-starbucks-50/50 rounded-lg p-3 mb-2">
                          <p className="text-xs text-gray-700 leading-relaxed">{pl.strategy}</p>
                        </div>
                      )}

                      <div className="flex items-center justify-between text-xs text-gray-500">
                        {(pl.startDate || pl.endDate) && <span>{pl.startDate || '?'} → {pl.endDate || '?'}</span>}
                      </div>
                      {pl.remark && <p className="mt-2 text-xs text-gray-400">{pl.remark}</p>}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* ====== 单品总览 Form ====== */}
        {overviewModal && (
          <Modal title={editingOverview ? '编辑整体数据' : '录入整体数据'} onClose={() => { setOverviewModal(false); setEditingOverview(null); }}>
            <OverviewForm init={editingOverview} productList={productList} onSave={saveOverview} onCancel={() => { setOverviewModal(false); setEditingOverview(null); }} />
          </Modal>
        )}

        {/* ====== 分销明细 Form ====== */}
        {distModal && (
          <Modal title={editingDist ? '编辑分销明细' : '录入分销明细'} onClose={() => { setDistModal(false); setEditingDist(null); }}>
            <DistForm init={editingDist} productList={productList} onSave={saveDist} onCancel={() => { setDistModal(false); setEditingDist(null); }} />
          </Modal>
        )}

        {/* ====== 市场计划 Form ====== */}
        {planModal && (
          <Modal title={editingPlan ? '编辑市场计划' : '新增市场计划'} onClose={() => { setPlanModal(false); setEditingPlan(null); }}>
            <PlanForm init={editingPlan} productList={productList} onSave={savePlan} onCancel={() => { setPlanModal(false); setEditingPlan(null); }} />
          </Modal>
        )}

        {/* ====== 管理单品 Modal ====== */}
        {productModal && (
          <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] p-4">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setProductModal(false)} />
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50/50">
                <h3 className="text-sm font-semibold text-gray-800">管理重点单品</h3>
                <button onClick={() => setProductModal(false)} className="p-1.5 rounded-full hover:bg-gray-200"><X size={16} className="text-gray-400" /></button>
              </div>
              <div className="p-5 space-y-4">
                <div className="flex gap-2">
                  <input value={newProductName} onChange={e => setNewProductName(e.target.value)} placeholder="新单品名称" className="flex-1 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none" onKeyDown={e => e.key === 'Enter' && addProduct()} />
                  <button onClick={addProduct} className="px-4 py-2.5 bg-gray-900 text-white rounded-xl text-sm font-medium">添加</button>
                </div>
                <div className="space-y-1.5">
                  {productList.map(p => (
                    <div key={p.id} className="flex items-center justify-between p-2.5 bg-gray-50 rounded-xl">
                      <span className="flex items-center gap-2 text-sm font-medium text-gray-700"><span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: p.color }} />{p.name}</span>
                      <button onClick={() => delProduct(p.id)} className="text-gray-300 hover:text-red-500"><Trash2 size={14} /></button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[8vh] p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50/50">
          <h3 className="text-sm font-semibold text-gray-800">{title}</h3>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-gray-200"><X size={16} className="text-gray-400" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

const cls = "w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-gray-50 focus:outline-none focus:bg-white focus:border-gray-400 transition-all";
const lbl = "text-[11px] text-gray-400 mb-1 block font-medium";

function ProductPicker({ productList, value, onChange }: { productList: KeyProduct[]; value: string; onChange: (id: string) => void }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {productList.map(p => (
        <button key={p.id} type="button" onClick={() => onChange(p.id)}
          className={`px-3 py-2.5 rounded-xl text-sm font-medium border-2 transition-all ${value === p.id ? 'border-starbucks-500 bg-starbucks-50 text-starbucks-700' : 'border-gray-200 text-gray-500'}`}>
          {p.name}
        </button>
      ))}
    </div>
  );
}

function OverviewForm({ init, productList, onSave, onCancel }: { init: ProductOverview | null; productList: KeyProduct[]; onSave: (d: ProductOverview) => void; onCancel: () => void }) {
  const [f, setF] = useState(init || { id: genId('PO'), productId: productList[0]?.id || 'p11', date: new Date().toISOString().slice(0, 10), restockQty: 0, stockQty: 0, distributeQty: 0 });
  const set = (k: string, v: any) => setF({ ...f, [k]: v });
  return (
    <div className="p-6 space-y-4">
      <div><label className={lbl}>单品 *</label><ProductPicker productList={productList} value={f.productId} onChange={id => set('productId', id)} /></div>
      <div><label className={lbl}>日期</label><input type="date" value={f.date} onChange={e => set('date', e.target.value)} className={cls} /></div>
      <div className="grid grid-cols-3 gap-3">
        <div><label className={lbl}>进货数量</label><input type="number" min="0" value={f.restockQty > 0 ? f.restockQty : ''} onChange={e => set('restockQty', parseInt(e.target.value) || 0)} placeholder="件" className={cls} /></div>
        <div><label className={lbl}>库存数量</label><input type="number" min="0" value={f.stockQty > 0 ? f.stockQty : ''} onChange={e => set('stockQty', parseInt(e.target.value) || 0)} placeholder="件" className={cls} /></div>
        <div><label className={lbl}>分销数量</label><input type="number" min="0" value={f.distributeQty > 0 ? f.distributeQty : ''} onChange={e => set('distributeQty', parseInt(e.target.value) || 0)} placeholder="件" className={cls} /></div>
      </div>
      <div className="flex justify-end gap-3 pt-2">
        <button onClick={onCancel} className="px-5 py-2.5 text-sm text-gray-500 hover:bg-gray-50 rounded-xl">取消</button>
        <button onClick={() => { if (f.restockQty > 0) onSave(f); }} className="px-6 py-2.5 bg-gray-900 text-white rounded-xl text-sm font-medium">保存</button>
      </div>
    </div>
  );
}

function DistForm({ init, productList, onSave, onCancel }: { init: DistributorDistribution | null; productList: KeyProduct[]; onSave: (d: DistributorDistribution) => void; onCancel: () => void }) {
  const [f, setF] = useState(init || { id: genId('PD'), productId: productList[0]?.id || 'p11', distributorName: '', quantity: 0, downstreamCount: 0, outletCount: 0, strength: '中' as const, remark: '' });
  const set = (k: string, v: any) => setF({ ...f, [k]: v });
  return (
    <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
      <div><label className={lbl}>单品 *</label><ProductPicker productList={productList} value={f.productId} onChange={id => set('productId', id)} /></div>
      <div><label className={lbl}>分销商名称 *</label><input value={f.distributorName} onChange={e => set('distributorName', e.target.value)} placeholder="如：山海关梁波" className={cls} /></div>
      <div><label className={lbl}>发货数量</label><input type="number" min="0" value={f.quantity > 0 ? f.quantity : ''} onChange={e => set('quantity', parseInt(e.target.value) || 0)} placeholder="件" className={cls} /></div>
      <div className="grid grid-cols-2 gap-3">
        <div><label className={lbl}>下游客户数</label><input type="number" min="0" value={f.downstreamCount > 0 ? f.downstreamCount : ''} onChange={e => set('downstreamCount', parseInt(e.target.value) || 0)} className={cls} /></div>
        <div><label className={lbl}>网点数</label><input type="number" min="0" value={f.outletCount > 0 ? f.outletCount : ''} onChange={e => set('outletCount', parseInt(e.target.value) || 0)} placeholder="销售终端/POD" className={cls} /></div>
      </div>
      <div><label className={lbl}>分销商实力</label>
        <div className="grid grid-cols-3 gap-2">
          {(['强', '中', '弱'] as const).map(s => (
            <button key={s} type="button" onClick={() => set('strength', s)}
              className={`px-3 py-2 rounded-xl text-sm font-medium border-2 ${f.strength === s ? 'border-starbucks-500 bg-starbucks-50 text-starbucks-700' : 'border-gray-200 text-gray-500'}`}>{s}</button>
          ))}
        </div>
      </div>
      <div><label className={lbl}>备注</label><input value={f.remark} onChange={e => set('remark', e.target.value)} className={cls} /></div>
      <div className="flex justify-end gap-3 pt-2">
        <button onClick={onCancel} className="px-5 py-2.5 text-sm text-gray-500 hover:bg-gray-50 rounded-xl">取消</button>
        <button onClick={() => { if (f.distributorName) onSave(f); }} className="px-6 py-2.5 bg-gray-900 text-white rounded-xl text-sm font-medium">保存</button>
      </div>
    </div>
  );
}

function PlanForm({ init, productList, onSave, onCancel }: { init: MarketPlan | null; productList: KeyProduct[]; onSave: (d: MarketPlan) => void; onCancel: () => void }) {
  const [f, setF] = useState(init || { id: genId('PL'), productId: productList[0]?.id || 'p11', title: '', keyRegion: '', strategy: '', promotionMethod: '', targetDistributor: 0, monthlyNewDistributor: 0, targetOutlet: 0, targetSales: 0, startDate: '', endDate: '', budget: 0, remark: '' });
  const set = (k: string, v: any) => setF({ ...f, [k]: v });
  return (
    <div className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
      <div><label className={lbl}>单品 *</label><ProductPicker productList={productList} value={f.productId} onChange={id => set('productId', id)} /></div>
      <div><label className={lbl}>计划标题</label><input value={f.title} onChange={e => set('title', e.target.value)} placeholder="如：P450黑咖啡 唐山区域铺货计划" className={cls} /></div>
      <div><label className={lbl}>重点区域</label><input value={f.keyRegion} onChange={e => set('keyRegion', e.target.value)} placeholder="如：唐山、秦皇岛、石家庄" className={cls} /></div>

      <div className="border-t border-gray-100 pt-3">
        <p className="text-xs font-bold text-gray-600 mb-2">目标指标</p>
        <div className="grid grid-cols-2 gap-3">
          <div><label className={lbl}>目标分销商数</label><input type="number" min="0" value={f.targetDistributor > 0 ? f.targetDistributor : ''} onChange={e => set('targetDistributor', parseInt(e.target.value) || 0)} placeholder="家" className={cls} /></div>
          <div><label className={lbl}>每月新增分销商</label><input type="number" min="0" value={f.monthlyNewDistributor > 0 ? f.monthlyNewDistributor : ''} onChange={e => set('monthlyNewDistributor', parseInt(e.target.value) || 0)} placeholder="家/月" className={cls} /></div>
          <div><label className={lbl}>目标网点数</label><input type="number" min="0" value={f.targetOutlet > 0 ? f.targetOutlet : ''} onChange={e => set('targetOutlet', parseInt(e.target.value) || 0)} placeholder="家" className={cls} /></div>
          <div><label className={lbl}>目标销量</label><input type="number" min="0" value={f.targetSales > 0 ? f.targetSales : ''} onChange={e => set('targetSales', parseInt(e.target.value) || 0)} placeholder="件" className={cls} /></div>
          <div><label className={lbl}>费用预算</label><input type="number" min="0" value={f.budget > 0 ? f.budget : ''} onChange={e => set('budget', parseInt(e.target.value) || 0)} placeholder="元" className={cls} /></div>
        </div>
      </div>

      <div className="border-t border-gray-100 pt-3">
        <p className="text-xs font-bold text-gray-600 mb-2">市场策略</p>
        <div><label className={lbl}>推广方式</label><input value={f.promotionMethod} onChange={e => set('promotionMethod', e.target.value)} placeholder="如：终端陈列+品鉴活动+买赠促销" className={cls} /></div>
        <div className="mt-3"><label className={lbl}>怎么做</label><textarea value={f.strategy} onChange={e => set('strategy', e.target.value)} placeholder="如：进驻XX商超系统、联合经销商做终端陈列、做品鉴推广活动..." rows={3} className={cls} /></div>
      </div>

      <div className="border-t border-gray-100 pt-3">
        <p className="text-xs font-bold text-gray-600 mb-2">时间</p>
        <div className="grid grid-cols-2 gap-3">
          <div><label className={lbl}>开始时间</label><input type="date" value={f.startDate} onChange={e => set('startDate', e.target.value)} className={cls} /></div>
          <div><label className={lbl}>结束时间</label><input type="date" value={f.endDate} onChange={e => set('endDate', e.target.value)} className={cls} /></div>
        </div>
      </div>

      <div><label className={lbl}>备注</label><input value={f.remark} onChange={e => set('remark', e.target.value)} className={cls} /></div>
      <div className="flex justify-end gap-3 pt-2">
        <button onClick={onCancel} className="px-5 py-2.5 text-sm text-gray-500 hover:bg-gray-50 rounded-xl">取消</button>
        <button onClick={() => { if (f.title || f.strategy) onSave(f); }} className="px-6 py-2.5 bg-gray-900 text-white rounded-xl text-sm font-medium">保存</button>
      </div>
    </div>
  );
}
