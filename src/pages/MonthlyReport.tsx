import { useState, useEffect } from 'react';
import { Plus, X, Edit3, Trash2, Circle, ChevronLeft, ChevronRight, TrendingUp, Target, Flag } from 'lucide-react';
import { supabase } from '../lib/supabase';

function genId() { return 'DT' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

interface DailyTask {
  id: string;
  date: string;
  title: string;
  detail: string;
  priority: 'high' | 'medium' | 'low';
  progress: number;
  status: 'todo' | 'doing' | 'done';
  result: string;
}

function today(): string { return new Date().toISOString().slice(0, 10); }

function fmt(d: string) {
  const dt = new Date(d + 'T00:00:00');
  return `${dt.getMonth() + 1}月${dt.getDate()}日 · 周${['日','一','二','三','四','五','六'][dt.getDay()]}`;
}

// Navigate days without crossing month boundaries issues
function addDay(d: string, n: number): string {
  const dt = new Date(d + 'T12:00:00');
  dt.setDate(dt.getDate() + n);
  return dt.toISOString().slice(0, 10);
}

const priorityCfg: Record<string, { label: string; dot: string; bg: string }> = {
  high: { label: '高优先', dot: 'bg-red-500', bg: 'bg-red-50 text-red-600' },
  medium: { label: '中优先', dot: 'bg-amber-500', bg: 'bg-amber-50 text-amber-600' },
  low: { label: '低优先', dot: 'bg-gray-400', bg: 'bg-gray-100 text-gray-600' },
};

export default function DailyPlanPage() {
  const [date, setDate] = useState(today());
  const [tasks, setTasks] = useState<DailyTask[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<DailyTask | null>(null);

  // Load from Supabase
  useEffect(() => {
    (async () => {
      try {
        const r = await supabase.from('daily_tasks').select('*');
        setTasks((r.data || []).map((row: any) => row.data));
      } catch {}
      setLoaded(true);
    })();
  }, []);

  // Save to Supabase
  useEffect(() => {
    if (!loaded) return;
    try { supabase.from('daily_tasks').upsert(tasks.map(d => ({ id: d.id, data: d })), { onConflict: 'id' }).then(() => {}); } catch {}
  }, [tasks, loaded]);

  const dayTasks = tasks.filter(t => t.date === date);
  const doneCount = dayTasks.filter(t => t.status === 'done').length;
  const totalCount = dayTasks.length;
  const completionRate = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;

  // Sort: undone first by priority (high > medium > low), then done at bottom
  const sorted = [...dayTasks].sort((a, b) => {
    if (a.status === 'done' && b.status !== 'done') return 1;
    if (a.status !== 'done' && b.status === 'done') return -1;
    const order = { high: 0, medium: 1, low: 2 };
    return order[a.priority as keyof typeof order] - order[b.priority as keyof typeof order];
  });

  const save = (d: DailyTask) => {
    setTasks(prev => prev.find(t => t.id === d.id) ? prev.map(t => t.id === d.id ? d : t) : [...prev, d]);
    setModal(false); setEditing(null);
  };
  const del = (id: string) => setTasks(prev => prev.filter(t => t.id !== id));
  const toggle = (t: DailyTask) => {
    save({
      ...t,
      status: t.status === 'done' ? 'todo' : 'done',
      progress: t.status === 'done' ? 0 : 100,
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      <div className="p-4 md:p-6 space-y-5 max-w-3xl mx-auto">

        {/* Header + Date Navigator */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <div className="flex items-center justify-between">
            <button onClick={() => setDate(addDay(date, -1))} className="p-2 rounded-xl hover:bg-gray-100 transition-colors">
              <ChevronLeft size={18} className="text-gray-400" />
            </button>
            <div className="text-center">
              <h1 className="text-lg font-bold text-gray-800">{fmt(date)}</h1>
              <p className="text-xs text-gray-400 mt-0.5">
                {totalCount > 0 ? `${doneCount}/${totalCount} 已完成 · ${completionRate}%` : '每日工作计划'}
              </p>
            </div>
            <button onClick={() => setDate(addDay(date, 1))} className="p-2 rounded-xl hover:bg-gray-100 transition-colors">
              <ChevronRight size={18} className="text-gray-400" />
            </button>
          </div>

          {/* Quick nav: back to today */}
          {date !== today() && (
            <div className="text-center mt-2">
              <button onClick={() => setDate(today())} className="text-xs text-starbucks-500 hover:text-starbucks-600 font-medium">
                回到今天
              </button>
            </div>
          )}

          {/* Progress bar */}
          {totalCount > 0 && (
            <div className="mt-4 space-y-1.5">
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div className={`h-full rounded-full transition-all duration-300 ${
                  completionRate >= 100 ? 'bg-emerald-500' : completionRate >= 50 ? 'bg-starbucks-500' : 'bg-amber-400'
                }`} style={{ width: `${completionRate}%` }} />
              </div>
              <div className="flex justify-between text-[11px]">
                <span className="text-gray-400">{completionRate}%</span>
                <span className="text-gray-300">{doneCount}/{totalCount} 项</span>
              </div>
            </div>
          )}
        </div>

        {/* Task List */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-3.5 border-b border-gray-50 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Target size={15} className="text-starbucks-500" />
              <h3 className="text-sm font-bold text-gray-700">待办事项</h3>
              {totalCount > 0 && <span className="text-[11px] text-gray-400">{totalCount} 项</span>}
            </div>
            <button onClick={() => { setEditing(null); setModal(true); }}
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium bg-starbucks-500 text-white rounded-lg hover:bg-starbucks-600 transition-colors">
              <Plus size={14} />添加任务
            </button>
          </div>

          {sorted.length === 0 ? (
            <div className="py-14 text-center">
              <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-gray-100 flex items-center justify-center">
                <Flag size={24} className="text-gray-300" />
              </div>
              <p className="text-sm text-gray-400">今天还没有任务</p>
              <p className="text-xs text-gray-300 mt-1">点击「添加任务」规划今日工作</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {sorted.map((t) => {
                const p = priorityCfg[t.priority];
                const isDone = t.status === 'done';
                return (
                  <div key={t.id} className={`p-4 md:px-5 hover:bg-gray-50/30 transition-colors group ${isDone ? 'opacity-60' : ''}`}>
                    <div className="flex items-start gap-3">
                      {/* Check circle */}
                      <button onClick={() => toggle(t)} className="flex-shrink-0 mt-0.5">
                        {isDone
                          ? <CheckCircleFilled />
                          : <Circle size={20} className="text-gray-300 hover:text-starbucks-500 transition-colors" />}
                      </button>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className={`text-sm font-bold ${isDone ? 'text-gray-400 line-through' : 'text-gray-800'}`}>
                              {t.title}
                            </h4>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${p.bg}`}>{p.label}</span>
                            {t.status === 'doing' && !isDone && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-blue-50 text-blue-600">执行中</span>
                            )}
                          </div>
                          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => { setEditing(t); setModal(true); }} className="p-1.5 text-gray-300 hover:text-blue-500 hover:bg-blue-50 rounded-lg"><Edit3 size={13} /></button>
                            <button onClick={() => del(t.id)} className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg"><Trash2 size={13} /></button>
                          </div>
                        </div>

                        {t.detail && <p className="text-xs text-gray-500 mt-1 leading-relaxed">{t.detail}</p>}

                        {/* Progress bar for non-done tasks with progress > 0, or done tasks */}
                        {(t.progress > 0 || t.status === 'doing') && (
                          <div className="mt-2.5 flex items-center gap-2">
                            <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                              <div className={`h-full rounded-full transition-all ${
                                t.progress >= 100 ? 'bg-emerald-500' : t.progress >= 50 ? 'bg-starbucks-500' : 'bg-amber-400'
                              }`} style={{ width: `${t.progress}%` }} />
                            </div>
                            <span className="text-[10px] font-bold text-gray-400 w-8 text-right tabular-nums">{t.progress}%</span>
                          </div>
                        )}

                        {t.result && (
                          <div className="mt-2.5 p-2.5 bg-emerald-50/50 rounded-lg border border-emerald-100/50">
                            <p className="text-xs text-gray-700"><span className="font-semibold text-emerald-600">成果：</span>{t.result}</p>
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

        {/* Week overview */}
        <WeekStrip date={date} tasks={tasks} onSelect={setDate} />

        {/* Modal */}
        {modal && (
          <div className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh] p-4">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => { setModal(false); setEditing(null); }} />
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100 bg-gray-50/50">
                <h3 className="text-sm font-semibold text-gray-800">{editing ? '编辑任务' : '添加任务'}</h3>
                <button onClick={() => { setModal(false); setEditing(null); }} className="p-1.5 rounded-full hover:bg-gray-200 transition-colors"><X size={16} className="text-gray-400" /></button>
              </div>
              <TaskForm init={editing} date={date} onSave={save} onCancel={() => { setModal(false); setEditing(null); }} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// --- Week strip at bottom ---
function WeekStrip({ date, tasks, onSelect }: { date: string; tasks: DailyTask[]; onSelect: (d: string) => void }) {
  const days: string[] = [];
  const dt = new Date(date + 'T12:00:00');
  const dayOfWeek = dt.getDay();
  const monday = new Date(dt);
  monday.setDate(dt.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));

  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    days.push(d.toISOString().slice(0, 10));
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="px-5 py-3.5 border-b border-gray-50 flex items-center gap-2.5">
        <TrendingUp size={15} className="text-starbucks-500" />
        <h3 className="text-sm font-bold text-gray-700">本周概览</h3>
      </div>
      <div className="p-2">
        <div className="grid grid-cols-7 gap-1">
          {days.map(d => {
            const dayTasks = tasks.filter(t => t.date === d);
            const done = dayTasks.filter(t => t.status === 'done').length;
            const total = dayTasks.length;
            const isToday = d === today();
            const isSelected = d === date;
            return (
              <button key={d} onClick={() => onSelect(d)}
                className={`p-2 rounded-xl text-center transition-colors ${
                  isSelected ? 'bg-starbucks-50 ring-1 ring-starbucks-200' : isToday ? 'bg-gray-50' : 'hover:bg-gray-50'
                }`}>
                <p className="text-[10px] text-gray-400">{['一','二','三','四','五','六','日'][new Date(d + 'T12:00:00').getDay() === 0 ? 6 : new Date(d + 'T12:00:00').getDay() - 1]}</p>
                <p className={`text-sm font-bold mt-0.5 ${isToday ? 'text-starbucks-600' : 'text-gray-600'}`}>
                  {new Date(d + 'T12:00:00').getDate()}
                </p>
                {total > 0 && (
                  <p className="text-[10px] text-gray-400 mt-0.5">{done}/{total}</p>
                )}
                {total > 0 && (
                  <div className="h-1 bg-gray-100 rounded-full mt-1 overflow-hidden">
                    <div className={`h-full rounded-full ${done === total ? 'bg-emerald-400' : 'bg-starbucks-400'}`}
                      style={{ width: `${total > 0 ? Math.round((done / total) * 100) : 0}%` }} />
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// --- Inline SVG for checked circle (avoids importing CheckCircle2 just for this) ---
function CheckCircleFilled() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-500">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <path d="M22 4 12 14.01l-3-3" />
    </svg>
  );
}

// --- Task Form ---
function TaskForm({ init, date, onSave, onCancel }: { init: DailyTask | null; date: string; onSave: (d: DailyTask) => void; onCancel: () => void }) {
  const [f, setF] = useState(init || { id: genId(), date, title: '', detail: '', priority: 'medium' as const, progress: 0, status: 'todo' as const, result: '' });
  const cls = "w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-gray-50 focus:outline-none focus:bg-white focus:border-gray-400 transition-all";
  const lbl = "text-[11px] text-gray-400 mb-1 block font-medium";
  return (
    <div className="p-5 space-y-4">
      <div><label className={lbl}>任务标题 *</label><input value={f.title} onChange={e => setF({ ...f, title: e.target.value })} placeholder="如：完成唐山区域铺货计划" className={cls} autoFocus /></div>
      <div><label className={lbl}>详细描述</label><textarea value={f.detail} onChange={e => setF({ ...f, detail: e.target.value })} placeholder="具体内容..." rows={2} className={cls} /></div>
      <div className="grid grid-cols-2 gap-4">
        <div><label className={lbl}>优先级</label>
          <select value={f.priority} onChange={e => setF({ ...f, priority: e.target.value as 'high' | 'medium' | 'low' })} className={cls}>
            <option value="high">高优先</option><option value="medium">中优先</option><option value="low">低优先</option>
          </select>
        </div>
        <div><label className={lbl}>状态</label>
          <select value={f.status} onChange={e => setF({ ...f, status: e.target.value as 'todo' | 'doing' | 'done' })} className={cls}>
            <option value="todo">待开始</option><option value="doing">执行中</option><option value="done">已完成</option>
          </select>
        </div>
      </div>
      <div><label className={lbl}>执行进度 (%)</label><input type="number" min="0" max="100" value={f.progress} onChange={e => setF({ ...f, progress: parseInt(e.target.value) || 0 })} className={cls} /></div>
      <div><label className={lbl}>成果/产出</label><input value={f.result} onChange={e => setF({ ...f, result: e.target.value })} placeholder="量化成果，如：新增3家网点" className={cls} /></div>
      <div className="flex justify-end gap-3 pt-2">
        <button onClick={onCancel} className="px-5 py-2.5 text-sm text-gray-500 hover:bg-gray-50 rounded-xl transition-colors">取消</button>
        <button onClick={() => { if (f.title) onSave(f); }} className="px-6 py-2.5 bg-starbucks-500 text-white rounded-xl text-sm font-medium hover:bg-starbucks-600 shadow-sm transition-colors">保存</button>
      </div>
    </div>
  );
}
