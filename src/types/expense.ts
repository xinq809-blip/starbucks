export interface ExpenseRecord {
  id: string;
  month: string;
  category: string;
  location: string;    // 费用归属门店/经销商
  projected: number;
  actual: number;
  remark: string;
}

export const EXPENSE_CATEGORIES = [
  { key: 'display', label: '陈列费', icon: '🖼️' },
  { key: 'promotion', label: '促销活动费', icon: '🎯' },
  { key: 'salary', label: '人员工资', icon: '👤' },
  { key: 'project', label: '专案费用', icon: '📋' },
  { key: 'commitment', label: '承诺费用', icon: '🤝' },
  { key: 'other', label: '其他费用', icon: '📌' },
];
