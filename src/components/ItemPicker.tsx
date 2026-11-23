import { useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { Search, X } from 'lucide-react';
import type { InventoryItem } from '../types';
import { matches, num } from '../lib/format';
import { isLow } from '../store/selectors';

/**
 * Type a few letters (name, type, code or category) and pick the stock item.
 * Shows the current stock next to every item so you never have to look it up.
 */
export function ItemPicker({
  items,
  stock,
  value,
  onChange,
  autoFocus,
}: {
  items: InventoryItem[];
  stock: Map<string, number>;
  value: string;
  onChange: (id: string) => void;
  autoFocus?: boolean;
}) {
  const selected = items.find((i) => i.id === value);
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const list = useMemo(() => items.filter((i) => matches(q, i.category, i.name, i.type, i.code)).slice(0, 40), [items, q]);

  const pick = (i: InventoryItem) => {
    onChange(i.id);
    setQ('');
    setOpen(false);
  };

  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setHi((h) => Math.min(list.length - 1, h + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHi((h) => Math.max(0, h - 1));
    } else if (e.key === 'Enter' && open && list[hi]) {
      e.preventDefault();
      pick(list[hi]);
    } else if (e.key === 'Escape' && open) {
      e.stopPropagation();
      setOpen(false);
    }
  };

  return (
    <div className="picker">
      {selected && !open ? (
        <button type="button" className="picker-selected" onClick={() => { setOpen(true); setTimeout(() => inputRef.current?.focus(), 0); }}>
          <span>
            <span className="muted">{selected.category} · </span>
            <b>{selected.name} {selected.type}</b> — {selected.code}
          </span>
          <span className="picker-stock">In stock: <b>{num(stock.get(selected.id) || 0, 2)}</b></span>
          <X size={14} className="muted" />
        </button>
      ) : (
        <div className="picker-input">
          <Search size={16} />
          <input
            ref={inputRef}
            className="input"
            value={q}
            autoFocus={autoFocus}
            placeholder="Type item name, type or code — e.g. seq 301"
            onChange={(e) => {
              setQ(e.target.value);
              setHi(0);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
            onKeyDown={onKey}
          />
        </div>
      )}
      {open && (
        <div className="picker-list" role="listbox">
          {list.length === 0 ? (
            <div className="picker-empty">No item found. Add it first on the Inventory page.</div>
          ) : (
            list.map((i, k) => {
              const qty = stock.get(i.id) || 0;
              return (
                <div
                  key={i.id}
                  role="option"
                  aria-selected={k === hi}
                  className={`picker-row ${k === hi ? 'hi' : ''}`}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    pick(i);
                  }}
                  onMouseEnter={() => setHi(k)}
                >
                  <span className="picker-cat">{i.category}</span>
                  <span className="picker-name">
                    {i.name} {i.type} <span className="muted">— {i.code}</span>
                  </span>
                  <span className={`picker-qty ${isLow(i, qty) ? 'text-danger' : ''}`}>{num(qty, 2)}</span>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
