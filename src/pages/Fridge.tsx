import { useState, useMemo, useEffect, useRef } from 'react';
import { Plus, X, Search, Upload, Camera } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useApp } from '../context/AppContext';
import type { FridgeRecord } from '../types/fridge';

function genId() { return 'F' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

export default function FridgePage() {
  const { state: { distributors } } = useApp();
  const [items, setItems] = useState<FridgeRecord[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState<FridgeRecord | null>(null);
  const [adding, setAdding] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    supabase.from('fridges').select('*').then(r => {
      setItems((r.data || []).map((row: any) => row.data));
      setLoaded(true);
    });
  }, []);

  const flush = (data: FridgeRecord[]) => {
    setItems(data);
    if (loaded) supabase.from('fridges').upsert(data.map(d => ({ id: d.id, data: d })), { onConflict: 'id' }).then(() => {});
  };

  const save = (d: FridgeRecord) => {
    if (items.find(i => i.id === d.id)) {
      flush(items.map(i => i.id === d.id ? d : i));
    } else {
      flush([...items, d]);
    }
    setModal(null); setAdding(false);
  };

  const filtered = useMemo(() => {
    if (!search) return items;
    const q = search.toLowerCase();
    return items.filter(i => i.terminalName.toLowerCase().includes(q) || i.barcode.includes(q) || i.distributorName.toLowerCase().includes(q));
  }, [items, search]);

  const summary = useMemo(() => ({
    total: items.length,
    active: items.filter(i => i.status === 'active').length,
    repair: items.filter(i => i.status === 'repair').length,
    scrap: items.filter(i => i.status === 'scrapped').length,
  }), [items]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      <div className="p-4 md:p-6 space-y-5 max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">冰箱资产管理</h1>
            <p className="text-sm text-gray-400 mt-0.5">{summary.total} 台 · 使用中 {summary.active} · 维修 {summary.repair} · 报废 {summary.scrap}</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="搜索终端/条形码..."
                className="pl-8 pr-3 py-2 border border-gray-200 rounded-xl text-sm w-48 focus:outline-none" />
            </div>
            <button onClick={() => setAdding(true)}
              className="flex items-center gap-1.5 px-4 py-2 bg-gray-900 text-white rounded-xl text-sm font-medium hover:bg-gray-800 shadow-sm">
              <Plus size={16} />新增冰箱
            </button>
          </div>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            ['总资产', summary.total, '台', 'bg-slate-50', '🧊'],
            ['使用中', summary.active, '台', 'bg-emerald-50', '✅'],
            ['维修中', summary.repair, '台', 'bg-amber-50', '🔧'],
            ['已报废', summary.scrap, '台', 'bg-red-50', '❌'],
          ].map(k => (
            <div key={k[0] as string} className={`${k[3]} rounded-2xl p-4 text-center`}>
              <p className="text-2xl mb-1">{k[4]}</p>
              <p className="text-2xl font-bold text-gray-800">{k[1] as number}<span className="text-sm font-normal text-gray-400"> {k[2]}</span></p>
              <p className="text-xs text-gray-500 mt-0.5">{k[0]}</p>
            </div>
          ))}
        </div>

        {/* Cards grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(f => (
            <div key={f.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-md transition-shadow group cursor-pointer" onClick={() => setModal(f)}>
              {/* Image */}
              <div className="h-40 bg-gray-100 flex items-center justify-center overflow-hidden">
                {f.imageUrl ? (
                  <img src={f.imageUrl} alt={f.terminalName} className="w-full h-full object-cover" />
                ) : (
                  <Camera size={32} className="text-gray-300" />
                )}
              </div>
              <div className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-gray-800 truncate">{f.terminalName}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{f.distributorName}</p>
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ml-2 flex-shrink-0 ${
                    f.status === 'active' ? 'bg-emerald-50 text-emerald-600' :
                    f.status === 'repair' ? 'bg-amber-50 text-amber-600' : 'bg-red-50 text-red-500'
                  }`}>{f.status === 'active' ? '使用中' : f.status === 'repair' ? '维修中' : '已报废'}</span>
                </div>
                <div className="text-xs text-gray-400 space-y-0.5">
                  {f.barcode && <p>🏷️ {f.barcode}</p>}
                  {f.model && <p>📦 {f.model}</p>}
                  {f.address && <p>📍 {f.address}</p>}
                </div>
              </div>
            </div>
          ))}
        </div>
        {filtered.length === 0 && (
          <div className="text-center py-12 text-gray-400">
            <p className="text-lg">🧊</p>
            <p className="text-sm mt-2">暂无冰箱资产</p>
          </div>
        )}

        {/* Modal */}
        {(modal || adding) && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => { setModal(null); setAdding(false); }} />
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto">
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-50 bg-gray-50/50">
                <h3 className="text-sm font-semibold text-gray-800">{modal ? '编辑冰箱' : '新增冰箱'}</h3>
                <button onClick={() => { setModal(null); setAdding(false); }} className="p-1.5 rounded-full hover:bg-gray-200"><X size={16} className="text-gray-400" /></button>
              </div>
              <FridgeForm
                initial={modal || { id: genId(), distributorId: distributors[0]?.id || '', distributorName: distributors[0]?.name || '', terminalName: '', barcode: '', model: '', status: 'active', address: '', imageUrl: '', remark: '', date: new Date().toISOString().slice(0, 10) }}
                distributors={distributors}
                onSave={save}
                onCancel={() => { setModal(null); setAdding(false); }}
                fileRef={fileRef}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function FridgeForm({ initial, distributors, onSave, onCancel, fileRef }: any) {
  const [form, setForm] = useState(initial);
  const cls = "w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-gray-50 focus:outline-none focus:bg-white focus:border-gray-400 transition-all";
  const lbl = "text-[11px] text-gray-400 mb-1 block font-medium";

  const handleImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setForm({ ...form, imageUrl: ev.target?.result as string });
    reader.readAsDataURL(file);
  };

  return (
    <div className="p-6 space-y-4">
      <div>
        <label className={lbl}>归属经销商 *</label>
        <select value={form.distributorId} onChange={e => {
          const d = distributors.find((x: any) => x.id === e.target.value);
          setForm({ ...form, distributorId: e.target.value, distributorName: d?.name || '' });
        }} className={cls}>
          {distributors.map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={lbl}>终端名称 *</label>
          <input value={form.terminalName} onChange={e => setForm({ ...form, terminalName: e.target.value })} placeholder="店铺/终端名" className={cls} />
        </div>
        <div>
          <label className={lbl}>资产条形码</label>
          <input value={form.barcode} onChange={e => setForm({ ...form, barcode: e.target.value })} placeholder="扫码或手动输入" className={cls} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={lbl}>型号</label>
          <input value={form.model} onChange={e => setForm({ ...form, model: e.target.value })} placeholder="冰箱型号" className={cls} />
        </div>
        <div>
          <label className={lbl}>状态</label>
          <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} className={cls}>
            <option value="active">使用中</option>
            <option value="repair">维修中</option>
            <option value="scrapped">已报废</option>
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={lbl}>投放日期</label>
          <input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} className={cls} />
        </div>
        <div>
          <label className={lbl}>摆放地址</label>
          <input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} placeholder="详细地址" className={cls} />
        </div>
      </div>
      <div>
        <label className={lbl}>冰箱照片</label>
        <input type="file" accept="image/*" capture="environment" onChange={handleImage} ref={fileRef} className="hidden" />
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => fileRef?.current?.click()} className="flex items-center gap-1.5 px-4 py-2 border border-dashed border-gray-300 rounded-xl text-sm text-gray-500 hover:border-gray-400 hover:text-gray-700">
            <Upload size={15} />{form.imageUrl ? '更换照片' : '上传照片'}
          </button>
          {form.imageUrl && (
            <div className="relative w-16 h-16 rounded-lg overflow-hidden bg-gray-100">
              <img src={form.imageUrl} alt="preview" className="w-full h-full object-cover" />
              <button onClick={() => setForm({ ...form, imageUrl: '' })} className="absolute top-0 right-0 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-[10px]">×</button>
            </div>
          )}
        </div>
      </div>
      <div>
        <label className={lbl}>备注</label>
        <input value={form.remark} onChange={e => setForm({ ...form, remark: e.target.value })} placeholder="备注信息" className={cls} />
      </div>
      <div className="flex justify-end gap-3 pt-2">
        <button onClick={onCancel} className="px-5 py-2.5 text-sm text-gray-500 hover:bg-gray-50 rounded-xl">取消</button>
        <button onClick={() => { if (form.terminalName) onSave(form); }} className="px-6 py-2.5 bg-gray-900 text-white rounded-xl text-sm font-medium hover:bg-gray-800 shadow-sm">保存</button>
      </div>
    </div>
  );
}
