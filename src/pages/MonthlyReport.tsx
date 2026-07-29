import { useState, useEffect } from 'react';
import { Plus, X, Edit3, Trash2, ChevronLeft, ChevronRight, Target, Clock, Calendar, CheckCircle2, UserCheck, Store, Truck, Package, FileText, Wrench, MoreHorizontal } from 'lucide-react';
import { supabase } from '../lib/supabase';

function genId(p: string) { return p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
function today(): string { return new Date().toISOString().slice(0, 10); }
function ml(m: string) { return m.replace('-', '年') + '月'; }

// ---- Types ----
interface WorkLog { id: string; date: string; content: string; category: string; result: string; }
interface PendingItem { id: string; month: string; title: string; detail: string; priority: 'high' | 'medium' | 'low'; progress: number; status: 'pending' | 'doing' | 'done'; deadline: string; result: string; }

// ---- Helpers ----
function fmt(d: string) {
  const dt = new Date(d + 'T00:00:00');
  return `${dt.getMonth() + 1}月${dt.getDate()}日 周${['日','一','二','三','四','五','六'][dt.getDay()]}`;
}
function addDay(d: string, n: number): string {
  const dt = new Date(d + 'T12:00:00'); dt.setDate(dt.getDate() + n); return dt.toISOString().slice(0, 10);
}

const ALL_MONTHS = Array.from({length: 12}, (_,i) => `2026-${String(i+1).padStart(2,'0')}`);

const catCfg: Record<string, { icon: any; color: string; bg: string; dot: string }> = {
  '经销商拜访': { icon: UserCheck, color: 'text-blue-600', bg: 'bg-blue-50', dot: 'bg-blue-500' },
  '新品推广': { icon: Package, color: 'text-emerald-600', bg: 'bg-emerald-50', dot: 'bg-emerald-500' },
  '库存盘点': { icon: FileText, color: 'text-violet-600', bg: 'bg-violet-50', dot: 'bg-violet-500' },
  '费用核销': { icon: FileText, color: 'text-amber-600', bg: 'bg-amber-50', dot: 'bg-amber-500' },
  '冰箱巡检': { icon: Wrench, color: 'text-cyan-600', bg: 'bg-cyan-50', dot: 'bg-cyan-500' },
  '商超对接': { icon: Store, color: 'text-pink-600', bg: 'bg-pink-50', dot: 'bg-pink-500' },
  '台球厅开发': { icon: Target, color: 'text-orange-600', bg: 'bg-orange-50', dot: 'bg-orange-500' },
  '物流配送': { icon: Truck, color: 'text-indigo-600', bg: 'bg-indigo-50', dot: 'bg-indigo-500' },
  '数据汇报': { icon: FileText, color: 'text-gray-600', bg: 'bg-gray-100', dot: 'bg-gray-500' },
  '其他': { icon: MoreHorizontal, color: 'text-gray-500', bg: 'bg-gray-50', dot: 'bg-gray-400' },
};
const logCategories = Object.keys(catCfg);

const priCfg: Record<string, { label: string; bg: string; bar: string; border: string }> = {
  high:   { label: '高优先', bg: 'bg-red-50 text-red-600', bar: 'bg-red-500', border: 'border-l-red-500' },
  medium: { label: '中优先', bg: 'bg-amber-50 text-amber-600', bar: 'bg-amber-500', border: 'border-l-amber-500' },
  low:    { label: '低优先', bg: 'bg-gray-100 text-gray-500', bar: 'bg-gray-400', border: 'border-l-gray-300' },
};

export default function DailyPlanPage() {
  const [tab, setTab] = useState<'log' | 'pending'>('log');

  // Work Log
  const [logDate, setLogDate] = useState(today());
  const [logs, setLogs] = useState<WorkLog[]>([]);
  const [logModal, setLogModal] = useState(false);
  const [editingLog, setEditingLog] = useState<WorkLog | null>(null);

  // Pending
  const [pMonth, setPMonth] = useState(ALL_MONTHS[new Date().getMonth()] || '2026-07');
  const [pending, setPending] = useState<PendingItem[]>([]);
  const [pendingModal, setPendingModal] = useState(false);
  const [editingPending, setEditingPending] = useState<PendingItem | null>(null);

  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [logRes, pendRes] = await Promise.all([
          supabase.from('work_logs').select('*'),
          supabase.from('monthly_pending').select('*'),
        ]);
        setLogs((logRes.data || []).map((r: any) => r.data));
        setPending((pendRes.data || []).map((r: any) => r.data));
      } catch {}
      setLoaded(true);
    })();
  }, []);

  useEffect(() => {
    if (!loaded) return;
    try { supabase.from('work_logs').upsert(logs.map(d => ({ id: d.id, data: d })), { onConflict: 'id' }).then(() => {}); } catch {}
  }, [logs, loaded]);

  useEffect(() => {
    if (!loaded) return;
    try { supabase.from('monthly_pending').upsert(pending.map(d => ({ id: d.id, data: d })), { onConflict: 'id' }).then(() => {}); } catch {}
  }, [pending, loaded]);

  // --- Derived ---
  const dayLogs = logs.filter(l => l.date === logDate);
  const monthPending = pending.filter(p => p.month === pMonth);
  const doing = monthPending.filter(p => p.status === 'doing');
  const waiting = monthPending.filter(p => p.status === 'pending');
  const done = monthPending.filter(p => p.status === 'done');
  const notDone = [...doing, ...waiting];

  // Handlers
  const saveLog = (d: WorkLog) => {
    setLogs(prev => prev.find(l => l.id === d.id) ? prev.map(l => l.id === d.id ? d : l) : [...prev, d]);
    setLogModal(false); setEditingLog(null);
  };
  const delLog = (id: string) => setLogs(prev => prev.filter(l => l.id !== id));

  const savePending = (d: PendingItem) => {
    setPending(prev => prev.find(p => p.id === d.id) ? prev.map(p => p.id === d.id ? d : p) : [...prev, d]);
    setPendingModal(false); setEditingPending(null);
  };
  const delPending = (id: string) => setPending(prev => prev.filter(p => p.id !== id));

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      <div className="p-4 md:p-6 space-y-4 max-w-2xl mx-auto">

        {/* Header */}
        <h1 className="text-xl font-bold text-gray-800">工作管理</h1>

        {/* Tabs */}
        <div className="flex bg-gray-100 rounded-xl p-1 gap-1">
          <button onClick={() => setTab('log')}
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${
              tab === 'log' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500'
            }`}>工作日志</button>
          <button onClick={() => setTab('pending')}
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all relative ${
              tab === 'pending' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500'
            }`}>
            当月待办
            {notDone.length > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">{notDone.length}</span>
            )}
          </button>
        </div>

        {/* ===================== WORK LOG ===================== */}
        {tab === 'log' && (
          <>
            {/* Date bar */}
            <div className="flex items-center justify-between bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-3">
              <button onClick={() => setLogDate(addDay(logDate, -1))} className="p-1.5 rounded-lg hover:bg-gray-100">
                <ChevronLeft size={18} className="text-gray-400" />
              </button>
              <div className="text-center">
                <p className="text-base font-bold text-gray-800">{fmt(logDate)}</p>
                <p className="text-[11px] text-gray-400">{dayLogs.length} 条记录</p>
              </div>
              <button onClick={() => setLogDate(addDay(logDate, 1))} className="p-1.5 rounded-lg hover:bg-gray-100">
                <ChevronRight size={18} className="text-gray-400" />
              </button>
            </div>

            {/* Timeline */}
            {dayLogs.length === 0 ? (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm py-14 text-center">
                <Clock size={28} className="text-gray-300 mx-auto mb-3" />
                <p className="text-sm text-gray-400">今天还没有工作记录</p>
                <p className="text-xs text-gray-300 mt-1">记录每日工作，方便日后回顾和汇报</p>
              </div>
            ) : (
              <div className="relative pl-7 before:absolute before:left-[15px] before:top-2 before:bottom-2 before:w-px before:bg-gray-200 space-y-4">
                {dayLogs.map((log) => {
                  const cfg = catCfg[log.category] || catCfg['其他'];
                  return (
                    <div key={log.id} className="relative group">
                      {/* Dot on timeline */}
                      <div className={`absolute left-[-22px] top-2.5 w-2.5 h-2.5 rounded-full ring-2 ring-white ${cfg.dot}`} />

                      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 hover:shadow-md transition-shadow">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-2">
                              <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-md font-medium ${cfg.bg} ${cfg.color}`}>
                                <cfg.icon size={11} />{log.category}
                              </span>
                            </div>
                            <p className="text-sm text-gray-800 leading-relaxed">{log.content}</p>
                            {log.result && (
                              <div className="mt-2.5 flex items-start gap-2 p-2.5 bg-emerald-50/50 rounded-xl">
                                <CheckCircle2 size={13} className="text-emerald-500 flex-shrink-0 mt-px" />
                                <p className="text-xs text-gray-700">{log.result}</p>
                              </div>
                            )}
                          </div>

                          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                            <button onClick={() => { setEditingLog(log); setLogModal(true); }} className="p-1 text-gray-300 hover:text-blue-500 rounded"><Edit3 size={12} /></button>
                            <button onClick={() => delLog(log.id)} className="p-1 text-gray-300 hover:text-red-500 rounded"><Trash2 size={12} /></button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Add button */}
            <button onClick={() => { setEditingLog(null); setLogModal(true); }}
              className="w-full py-3 border-2 border-dashed border-gray-200 rounded-2xl text-sm text-gray-400 hover:border-starbucks-300 hover:text-starbucks-500 transition-colors flex items-center justify-center gap-1.5">
              <Plus size={16} />写工作记录
            </button>
          </>
        )}

        {/* ===================== PENDING ===================== */}
        {tab === 'pending' && (
          <>
            {/* Month selector */}
            <div className="flex items-center justify-between bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-3">
              <button onClick={() => setPMonth(ALL_MONTHS[Math.max(0, ALL_MONTHS.indexOf(pMonth) - 1)] || pMonth)} className="p-1.5 rounded-lg hover:bg-gray-100">
                <ChevronLeft size={18} className="text-gray-400" />
              </button>
              <div className="text-center">
                <p className="text-base font-bold text-gray-800">{ml(pMonth)}</p>
                <p className="text-[11px] text-gray-400">
                  {monthPending.length === 0 ? '暂无事项' : `共 ${monthPending.length} 项 · ${notDone.length} 项待完成`}
                </p>
              </div>
              <button onClick={() => setPMonth(ALL_MONTHS[Math.min(11, ALL_MONTHS.indexOf(pMonth) + 1)] || pMonth)} className="p-1.5 rounded-lg hover:bg-gray-100">
                <ChevronRight size={18} className="text-gray-400" />
              </button>
            </div>

            {/* Summary mini-cards */}
            {monthPending.length > 0 && (
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-3 text-center">
                  <p className="text-xl font-bold text-blue-600">{doing.length}</p>
                  <p className="text-[10px] text-gray-400">执行中</p>
                </div>
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-3 text-center">
                  <p className="text-xl font-bold text-amber-600">{waiting.length}</p>
                  <p className="text-[10px] text-gray-400">待开始</p>
                </div>
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-3 text-center">
                  <p className="text-xl font-bold text-emerald-600">{done.length}</p>
                  <p className="text-[10px] text-gray-400">已完成</p>
                </div>
              </div>
            )}

            {/* Empty */}
            {monthPending.length === 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm py-14 text-center">
                <Target size={28} className="text-gray-300 mx-auto mb-3" />
                <p className="text-sm text-gray-400">本月暂无待办事项</p>
                <p className="text-xs text-gray-300 mt-1">添加需要当月跟进的重要事项</p>
              </div>
            )}

            {/* Doing + Pending list */}
            {notDone.map((p) => {
              const pc = priCfg[p.priority];
              return (
                <div key={p.id}
                  className={`bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden group border-l-4 ${pc.border}`}>
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1.5">
                          <h4 className="text-sm font-bold text-gray-800">{p.title}</h4>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${pc.bg}`}>{pc.label}</span>
                          {p.status === 'doing' && <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-blue-50 text-blue-600">执行中</span>}
                          {p.deadline && <span className="text-[10px] text-gray-400 flex items-center gap-1"><Calendar size={10} />{p.deadline}</span>}
                        </div>
                        {p.detail && <p className="text-xs text-gray-500 leading-relaxed">{p.detail}</p>}

                        <div className="mt-3 flex items-center gap-2">
                          <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full transition-all ${pc.bar}`} style={{ width: `${p.progress}%` }} />
                          </div>
                          <span className="text-[10px] font-bold text-gray-400 w-8 text-right">{p.progress}%</span>
                        </div>

                        {p.result && (
                          <p className="mt-2.5 text-xs text-emerald-600 bg-emerald-50/50 rounded-lg px-2.5 py-1.5">
                            <CheckCircle2 size={11} className="inline mr-1" />{p.result}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => { setEditingPending(p); setPendingModal(true); }} className="p-1 text-gray-300 hover:text-blue-500 rounded"><Edit3 size={12} /></button>
                        <button onClick={() => delPending(p.id)} className="p-1 text-gray-300 hover:text-red-500 rounded"><Trash2 size={12} /></button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Done section (collapsed) */}
            {done.length > 0 && (
              <details className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <summary className="px-5 py-3 cursor-pointer text-xs text-gray-400 select-none hover:text-gray-500">
                  已完成 ({done.length})
                </summary>
                <div className="divide-y divide-gray-50 border-t border-gray-50">
                  {done.map(p => (
                    <div key={p.id} className="p-3 px-5 flex items-center justify-between opacity-50">
                      <span className="text-xs text-gray-500 line-through">{p.title}</span>
                      <div className="flex items-center gap-1 opacity-0 hover:opacity-100">
                        <button onClick={() => delPending(p.id)} className="p-1 text-gray-300 hover:text-red-500 rounded"><Trash2 size={12} /></button>
                      </div>
                    </div>
                  ))}
                </div>
              </details>
            )}

            {/* Add button */}
            <button onClick={() => { setEditingPending(null); setPendingModal(true); }}
              className="w-full py-3 border-2 border-dashed border-gray-200 rounded-2xl text-sm text-gray-400 hover:border-starbucks-300 hover:text-starbucks-500 transition-colors flex items-center justify-center gap-1.5">
              <Plus size={16} />添加待办事项
            </button>
          </>
        )}

        {/* ===================== MODALS ===================== */}
        {logModal && (
          <div className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh] p-4">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => { setLogModal(false); setEditingLog(null); }} />
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100 bg-gray-50/50">
                <h3 className="text-sm font-semibold text-gray-800">{editingLog ? '编辑记录' : '写工作记录'}</h3>
                <button onClick={() => { setLogModal(false); setEditingLog(null); }} className="p-1.5 rounded-full hover:bg-gray-200"><X size={16} className="text-gray-400" /></button>
              </div>
              <LogForm init={editingLog} date={logDate} onSave={saveLog} onCancel={() => { setLogModal(false); setEditingLog(null); }} />
            </div>
          </div>
        )}

        {pendingModal && (
          <div className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh] p-4">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => { setPendingModal(false); setEditingPending(null); }} />
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100 bg-gray-50/50">
                <h3 className="text-sm font-semibold text-gray-800">{editingPending ? '编辑待办' : '添加待办事项'}</h3>
                <button onClick={() => { setPendingModal(false); setEditingPending(null); }} className="p-1.5 rounded-full hover:bg-gray-200"><X size={16} className="text-gray-400" /></button>
              </div>
              <PendingForm init={editingPending} month={pMonth} onSave={savePending} onCancel={() => { setPendingModal(false); setEditingPending(null); }} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ---- Work Log Form ----
function LogForm({ init, date, onSave, onCancel }: { init: WorkLog | null; date: string; onSave: (d: WorkLog) => void; onCancel: () => void }) {
  const [f, setF] = useState(init || { id: genId('WL'), date, content: '', category: '经销商拜访', result: '' });
  const cls = "w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-gray-50 focus:outline-none focus:bg-white focus:border-gray-400 transition-all";
  const lbl = "text-[11px] text-gray-400 mb-1 block font-medium";
  return (
    <div className="p-5 space-y-4">
      <div>
        <label className={lbl}>工作内容 *</label>
        <textarea value={f.content} onChange={e => setF({ ...f, content: e.target.value })}
          placeholder="今天做了什么工作？" rows={3} className={cls} autoFocus />
      </div>
      <div>
        <label className={lbl}>分类</label>
        <div className="flex flex-wrap gap-1.5">
          {logCategories.map(c => {
            const cfg = catCfg[c] || catCfg['其他'];
            return (
              <button key={c} type="button" onClick={() => setF({ ...f, category: c })}
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-all ${
                  f.category === c ? `${cfg.bg} ${cfg.color} ring-1 ring-inset ring-gray-200` : 'bg-gray-50 text-gray-400 hover:bg-gray-100'
                }`}>
                <cfg.icon size={11} />{c}
              </button>
            );
          })}
        </div>
      </div>
      <div>
        <label className={lbl}>成果/产出</label>
        <input value={f.result} onChange={e => setF({ ...f, result: e.target.value })}
          placeholder="量化成果，如：拜访3家经销商，签约1家" className={cls} />
      </div>
      <div className="flex justify-end gap-3 pt-2">
        <button onClick={onCancel} className="px-5 py-2.5 text-sm text-gray-500 hover:bg-gray-50 rounded-xl transition-colors">取消</button>
        <button onClick={() => { if (f.content) onSave(f); }} className="px-6 py-2.5 bg-starbucks-500 text-white rounded-xl text-sm font-medium hover:bg-starbucks-600 shadow-sm transition-colors">保存</button>
      </div>
    </div>
  );
}

// ---- Pending Form ----
function PendingForm({ init, month, onSave, onCancel }: { init: PendingItem | null; month: string; onSave: (d: PendingItem) => void; onCancel: () => void }) {
  const [f, setF] = useState(init || { id: genId('MP'), month, title: '', detail: '', priority: 'medium' as const, progress: 0, status: 'pending' as const, deadline: '', result: '' });
  const cls = "w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-gray-50 focus:outline-none focus:bg-white focus:border-gray-400 transition-all";
  const lbl = "text-[11px] text-gray-400 mb-1 block font-medium";
  return (
    <div className="p-5 space-y-4">
      <div><label className={lbl}>事项标题 *</label><input value={f.title} onChange={e => setF({ ...f, title: e.target.value })} placeholder="如：完成唐山区域铺货" className={cls} autoFocus /></div>
      <div><label className={lbl}>详细描述</label><textarea value={f.detail} onChange={e => setF({ ...f, detail: e.target.value })} placeholder="具体要做什么..." rows={2} className={cls} /></div>
      <div className="grid grid-cols-2 gap-4">
        <div><label className={lbl}>优先级</label>
          <select value={f.priority} onChange={e => setF({ ...f, priority: e.target.value as 'high' | 'medium' | 'low' })} className={cls}>
            <option value="high">高优先</option><option value="medium">中优先</option><option value="low">低优先</option>
          </select>
        </div>
        <div><label className={lbl}>截止日期</label><input type="date" value={f.deadline} onChange={e => setF({ ...f, deadline: e.target.value })} className={cls} /></div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div><label className={lbl}>状态</label>
          <select value={f.status} onChange={e => setF({ ...f, status: e.target.value as PendingItem['status'] })} className={cls}>
            <option value="pending">待开始</option><option value="doing">执行中</option><option value="done">已完成</option>
          </select>
        </div>
        <div><label className={lbl}>进度 (%)</label><input type="number" min="0" max="100" value={f.progress} onChange={e => setF({ ...f, progress: parseInt(e.target.value) || 0 })} className={cls} /></div>
      </div>
      <div><label className={lbl}>成果/产出</label><input value={f.result} onChange={e => setF({ ...f, result: e.target.value })} placeholder="量化成果" className={cls} /></div>
      <div className="flex justify-end gap-3 pt-2">
        <button onClick={onCancel} className="px-5 py-2.5 text-sm text-gray-500 hover:bg-gray-50 rounded-xl transition-colors">取消</button>
        <button onClick={() => { if (f.title) onSave(f); }} className="px-6 py-2.5 bg-starbucks-500 text-white rounded-xl text-sm font-medium hover:bg-starbucks-600 shadow-sm transition-colors">保存</button>
      </div>
    </div>
  );
}
