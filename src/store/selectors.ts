// Calculated values (totals, balances, stock). Nothing here is stored —
// it is always worked out from the records, so numbers always agree.

import type { DB, InventoryItem, Order, Purchase, SalaryRecord } from '../types';

export const orderTotal = (o: Pick<Order, 'quantity' | 'rate'>) => (o.quantity || 0) * (o.rate || 0);
export const purchaseAmount = (p: Pick<Purchase, 'qty' | 'rate'>) => (p.qty || 0) * (p.rate || 0);
export const salaryNet = (s: Pick<SalaryRecord, 'salary' | 'bonus' | 'advance' | 'deduction'>) =>
  (s.salary || 0) + (s.bonus || 0) - (s.advance || 0) - (s.deduction || 0);

export function byId<T extends { id: string }>(list: T[]): Map<string, T> {
  return new Map(list.map((x) => [x.id, x]));
}

/** Payments received later, per order */
export function laterPaymentsByOrder(db: DB) {
  const m = new Map<string, number>();
  for (const p of db.payments) if (p.orderId) m.set(p.orderId, (m.get(p.orderId) || 0) + p.amount);
  return m;
}

export const orderBalance = (o: Order, later: Map<string, number>) =>
  o.status === 'Cancelled' ? 0 : orderTotal(o) - (o.advance || 0) - (later.get(o.id) || 0);

/** Current stock = opening + IN − OUT */
export function stockByItem(db: DB) {
  const m = new Map<string, number>(db.items.map((i) => [i.id, i.openingQty || 0]));
  for (const s of db.stock) m.set(s.itemId, (m.get(s.itemId) || 0) + (s.type === 'IN' ? s.qty : -s.qty));
  return m;
}

export interface StockLine {
  opening: number; // at the start of the month
  in: number; // during the month
  out: number; // during the month
  balance: number; // now
}

/** Per item: Opening (start of month) + IN − OUT = Balance */
export function stockForMonth(db: DB, month: string) {
  const start = `${month}-01`;
  const m = new Map<string, StockLine>(db.items.map((i) => [i.id, { opening: i.openingQty || 0, in: 0, out: 0, balance: i.openingQty || 0 }]));
  for (const s of db.stock) {
    const l = m.get(s.itemId);
    if (!l) continue;
    const q = s.type === 'IN' ? s.qty : -s.qty;
    l.balance += q;
    if (s.date < start) l.opening += q;
    else if (s.date.slice(0, 7) === month) s.type === 'IN' ? (l.in += s.qty) : (l.out += s.qty);
  }
  return m;
}

export const isLow = (item: InventoryItem, qty: number) => item.minQty !== undefined && item.minQty !== null && item.minQty > 0 && qty <= item.minQty;

export function lowStock(db: DB) {
  const stock = stockByItem(db);
  return db.items
    .map((item) => ({ item, qty: stock.get(item.id) || 0 }))
    .filter((x) => isLow(x.item, x.qty))
    .sort((a, b) => a.qty / (a.item.minQty || 1) - b.qty / (b.item.minQty || 1));
}

/* ---------- Monthly hisab ----------
   Simple V1 rules (easy to change here once the owner confirms):
   Sales      = value of orders booked in the month (by order date, cancelled excluded)
   Received   = advances (by order date) + later payments (by payment date)
   Spending   = material purchases + salaries (from the salary sheet) + other expenses
   Profit     = Sales − Spending */
export interface Hisab {
  orders: number;
  sales: number;
  received: number;
  purchases: number;
  salaries: number;
  salarySheet: boolean; // false = salary sheet for this month not made yet
  expenses: number;
  spending: number;
  profit: number;
}

export function monthHisab(db: DB, month: string): Hisab {
  const inMonth = (d: string) => d.slice(0, 7) === month;
  const orders = db.orders.filter((o) => inMonth(o.date) && o.status !== 'Cancelled');
  const sales = orders.reduce((s, o) => s + orderTotal(o), 0);
  const received =
    orders.reduce((s, o) => s + (o.advance || 0), 0) + db.payments.filter((p) => inMonth(p.date)).reduce((s, p) => s + p.amount, 0);
  const purchases = db.purchases.filter((p) => inMonth(p.date)).reduce((s, p) => s + purchaseAmount(p), 0);
  const sheet = db.salaries.filter((s) => s.month === month);
  // salary cost = salary + bonus − deduction (advances were already part of the salary)
  const salaries = sheet.reduce((s, r) => s + (r.salary || 0) + (r.bonus || 0) - (r.deduction || 0), 0);
  const expenses = db.expenses.filter((e) => inMonth(e.date)).reduce((s, e) => s + e.amount, 0);
  const spending = purchases + salaries + expenses;
  return { orders: orders.length, sales, received, purchases, salaries, salarySheet: sheet.length > 0, expenses, spending, profit: sales - spending };
}

export function expensesByCategory(db: DB, month: string) {
  const m = new Map<string, number>();
  for (const e of db.expenses) if (e.date.slice(0, 7) === month) m.set(e.category, (m.get(e.category) || 0) + e.amount);
  return [...m].sort((a, b) => b[1] - a[1]).map(([category, amount]) => ({ id: category, category, amount }));
}

export interface Account {
  total: number;
  paid: number;
  balance: number;
}

/** Per customer: total of orders, money received, balance to receive */
export function customerAccounts(db: DB) {
  const m = new Map<string, Account>(db.customers.map((c) => [c.id, { total: 0, paid: 0, balance: 0 }]));
  const get = (id: string) => m.get(id) ?? m.set(id, { total: 0, paid: 0, balance: 0 }).get(id)!;
  for (const o of db.orders) {
    if (o.status === 'Cancelled') continue;
    const a = get(o.customerId);
    a.total += orderTotal(o);
    a.paid += o.advance || 0;
  }
  for (const p of db.payments) get(p.customerId).paid += p.amount;
  for (const a of m.values()) a.balance = a.total - a.paid;
  return m;
}

/** Per supplier: total purchases, money paid, balance to pay */
export function supplierAccounts(db: DB) {
  const m = new Map<string, Account>(db.suppliers.map((s) => [s.id, { total: 0, paid: 0, balance: 0 }]));
  const get = (id: string) => m.get(id) ?? m.set(id, { total: 0, paid: 0, balance: 0 }).get(id)!;
  for (const p of db.purchases) {
    const a = get(p.supplierId);
    a.total += purchaseAmount(p);
    a.paid += p.paid || 0;
  }
  for (const p of db.supplierPayments) get(p.supplierId).paid += p.amount;
  for (const a of m.values()) a.balance = a.total - a.paid;
  return m;
}

export interface LedgerRow {
  key: string;
  date: string;
  detail: string;
  debit: number; // bill / purchase
  credit: number; // received / paid
  balance: number;
}

/** Customer khata: orders as bills, advances and payments as received. */
export function customerLedger(db: DB, customerId: string): LedgerRow[] {
  const rows: Omit<LedgerRow, 'balance'>[] = [];
  for (const o of db.orders) {
    if (o.customerId !== customerId || o.status === 'Cancelled') continue;
    rows.push({ key: `o${o.id}`, date: o.date, detail: `Order ${o.orderNo} · Design ${o.designNo} · ${o.quantity} pcs × ${o.rate.toLocaleString('en-US')}`, debit: orderTotal(o), credit: 0 });
    if (o.advance) rows.push({ key: `a${o.id}`, date: o.date, detail: `Advance — Order ${o.orderNo}`, debit: 0, credit: o.advance });
  }
  const orderNo = new Map(db.orders.map((o) => [o.id, o.orderNo]));
  for (const p of db.payments) {
    if (p.customerId !== customerId) continue;
    rows.push({ key: `p${p.id}`, date: p.date, detail: `Payment received${p.orderId ? ` — Order ${orderNo.get(p.orderId) ?? ''}` : ''}${p.note ? ` (${p.note})` : ''}`, debit: 0, credit: p.amount });
  }
  return running(rows);
}

/** Supplier khata: purchases as bills, payments as paid. */
export function supplierLedger(db: DB, supplierId: string): LedgerRow[] {
  const items = byId(db.items);
  const rows: Omit<LedgerRow, 'balance'>[] = [];
  for (const p of db.purchases) {
    if (p.supplierId !== supplierId) continue;
    const it = items.get(p.itemId);
    rows.push({ key: `u${p.id}`, date: p.date, detail: `${it ? `${it.name} ${it.type} (${it.code})` : 'Item'} · ${p.qty} × ${p.rate}${p.billNo ? ` · Bill ${p.billNo}` : ''}`, debit: purchaseAmount(p), credit: 0 });
    if (p.paid) rows.push({ key: `x${p.id}`, date: p.date, detail: 'Paid with purchase', debit: 0, credit: p.paid });
  }
  for (const p of db.supplierPayments) {
    if (p.supplierId !== supplierId) continue;
    rows.push({ key: `s${p.id}`, date: p.date, detail: `Payment${p.note ? ` (${p.note})` : ''}`, debit: 0, credit: p.amount });
  }
  return running(rows);
}

function running(rows: Omit<LedgerRow, 'balance'>[]): LedgerRow[] {
  let bal = 0;
  return rows
    .map((r, i) => ({ r, i }))
    .sort((a, b) => a.r.date.localeCompare(b.r.date) || a.i - b.i)
    .map(({ r }) => {
      bal += r.debit - r.credit;
      return { ...r, balance: bal };
    });
}
