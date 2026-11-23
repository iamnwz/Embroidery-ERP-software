import { useMemo, useState } from 'react';
import { Plus, Download } from 'lucide-react';
import { Badge, Chips, PageHeader, SearchBox, Sheet, type Col } from '../components/ui';
import { OrderForm } from '../components/forms';
import { useStore } from '../store/store';
import { byId, laterPaymentsByOrder, orderBalance, orderTotal } from '../store/selectors';
import { ORDER_STATUSES } from '../config';
import { fmtShort, matches, money, num, today } from '../lib/format';
import { downloadCSV } from '../lib/files';
import { useLinkParams } from '../lib/useParams';
import type { Order } from '../types';

export default function OrdersPage() {
  const db = useStore();
  const [status, setStatus] = useState<string>('All');
  const [q, setQ] = useState('');
  const [edit, setEdit] = useState<Order | 'new' | null>(null);
  const custs = useMemo(() => byId(db.customers), [db.customers]);
  const later = useMemo(() => laterPaymentsByOrder(db), [db]);
  const T = today();
  useLinkParams(['open'], (p) => {
    const o = db.orders.find((x) => x.id === p.get('open'));
    if (o) setEdit(o);
  });

  const rows = db.orders
    .filter((o) => status === 'All' || o.status === status)
    .filter((o) => matches(q, o.orderNo, o.designNo, o.garment, custs.get(o.customerId)?.name, o.notes))
    .sort((a, b) => b.date.localeCompare(a.date) || b.orderNo.localeCompare(a.orderNo));

  const sum = (f: (o: Order) => number) => (list: Order[]) => list.reduce((s, o) => s + (o.status === 'Cancelled' ? 0 : f(o)), 0);

  const cols: Col<Order>[] = [
    { label: 'Order No.', cell: (o) => <span className="strong">{o.orderNo}</span> },
    { label: 'Date', cell: (o) => <span className="nowrap">{fmtShort(o.date)}</span> },
    { label: 'Customer', cell: (o) => custs.get(o.customerId)?.name },
    { label: 'Design', cell: (o) => <span className="strong">{o.designNo}</span> },
    { label: 'Garment', cell: (o) => o.garment },
    { label: 'Pic', cell: (o) => (o.referenceImage ? <img className="thumb" src={o.referenceImage} alt="" /> : null) },
    { label: 'Qty', num: true, cell: (o) => num(o.quantity), total: (l) => num(l.reduce((s, o) => s + o.quantity, 0)) },
    { label: 'Rate', num: true, cell: (o) => num(o.rate) },
    { label: 'Total', num: true, cell: (o) => num(orderTotal(o)), total: (l) => num(sum(orderTotal)(l)) },
    {
      label: 'Advance',
      num: true,
      cell: (o) => (
        <>
          {num(o.advance)}
          {later.get(o.id) ? <span className="sub">+ {num(later.get(o.id)!)} later</span> : null}
        </>
      ),
      total: (l) => num(sum((o) => o.advance + (later.get(o.id) || 0))(l)),
    },
    { label: 'Balance', num: true, cell: (o) => num(orderBalance(o, later)), className: (o) => (orderBalance(o, later) > 0 ? 'text-danger strong' : ''), total: (l) => num(sum((o) => orderBalance(o, later))(l)) },
    {
      label: 'Delivery',
      cell: (o) => <span className={`nowrap ${o.deliveryDate < T && !['Delivered', 'Cancelled', 'Completed'].includes(o.status) ? 'text-danger strong' : ''}`}>{fmtShort(o.deliveryDate)}</span>,
    },
    { label: 'Status', cell: (o) => <Badge>{o.status}</Badge> },
  ];

  const exportCSV = () =>
    downloadCSV(
      `orders-${T}.csv`,
      ['Order No', 'Date', 'Customer', 'Design', 'Garment', 'Quantity', 'Rate', 'Total', 'Advance', 'Paid later', 'Balance', 'Delivery', 'Status', 'Notes'],
      rows.map((o) => [o.orderNo, o.date, custs.get(o.customerId)?.name ?? '', o.designNo, o.garment ?? '', o.quantity, o.rate, orderTotal(o), o.advance, later.get(o.id) || 0, orderBalance(o, later), o.deliveryDate, o.status, o.notes ?? '']),
    );

  const count = (s: string) => (s === 'All' ? db.orders.length : db.orders.filter((o) => o.status === s).length);

  return (
    <>
      <PageHeader
        title="Orders"
        actions={
          <>
            <button className="btn" onClick={exportCSV}><Download size={16} /> Excel</button>
            <button className="btn btn-primary" onClick={() => setEdit('new')}><Plus size={16} /> New order</button>
          </>
        }
      />
      <div className="toolbar">
        <Chips options={['All', ...ORDER_STATUSES].map((s) => ({ id: s, label: s, count: count(s) }))} value={status} onChange={setStatus} />
      </div>
      <div className="toolbar">
        <SearchBox value={q} onChange={setQ} placeholder="Search order no, customer, design, garment…" />
        <span className="summary">
          {rows.length} orders · Balance <b>{money(sum((o) => orderBalance(o, later))(rows))}</b>
        </span>
      </div>
      <Sheet cols={cols} rows={rows} onRowClick={(o) => setEdit(o)} empty="No orders found" />
      <p className="hint-line">Click any row to see or change the order. Red delivery date = late.</p>
      {edit && <OrderForm order={edit === 'new' ? undefined : edit} onClose={() => setEdit(null)} />}
    </>
  );
}
