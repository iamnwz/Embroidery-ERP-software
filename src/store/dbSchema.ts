// How each part of the app's data maps to a Supabase table.
// The order matters: parents come before children (used for saving and deleting in the right order).

import type { DB } from '../types';

export type Collection = Exclude<keyof DB, 'settings'>;

export interface TableDef {
  key: Collection;
  table: string;
  /** database columns (snake_case) besides id */
  cols: string[];
  /** columns that are numbers (Postgres numeric can come back as text) */
  nums?: string[];
}

export const TABLES: TableDef[] = [
  { key: 'customers', table: 'customers', cols: ['name', 'phone', 'city', 'notes'] },
  { key: 'suppliers', table: 'suppliers', cols: ['name', 'phone', 'city', 'notes'] },
  { key: 'machines', table: 'machines', cols: ['name'] },
  { key: 'employees', table: 'employees', cols: ['name', 'designation', 'phone', 'salary', 'active', 'notes'], nums: ['salary'] },
  { key: 'items', table: 'items', cols: ['category', 'name', 'type', 'code', 'unit', 'opening_qty', 'rate', 'min_qty'], nums: ['opening_qty', 'rate', 'min_qty'] },
  {
    key: 'orders',
    table: 'orders',
    cols: ['order_no', 'customer_id', 'date', 'design_no', 'garment', 'reference_image', 'quantity', 'rate', 'advance', 'delivery_date', 'status', 'notes'],
    nums: ['quantity', 'rate', 'advance'],
  },
  { key: 'payments', table: 'payments', cols: ['customer_id', 'order_id', 'date', 'amount', 'note'], nums: ['amount'] },
  { key: 'purchases', table: 'purchases', cols: ['date', 'supplier_id', 'item_id', 'qty', 'rate', 'paid', 'bill_no', 'notes'], nums: ['qty', 'rate', 'paid'] },
  { key: 'stock', table: 'stock', cols: ['item_id', 'date', 'type', 'qty', 'note', 'purchase_id'], nums: ['qty'] },
  { key: 'supplierPayments', table: 'supplier_payments', cols: ['supplier_id', 'date', 'amount', 'note'], nums: ['amount'] },
  { key: 'production', table: 'production', cols: ['date', 'machine_id', 'order_id', 'design_no', 'operator_id', 'quantity', 'notes'], nums: ['quantity'] },
  { key: 'salaries', table: 'salaries', cols: ['employee_id', 'month', 'salary', 'bonus', 'advance', 'deduction', 'paid', 'note'], nums: ['salary', 'bonus', 'advance', 'deduction'] },
  { key: 'expenses', table: 'expenses', cols: ['date', 'title', 'category', 'amount', 'notes'], nums: ['amount'] },
];

const camel = (s: string) => s.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());

/** App record → database row (missing optional values become null so they are cleared in the database) */
export function toRow(def: TableDef, rec: Record<string, unknown>): Record<string, unknown> {
  const row: Record<string, unknown> = { id: rec.id };
  for (const c of def.cols) {
    const v = rec[camel(c)];
    row[c] = v === undefined ? null : v;
  }
  return row;
}

/** Database row → app record (nulls are left out, numbers are numbers) */
export function fromRow<T>(def: TableDef, row: Record<string, unknown>): T {
  const rec: Record<string, unknown> = { id: row.id };
  for (const c of def.cols) {
    let v = row[c];
    if (v === null || v === undefined) continue;
    if (def.nums?.includes(c) && typeof v === 'string') v = Number(v);
    rec[camel(c)] = v;
  }
  return rec as T;
}
