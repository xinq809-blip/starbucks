import { useState, useMemo, useEffect } from 'react';
import { Plus, X, Download, AlertCircle } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend } from 'recharts';
import { supabase } from '../lib/supabase';
import type { PerformanceRecord } from '../types/performance';

function genId() { return 'P' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
function ml(m: string) { return m.replace('-', '年') + '月'; }
function fmt(n: number) { return n.toLocaleString('zh-CN', { minimumFractionDigits: 0, maximumFractionDigits: 2 }); }

const ALL_MONTHS = Array.from({length: 12}, (_,i) => `2026-${String(i+1).padStart(2,'0')}`);

export default function PerformancePage() {
  const [items, setItems] = useState<PerformanceRecord[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState('2026-01');
  const [modal, setModal] = useState(false);

  useEffect(() => {
    supabase.from('performance').select('*').then(r => {
      setItems((r.data || []).map((row: any) => row.data));
      setLoaded(true);
    });
  }, []);

  const flush = (data: PerformanceRecord[]) => {
    setItems(data);
    if (loaded) supabase.from('performance').upsert(data.map(d => ({ id: d.id, data: d })), { onConflict: 'id' }).then(() => {});
  };

  const save = (d: PerformanceRecord) => {
    if (items.find(i => i.month === d.month)) {
      flush(items.map(i => i.month === d.month ? d : i));
    } else {
      flush([...items, d]);
    }
    setModal(false);
  };

  const del = (id: string) => flush(items.filter(i => i.id !== id));

  const report = useMemo(() => {
    const months = [...new Set([...items.map(i => i.month), ...ALL_MONTHS])].sort();
    const data = months.map(m => {
      const entry = items.find(i => i.month === m);
      const target = entry?.target || 0;
      const actual = entry?.actual || 0;
      const lastYear = entry?.lastYear || 0;
      const rate = target > 0 ? Math.round((actual / target) * 100) : 0;
      const yoyGrowth = lastYear > 0 ? Math.round(((actual - lastYear) / lastYear) * 100) : 0;
      return { month: m, label: ml(m), target, actual, lastYear, rate, yoyGrowth, entry };
    });

    // Use all months with data for YTD, not just up to selectedMonth
    const ytd = data.filter(d => d.target > 0 || d.actual > 0 || d.lastYear > 0);
    const ytdTarget = ytd.reduce((s, d) => s + d.target, 0);
    const ytdActual = ytd.reduce((s, d) => s + d.actual, 0);
    const ytdLastYear = ytd.reduce((s, d) => s + d.lastYear, 0);
    const latestDataMonth = ytd.length > 0 ? ytd[ytd.length - 1].month : selectedMonth;
    const ytdRate = ytdTarget > 0 ? Math.round((ytdActual / ytdTarget) * 100) : 0;
    const ytdYoy = ytdLastYear > 0 ? Math.round(((ytdActual - ytdLastYear) / ytdLastYear) * 100) : 0;

    // Quarterly sums
    const Q = (start: number, end: number) => {
      const q = data.filter(d => { const m = parseInt(d.month.slice(5)); return m >= start && m <= end; });
      return { target: q.reduce((s,d)=>s+d.target,0), actual: q.reduce((s,d)=>s+d.actual,0), lastYear: q.reduce((s,d)=>s+d.lastYear,0) };
    };
    const quarters = [
      { label: 'Q1 (1-3月)', ...Q(1,3) },
      { label: 'Q2 (4-6月)', ...Q(4,6) },
      { label: 'Q3 (7-9月)', ...Q(7,9) },
      { label: 'Q4 (10-12月)', ...Q(10,12) },
    ];
    const annual = { target: data.reduce((s,d)=>s+d.target,0), actual: data.reduce((s,d)=>s+d.actual,0), lastYear: data.reduce((s,d)=>s+d.lastYear,0) };

    // Gap analysis: how much more needed per remaining month
    const remainingMonths = 12 - parseInt(selectedMonth.slice(5));
    const annualTarget = quarters.reduce((s,q)=>s+q.target,0);
    const gapToAnnual = annualTarget > 0 ? Math.max(0, annualTarget - ytdActual) : 0;
    const monthlyCatchup = remainingMonths > 0 && gapToAnnual > 0 ? Math.round(gapToAnnual / remainingMonths) : 0;

    return { data, ytdTarget, ytdActual, ytdLastYear, ytdRate, ytdYoy, quarters, annual, gapToAnnual, monthlyCatchup, remainingMonths, ytdCount: ytd.length, latestDataMonth };
  }, [items, selectedMonth]);

  const chartData = report.data.filter(d => d.month >= '2026-01' && d.month <= selectedMonth);

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      <div className="p-4 md:p-6 space-y-5 max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">业绩达成</h1>
            <p className="text-sm text-gray-400 mt-0.5">目标设定 · 实际达成 · 同期对比 · 达成率分析</p>
          </div>
          <button onClick={() => setModal(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-gray-900 text-white rounded-xl text-sm font-medium hover:bg-gray-800 shadow-sm">
            <Plus size={16} />新增记录
          </button>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            ['YTD 目标', fmt(report.ytdTarget), '🎯', 'bg-blue-50'],
            ['YTD 实际', fmt(report.ytdActual), '📈', 'bg-emerald-50'],
            ['达成率', report.ytdRate + '%', report.ytdRate >= 100 ? '✅' : '⚠️', report.ytdRate >= 100 ? 'bg-emerald-50' : 'bg-amber-50'],
            ['同比增长', (report.ytdYoy >= 0 ? '+' : '') + report.ytdYoy + '%', report.ytdYoy >= 0 ? '📈' : '📉', report.ytdYoy >= 0 ? 'bg-emerald-50' : 'bg-red-50'],
          ].map(k => (
            <div key={k[0] as string} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{k[0]}</p>
                <div className={`w-9 h-9 rounded-xl ${k[3]} flex items-center justify-center text-lg`}>{k[2]}</div>
              </div>
              <p className="text-2xl font-bold text-gray-800">{k[1] as string}</p>
              <p className="text-[10px] text-gray-400 mt-0.5">{report.ytdCount > 0 ? `1-${parseInt(report.latestDataMonth.slice(5))}月累计` : '暂无数据'}</p>
            </div>
          ))}
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Target vs Actual Bar Chart */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <h3 className="text-sm font-bold text-gray-700 mb-3">月度目标 vs 实际</h3>
            {chartData.filter(d => d.target > 0 || d.actual > 0).length > 0 ? (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f5" />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={v => (v/10000).toFixed(0)+'万'} />
                  <Tooltip formatter={(v: any) => Number(v).toLocaleString()} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="target" fill="#93c5fd" name="目标" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="actual" fill="#00704A" name="实际" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : <div className="text-xs text-gray-300 text-center py-16">暂无数据</div>}
          </div>

          {/* Achievement Rate + YoY Line */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <h3 className="text-sm font-bold text-gray-700 mb-3">达成率 & 同比增长趋势</h3>
            {chartData.filter(d => d.rate > 0 || d.yoyGrowth !== 0).length > 0 ? (
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f5" />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={v => v + '%'} />
                  <Tooltip formatter={(v: any) => Number(v) + '%'} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Line type="monotone" dataKey="rate" stroke="#00704A" strokeWidth={2} dot={{ r: 4 }} name="达成率" />
                  <Line type="monotone" dataKey="yoyGrowth" stroke="#f59e0b" strokeWidth={2} dot={{ r: 4 }} strokeDasharray="5 5" name="同比增长" />
                </LineChart>
              </ResponsiveContainer>
            ) : <div className="text-xs text-gray-300 text-center py-16">暂无数据</div>}
          </div>
        </div>

        {/* Monthly table */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-50">
            <h3 className="text-sm font-bold text-gray-700">月度明细</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50/50 text-[11px] text-gray-400">
                  <th className="text-left px-6 py-3 font-medium">月份</th>
                  <th className="text-right px-4 py-3 font-medium">目标</th>
                  <th className="text-right px-4 py-3 font-medium">实际</th>
                  <th className="text-right px-4 py-3 font-medium">达成率</th>
                  <th className="text-right px-4 py-3 font-medium">去年同期</th>
                  <th className="text-right px-4 py-3 font-medium">同比增长</th>
                  <th className="text-right px-4 py-3 font-medium">缺口</th>
                  <th className="text-left px-4 py-3 font-medium">备注</th>
                  <th className="text-center px-3 py-3 w-16">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {report.data.filter(d => d.month >= '2026-01').map(d => (
                  <tr key={d.month} className={`hover:bg-gray-50/30 ${d.month === selectedMonth ? 'bg-blue-50/30' : ''}`}
                    onClick={() => setSelectedMonth(d.month)}>
                    <td className="px-6 py-3 text-xs font-medium text-gray-800">{d.label}</td>
                    <td className="px-4 py-3 text-right text-xs text-gray-700">{d.target > 0 ? fmt(d.target) : <span className="text-gray-300">—</span>}</td>
                    <td className="px-4 py-3 text-right text-xs font-bold text-gray-800">{d.actual > 0 ? fmt(d.actual) : <span className="text-gray-300">—</span>}</td>
                    <td className="px-4 py-3 text-right">
                      {d.target > 0 ? (
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${d.rate >= 100 ? 'bg-emerald-50 text-emerald-600' : d.rate >= 80 ? 'bg-amber-50 text-amber-600' : 'bg-red-50 text-red-500'}`}>
                          {d.rate}%
                        </span>
                      ) : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-3 text-right text-xs text-gray-500">{d.lastYear > 0 ? fmt(d.lastYear) : <span className="text-gray-300">—</span>}</td>
                    <td className="px-4 py-3 text-right text-xs font-bold" style={{ color: d.yoyGrowth >= 0 ? '#059669' : '#ef4444' }}>
                      {d.lastYear > 0 ? (d.yoyGrowth >= 0 ? '+' : '') + d.yoyGrowth + '%' : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-3 text-right text-xs text-red-500">
                      {d.target > 0 && d.actual < d.target ? fmt(d.target - d.actual) : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400 max-w-[100px] truncate">{d.entry?.remark || ''}</td>
                    <td className="px-3 py-3 text-center">
                      {d.entry && <button onClick={e => { e.stopPropagation(); del(d.entry!.id); }} className="text-gray-300 hover:text-red-500 text-[10px]">删除</button>}
                    </td>
                  </tr>
                ))}
                {/* Quarterly subtotals */}
                {report.quarters.map(q => {
                  const rate = q.target > 0 ? Math.round((q.actual / q.target) * 100) : 0;
                  return (
                    <tr key={q.label} className="bg-gray-50/80 font-medium">
                      <td className="px-6 py-2.5 text-xs font-bold text-gray-700">{q.label}</td>
                      <td className="px-4 py-2.5 text-right text-xs font-bold text-blue-600">{fmt(q.target)}</td>
                      <td className="px-4 py-2.5 text-right text-xs font-bold text-gray-800">{fmt(q.actual)}</td>
                      <td className="px-4 py-2.5 text-right"><span className={`text-xs font-bold px-2 py-0.5 rounded-full ${rate>=100?'bg-emerald-50 text-emerald-600':rate>=80?'bg-amber-50 text-amber-600':'bg-red-50 text-red-500'}`}>{rate}%</span></td>
                      <td className="px-4 py-2.5 text-right text-xs text-gray-500">{fmt(q.lastYear)}</td>
                      <td className="px-4 py-2.5"></td><td className="px-4 py-2.5"></td><td className="px-4 py-2.5"></td><td className="px-3 py-2.5"></td>
                    </tr>
                  );
                })}
                {/* Annual total */}
                <tr className="bg-gray-100 font-bold">
                  <td className="px-6 py-3 text-xs text-gray-800">年度合计</td>
                  <td className="px-4 py-3 text-right text-xs text-blue-600">{fmt(report.annual.target)}</td>
                  <td className="px-4 py-3 text-right text-xs text-gray-800">{fmt(report.annual.actual)}</td>
                  <td className="px-4 py-3 text-right"><span className="text-xs font-bold px-2 py-0.5 rounded-full bg-gray-200 text-gray-700">{report.annual.target>0?Math.round((report.annual.actual/report.annual.target)*100):0}%</span></td>
                  <td className="px-4 py-3 text-right text-xs">{fmt(report.annual.lastYear)}</td>
                  <td className="px-4 py-3"></td><td className="px-4 py-3"></td><td className="px-4 py-3"></td><td className="px-3 py-3"></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Gap Analysis */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h3 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
            <AlertCircle size={16} className={report.gapToAnnual > 0 ? 'text-red-500' : 'text-emerald-500'} />
            缺口分析
          </h3>
          {report.gapToAnnual > 0 ? (
            <div className="grid grid-cols-4 gap-4">
              <div className="text-center"><p className="text-xs text-gray-400">年度目标</p><p className="text-lg font-bold text-gray-800">{fmt(report.annual.target)}</p></div>
              <div className="text-center"><p className="text-xs text-gray-400">YTD 实际</p><p className="text-lg font-bold text-emerald-600">{fmt(report.ytdActual)}</p></div>
              <div className="text-center"><p className="text-xs text-gray-400">剩余缺口</p><p className="text-lg font-bold text-red-500">{fmt(report.gapToAnnual)}</p></div>
              <div className="text-center"><p className="text-xs text-gray-400">每月追量</p><p className="text-lg font-bold text-amber-600">{fmt(report.monthlyCatchup)}</p></div>
            </div>
          ) : (
            <div className="text-emerald-600 text-sm text-center py-4">✅ 已达成年度目标！</div>
          )}
        </div>

        {/* Export button */}
        <div className="flex justify-end">
          <button onClick={() => window.print()}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-gray-500 bg-white border border-gray-200 rounded-xl hover:bg-gray-50">
            <Download size={14} />导出汇报图片 (打印为PDF)
          </button>
        </div>

        {/* Modal */}
        {modal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setModal(false)} />
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-50 bg-gray-50/50">
                <h3 className="text-sm font-semibold text-gray-800">新增业绩记录</h3>
                <button onClick={() => setModal(false)} className="p-1.5 rounded-full hover:bg-gray-200"><X size={16} className="text-gray-400" /></button>
              </div>
              <AddForm existing={items} onSave={save} onCancel={() => setModal(false)} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function AddForm({ existing, onSave, onCancel }: { existing: PerformanceRecord[]; onSave: (d: PerformanceRecord) => void; onCancel: () => void }) {
  const [f, setF] = useState({ month: '2026-07', target: 0, actual: 0, lastYear: 0, remark: '' });
  const cls = "w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-gray-50 focus:outline-none focus:bg-white focus:border-gray-400 transition-all";
  const lbl = "text-[11px] text-gray-400 mb-1 block font-medium";

  return (
    <div className="p-6 space-y-4">
      <div>
        <label className={lbl}>月份</label>
        <select value={f.month} onChange={e => setF({ ...f, month: e.target.value })} className={cls}>
          {ALL_MONTHS.map(m => <option key={m} value={m}>{ml(m)}</option>)}
        </select>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div><label className={lbl}>目标</label><input type="number" min="0" step="any" value={f.target > 0 ? f.target : ''} onChange={e => setF({ ...f, target: parseFloat(e.target.value) || 0 })} className={cls} /></div>
        <div><label className={lbl}>实际</label><input type="number" min="0" step="any" value={f.actual > 0 ? f.actual : ''} onChange={e => setF({ ...f, actual: parseFloat(e.target.value) || 0 })} className={cls} /></div>
        <div><label className={lbl}>去年同期</label><input type="number" min="0" step="any" value={f.lastYear > 0 ? f.lastYear : ''} onChange={e => setF({ ...f, lastYear: parseFloat(e.target.value) || 0 })} className={cls} /></div>
      </div>
      <div><label className={lbl}>备注</label><input value={f.remark} onChange={e => setF({ ...f, remark: e.target.value })} placeholder="备注" className={cls} /></div>
      <div className="flex justify-end gap-3 pt-2">
        <button onClick={onCancel} className="px-5 py-2.5 text-sm text-gray-500 hover:bg-gray-50 rounded-xl">取消</button>
        <button onClick={() => { if (f.target > 0) onSave({ id: existing.find(x => x.month === f.month)?.id || genId(), ...f }); }} className="px-6 py-2.5 bg-gray-900 text-white rounded-xl text-sm font-medium hover:bg-gray-800 shadow-sm">保存</button>
      </div>
    </div>
  );
}
