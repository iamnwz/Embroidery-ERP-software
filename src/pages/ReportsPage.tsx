import { useMemo, useState } from 'react';
import { Printer, Download, ChevronLeft, ChevronRight } from 'lucide-react';
import { Chips, PageHeader, Sheet } from '../components/ui';
import { MonthExportButton } from '../components/MonthExport';
import { useStore } from '../store/store';
import {
  byId,
  customerAccounts,
  laterPaymentsByOrder,
  lowStock,
  monthHisab,
  orderBalance,
  orderTotal,
  purchaseAmount,
  salaryNet,
  stockForMonth,
  supplierAccounts,
} from '../store/selectors';
import { INVENTORY_CATEGORIES } from '../config';
import { addDays, addMonths, currentMonth, fmtDate, fmtMonth, fmtShort, num, pctChange, today } from '../lib/format';
import { downloadCSV } from '../lib/files';
import { useLinkParams } from '../lib/useParams';
import type { DB } from '../types';

type ReportId = 'hisab' | 'daily' | 'expenses' | 'customers' | 'suppliers' | 'stock' | 'low' | 'moves' | 'production' | 'salaries' | 'orders' | 'purchases';
/** text | number | money (red when negative) | date | month | percent change */
type Kind = 'text' | 'num' | 'money' | 'date' | 'month' | 'pct';
type Cell = string | number | null;
interface Report {
  title: string;
  period: 'month' | 'year' | 'now';
  cols: { label: string; kind?: Kind; total?: boolean }[];
  rows: Cell[][];
  note?: string;
}

const REPORTS: { id: ReportId; label: string }[] = [
  { id: 'hisab', label: 'Monthly hisab' },
  { id: 'daily', label: 'Daily sales' },
  { id: 'expenses', label: 'Expenses' },
  { id: 'customers', label: 'Customer balances' },
  { id: 'suppliers', label: 'Supplier balances' },
  { id: 'stock', label: 'Current stock' },
  { id: 'low', label: 'Low stock' },
  { id: 'moves', label: 'Stock movement' },
  { id: 'production', label: 'Production' },
  { id: 'salaries', label: 'Salaries' },
  { id: 'orders', label: 'Orders' },
  { id: 'purchases', label: 'Purchases' },
];

function build(id: ReportId, db: DB, month: string): Report {
  const inMonth = (d: string) => d.slice(0, 7) === month;
  const custs = byId(db.customers);
  const items = byId(db.items);
  const itemName = (itemId: string) => {
    const it = items.get(itemId);
    return it ? `${it.name} ${it.type}` : '';
  };
  switch (id) {
    case 'hisab': {
      // 12 months ending with the chosen month
      const months = Array.from({ length: 12 }, (_, i) => addMonths(month, i - 11));
      const hs = months.map((m) => monthHisab(db, m));
      return {
        title: 'Monthly hisab (last 12 months)',
        period: 'year',
        cols: [
          { label: 'Month', kind: 'month' },
          { label: 'Orders', kind: 'num', total: true },
          { label: 'Sales', kind: 'money', total: true },
          { label: 'Sales vs last month', kind: 'pct' },
          { label: 'Received', kind: 'money', total: true },
          { label: 'Purchases', kind: 'money', total: true },
          { label: 'Salaries', kind: 'money', total: true },
          { label: 'Expenses', kind: 'money', total: true },
          { label: 'Total spending', kind: 'money', total: true },
          { label: 'Profit / Loss', kind: 'money', total: true },
        ],
        rows: months
          .map((m, i) => {
            const h = hs[i];
            const prev = i > 0 ? hs[i - 1].sales : monthHisab(db, addMonths(m, -1)).sales;
            return [m, h.orders, h.sales, pctChange(h.sales, prev), h.received, h.purchases, h.salaries, h.expenses, h.spending, h.profit] as Cell[];
          })
          .filter((r) => (r[1] as number) || (r[8] as number) || (r[4] as number))
          .reverse(),
        note: 'Sales = orders booked in the month. Spending = purchases + salaries (from the salary sheet) + expenses. Profit = Sales − Spending.',
      };
    }
    case 'daily': {
      const start = `${month}-01`;
      const end = month === currentMonth() ? today() : addDays(`${addMonths(month, 1)}-01`, -1);
      const rows: Cell[][] = [];
      for (let d = start; d <= end; d = addDays(d, 1)) {
        const orders = db.orders.filter((o) => o.date === d && o.status !== 'Cancelled');
        const sales = orders.reduce((s, o) => s + orderTotal(o), 0);
        const received = orders.reduce((s, o) => s + (o.advance || 0), 0) + db.payments.filter((p) => p.date === d).reduce((s, p) => s + p.amount, 0);
        const spent = db.purchases.filter((p) => p.date === d).reduce((s, p) => s + purchaseAmount(p), 0) + db.expenses.filter((e) => e.date === d).reduce((s, e) => s + e.amount, 0);
        const pcs = db.production.filter((p) => p.date === d).reduce((s, p) => s + p.quantity, 0);
        if (orders.length || received || spent || pcs) rows.push([d, orders.length, sales, received, spent, pcs]);
      }
      return {
        title: 'Daily sales',
        period: 'month',
        cols: [{ label: 'Date', kind: 'date' }, { label: 'Orders', kind: 'num', total: true }, { label: 'Sales', kind: 'money', total: true }, { label: 'Money received', kind: 'money', total: true }, { label: 'Spent (purchases + expenses)', kind: 'money', total: true }, { label: 'Production (pcs)', kind: 'num', total: true }],
        rows: rows.reverse(),
        note: 'Only days with some activity are shown. Salaries are not daily, so they are not included here.',
      };
    }
    case 'expenses':
      return {
        title: 'Expenses',
        period: 'month',
        cols: [{ label: 'Date', kind: 'date' }, { label: 'Expense' }, { label: 'Category' }, { label: 'Amount', kind: 'money', total: true }, { label: 'Notes' }],
        rows: db.expenses
          .filter((e) => inMonth(e.date))
          .sort((a, b) => a.date.localeCompare(b.date))
          .map((e) => [e.date, e.title, e.category, e.amount, e.notes ?? '']),
      };
    case 'customers': {
      const acc = customerAccounts(db);
      return {
        title: 'Customer balances',
        period: 'now',
        cols: [{ label: 'Customer' }, { label: 'Phone' }, { label: 'City' }, { label: 'Total billed', kind: 'money', total: true }, { label: 'Received', kind: 'money', total: true }, { label: 'Balance', kind: 'money', total: true }],
        rows: db.customers.map((c) => [c.name, c.phone ?? '', c.city ?? '', acc.get(c.id)!.total, acc.get(c.id)!.paid, acc.get(c.id)!.balance] as Cell[]).sort((a, b) => (b[5] as number) - (a[5] as number)),
      };
    }
    case 'suppliers': {
      const acc = supplierAccounts(db);
      return {
        title: 'Supplier balances',
        period: 'now',
        cols: [{ label: 'Supplier' }, { label: 'Phone' }, { label: 'City' }, { label: 'Amount', kind: 'money', total: true }, { label: 'Paid', kind: 'money', total: true }, { label: 'Remaining', kind: 'money', total: true }],
        rows: db.suppliers.map((s) => [s.name, s.phone ?? '', s.city ?? '', acc.get(s.id)!.total, acc.get(s.id)!.paid, acc.get(s.id)!.balance] as Cell[]).sort((a, b) => (b[5] as number) - (a[5] as number)),
      };
    }
    case 'stock': {
      const lines = stockForMonth(db, month);
      const cats = [...new Set([...INVENTORY_CATEGORIES, ...db.items.map((i) => i.category)])];
      const next = `${addMonths(month, 1)}-01`;
      return {
        title: 'Stock statement',
        period: 'month',
        cols: [{ label: 'Category' }, { label: 'Item' }, { label: 'Type' }, { label: 'Code' }, { label: 'Opening', kind: 'num' }, { label: 'IN', kind: 'num' }, { label: 'OUT', kind: 'num' }, { label: 'Closing', kind: 'num' }, { label: 'Rate', kind: 'num' }, { label: 'Amount', kind: 'money', total: true }],
        rows: [...db.items]
          .sort((a, b) => cats.indexOf(a.category) - cats.indexOf(b.category) || a.name.localeCompare(b.name))
          .map((i) => {
            const l = lines.get(i.id)!;
            // closing at the end of the chosen month (ignores entries dated later)
            const after = db.stock.filter((s) => s.itemId === i.id && s.date >= next).reduce((a, s) => a + (s.type === 'IN' ? s.qty : -s.qty), 0);
            const closing = l.balance - after;
            return [i.category, i.name, i.type, i.code, l.opening, l.in, l.out, closing, i.rate, closing * i.rate];
          }),
        note: 'Opening + IN − OUT = Closing.',
      };
    }
    case 'low':
      return {
        title: 'Low stock',
        period: 'now',
        cols: [{ label: 'Category' }, { label: 'Item' }, { label: 'Type' }, { label: 'Code' }, { label: 'Balance', kind: 'num' }, { label: 'Alert at', kind: 'num' }, { label: 'Short by', kind: 'num' }, { label: 'Rate', kind: 'num' }],
        rows: lowStock(db).map(({ item, qty }) => [item.category, item.name, item.type, item.code, qty, item.minQty ?? 0, Math.max(0, (item.minQty ?? 0) - qty), item.rate]),
        note: 'Items at or below their “low stock alert” level. Set the level on each item (Inventory → click item → Edit item).',
      };
    case 'moves':
      return {
        title: 'Stock movement (IN / OUT)',
        period: 'month',
        cols: [{ label: 'Date', kind: 'date' }, { label: 'Category' }, { label: 'Item' }, { label: 'Code' }, { label: 'IN', kind: 'num', total: true }, { label: 'OUT', kind: 'num', total: true }, { label: 'Detail' }],
        rows: db.stock
          .filter((s) => inMonth(s.date))
          .sort((a, b) => a.date.localeCompare(b.date))
          .map((s) => [s.date, items.get(s.itemId)?.category ?? '', itemName(s.itemId), items.get(s.itemId)?.code ?? '', s.type === 'IN' ? s.qty : null, s.type === 'OUT' ? s.qty : null, s.note ?? '']),
      };
    case 'production': {
      // one row per day, one column per machine (like a production register)
      const list = db.production.filter((p) => inMonth(p.date));
      const days = [...new Set(list.map((p) => p.date))].sort();
      return {
        title: 'Production (day by day)',
        period: 'month',
        cols: [{ label: 'Date', kind: 'date' }, ...db.machines.map((m) => ({ label: m.name, kind: 'num' as Kind, total: true })), { label: 'Total', kind: 'num', total: true }],
        rows: days.map((d) => {
          const day = list.filter((p) => p.date === d);
          return [d, ...db.machines.map((m) => day.filter((p) => p.machineId === m.id).reduce((s, p) => s + p.quantity, 0) || null), day.reduce((s, p) => s + p.quantity, 0)];
        }),
      };
    }
    case 'salaries': {
      const emp = byId(db.employees);
      return {
        title: 'Salaries / payable',
        period: 'month',
        cols: [{ label: 'Employee' }, { label: 'Designation' }, { label: 'Monthly salary', kind: 'money', total: true }, { label: 'Bonus', kind: 'money', total: true }, { label: 'Advance', kind: 'money', total: true }, { label: 'Deduction', kind: 'money', total: true }, { label: 'Payable', kind: 'money', total: true }, { label: 'Paid' }],
        rows: db.salaries
          .filter((s) => s.month === month)
          .map((s) => [emp.get(s.employeeId)?.name ?? '', emp.get(s.employeeId)?.designation ?? '', s.salary, s.bonus, s.advance, s.deduction, salaryNet(s), s.paid ? 'Paid' : 'Unpaid']),
        note: 'If this is empty, make the salary sheet first (Employees / Salaries → Salaries).',
      };
    }
    case 'orders': {
      const later = laterPaymentsByOrder(db);
      return {
        title: 'Orders',
        period: 'month',
        cols: [{ label: 'Order No.' }, { label: 'Date', kind: 'date' }, { label: 'Customer' }, { label: 'Design' }, { label: 'Garment' }, { label: 'Qty', kind: 'num', total: true }, { label: 'Total', kind: 'money', total: true }, { label: 'Advance', kind: 'money', total: true }, { label: 'Paid later', kind: 'money', total: true }, { label: 'Balance', kind: 'money', total: true }, { label: 'Status' }],
        rows: db.orders
          .filter((o) => inMonth(o.date))
          .sort((a, b) => a.date.localeCompare(b.date))
          .map((o) => {
            const c = o.status === 'Cancelled';
            return [o.orderNo, o.date, custs.get(o.customerId)?.name ?? '', o.designNo, o.garment ?? '', o.quantity, c ? 0 : orderTotal(o), c ? 0 : o.advance, c ? 0 : later.get(o.id) || 0, orderBalance(o, later), o.status];
          }),
      };
    }
    case 'purchases': {
      const sups = byId(db.suppliers);
      return {
        title: 'Purchases',
        period: 'month',
        cols: [{ label: 'Date', kind: 'date' }, { label: 'Supplier' }, { label: 'Item' }, { label: 'Qty', kind: 'num' }, { label: 'Rate', kind: 'num' }, { label: 'Amount', kind: 'money', total: true }, { label: 'Paid', kind: 'money', total: true }, { label: 'Remaining', kind: 'money', total: true }],
        rows: db.purchases
          .filter((p) => inMonth(p.date))
          .sort((a, b) => a.date.localeCompare(b.date))
          .map((p) => [p.date, sups.get(p.supplierId)?.name ?? '', `${itemName(p.itemId)} (${items.get(p.itemId)?.code ?? ''})`, p.qty, p.rate, purchaseAmount(p), p.paid, purchaseAmount(p) - p.paid]),
      };
    }
  }
}

export default function ReportsPage() {
  const db = useStore();
  const [id, setId] = useState<ReportId>('hisab');
  const [month, setMonth] = useState(currentMonth());
  useLinkParams(['r'], (p) => {
    const r = p.get('r') as ReportId;
    if (REPORTS.some((x) => x.id === r)) setId(r);
  });
  const r = useMemo(() => build(id, db, month), [id, db, month]);

  const show = (v: Cell, k?: Kind) => {
    if (v === null || v === '') return k === 'pct' ? <span className="muted">—</span> : '';
    switch (k) {
      case 'num':
        return num(v as number, 2);
      case 'money':
        return <span className={(v as number) < 0 ? 'text-danger' : ''}>{num(v as number)}</span>;
      case 'date':
        return <span className="nowrap">{fmtShort(String(v))}</span>;
      case 'month':
        return <span className="nowrap strong">{fmtMonth(String(v))}</span>;
      case 'pct': {
        const n = Math.round(v as number);
        if (n === 0) return <span className="muted">same</span>;
        return <span className={n > 0 ? 'up-good' : 'up-bad'}>{n > 0 ? '▲' : '▼'} {Math.abs(n)}%</span>;
      }
      default:
        return v;
    }
  };
  const rows = r.rows.map((cells, i) => ({ id: String(i), cells }));
  const periodText = r.period === 'month' ? fmtMonth(month) : r.period === 'year' ? `up to ${fmtMonth(month)}` : `as of ${fmtDate(today())}`;

  const exportCSV = () =>
    downloadCSV(
      `${id}-${r.period === 'now' ? today() : month}.csv`,
      r.cols.map((c) => c.label),
      r.rows.map((row) => row.map((v, j) => (v === null ? '' : r.cols[j].kind === 'pct' ? `${Math.round(v as number)}%` : r.cols[j].kind === 'month' ? fmtMonth(String(v)) : v))),
    );

  return (
    <>
      <PageHeader
        title="Reports"
        actions={
          <>
            <button className="btn" onClick={() => window.print()}><Printer size={16} /> Print</button>
            <button className="btn" onClick={exportCSV} title="Save only the report shown below (CSV, opens in Excel)"><Download size={16} /> This report</button>
            <MonthExportButton primary label="Month-end Excel (all tabs)" />
          </>
        }
      />
      <div className="toolbar tabs-line">
        <Chips options={REPORTS} value={id} onChange={setId} />
      </div>
      <div className="toolbar">
        {r.period !== 'now' ? (
          <div className="row" style={{ flexWrap: 'nowrap' }}>
            <button className="icon-btn" onClick={() => setMonth(addMonths(month, -1))} aria-label="Previous month"><ChevronLeft size={18} /></button>
            <strong style={{ minWidth: 130, textAlign: 'center' }}>{fmtMonth(month)}</strong>
            <button className="icon-btn" onClick={() => setMonth(addMonths(month, 1))} aria-label="Next month"><ChevronRight size={18} /></button>
          </div>
        ) : (
          <strong>As of {fmtDate(today())}</strong>
        )}
      </div>
      <h2 className="section-title" style={{ fontSize: 16 }}>
        {db.settings.factoryName} — {r.title} — {periodText}
      </h2>
      <Sheet
        cols={r.cols.map((c, j) => ({
          label: c.label,
          num: c.kind === 'num' || c.kind === 'money' || c.kind === 'pct',
          cell: (row: { cells: Cell[] }) => show(row.cells[j], c.kind),
          total: c.total ? (l: { cells: Cell[] }[]) => show(l.reduce((s, x) => s + (Number(x.cells[j]) || 0), 0), c.kind) : undefined,
        }))}
        rows={rows}
        empty="Nothing to show for this period"
      />
      {r.note && <p className="hint-line">{r.note}</p>}
    </>
  );
}
