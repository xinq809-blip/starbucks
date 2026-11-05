import { useState, useMemo, useEffect } from 'react';
import { Plus, Trash2, Pencil, X, Package, TrendingUp, Store, Target, Settings2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { KeyProductRecord } from '../types/keyproduct';

function genId(p: string) { return p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

interface KeyProduct { id: string; name: string; color: string; }

const COLOR_PALETTE = ['#1e293b', '#059669', '#3b82f6', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4', '#ec4899', '#f97316', '#6366f1'];

const DEFAULT_PRODUCTS: KeyProduct[] = [
  { id: 'p11', name: 'P450 黑咖啡', color: '#1e293b' },
  { id: 'p20', name: 'P270 椰椰拿铁', color: '#059669' },
];

const emptyForm = {
  productId: 'p11', date: new Date().toISOString().slice(0, 10), restockQty: 0, stockQty: 0,
  distributeQty: 0, customerName: '', customerPod: 0, coverage: 0, futurePlan: '', remark: ''
};

export default function KeyProductPage() {
  const [items, setItems] = useState<KeyProductRecord[]>([]);
  const [productList, setProductList] = useState<KeyProduct[]>(DEFAULT_PRODUCTS);
  const [loaded, setLoaded] = useState(false);
  const [filter, setFilter] = useState<string>('all');
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<KeyProductRecord | null>(null);
  const [productModal, setProductModal] = useState(false);
  const [newProductName, setNewProductName] = useState('');

  const productById = (id: string) => productList.find(p => p.id === id);

  // 加载记录 + 单品列表
  useEffect(() => {
    Promise.all([
      supabase.from('key_products').select('*'),
      supabase.from('key_products_list').select('*'),
    ]).then(([recRes, listRes]) => {
      setItems((recRes.data || []).map((row: any) => row.data));
      const list = (listRes.data || []).map((row: any) => row.data);
      if (list.length > 0) setProductList(list);
      setLoaded(true);
    });
  }, []);

  const flushRecords = (data: KeyProductRecord[]) => {
    setItems(data);
    if (loaded) supabase.from('key_products').upsert(data.map(d => ({ id: d.id, data: d })), { onConflict: 'id' }).then(() => {});
  };

  const flushProducts = (data: KeyProduct[]) => {
    setProductList(data);
    if (loaded) supabase.from('key_products_list').upsert(data.map(d => ({ id: d.id, data: d })), { onConflict: 'id' }).then(() => {});
  };

  const save = (d: KeyProductRecord) => {
    flushRecords(items.find(i => i.id === d.id) ? items.map(i => i.id === d.id ? d : i) : [...items, d]);
    setModal(false); setEditing(null);
  };

  const del = async (id: string) => {
    if (!confirm('确认删除这条记录？')) return;
    setItems(items.filter(i => i.id !== id));
    try { await supabase.from('key_products').delete().eq('id', id); } catch {}
  };

  const addProduct = () => {
    const name = newProductName.trim();
    if (!name) return;
    const newProduct: KeyProduct = { id: genId('PP'), name, color: COLOR_PALETTE[productList.length % COLOR_PALETTE.length] };
    flushProducts([...productList, newProduct]);
    setNewProductName('');
    setProductModal(false);
  };

  const delProduct = async (id: string) => {
    if (!confirm('确认删除该单品？相关记录会保留但单品不可再选')) return;
    flushProducts(productList.filter(p => p.id !== id));
    try { await supabase.from('key_products_list').delete().eq('id', id); } catch {}
  };

  const filtered = useMemo(() => {
    if (filter === 'all') return items;
    return items.filter(i => i.productId === filter);
  }, [items, filter]);

  const summary = useMemo(() => {
    const list = filter === 'all' ? items : items.filter(i => i.productId === filter);
    const totalRestock = list.reduce((s, i) => s + (i.restockQty || 0), 0);
    const totalStock = list.reduce((s, i) => s + (i.stockQty || 0), 0);
    const totalDistribute = list.reduce((s, i) => s + (i.distributeQty || 0), 0);
    const totalPod = list.reduce((s, i) => s + (i.customerPod || 0), 0);
    const distRate = totalRestock > 0 ? Math.round((totalDistribute / totalRestock) * 100) : 0;
    return { totalRestock, totalStock, totalDistribute, totalPod, distRate, count: list.length };
  }, [items, filter]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      <div className="p-4 md:p-6 space-y-5 max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">重点单品追踪</h1>
            <p className="text-sm text-gray-400 mt-0.5">单品分销明细与覆盖</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setProductModal(true)}
              className="flex items-center gap-1.5 px-4 py-2 bg-white border border-gray-200 text-gray-600 rounded-xl text-sm font-medium hover:bg-gray-50">
              <Settings2 size={16} />管理单品
            </button>
            <button onClick={() => { setEditing(null); setModal(true); }}
              className="flex items-center gap-1.5 px-4 py-2 bg-gray-900 text-white rounded-xl text-sm font-medium hover:bg-gray-800">
              <Plus size={16} />录入数据
            </button>
          </div>
        </div>

        {/* 单品筛选 */}
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => setFilter('all')}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${filter === 'all' ? 'bg-gray-900 text-white' : 'bg-white border border-gray-200 text-gray-500'}`}>
            全部
          </button>
          {productList.map(p => (
            <button key={p.id} onClick={() => setFilter(p.id)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${filter === p.id ? 'bg-gray-900 text-white' : 'bg-white border border-gray-200 text-gray-500'}`}>
              <span className="w-2 h-2 rounded-full inline-block mr-1.5" style={{ backgroundColor: p.color }} />{p.name}
            </button>
          ))}
        </div>

        {/* 汇总卡片 */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            { label: '进货总量', v: summary.totalRestock, unit: '件', icon: Package, color: 'text-blue-600', bg: 'bg-blue-50' },
            { label: '库存总量', v: summary.totalStock, unit: '件', icon: Package, color: 'text-violet-600', bg: 'bg-violet-50' },
            { label: '分销总量', v: summary.totalDistribute, unit: '件', icon: TrendingUp, color: 'text-emerald-600', bg: 'bg-emerald-50' },
            { label: '分销率', v: summary.distRate + '%', unit: '', icon: Target, color: 'text-starbucks-600', bg: 'bg-starbucks-50' },
            { label: '下游POD', v: summary.totalPod, unit: '个', icon: Store, color: 'text-amber-600', bg: 'bg-amber-50' },
          ].map(c => (
            <div key={c.label} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-gray-500">{c.label}</span>
                <div className={`p-1.5 rounded-lg ${c.bg}`}><c.icon size={15} className={c.color} /></div>
              </div>
              <div className="text-2xl font-bold text-gray-800">{c.v.toLocaleString()}{c.unit && <span className="text-sm font-normal text-gray-400 ml-1">{c.unit}</span>}</div>
            </div>
          ))}
        </div>

        {/* 表格 */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50/50 border-b border-gray-100 text-xs text-gray-500">
                  <th className="text-left px-5 py-3 font-medium">单品</th>
                  <th className="text-left px-3 py-3 font-medium">日期</th>
                  <th className="text-left px-3 py-3 font-medium">下游客户</th>
                  <th className="text-right px-3 py-3 font-medium">进货</th>
                  <th className="text-right px-3 py-3 font-medium">库存</th>
                  <th className="text-right px-3 py-3 font-medium">分销</th>
                  <th className="text-right px-3 py-3 font-medium">POD数</th>
                  <th className="text-right px-3 py-3 font-medium">覆盖</th>
                  <th className="text-left px-3 py-3 font-medium">后期计划</th>
                  <th className="text-center px-3 py-3 font-medium w-16">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.length === 0 ? (
                  <tr><td colSpan={10} className="text-center py-12 text-gray-400">暂无数据，点击右上角「录入数据」</td></tr>
                ) : (
                  filtered.map(i => {
                    const p = productById(i.productId);
                    return (
                      <tr key={i.id} className="hover:bg-gray-50/30 group">
                        <td className="px-5 py-3">
                          <span className="inline-flex items-center gap-1.5 text-xs font-bold" style={{ color: p?.color || '#666' }}>
                            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: p?.color || '#666' }} />{p?.name || i.productId}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-gray-500">{i.date}</td>
                        <td className="px-3 py-3 text-gray-700 font-medium max-w-[120px] truncate">{i.customerName || '—'}</td>
                        <td className="px-3 py-3 text-right text-gray-600">{i.restockQty > 0 ? i.restockQty.toLocaleString() : '—'}</td>
                        <td className="px-3 py-3 text-right text-gray-600">{i.stockQty > 0 ? i.stockQty.toLocaleString() : '—'}</td>
                        <td className="px-3 py-3 text-right font-bold text-emerald-600">{i.distributeQty > 0 ? i.distributeQty.toLocaleString() : '—'}</td>
                        <td className="px-3 py-3 text-right text-gray-600">{i.customerPod > 0 ? i.customerPod.toLocaleString() : '—'}</td>
                        <td className="px-3 py-3 text-right text-gray-600">{i.coverage > 0 ? i.coverage.toLocaleString() : '—'}</td>
                        <td className="px-3 py-3 text-gray-400 max-w-[140px] truncate">{i.futurePlan || '—'}</td>
                        <td className="px-3 py-3 text-center">
                          <div className="flex justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => { setEditing(i); setModal(true); }} className="p-1.5 text-gray-300 hover:text-blue-500"><Pencil size={14} /></button>
                            <button onClick={() => del(i.id)} className="p-1.5 text-gray-300 hover:text-red-500"><Trash2 size={14} /></button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* 录入数据 Modal */}
        {modal && (
          <div className="fixed inset-0 z-50 flex items-start justify-center pt-[8vh] p-4">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => { setModal(false); setEditing(null); }} />
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50/50">
                <h3 className="text-sm font-semibold text-gray-800">{editing ? '编辑记录' : '录入数据'}</h3>
                <button onClick={() => { setModal(false); setEditing(null); }} className="p-1.5 rounded-full hover:bg-gray-200"><X size={16} className="text-gray-400" /></button>
              </div>
              <KeyProductForm init={editing} productList={productList} onSave={save} onCancel={() => { setModal(false); setEditing(null); }} />
            </div>
          </div>
        )}

        {/* 管理单品 Modal */}
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
                  <input value={newProductName} onChange={e => setNewProductName(e.target.value)} placeholder="新单品名称，如：P200 榛果味拿铁" className="flex-1 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-gray-400" onKeyDown={e => e.key === 'Enter' && addProduct()} />
                  <button onClick={addProduct} className="px-4 py-2.5 bg-gray-900 text-white rounded-xl text-sm font-medium">添加</button>
                </div>
                <div className="space-y-1.5">
                  {productList.map(p => (
                    <div key={p.id} className="flex items-center justify-between p-2.5 bg-gray-50 rounded-xl">
                      <span className="flex items-center gap-2 text-sm font-medium text-gray-700">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: p.color }} />{p.name}
                      </span>
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

function KeyProductForm({ init, productList, onSave, onCancel }: { init: KeyProductRecord | null; productList: KeyProduct[]; onSave: (d: KeyProductRecord) => void; onCancel: () => void }) {
  const [f, setF] = useState(init || { ...emptyForm, id: genId('KP'), productId: productList[0]?.id || 'p11' });
  const cls = "w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-gray-50 focus:outline-none focus:bg-white focus:border-gray-400 transition-all";
  const lbl = "text-[11px] text-gray-400 mb-1 block font-medium";

  const set = (k: string, v: any) => setF({ ...f, [k]: v });
  const distRate = f.restockQty > 0 ? Math.round((f.distributeQty / f.restockQty) * 100) : 0;

  return (
    <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
      <div>
        <label className={lbl}>单品选择 *</label>
        <div className="grid grid-cols-2 gap-2">
          {productList.map(p => (
            <button key={p.id} type="button" onClick={() => set('productId', p.id)}
              className={`px-3 py-2.5 rounded-xl text-sm font-medium border-2 transition-all ${f.productId === p.id ? 'border-starbucks-500 bg-starbucks-50 text-starbucks-700' : 'border-gray-200 text-gray-500'}`}>
              {p.name}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className={lbl}>录入日期</label>
        <input type="date" value={f.date} onChange={e => set('date', e.target.value)} className={cls} />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div><label className={lbl}>进货数量 *</label><input type="number" min="0" value={f.restockQty > 0 ? f.restockQty : ''} onChange={e => set('restockQty', parseInt(e.target.value) || 0)} placeholder="件" className={cls} /></div>
        <div><label className={lbl}>目前库存数量</label><input type="number" min="0" value={f.stockQty > 0 ? f.stockQty : ''} onChange={e => set('stockQty', parseInt(e.target.value) || 0)} placeholder="件" className={cls} /></div>
        <div><label className={lbl}>分销数量</label><input type="number" min="0" value={f.distributeQty > 0 ? f.distributeQty : ''} onChange={e => set('distributeQty', parseInt(e.target.value) || 0)} placeholder="件" className={cls} /></div>
      </div>

      {f.restockQty > 0 && (
        <div className="flex items-center gap-3 p-3 bg-starbucks-50 rounded-xl">
          <span className="text-xs text-gray-500">分销率</span>
          <span className={`text-lg font-bold ${distRate >= 80 ? 'text-emerald-600' : distRate >= 50 ? 'text-amber-600' : 'text-red-500'}`}>{distRate}%</span>
          <span className="text-xs text-gray-400 ml-auto">分销 {f.distributeQty} / 进货 {f.restockQty}</span>
        </div>
      )}

      <div>
        <label className={lbl}>分销下游客户名称</label>
        <input value={f.customerName} onChange={e => set('customerName', e.target.value)} placeholder="如：唐山辰日 / XX便利店" className={cls} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div><label className={lbl}>下游客户 POD 数</label><input type="number" min="0" value={f.customerPod > 0 ? f.customerPod : ''} onChange={e => set('customerPod', parseInt(e.target.value) || 0)} placeholder="陈列点/网点数" className={cls} /></div>
        <div><label className={lbl}>目前覆盖数量</label><input type="number" min="0" value={f.coverage > 0 ? f.coverage : ''} onChange={e => set('coverage', parseInt(e.target.value) || 0)} placeholder="已覆盖网点数" className={cls} /></div>
      </div>

      <div>
        <label className={lbl}>后期计划</label>
        <textarea value={f.futurePlan} onChange={e => set('futurePlan', e.target.value)} placeholder="计划做成什么，如：新增XX家网点、提升覆盖率到XX%" rows={2} className={cls} />
      </div>

      <div>
        <label className={lbl}>备注</label>
        <input value={f.remark} onChange={e => set('remark', e.target.value)} placeholder="选填" className={cls} />
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <button onClick={onCancel} className="px-5 py-2.5 text-sm text-gray-500 hover:bg-gray-50 rounded-xl">取消</button>
        <button onClick={() => { if (f.restockQty > 0) onSave(f); }} className="px-6 py-2.5 bg-gray-900 text-white rounded-xl text-sm font-medium hover:bg-gray-800">保存</button>
      </div>
    </div>
  );
}
