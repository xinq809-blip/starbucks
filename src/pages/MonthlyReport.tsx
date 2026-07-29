import { useState, useEffect } from 'react';
import { Plus, X, Edit3, Trash2, ChevronLeft, ChevronRight, Target, Flag, Clock, AlertTriangle, Calendar } from 'lucide-react';
import { supabase } from '../lib/supabase';

function genId(p: string) { return p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
function today(): string { return new Date().toISOString().slice(0, 10); }
function ml(m: string) { return m.replace('-', '年') + '月'; }

interface WorkLog {
  id: string; date: string; content: string; category: string; result: string;
}
interface PendingItem {
  id: string; month: string; title: string; detail: string; priority: 'high' | 'medium' | 'low';
  progress: number; status: 'pending' | 'doing' | 'done'; deadline: string; result: string;
}

function fmt(d: string) {
  const dt = new Date(d + 'T00:00:00');
  return `${dt.getMonth() + 1}月${dt.getDate()}日 周${['日','一','二','三','四','五','六'][dt.getDay()]}`;
}
function addDay(d: string, n: number): string {
  const dt = new Date(d + 'T12:00:00'); dt.setDate(dt.getDate() + n); return dt.toISOString().slice(0, 10);
}

const ALL_MONTHS = Array.from({length: 12}, (_,i) => `2026-${String(i+1).padStart(2,'0')}`);

const priorityCfg: Record<string, { label: string; bg: string; bar: string }> = {
  high  : { label: '高', bg: 'bg-red-50 text-red-600', bar: 'bg-red-500' },
  medium: { label: '中', bg: 'bg-amber-50 text-amber-600', bar: 'bg-amber-500' },
  low   : { label: '低', bg: 'bg-gray-100 text-gray-500', bar: 'bg-gray-400' },
};

const logCategories = ['经销商拜访', '新品推广', '库存盘点', '费用核销', '冰箱巡检', '商超对接', '台球厅开发', '数据汇报', '其他'];

export default function DailyPlanPage() {
  const [tab, setTab] = useState<'log' | 'pending'>('log');

  // --- Work Log state ---
  const [logDate, setLogDate] = useState(today());
  const [logs, setLogs] = useState<WorkLog[]>([]);
  const [logModal, setLogModal] = useState(false);
  const [editingLog, setEditingLog] = useState<WorkLog | null>(null);

  // --- Pending state ---
  const [pMonth, setPMonth] = useState(ALL_MONTHS[new Date().getMonth()] || '2026-07');
  const [pending, setPending] = useState<PendingItem[]>([]);
  const [pendingModal, setPendingModal] = useState(false);
  const [editingPending, setEditingPending] = useState<PendingItem | null>(null);

  const [loaded, setLoaded] = useState(false);

  // Load from Supabase
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

  // Save work logs
  useEffect(() => {
    if (!loaded) return;
    try { supabase.from('work_logs').upsert(logs.map(d => ({ id: d.id, data: d })), { onConflict: 'id' }).then(() => {}); } catch {}
  }, [logs, loaded]);

  // Save pending
  useEffect(() => {
    if (!loaded) return;
    try { supabase.from('monthly_pending').upsert(pending.map(d => ({ id: d.id, data: d })), { onConflict: 'id' }).then(() => {}); } catch {}
  }, [pending, loaded]);

  // --- Work Log handlers ---
  const dayLogs = logs.filter(l => l.date === logDate);
  const saveLog = (d: WorkLog) => {
    setLogs(prev => prev.find(l => l.id === d.id) ? prev.map(l => l.id === d.id ? d : l) : [...prev, d]);
    setLogModal(false); setEditingLog(null);
  };
  const delLog = (id: string) => setLogs(prev => prev.filter(l => l.id !== id));

  // --- Pending handlers ---
  const monthPending = pending.filter(p => p.month === pMonth);
  const sortedPending = [...monthPending].sort((a, b) => {
    if (a.status === 'doing' && b.status !== 'doing') return -1;
    if (a.status !== 'doing' && b.status === 'doing') return 1;
    const o = { high: 0, medium: 1, low: 2 };
    return o[a.priority] - o[b.priority];
  });
  const pendingNotDone = monthPending.filter(p => p.status !== 'done');
  const savePending = (d: PendingItem) => {
    setPending(prev => prev.find(p => p.id === d.id) ? prev.map(p => p.id === d.id ? d : p) : [...prev, d]);
    setPendingModal(false); setEditingPending(null);
  };
  const delPending = (id: string) => setPending(prev => prev.filter(p => p.id !== id));

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      <div className="p-4 md:p-6 space-y-5 max-w-3xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">工作管理</h1>
            <p className="text-sm text-gray-400 mt-0.5">当日记录 · 待办跟进 · 向领导汇报</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex bg-gray-100 rounded-xl p-1 gap-1">
          <button onClick={() => setTab('log')}
            className={`flex-1 py-2.5 text-sm font-medium rounded-lg transition-all ${
              tab === 'log' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}>
            工作日志
          </button>
          <button onClick={() => setTab('pending')}
            className={`flex-1 py-2.5 text-sm font-medium rounded-lg transition-all ${
              tab === 'pending' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}>
            当月待办
            {pendingNotDone.length > 0 && (
              <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-red-500 text-white text-[10px] font-bold">{pendingNotDone.length}</span>
            )}
          </button>
        </div>

        {/* ==================== WORK LOG TAB ==================== */}
        {tab === 'log' && (
          <>
            {/* Date Navigator */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <div className="flex items-center justify-between">
                <button onClick={() => setLogDate(addDay(logDate, -1))} className="p-2 rounded-xl hover:bg-gray-100 transition-colors">
                  <ChevronLeft size={18} className="text-gray-400" />
                </button>
                <div className="text-center">
                  <p className="text-lg font-bold text-gray-800">{fmt(logDate)}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {dayLogs.length > 0 ? `${dayLogs.length} 条工作记录` : '工作日志'}
                  </p>
                </div>
                <button onClick={() => setLogDate(addDay(logDate, 1))} className="p-2 rounded-xl hover:bg-gray-100 transition-colors">
                  <ChevronRight size={18} className="text-gray-400" />
                </button>
              </div>
              {logDate !== today() && (
                <div className="text-center mt-2">
                  <button onClick={() => setLogDate(today())} className="text-xs text-starbucks-500 font-medium">回到今天</button>
                </div>
              )}
            </div>

            {/* Log List */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-5 py-3.5 border-b border-gray-50 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Clock size={15} className="text-starbucks-500" />
                  <h3 className="text-sm font-bold text-gray-700">当日工作记录</h3>
                  {dayLogs.length > 0 && <span className="text-[11px] text-gray-400">{dayLogs.length} 条</span>}
                </div>
                <button onClick={() => { setEditingLog(null); setLogModal(true); }}
                  className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium bg-starbucks-500 text-white rounded-lg hover:bg-starbucks-600 transition-colors">
                  <Plus size={14} />写记录
                </button>
              </div>

              {dayLogs.length === 0 ? (
                <div className="py-14 text-center">
                  <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-gray-100 flex items-center justify-center">
                    <Flag size={24} className="text-gray-300" />
                  </div>
                  <p className="text-sm text-gray-400">今天还没有工作记录</p>
                  <p className="text-xs text-gray-300 mt-1">点击「写记录」记录今日工作内容</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-50">
                  {dayLogs.map((log) => (
                    <div key={log.id} className="p-4 md:px-5 hover:bg-gray-50/30 transition-colors group">
                      <div className="flex items-start gap-3">
                        <div className="w-2 h-2 rounded-full bg-starbucks-400 mt-2 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="text-sm font-medium text-gray-800 leading-relaxed">{log.content}</p>
                              <span className="inline-block mt-1.5 text-[10px] px-2 py-0.5 rounded bg-gray-100 text-gray-500 font-medium">
                                {log.category}
                              </span>
                            </div>
                            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={() => { setEditingLog(log); setLogModal(true); }} className="p-1.5 text-gray-300 hover:text-blue-500 hover:bg-blue-50 rounded-lg"><Edit3 size={13} /></button>
                              <button onClick={() => delLog(log.id)} className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg"><Trash2 size={13} /></button>
                            </div>
                          </div>
                          {log.result && (
                            <div className="mt-2.5 p-2.5 bg-emerald-50/50 rounded-lg border border-emerald-100/50">
                              <p className="text-xs text-gray-700"><span className="font-semibold text-emerald-600">成果：</span>{log.result}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {/* ==================== PENDING TAB ==================== */}
        {tab === 'pending' && (
          <>
            {/* Month selector */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <div className="flex items-center justify-between">
                <button onClick={() => setPMonth(ALL_MONTHS[Math.max(0, ALL_MONTHS.indexOf(pMonth) - 1)] || pMonth)} className="p-2 rounded-xl hover:bg-gray-100 transition-colors">
                  <ChevronLeft size={18} className="text-gray-400" />
                </button>
                <div className="text-center">
                  <p className="text-lg font-bold text-gray-800">{ml(pMonth)}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {pendingNotDone.length > 0
                      ? <span className="text-red-500 font-medium">{pendingNotDone.length} 项待完成</span>
                      : monthPending.length > 0 ? '全部完成' : '待办事项'}
                  </p>
                </div>
                <button onClick={() => setPMonth(ALL_MONTHS[Math.min(11, ALL_MONTHS.indexOf(pMonth) + 1)] || pMonth)} className="p-2 rounded-xl hover:bg-gray-100 transition-colors">
                  <ChevronRight size={18} className="text-gray-400" />
                </button>
              </div>
            </div>

            {/* Pending List */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-5 py-3.5 border-b border-gray-50 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Target size={15} className="text-starbucks-500" />
                  <h3 className="text-sm font-bold text-gray-700">当月待办事项</h3>
                  {monthPending.length > 0 && <span className="text-[11px] text-gray-400">{monthPending.length} 项</span>}
                </div>
                <button onClick={() => { setEditingPending(null); setPendingModal(true); }}
                  className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium bg-starbucks-500 text-white rounded-lg hover:bg-starbucks-600 transition-colors">
                  <Plus size={14} />添加待办
                </button>
              </div>

              {monthPending.length === 0 ? (
                <div className="py-14 text-center">
                  <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-gray-100 flex items-center justify-center">
                    <Target size={24} className="text-gray-300" />
                  </div>
                  <p className="text-sm text-gray-400">本月暂无待办事项</p>
                  <p className="text-xs text-gray-300 mt-1">点击「添加待办」记录需要跟进的事项</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-50">
                  {sortedPending.map((p) => {
                    const cfg = priorityCfg[p.priority];
                    const isDoing = p.status === 'doing';
                    return (
                      <div key={p.id} className="p-4 md:px-5 hover:bg-gray-50/30 transition-colors group">
                        <div className="flex items-start gap-3">
                          {/* Status indicator */}
                          <div className={`w-2.5 h-2.5 rounded-full mt-1.5 flex-shrink-0 ${isDoing ? 'bg-blue-500 animate-pulse' : 'bg-gray-300'}`} />

                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h4 className="text-sm font-bold text-gray-800">{p.title}</h4>
                                <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${cfg.bg}`}>{cfg.label}优先</span>
                                {isDoing && <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-blue-50 text-blue-600">执行中</span>}
                                {p.deadline && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-gray-100 text-gray-500 flex items-center gap-1">
                                    <Calendar size={10} />{p.deadline}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={() => { setEditingPending(p); setPendingModal(true); }} className="p-1.5 text-gray-300 hover:text-blue-500 hover:bg-blue-50 rounded-lg"><Edit3 size={13} /></button>
                                <button onClick={() => delPending(p.id)} className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg"><Trash2 size={13} /></button>
                              </div>
                            </div>

                            {p.detail && <p className="text-xs text-gray-500 mt-1 leading-relaxed">{p.detail}</p>}

                            {/* Progress */}
                            <div className="mt-3 flex items-center gap-2">
                              <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                                <div className={`h-full rounded-full transition-all ${p.progress >= 100 ? 'bg-emerald-500' : cfg.bar}`}
                                  style={{ width: `${p.progress}%` }} />
                              </div>
                              <span className="text-[10px] font-bold text-gray-400 w-8 text-right tabular-nums">{p.progress}%</span>
                            </div>

                            {p.result && (
                              <div className="mt-2.5 p-2.5 bg-emerald-50/50 rounded-lg border border-emerald-100/50">
                                <p className="text-xs text-gray-700"><span className="font-semibold text-emerald-600">成果：</span>{p.result}</p>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Summary for leadership */}
            {monthPending.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-5 py-3.5 border-b border-gray-50 flex items-center gap-2.5">
                  <AlertTriangle size={15} className="text-amber-500" />
                  <h3 className="text-sm font-bold text-gray-700">汇报摘要</h3>
                  <span className="text-[11px] text-gray-400">适合截图发给领导</span>
                </div>
                <div className="p-5 space-y-4">
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div>
                      <p className="text-2xl font-bold text-gray-800">{monthPending.length}</p>
                      <p className="text-[11px] text-gray-400">总事项</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-blue-600">{monthPending.filter(p => p.status === 'doing').length}</p>
                      <p className="text-[11px] text-gray-400">执行中</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-red-500">{pendingNotDone.length}</p>
                      <p className="text-[11px] text-gray-400">待完成</p>
                    </div>
                  </div>

                  {/* Group by status */}
                  <div className="space-y-2">
                    <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">待完成事项清单</p>
                    {pendingNotDone.length === 0 ? (
                      <p className="text-xs text-emerald-600 font-medium">本月事项已全部完成</p>
                    ) : (
                      pendingNotDone.sort((a, b) => {
                        const o = { high: 1, medium: 2, low: 3 };
                        return (o[a.priority] || 2) - (o[b.priority] || 2);
                      }).map((p, idx) => {
                        const cfg = priorityCfg[p.priority];
                        return (
                          <div key={p.id} className="flex items-center gap-3 p-2.5 bg-gray-50 rounded-xl">
                            <span className="w-5 h-5 rounded-full bg-gray-200 flex items-center justify-center text-[10px] font-bold text-gray-500 flex-shrink-0">{idx + 1}</span>
                            <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${cfg.bar}`} />
                            <span className="text-xs text-gray-700 flex-1 truncate">{p.title}</span>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${cfg.bg} flex-shrink-0`}>{cfg.label}</span>
                          </div>
                        );
                      })
                    )}
                  </div>

                  <p className="text-[11px] text-gray-300 text-center">{ml(pMonth)} · 星巴克即饮咖啡事业部 · 工作汇报</p>
                </div>
              </div>
            )}
          </>
        )}

        {/* ==================== MODALS ==================== */}
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

// --- Work Log Form ---
function LogForm({ init, date, onSave, onCancel }: { init: WorkLog | null; date: string; onSave: (d: WorkLog) => void; onCancel: () => void }) {
  const [f, setF] = useState(init || { id: genId('WL'), date, content: '', category: '经销商拜访', result: '' });
  const cls = "w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-gray-50 focus:outline-none focus:bg-white focus:border-gray-400 transition-all";
  const lbl = "text-[11px] text-gray-400 mb-1 block font-medium";
  return (
    <div className="p-5 space-y-4">
      <div>
        <label className={lbl}>工作内容 *</label>
        <textarea value={f.content} onChange={e => setF({ ...f, content: e.target.value })} placeholder="今天做了什么工作？" rows={3} className={cls} autoFocus />
      </div>
      <div>
        <label className={lbl}>分类</label>
        <select value={f.category} onChange={e => setF({ ...f, category: e.target.value })} className={cls}>
          {logCategories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
      <div>
        <label className={lbl}>成果/产出</label>
        <input value={f.result} onChange={e => setF({ ...f, result: e.target.value })} placeholder="量化成果，如：拜访3家经销商，签约1家" className={cls} />
      </div>
      <div className="flex justify-end gap-3 pt-2">
        <button onClick={onCancel} className="px-5 py-2.5 text-sm text-gray-500 hover:bg-gray-50 rounded-xl transition-colors">取消</button>
        <button onClick={() => { if (f.content) onSave(f); }} className="px-6 py-2.5 bg-starbucks-500 text-white rounded-xl text-sm font-medium hover:bg-starbucks-600 shadow-sm transition-colors">保存</button>
      </div>
    </div>
  );
}

// --- Pending Form ---
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
          <select value={f.status} onChange={e => setF({ ...f, status: e.target.value as 'pending' | 'doing' })} className={cls}>
            <option value="pending">待开始</option><option value="doing">执行中</option>
          </select>
        </div>
        <div><label className={lbl}>进度 (%)</label><input type="number" min="0" max="100" value={f.progress} onChange={e => setF({ ...f, progress: parseInt(e.target.value) || 0 })} className={cls} /></div>
      </div>
      <div><label className={lbl}>成果/产出</label><input value={f.result} onChange={e => setF({ ...f, result: e.target.value })} placeholder="量化成果，如：新增3家网点" className={cls} /></div>
      <div className="flex justify-end gap-3 pt-2">
        <button onClick={onCancel} className="px-5 py-2.5 text-sm text-gray-500 hover:bg-gray-50 rounded-xl transition-colors">取消</button>
        <button onClick={() => { if (f.title) onSave(f); }} className="px-6 py-2.5 bg-starbucks-500 text-white rounded-xl text-sm font-medium hover:bg-starbucks-600 shadow-sm transition-colors">保存</button>
      </div>
    </div>
  );
}
