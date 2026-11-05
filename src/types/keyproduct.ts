/** 单品整体数据：进货/库存/分销总量 */
export interface ProductOverview {
  id: string;
  productId: string;
  date: string;
  restockQty: number;    // 进货数量
  stockQty: number;      // 目前库存数量
  distributeQty: number; // 分销数量（发给所有分销商的总量）
}

/** 分销商发货明细 + 实力评估 */
export interface DistributorDistribution {
  id: string;
  productId: string;
  distributorName: string; // 分销商名称
  quantity: number;        // 发货数量
  downstreamCount: number; // 下游客户数量
  podCount: number;        // 下游POD数
  coverage: number;        // 目前覆盖数量
  strength: '强' | '中' | '弱'; // 实力评级
  remark: string;
}

/** 市场计划 */
export interface MarketPlan {
  id: string;
  productId: string;
  plan: string;      // 计划怎么做
  target: string;    // 目标
  timeline: string;  // 计划时间
  remark: string;
}
