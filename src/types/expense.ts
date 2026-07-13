export interface ExpenseRecord {
  id: string;
  month: string;
  category: string;
  type: 'budget' | 'actual';   // budget=预提费用, actual=实际支出
  location: string;
  amount: number;               // 金额(预提或支出)
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
