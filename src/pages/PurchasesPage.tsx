import { useMemo, useState } from 'react';
import { Plus, Download, Wallet } from 'lucide-react';
import { Chips, Field, FormButtons, Modal, PageHeader, PeriodChips, SearchBox, Sheet, inPeriod, periodLabel, confirmAction, type Col, type Period } from '../components/ui';
import { PurchaseForm, SupplierPaymentForm } from '../components/forms';
import { Ledger } from '../components/Ledger';
import { notify } from '../components/ui/toast';
import { useStore } from '../store/store';
import { byId, purchaseAmount, supplierAccounts, supplierLedger } from '../store/selectors';
import { fmtShort, matches, money, num, today, uid } from '../lib/format';
import { downloadCSV } from '../lib/files';
import { useLinkParams } from '../lib/useParams';
import type { Purchase, Supplier } from '../types';

export default function PurchasesPage() {
  const db = useStore();
  const [tab, setTab] = useState<'purchases' | 'suppliers'>('purchases');
  const [period, setPeriod] = useState<Period>('month');
  const [q, setQ] = useState('');
  const [edit, setEdit] = useState<Purchase | 'new' | null>(null);
  const [pay, setPay] = useState<{ supplierId?: string } | null>(null);
  const [khata, setKhata] = useState<string | null>(null);
  const [supEdit, setSupEdit] = useState<Supplier | 'new' | null>(null);
  const sups = useMemo(() => byId(db.suppliers), [db.suppliers]);
  const items = useMemo(() => byId(db.items), [db.items]);
  const accounts = useMemo(() => supplierAccounts(db), [db]);
  useLinkParams(['supplier', 'tab'], (p) => {
    if (p.get('tab') === 'suppliers' || p.get('supplier')) setTab('suppliers');
    if (p.get('supplier')) setKhata(p.get('supplier'));
  });

  const rows = db.purchases
    .filter((p) => inPeriod(p.date, period))
    .filter((p) => {
      const it = items.get(p.itemId);
      return matches(q, sups.get(p.supplierId)?.name, it?.name, it?.type, it?.code, p.billNo);
    })
    .sort((a, b) => b.date.localeCompare(a.date));

  const cols: Col<Purchase>[] = [
    { label: 'Date', cell: (p) => <span className="nowrap">{fmtShort(p.date)}</span> },
    { label: 'Supplier', cell: (p) => sups.get(p.supplierId)?.name },
    { label: 'Item', cell: (p) => { const it = items.get(p.itemId); return it ? `${it.name} ${it.type}` : '—'; } },
    { label: 'Code', cell: (p) => items.get(p.itemId)?.code },
    { label: 'Qty', num: true, cell: (p) => num(p.qty, 2) },
    { label: 'Rate', num: true, cell: (p) => num(p.rate, 2) },
    { label: 'Amount', num: true, cell: (p) => num(purchaseAmount(p)), total: (l) => num(l.reduce((s, p) => s + purchaseAmount(p), 0)) },
    { label: 'Paid', num: true, cell: (p) => num(p.paid), total: (l) => num(l.reduce((s, p) => s + p.paid, 0)) },
    { label: 'Remaining', num: true, cell: (p) => num(purchaseAmount(p) - p.paid), className: (p) => (purchaseAmount(p) - p.paid > 0 ? 'text-danger strong' : ''), total: (l) => num(l.reduce((s, p) => s + purchaseAmount(p) - p.paid, 0)) },
    { label: 'Bill No.', cell: (p) => <span className="muted">{p.billNo}</span> },
  ];

  const supplierRows = db.suppliers.filter((s) => matches(q, s.name, s.city, s.phone));
  const supCols: Col<Supplier>[] = [
    { label: 'Supplier', cell: (s) => <span className="strong">{s.name}</span> },
    { label: 'Phone', cell: (s) => s.phone },
    { label: 'City', cell: (s) => s.city },
    { label: 'Purchases', num: true, cell: (s) => db.purchases.filter((p) => p.supplierId === s.id).length },
    { label: 'Amount', num: true, cell: (s) => num(accounts.get(s.id)?.total ?? 0), total: (l) => num(l.reduce((a, s) => a + (accounts.get(s.id)?.total ?? 0), 0)) },
    { label: 'Paid', num: true, cell: (s) => num(accounts.get(s.id)?.paid ?? 0), total: (l) => num(l.reduce((a, s) => a + (accounts.get(s.id)?.paid ?? 0), 0)) },
    { label: 'Remaining', num: true, cell: (s) => num(accounts.get(s.id)?.balance ?? 0), className: (s) => ((accounts.get(s.id)?.balance ?? 0) > 0 ? 'text-danger strong' : ''), total: (l) => num(l.reduce((a, s) => a + (accounts.get(s.id)?.balance ?? 0), 0)) },
  ];

  const exportCSV = () =>
    downloadCSV(
      `purchases-${today()}.csv`,
      ['Date', 'Supplier', 'Item', 'Code', 'Qty', 'Rate', 'Amount', 'Paid', 'Remaining', 'Bill No'],
      rows.map((p) => {
        const it = items.get(p.itemId);
        return [p.date, sups.get(p.supplierId)?.name ?? '', it ? `${it.name} ${it.type}` : '', it?.code ?? '', p.qty, p.rate, purchaseAmount(p), p.paid, purchaseAmount(p) - p.paid, p.billNo ?? ''];
      }),
    );

  return (
    <>
      <PageHeader
        title="Purchases"
        actions={
          <>
            <button className="btn" onClick={exportCSV}><Download size={16} /> Excel</button>
            <button className="btn" onClick={() => setPay({})}><Wallet size={16} /> Pay supplier</button>
            <button className="btn btn-primary" onClick={() => setEdit('new')}><Plus size={16} /> New purchase</button>
          </>
        }
      />
      <div className="toolbar tabs-line">
        <Chips options={[{ id: 'purchases', label: 'Purchases' }, { id: 'suppliers', label: 'Suppliers' }]} value={tab} onChange={setTab} />
      </div>
      {tab === 'purchases' ? (
        <>
          <div className="toolbar">
            <PeriodChips value={period} onChange={setPeriod} />
            <SearchBox value={q} onChange={setQ} placeholder="Search supplier, item, bill…" />
            <span className="summary">
              {periodLabel(period)}: <b>{money(rows.reduce((s, p) => s + purchaseAmount(p), 0))}</b>
            </span>
          </div>
          <Sheet cols={cols} rows={rows} onRowClick={(p) => setEdit(p)} empty="No purchases in this period" />
          <p className="hint-line">Every purchase is added to Inventory as IN. Click a row to change it.</p>
        </>
      ) : (
        <>
          <div className="toolbar">
            <SearchBox value={q} onChange={setQ} placeholder="Search supplier…" />
            <button className="btn" onClick={() => setSupEdit('new')}><Plus size={16} /> Add supplier</button>
            <span className="summary">
              Total to pay: <b>{money([...accounts.values()].reduce((a, x) => a + Math.max(0, x.balance), 0))}</b>
            </span>
          </div>
          <Sheet cols={supCols} rows={supplierRows} onRowClick={(s) => setKhata(s.id)} />
          <p className="hint-line">Click a supplier to see the full account (khata).</p>
        </>
      )}

      {khata && (
        <SupplierKhata
          supplierId={khata}
          onClose={() => setKhata(null)}
          onPay={() => setPay({ supplierId: khata })}
          onEdit={(s) => setSupEdit(s)}
        />
      )}
      {edit && <PurchaseForm purchase={edit === 'new' ? undefined : edit} onClose={() => setEdit(null)} />}
      {pay && <SupplierPaymentForm supplierId={pay.supplierId} onClose={() => setPay(null)} />}
      {supEdit && <SupplierForm supplier={supEdit === 'new' ? undefined : supEdit} onClose={() => setSupEdit(null)} />}
    </>
  );
}

function SupplierKhata({ supplierId, onClose, onPay, onEdit }: { supplierId: string; onClose: () => void; onPay: () => void; onEdit: (s: Supplier) => void }) {
  const db = useStore();
  const s = db.suppliers.find((x) => x.id === supplierId);
  if (!s) return null;
  const rows = supplierLedger(db, supplierId);
  return (
    <Modal
      title={`${s.name} — account`}
      onClose={onClose}
      width={760}
      footer={
        <>
          <button className="btn btn-ghost" onClick={() => onEdit(s)}>Edit supplier</button>
          <span className="spacer" />
          <button className="btn" onClick={onPay}><Wallet size={16} /> Pay supplier</button>
          <button className="btn btn-primary" onClick={onClose}>Close</button>
        </>
      }
    >
      <p className="muted">{[s.phone, s.city].filter(Boolean).join(' · ')}</p>
      <Ledger rows={rows} billLabel="Purchase" paidLabel="Paid" />
    </Modal>
  );
}

function SupplierForm({ supplier, onClose }: { supplier?: Supplier; onClose: () => void }) {
  const db = useStore();
  const [f, setF] = useState({ name: supplier?.name ?? '', phone: supplier?.phone ?? '', city: supplier?.city ?? '', notes: supplier?.notes ?? '' });
  const save = () => {
    if (!f.name.trim()) return notify('Please enter the supplier name', 'error');
    db.save('suppliers', { id: supplier?.id ?? uid(), name: f.name.trim(), phone: f.phone.trim() || undefined, city: f.city.trim() || undefined, notes: f.notes.trim() || undefined });
    notify('Supplier saved');
    onClose();
  };
  const del = async () => {
    if (!supplier) return;
    if (db.purchases.some((p) => p.supplierId === supplier.id) || db.supplierPayments.some((p) => p.supplierId === supplier.id)) return notify('This supplier has purchases or payments, so it cannot be deleted.', 'error');
    if (await confirmAction(`Delete ${supplier.name}?`)) {
      db.remove('suppliers', supplier.id);
      onClose();
    }
  };
  return (
    <Modal title={supplier ? 'Edit supplier' : 'Add supplier'} onClose={onClose} width={480} footer={<FormButtons onSave={save} onCancel={onClose} onDelete={supplier ? del : undefined} />}>
      <div className="form">
        <Field label="Supplier name" wide><input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
        <Field label="Phone"><input className="input" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></Field>
        <Field label="City"><input className="input" value={f.city} onChange={(e) => setF({ ...f, city: e.target.value })} /></Field>
        <Field label="Notes" wide><input className="input" value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></Field>
      </div>
    </Modal>
  );
}
