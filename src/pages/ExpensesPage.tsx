import { useState } from 'react';
import { Plus, Download } from 'lucide-react';
import { PageHeader, PeriodChips, SearchBox, Sheet, inPeriod, periodLabel, type Col, type Period } from '../components/ui';
import { ExpenseForm } from '../components/forms';
import { useStore } from '../store/store';
import { fmtShort, matches, money, num, today } from '../lib/format';
import { downloadCSV } from '../lib/files';
import type { Expense } from '../types';
import { useLinkParams } from '../lib/useParams';

export default function ExpensesPage() {
  const db = useStore();
  const [period, setPeriod] = useState<Period>('month');
  const [q, setQ] = useState('');
  const [edit, setEdit] = useState<Expense | 'new' | null>(null);
  useLinkParams(['open'], (p) => {
    const e = db.expenses.find((x) => x.id === p.get('open'));
    if (e) {
      setPeriod('all');
      setEdit(e);
    }
  });

  const rows = db.expenses
    .filter((e) => inPeriod(e.date, period))
    .filter((e) => matches(q, e.title, e.category, e.notes))
    .sort((a, b) => b.date.localeCompare(a.date));
  const total = rows.reduce((s, e) => s + e.amount, 0);

  const cols: Col<Expense>[] = [
    { label: 'Date', cell: (e) => <span className="nowrap">{fmtShort(e.date)}</span> },
    { label: 'Expense', cell: (e) => <span className="strong">{e.title}</span> },
    { label: 'Category', cell: (e) => e.category },
    { label: 'Amount', num: true, cell: (e) => num(e.amount), total: () => num(total) },
    { label: 'Notes', cell: (e) => <span className="muted">{e.notes}</span> },
  ];

  const byCat = [...rows.reduce((m, e) => m.set(e.category, (m.get(e.category) || 0) + e.amount), new Map<string, number>())]
    .sort((a, b) => b[1] - a[1])
    .map(([category, amount]) => ({ id: category, category, amount }));

  return (
    <>
      <PageHeader
        title="Expenses"
        actions={
          <>
            <button className="btn" onClick={() => downloadCSV(`expenses-${today()}.csv`, ['Date', 'Expense', 'Category', 'Amount', 'Notes'], rows.map((e) => [e.date, e.title, e.category, e.amount, e.notes ?? '']))}><Download size={16} /> Excel</button>
            <button className="btn btn-primary" onClick={() => setEdit('new')}><Plus size={16} /> Add expense</button>
          </>
        }
      />
      <div className="toolbar">
        <PeriodChips value={period} onChange={setPeriod} />
        <SearchBox value={q} onChange={setQ} placeholder="Search expense…" />
        <span className="summary">
          {periodLabel(period)}: <b>{money(total)}</b>
        </span>
      </div>
      <Sheet cols={cols} rows={rows} onRowClick={(e) => setEdit(e)} empty="No expenses in this period" />

      {byCat.length > 0 && (
        <>
          <h3 className="section-title" style={{ marginTop: 24 }}>Total by category — {periodLabel(period)}</h3>
          <div style={{ maxWidth: 420 }}>
            <Sheet cols={[{ label: 'Category', cell: (r) => r.category }, { label: 'Amount', num: true, cell: (r) => num(r.amount), total: () => num(total) }]} rows={byCat} />
          </div>
        </>
      )}
      {edit && <ExpenseForm expense={edit === 'new' ? undefined : edit} onClose={() => setEdit(null)} />}
    </>
  );
}
