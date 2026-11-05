export interface KeyProductRecord {
  id: string;
  /** 单品：p11=P450黑咖啡, p20=椰椰拿铁 */
  productId: string;
  /** 录入日期 */
  date: string;
  /** 进货数量 */
  restockQty: number;
  /** 目前库存数量 */
  stockQty: number;
  /** 分销数量 */
  distributeQty: number;
  /** 分销下游客户名称 */
  customerName: string;
  /** 下游客户 POD 数量（陈列点/网点） */
  customerPod: number;
  /** 目前覆盖数量 */
  coverage: number;
  /** 后期计划 */
  futurePlan: string;
  /** 备注 */
  remark: string;
}
