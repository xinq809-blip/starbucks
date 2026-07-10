import { useState, useMemo, useEffect } from 'react';
import { Plus, Trash2, Check, X, Pencil } from 'lucide-react';
import type { BilliardLocation } from '../types/billiard';
import { supabase } from '../lib/supabase';

const STAGES = ['初次接触', '意向确认', '合同谈判', '签约完成', '装修进场', '正式运营', '已关闭'];
const STATUS_MAP: Record<string, { label: string; color: string }> = {
  cooperating: { label: '已完成合作', color: 'bg-emerald-100 text-emerald-700' },
  negotiating: { label: '沟通中', color: 'bg-amber-100 text-amber-700' },
  not_needed: { label: '不需要', color: 'bg-gray-100 text-gray-500' },
};

function genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

export default function BilliardPage() {
  const [items, setItems] = useState<BilliardLocation[]>([]);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [billLoaded, setBillLoaded] = useState(false);
  const emptyForm = { name: '', address: '', contact: '', phone: '', manager: '', status: 'negotiating' as BilliardLocation['status'], stage: '初次接触', orderQty: 0, displayFee: 0, remark: '' };
  const [form, setForm] = useState(emptyForm);

  // Load from Supabase
  useEffect(() => {
    supabase.from('billiard_locations').select('*').then(r => {
      setItems((r.data || []).map((row: any) => row.data));
      setBillLoaded(true);
    });
  }, []);

  // Save to Supabase
  useEffect(() => {
    if (billLoaded) supabase.from('billiard_locations').upsert(items.map(d => ({ id: d.id || genId(), data: d })), { onConflict: 'id' }).then(() => {});
  }, [items]);

  const flush = (data: BilliardLocation[]) => setItems(data);

  const resetForm = () => setForm(emptyForm);

  const add = () => {
    if (!form.name) return;
    flush([...items, { ...form, id: genId(), date: new Date().toISOString().slice(0, 10) }]);
    resetForm(); setAdding(false);
  };

  const update = (id: string) => {
    flush(items.map((i) => i.id === id ? { ...form, id, date: new Date().toISOString().slice(0, 10) } : i));
    resetForm(); setEditing(null);
  };

  const startEdit = (item: BilliardLocation) => {
    setEditing(item.id);
    setForm({ name: item.name, address: item.address, contact: item.contact, phone: item.phone, manager: item.manager || '', status: item.status, stage: item.stage, orderQty: item.orderQty ?? 0, displayFee: item.displayFee ?? 0, remark: item.remark });
  };

  const del = (id: string) => flush(items.filter((i) => i.id !== id));

  // Summary
  const summary = useMemo(() => {
    const cooperating = items.filter((i) => i.status === 'cooperating');
    const negotiating = items.filter((i) => i.status === 'negotiating').length;
    const notNeeded = items.filter((i) => i.status === 'not_needed').length;
    const totalOrder = items.reduce((s, i) => s + (i.orderQty || 0), 0);
    const totalFee = items.reduce((s, i) => s + (i.displayFee || 0), 0);
    const coopOrder = cooperating.reduce((s, i) => s + (i.orderQty || 0), 0);
    const coopFee = cooperating.reduce((s, i) => s + (i.displayFee || 0), 0);

    const managerMap: Record<string, { stores: number; cooperating: number; negotiating: number; notNeeded: number; orderQty: number; displayFee: number; coopOrder: number; coopFee: number }> = {};
    for (const i of items) {
      const m = i.manager || '未分配';
      if (!managerMap[m]) managerMap[m] = { stores: 0, cooperating: 0, negotiating: 0, notNeeded: 0, orderQty: 0, displayFee: 0, coopOrder: 0, coopFee: 0 };
      managerMap[m].stores++;
      managerMap[m].orderQty += i.orderQty || 0;
      managerMap[m].displayFee += i.displayFee || 0;
      if (i.status === 'cooperating') { managerMap[m].cooperating++; managerMap[m].coopOrder += i.orderQty || 0; managerMap[m].coopFee += i.displayFee || 0; }
      if (i.status === 'negotiating') managerMap[m].negotiating++;
      if (i.status === 'not_needed') managerMap[m].notNeeded++;
    }
    const byManager = Object.entries(managerMap).map(([name, d]) => ({ name, ...d })).sort((a, b) => b.stores - a.stores);

    return { total: items.length, cooperating: cooperating.length, negotiating, notNeeded, totalOrder, totalFee, coopOrder, coopFee, byManager };
  }, [items]);

  // By stage
  const byStage = useMemo(() => {
    return STAGES.map((stage) => {
      const count = items.filter((i) => i.stage === stage).length;
      return { stage, count };
    }).filter((s) => s.count > 0);
  }, [items]);

  return (
    <div className="p-3 md:p-6 space-y-4">
      <div>
        <h1 className="text-xl md:text-2xl font-bold text-gray-800">台球厅专案开发</h1>
        <p className="text-xs text-gray-400 mt-0.5">网点开发明细 · 进度追踪</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2 md:gap-3">
        {[
          ['已完成合作', summary.cooperating + ' 家', 'bg-emerald-50 text-emerald-700'],
          ['总订货量', summary.totalOrder.toLocaleString() + ' 件', 'bg-blue-50 text-blue-700'],
          ['陈列费用', '¥' + summary.totalFee.toLocaleString(), 'bg-violet-50 text-violet-700'],
          ['总网点', summary.total + ' 家', 'bg-gray-50'],
          ['沟通中', summary.negotiating + ' 家', 'bg-amber-50 text-amber-700'],
          ['不需要', summary.notNeeded + ' 家', 'bg-gray-100 text-gray-500'],
        ].map(([l, v, cls]) => (
          <div key={l as string} className={`rounded-lg border border-gray-200 p-3 text-center ${cls}`}>
            <p className="text-[11px] text-gray-500">{l}</p>
            <p className="text-base md:text-lg font-bold">{v as string}</p>
          </div>
        ))}
      </div>

      {/* Per-manager breakdown */}
      {summary.byManager.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">负责人开发汇总</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {summary.byManager.map(m => (
              <div key={m.name} className="border border-gray-100 rounded-xl p-4 hover:shadow-sm transition-shadow">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-bold text-gray-800">{m.name}</p>
                  <span className="text-[11px] text-gray-400">共 {m.stores} 家门店</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-emerald-50 rounded-lg p-2 text-center">
                    <p className="text-[10px] text-emerald-600">已完成合作</p>
                    <p className="text-sm font-bold text-emerald-700">{m.cooperating}</p>
                  </div>
                  <div className="bg-blue-50 rounded-lg p-2 text-center">
                    <p className="text-[10px] text-blue-600">总订货量</p>
                    <p className="text-sm font-bold text-blue-700">{m.orderQty.toLocaleString()}件</p>
                  </div>
                  <div className="bg-violet-50 rounded-lg p-2 text-center">
                    <p className="text-[10px] text-violet-600">陈列费用</p>
                    <p className="text-sm font-bold text-violet-700">¥{m.displayFee.toLocaleString()}</p>
                  </div>
                  <div className="bg-amber-50 rounded-lg p-2 text-center">
                    <p className="text-[10px] text-amber-600">沟通中</p>
                    <p className="text-sm font-bold text-amber-700">{m.negotiating}</p>
                  </div>
                </div>
                {/* Progress bar: cooperating / stores */}
                <div className="mt-3">
                  <div className="flex justify-between text-[10px] text-gray-400 mb-1">
                    <span>合作率</span>
                    <span>{m.stores > 0 ? Math.round((m.cooperating / m.stores) * 100) : 0}%</span>
                  </div>
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-emerald-400 to-emerald-500 rounded-full transition-all"
                      style={{ width: `${m.stores > 0 ? (m.cooperating / m.stores) * 100 : 0}%` }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Stage distribution */}
      {byStage.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-2">各阶段分布</h3>
          <div className="flex flex-wrap gap-2">
            {byStage.map(({ stage, count }) => (
              <div key={stage} className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 rounded-lg text-xs">
                <span className="font-medium text-gray-700">{stage}</span>
                <span className="font-bold text-starbucks-600">{count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Location table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs md:text-sm">
            <thead><tr className="bg-gray-50 border-b border-gray-200 text-gray-500">
              <th className="text-left px-3 py-2 font-medium">网点名称</th>
              <th className="text-left px-3 py-2 font-medium hidden md:table-cell">地址</th>
              <th className="text-left px-3 py-2 font-medium">负责人</th>
              <th className="text-left px-3 py-2 font-medium hidden lg:table-cell">联系人</th>
              <th className="text-right px-3 py-2 font-medium">订货量</th>
              <th className="text-right px-3 py-2 font-medium hidden sm:table-cell">陈列费</th>
              <th className="text-left px-3 py-2 font-medium">状态</th>
              <th className="text-center px-3 py-2 font-medium w-20">操作</th>
            </tr></thead>
            <tbody className="divide-y divide-gray-50">
              {items.map((i) => (
                <tr key={i.id} className="hover:bg-gray-50/50">
                  <td className="px-3 py-2">
                    <p className="font-medium text-gray-800">{i.name}</p>
                    <p className="text-[10px] text-gray-400 md:hidden">{i.address}</p>
                  </td>
                  <td className="px-3 py-2 text-gray-500 hidden md:table-cell max-w-[120px] truncate">{i.address || '—'}</td>
                  <td className="px-3 py-2">
                    {i.manager ? <span className="text-xs font-medium text-gray-700 bg-gray-100 px-2 py-0.5 rounded-full">{i.manager}</span> : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-3 py-2 text-gray-500 hidden lg:table-cell">{i.contact ? `${i.contact} ${i.phone}` : '—'}</td>
                  <td className="px-3 py-2 text-right font-medium text-gray-800">{(i.orderQty || 0).toLocaleString()}</td>
                  <td className="px-3 py-2 text-right text-gray-600 hidden sm:table-cell">{i.displayFee ? '¥' + i.displayFee.toLocaleString() : '—'}</td>
                  <td className="px-3 py-2">
                    <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${STATUS_MAP[i.status]?.color}`}>
                      {STATUS_MAP[i.status]?.label}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-gray-500 text-[11px] hidden lg:table-cell">{i.stage}</td>
                  <td className="px-3 py-2 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <button onClick={() => startEdit(i)} className="text-gray-300 hover:text-blue-500"><Pencil size={13} /></button>
                      <button onClick={() => del(i.id)} className="text-gray-300 hover:text-red-500"><Trash2 size={13} /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr><td colSpan={8} className="text-center py-8 text-gray-400 text-sm">暂无网点数据，点击下方按钮添加</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit form */}
      {(adding || editing) ? (
        <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
          <h3 className="text-sm font-semibold text-gray-700">{editing ? '编辑网点' : '新增网点'}</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="网点名称 *" className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm" />
            <input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="地址" className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm" />
            <div className="flex gap-2">
              <input value={form.contact} onChange={(e) => setForm({ ...form, contact: e.target.value })} placeholder="联系人" className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm flex-1" />
              <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="电话" className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm w-32" />
            </div>
            <input value={form.manager} onChange={(e) => setForm({ ...form, manager: e.target.value })} placeholder="开发负责人" className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm" />
            <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as BilliardLocation['status'] })} className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm">
              {Object.entries(STATUS_MAP).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
            <select value={form.stage} onChange={(e) => setForm({ ...form, stage: e.target.value })} className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm">
              {STAGES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <input type="number" min="0" value={form.orderQty || ''} onChange={(e) => setForm({ ...form, orderQty: parseInt(e.target.value) || 0 })} placeholder="订货量(件)" className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm" />
            <input type="number" min="0" value={form.displayFee || ''} onChange={(e) => setForm({ ...form, displayFee: parseInt(e.target.value) || 0 })} placeholder="陈列费(元)" className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm" />
            <input value={form.remark} onChange={(e) => setForm({ ...form, remark: e.target.value })} placeholder="备注" className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm" />
          </div>
          <div className="flex gap-2">
            <button onClick={editing ? () => update(editing) : add} className="px-4 py-1.5 bg-starbucks-500 text-white rounded-lg text-sm font-medium"><Check size={14} className="inline mr-1" />{editing ? '保存' : '添加'}</button>
            <button onClick={() => { setAdding(false); setEditing(null); resetForm(); }} className="px-3 py-1.5 text-gray-400 text-sm"><X size={14} className="inline mr-1" />取消</button>
          </div>
        </div>
      ) : (
        <button onClick={() => setAdding(true)} className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-gray-500 border border-dashed border-gray-300 rounded-lg hover:border-starbucks-500 hover:text-starbucks-600 transition-colors">
          <Plus size={14} /> 新增开发网点
        </button>
      )}
    </div>
  );
}
