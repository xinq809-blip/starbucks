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
  /** 计划标题 */
  title: string;
  /** 市场策略（怎么做） */
  strategy: string;
  /** 目标分销商数 */
  targetDistributor: number;
  /** 每月新增分销商 */
  monthlyNewDistributor: number;
  /** 目标覆盖网点数 */
  targetCoverage: number;
  /** 目标POD数 */
  targetPod: number;
  /** 目标销量(件) */
  targetSales: number;
  /** 开始时间 */
  startDate: string;
  /** 结束时间 */
  endDate: string;
  /** 费用预算(元) */
  budget: number;
  /** 备注 */
  remark: string;
}
