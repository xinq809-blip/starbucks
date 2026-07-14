import { useState, useMemo, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import { useApp } from '../context/AppContext';
import { supabase } from '../lib/supabase';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix default marker icon
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

function getMonthLabel(m: string) { return m.replace('-', '年') + '月'; }
function fmt(n: number) { return '¥' + n.toLocaleString('zh-CN', { minimumFractionDigits: 0 }); }

const ALL_MONTHS = Array.from({length:8}, (_,i) => `2026-${String(i+5).padStart(2,'0')}`);

type StoreExpense = {
  name: string; lat: number; lng: number;
  display: number; promotion: number; salary: number; project: number; commitment: number; other: number;
  total: number;
};

// Center map on all markers
function MapBounds({ stores }: { stores: StoreExpense[] }) {
  const map = useMap();
  useEffect(() => {
    if (stores.length > 0) {
      const bounds = L.latLngBounds(stores.map(s => [s.lat, s.lng]));
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [stores, map]);
  return null;
}

// Create custom colored circle markers
function createIcon(color: string, size: number) {
  return L.divIcon({
    className: 'custom-marker',
    html: `<div style="background:${color};width:${size}px;height:${size}px;border-radius:50%;border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;color:white;font-weight:bold;font-size:${size > 24 ? 12 : 10}px"></div>`,
    iconSize: [size, size],
    iconAnchor: [size/2, size/2],
  });
}

export default function ExpenseMapPage() {
  const { state: { distributors } } = useApp();
  const [actuals, setActuals] = useState<any[]>([]);
  const [selectedMonth, setSelectedMonth] = useState('2026-05');
  const [selectedCat, setSelectedCat] = useState('all');

  useEffect(() => {
    supabase.from('expenses').select('*').then(r => {
      const data = (r.data || []).map((row: any) => row.data);
      setActuals(data.filter((d: any) => d.type === 'actual' || (d.location && d.location !== '')));
    });
  }, []);

  // Match actuals to distributors by name
  const stores = useMemo(() => {
    return distributors
      .filter(d => d.lat && d.lng)
      .map(d => {
        const distActuals = actuals.filter(a =>
          a.month === selectedMonth && a.location === d.name &&
          (selectedCat === 'all' || a.category === selectedCat)
        );
        const byCat: Record<string, number> = {};
        distActuals.forEach(a => { byCat[a.category] = (byCat[a.category] || 0) + (a.amount || 0); });
        const total = Object.values(byCat).reduce((s, v) => s + v, 0);
        return {
          name: d.name, lat: d.lat, lng: d.lng,
          display: byCat['display'] || 0,
          promotion: byCat['promotion'] || 0,
          salary: byCat['salary'] || 0,
          project: byCat['project'] || 0,
          commitment: byCat['commitment'] || 0,
          other: byCat['other'] || 0,
          total,
        };
      });
  }, [distributors, actuals, selectedMonth, selectedCat]);

  const maxTotal = Math.max(...stores.map(s => s.total), 1);
  const activeStores = stores.filter(s => s.total > 0);

  // Always show all store locations on map (even without expenses)
  const allStoresWithCoords = stores;

  // Route line connecting stores with expenses
  const routeLine = activeStores.length >= 2 ? activeStores.map(s => [s.lat, s.lng] as [number, number]) : null;

  // If no expense data at all, still show all store locations
  const hasCoords = allStoresWithCoords.length > 0;

  const catOptions = [
    { key: 'all', label: '全部费用', color: '#3b82f6' },
    { key: 'display', label: '陈列费', color: '#10b981' },
    { key: 'promotion', label: '促销活动费', color: '#f59e0b' },
    { key: 'salary', label: '人员工资', color: '#ef4444' },
    { key: 'project', label: '专案费用', color: '#8b5cf6' },
    { key: 'commitment', label: '承诺费用', color: '#06b6d4' },
    { key: 'other', label: '其他费用', color: '#6b7280' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      <div className="p-4 md:p-6 space-y-5 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">费用地图</h1>
            <p className="text-sm text-gray-400 mt-0.5">门店费用分布可视化 · {activeStores.length} 个活动门店</p>
          </div>
          <div className="flex items-center gap-3">
            <select value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)}
              className="border border-gray-200 rounded-xl px-4 py-2 text-sm font-medium bg-white">
              {ALL_MONTHS.map(m => <option key={m} value={m}>{getMonthLabel(m)}</option>)}
            </select>
            <select value={selectedCat} onChange={e => setSelectedCat(e.target.value)}
              className="border border-gray-200 rounded-xl px-4 py-2 text-sm font-medium bg-white">
              {catOptions.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
            </select>
          </div>
        </div>

        {/* Legend Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2">
          {catOptions.map(c => {
            const total = stores.reduce((s, st) => s + (c.key === 'all' ? st.total : (st as any)[c.key] || 0), 0);
            return (
              <div key={c.key} onClick={() => setSelectedCat(c.key)}
                className={`rounded-xl p-3 text-center cursor-pointer transition-all border-2 ${selectedCat === c.key ? 'border-gray-800 shadow-md' : 'border-transparent bg-white shadow-sm hover:shadow-md'}`}>
                <div className="w-3 h-3 rounded-full mx-auto mb-1" style={{ backgroundColor: c.color }} />
                <p className="text-[10px] text-gray-500">{c.label}</p>
                <p className="text-sm font-bold text-gray-800">{fmt(total)}</p>
              </div>
            );
          })}
        </div>

        {/* Map */}
        {hasCoords ? (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden" style={{ height: '500px', minHeight: '500px' }}>
            <MapContainer center={[39.9, 119.5]} zoom={10} style={{ height: '100%', width: '100%', minHeight: '500px' }} scrollWheelZoom={true}>
              <TileLayer
                attribution='&copy; 高德地图'
                url="https://webrd0{s}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}"
                subdomains="1234"
              />
              <MapBounds stores={activeStores.length > 0 ? activeStores : allStoresWithCoords} />

              {/* Route line */}
              {routeLine && (
                <Polyline
                  positions={routeLine}
                  pathOptions={{ color: '#00704A', weight: 3, opacity: 0.6, dashArray: '10 5' }}
                />
              )}

              {/* Store markers (always show all stores) */}
              {allStoresWithCoords.map(s => {
                const hasExpense = s.total > 0;
                const size = hasExpense ? 18 + Math.round((s.total / maxTotal) * 22) : 14;
                const catColor = catOptions.find(c => c.key === selectedCat)?.color || '#3b82f6';
                const color = hasExpense ? (selectedCat === 'all' ? '#00704A' : catColor) : '#cbd5e1';
                const icon = createIcon(color, size);
                return (
                  <Marker key={s.name} position={[s.lat, s.lng]} icon={icon}>
                    <Popup>
                      <div className="text-sm min-w-[160px]">
                        <p className="font-bold text-gray-800 mb-2">{s.name}</p>
                        {hasExpense ? (
                          <div className="space-y-1 text-xs">
                            {s.display > 0 && <div className="flex justify-between"><span>陈列费</span><span className="font-medium">{fmt(s.display)}</span></div>}
                            {s.promotion > 0 && <div className="flex justify-between"><span>促销费</span><span className="font-medium">{fmt(s.promotion)}</span></div>}
                            {s.salary > 0 && <div className="flex justify-between"><span>人员工资</span><span className="font-medium">{fmt(s.salary)}</span></div>}
                            {s.project > 0 && <div className="flex justify-between"><span>专案费用</span><span className="font-medium">{fmt(s.project)}</span></div>}
                            {s.commitment > 0 && <div className="flex justify-between"><span>承诺费用</span><span className="font-medium">{fmt(s.commitment)}</span></div>}
                            {s.other > 0 && <div className="flex justify-between"><span>其他</span><span className="font-medium">{fmt(s.other)}</span></div>}
                            <div className="flex justify-between font-bold pt-1 border-t border-gray-100"><span>合计</span><span style={{ color }}>{fmt(s.total)}</span></div>
                          </div>
                        ) : (
                          <p className="text-xs text-gray-400">该月暂无费用数据</p>
                        )}
                      </div>
                    </Popup>
                  </Marker>
                );
              })}
            </MapContainer>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm flex items-center justify-center h-[400px] text-gray-400">
            <div className="text-center">
              <p className="text-lg mb-1">🗺️</p>
              <p className="text-sm">请先在经销商管理中设置门店经纬度</p>
            </div>
          </div>
        )}

        {/* Summary Table */}
        {activeStores.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-50"><h2 className="text-sm font-bold text-gray-700">门店费用明细</h2></div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="bg-gray-50/30 border-b border-gray-100 text-[11px] text-gray-400">
                  <th className="text-left px-5 py-2.5">门店</th>
                  <th className="text-right px-4 py-2.5">陈列费</th>
                  <th className="text-right px-4 py-2.5">促销费</th>
                  <th className="text-right px-4 py-2.5">工资</th>
                  <th className="text-right px-4 py-2.5">专案</th>
                  <th className="text-right px-4 py-2.5">承诺</th>
                  <th className="text-right px-4 py-2.5">其他</th>
                  <th className="text-right px-5 py-2.5 font-bold">合计</th>
                </tr></thead>
                <tbody className="divide-y divide-gray-50">
                  {activeStores.map(s => (
                    <tr key={s.name} className="hover:bg-gray-50/30 text-xs">
                      <td className="px-5 py-3 font-medium text-gray-800">{s.name}</td>
                      <td className="px-4 py-3 text-right text-gray-600">{s.display > 0 ? fmt(s.display) : ''}</td>
                      <td className="px-4 py-3 text-right text-gray-600">{s.promotion > 0 ? fmt(s.promotion) : ''}</td>
                      <td className="px-4 py-3 text-right text-gray-600">{s.salary > 0 ? fmt(s.salary) : ''}</td>
                      <td className="px-4 py-3 text-right text-gray-600">{s.project > 0 ? fmt(s.project) : ''}</td>
                      <td className="px-4 py-3 text-right text-gray-600">{s.commitment > 0 ? fmt(s.commitment) : ''}</td>
                      <td className="px-4 py-3 text-right text-gray-600">{s.other > 0 ? fmt(s.other) : ''}</td>
                      <td className="px-5 py-3 text-right font-bold text-gray-800">{fmt(s.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
