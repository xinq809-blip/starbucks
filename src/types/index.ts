export interface Product {
  id: string;
  name: string;
  category: string;
  sku: string;
  spec: string;
  /** 经销商批发单价 (元) */
  unitPrice: number;
}

export interface MonthlyTarget {
  /** "2026-07" */
  month: string;
  salesTarget: number; // 件
}

export interface Distributor {
  id: string;
  name: string;
  region: string;
  phone: string;
  address: string;
}

export interface WeeklySnapshot {
  /** Monday of the week, e.g. "2026-07-06" */
  weekStart: string;
  productId: string;
  distributorId: string;
  quantity: number;
}

export interface RestockRecord {
  id: string;
  date: string;        // ISO date
  productId: string;
  distributorId: string;
  quantity: number;     // 入库数量
  weekStart: string;    // 归属周
}

export interface WeekRecord {
  weekStart: string;
  label: string;
  entries: number;
}
