import type { Product, Distributor, WeeklySnapshot, RestockRecord } from '../types';

export const products: Product[] = [
  // BF281 星冰乐系列 - 12入
  { id: 'p01', name: 'BF281 星冰乐 咖啡味', category: 'BF281星冰乐', sku: 'BF281-啡', spec: '281ml×12入', unitPrice: 126.00 },
  { id: 'p02', name: 'BF281 星冰乐 摩卡味', category: 'BF281星冰乐', sku: 'BF281-摩卡', spec: '281ml×12入', unitPrice: 126.00 },
  // SS270 星选系列 - 15入
  { id: 'p03', name: 'SS270 星选 馥芮白', category: 'SS270星选', sku: 'SS270-FW', spec: '270ml×15入', unitPrice: 93.75 },
  { id: 'p04', name: 'SS270 星选 美式', category: 'SS270星选', sku: 'SS270-AM', spec: '270ml×15入', unitPrice: 93.75 },
  { id: 'p05', name: 'SS270 星选 咖啡拿铁', category: 'SS270星选', sku: 'SS270-LAT', spec: '270ml×15入', unitPrice: 93.75 },
  { id: 'p06', name: 'SS270 星选 芝士奶香', category: 'SS270星选', sku: 'SS270-CHS', spec: '270ml×15入', unitPrice: 93.75 },
  // P270 瓶装茶咖系列 - 15入 纸箱装
  { id: 'p07', name: 'P270 茶咖 铁观音乌龙拿铁', category: 'P270茶咖', sku: 'P270-TGY', spec: '270ml×15入 纸箱', unitPrice: 93.75 },
  { id: 'p08', name: 'P270 茶咖 茉莉拿铁', category: 'P270茶咖', sku: 'P270-ML', spec: '270ml×15入 纸箱', unitPrice: 93.75 },
  // P200 瓶装拿铁系列 - 15入
  { id: 'p09', name: 'P200 榛果味拿铁', category: 'P200拿铁', sku: 'P200-ZG', spec: '200ml×15入', unitPrice: 67.50 },
  { id: 'p10', name: 'P200 低糖拿铁', category: 'P200拿铁', sku: 'P200-DT', spec: '200ml×15入', unitPrice: 67.50 },
  // P450 黑咖啡 - 15入 纸箱装
  { id: 'p11', name: 'P450 黑咖啡', category: 'P450黑咖', sku: 'P450-BLK', spec: '450ml×15入 纸箱', unitPrice: 93.75 },
  // P270 派克市场 - 15入
  { id: 'p12', name: 'P270 派克市场', category: 'P270瓶装', sku: 'P270-PK', spec: '270ml×15入', unitPrice: 93.75 },
  // DS180 浓咖啡 新国标
  { id: 'p13', name: 'DS180 浓郁摩卡 新国标', category: 'DS180浓咖啡', sku: 'DS180-MC', spec: '180ml 新国标', unitPrice: 120.00 },
  { id: 'p14', name: 'DS180 浓郁咖啡 新国标', category: 'DS180浓咖啡', sku: 'DS180-CF', spec: '180ml 新国标', unitPrice: 120.00 },
  // P280 可尔必思 - 15入 纸箱
  { id: 'p15', name: 'P280 可尔必思', category: 'P280可尔必思', sku: 'P280-CLP', spec: '280ml×15入 纸箱', unitPrice: 40.50 },
  // TEA 茶系列 - 15入
  { id: 'p16', name: 'TEA 桃桃乌龙', category: 'TEA茶系列', sku: 'TEA-TT', spec: '×15入', unitPrice: 56.25 },
  { id: 'p17', name: 'TEA 莓莓黑加仑', category: 'TEA茶系列', sku: 'TEA-MM', spec: '×15入', unitPrice: 56.25 },
  // P500 可尔必思系列 - 15入
  { id: 'p18', name: 'P500 可尔必思 原味', category: 'P500可尔必思', sku: 'P500-CLP-Y', spec: '500ml×15入', unitPrice: 67.50 },
  { id: 'p19', name: 'P500 可尔必思 荔枝', category: 'P500可尔必思', sku: 'P500-CLP-LZ', spec: '500ml×15入', unitPrice: 67.50 },
  // P270 椰椰拿铁 - 15入 纸箱装
  { id: 'p20', name: 'P270 椰椰拿铁', category: 'P270瓶装', sku: 'P270-YY', spec: '270ml×15入 纸箱', unitPrice: 75.00 },
  // P350 befit 胶原蛋白肽系列
  { id: 'p21', name: 'P350 befit 胶原蛋白肽 玫瑰水', category: 'P350 befit', sku: 'P350-BF-MG', spec: '350ml×15入 津', unitPrice: 38.25 },
  { id: 'p22', name: 'P350 befit 胶原蛋白肽 茉莉水', category: 'P350 befit', sku: 'P350-BF-ML', spec: '350ml×5入 津', unitPrice: 38.25 },
];

export const distributors: Distributor[] = [
  { id: 'd1', name: '山海关梁波', region: '秦皇岛', phone: '', address: '', lat: 39.98, lng: 119.77 },
  { id: 'd2', name: '杨子', region: '秦皇岛', phone: '', address: '', lat: 39.93, lng: 119.58 },
  { id: 'd3', name: '速恩', region: '秦皇岛', phone: '', address: '', lat: 39.91, lng: 119.52 },
  { id: 'd4', name: '北戴河王总', region: '秦皇岛', phone: '', address: '', lat: 39.83, lng: 119.48 },
];

/** Module-level store — kept empty, real data lives in AppContext.
 *  All helpers accept snapshots as first param so they can read from context. */
export const snapshots: WeeklySnapshot[] = [];

export function getCurrentWeekStart(): string {
  const now = new Date();
  const day = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
  return monday.toISOString().slice(0, 10);
}

export function getAvailableWeeks(snaps: WeeklySnapshot[]): string[] {
  const weeks = [...new Set(snaps.map((s) => s.weekStart))].sort();
  return weeks;
}

export function getSnapshot(snaps: WeeklySnapshot[], weekStart: string, productId: string, distributorId: string): number | null {
  const s = snaps.find(
    (sn) => sn.weekStart === weekStart && sn.productId === productId && sn.distributorId === distributorId
  );
  return s ? s.quantity : null;
}

export function getLatestWeek(snaps: WeeklySnapshot[]): string {
  const weeks = getAvailableWeeks(snaps);
  return weeks.length > 0 ? weeks[weeks.length - 1] : getCurrentWeekStart();
}

export function getWeekLabel(weekStart: string): string {
  const d = new Date(weekStart + 'T00:00:00');
  const end = new Date(d);
  end.setDate(end.getDate() + 6);
  const fmt = (dt: Date) => `${dt.getMonth() + 1}/${dt.getDate()}`;
  return `${fmt(d)} - ${fmt(end)}`;
}

export function getProductById(id: string): Product | undefined {
  return products.find((p) => p.id === id);
}

export function getDistributorById(id: string): Distributor | undefined {
  return distributors.find((d) => d.id === id);
}

/** Sales per product×distributor for a given week = prevWeek stock - thisWeek stock */
export interface SalesRow {
  productId: string;
  distributorId: string;
  prevQty: number;
  currQty: number;
  sales: number; // positive = sold out, negative = restocked
}

export function getWeeklySales(snaps: WeeklySnapshot[], weekStart: string, restocks?: RestockRecord[], dists?: Distributor[]): SalesRow[] {
  const dList = (dists && dists.length > 0) ? dists : distributors;
  const weeks = getAvailableWeeks(snaps);
  const idx = weeks.indexOf(weekStart);
  if (idx < 0) return [];
  const prevWeek = idx > 0 ? weeks[idx - 1] : null;
  const rows: SalesRow[] = [];
  for (const p of products) {
    for (const d of dList) {
      const prev = prevWeek ? getSnapshot(snaps, prevWeek, p.id, d.id) : 0;
      const curr = getSnapshot(snaps, weekStart, p.id, d.id);
      if (curr !== null) {
        const weekRestock = (restocks ?? [])
          .filter((r) => r.productId === p.id && r.distributorId === d.id && (!prevWeek || r.date > prevWeek) && r.date <= weekStart)
          .reduce((s, r) => s + r.quantity, 0);
        // 销售 = 上期库存 + 期间进货 - 本期库存（始终计算）
        const sales = Math.max(0, (prev || 0) + weekRestock - curr);
        rows.push({ productId: p.id, distributorId: d.id, prevQty: prev || 0, currQty: curr, sales });
      }
    }
  }
  return rows;
}

/** Aggregate sales grouped by product for a given week */
export function getProductWeeklySales(snaps: WeeklySnapshot[], weekStart: string, restocks?: RestockRecord[]): { productId: string; sales: number }[] {
  const rows = getWeeklySales(snaps, weekStart, restocks);
  const map: Record<string, number> = {};
  for (const r of rows) {
    map[r.productId] = (map[r.productId] || 0) + r.sales;
  }
  return Object.entries(map).map(([productId, sales]) => ({ productId, sales }));
}

/** Aggregate sales grouped by distributor for a given week */
export function getDistributorWeeklySales(snaps: WeeklySnapshot[], weekStart: string, restocks?: RestockRecord[]): { distributorId: string; sales: number }[] {
  const rows = getWeeklySales(snaps, weekStart, restocks);
  const map: Record<string, number> = {};
  for (const r of rows) {
    map[r.distributorId] = (map[r.distributorId] || 0) + r.sales;
  }
  return Object.entries(map).map(([distributorId, sales]) => ({ distributorId, sales }));
}

/** Total stock across all products and distributors for a given week */
export function getTotalStock(snaps: WeeklySnapshot[], weekStart: string): number {
  return snaps
    .filter((s) => s.weekStart === weekStart)
    .reduce((sum, s) => sum + s.quantity, 0);
}

/** Get available months from snapshot data (YYYY-MM) */
export function getAvailableMonths(snaps: WeeklySnapshot[]): string[] {
  const months = new Set<string>();
  for (const s of snaps) {
    months.add(s.weekStart.slice(0, 7));
  }
  return [...months].sort();
}

/** Calculate total inventory value for a given week (元) */
export function getInventoryValue(snaps: WeeklySnapshot[], weekStart: string): number {
  let total = 0;
  for (const s of snaps) {
    if (s.weekStart !== weekStart) continue;
    const p = getProductById(s.productId);
    if (p) total += s.quantity * p.unitPrice;
  }
  return Math.round(total * 100) / 100;
}

/** Calculate inventory turnover days: current stock / avg daily sales */
export function getTurnoverDays(snaps: WeeklySnapshot[], weekStart: string, restocks?: RestockRecord[]): number | null {
  const weeks = getAvailableWeeks(snaps);
  if (weeks.length < 2) return null;
  const recentWeeks = weeks.slice(Math.max(0, weeks.length - 4));
  let totalSales = 0;
  let count = 0;
  for (let i = 1; i < recentWeeks.length; i++) {
    const ws = getWeeklySales(snaps, recentWeeks[i], restocks);
    totalSales += ws.reduce((s, r) => s + Math.max(0, r.sales), 0);
    count++;
  }
  if (count === 0 || totalSales === 0) return null;
  const dailyAvg = totalSales / (count * 7);
  const stock = getTotalStock(snaps, weekStart);
  return Math.round((stock / dailyAvg) * 10) / 10;
}

/** Detect slow-moving products: 0 sales for 2+ consecutive weeks */
export function getSlowMoving(snaps: WeeklySnapshot[], restocks?: RestockRecord[]): { productId: string; distributorId: string; weeksStale: number }[] {
  const weeks = getAvailableWeeks(snaps);
  if (weeks.length < 3) return [];
  const latest = weeks[weeks.length - 1];
  const prev = weeks[weeks.length - 2];
  const sales = getWeeklySales(snaps, latest, restocks);
  const prevSales = getWeeklySales(snaps, prev, restocks);

  return sales
    .filter((s) => s.sales === 0)
    .filter((s) => {
      const prevRow = prevSales.find((r) => r.productId === s.productId && r.distributorId === s.distributorId);
      return prevRow && prevRow.sales === 0;
    })
    .map((s) => {
      let stale = 2;
      for (let i = weeks.length - 3; i >= 0; i--) {
        const ws = getWeeklySales(snaps, weeks[i], restocks);
        const row = ws.find((r) => r.productId === s.productId && r.distributorId === s.distributorId);
        if (row && row.sales === 0) stale++; else break;
      }
      return { productId: s.productId, distributorId: s.distributorId, weeksStale: stale };
    });
}

/** Aggregate sales by product category for a given week */
export function getCategorySales(snaps: WeeklySnapshot[], weekStart: string, restocks?: RestockRecord[]): { category: string; sales: number; value: number }[] {
  const ws = getWeeklySales(snaps, weekStart, restocks);
  const map: Record<string, { sales: number; value: number }> = {};
  for (const r of ws) {
    if (r.sales <= 0) continue;
    const p = getProductById(r.productId);
    if (!p) continue;
    if (!map[p.category]) map[p.category] = { sales: 0, value: 0 };
    map[p.category].sales += r.sales;
    map[p.category].value += r.sales * p.unitPrice;
  }
  return Object.entries(map)
    .map(([category, d]) => ({ category, ...d, value: Math.round(d.value * 100) / 100 }))
    .sort((a, b) => b.sales - a.sales);
}

/** Get category short label for display */
export function getCategoryLabel(cat: string): string {
  return cat.length > 8 ? cat.slice(0, 7) + '…' : cat;
}
