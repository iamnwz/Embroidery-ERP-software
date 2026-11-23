import { Sheet } from './ui';
import type { LedgerRow } from '../store/selectors';
import { fmtShort, num } from '../lib/format';

/** Khata-style table: Date | Detail | Bill | Received | Balance */
export function Ledger({ rows, billLabel, paidLabel }: { rows: LedgerRow[]; billLabel: string; paidLabel: string }) {
  return (
    <Sheet
      cols={[
        { label: 'Date', cell: (r) => <span className="nowrap">{fmtShort(r.date)}</span> },
        { label: 'Detail', cell: (r) => r.detail },
        { label: billLabel, num: true, cell: (r) => (r.debit ? num(r.debit) : ''), total: (l) => num(l.reduce((s, r) => s + r.debit, 0)) },
        { label: paidLabel, num: true, cell: (r) => (r.credit ? <span className="text-green">{num(r.credit)}</span> : ''), total: (l) => num(l.reduce((s, r) => s + r.credit, 0)) },
        { label: 'Balance', num: true, cell: (r) => <span className="strong">{num(r.balance)}</span>, total: (l) => num(l.length ? l[l.length - 1].balance : 0) },
      ]}
      rows={rows.map((r) => ({ ...r, id: r.key }))}
      empty="No entries yet"
    />
  );
}
