export interface BilliardLocation {
  id: string;
  name: string;
  address: string;
  contact: string;
  phone: string;
  manager: string;
  status: 'cooperating' | 'negotiating' | 'not_needed';
  stage: string;
  date: string;
  orderQty: number;
  displayFee: number;
  remark: string;
}
