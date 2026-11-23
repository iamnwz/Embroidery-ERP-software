// Month-end Excel workbook (.xlsx) — the whole month's hisaab-kitaab in one tidy file.
// Every sheet: title, month, a green header row, thin grid lines, totals with SUM formulas,
// frozen header, filter buttons and print setup. Calculated columns are real Excel formulas
// (with their values stored too), so the file still adds up if a number is changed in Excel.

import ExcelJS from 'exceljs';
import type { DB } from '../types';
import { byId, expensesByCategory, monthHisab, purchaseAmount } from '../store/selectors';
import { INVENTORY_CATEGORIES } from '../config';
import { addDays, addMonths, fmtDate, fmtMonth, today } from './format';

/* ---------- look ---------- */
const FONT = 'Arial';
const GREEN = 'FF1E7145';
const GREEN_SOFT = 'FFEAF4EE';
const ZEBRA = 'FFF7F9F8';
const GRID = 'FFD5DBD8';
const GREY_TEXT = 'FF6B7370';
const RED = 'FFC0362C';
const MONEY = '#,##0;[Red]-#,##0';
const INT = '#,##0';
const DEC = '#,##0.00';
const DATE = 'dd-mmm-yyyy';

type Kind = 'text' | 'int' | 'qty' | 'money' | 'date';
/** A formula cell: `f` builds the formula for its row number, `v` is the value we already know. */
interface F {
  f: (row: number) => string;
  v: number | string;
}
type V = string | number | null | undefined | F;
interface ColDef {
  header: string;
  kind?: Kind;
  total?: boolean;
}
interface TableOpts {
  title?: string;
  cols: ColDef[];
  rows: V[][];
  empty?: string;
  filter?: boolean; // add filter buttons (one table per sheet)
  freeze?: boolean; // keep the header visible when scrolling
  rowStyle?: (i: number) => { red?: boolean } | undefined;
}

const isF = (v: V): v is F => typeof v === 'object' && v !== null && 'f' in v;
export const colLetter = (n: number) => {
  let s = '';
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
};
const excelDate = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
};
const thin = (argb = GRID) => ({ style: 'thin' as const, color: { argb } });

/** Writes title + tables down a worksheet, keeping track of the current row. */
class SheetWriter {
  row = 1;
  headerRows: number[] = [];
  ws: ExcelJS.Worksheet;
  widths: number[];
  constructor(ws: ExcelJS.Worksheet, widths: number[]) {
    this.ws = ws;
    this.widths = widths;
    widths.forEach((w, i) => (ws.getColumn(i + 1).width = w));
  }

  title(title: string, subtitle: string) {
    const t = this.ws.getCell(this.row, 1);
    t.value = title;
    t.font = { name: FONT, size: 15, bold: true, color: { argb: GREEN } };
    this.ws.getRow(this.row).height = 24;
    this.row++;
    const s = this.ws.getCell(this.row, 1);
    s.value = subtitle;
    s.font = { name: FONT, size: 10, color: { argb: GREY_TEXT } };
    this.row += 2;
  }

  note(text: string) {
    const c = this.ws.getCell(this.row, 1);
    c.value = text;
    c.font = { name: FONT, size: 9, italic: true, color: { argb: GREY_TEXT } };
    this.row++;
  }

  gap(n = 1) {
    this.row += n;
  }

  table(o: TableOpts) {
    const ws = this.ws;
    const n = o.cols.length;
    if (o.title) {
      const c = ws.getCell(this.row, 1);
      c.value = o.title;
      c.font = { name: FONT, size: 11, bold: true, color: { argb: 'FF1A1E1C' } };
      this.row++;
    }
    // header
    const hr = this.row;
    this.headerRows.push(hr);
    o.cols.forEach((col, i) => {
      const c = ws.getCell(hr, i + 1);
      c.value = col.header;
      c.font = { name: FONT, size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GREEN } };
      c.alignment = { vertical: 'middle', horizontal: col.kind && col.kind !== 'text' ? 'right' : 'left', wrapText: true, indent: col.kind && col.kind !== 'text' ? 0 : 1 };
      c.border = { top: thin(GREEN), bottom: thin(GREEN), left: thin(GREEN), right: thin(GREEN) };
    });
    // tall enough for headers that wrap onto a second (or third) line
    const lines = Math.max(1, ...o.cols.map((col, i) => Math.ceil((col.header.length * 1.1) / Math.max(4, (this.widths[i] ?? 10) - 2))));
    ws.getRow(hr).height = lines > 1 ? 14 * lines + 6 : 22;
    this.row++;

    const first = this.row;
    if (o.rows.length === 0) {
      const c = ws.getCell(this.row, 1);
      c.value = o.empty ?? 'No records for this month';
      c.font = { name: FONT, size: 10, italic: true, color: { argb: GREY_TEXT } };
      ws.mergeCells(this.row, 1, this.row, n);
      c.alignment = { horizontal: 'center', vertical: 'middle' };
      c.border = { bottom: thin(), left: thin(), right: thin() };
      ws.getRow(this.row).height = 22;
      this.row++;
      return { header: hr, first, last: first - 1, total: 0 };
    }

    o.rows.forEach((vals, i) => {
      const r = this.row;
      const red = o.rowStyle?.(i)?.red;
      o.cols.forEach((col, j) => {
        const c = ws.getCell(r, j + 1);
        const v = vals[j];
        const kind = col.kind ?? 'text';
        // whole numbers typed as text (order no. 1001, design 120) are stored as numbers,
        // otherwise Excel marks them with a green "number stored as text" warning
        const plainNumber = kind === 'text' && typeof v === 'string' && /^[1-9]\d{0,13}$/.test(v);
        if (isF(v)) c.value = { formula: v.f(r), result: v.v } as ExcelJS.CellFormulaValue;
        else if (v === null || v === undefined || v === '') c.value = null;
        else if (kind === 'date' && typeof v === 'string') c.value = excelDate(v);
        else if (plainNumber) c.value = Number(v);
        else c.value = v;
        const known = isF(v) ? v.v : v;
        c.numFmt = kind === 'money' ? MONEY : kind === 'int' ? INT : kind === 'date' ? DATE : kind === 'qty' ? (typeof known === 'number' && !Number.isInteger(known) ? DEC : INT) : plainNumber ? '0' : 'General';
        c.font = { name: FONT, size: 10, color: red ? { argb: RED } : undefined, bold: red ? true : undefined };
        c.alignment = { vertical: 'middle', horizontal: kind === 'text' ? 'left' : 'right', indent: kind === 'text' ? 1 : 0 };
        c.border = { bottom: thin(), left: thin(), right: thin() };
        if (i % 2 === 1) c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ZEBRA } };
      });
      ws.getRow(r).height = 18;
      this.row++;
    });
    const last = this.row - 1;

    // totals row with SUM formulas
    let total = 0;
    if (o.cols.some((c) => c.total)) {
      total = this.row;
      o.cols.forEach((col, j) => {
        const c = ws.getCell(total, j + 1);
        if (col.total) {
          const L = colLetter(j + 1);
          const sum = o.rows.reduce((s, vals) => {
            const v = vals[j];
            const x = isF(v) ? v.v : v;
            return s + (typeof x === 'number' ? x : 0);
          }, 0);
          c.value = { formula: `SUM(${L}${first}:${L}${last})`, result: sum } as ExcelJS.CellFormulaValue;
          c.numFmt = col.kind === 'money' ? MONEY : col.kind === 'qty' && !Number.isInteger(sum) ? DEC : INT;
          c.alignment = { horizontal: 'right', vertical: 'middle' };
        } else if (j === 0) {
          c.value = 'Total';
          c.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
        }
        c.font = { name: FONT, size: 10, bold: true };
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GREEN_SOFT } };
        c.border = { top: { style: 'medium', color: { argb: GREEN } }, bottom: thin(GREEN), left: thin(), right: thin() };
      });
      ws.getRow(total).height = 20;
      this.row++;
    }

    if (o.filter) ws.autoFilter = { from: { row: hr, column: 1 }, to: { row: last, column: n } };
    if (o.freeze) ws.views = [{ state: 'frozen', ySplit: hr, xSplit: 0, topLeftCell: `A${hr + 1}`, activeCell: `A${hr + 1}`, showGridLines: false }];
    return { header: hr, first, last, total };
  }

  finish(printTitle: string) {
    const ws = this.ws;
    if (!ws.views?.length) ws.views = [{ showGridLines: false }];
    ws.pageSetup = {
      orientation: 'landscape',
      paperSize: 9, // A4
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.3, footer: 0.3 },
      printTitlesRow: this.headerRows.length ? `${this.headerRows[0]}:${this.headerRows[0]}` : undefined,
    };
    ws.headerFooter = { oddFooter: `&L&8${printTitle.replace(/&/g, '&&')}&R&8Page &P of &N` };
  }
}

/* ---------- the workbook ---------- */

export function exportFileName(db: DB, month: string) {
  const name = (db.settings.factoryName || 'Factory').replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-');
  const [y, m] = month.split('-');
  return `Hisaab-${y}-${m}-${fmtMonth(month).split(' ')[0]}_${name}.xlsx`;
}

export async function buildMonthWorkbook(db: DB, month: string): Promise<ExcelJS.Workbook> {
  const factory = db.settings.factoryName || 'Factory';
  const monthName = fmtMonth(month);
  const start = `${month}-01`;
  const next = `${addMonths(month, 1)}-01`;
  const end = addDays(next, -1);
  const inMonth = (d: string) => d >= start && d < next;
  const upToEnd = (d: string) => d < next;
  const exported = `Exported ${fmtDate(today())}`;
  const sub = `${monthName}  ·  1 – ${Number(end.slice(8))} ${monthName.split(' ')[0]}  ·  ${exported}`;
  const footer = `${factory} — ${monthName}`;

  const custs = byId(db.customers);
  const sups = byId(db.suppliers);
  const items = byId(db.items);
  const machines = byId(db.machines);
  const emp = byId(db.employees);
  const orderById = byId(db.orders);

  const wb = new ExcelJS.Workbook();
  wb.creator = factory;
  wb.created = new Date();
  wb.title = `${factory} — Hisaab ${monthName}`;
  wb.calcProperties = { fullCalcOnLoad: true };

  const sheet = (name: string, widths: number[], tab?: string) => {
    const ws = wb.addWorksheet(name, { properties: { tabColor: tab ? { argb: tab } : undefined, defaultRowHeight: 18 } });
    return new SheetWriter(ws, widths);
  };

  // Sheets are created in tab order; the summary is filled last (it uses the other numbers).
  const sum = sheet('Hisaab Summary', [38, 20, 44], GREEN);

  /* ----- Orders ----- */
  const later = new Map<string, number>();
  for (const p of db.payments) if (p.orderId && upToEnd(p.date)) later.set(p.orderId, (later.get(p.orderId) || 0) + p.amount);
  const orders = db.orders.filter((o) => inMonth(o.date)).sort((a, b) => a.date.localeCompare(b.date) || a.orderNo.localeCompare(b.orderNo));
  {
    const w = sheet('Orders', [11, 13, 26, 10, 15, 9, 11, 14, 13, 13, 14, 13, 15, 34]);
    w.title(`${factory} — Orders`, sub);
    w.table({
      cols: [
        { header: 'Order No.' },
        { header: 'Date', kind: 'date' },
        { header: 'Customer' },
        { header: 'Design' },
        { header: 'Garment' },
        { header: 'Qty', kind: 'qty', total: true },
        { header: 'Rate (Rs)', kind: 'money' },
        { header: 'Total (Rs)', kind: 'money', total: true },
        { header: 'Advance (Rs)', kind: 'money', total: true },
        { header: 'Paid later (Rs)', kind: 'money', total: true },
        { header: 'Balance (Rs)', kind: 'money', total: true },
        { header: 'Delivery', kind: 'date' },
        { header: 'Status' },
        { header: 'Notes' },
      ],
      rows: orders.map((o) => {
        const cancelled = o.status === 'Cancelled';
        const total = cancelled ? 0 : o.quantity * o.rate;
        const pl = later.get(o.id) || 0;
        return [
          o.orderNo,
          o.date,
          custs.get(o.customerId)?.name ?? '',
          o.designNo,
          o.garment ?? '',
          o.quantity,
          o.rate,
          { f: (r) => `IF(M${r}="Cancelled",0,F${r}*G${r})`, v: total },
          o.advance || 0,
          pl,
          { f: (r) => `IF(M${r}="Cancelled",0,H${r}-I${r}-J${r})`, v: cancelled ? 0 : total - (o.advance || 0) - pl },
          o.deliveryDate,
          o.status,
          o.notes ?? '',
        ];
      }),
      empty: `No orders were booked in ${monthName}`,
      filter: true,
      freeze: true,
    });
    w.gap();
    w.note('Total = Qty × Rate (cancelled orders count as 0).  Balance = Total − Advance − Paid later (payments received up to the end of the month).');
    w.finish(footer);
  }

  /* ----- Production ----- */
  const prod = db.production.filter((p) => inMonth(p.date)).sort((a, b) => a.date.localeCompare(b.date) || (machines.get(a.machineId)?.name ?? '').localeCompare(machines.get(b.machineId)?.name ?? '', undefined, { numeric: true }));
  const pcs = prod.reduce((s, p) => s + p.quantity, 0);
  {
    const w = sheet('Production', [13, 16, 11, 26, 20, 13, 30]);
    w.title(`${factory} — Production`, sub);
    const t = w.table({
      cols: [{ header: 'Date', kind: 'date' }, { header: 'Machine' }, { header: 'Design' }, { header: 'Customer' }, { header: 'Operator' }, { header: 'Produced', kind: 'qty', total: true }, { header: 'Notes' }],
      rows: prod.map((p) => [p.date, machines.get(p.machineId)?.name ?? '', p.designNo, custs.get(orderById.get(p.orderId ?? '')?.customerId ?? '')?.name ?? '', p.operatorId ? emp.get(p.operatorId)?.name ?? '' : '', p.quantity, p.notes ?? '']),
      empty: `No production was entered in ${monthName}`,
      filter: true,
      freeze: true,
    });
    if (prod.length) {
      const range = (col: string) => `$${col}$${t.first}:$${col}$${t.last}`;
      w.gap();
      w.table({
        title: 'Total by machine',
        cols: [{ header: 'Machine' }, { header: 'Days worked', kind: 'int' }, { header: 'Entries', kind: 'int' }, { header: 'Produced', kind: 'qty', total: true }],
        rows: db.machines.map((m) => {
          const l = prod.filter((p) => p.machineId === m.id);
          return [m.name, new Set(l.map((p) => p.date)).size, l.length, { f: (r) => `SUMIF(${range('B')},A${r},${range('F')})`, v: l.reduce((s, p) => s + p.quantity, 0) }];
        }),
      });
      const ops = new Map<string, number>();
      for (const p of prod) if (p.operatorId) ops.set(p.operatorId, (ops.get(p.operatorId) || 0) + p.quantity);
      w.gap();
      w.table({
        title: 'Total by operator',
        cols: [{ header: 'Operator' }, { header: 'Produced', kind: 'qty', total: true }],
        rows: [...ops]
          .sort((a, b) => b[1] - a[1])
          .map(([id, qty]) => [emp.get(id)?.name ?? '', { f: (r: number) => `SUMIF(${range('E')},A${r},${range('F')})`, v: qty }]),
      });
    }
    w.finish(footer);
  }

  /* ----- Stock (opening + IN − OUT = closing, at month end) ----- */
  const cats = [...new Set([...INVENTORY_CATEGORIES, ...db.items.map((i) => i.category)])];
  const stockRows = [...db.items]
    .sort((a, b) => cats.indexOf(a.category) - cats.indexOf(b.category) || a.name.localeCompare(b.name) || a.code.localeCompare(b.code, undefined, { numeric: true }))
    .map((i) => {
      let opening = i.openingQty || 0;
      let inQ = 0;
      let outQ = 0;
      for (const s of db.stock) {
        if (s.itemId !== i.id) continue;
        if (s.date < start) opening += s.type === 'IN' ? s.qty : -s.qty;
        else if (s.date < next) s.type === 'IN' ? (inQ += s.qty) : (outQ += s.qty);
      }
      const closing = opening + inQ - outQ;
      const low = !!i.minQty && i.minQty > 0 && closing <= i.minQty;
      return { i, opening, inQ, outQ, closing, low };
    });
  const stockValue = stockRows.reduce((s, x) => s + x.closing * x.i.rate, 0);
  {
    const w = sheet('Stock', [11, 18, 15, 10, 9, 12, 11, 11, 12, 11, 15, 13, 10]);
    w.title(`${factory} — Stock (end of ${monthName})`, sub);
    w.table({
      cols: [
        { header: 'Category' },
        { header: 'Item' },
        { header: 'Type' },
        { header: 'Code' },
        { header: 'Unit' },
        { header: 'Opening', kind: 'qty' },
        { header: 'IN', kind: 'qty' },
        { header: 'OUT', kind: 'qty' },
        { header: 'Closing', kind: 'qty' },
        { header: 'Rate (Rs)', kind: 'money' },
        { header: 'Amount (Rs)', kind: 'money', total: true },
        { header: 'Low stock at', kind: 'qty' },
        { header: 'Status' },
      ],
      rows: stockRows.map((x) => [
        x.i.category,
        x.i.name,
        x.i.type,
        x.i.code,
        x.i.unit ?? '',
        x.opening,
        x.inQ,
        x.outQ,
        { f: (r) => `F${r}+G${r}-H${r}`, v: x.closing },
        x.i.rate,
        { f: (r) => `I${r}*J${r}`, v: x.closing * x.i.rate },
        x.i.minQty || null,
        { f: (r) => `IF(AND(L${r}>0,I${r}<=L${r}),"LOW","OK")`, v: x.low ? 'LOW' : 'OK' },
      ]),
      rowStyle: (k) => (stockRows[k].low ? { red: true } : undefined),
      empty: 'No stock items',
      filter: true,
      freeze: true,
    });
    w.gap();
    w.note('Opening = stock on 1st of the month.  Closing = Opening + IN − OUT.  Amount = Closing × Rate.  Rows in red are at or below their low-stock level.');
    w.finish(footer);
  }

  /* ----- Stock IN / OUT entries ----- */
  {
    const moves = db.stock.filter((s) => inMonth(s.date)).sort((a, b) => a.date.localeCompare(b.date));
    const w = sheet('Stock IN-OUT', [13, 11, 18, 15, 10, 11, 11, 42]);
    w.title(`${factory} — Stock IN / OUT entries`, sub);
    w.table({
      cols: [{ header: 'Date', kind: 'date' }, { header: 'Category' }, { header: 'Item' }, { header: 'Type' }, { header: 'Code' }, { header: 'IN', kind: 'qty' }, { header: 'OUT', kind: 'qty' }, { header: 'Detail' }],
      rows: moves.map((s) => {
        const it = items.get(s.itemId);
        return [s.date, it?.category ?? '', it?.name ?? '', it?.type ?? '', it?.code ?? '', s.type === 'IN' ? s.qty : null, s.type === 'OUT' ? s.qty : null, s.note ?? (s.type === 'IN' ? 'Stock in' : 'Stock out')];
      }),
      empty: `No stock came in or went out in ${monthName}`,
      filter: true,
      freeze: true,
    });
    w.finish(footer);
  }

  /* ----- Purchases ----- */
  {
    const list = db.purchases.filter((p) => inMonth(p.date)).sort((a, b) => a.date.localeCompare(b.date));
    const w = sheet('Purchases', [13, 24, 11, 22, 10, 10, 11, 14, 13, 14, 11, 26]);
    w.title(`${factory} — Purchases`, sub);
    w.table({
      cols: [
        { header: 'Date', kind: 'date' },
        { header: 'Supplier' },
        { header: 'Category' },
        { header: 'Item' },
        { header: 'Code' },
        { header: 'Qty', kind: 'qty' },
        { header: 'Rate (Rs)', kind: 'money' },
        { header: 'Amount (Rs)', kind: 'money', total: true },
        { header: 'Paid (Rs)', kind: 'money', total: true },
        { header: 'Remaining (Rs)', kind: 'money', total: true },
        { header: 'Bill No.' },
        { header: 'Notes' },
      ],
      rows: list.map((p) => {
        const it = items.get(p.itemId);
        const amt = purchaseAmount(p);
        return [p.date, sups.get(p.supplierId)?.name ?? '', it?.category ?? '', it ? `${it.name} ${it.type}` : '', it?.code ?? '', p.qty, p.rate, { f: (r) => `F${r}*G${r}`, v: amt }, p.paid || 0, { f: (r) => `H${r}-I${r}`, v: amt - (p.paid || 0) }, p.billNo ?? '', p.notes ?? ''];
      }),
      empty: `No purchases in ${monthName}`,
      filter: true,
      freeze: true,
    });
    w.gap();
    w.note('Amount = Qty × Rate.  Remaining = Amount − Paid (paid at the time of purchase; later payments are on the Suppliers sheet).');
    w.finish(footer);
  }

  /* ----- Customers: opening balance + billed − received = closing balance ----- */
  let toReceive = 0;
  {
    const rows = db.customers
      .map((c) => {
        let opening = 0;
        let billed = 0;
        let received = 0;
        for (const o of db.orders) {
          if (o.customerId !== c.id || o.status === 'Cancelled') continue;
          const amt = o.quantity * o.rate;
          if (o.date < start) opening += amt - (o.advance || 0);
          else if (o.date < next) {
            billed += amt;
            received += o.advance || 0;
          }
        }
        for (const p of db.payments) {
          if (p.customerId !== c.id) continue;
          if (p.date < start) opening -= p.amount;
          else if (p.date < next) received += p.amount;
        }
        return { c, opening, billed, received, closing: opening + billed - received };
      })
      .filter((x) => x.opening || x.billed || x.received)
      .sort((a, b) => b.closing - a.closing);
    toReceive = rows.reduce((s, x) => s + Math.max(0, x.closing), 0);
    const pays = [
      ...db.orders.filter((o) => inMonth(o.date) && o.status !== 'Cancelled' && o.advance).map((o) => ({ date: o.date, customer: custs.get(o.customerId)?.name ?? '', order: o.orderNo, kind: 'Advance', amount: o.advance })),
      ...db.payments.filter((p) => inMonth(p.date)).map((p) => ({ date: p.date, customer: custs.get(p.customerId)?.name ?? '', order: p.orderId ? orderById.get(p.orderId)?.orderNo ?? '' : '', kind: p.note ? `Payment (${p.note})` : 'Payment', amount: p.amount })),
    ].sort((a, b) => a.date.localeCompare(b.date));

    const w = sheet('Customers', [28, 16, 14, 18, 18, 18, 18]);
    w.title(`${factory} — Customer balances`, sub);
    w.table({
      cols: [
        { header: 'Customer' },
        { header: 'Phone' },
        { header: 'City' },
        { header: 'Opening balance (Rs)', kind: 'money', total: true },
        { header: `Billed in ${monthName.split(' ')[0]} (Rs)`, kind: 'money', total: true },
        { header: `Received in ${monthName.split(' ')[0]} (Rs)`, kind: 'money', total: true },
        { header: 'Closing balance (Rs)', kind: 'money', total: true },
      ],
      rows: rows.map((x) => [x.c.name, x.c.phone ?? '', x.c.city ?? '', x.opening, x.billed, x.received, { f: (r) => `D${r}+E${r}-F${r}`, v: x.closing }]),
      empty: 'No customer activity',
      filter: true,
      freeze: true,
    });
    w.gap();
    w.table({
      title: `Money received in ${monthName}`,
      cols: [{ header: 'Date', kind: 'date' }, { header: 'Customer' }, { header: 'Order No.' }, { header: 'Type' }, { header: 'Amount (Rs)', kind: 'money', total: true }],
      rows: pays.map((p) => [p.date, p.customer, p.order, p.kind, p.amount]),
      empty: `No money received in ${monthName}`,
    });
    w.gap();
    w.note('Closing balance = Opening balance + Billed − Received.  A positive balance is money the customer still has to pay.');
    w.finish(footer);
  }

  /* ----- Suppliers: opening + purchases − paid = closing ----- */
  let toPay = 0;
  {
    const rows = db.suppliers
      .map((s) => {
        let opening = 0;
        let bought = 0;
        let paid = 0;
        for (const p of db.purchases) {
          if (p.supplierId !== s.id) continue;
          if (p.date < start) opening += purchaseAmount(p) - (p.paid || 0);
          else if (p.date < next) {
            bought += purchaseAmount(p);
            paid += p.paid || 0;
          }
        }
        for (const p of db.supplierPayments) {
          if (p.supplierId !== s.id) continue;
          if (p.date < start) opening -= p.amount;
          else if (p.date < next) paid += p.amount;
        }
        return { s, opening, bought, paid, closing: opening + bought - paid };
      })
      .filter((x) => x.opening || x.bought || x.paid)
      .sort((a, b) => b.closing - a.closing);
    toPay = rows.reduce((s, x) => s + Math.max(0, x.closing), 0);
    const pays = [
      ...db.purchases.filter((p) => inMonth(p.date) && p.paid).map((p) => {
        const it = items.get(p.itemId);
        return { date: p.date, supplier: sups.get(p.supplierId)?.name ?? '', detail: `Paid with purchase — ${it ? `${it.name} ${it.type}` : ''}`, amount: p.paid };
      }),
      ...db.supplierPayments.filter((p) => inMonth(p.date)).map((p) => ({ date: p.date, supplier: sups.get(p.supplierId)?.name ?? '', detail: p.note ? `Payment (${p.note})` : 'Payment', amount: p.amount })),
    ].sort((a, b) => a.date.localeCompare(b.date));

    const w = sheet('Suppliers', [28, 16, 14, 18, 18, 18, 18]);
    w.title(`${factory} — Supplier balances`, sub);
    w.table({
      cols: [
        { header: 'Supplier' },
        { header: 'Phone' },
        { header: 'City' },
        { header: 'Opening balance (Rs)', kind: 'money', total: true },
        { header: `Purchases in ${monthName.split(' ')[0]} (Rs)`, kind: 'money', total: true },
        { header: `Paid in ${monthName.split(' ')[0]} (Rs)`, kind: 'money', total: true },
        { header: 'Remaining (Rs)', kind: 'money', total: true },
      ],
      rows: rows.map((x) => [x.s.name, x.s.phone ?? '', x.s.city ?? '', x.opening, x.bought, x.paid, { f: (r) => `D${r}+E${r}-F${r}`, v: x.closing }]),
      empty: 'No supplier activity',
      filter: true,
      freeze: true,
    });
    w.gap();
    w.table({
      title: `Money paid to suppliers in ${monthName}`,
      cols: [{ header: 'Date', kind: 'date' }, { header: 'Supplier' }, { header: 'Detail' }, { header: 'Amount (Rs)', kind: 'money', total: true }],
      rows: pays.map((p) => [p.date, p.supplier, p.detail, p.amount]),
      empty: `No payments to suppliers in ${monthName}`,
    });
    w.gap();
    w.note('Remaining = Opening balance + Purchases − Paid.  This is the amount still owed to the supplier.');
    w.finish(footer);
  }

  /* ----- Salaries ----- */
  {
    const list = db.salaries.filter((s) => s.month === month).sort((a, b) => (emp.get(a.employeeId)?.name ?? '').localeCompare(emp.get(b.employeeId)?.name ?? ''));
    const w = sheet('Salaries', [24, 18, 16, 12, 12, 12, 15, 9, 28]);
    w.title(`${factory} — Salaries`, sub);
    w.table({
      cols: [
        { header: 'Employee' },
        { header: 'Designation' },
        { header: 'Monthly salary (Rs)', kind: 'money', total: true },
        { header: 'Bonus (Rs)', kind: 'money', total: true },
        { header: 'Advance (Rs)', kind: 'money', total: true },
        { header: 'Deduction (Rs)', kind: 'money', total: true },
        { header: 'Payable (Rs)', kind: 'money', total: true },
        { header: 'Paid' },
        { header: 'Note' },
      ],
      rows: list.map((s) => [
        emp.get(s.employeeId)?.name ?? '',
        emp.get(s.employeeId)?.designation ?? '',
        s.salary,
        s.bonus || 0,
        s.advance || 0,
        s.deduction || 0,
        { f: (r) => `C${r}+D${r}-E${r}-F${r}`, v: (s.salary || 0) + (s.bonus || 0) - (s.advance || 0) - (s.deduction || 0) },
        s.paid ? 'Yes' : 'No',
        s.note ?? '',
      ]),
      empty: `The salary sheet for ${monthName} was not made in the software`,
      filter: true,
      freeze: true,
    });
    w.gap();
    w.note('Payable = Monthly salary + Bonus − Advance − Deduction.');
    w.finish(footer);
  }

  /* ----- Expenses ----- */
  {
    const list = db.expenses.filter((e) => inMonth(e.date)).sort((a, b) => a.date.localeCompare(b.date));
    const w = sheet('Expenses', [13, 34, 22, 15, 34]);
    w.title(`${factory} — Expenses`, sub);
    const t = w.table({
      cols: [{ header: 'Date', kind: 'date' }, { header: 'Expense' }, { header: 'Category' }, { header: 'Amount (Rs)', kind: 'money', total: true }, { header: 'Notes' }],
      rows: list.map((e) => [e.date, e.title, e.category, e.amount, e.notes ?? '']),
      empty: `No expenses in ${monthName}`,
      filter: true,
      freeze: true,
    });
    if (list.length) {
      w.gap();
      // B:C so the category column lines up under "Category"
      const cats2 = expensesByCategory(db, month);
      w.table({
        title: 'Total by category',
        cols: [{ header: 'Category' }, { header: 'Amount (Rs)', kind: 'money', total: true }],
        rows: cats2.map((c) => [c.category, { f: (r: number) => `SUMIF($C$${t.first}:$C$${t.last},A${r},$D$${t.first}:$D$${t.last})`, v: c.amount }]),
      });
    }
    w.finish(footer);
  }

  /* ----- Hisaab Summary (first tab) ----- */
  {
    const h = monthHisab(db, month);
    const w = sum;
    w.title(`${factory} — Monthly Hisaab`, sub);
    const t = w.table({
      title: `Hisaab for ${monthName}`,
      cols: [{ header: 'Detail' }, { header: 'Amount (Rs)', kind: 'money' }, { header: 'Note' }],
      rows: [
        ['Sales (orders booked)', h.sales, `${h.orders} orders — see Orders sheet`],
        ['Money received', h.received, 'Advances + later payments — see Customers sheet'],
        ['Material purchases', h.purchases, 'See Purchases sheet'],
        ['Salaries', h.salaries, h.salarySheet ? 'Salary + Bonus − Deduction — see Salaries sheet' : 'Salary sheet not made for this month'],
        ['Other expenses', h.expenses, 'See Expenses sheet'],
        ['Total spending', { f: (r) => `B${r - 3}+B${r - 2}+B${r - 1}`, v: h.spending }, 'Purchases + Salaries + Other expenses'],
        [h.profit < 0 ? 'Loss' : 'Profit', { f: (r) => `B${r - 6}-B${r - 1}`, v: h.profit }, 'Sales − Total spending'],
      ],
    });
    // highlight the two result lines
    for (const r of [t.last - 1, t.last]) {
      for (let c = 1; c <= 3; c++) {
        const cell = w.ws.getCell(r, c);
        cell.font = { name: FONT, size: c === 3 ? 9 : 11, bold: c !== 3, color: c === 3 ? { argb: GREY_TEXT } : r === t.last && h.profit < 0 ? { argb: RED } : undefined };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GREEN_SOFT } };
      }
      w.ws.getRow(r).height = 22;
    }
    w.ws.getCell(t.last, 2).border = { top: { style: 'medium', color: { argb: GREEN } }, bottom: { style: 'double', color: { argb: GREEN } }, left: thin(), right: thin() };
    // notes in column C are small and grey
    for (let r = t.first; r < t.last - 1; r++) w.ws.getCell(r, 3).font = { name: FONT, size: 9, color: { argb: GREY_TEXT } };

    w.gap();
    w.table({
      title: 'Month at a glance',
      cols: [{ header: 'Detail' }, { header: 'Value', kind: 'money' }, { header: 'Note' }],
      rows: [
        ['Orders booked', h.orders, 'Number of orders'],
        ['Pieces produced', pcs, 'From the Production sheet'],
        ['Stock value at month end (Rs)', Math.round(stockValue), 'Closing stock × rate — see Stock sheet'],
        ['To receive from customers (Rs)', toReceive, 'Customer balances at month end'],
        ['To pay suppliers (Rs)', toPay, 'Supplier balances at month end'],
      ],
    });
    w.gap();
    const cats2 = expensesByCategory(db, month);
    w.table({
      title: 'Expenses by category',
      cols: [{ header: 'Category' }, { header: 'Amount (Rs)', kind: 'money', total: true }, { header: 'Share' }],
      rows: cats2.map((c) => [c.category, c.amount, h.expenses ? `${Math.round((c.amount / h.expenses) * 100)}%` : '']),
      empty: 'No expenses',
    });
    w.gap();
    w.note('How the hisaab is worked out (simple rules, same as in the software):');
    w.note('•  Sales = value of orders booked in the month (by order date). Cancelled orders are not counted.');
    w.note('•  Spending = material purchases (full amount, in the month bought) + salaries from the salary sheet + other expenses.');
    w.note('•  Profit / Loss = Sales − Spending.');
    w.finish(footer);
    w.ws.views = [{ showGridLines: false }];
  }

  return wb;
}
