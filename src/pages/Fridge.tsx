import { useState, useMemo, useEffect, useRef } from 'react';
import { Plus, X, Search, Upload, Camera, Trash2, Edit3 } from 'lucide-react';
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
    flush(items.find(i => i.id === d.id) ? items.map(i => i.id === d.id ? d : i) : [...items, d]);
    setModal(null); setAdding(false);
  };

  const del = (id: string) => { if (confirm('确认删除这台冰箱？')) flush(items.filter(i => i.id !== id)); };

  const filtered = useMemo(() => {
    if (!search) return items;
    const q = search.toLowerCase();
    return items.filter(i => i.terminalName.toLowerCase().includes(q) || i.barcode.toLowerCase().includes(q) || i.distributorName.toLowerCase().includes(q));
  }, [items, search]);

  const summary = useMemo(() => ({
    total: items.length, active: items.filter(i => i.status === 'active').length,
    repair: items.filter(i => i.status === 'repair').length, scrap: items.filter(i => i.status === 'scrapped').length,
  }), [items]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      <div className="p-4 md:p-6 space-y-5 max-w-6xl mx-auto">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">冰箱资产管理</h1>
            <p className="text-sm text-gray-400 mt-0.5">{summary.total}台 · 使用中{summary.active} · 维修{summary.repair} · 报废{summary.scrap}</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="搜索终端/条形码..."
                className="pl-8 pr-3 py-2 border border-gray-200 rounded-xl text-sm w-48 focus:outline-none focus:border-gray-400" />
            </div>
            <button onClick={() => setAdding(true)}
              className="flex items-center gap-1.5 px-4 py-2 bg-gray-900 text-white rounded-xl text-sm font-medium hover:bg-gray-800 shadow-sm">
              <Plus size={16} />新增冰箱
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50/50 border-b border-gray-100 text-[11px] text-gray-400">
                  <th className="text-left px-5 py-3 font-medium">照片</th>
                  <th className="text-left px-3 py-3 font-medium">终端名称</th>
                  <th className="text-left px-3 py-3 font-medium">经销商</th>
                  <th className="text-left px-3 py-3 font-medium">条形码</th>
                  <th className="text-left px-3 py-3 font-medium">型号</th>
                  <th className="text-left px-3 py-3 font-medium">状态</th>
                  <th className="text-left px-3 py-3 font-medium hidden md:table-cell">地址</th>
                  <th className="text-left px-3 py-3 font-medium hidden lg:table-cell">投放日</th>
                  <th className="text-center px-3 py-3 font-medium w-20">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map(f => (
                  <tr key={f.id} className="hover:bg-gray-50/30 transition-colors">
                    <td className="px-5 py-2.5">
                      {f.imageUrl ? (
                        <img src={f.imageUrl} className="w-12 h-12 rounded-lg object-cover bg-gray-100" alt="" />
                      ) : (
                        <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center"><Camera size={16} className="text-gray-300" /></div>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-xs font-medium text-gray-800">{f.terminalName}</td>
                    <td className="px-3 py-2.5 text-xs text-gray-500">{f.distributorName}</td>
                    <td className="px-3 py-2.5 text-xs text-gray-500 font-mono">{f.barcode || '—'}</td>
                    <td className="px-3 py-2.5 text-xs text-gray-500">{f.model || '—'}</td>
                    <td className="px-3 py-2.5">
                      <select value={f.status} onChange={e => flush(items.map(i => i.id === f.id ? { ...i, status: e.target.value as FridgeRecord['status'] } : i))}
                        className={`text-[10px] px-2 py-0.5 rounded-full border-0 font-medium cursor-pointer ${
                          f.status === 'active' ? 'bg-emerald-50 text-emerald-600' :
                          f.status === 'repair' ? 'bg-amber-50 text-amber-600' : 'bg-red-50 text-red-500'
                        }`}>
                        <option value="active">使用中</option>
                        <option value="repair">维修中</option>
                        <option value="scrapped">已报废</option>
                      </select>
                    </td>
                    <td className="px-3 py-2.5 text-xs text-gray-400 hidden md:table-cell max-w-[120px] truncate">{f.address || '—'}</td>
                    <td className="px-3 py-2.5 text-xs text-gray-400 hidden lg:table-cell">{f.date}</td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center justify-center gap-1">
                        <button onClick={() => setModal(f)} className="p-1.5 rounded-lg text-gray-300 hover:text-blue-500 hover:bg-blue-50"><Edit3 size={13} /></button>
                        <button onClick={() => del(f.id)} className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50"><Trash2 size={13} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {filtered.length === 0 && (
            <div className="py-12 text-center text-gray-400 text-sm">暂无冰箱资产</div>
          )}
        </div>

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
    // Compress large images
    const reader = new FileReader();
    reader.onload = (ev) => setForm({ ...form, imageUrl: ev.target?.result as string });
    if (file.size > 500000) {
      // Resize before reading
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxW = 600; canvas.width = maxW; canvas.height = (img.height / img.width) * maxW;
        canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
        setForm({ ...form, imageUrl: canvas.toDataURL('image/jpeg', 0.6) });
      };
      img.src = URL.createObjectURL(file);
    } else {
      reader.readAsDataURL(file);
    }
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
        <div><label className={lbl}>终端名称 *</label><input value={form.terminalName} onChange={e => setForm({ ...form, terminalName: e.target.value })} placeholder="店铺/终端名" className={cls} /></div>
        <div><label className={lbl}>资产条形码</label><input value={form.barcode} onChange={e => setForm({ ...form, barcode: e.target.value })} placeholder="扫码或手动输入" className={cls} /></div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div><label className={lbl}>型号</label><input value={form.model} onChange={e => setForm({ ...form, model: e.target.value })} placeholder="冰箱型号" className={cls} /></div>
        <div><label className={lbl}>状态</label><select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} className={cls}><option value="active">使用中</option><option value="repair">维修中</option><option value="scrapped">已报废</option></select></div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div><label className={lbl}>投放日期</label><input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} className={cls} /></div>
        <div><label className={lbl}>摆放地址</label><input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} placeholder="详细地址" className={cls} /></div>
      </div>
      <div>
        <label className={lbl}>冰箱照片（自动压缩）</label>
        <input type="file" accept="image/*" capture="environment" onChange={handleImage} ref={fileRef} className="hidden" />
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => fileRef?.current?.click()} className="flex items-center gap-1.5 px-4 py-2 border border-dashed border-gray-300 rounded-xl text-sm text-gray-500 hover:border-gray-400">
            <Upload size={15} />{form.imageUrl ? '更换照片' : '上传照片'}
          </button>
          {form.imageUrl && (
            <div className="relative w-16 h-16 rounded-lg overflow-hidden bg-gray-100">
              <img src={form.imageUrl} alt="" className="w-full h-full object-cover" />
              <button onClick={() => setForm({ ...form, imageUrl: '' })} className="absolute top-0 right-0 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-[10px]">×</button>
            </div>
          )}
        </div>
      </div>
      <div><label className={lbl}>备注</label><input value={form.remark} onChange={e => setForm({ ...form, remark: e.target.value })} placeholder="备注" className={cls} /></div>
      <div className="flex justify-end gap-3 pt-2">
        <button onClick={onCancel} className="px-5 py-2.5 text-sm text-gray-500 hover:bg-gray-50 rounded-xl">取消</button>
        <button onClick={() => { if (form.terminalName) onSave(form); }} className="px-6 py-2.5 bg-gray-900 text-white rounded-xl text-sm font-medium hover:bg-gray-800 shadow-sm">保存</button>
      </div>
    </div>
  );
}
