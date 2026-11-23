import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus, Download, Trash2, Pencil } from 'lucide-react';
import { Chips, Field, FormButtons, Modal, NumInput, PageHeader, SearchBox, Select, Sheet, confirmAction, type Col } from '../components/ui';
import { StockForm, itemLabel } from '../components/forms';
import { notify } from '../components/ui/toast';
import { useStore } from '../store/store';
import { isLow, stockForMonth } from '../store/selectors';
import { INVENTORY_CATEGORIES } from '../config';
import { currentMonth, fmtShort, matches, money, num, today, uid } from '../lib/format';
import { downloadCSV } from '../lib/files';
import type { InventoryItem } from '../types';

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export default function InventoryPage() {
  const db = useStore();
  const [params, setParams] = useSearchParams();
  const [view, setView] = useState<string>(params.get('filter') === 'low' ? 'LOW' : 'ALL');
  const [q, setQ] = useState('');
  const [move, setMove] = useState<{ type: 'IN' | 'OUT'; itemId?: string } | null>(null);
  const [edit, setEdit] = useState<InventoryItem | 'new' | null>(null);
  const [register, setRegister] = useState<string | null>(null);
  const month = currentMonth();
  const monthName = MONTH_NAMES[Number(month.slice(5)) - 1];
  const lines = useMemo(() => stockForMonth(db, month), [db, month]);
  const categories = useMemo(() => [...new Set([...INVENTORY_CATEGORIES, ...db.items.map((i) => i.category)])], [db.items]);

  // opened from search / dashboard: ?item=<id> or ?filter=low
  useEffect(() => {
    const id = params.get('item');
    const f = params.get('filter');
    if (!id && !f) return;
    if (id) setRegister(id);
    if (f === 'low') setView('LOW');
    setParams({}, { replace: true });
  }, [params, setParams]);

  const bal = (i: InventoryItem) => lines.get(i.id)?.balance ?? 0;
  const low = (i: InventoryItem) => isLow(i, bal(i));
  const lowCount = db.items.filter(low).length;

  const rows = db.items
    .filter((i) => (view === 'ALL' ? true : view === 'LOW' ? low(i) : i.category === view))
    .filter((i) => matches(q, i.category, i.name, i.type, i.code))
    .sort((a, b) => categories.indexOf(a.category) - categories.indexOf(b.category) || a.name.localeCompare(b.name) || a.code.localeCompare(b.code, undefined, { numeric: true }));
  const value = rows.reduce((s, i) => s + bal(i) * i.rate, 0);
  const showCat = view === 'ALL' || view === 'LOW';

  const cols: Col<InventoryItem>[] = [
    ...(showCat ? [{ label: 'Category', cell: (i: InventoryItem) => <span className="muted">{i.category}</span> }] : []),
    { label: 'Item', cell: (i) => <span className="strong">{i.name}</span> },
    { label: 'Type', cell: (i) => i.type },
    { label: 'Code', cell: (i) => i.code },
    { label: `Opening 1 ${monthName}`, num: true, cell: (i) => <span className="muted">{num(lines.get(i.id)?.opening ?? 0, 2)}</span> },
    { label: 'IN', num: true, cell: (i) => (lines.get(i.id)?.in ? <span className="text-green">+{num(lines.get(i.id)!.in, 2)}</span> : <span className="muted">—</span>) },
    { label: 'OUT', num: true, cell: (i) => (lines.get(i.id)?.out ? <span>−{num(lines.get(i.id)!.out, 2)}</span> : <span className="muted">—</span>) },
    {
      label: 'Balance',
      num: true,
      cell: (i) => (
        <span className={low(i) ? 'text-danger strong' : 'strong'}>
          {low(i) && <span className="badge badge-red" style={{ marginRight: 6 }}>Low</span>}
          {num(bal(i), 2)}
          {i.unit && <span className="muted" style={{ fontWeight: 400 }}> {i.unit}</span>}
        </span>
      ),
    },
    { label: 'Rate', num: true, cell: (i) => num(i.rate, 2) },
    { label: 'Amount', num: true, cell: (i) => num(bal(i) * i.rate), total: () => num(value) },
    {
      label: ' ',
      cell: (i) => (
        <span onClick={(e) => e.stopPropagation()}>
          <button className="btn" onClick={() => setMove({ type: 'IN', itemId: i.id })}>IN</button>{' '}
          <button className="btn" onClick={() => setMove({ type: 'OUT', itemId: i.id })}>OUT</button>
        </span>
      ),
      className: () => 'act',
    },
  ];

  const exportCSV = () =>
    downloadCSV(
      `stock-${today()}.csv`,
      ['Category', 'Item', 'Type', 'Code', `Opening 1 ${monthName}`, 'IN', 'OUT', 'Balance', 'Unit', 'Rate', 'Amount', 'Low stock at'],
      rows.map((i) => {
        const l = lines.get(i.id);
        return [i.category, i.name, i.type, i.code, l?.opening ?? 0, l?.in ?? 0, l?.out ?? 0, bal(i), i.unit ?? '', i.rate, bal(i) * i.rate, i.minQty ?? ''];
      }),
    );

  const chipOpts = [
    { id: 'ALL', label: 'All', count: db.items.length },
    ...categories.map((c) => ({ id: c, label: c, count: db.items.filter((i) => i.category === c).length })),
    { id: 'LOW', label: '⚠ Low stock', count: lowCount },
  ];

  return (
    <>
      <PageHeader
        title="Inventory"
        actions={
          <>
            <button className="btn" onClick={exportCSV}><Download size={16} /> Excel</button>
            <button className="btn" onClick={() => setEdit('new')}><Plus size={16} /> Add item</button>
            <button className="btn btn-primary" onClick={() => setMove({ type: 'IN' })}>Stock IN / OUT</button>
          </>
        }
      />
      <div className="toolbar">
        <SearchBox value={q} onChange={setQ} placeholder="Find any item — e.g. seq 301, zari gold, needle" />
        <span className="summary">
          Stock value: <b>{money(value)}</b>
          {lowCount > 0 && (
            <>
              {' · '}
              <button className="link-btn text-danger" onClick={() => setView('LOW')}>{lowCount} items low</button>
            </>
          )}
        </span>
      </div>
      <div className="toolbar">
        <Chips options={chipOpts} value={view} onChange={setView} />
      </div>
      <Sheet cols={cols} rows={rows} onRowClick={(i) => setRegister(i.id)} empty={view === 'LOW' ? 'No item is low right now.' : q ? 'No item matches your search.' : 'No items yet — click “Add item”.'} />
      <p className="hint-line">Opening + IN − OUT = Balance (this month). Amount = Balance × Rate. Purchases are added as IN automatically. Click a row to see its full IN / OUT record.</p>

      {register && <ItemRegister itemId={register} onClose={() => setRegister(null)} onMove={(type) => setMove({ type, itemId: register })} onEdit={(i) => setEdit(i)} />}
      {move && <StockForm type={move.type} itemId={move.itemId} onClose={() => setMove(null)} />}
      {edit && <ItemForm item={edit === 'new' ? undefined : edit} category={INVENTORY_CATEGORIES.includes(view) ? view : INVENTORY_CATEGORIES[0]} categories={categories} onClose={() => setEdit(null)} />}
    </>
  );
}

/** IN / OUT / BALANCE record of one item, like a stock register page */
function ItemRegister({ itemId, onClose, onMove, onEdit }: { itemId: string; onClose: () => void; onMove: (t: 'IN' | 'OUT') => void; onEdit: (i: InventoryItem) => void }) {
  const db = useStore();
  const item = db.items.find((i) => i.id === itemId);
  if (!item) return null;
  let bal = item.openingQty;
  const rows = [
    { id: 'open', date: '', detail: 'Opening stock', inQ: item.openingQty, outQ: 0, bal: item.openingQty, entryId: '' },
    ...db.stock
      .filter((s) => s.itemId === itemId)
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((s) => {
        bal += s.type === 'IN' ? s.qty : -s.qty;
        return { id: s.id, date: s.date, detail: s.note || (s.type === 'IN' ? 'Stock in' : 'Stock out'), inQ: s.type === 'IN' ? s.qty : 0, outQ: s.type === 'OUT' ? s.qty : 0, bal, entryId: s.purchaseId ? '' : s.id };
      }),
  ];
  const del = async (id: string) => {
    if (await confirmAction('Delete this stock entry?')) db.remove('stock', id);
  };
  return (
    <Modal
      title={`${itemLabel(item)} (${item.category})`}
      onClose={onClose}
      width={720}
      footer={
        <>
          <button className="btn btn-ghost" onClick={() => onEdit(item)}><Pencil size={14} /> Edit item</button>
          <span className="spacer" />
          <button className="btn" onClick={() => onMove('IN')}>+ IN</button>
          <button className="btn" onClick={() => onMove('OUT')}>− OUT</button>
          <button className="btn btn-primary" onClick={onClose}>Close</button>
        </>
      }
    >
      <div className="calc" style={{ marginBottom: 12 }}>
        <div><span>Balance now</span><strong className={isLow(item, bal) ? 'text-danger' : ''}>{num(bal, 2)} {item.unit ?? ''}</strong></div>
        <div><span>Rate</span><strong>{money(item.rate)}</strong></div>
        <div><span>Amount</span><strong>{money(bal * item.rate)}</strong></div>
        <div><span>Low stock at</span><strong>{item.minQty ? num(item.minQty) : '—'}</strong></div>
      </div>
      <Sheet
        cols={[
          { label: 'Date', cell: (r) => <span className="nowrap">{r.date ? fmtShort(r.date) : '—'}</span> },
          { label: 'Detail', cell: (r) => r.detail },
          { label: 'IN', num: true, cell: (r) => (r.inQ ? <span className="text-green">{num(r.inQ, 2)}</span> : '') },
          { label: 'OUT', num: true, cell: (r) => (r.outQ ? num(r.outQ, 2) : '') },
          { label: 'BALANCE', num: true, cell: (r) => <span className="strong">{num(r.bal, 2)}</span> },
          { label: ' ', cell: (r) => (r.entryId ? <button className="icon-btn" onClick={() => del(r.entryId)} aria-label="Delete entry"><Trash2 size={14} /></button> : null), className: () => 'act' },
        ]}
        rows={rows}
      />
      <p className="hint-line">Purchase entries are changed from the Purchases page.</p>
    </Modal>
  );
}

function ItemForm({ item, category, categories, onClose }: { item?: InventoryItem; category: string; categories: string[]; onClose: () => void }) {
  const db = useStore();
  const [f, setF] = useState({
    category: item?.category ?? category,
    name: item?.name ?? '',
    type: item?.type ?? '',
    code: item?.code ?? '',
    unit: item?.unit ?? '',
    openingQty: (item?.openingQty ?? '') as number | '',
    rate: (item?.rate ?? '') as number | '',
    minQty: (item?.minQty ?? '') as number | '',
  });
  const save = () => {
    if (!f.name.trim()) return notify('Please enter the item name', 'error');
    const dup = db.items.find((i) => i.id !== item?.id && f.code.trim() && i.category === f.category && i.code.trim().toLowerCase() === f.code.trim().toLowerCase());
    if (dup) return notify(`Code ${f.code} is already used by ${itemLabel(dup)}`, 'error');
    db.save('items', {
      id: item?.id ?? uid(),
      category: f.category,
      name: f.name.trim(),
      type: f.type.trim(),
      code: f.code.trim(),
      unit: f.unit.trim() || undefined,
      openingQty: Number(f.openingQty) || 0,
      rate: Number(f.rate) || 0,
      minQty: f.minQty === '' ? undefined : Number(f.minQty),
    });
    notify(item ? 'Item saved' : 'Item added');
    onClose();
  };
  const del = async () => {
    if (!item) return;
    if (db.stock.some((s) => s.itemId === item.id) || db.purchases.some((p) => p.itemId === item.id)) return notify('This item has IN/OUT entries, so it cannot be deleted.', 'error');
    if (await confirmAction(`Delete ${item.name} ${item.type}?`)) {
      db.remove('items', item.id);
      onClose();
    }
  };
  return (
    <Modal title={item ? 'Edit item' : 'Add item'} onClose={onClose} width={520} footer={<FormButtons onSave={save} onCancel={onClose} onDelete={item ? del : undefined} />}>
      <div className="form">
        <Field label="Category">
          <Select value={f.category} onChange={(v) => setF({ ...f, category: v })} options={categories} />
        </Field>
        <Field label="Item">
          <input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="e.g. Sequin" />
        </Field>
        <Field label="Type">
          <input className="input" value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })} placeholder="e.g. Plane, Cup" />
        </Field>
        <Field label="Code">
          <input className="input" value={f.code} onChange={(e) => setF({ ...f, code: e.target.value })} placeholder="e.g. 301" />
        </Field>
        <Field label="Rate (Rs)">
          <NumInput value={f.rate} onChange={(v) => setF({ ...f, rate: v })} />
        </Field>
        <Field label="Unit (optional)">
          <input className="input" value={f.unit} onChange={(e) => setF({ ...f, unit: e.target.value })} placeholder="kg, cone, meter…" />
        </Field>
        <Field label="Opening stock" hint={item ? 'Quantity at the start. Use IN / OUT for changes.' : 'Quantity in store right now'}>
          <NumInput value={f.openingQty} onChange={(v) => setF({ ...f, openingQty: v })} />
        </Field>
        <Field label="Low stock alert at" hint="Shows “Low” when balance reaches this. Leave empty for no alert.">
          <NumInput value={f.minQty} onChange={(v) => setF({ ...f, minQty: v })} />
        </Field>
      </div>
    </Modal>
  );
}
