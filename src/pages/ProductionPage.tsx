import { useMemo, useState } from 'react';
import { Plus, Settings2, Trash2 } from 'lucide-react';
import { Modal, PageHeader, PeriodChips, SearchBox, Sheet, inPeriod, periodLabel, confirmAction, type Col, type Period } from '../components/ui';
import { ProductionForm } from '../components/forms';
import { notify } from '../components/ui/toast';
import { useStore } from '../store/store';
import { byId } from '../store/selectors';
import { fmtShort, matches, num, uid } from '../lib/format';
import type { ProductionEntry } from '../types';
import { useLinkParams } from '../lib/useParams';

export default function ProductionPage() {
  const db = useStore();
  const [period, setPeriod] = useState<Period>('today');
  const [q, setQ] = useState('');
  const [edit, setEdit] = useState<ProductionEntry | 'new' | null>(null);
  const [machinesOpen, setMachinesOpen] = useState(false);
  const machines = useMemo(() => byId(db.machines), [db.machines]);
  const emp = useMemo(() => byId(db.employees), [db.employees]);
  const orders = useMemo(() => byId(db.orders), [db.orders]);
  const custs = useMemo(() => byId(db.customers), [db.customers]);

  useLinkParams(['q', 'period'], (p) => {
    if (p.get('q')) setQ(p.get('q')!);
    if (p.get('period')) setPeriod(p.get('period') as Period);
  });

  const customerOf = (p: ProductionEntry) => custs.get(orders.get(p.orderId ?? '')?.customerId ?? '')?.name ?? '';
  const rows = db.production
    .filter((p) => inPeriod(p.date, period))
    .filter((p) => matches(q, machines.get(p.machineId)?.name, p.designNo, p.operatorId ? emp.get(p.operatorId)?.name : '', customerOf(p)))
    .sort((a, b) => b.date.localeCompare(a.date) || (machines.get(a.machineId)?.name ?? '').localeCompare(machines.get(b.machineId)?.name ?? '', undefined, { numeric: true }));
  const total = rows.reduce((s, p) => s + p.quantity, 0);

  const cols: Col<ProductionEntry>[] = [
    { label: 'Date', cell: (p) => <span className="nowrap">{fmtShort(p.date)}</span> },
    { label: 'Machine', cell: (p) => machines.get(p.machineId)?.name ?? '—' },
    { label: 'Design', cell: (p) => <span className="strong">{p.designNo}</span> },
    { label: 'Customer', cell: (p) => customerOf(p) },
    { label: 'Operator', cell: (p) => (p.operatorId ? emp.get(p.operatorId)?.name : '—') },
    { label: 'Produced', num: true, cell: (p) => <span className="strong">{num(p.quantity)}</span>, total: (l) => num(l.reduce((s, p) => s + p.quantity, 0)) },
    { label: 'Notes', cell: (p) => <span className="muted">{p.notes}</span> },
  ];

  // Total per machine for the same period
  const byMachine = db.machines.map((m) => ({ id: m.id, name: m.name, qty: rows.filter((p) => p.machineId === m.id).reduce((s, p) => s + p.quantity, 0) }));
  const opTotals = new Map<string, number>();
  for (const p of rows) if (p.operatorId) opTotals.set(p.operatorId, (opTotals.get(p.operatorId) || 0) + p.quantity);
  const byOperator = [...opTotals].sort((a, b) => b[1] - a[1]).map(([id, qty]) => ({ id, name: emp.get(id)?.name ?? '—', qty }));

  return (
    <>
      <PageHeader
        title="Production"
        actions={
          <>
            <button className="btn" onClick={() => setMachinesOpen(true)}><Settings2 size={16} /> Machines</button>
            <button className="btn btn-primary" onClick={() => setEdit('new')}><Plus size={16} /> Add production</button>
          </>
        }
      />
      <div className="toolbar">
        <PeriodChips value={period} onChange={setPeriod} withToday />
        <SearchBox value={q} onChange={setQ} placeholder="Search machine, design…" />
        <span className="summary">
          {periodLabel(period)}: <b>{num(total)} pcs</b>
        </span>
      </div>
      <Sheet cols={cols} rows={rows} onRowClick={(p) => setEdit(p)} empty={period === 'today' ? 'No production entered today yet — click “Add production”.' : 'No production in this period'} />

      {period !== 'today' && rows.length > 0 && (
        <div className="two-col" style={{ marginTop: 24, maxWidth: 860 }}>
          <div>
            <h3 className="section-title">Total by machine — {periodLabel(period)}</h3>
            <Sheet
              cols={[
                { label: 'Machine', cell: (m) => m.name },
                { label: 'Quantity', num: true, cell: (m) => (m.qty ? num(m.qty) : <span className="muted">0</span>), total: (l) => num(l.reduce((s, m) => s + m.qty, 0)) },
              ]}
              rows={byMachine}
            />
          </div>
          <div>
            <h3 className="section-title">Total by operator — {periodLabel(period)}</h3>
            <Sheet
              cols={[
                { label: 'Operator', cell: (m) => m.name },
                { label: 'Quantity', num: true, cell: (m) => num(m.qty), total: (l) => num(l.reduce((s, m) => s + m.qty, 0)) },
              ]}
              rows={byOperator}
            />
          </div>
        </div>
      )}

      {edit && <ProductionForm entry={edit === 'new' ? undefined : edit} onClose={() => setEdit(null)} />}
      {machinesOpen && <MachinesList onClose={() => setMachinesOpen(false)} />}
    </>
  );
}

/** Simple list of machine names */
function MachinesList({ onClose }: { onClose: () => void }) {
  const db = useStore();
  const [name, setName] = useState('');
  const add = () => {
    if (!name.trim()) return;
    db.save('machines', { id: uid(), name: name.trim() });
    setName('');
  };
  const del = async (id: string, n: string) => {
    if (db.production.some((p) => p.machineId === id)) return notify(`${n} has production entries, so it can't be deleted. You can rename it.`, 'error');
    if (await confirmAction(`Delete ${n}?`)) db.remove('machines', id);
  };
  return (
    <Modal title="Machines" onClose={onClose} width={440} footer={<><span className="spacer" /><button className="btn btn-primary" onClick={onClose}>Done</button></>}>
      <div className="stack" style={{ gap: 8 }}>
        {db.machines.map((m) => (
          <div key={m.id} className="row" style={{ flexWrap: 'nowrap' }}>
            <input className="input" value={m.name} onChange={(e) => db.save('machines', { ...m, name: e.target.value })} aria-label="Machine name" />
            <button className="icon-btn" onClick={() => del(m.id, m.name)} aria-label={`Delete ${m.name}`}><Trash2 size={16} /></button>
          </div>
        ))}
        <div className="row" style={{ flexWrap: 'nowrap', marginTop: 8 }}>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} placeholder="New machine name, e.g. Machine 7" />
          <button className="btn" onClick={add}><Plus size={16} /> Add</button>
        </div>
      </div>
    </Modal>
  );
}
