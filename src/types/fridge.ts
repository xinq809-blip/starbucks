export interface FridgeRecord {
  id: string;
  distributorId: string;   // 归属经销商
  distributorName: string;
  terminalName: string;     // 终端名称
  barcode: string;         // 资产条形码
  model: string;           // 型号
  status: 'active' | 'repair' | 'scrapped';  // 使用中/维修中/已报废
  address: string;         // 摆放地址
  imageUrl: string;        // 冰箱照片URL
  remark: string;
  date: string;            // 投放日期
}
