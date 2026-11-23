import { useEffect, useRef, useState, type ReactNode } from 'react';
import { X, Search } from 'lucide-react';
import { addMonths, currentMonth, fmtMonth, today } from '../../lib/format';

/* ---------- Page title ---------- */
export function PageHeader({ title, actions }: { title: ReactNode; actions?: ReactNode }) {
  return (
    <div className="page-header">
      <h1>{title}</h1>
      {actions && <div className="page-actions">{actions}</div>}
    </div>
  );
}

/* ---------- Simple box with a heading ---------- */
export function Box({ title, actions, children }: { title?: ReactNode; actions?: ReactNode; children: ReactNode }) {
  return (
    <section className="box">
      {(title || actions) && (
        <header className="box-head">
          <h2>{title}</h2>
          {actions}
        </header>
      )}
      {children}
    </section>
  );
}

/* ---------- Sheet: an Excel-style table with row numbers and a total row ---------- */
export interface Col<T> {
  label: string;
  cell: (row: T) => ReactNode;
  num?: boolean;
  total?: (rows: T[]) => ReactNode;
  className?: (row: T) => string;
}
export function Sheet<T extends { id: string }>({
  cols,
  rows,
  onRowClick,
  empty = 'No records yet',
  numbered = true,
  rowClass,
}: {
  cols: Col<T>[];
  rows: T[];
  onRowClick?: (row: T) => void;
  empty?: string;
  numbered?: boolean;
  rowClass?: (row: T) => string;
}) {
  const hasTotal = cols.some((c) => c.total) && rows.length > 0;
  return (
    <div className="sheet-wrap">
      <table className={`sheet ${numbered ? '' : 'no-rn'}`}>
        <thead>
          <tr>
            <th className="rn">#</th>
            {cols.map((c) => (
              <th key={c.label} className={c.num ? 'num' : ''}>{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td className="sheet-empty" colSpan={cols.length + 1}>{empty}</td>
            </tr>
          ) : (
            rows.map((r, i) => (
              <tr key={r.id} className={`${onRowClick ? 'click' : ''} ${rowClass?.(r) ?? ''}`} onClick={onRowClick ? () => onRowClick(r) : undefined}>
                <td className="rn">{i + 1}</td>
                {cols.map((c) => (
                  <td key={c.label} className={`${c.num ? 'num' : ''} ${c.className?.(r) ?? ''}`}>{c.cell(r)}</td>
                ))}
              </tr>
            ))
          )}
        </tbody>
        {hasTotal && (
          <tfoot>
            <tr>
              <td className="rn" />
              {cols.map((c, j) => (
                <td key={c.label} className={c.num ? 'num' : ''}>{c.total ? c.total(rows) : j === 0 ? 'Total' : ''}</td>
              ))}
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}

/* ---------- Status label ---------- */
const TONES: Record<string, string> = {
  Pending: 'gray',
  Designing: 'violet',
  'In Production': 'blue',
  Completed: 'green',
  Delivered: 'slate',
  Cancelled: 'red',
  Paid: 'green',
  Unpaid: 'red',
  IN: 'green',
  OUT: 'amber',
};
export function Badge({ children }: { children: string }) {
  return <span className={`badge badge-${TONES[children] ?? 'gray'}`}>{children}</span>;
}

/* ---------- Tab / filter buttons ---------- */
export function Chips<T extends string>({ options, value, onChange }: { options: { id: T; label: string; count?: number }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="chips" role="tablist">
      {options.map((o) => (
        <button key={o.id} role="tab" aria-selected={value === o.id} className={`chip ${value === o.id ? 'active' : ''}`} onClick={() => onChange(o.id)}>
          {o.label}
          {o.count !== undefined && <span className="chip-count">{o.count}</span>}
        </button>
      ))}
    </div>
  );
}

/* ---------- Period (today / this month / last month / all) ---------- */
export type Period = 'today' | 'month' | 'last' | 'all';
export function inPeriod(date: string, p: Period) {
  if (p === 'all') return true;
  if (p === 'today') return date === today();
  const m = p === 'month' ? currentMonth() : addMonths(currentMonth(), -1);
  return date.slice(0, 7) === m;
}
export function periodLabel(p: Period) {
  return p === 'today' ? 'Today' : p === 'month' ? fmtMonth(currentMonth()) : p === 'last' ? fmtMonth(addMonths(currentMonth(), -1)) : 'All dates';
}
export function PeriodChips({ value, onChange, withToday }: { value: Period; onChange: (p: Period) => void; withToday?: boolean }) {
  const opts: { id: Period; label: string }[] = [
    ...(withToday ? [{ id: 'today' as Period, label: 'Today' }] : []),
    { id: 'month', label: 'This month' },
    { id: 'last', label: 'Last month' },
    { id: 'all', label: 'All' },
  ];
  return <Chips options={opts} value={value} onChange={onChange} />;
}

/* ---------- Modal ---------- */
export function Modal({ title, onClose, children, footer, width = 560 }: { title: string; onClose: () => void; children: ReactNode; footer?: ReactNode; width?: number }) {
  useEscape(onClose);
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: width }} role="dialog" aria-modal="true" aria-label={title}>
        <header className="modal-head">
          <h3>{title}</h3>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </header>
        <div className="modal-body">{children}</div>
        {footer && <footer className="modal-foot">{footer}</footer>}
      </div>
    </div>
  );
}

/** Standard Save / Cancel (+ optional Delete) buttons for a form */
export function FormButtons({ onSave, onCancel, onDelete, saveLabel = 'Save' }: { onSave: () => void; onCancel: () => void; onDelete?: () => void; saveLabel?: string }) {
  return (
    <>
      {onDelete && (
        <button className="btn btn-ghost text-danger" onClick={onDelete}>
          Delete
        </button>
      )}
      <span className="spacer" />
      <button className="btn" onClick={onCancel}>Cancel</button>
      <button className="btn btn-primary" onClick={onSave}>{saveLabel}</button>
    </>
  );
}

// Only the most recently opened dialog reacts to Escape
const escStack: (() => void)[] = [];
let escBound = false;
function useEscape(fn: () => void) {
  const ref = useRef(fn);
  ref.current = fn;
  useEffect(() => {
    if (!escBound) {
      escBound = true;
      window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && escStack.length) escStack[escStack.length - 1]();
      });
    }
    const h = () => ref.current();
    escStack.push(h);
    return () => {
      const i = escStack.indexOf(h);
      if (i >= 0) escStack.splice(i, 1);
    };
  }, []);
}

/* ---------- Confirm dialog ---------- */
let confirmOpener: ((req: ConfirmReq) => void) | null = null;
interface ConfirmReq {
  message: string;
  confirmLabel: string;
  resolve: (ok: boolean) => void;
}
export function confirmAction(message: string, confirmLabel = 'Delete') {
  return new Promise<boolean>((resolve) => {
    if (!confirmOpener) return resolve(window.confirm(message));
    confirmOpener({ message, confirmLabel, resolve });
  });
}
export function ConfirmHost() {
  const [req, setReq] = useState<ConfirmReq | null>(null);
  useEffect(() => {
    confirmOpener = setReq;
    return () => {
      confirmOpener = null;
    };
  }, []);
  if (!req) return null;
  const close = (ok: boolean) => {
    req.resolve(ok);
    setReq(null);
  };
  return (
    <Modal
      title="Please confirm"
      onClose={() => close(false)}
      width={420}
      footer={
        <>
          <span className="spacer" />
          <button className="btn" onClick={() => close(false)}>Cancel</button>
          <button className="btn btn-danger" onClick={() => close(true)} autoFocus>{req.confirmLabel}</button>
        </>
      }
    >
      <p>{req.message}</p>
    </Modal>
  );
}

/* ---------- Form fields ---------- */
export function Field({ label, children, hint, wide }: { label: string; children: ReactNode; hint?: ReactNode; wide?: boolean }) {
  return (
    <label className={`field ${wide ? 'wide' : ''}`}>
      <span className="field-label">{label}</span>
      {children}
      {hint && <span className="field-hint">{hint}</span>}
    </label>
  );
}

export function SearchBox({ value, onChange, placeholder = 'Search…' }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div className="search">
      <Search size={16} />
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
      {value && (
        <button className="icon-btn" onClick={() => onChange('')} aria-label="Clear search">
          <X size={14} />
        </button>
      )}
    </div>
  );
}

export function Select({ value, onChange, options, placeholder }: { value: string; onChange: (v: string) => void; options: (string | { value: string; label: string })[]; placeholder?: string }) {
  return (
    <select className="input" value={value} onChange={(e) => onChange(e.target.value)}>
      {placeholder !== undefined && <option value="">{placeholder}</option>}
      {options.map((o) =>
        typeof o === 'string' ? (
          <option key={o} value={o}>{o}</option>
        ) : (
          <option key={o.value} value={o.value}>{o.label}</option>
        ),
      )}
    </select>
  );
}

/** Text box that suggests existing values but also accepts new ones */
export function TextWithList({ value, onChange, options, placeholder, listId }: { value: string; onChange: (v: string) => void; options: string[]; placeholder?: string; listId: string }) {
  return (
    <>
      <input className="input" list={listId} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
      <datalist id={listId}>
        {options.map((o) => (
          <option key={o} value={o} />
        ))}
      </datalist>
    </>
  );
}

/** Number box that allows an empty value while typing */
export function NumInput({ value, onChange, placeholder }: { value: number | ''; onChange: (v: number | '') => void; placeholder?: string }) {
  return (
    <input
      className="input"
      type="number"
      inputMode="decimal"
      min={0}
      step="any"
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))}
    />
  );
}

/** A small read-only "= amount" box used for calculated values in forms */
export function Calc({ items }: { items: [string, ReactNode, string?][] }) {
  return (
    <div className="calc">
      {items.map(([k, v, cls]) => (
        <div key={k}>
          <span>{k}</span>
          <strong className={cls}>{v}</strong>
        </div>
      ))}
    </div>
  );
}
