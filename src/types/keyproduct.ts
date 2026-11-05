/** 单品整体数据：进货/库存/分销总量 */
export interface ProductOverview {
  id: string;
  productId: string;
  date: string;
  restockQty: number;    // 进货数量
  stockQty: number;      // 目前库存数量
  distributeQty: number; // 分销数量（发给所有分销商的总量）
  coverage: number;      // 单品覆盖网点数（覆盖了多少终端）
}

/** 分销商发货明细 + 实力评估 */
export interface DistributorDistribution {
  id: string;
  productId: string;
  distributorName: string; // 分销商名称
  quantity: number;        // 发货数量
  downstreamCount: number; // 下游客户数量
  outletCount: number;     // 网点数（销售终端/POD，合并概念）
  strength: '强' | '中' | '弱'; // 实力评级
  remark: string;
}

/** 市场计划 */
export interface MarketPlan {
  id: string;
  productId: string;
  /** 计划标题 */
  title: string;
  /** 重点区域 */
  keyRegion: string;
  /** 市场策略（怎么做） */
  strategy: string;
  /** 推广方式 */
  promotionMethod: string;
  /** 目标分销商数 */
  targetDistributor: number;
  /** 每月新增分销商 */
  monthlyNewDistributor: number;
  /** 目标网点数（合并POD概念） */
  targetOutlet: number;
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
