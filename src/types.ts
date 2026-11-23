// Data records for the Embroidery Factory Manager.
// Kept deliberately simple — each type is like one Excel sheet.

export type ID = string;

export type OrderStatus = 'Pending' | 'Designing' | 'In Production' | 'Completed' | 'Delivered' | 'Cancelled';

export interface Customer {
  id: ID;
  name: string;
  phone?: string;
  city?: string;
  notes?: string;
}

export interface Order {
  id: ID;
  orderNo: string;
  customerId: ID;
  date: string; // YYYY-MM-DD
  designNo: string;
  garment?: string; // e.g. Lehenga, Kameez
  referenceImage?: string; // compressed data URL
  quantity: number;
  rate: number;
  advance: number; // amount received when the order was booked
  deliveryDate: string;
  status: OrderStatus;
  notes?: string;
}

/** Money received from a customer after the order was booked. */
export interface Payment {
  id: ID;
  customerId: ID;
  orderId?: ID;
  date: string;
  amount: number;
  note?: string;
}

export interface Machine {
  id: ID;
  name: string;
}

export interface ProductionEntry {
  id: ID;
  date: string;
  machineId: ID;
  orderId?: ID;
  designNo: string;
  operatorId?: ID;
  quantity: number;
  notes?: string;
}

export interface InventoryItem {
  id: ID;
  category: string; // SEQ, ZARI, THREAD, FABRIC, PARTS
  name: string; // e.g. Sequin
  type: string; // e.g. Plane, Cup
  code: string; // e.g. 301
  unit?: string;
  openingQty: number;
  rate: number;
  minQty?: number; // show as "low stock" at or below this quantity
}

export interface StockEntry {
  id: ID;
  itemId: ID;
  date: string;
  type: 'IN' | 'OUT';
  qty: number;
  note?: string;
  purchaseId?: ID; // set when the entry comes from a purchase
}

export interface Supplier {
  id: ID;
  name: string;
  phone?: string;
  city?: string;
  notes?: string;
}

/** One row = one item bought (like a purchase register in Excel). */
export interface Purchase {
  id: ID;
  date: string;
  supplierId: ID;
  itemId: ID;
  qty: number;
  rate: number;
  paid: number; // paid at the time of purchase
  billNo?: string;
  notes?: string;
}

/** Money paid to a supplier later. */
export interface SupplierPayment {
  id: ID;
  supplierId: ID;
  date: string;
  amount: number;
  note?: string;
}

export interface Employee {
  id: ID;
  name: string;
  designation: string;
  phone?: string;
  salary: number; // monthly
  active: boolean;
  notes?: string;
}

export interface SalaryRecord {
  id: ID;
  employeeId: ID;
  month: string; // YYYY-MM
  salary: number;
  bonus: number;
  advance: number;
  deduction: number;
  paid: boolean;
  note?: string;
}

export interface Expense {
  id: ID;
  date: string;
  title: string;
  category: string;
  amount: number;
  notes?: string;
}

export interface Settings {
  factoryName: string;
}

export interface DB {
  settings: Settings;
  customers: Customer[];
  orders: Order[];
  payments: Payment[];
  machines: Machine[];
  production: ProductionEntry[];
  items: InventoryItem[];
  stock: StockEntry[];
  suppliers: Supplier[];
  purchases: Purchase[];
  supplierPayments: SupplierPayment[];
  employees: Employee[];
  salaries: SalaryRecord[];
  expenses: Expense[];
}
