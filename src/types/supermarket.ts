export interface Supermarket {
  id: string;
  name: string;
  type: string; // 商超类型: NKA/LKA/便利店等
}

export interface NewProductListing {
  id: string;
  productName: string;
  supermarketId: string;
  targetDate: string;
  actualDate: string;
  status: 'negotiating' | 'approved' | 'listed';
  remark: string;
}

export interface PromotionSlot {
  id: string;
  productName: string;
  supermarketId: string;
  startDate: string;
  endDate: string;
  type: string; // 促销类型: 堆头/端架/海报等
  status: 'planned' | 'confirmed' | 'executing' | 'done';
  remark: string;
}

export interface PlatformRollout {
  id: string;
  productName: string;
  platform: string; // 平台名称: 多点/京东到家/美团等
  supermarketId: string;
  targetDate: string;
  actualDate: string;
  status: 'pending' | 'in_progress' | 'online';
  remark: string;
}
