// All data lives here and is saved in this browser (localStorage).
// To move to a server/database later, only this file needs to change.

import { create } from 'zustand';
import { persist, createJSONStorage, type StateStorage } from 'zustand/middleware';
import type { DB, Purchase } from '../types';
import { buildSeed } from '../data/seed';
import { uid } from '../lib/format';
import { notify } from '../components/ui/toast';

type Collection = Exclude<keyof DB, 'settings'>;
type Item<K extends Collection> = DB[K][number];

export interface Actions {
  /** Add or update a record */
  save<K extends Collection>(key: K, record: Item<K>): void;
  remove<K extends Collection>(key: K, id: string): void;
  updateSettings(patch: Partial<DB['settings']>): void;

  /** Saving a purchase also adds it to stock (IN) */
  savePurchase(p: Purchase): void;
  deletePurchase(id: string): void;
  deleteOrder(id: string): void;
  /** Adds a salary row for every active employee who doesn't have one this month */
  createSalarySheet(month: string): number;

  resetDemo(): void;
  clearAll(): void;
  importData(db: DB): void;
}

export type Store = DB & Actions;

const emptyDB = (): DB => ({
  settings: { factoryName: 'My Embroidery Factory' },
  customers: [],
  orders: [],
  payments: [],
  machines: [],
  production: [],
  items: [],
  stock: [],
  suppliers: [],
  purchases: [],
  supplierPayments: [],
  employees: [],
  salaries: [],
  expenses: [],
});

const dataOnly = (s: Store): DB => {
  const db = emptyDB();
  for (const k of Object.keys(db) as (keyof DB)[]) (db as any)[k] = (s as any)[k];
  return db;
};

const safeStorage: StateStorage = {
  getItem: (k) => localStorage.getItem(k),
  setItem: (k, v) => {
    try {
      localStorage.setItem(k, v);
    } catch {
      notify('Storage is full — the last change may not be saved. Remove some images or export a backup.', 'error');
    }
  },
  removeItem: (k) => localStorage.removeItem(k),
};

const upsert = <T extends { id: string }>(list: T[], rec: T) =>
  list.some((x) => x.id === rec.id) ? list.map((x) => (x.id === rec.id ? rec : x)) : [...list, rec];

export const useStore = create<Store>()(
  persist(
    (set, get) => ({
      ...buildSeed(),

      save: (key, record) => set((s) => ({ [key]: upsert(s[key] as any[], record as any) }) as Partial<Store>),
      remove: (key, id) => set((s) => ({ [key]: (s[key] as any[]).filter((x) => x.id !== id) }) as Partial<Store>),
      updateSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),

      savePurchase: (p) =>
        set((s) => ({
          purchases: upsert(s.purchases, p),
          stock: [
            ...s.stock.filter((x) => x.purchaseId !== p.id),
            { id: uid(), itemId: p.itemId, date: p.date, type: 'IN' as const, qty: p.qty, note: `Purchase from ${s.suppliers.find((x) => x.id === p.supplierId)?.name ?? 'supplier'}`, purchaseId: p.id },
          ],
          items: s.items.map((i) => (i.id === p.itemId && p.rate > 0 ? { ...i, rate: p.rate } : i)),
        })),

      deletePurchase: (id) =>
        set((s) => ({ purchases: s.purchases.filter((x) => x.id !== id), stock: s.stock.filter((x) => x.purchaseId !== id) })),

      deleteOrder: (id) =>
        set((s) => ({
          orders: s.orders.filter((x) => x.id !== id),
          payments: s.payments.map((p) => (p.orderId === id ? { ...p, orderId: undefined } : p)),
          production: s.production.map((p) => (p.orderId === id ? { ...p, orderId: undefined } : p)),
        })),

      createSalarySheet: (month) => {
        const s = get();
        const have = new Set(s.salaries.filter((x) => x.month === month).map((x) => x.employeeId));
        const rows = s.employees
          .filter((e) => e.active && !have.has(e.id))
          .map((e) => ({ id: uid(), employeeId: e.id, month, salary: e.salary, bonus: 0, advance: 0, deduction: 0, paid: false }));
        if (rows.length) set((st) => ({ salaries: [...st.salaries, ...rows] }));
        return rows.length;
      },

      resetDemo: () => set(() => ({ ...buildSeed() })),
      clearAll: () => set(() => ({ ...emptyDB(), settings: get().settings })),
      importData: (db) => set(() => ({ ...emptyDB(), ...db })),
    }),
    {
      name: 'embroidery-erp-v3',
      version: 3,
      storage: createJSONStorage(() => safeStorage),
      partialize: (s) => dataOnly(s),
    },
  ),
);

export const getDB = (): DB => dataOnly(useStore.getState());
