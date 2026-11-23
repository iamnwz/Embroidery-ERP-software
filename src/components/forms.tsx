// Entry forms. Each one opens in a popup and works like filling one row of an Excel sheet.

import { useMemo, useRef, useState } from 'react';
import { ImagePlus } from 'lucide-react';
import { Calc, Field, FormButtons, Modal, NumInput, Select, TextWithList, confirmAction } from './ui';
import { ItemPicker } from './ItemPicker';
import { notify } from './ui/toast';
import { useStore } from '../store/store';
import { byId, customerAccounts, laterPaymentsByOrder, orderTotal, stockByItem, supplierAccounts } from '../store/selectors';
import { EXPENSE_CATEGORIES, GARMENTS, ORDER_STATUSES } from '../config';
import { addDays, money, nextNo, num, today, uid } from '../lib/format';
import { compressImage } from '../lib/files';
import type { Customer, Expense, InventoryItem, Order, OrderStatus, ProductionEntry, Purchase, StockEntry, Supplier } from '../types';

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
export const itemLabel = (i: InventoryItem) => `${i.name} ${i.type} — ${i.code}`;

/* ================= Order ================= */
export function OrderForm({ order, onClose }: { order?: Order; onClose: () => void }) {
  const db = useStore();
  const fileRef = useRef<HTMLInputElement>(null);
  const custName = order ? db.customers.find((c) => c.id === order.customerId)?.name ?? '' : '';
  const [f, setF] = useState({
    orderNo: order?.orderNo ?? nextNo('', db.orders.map((o) => o.orderNo)),
    date: order?.date ?? today(),
    customer: custName,
    phone: '',
    designNo: order?.designNo ?? '',
    garment: order?.garment ?? '',
    quantity: (order?.quantity ?? '') as number | '',
    rate: (order?.rate ?? '') as number | '',
    advance: (order?.advance ?? '') as number | '',
    deliveryDate: order?.deliveryDate ?? addDays(today(), 20),
    status: order?.status ?? ('Pending' as OrderStatus),
    notes: order?.notes ?? '',
    referenceImage: order?.referenceImage,
  });
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }));
  const isNewCustomer = f.customer.trim() !== '' && !db.customers.some((c) => same(c.name, f.customer));
  const total = (Number(f.quantity) || 0) * (Number(f.rate) || 0);
  const later = order ? laterPaymentsByOrder(db).get(order.id) || 0 : 0;
  const produced = order ? db.production.filter((p) => p.orderId === order.id).reduce((s, p) => s + p.quantity, 0) : 0;
  const balance = total - (Number(f.advance) || 0) - later;

  const onImage = async (file?: File) => {
    if (!file) return;
    try {
      set('referenceImage', await compressImage(file));
    } catch {
      notify('Could not read that image', 'error');
    }
  };

  const save = () => {
    if (!f.customer.trim()) return notify('Please enter the customer name', 'error');
    if (!f.designNo.trim()) return notify('Please enter the design number', 'error');
    if (!f.quantity) return notify('Please enter the quantity', 'error');
    let customer = db.customers.find((c) => same(c.name, f.customer));
    if (!customer) {
      customer = { id: uid(), name: f.customer.trim(), phone: f.phone.trim() || undefined } as Customer;
      db.save('customers', customer);
    }
    db.save('orders', {
      id: order?.id ?? uid(),
      orderNo: f.orderNo.trim(),
      customerId: customer.id,
      date: f.date,
      designNo: f.designNo.trim(),
      garment: f.garment.trim() || undefined,
      referenceImage: f.referenceImage,
      quantity: Number(f.quantity),
      rate: Number(f.rate) || 0,
      advance: Number(f.advance) || 0,
      deliveryDate: f.deliveryDate,
      status: f.status,
      notes: f.notes.trim() || undefined,
    });
    notify(order ? `Order ${f.orderNo} saved` : `Order ${f.orderNo} added`);
    onClose();
  };

  const del = async () => {
    if (!order || !(await confirmAction(`Delete order ${order.orderNo}?`))) return;
    db.deleteOrder(order.id);
    notify('Order deleted');
    onClose();
  };

  return (
    <Modal title={order ? `Order ${order.orderNo}` : 'New order'} onClose={onClose} width={680} footer={<FormButtons onSave={save} onCancel={onClose} onDelete={order ? del : undefined} />}>
      <div className="form">
        <Field label="Order No.">
          <input className="input" value={f.orderNo} onChange={(e) => set('orderNo', e.target.value)} />
        </Field>
        <Field label="Date">
          <input className="input" type="date" value={f.date} onChange={(e) => set('date', e.target.value)} />
        </Field>
        <Field label="Customer" hint={isNewCustomer ? 'New customer — will be added to Customers' : undefined}>
          <TextWithList listId="customers-list" value={f.customer} onChange={(v) => set('customer', v)} options={db.customers.map((c) => c.name)} placeholder="Type or pick a name" />
        </Field>
        <Field label="Design No.">
          <input className="input" value={f.designNo} onChange={(e) => set('designNo', e.target.value)} placeholder="e.g. 120" />
        </Field>
        {isNewCustomer && (
          <Field label="New customer's phone (optional)" wide>
            <input className="input" value={f.phone} onChange={(e) => set('phone', e.target.value)} placeholder="03xx-xxxxxxx" />
          </Field>
        )}
        <Field label="Garment / product">
          <TextWithList listId="garments-list" value={f.garment} onChange={(v) => set('garment', v)} options={GARMENTS} placeholder="e.g. Lehenga, Kameez" />
        </Field>
        <Field label="Quantity">
          <NumInput value={f.quantity} onChange={(v) => set('quantity', v)} />
        </Field>
        <Field label="Rate (Rs)">
          <NumInput value={f.rate} onChange={(v) => set('rate', v)} />
        </Field>
        <Field label="Advance (Rs)">
          <NumInput value={f.advance} onChange={(v) => set('advance', v)} />
        </Field>
        <Field label="Delivery date">
          <input className="input" type="date" value={f.deliveryDate} onChange={(e) => set('deliveryDate', e.target.value)} />
        </Field>
        <Field label="Status">
          <Select value={f.status} onChange={(v) => set('status', v as OrderStatus)} options={ORDER_STATUSES} />
        </Field>
        <Calc
          items={[
            ['Total', money(total)],
            ['Advance', money(Number(f.advance) || 0)],
            ...(later ? ([['Paid later', money(later)]] as [string, string][]) : []),
            ['Balance', money(balance), balance > 0 ? 'text-danger' : ''],
            ...(order ? ([['Produced so far', `${num(produced)} of ${num(Number(f.quantity) || 0)}`]] as [string, string][]) : []),
          ]}
        />
        <Field label="Notes" wide>
          <textarea className="input" value={f.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Garment, colours, fabric, anything to remember" />
        </Field>
        <Field label="Reference picture (optional)" wide>
          <div className="upload">
            <div className="upload-preview">{f.referenceImage ? <img src={f.referenceImage} alt="Reference" /> : <ImagePlus size={20} />}</div>
            <button type="button" className="btn btn-sm" onClick={() => fileRef.current?.click()}>{f.referenceImage ? 'Change picture' : 'Add picture'}</button>
            {f.referenceImage && <button type="button" className="btn btn-sm btn-ghost" onClick={() => set('referenceImage', undefined)}>Remove</button>}
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => onImage(e.target.files?.[0])} />
          </div>
        </Field>
      </div>
    </Modal>
  );
}

/* ================= Production ================= */
export function ProductionForm({ entry, onClose }: { entry?: ProductionEntry; onClose: () => void }) {
  const db = useStore();
  const custs = useMemo(() => byId(db.customers), [db.customers]);
  const last = [...db.production].sort((a, b) => b.date.localeCompare(a.date))[0];
  const blank = (date: string) => ({ date, machineId: '', orderId: '', operatorId: '', quantity: '' as number | '', notes: '' });
  const [f, setF] = useState(
    entry
      ? { date: entry.date, machineId: entry.machineId, orderId: entry.orderId ?? '', operatorId: entry.operatorId ?? '', quantity: entry.quantity as number | '', notes: entry.notes ?? '' }
      : blank(today()),
  );
  const orders = db.orders
    .filter((o) => !['Delivered', 'Cancelled'].includes(o.status) || o.id === f.orderId)
    .sort((a, b) => Number(b.orderNo) - Number(a.orderNo) || b.orderNo.localeCompare(a.orderNo));
  const operators = db.employees.filter((e) => e.active);

  const pickMachine = (machineId: string) => {
    // suggest the operator who last worked on this machine
    const prev = [...db.production].filter((p) => p.machineId === machineId).sort((a, b) => b.date.localeCompare(a.date))[0];
    setF((x) => ({ ...x, machineId, operatorId: x.operatorId || prev?.operatorId || '', orderId: x.orderId || prev?.orderId || '' }));
  };

  const save = (another: boolean) => {
    if (!f.machineId) return notify('Please choose the machine', 'error');
    if (!f.orderId) return notify('Please choose the design / order', 'error');
    if (!f.quantity) return notify('Please enter the quantity', 'error');
    const o = db.orders.find((x) => x.id === f.orderId);
    db.save('production', {
      id: entry?.id ?? uid(),
      date: f.date,
      machineId: f.machineId,
      orderId: f.orderId,
      designNo: o?.designNo ?? entry?.designNo ?? '',
      operatorId: f.operatorId || undefined,
      quantity: Number(f.quantity),
      notes: f.notes.trim() || undefined,
    });
    notify('Production saved');
    if (another) setF(blank(f.date));
    else onClose();
  };

  const del = async () => {
    if (!entry || !(await confirmAction('Delete this production entry?'))) return;
    db.remove('production', entry.id);
    onClose();
  };

  return (
    <Modal
      title={entry ? 'Edit production' : 'Add production'}
      onClose={onClose}
      footer={
        <>
          {entry && <button className="btn btn-ghost text-danger" onClick={del}>Delete</button>}
          <span className="spacer" />
          <button className="btn" onClick={onClose}>Cancel</button>
          {!entry && <button className="btn" onClick={() => save(true)}>Save & add next</button>}
          <button className="btn btn-primary" onClick={() => save(false)}>Save</button>
        </>
      }
    >
      <div className="form">
        <Field label="Date">
          <input className="input" type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} />
        </Field>
        <Field label="Machine">
          <Select value={f.machineId} onChange={pickMachine} placeholder="Choose machine…" options={db.machines.map((m) => ({ value: m.id, label: m.name }))} />
        </Field>
        <Field label="Design (order)" wide>
          <Select
            value={f.orderId}
            onChange={(v) => setF({ ...f, orderId: v })}
            placeholder="Choose design…"
            options={orders.map((o) => ({ value: o.id, label: `Design ${o.designNo} — ${custs.get(o.customerId)?.name ?? ''} (Order ${o.orderNo}, ${o.quantity} pcs)` }))}
          />
        </Field>
        <Field label="Operator">
          <Select value={f.operatorId} onChange={(v) => setF({ ...f, operatorId: v })} placeholder="—" options={operators.map((e) => ({ value: e.id, label: e.name }))} />
        </Field>
        <Field label="Quantity">
          <NumInput value={f.quantity} onChange={(v) => setF({ ...f, quantity: v })} />
        </Field>
        <Field label="Notes" wide>
          <input className="input" value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} />
        </Field>
      </div>
      {!entry && last && <p className="hint-line">Tip: “Save & add next” keeps the date so you can enter all machines one after another.</p>}
    </Modal>
  );
}

/* ================= Stock IN / OUT ================= */
export function StockForm({ type, itemId, onClose }: { type: 'IN' | 'OUT'; itemId?: string; onClose: () => void }) {
  const db = useStore();
  const stock = useMemo(() => stockByItem(db), [db]);
  const [f, setF] = useState({ type, itemId: itemId ?? '', date: today(), qty: '' as number | '', note: '' });
  const [saved, setSaved] = useState(0);
  const item = db.items.find((i) => i.id === f.itemId);
  const current = item ? stock.get(item.id) || 0 : 0;
  const after = current + (f.type === 'IN' ? 1 : -1) * (Number(f.qty) || 0);

  const save = (another: boolean) => {
    if (!f.itemId) return notify('Please choose the item', 'error');
    if (!f.qty) return notify('Please enter the quantity', 'error');
    if (after < 0) return notify(`Only ${num(current, 2)} in stock`, 'error');
    const rec: StockEntry = { id: uid(), itemId: f.itemId, date: f.date, type: f.type, qty: Number(f.qty), note: f.note.trim() || undefined };
    db.save('stock', rec);
    notify(`${f.type === 'IN' ? 'Added' : 'Taken out'}: ${num(Number(f.qty), 2)} ${item ? itemLabel(item) : ''} — new balance ${num(after, 2)}`);
    if (another) {
      // keep IN/OUT, date and note; clear the item and quantity for the next line
      setF({ ...f, itemId: '', qty: '' });
      setSaved((n) => n + 1);
    } else onClose();
  };

  return (
    <Modal
      title="Stock IN / OUT"
      onClose={onClose}
      width={600}
      footer={
        <>
          <span className="muted small">{saved > 0 ? `${saved} saved` : ''}</span>
          <span className="spacer" />
          <button className="btn" onClick={onClose}>{saved ? 'Done' : 'Cancel'}</button>
          <button className="btn" onClick={() => save(true)}>Save & add next</button>
          <button className="btn btn-primary" onClick={() => save(false)}>Save</button>
        </>
      }
    >
      <div className="form">
        <Field label="IN or OUT">
          <div className="inout">
            <button type="button" className={f.type === 'IN' ? 'on-in' : ''} onClick={() => setF({ ...f, type: 'IN' })}>IN (came in)</button>
            <button type="button" className={f.type === 'OUT' ? 'on-out' : ''} onClick={() => setF({ ...f, type: 'OUT' })}>OUT (used / issued)</button>
          </div>
        </Field>
        <Field label="Date">
          <input className="input" type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} />
        </Field>
        <Field label="Item" wide>
          <ItemPicker key={saved} items={db.items} stock={stock} value={f.itemId} onChange={(v) => setF({ ...f, itemId: v })} autoFocus={!itemId} />
        </Field>
        <Field label="Quantity">
          <NumInput value={f.qty} onChange={(v) => setF({ ...f, qty: v })} />
        </Field>
        <Field label="Note" hint={f.type === 'OUT' ? 'e.g. Machine 3 — Design 120' : 'Bought from a supplier? Use Purchases instead.'}>
          <input className="input" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} />
        </Field>
        {item && (
          <Calc
            items={[
              ['In stock now', num(current, 2)],
              [f.type === 'IN' ? '+ IN' : '− OUT', num(Number(f.qty) || 0, 2)],
              ['New balance', num(after, 2), after < 0 ? 'text-danger' : 'text-green'],
            ]}
          />
        )}
      </div>
    </Modal>
  );
}

/* ================= Purchase ================= */
export function PurchaseForm({ purchase, onClose }: { purchase?: Purchase; onClose: () => void }) {
  const db = useStore();
  const [f, setF] = useState({
    date: purchase?.date ?? today(),
    supplier: purchase ? db.suppliers.find((s) => s.id === purchase.supplierId)?.name ?? '' : '',
    itemId: purchase?.itemId ?? '',
    qty: (purchase?.qty ?? '') as number | '',
    rate: (purchase?.rate ?? '') as number | '',
    paid: (purchase?.paid ?? '') as number | '',
    billNo: purchase?.billNo ?? '',
    notes: purchase?.notes ?? '',
  });
  const stock = useMemo(() => stockByItem(db), [db]);
  const amount = (Number(f.qty) || 0) * (Number(f.rate) || 0);
  const isNewSupplier = f.supplier.trim() !== '' && !db.suppliers.some((s) => same(s.name, f.supplier));

  const save = () => {
    if (!f.supplier.trim()) return notify('Please enter the supplier', 'error');
    if (!f.itemId) return notify('Please choose the item', 'error');
    if (!f.qty) return notify('Please enter the quantity', 'error');
    let sup = db.suppliers.find((s) => same(s.name, f.supplier));
    if (!sup) {
      sup = { id: uid(), name: f.supplier.trim() } as Supplier;
      db.save('suppliers', sup);
    }
    db.savePurchase({
      id: purchase?.id ?? uid(),
      date: f.date,
      supplierId: sup.id,
      itemId: f.itemId,
      qty: Number(f.qty),
      rate: Number(f.rate) || 0,
      paid: Number(f.paid) || 0,
      billNo: f.billNo.trim() || undefined,
      notes: f.notes.trim() || undefined,
    });
    notify(purchase ? 'Purchase saved' : 'Purchase added — stock updated');
    onClose();
  };

  const del = async () => {
    if (!purchase || !(await confirmAction('Delete this purchase? Its quantity will also be removed from stock.'))) return;
    db.deletePurchase(purchase.id);
    onClose();
  };

  return (
    <Modal title={purchase ? 'Edit purchase' : 'New purchase'} onClose={onClose} width={620} footer={<FormButtons onSave={save} onCancel={onClose} onDelete={purchase ? del : undefined} />}>
      <div className="form">
        <Field label="Date">
          <input className="input" type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} />
        </Field>
        <Field label="Supplier" hint={isNewSupplier ? 'New supplier — will be added to the list' : undefined}>
          <TextWithList listId="suppliers-list" value={f.supplier} onChange={(v) => setF({ ...f, supplier: v })} options={db.suppliers.map((s) => s.name)} placeholder="Type or pick a name" />
        </Field>
        <Field label="Item" wide>
          <ItemPicker items={db.items} stock={stock} value={f.itemId} onChange={(v) => setF({ ...f, itemId: v, rate: f.rate === '' ? db.items.find((i) => i.id === v)?.rate ?? '' : f.rate })} />
        </Field>
        <Field label="Quantity">
          <NumInput value={f.qty} onChange={(v) => setF({ ...f, qty: v })} />
        </Field>
        <Field label="Rate (Rs)">
          <NumInput value={f.rate} onChange={(v) => setF({ ...f, rate: v })} />
        </Field>
        <Field label="Paid now (Rs)" hint="Leave empty if bought on credit">
          <NumInput value={f.paid} onChange={(v) => setF({ ...f, paid: v })} />
        </Field>
        <Field label="Bill No.">
          <input className="input" value={f.billNo} onChange={(e) => setF({ ...f, billNo: e.target.value })} />
        </Field>
        <Calc items={[['Amount', money(amount)], ['Paid', money(Number(f.paid) || 0)], ['Balance', money(amount - (Number(f.paid) || 0)), amount - (Number(f.paid) || 0) > 0 ? 'text-danger' : '']]} />
        <Field label="Notes" wide>
          <input className="input" value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} />
        </Field>
      </div>
      <p className="hint-line">The quantity is added to Inventory automatically.</p>
    </Modal>
  );
}

/* ================= Expense ================= */
export function ExpenseForm({ expense, onClose }: { expense?: Expense; onClose: () => void }) {
  const db = useStore();
  const [f, setF] = useState({
    date: expense?.date ?? today(),
    title: expense?.title ?? '',
    category: expense?.category ?? '',
    amount: (expense?.amount ?? '') as number | '',
    notes: expense?.notes ?? '',
  });
  const categories = [...new Set([...EXPENSE_CATEGORIES, ...db.expenses.map((e) => e.category)])];
  const save = () => {
    if (!f.title.trim()) return notify('Please enter what the expense was for', 'error');
    if (!f.amount) return notify('Please enter the amount', 'error');
    db.save('expenses', { id: expense?.id ?? uid(), date: f.date, title: f.title.trim(), category: f.category.trim() || 'Other', amount: Number(f.amount), notes: f.notes.trim() || undefined });
    notify('Expense saved');
    onClose();
  };
  const del = async () => {
    if (!expense || !(await confirmAction(`Delete "${expense.title}"?`))) return;
    db.remove('expenses', expense.id);
    onClose();
  };
  return (
    <Modal title={expense ? 'Edit expense' : 'Add expense'} onClose={onClose} width={520} footer={<FormButtons onSave={save} onCancel={onClose} onDelete={expense ? del : undefined} />}>
      <div className="form">
        <Field label="Date">
          <input className="input" type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} />
        </Field>
        <Field label="Amount (Rs)">
          <NumInput value={f.amount} onChange={(v) => setF({ ...f, amount: v })} />
        </Field>
        <Field label="Expense" wide>
          <input className="input" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="e.g. Generator diesel" />
        </Field>
        <Field label="Category">
          <TextWithList listId="exp-cat-list" value={f.category} onChange={(v) => setF({ ...f, category: v })} options={categories} placeholder="Type or pick" />
        </Field>
        <Field label="Notes">
          <input className="input" value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} />
        </Field>
      </div>
    </Modal>
  );
}

/* ================= Payment from customer ================= */
export function PaymentForm({ customerId, onClose }: { customerId?: string; onClose: () => void }) {
  const db = useStore();
  const [f, setF] = useState({ customerId: customerId ?? '', orderId: '', date: today(), amount: '' as number | '', note: '' });
  const later = useMemo(() => laterPaymentsByOrder(db), [db]);
  const bal = f.customerId ? customerAccounts(db).get(f.customerId)?.balance ?? 0 : 0;
  const openOrders = db.orders.filter((o) => o.customerId === f.customerId && o.status !== 'Cancelled' && orderTotal(o) - o.advance - (later.get(o.id) || 0) > 0);
  const save = () => {
    if (!f.customerId) return notify('Please choose the customer', 'error');
    if (!f.amount) return notify('Please enter the amount', 'error');
    db.save('payments', { id: uid(), customerId: f.customerId, orderId: f.orderId || undefined, date: f.date, amount: Number(f.amount), note: f.note.trim() || undefined });
    notify('Payment saved');
    onClose();
  };
  return (
    <Modal title="Receive payment" onClose={onClose} width={520} footer={<FormButtons onSave={save} onCancel={onClose} />}>
      <div className="form">
        <Field label="Customer" wide>
          <Select value={f.customerId} onChange={(v) => setF({ ...f, customerId: v, orderId: '' })} placeholder="Choose customer…" options={[...db.customers].sort((a, b) => a.name.localeCompare(b.name)).map((c) => ({ value: c.id, label: c.name }))} />
        </Field>
        <Field label="For order (optional)" wide>
          <Select
            value={f.orderId}
            onChange={(v) => setF({ ...f, orderId: v })}
            placeholder="General payment"
            options={openOrders.map((o) => ({ value: o.id, label: `Order ${o.orderNo} · Design ${o.designNo} · balance ${money(orderTotal(o) - o.advance - (later.get(o.id) || 0))}` }))}
          />
        </Field>
        <Field label="Date">
          <input className="input" type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} />
        </Field>
        <Field label="Amount (Rs)">
          <NumInput value={f.amount} onChange={(v) => setF({ ...f, amount: v })} />
        </Field>
        <Field label="Note" wide>
          <input className="input" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} placeholder="Cash, bank, cheque…" />
        </Field>
        {f.customerId && <Calc items={[['Balance now', money(bal)], ['After this payment', money(bal - (Number(f.amount) || 0))]]} />}
      </div>
    </Modal>
  );
}

/* ================= Payment to supplier ================= */
export function SupplierPaymentForm({ supplierId, onClose }: { supplierId?: string; onClose: () => void }) {
  const db = useStore();
  const [f, setF] = useState({ supplierId: supplierId ?? '', date: today(), amount: '' as number | '', note: '' });
  const bal = f.supplierId ? supplierAccounts(db).get(f.supplierId)?.balance ?? 0 : 0;
  const save = () => {
    if (!f.supplierId) return notify('Please choose the supplier', 'error');
    if (!f.amount) return notify('Please enter the amount', 'error');
    db.save('supplierPayments', { id: uid(), supplierId: f.supplierId, date: f.date, amount: Number(f.amount), note: f.note.trim() || undefined });
    notify('Payment saved');
    onClose();
  };
  return (
    <Modal title="Pay supplier" onClose={onClose} width={520} footer={<FormButtons onSave={save} onCancel={onClose} />}>
      <div className="form">
        <Field label="Supplier" wide>
          <Select value={f.supplierId} onChange={(v) => setF({ ...f, supplierId: v })} placeholder="Choose supplier…" options={db.suppliers.map((s) => ({ value: s.id, label: s.name }))} />
        </Field>
        <Field label="Date">
          <input className="input" type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} />
        </Field>
        <Field label="Amount (Rs)">
          <NumInput value={f.amount} onChange={(v) => setF({ ...f, amount: v })} />
        </Field>
        <Field label="Note" wide>
          <input className="input" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} placeholder="Cash, bank, cheque…" />
        </Field>
        {f.supplierId && <Calc items={[['Balance now', money(bal)], ['After this payment', money(bal - (Number(f.amount) || 0))]]} />}
      </div>
    </Modal>
  );
}
