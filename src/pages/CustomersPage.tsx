import { useMemo, useState } from 'react';
import { Plus, Wallet, Download } from 'lucide-react';
import { Field, FormButtons, Modal, PageHeader, SearchBox, Sheet, confirmAction, type Col } from '../components/ui';
import { PaymentForm } from '../components/forms';
import { Ledger } from '../components/Ledger';
import { notify } from '../components/ui/toast';
import { useStore } from '../store/store';
import { customerAccounts, customerLedger } from '../store/selectors';
import { fmtDate, matches, money, num, today, uid } from '../lib/format';
import { downloadCSV } from '../lib/files';
import { useLinkParams } from '../lib/useParams';
import type { Customer } from '../types';

export default function CustomersPage() {
  const db = useStore();
  const [q, setQ] = useState('');
  const [khata, setKhata] = useState<string | null>(null);
  const [edit, setEdit] = useState<Customer | 'new' | null>(null);
  const [pay, setPay] = useState<{ customerId?: string } | null>(null);
  const acc = useMemo(() => customerAccounts(db), [db]);
  useLinkParams(['open'], (p) => setKhata(p.get('open')));
  const a = (c: Customer) => acc.get(c.id) ?? { total: 0, paid: 0, balance: 0 };

  const rows = db.customers
    .filter((c) => matches(q, c.name, c.phone, c.city))
    .sort((x, y) => a(y).balance - a(x).balance || x.name.localeCompare(y.name));
  const orderCount = (c: Customer) => db.orders.filter((o) => o.customerId === c.id && o.status !== 'Cancelled').length;

  const cols: Col<Customer>[] = [
    { label: 'Customer', cell: (c) => <span className="strong">{c.name}</span> },
    { label: 'Phone', cell: (c) => c.phone },
    { label: 'City', cell: (c) => c.city },
    { label: 'Orders', num: true, cell: (c) => orderCount(c) },
    { label: 'Total billed', num: true, cell: (c) => num(a(c).total), total: (l) => num(l.reduce((s, c) => s + a(c).total, 0)) },
    { label: 'Received', num: true, cell: (c) => num(a(c).paid), total: (l) => num(l.reduce((s, c) => s + a(c).paid, 0)) },
    { label: 'Balance', num: true, cell: (c) => num(a(c).balance), className: (c) => (a(c).balance > 0 ? 'text-danger strong' : ''), total: (l) => num(l.reduce((s, c) => s + a(c).balance, 0)) },
  ];

  const exportCSV = () =>
    downloadCSV(`customers-${today()}.csv`, ['Customer', 'Phone', 'City', 'Orders', 'Total', 'Received', 'Balance'], rows.map((c) => [c.name, c.phone ?? '', c.city ?? '', orderCount(c), a(c).total, a(c).paid, a(c).balance]));

  return (
    <>
      <PageHeader
        title="Customers"
        actions={
          <>
            <button className="btn" onClick={exportCSV}><Download size={16} /> Excel</button>
            <button className="btn" onClick={() => setEdit('new')}><Plus size={16} /> Add customer</button>
            <button className="btn btn-primary" onClick={() => setPay({})}><Wallet size={16} /> Receive payment</button>
          </>
        }
      />
      <div className="toolbar">
        <SearchBox value={q} onChange={setQ} placeholder="Search name, phone, city…" />
        <span className="summary">
          Total to receive: <b>{money(rows.reduce((s, c) => s + Math.max(0, a(c).balance), 0))}</b>
        </span>
      </div>
      <Sheet cols={cols} rows={rows} onRowClick={(c) => setKhata(c.id)} />
      <p className="hint-line">Total billed = all orders (except cancelled). Received = advances + later payments. Click a customer to see the full account (khata).</p>

      {khata && <CustomerKhata customerId={khata} onClose={() => setKhata(null)} onPay={() => setPay({ customerId: khata })} onEdit={(c) => setEdit(c)} />}
      {edit && <CustomerForm customer={edit === 'new' ? undefined : edit} onClose={() => setEdit(null)} />}
      {pay && <PaymentForm customerId={pay.customerId} onClose={() => setPay(null)} />}
    </>
  );
}

function CustomerKhata({ customerId, onClose, onPay, onEdit }: { customerId: string; onClose: () => void; onPay: () => void; onEdit: (c: Customer) => void }) {
  const db = useStore();
  const c = db.customers.find((x) => x.id === customerId);
  if (!c) return null;
  const rows = customerLedger(db, customerId);
  const payments = db.payments.filter((p) => p.customerId === customerId);
  const delPayment = async () => {
    // simple undo for the most recent payment
    const last = [...payments].sort((x, y) => y.date.localeCompare(x.date))[0];
    if (last && (await confirmAction(`Delete the payment of ${money(last.amount)} on ${fmtDate(last.date)}?`))) db.remove('payments', last.id);
  };
  return (
    <Modal
      title={`${c.name} — account`}
      onClose={onClose}
      width={780}
      footer={
        <>
          <button className="btn btn-ghost" onClick={() => onEdit(c)}>Edit customer</button>
          {payments.length > 0 && <button className="btn btn-ghost" onClick={delPayment}>Undo last payment</button>}
          <span className="spacer" />
          <button className="btn" onClick={onPay}><Wallet size={16} /> Receive payment</button>
          <button className="btn btn-primary" onClick={onClose}>Close</button>
        </>
      }
    >
      <p className="muted">{[c.phone, c.city].filter(Boolean).join(' · ')}</p>
      <Ledger rows={rows} billLabel="Order amount" paidLabel="Received" />
    </Modal>
  );
}

function CustomerForm({ customer, onClose }: { customer?: Customer; onClose: () => void }) {
  const db = useStore();
  const [f, setF] = useState({ name: customer?.name ?? '', phone: customer?.phone ?? '', city: customer?.city ?? '', notes: customer?.notes ?? '' });
  const save = () => {
    if (!f.name.trim()) return notify('Please enter the customer name', 'error');
    db.save('customers', { id: customer?.id ?? uid(), name: f.name.trim(), phone: f.phone.trim() || undefined, city: f.city.trim() || undefined, notes: f.notes.trim() || undefined });
    notify('Customer saved');
    onClose();
  };
  const del = async () => {
    if (!customer) return;
    if (db.orders.some((o) => o.customerId === customer.id) || db.payments.some((p) => p.customerId === customer.id)) return notify('This customer has orders or payments, so it cannot be deleted.', 'error');
    if (await confirmAction(`Delete ${customer.name}?`)) {
      db.remove('customers', customer.id);
      onClose();
    }
  };
  return (
    <Modal title={customer ? 'Edit customer' : 'Add customer'} onClose={onClose} width={480} footer={<FormButtons onSave={save} onCancel={onClose} onDelete={customer ? del : undefined} />}>
      <div className="form">
        <Field label="Customer name" wide><input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
        <Field label="Phone"><input className="input" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></Field>
        <Field label="City"><input className="input" value={f.city} onChange={(e) => setF({ ...f, city: e.target.value })} /></Field>
        <Field label="Notes" wide><input className="input" value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></Field>
      </div>
    </Modal>
  );
}
