import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ClipboardList, Factory, ArrowLeftRight, ShoppingCart, Receipt, Wallet } from 'lucide-react';
import { Badge, Box, PageHeader, Sheet } from '../components/ui';
import { ExpenseForm, OrderForm, PaymentForm, ProductionForm, PurchaseForm, StockForm } from '../components/forms';
import { MonthExportButton } from '../components/MonthExport';
import { useStore } from '../store/store';
import { byId, customerAccounts, lowStock, stockByItem, supplierAccounts } from '../store/selectors';
import { addDays, currentMonth, fmtMonth, fmtShort, money, num, today } from '../lib/format';

type Form = 'order' | 'production' | 'stock' | 'purchase' | 'expense' | 'payment' | null;

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** Day-to-day view: what to enter, what is due, what is low, who owes what. */
export default function Dashboard() {
  const db = useStore();
  const nav = useNavigate();
  const [form, setForm] = useState<Form>(null);
  const T = today();
  const month = currentMonth();
  const monthName = fmtMonth(month).split(' ')[0];

  const custs = useMemo(() => byId(db.customers), [db.customers]);
  const machines = useMemo(() => byId(db.machines), [db.machines]);
  const emp = useMemo(() => byId(db.employees), [db.employees]);
  const stock = useMemo(() => stockByItem(db), [db]);
  const low = useMemo(() => lowStock(db), [db]);
  const cAcc = useMemo(() => customerAccounts(db), [db]);
  const sAcc = useMemo(() => supplierAccounts(db), [db]);

  const open = db.orders.filter((o) => !['Delivered', 'Cancelled'].includes(o.status));
  const due = open.filter((o) => o.deliveryDate <= addDays(T, 7)).sort((a, b) => a.deliveryDate.localeCompare(b.deliveryDate));
  const prodToday = db.production
    .filter((p) => p.date === T)
    .sort((a, b) => (machines.get(a.machineId)?.name ?? '').localeCompare(machines.get(b.machineId)?.name ?? '', undefined, { numeric: true }));
  const monthExp = db.expenses.filter((e) => e.date.slice(0, 7) === month);
  const recentExp = [...monthExp].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6);
  const stockValue = db.items.reduce((s, i) => s + (stock.get(i.id) || 0) * i.rate, 0);
  const toReceive = db.customers.map((c) => ({ id: c.id, name: c.name, bal: cAcc.get(c.id)?.balance ?? 0 })).filter((x) => x.bal > 0).sort((a, b) => b.bal - a.bal);
  const toPay = db.suppliers.map((s) => ({ id: s.id, name: s.name, bal: sAcc.get(s.id)?.balance ?? 0 })).filter((x) => x.bal > 0).sort((a, b) => b.bal - a.bal);
  const sumBal = (l: { bal: number }[]) => l.reduce((s, x) => s + x.bal, 0);

  const figures: { label: string; value: string; to: string; red?: boolean }[] = [
    { label: 'Orders in hand', value: num(open.length), to: '/orders' },
    { label: 'Production today', value: `${num(prodToday.reduce((s, p) => s + p.quantity, 0))} pcs`, to: '/production' },
    { label: `Expenses in ${monthName}`, value: money(monthExp.reduce((s, e) => s + e.amount, 0)), to: '/expenses' },
    { label: 'Stock value', value: money(stockValue), to: '/inventory' },
    { label: 'To receive', value: money(sumBal(toReceive)), to: '/customers' },
    { label: 'To pay', value: money(sumBal(toPay)), to: '/purchases?tab=suppliers' },
  ];

  const quick: [Form, string, typeof ClipboardList][] = [
    ['order', 'New order', ClipboardList],
    ['production', 'Add production', Factory],
    ['stock', 'Stock IN / OUT', ArrowLeftRight],
    ['purchase', 'New purchase', ShoppingCart],
    ['expense', 'Add expense', Receipt],
    ['payment', 'Receive payment', Wallet],
  ];
  const d = new Date();

  return (
    <div className="stack" style={{ gap: 20 }}>
      <PageHeader
        title={
          <>
            Today
            <span className="sub">{WEEKDAYS[d.getDay()]}, {d.getDate()} {fmtMonth(month)}</span>
          </>
        }
        actions={<MonthExportButton />}
      />

      <div className="quick">
        {quick.map(([id, label, Icon]) => (
          <button key={id} onClick={() => setForm(id)}>
            <span className="qi"><Icon size={17} /></span> {label}
          </button>
        ))}
      </div>

      <div className="figures">
        {figures.map((f) => (
          <div key={f.label} className="figure" onClick={() => nav(f.to)} role="button" tabIndex={0}>
            <span>{f.label}</span>
            <strong className={f.red ? 'red' : ''}>{f.value}</strong>
          </div>
        ))}
      </div>

      <div className="two-col">
        <Box title={<>Deliveries due <span className="count">{due.length}</span></>} actions={<button className="box-link" onClick={() => nav('/orders')}>All orders</button>}>
          <Sheet
            rows={due.slice(0, 7)}
            onRowClick={(o) => nav(`/orders?open=${o.id}`)}
            empty="Nothing due in the next 7 days"
            cols={[
              { label: 'Order', cell: (o) => <span className="strong">{o.orderNo}</span> },
              { label: 'Customer', cell: (o) => custs.get(o.customerId)?.name },
              { label: 'Design', cell: (o) => o.designNo },
              { label: 'Due', cell: (o) => <span className={o.deliveryDate < T ? 'text-danger strong nowrap' : 'nowrap'}>{o.deliveryDate < T ? 'Late · ' : ''}{fmtShort(o.deliveryDate)}</span> },
              { label: 'Status', cell: (o) => <Badge>{o.status}</Badge> },
            ]}
          />
        </Box>

        <Box title={<>Low stock <span className={`count ${low.length ? 'red' : ''}`}>{low.length}</span></>} actions={<button className="box-link" onClick={() => nav('/inventory?filter=low')}>Inventory</button>}>
          <Sheet
            rows={low.slice(0, 7).map((x) => ({ id: x.item.id, ...x }))}
            onRowClick={(r) => nav(`/inventory?item=${r.id}`)}
            empty="All stock is above its alert level"
            cols={[
              { label: 'Item', cell: (r) => <><span className="muted small">{r.item.category} · </span>{r.item.name} {r.item.type} — {r.item.code}</> },
              { label: 'In stock', num: true, cell: (r) => <span className="text-danger strong">{num(r.qty, 2)}</span> },
              { label: 'Alert at', num: true, cell: (r) => <span className="muted">{num(r.item.minQty ?? 0)}</span> },
            ]}
          />
        </Box>

        <Box title={<>Today’s production <span className="count">{num(prodToday.reduce((s, p) => s + p.quantity, 0))} pcs</span></>} actions={<button className="box-link" onClick={() => nav('/production')}>Production</button>}>
          <Sheet
            rows={prodToday}
            onRowClick={() => nav('/production')}
            empty="No production entered today yet"
            cols={[
              { label: 'Machine', cell: (p) => machines.get(p.machineId)?.name },
              { label: 'Design', cell: (p) => <span className="strong">{p.designNo}</span> },
              { label: 'Operator', cell: (p) => (p.operatorId ? emp.get(p.operatorId)?.name : '—') },
              { label: 'Produced', num: true, cell: (p) => num(p.quantity), total: (l) => num(l.reduce((s, p) => s + p.quantity, 0)) },
            ]}
          />
        </Box>

        <Box title={<>Recent expenses <span className="count">{monthName}: {money(monthExp.reduce((s, e) => s + e.amount, 0))}</span></>} actions={<button className="box-link" onClick={() => nav('/expenses')}>Expenses</button>}>
          <Sheet
            rows={recentExp}
            onRowClick={(e) => nav(`/expenses?open=${e.id}`)}
            empty={`No expenses entered in ${monthName}`}
            cols={[
              { label: 'Date', cell: (e) => <span className="nowrap">{fmtShort(e.date)}</span> },
              { label: 'Expense', cell: (e) => e.title },
              { label: 'Category', cell: (e) => <span className="muted">{e.category}</span> },
              { label: 'Amount', num: true, cell: (e) => num(e.amount) },
            ]}
          />
        </Box>

        <Box title="Customers — to receive" actions={<button className="box-link" onClick={() => nav('/customers')}>Customers</button>}>
          <Sheet
            rows={toReceive.slice(0, 6)}
            onRowClick={(c) => nav(`/customers?open=${c.id}`)}
            empty="Nobody owes anything"
            cols={[
              { label: 'Customer', cell: (c) => c.name },
              { label: 'Balance', num: true, cell: (c) => <span className="strong">{num(c.bal)}</span>, total: () => num(sumBal(toReceive)) },
            ]}
          />
        </Box>

        <Box title="Suppliers — to pay" actions={<button className="box-link" onClick={() => nav('/purchases?tab=suppliers')}>Suppliers</button>}>
          <Sheet
            rows={toPay.slice(0, 6)}
            onRowClick={(s) => nav(`/purchases?supplier=${s.id}`)}
            empty="Nothing to pay"
            cols={[
              { label: 'Supplier', cell: (s) => s.name },
              { label: 'Remaining', num: true, cell: (s) => <span className="strong">{num(s.bal)}</span>, total: () => num(sumBal(toPay)) },
            ]}
          />
        </Box>
      </div>

      {form === 'order' && <OrderForm onClose={() => setForm(null)} />}
      {form === 'production' && <ProductionForm onClose={() => setForm(null)} />}
      {form === 'stock' && <StockForm type="IN" onClose={() => setForm(null)} />}
      {form === 'purchase' && <PurchaseForm onClose={() => setForm(null)} />}
      {form === 'expense' && <ExpenseForm onClose={() => setForm(null)} />}
      {form === 'payment' && <PaymentForm onClose={() => setForm(null)} />}
    </div>
  );
}
