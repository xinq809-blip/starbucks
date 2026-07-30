import { useState, useEffect, useMemo } from 'react';
import { Plus, X, Edit3, Trash2, ChevronLeft, ChevronRight, Target, Clock, Calendar, CheckCircle2, UserCheck, Store, Truck, Package, FileText, Wrench, MoreHorizontal, TrendingUp, AlertCircle, BarChart3, Zap, Flag } from 'lucide-react';
import { supabase } from '../lib/supabase';

function genId(p: string) { return p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
function today(): string { return new Date().toISOString().slice(0, 10); }
function ml(m: string) { return m.replace('-', '年') + '月'; }
function fmt(d: string) {
  const dt = new Date(d + 'T00:00:00');
  return `${dt.getMonth() + 1}月${dt.getDate()}日 周${['日','一','二','三','四','五','六'][dt.getDay()]}`;
}
function addDay(d: string, n: number): string {
  const dt = new Date(d + 'T12:00:00'); dt.setDate(dt.getDate() + n); return dt.toISOString().slice(0, 10);
}
function weekStart(d: string): string {
  const dt = new Date(d + 'T12:00:00');
  const day = dt.getDay();
  dt.setDate(dt.getDate() + (day === 0 ? -6 : 1 - day));
  return dt.toISOString().slice(0, 10);
}
function weekDays(start: string): string[] {
  const days: string[] = [];
  for (let i = 0; i < 7; i++) days.push(addDay(start, i));
  return days;
}
const dayLabels = ['一', '二', '三', '四', '五', '六', '日'];

interface WorkLog { id: string; date: string; content: string; category: string; result: string; }
interface PendingItem { id: string; month: string; title: string; detail: string; priority: 'high' | 'medium' | 'low'; progress: number; status: 'pending' | 'doing' | 'done'; deadline: string; result: string; }

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
  high:   { label: '高', bg: 'bg-red-50 text-red-600', bar: 'bg-red-500', border: 'border-l-red-500' },
  medium: { label: '中', bg: 'bg-amber-50 text-amber-600', bar: 'bg-amber-500', border: 'border-l-amber-500' },
  low:    { label: '低', bg: 'bg-gray-100 text-gray-500', bar: 'bg-gray-400', border: 'border-l-gray-300' },
};

export default function DailyPlanPage() {
  const [tab, setTab] = useState<'log' | 'pending'>('log');
  const [logDate, setLogDate] = useState(today());
  const [logs, setLogs] = useState<WorkLog[]>([]);
  const [logModal, setLogModal] = useState(false);
  const [editingLog, setEditingLog] = useState<WorkLog | null>(null);
  const [catFilter, setCatFilter] = useState<string | null>(null);

  const [pMonth, setPMonth] = useState(ALL_MONTHS[new Date().getMonth()] || '2026-07');
  const [pending, setPending] = useState<PendingItem[]>([]);
  const [pendingModal, setPendingModal] = useState(false);
  const [editingPending, setEditingPending] = useState<PendingItem | null>(null);

  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const local = localStorage.getItem('daily_work_logs');
      if (local) setLogs(JSON.parse(local));
      const localP = localStorage.getItem('daily_pending');
      if (localP) setPending(JSON.parse(localP));
    } catch {}
    (async () => {
      try {
        const [logRes, pendRes] = await Promise.all([
          supabase.from('work_logs').select('*'), supabase.from('monthly_pending').select('*'),
        ]);
        if (logRes.data?.length) setLogs(logRes.data.map((r: any) => r.data));
        if (pendRes.data?.length) setPending(pendRes.data.map((r: any) => r.data));
      } catch {}
      setLoaded(true);
    })();
  }, []);

  useEffect(() => {
    if (!loaded) return;
    localStorage.setItem('daily_work_logs', JSON.stringify(logs));
    try { supabase.from('work_logs').upsert(logs.map(d => ({ id: d.id, data: d })), { onConflict: 'id' }).then(() => {}); } catch {}
  }, [logs, loaded]);

  useEffect(() => {
    if (!loaded) return;
    localStorage.setItem('daily_pending', JSON.stringify(pending));
    try { supabase.from('monthly_pending').upsert(pending.map(d => ({ id: d.id, data: d })), { onConflict: 'id' }).then(() => {}); } catch {}
  }, [pending, loaded]);

  const ws = weekStart(logDate);
  const wkDays = weekDays(ws);
  const dayLogs = logs.filter(l => l.date === logDate);
  const weekLogs = logs.filter(l => l.date >= ws && l.date <= addDay(ws, 6));
  const currentMonth = logDate.slice(0, 7);
  const monthLogCount = logs.filter(l => l.date.startsWith(currentMonth)).length;

  const monthPending = pending.filter(p => p.month === pMonth);
  const doing = monthPending.filter(p => p.status === 'doing');
  const waiting = monthPending.filter(p => p.status === 'pending');
  const doneP = monthPending.filter(p => p.status === 'done');
  const notDone = [...doing, ...waiting];

  const weekCatStats = useMemo(() => {
    const map: Record<string, number> = {};
    weekLogs.forEach(l => { map[l.category] = (map[l.category] || 0) + 1; });
    return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 6);
  }, [weekLogs]);

  const urgentPending = notDone.filter(p => {
    if (!p.deadline) return p.priority === 'high';
    return p.deadline <= addDay(today(), 7) && p.deadline >= today();
  });

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

  const filteredDayLogs = catFilter ? dayLogs.filter(l => l.category === catFilter) : dayLogs;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50">
      <div className="p-4 md:p-6 lg:p-8 space-y-5">

        {/* ====== TOP BAR ====== */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-800 tracking-tight">工作管理</h1>
            <p className="text-sm text-gray-400 mt-0.5">每日记录 · 待办跟进 · 成果汇报</p>
          </div>
          <div className="flex bg-gray-100 rounded-xl p-1 gap-1 self-start">
            <button onClick={() => setTab('log')}
              className={`px-5 py-2 text-sm font-medium rounded-lg transition-all ${
                tab === 'log' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500'}`}>工作日志</button>
            <button onClick={() => setTab('pending')}
              className={`px-5 py-2 text-sm font-medium rounded-lg transition-all relative ${
                tab === 'pending' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500'}`}>
              当月待办
              {notDone.length > 0 && (
                <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">{notDone.length}</span>
              )}
            </button>
          </div>
        </div>

        {/* ====== STAT CARDS ROW ====== */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: '今日工作记录', value: dayLogs.length, unit: '条', icon: Clock, color: 'text-starbucks-600', bg: 'bg-starbucks-50', iconBg: 'bg-starbucks-100' },
            { label: '本周累计记录', value: weekLogs.length, unit: '条', icon: TrendingUp, color: 'text-blue-600', bg: 'bg-blue-50', iconBg: 'bg-blue-100' },
            { label: '当月待完成事项', value: notDone.length, unit: '项', icon: AlertCircle, color: 'text-red-600', bg: 'bg-red-50', iconBg: 'bg-red-100' },
            { label: '本月累计记录', value: monthLogCount, unit: '条', icon: BarChart3, color: 'text-violet-600', bg: 'bg-violet-50', iconBg: 'bg-violet-100' },
          ].map(c => (
            <div key={c.label} className={`${c.bg} rounded-2xl p-5 hover:shadow-md transition-shadow cursor-default`}>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-medium text-gray-500">{c.label}</span>
                <div className={`w-9 h-9 rounded-xl ${c.iconBg} flex items-center justify-center`}>
                  <c.icon size={17} className={c.color} />
                </div>
              </div>
              <p className="text-3xl font-bold text-gray-800">{c.value}</p>
              <p className="text-xs text-gray-400 mt-1">{c.unit}</p>
            </div>
          ))}
        </div>

        {/* ====== WEEK STRIP ====== */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-3">
          <div className="grid grid-cols-7 gap-2">
            {wkDays.map(d => {
              const count = logs.filter(l => l.date === d).length;
              const isToday = d === today();
              const isSelected = d === logDate;
              const dt = new Date(d + 'T12:00:00');
              const dayIdx = dt.getDay() === 0 ? 6 : dt.getDay() - 1;
              return (
                <button key={d} onClick={() => { setLogDate(d); setTab('log'); }}
                  className={`p-3 rounded-2xl text-center transition-all ${
                    isSelected ? 'bg-gray-900 text-white shadow-lg scale-105' : isToday ? 'bg-starbucks-50 ring-1 ring-starbucks-200' : 'hover:bg-gray-50'
                  }`}>
                  <p className={`text-[11px] font-medium ${isSelected ? 'text-gray-300' : 'text-gray-400'}`}>{dayLabels[dayIdx]}</p>
                  <p className={`text-lg font-bold mt-1 ${isSelected ? 'text-white' : isToday ? 'text-starbucks-600' : 'text-gray-700'}`}>{dt.getDate()}</p>
                  <div className="flex justify-center gap-0.5 mt-1.5">
                    {count > 0 ? Array.from({length: Math.min(count, 3)}).map((_, i) => (
                      <div key={i} className={`w-1 h-1 rounded-full ${isSelected ? 'bg-white/60' : 'bg-starbucks-400'}`} />
                    )) : <div className="w-1 h-1 rounded-full bg-transparent" />}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* ====== MAIN CONTENT: TWO COLUMNS ====== */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

          {/* ===== LEFT: WORK LOG (2/3 width on desktop) ===== */}
          <div className="lg:col-span-2 space-y-5">
            {tab === 'log' ? (
              <>
                {/* Date navigator */}
                <div className="flex items-center justify-between bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-4">
                  <button onClick={() => setLogDate(addDay(logDate, -1))} className="p-2 rounded-xl hover:bg-gray-100 transition-colors">
                    <ChevronLeft size={20} className="text-gray-400" />
                  </button>
                  <div className="text-center">
                    <p className="text-lg font-bold text-gray-800">{fmt(logDate)}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{dayLogs.length} 条工作记录</p>
                  </div>
                  <button onClick={() => setLogDate(addDay(logDate, 1))} className="p-2 rounded-xl hover:bg-gray-100 transition-colors">
                    <ChevronRight size={20} className="text-gray-400" />
                  </button>
                </div>

                {/* Category filter */}
                <div className="flex flex-wrap gap-1.5">
                  <button onClick={() => setCatFilter(null)}
                    className={`px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all ${
                      !catFilter ? 'bg-gray-900 text-white shadow-sm' : 'bg-white text-gray-500 border border-gray-200 hover:bg-gray-50'
                    }`}>全部</button>
                  {logCategories.map(c => {
                    const count = dayLogs.filter(l => l.category === c).length;
                    if (!catFilter && count === 0) return null;
                    const cfg = catCfg[c];
                    return (
                      <button key={c} onClick={() => setCatFilter(catFilter === c ? null : c)}
                        className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all ${
                          catFilter === c ? `${cfg.bg} ${cfg.color} ring-1 ring-inset ring-gray-300` : 'bg-white text-gray-500 border border-gray-200 hover:bg-gray-50'
                        }`}>
                        <cfg.icon size={11} />{c}{count > 0 && <span className="opacity-60">({count})</span>}
                      </button>
                    );
                  })}
                </div>

                {/* Timeline */}
                {filteredDayLogs.length === 0 ? (
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm py-16 text-center">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gray-100 flex items-center justify-center">
                      <Clock size={28} className="text-gray-300" />
                    </div>
                    <p className="text-sm text-gray-400 font-medium">{catFilter ? '该分类暂无记录' : '今天还没有工作记录'}</p>
                    <p className="text-xs text-gray-300 mt-1">记录每日工作，方便回顾和汇报</p>
                  </div>
                ) : (
                  <div className="relative pl-8 before:absolute before:left-[19px] before:top-3 before:bottom-3 before:w-px before:bg-gray-200 space-y-5">
                    {filteredDayLogs.map((log) => {
                      const cfg = catCfg[log.category] || catCfg['其他'];
                      return (
                        <div key={log.id} className="relative group">
                          <div className={`absolute left-[-26px] top-3 w-3 h-3 rounded-full ring-2 ring-white ${cfg.dot}`} />
                          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 hover:shadow-md transition-shadow">
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex-1 min-w-0">
                                <span className={`inline-flex items-center gap-1.5 text-[10px] px-2.5 py-1 rounded-lg font-medium ${cfg.bg} ${cfg.color} mb-3`}>
                                  <cfg.icon size={12} />{log.category}
                                </span>
                                <p className="text-sm text-gray-800 leading-relaxed font-medium">{log.content}</p>
                                {log.result && (
                                  <div className="mt-3 flex items-start gap-2 p-3 bg-emerald-50/60 rounded-xl border border-emerald-100/50">
                                    <CheckCircle2 size={14} className="text-emerald-500 flex-shrink-0 mt-px" />
                                    <p className="text-xs text-gray-700">{log.result}</p>
                                  </div>
                                )}
                              </div>
                              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                                <button onClick={() => { setEditingLog(log); setLogModal(true); }} className="p-1.5 text-gray-300 hover:text-blue-500 hover:bg-blue-50 rounded-lg"><Edit3 size={13} /></button>
                                <button onClick={() => delLog(log.id)} className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg"><Trash2 size={13} /></button>
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
                  className="w-full py-4 border-2 border-dashed border-gray-200 rounded-2xl text-sm text-gray-400 hover:border-starbucks-300 hover:text-starbucks-500 transition-all flex items-center justify-center gap-2 font-medium">
                  <Plus size={18} />写工作记录
                </button>
              </>
            ) : (
              /* ===== PENDING TAB in left column ===== */
              <>
                {/* Month selector */}
                <div className="flex items-center justify-between bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-4">
                  <button onClick={() => setPMonth(ALL_MONTHS[Math.max(0, ALL_MONTHS.indexOf(pMonth) - 1)] || pMonth)} className="p-2 rounded-xl hover:bg-gray-100">
                    <ChevronLeft size={20} className="text-gray-400" />
                  </button>
                  <div className="text-center">
                    <p className="text-lg font-bold text-gray-800">{ml(pMonth)}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{monthPending.length === 0 ? '暂无事项' : `${monthPending.length} 项 · ${notDone.length} 项待完成`}</p>
                  </div>
                  <button onClick={() => setPMonth(ALL_MONTHS[Math.min(11, ALL_MONTHS.indexOf(pMonth) + 1)] || pMonth)} className="p-2 rounded-xl hover:bg-gray-100">
                    <ChevronRight size={20} className="text-gray-400" />
                  </button>
                </div>

                {/* Pending summary cards */}
                {monthPending.length > 0 && (
                  <div className="grid grid-cols-4 gap-3">
                    {[
                      { v: monthPending.length, l: '总计', c: 'text-gray-800' },
                      { v: doing.length, l: '执行中', c: 'text-blue-600' },
                      { v: waiting.length, l: '待开始', c: 'text-amber-600' },
                      { v: doneP.length, l: '已完成', c: 'text-emerald-600' },
                    ].map(s => (
                      <div key={s.l} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 text-center">
                        <p className={`text-2xl font-bold ${s.c}`}>{s.v}</p>
                        <p className="text-[10px] text-gray-400 mt-1">{s.l}</p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Urgent alert */}
                {urgentPending.length > 0 && (
                  <div className="bg-gradient-to-r from-red-50 to-amber-50 rounded-2xl border border-red-100 p-5">
                    <div className="flex items-center gap-2 mb-3">
                      <Zap size={15} className="text-red-500" />
                      <p className="text-sm font-bold text-red-600">本周到期 / 高优先事项</p>
                      <span className="text-[10px] px-2 py-0.5 bg-red-100 text-red-600 rounded-full font-bold">{urgentPending.length}</span>
                    </div>
                    <div className="space-y-2">
                      {urgentPending.map(p => {
                        const pc = priCfg[p.priority];
                        return (
                          <div key={p.id} className="flex items-center gap-3 text-sm bg-white/60 rounded-xl p-2.5">
                            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${pc.bar}`} />
                            <span className="text-gray-700 flex-1 truncate font-medium">{p.title}</span>
                            {p.deadline && <span className="text-[10px] text-red-500 font-medium flex-shrink-0">{p.deadline}</span>}
                            <span className={`text-[10px] px-2 py-0.5 rounded font-medium ${pc.bg} flex-shrink-0`}>{pc.label}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Not done list */}
                {monthPending.length === 0 ? (
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm py-16 text-center">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gray-100 flex items-center justify-center">
                      <Target size={28} className="text-gray-300" />
                    </div>
                    <p className="text-sm text-gray-400 font-medium">本月暂无待办事项</p>
                    <p className="text-xs text-gray-300 mt-1">添加需要当月跟进的重要事项</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {notDone.map((p) => {
                      const pc = priCfg[p.priority];
                      return (
                        <div key={p.id} className={`bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden group border-l-4 ${pc.border} hover:shadow-md transition-shadow`}>
                          <div className="p-5">
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap mb-2">
                                  <h4 className="text-sm font-bold text-gray-800">{p.title}</h4>
                                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${pc.bg}`}>{pc.label === '高' ? '高优先' : pc.label === '中' ? '中优先' : '低优先'}</span>
                                  {p.status === 'doing' && <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-blue-50 text-blue-600">执行中</span>}
                                  {p.deadline && <span className="text-[10px] text-gray-400 flex items-center gap-1"><Calendar size={10} />{p.deadline}</span>}
                                </div>
                                {p.detail && <p className="text-xs text-gray-500 leading-relaxed mb-3">{p.detail}</p>}
                                <div className="flex items-center gap-3">
                                  <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                                    <div className={`h-full rounded-full transition-all ${pc.bar}`} style={{ width: `${p.progress}%` }} />
                                  </div>
                                  <span className="text-xs font-bold text-gray-400 w-9 text-right">{p.progress}%</span>
                                </div>
                                {p.result && (
                                  <p className="mt-3 text-xs text-emerald-600 bg-emerald-50/60 rounded-lg px-3 py-2">
                                    <CheckCircle2 size={11} className="inline mr-1" />{p.result}
                                  </p>
                                )}
                              </div>
                              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={() => { setEditingPending(p); setPendingModal(true); }} className="p-1.5 text-gray-300 hover:text-blue-500 hover:bg-blue-50 rounded-lg"><Edit3 size={13} /></button>
                                <button onClick={() => delPending(p.id)} className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg"><Trash2 size={13} /></button>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Done */}
                {doneP.length > 0 && (
                  <details className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    <summary className="px-5 py-3.5 cursor-pointer text-xs text-gray-400 select-none hover:text-gray-500 font-medium">已完成 ({doneP.length})</summary>
                    <div className="divide-y divide-gray-50 border-t border-gray-50">
                      {doneP.map(p => (
                        <div key={p.id} className="p-3.5 px-5 flex items-center justify-between opacity-50 hover:opacity-75 transition-opacity">
                          <span className="text-xs text-gray-500 line-through">{p.title}</span>
                          <button onClick={() => delPending(p.id)} className="p-1 text-gray-300 hover:text-red-500 rounded"><Trash2 size={12} /></button>
                        </div>
                      ))}
                    </div>
                  </details>
                )}

                <button onClick={() => { setEditingPending(null); setPendingModal(true); }}
                  className="w-full py-4 border-2 border-dashed border-gray-200 rounded-2xl text-sm text-gray-400 hover:border-starbucks-300 hover:text-starbucks-500 transition-all flex items-center justify-center gap-2 font-medium">
                  <Plus size={18} />添加待办事项
                </button>
              </>
            )}
          </div>

          {/* ===== RIGHT SIDEBAR (1/3 width on desktop) ===== */}
          <div className="space-y-5">
            {/* Quick week summary card */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <h3 className="text-sm font-bold text-gray-700 flex items-center gap-2 mb-4">
                <BarChart3 size={15} className="text-starbucks-500" />本周分类统计
              </h3>
              {weekCatStats.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-4">本周暂无记录</p>
              ) : (
                <div className="space-y-3">
                  {weekCatStats.map(([cat, count]) => {
                    const cfg = catCfg[cat] || catCfg['其他'];
                    const max = weekCatStats[0]?.[1] || 1;
                    const pct = Math.round((count / max) * 100);
                    return (
                      <div key={cat} className="flex items-center gap-3">
                        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${cfg.dot}`} />
                        <span className="text-xs text-gray-600 w-20 truncate">{cat}</span>
                        <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${cfg.dot}`} style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-xs font-bold text-gray-500 w-5 text-right">{count}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Today's quick-view of pending items related to today */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <h3 className="text-sm font-bold text-gray-700 flex items-center gap-2 mb-4">
                <Flag size={15} className="text-amber-500" />近期待办
              </h3>
              {notDone.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-4">暂无待办事项</p>
              ) : (
                <div className="space-y-2">
                  {notDone.slice(0, 5).map(p => {
                    const pc = priCfg[p.priority];
                    return (
                      <div key={p.id} className="flex items-center gap-2.5 p-2.5 rounded-xl hover:bg-gray-50 transition-colors">
                        <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${pc.bar}`} />
                        <span className="text-xs text-gray-700 flex-1 truncate">{p.title}</span>
                        {p.deadline && <span className="text-[10px] text-gray-400 flex-shrink-0">{p.deadline}</span>}
                      </div>
                    );
                  })}
                  {notDone.length > 5 && (
                    <button onClick={() => setTab('pending')} className="text-xs text-starbucks-500 hover:text-starbucks-600 font-medium w-full text-center py-1">
                      查看全部 {notDone.length} 项
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Week activity heat map */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <h3 className="text-sm font-bold text-gray-700 flex items-center gap-2 mb-4">
                <TrendingUp size={15} className="text-blue-500" />本周活跃度
              </h3>
              <div className="grid grid-cols-7 gap-1.5">
                {wkDays.map(d => {
                  const count = logs.filter(l => l.date === d).length;
                  const intensity = count === 0 ? 'bg-gray-100' : count <= 2 ? 'bg-starbucks-200' : count <= 4 ? 'bg-starbucks-400' : 'bg-starbucks-600';
                  return (
                    <div key={d} className="text-center">
                      <div className={`${intensity} rounded-lg h-10 mb-1 transition-colors`} />
                      <p className="text-[10px] text-gray-400">{count}</p>
                    </div>
                  );
                })}
              </div>
              <div className="flex items-center justify-end gap-1.5 mt-3">
                <span className="text-[10px] text-gray-400">少</span>
                <div className="w-3 h-3 rounded bg-gray-100" />
                <div className="w-3 h-3 rounded bg-starbucks-200" />
                <div className="w-3 h-3 rounded bg-starbucks-400" />
                <div className="w-3 h-3 rounded bg-starbucks-600" />
                <span className="text-[10px] text-gray-400">多</span>
              </div>
            </div>
          </div>
        </div>

        {/* ====== MODALS ====== */}
        {logModal && (
          <div className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh] p-4">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => { setLogModal(false); setEditingLog(null); }} />
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 bg-gray-50/50">
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
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 bg-gray-50/50">
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

function LogForm({ init, date, onSave, onCancel }: { init: WorkLog | null; date: string; onSave: (d: WorkLog) => void; onCancel: () => void }) {
  const [f, setF] = useState(init || { id: genId('WL'), date, content: '', category: '经销商拜访', result: '' });
  const cls = "w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-gray-50 focus:outline-none focus:bg-white focus:border-gray-400 transition-all";
  const lbl = "text-[11px] text-gray-400 mb-1 block font-medium";
  return (
    <div className="p-5 space-y-4">
      <div><label className={lbl}>工作内容 *</label><textarea value={f.content} onChange={e => setF({ ...f, content: e.target.value })} placeholder="今天做了什么工作？" rows={3} className={cls} autoFocus /></div>
      <div><label className={lbl}>分类</label>
        <div className="flex flex-wrap gap-1.5">
          {logCategories.map(c => {
            const cfg = catCfg[c] || catCfg['其他'];
            return (
              <button key={c} type="button" onClick={() => setF({ ...f, category: c })}
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-all ${
                  f.category === c ? `${cfg.bg} ${cfg.color} ring-1 ring-inset ring-gray-200` : 'bg-gray-50 text-gray-400 hover:bg-gray-100'
                }`}><cfg.icon size={11} />{c}</button>
            );
          })}
        </div>
      </div>
      <div><label className={lbl}>成果/产出</label><input value={f.result} onChange={e => setF({ ...f, result: e.target.value })} placeholder="量化成果，如：拜访3家经销商，签约1家" className={cls} /></div>
      <div className="flex justify-end gap-3 pt-2">
        <button onClick={onCancel} className="px-5 py-2.5 text-sm text-gray-500 hover:bg-gray-50 rounded-xl transition-colors">取消</button>
        <button onClick={() => { if (f.content) onSave(f); }} className="px-6 py-2.5 bg-starbucks-500 text-white rounded-xl text-sm font-medium hover:bg-starbucks-600 shadow-sm transition-colors">保存</button>
      </div>
    </div>
  );
}

function PendingForm({ init, month, onSave, onCancel }: { init: PendingItem | null; month: string; onSave: (d: PendingItem) => void; onCancel: () => void }) {
  const [f, setF] = useState(init || { id: genId('MP'), month, title: '', detail: '', priority: 'medium' as const, progress: 0, status: 'pending' as const, deadline: '', result: '' });
  const cls = "w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-gray-50 focus:outline-none focus:bg-white focus:border-gray-400 transition-all";
  const lbl = "text-[11px] text-gray-400 mb-1 block font-medium";
  return (
    <div className="p-5 space-y-4">
      <div><label className={lbl}>事项标题 *</label><input value={f.title} onChange={e => setF({ ...f, title: e.target.value })} placeholder="如：完成唐山区域铺货" className={cls} autoFocus /></div>
      <div><label className={lbl}>详细描述</label><textarea value={f.detail} onChange={e => setF({ ...f, detail: e.target.value })} placeholder="具体要做什么..." rows={2} className={cls} /></div>
      <div className="grid grid-cols-2 gap-4">
        <div><label className={lbl}>优先级</label><select value={f.priority} onChange={e => setF({ ...f, priority: e.target.value as 'high' | 'medium' | 'low' })} className={cls}><option value="high">高优先</option><option value="medium">中优先</option><option value="low">低优先</option></select></div>
        <div><label className={lbl}>截止日期</label><input type="date" value={f.deadline} onChange={e => setF({ ...f, deadline: e.target.value })} className={cls} /></div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div><label className={lbl}>状态</label><select value={f.status} onChange={e => setF({ ...f, status: e.target.value as PendingItem['status'] })} className={cls}><option value="pending">待开始</option><option value="doing">执行中</option><option value="done">已完成</option></select></div>
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
