import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { SearchBox } from './ui';
import { useStore } from '../store/store';
import { byId, customerAccounts, isLow, orderTotal, stockByItem, supplierAccounts } from '../store/selectors';
import { fmtShort, matches, money, num } from '../lib/format';

interface Hit {
  key: string;
  title: string;
  right: string;
  to: string;
  danger?: boolean;
}

/** One box that searches everything: orders, designs, customers, stock, suppliers, employees, expenses, production. */
export function GlobalSearch() {
  const db = useStore();
  const nav = useNavigate();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);

  // close the results when clicking anywhere else
  useEffect(() => {
    const h = (e: MouseEvent) => !wrap.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  // Ctrl+K or "/" jumps to the search box
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const typing = ['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName);
      if ((e.ctrlKey && e.key.toLowerCase() === 'k') || (e.key === '/' && !typing)) {
        e.preventDefault();
        wrap.current?.querySelector('input')?.focus();
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);

  const groups = useMemo(() => {
    if (!q.trim()) return [];
    const custs = byId(db.customers);
    const machines = byId(db.machines);
    const emp = byId(db.employees);
    const stock = stockByItem(db);
    const cAcc = customerAccounts(db);
    const sAcc = supplierAccounts(db);
    const take = (l: Hit[]) => l.slice(0, 6);
    // only look inside phone numbers when a real part of a number is typed (4+ digits)
    const ph = (phone?: string) => (q.replace(/\D/g, '').length >= 4 ? phone?.replace(/\D/g, '') : undefined);

    const orders = take(
      db.orders
        .filter((o) => matches(q, 'order', o.orderNo, 'design', o.designNo, o.garment, custs.get(o.customerId)?.name, o.notes, o.status))
        .sort((a, b) => b.date.localeCompare(a.date))
        .map((o) => ({ key: o.id, title: `Order ${o.orderNo} · Design ${o.designNo}${o.garment ? ` · ${o.garment}` : ''} — ${custs.get(o.customerId)?.name ?? ''}`, right: `${o.status} · ${money(orderTotal(o))}`, to: `/orders?open=${o.id}` })),
    );
    const items = take(
      db.items
        .filter((i) => matches(q, i.category, i.name, i.type, i.code))
        .map((i) => {
          const s = stock.get(i.id) || 0;
          return { key: i.id, title: `${i.category} · ${i.name} ${i.type} — ${i.code}`, right: `In stock: ${num(s, 2)}${isLow(i, s) ? ' (low)' : ''}`, to: `/inventory?item=${i.id}`, danger: isLow(i, s) };
        }),
    );
    const customers = take(
      db.customers
        .filter((c) => matches(q, c.name, ph(c.phone), c.city))
        .map((c) => ({ key: c.id, title: `${c.name}${c.city ? ` — ${c.city}` : ''}`, right: `Balance ${money(cAcc.get(c.id)?.balance ?? 0)}`, to: `/customers?open=${c.id}` })),
    );
    const suppliers = take(
      db.suppliers
        .filter((s) => matches(q, s.name, ph(s.phone), s.city))
        .map((s) => ({ key: s.id, title: `${s.name}${s.city ? ` — ${s.city}` : ''}`, right: `Remaining ${money(sAcc.get(s.id)?.balance ?? 0)}`, to: `/purchases?supplier=${s.id}` })),
    );
    const employees = take(
      db.employees
        .filter((e) => matches(q, e.name, e.designation, ph(e.phone)))
        .map((e) => ({ key: e.id, title: e.name, right: `${e.designation} · ${money(e.salary)}`, to: `/employees?open=${e.id}` })),
    );
    const expenses = take(
      db.expenses
        .filter((e) => matches(q, e.title, e.category, e.notes))
        .sort((a, b) => b.date.localeCompare(a.date))
        .map((e) => ({ key: e.id, title: `${e.title} (${e.category})`, right: `${fmtShort(e.date)} · ${money(e.amount)}`, to: `/expenses?open=${e.id}` })),
    );
    // Production: one line per design
    const prodMap = new Map<string, { n: number; qty: number }>();
    for (const p of db.production) {
      if (!matches(q, 'design', p.designNo, machines.get(p.machineId)?.name, p.operatorId ? emp.get(p.operatorId)?.name : '')) continue;
      const x = prodMap.get(p.designNo) ?? { n: 0, qty: 0 };
      x.n++;
      x.qty += p.quantity;
      prodMap.set(p.designNo, x);
    }
    const production = take([...prodMap].map(([d, x]) => ({ key: d, title: `Design ${d} — ${x.n} production entries`, right: `${num(x.qty)} pcs made`, to: `/production?q=${encodeURIComponent(d)}&period=all` })));

    return [
      ['Orders & designs', orders],
      ['Stock items', items],
      ['Customers', customers],
      ['Production', production],
      ['Suppliers', suppliers],
      ['Employees', employees],
      ['Expenses', expenses],
    ].filter(([, l]) => (l as Hit[]).length) as [string, Hit[]][];
  }, [db, q]);

  const all = groups.flatMap(([, l]) => l);
  const go = (h: Hit) => {
    nav(h.to);
    setQ('');
    setOpen(false);
  };

  return (
    <div
      className="gsearch"
      ref={wrap}
      onFocus={() => setOpen(true)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && all[0]) go(all[0]);
        if (e.key === 'Escape') {
          setQ('');
          setOpen(false);
        }
      }}
    >
      <SearchBox value={q} onChange={(v) => { setQ(v); setOpen(true); }} placeholder="Search anything…" />
      {open && q.trim() && (
        <div className="gsearch-panel" role="listbox">
          {groups.length === 0 ? (
            <div className="gsearch-empty">Nothing found for “{q}”.</div>
          ) : (
            groups.map(([title, list]) => (
              <div key={title} className="gsearch-group">
                <h4>{title}</h4>
                {list.map((h) => (
                  <div key={h.key} className={`gsearch-row ${h === all[0] ? 'hi' : ''}`} role="option" onMouseDown={(e) => { e.preventDefault(); go(h); }}>
                    <span className="t">{h.title}</span>
                    <span className={`r ${h.danger ? 'text-danger' : ''}`}>{h.right}</span>
                  </div>
                ))}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
