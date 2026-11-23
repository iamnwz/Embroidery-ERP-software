import { CURRENCY } from '../config';

export const money = (n: number) => `${CURRENCY} ${Math.round(n || 0).toLocaleString('en-US')}`;

export const num = (n: number, digits = 0) =>
  (n || 0).toLocaleString('en-US', { maximumFractionDigits: digits, minimumFractionDigits: 0 });

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "2026-11-17" -> "17 Nov 2026" */
export const fmtDate = (iso?: string) => {
  if (!iso) return '—';
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) return iso;
  return `${d} ${MONTHS[m - 1]} ${y}`;
};

/** "2026-11-18" -> "18 Nov" (adds the year only if it is not this year) */
export const fmtShort = (iso?: string) => {
  if (!iso) return '—';
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) return iso;
  return y === new Date().getFullYear() ? `${d} ${MONTHS[m - 1]}` : `${d} ${MONTHS[m - 1]} ${y}`;
};

export const addMonths = (ym: string, n: number) => {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

/** "2026-11" -> "November 2026" */
export const fmtMonth = (ym: string) => {
  const [y, m] = ym.split('-').map(Number);
  const full = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  return `${full[m - 1]} ${y}`;
};

export const fmtDateTime = (iso: string) => {
  const d = new Date(iso);
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  return `${fmtDate(toISODate(d))}, ${time}`;
};

export const timeAgo = (iso: string) => {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} hr ago`;
  const days = Math.floor(diff / 86400);
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days} days ago`;
  return fmtDate(iso);
};

/** Local date as YYYY-MM-DD */
export const toISODate = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

export const today = () => toISODate(new Date());

export const addDays = (iso: string, days: number) => {
  const [y, m, d] = iso.split('-').map(Number);
  return toISODate(new Date(y, m - 1, d + days));
};

export const daysBetween = (fromIso: string, toIso: string) => {
  const [y1, m1, d1] = fromIso.split('-').map(Number);
  const [y2, m2, d2] = toIso.split('-').map(Number);
  return Math.round((new Date(y2, m2 - 1, d2).getTime() - new Date(y1, m1 - 1, d1).getTime()) / 86400000);
};

export const currentMonth = () => today().slice(0, 7);

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

/** Next sequential number, e.g. nextNo('ORD-', ['ORD-1001']) -> 'ORD-1002' */
export const nextNo = (prefix: string, existing: string[], start = 1001) => {
  const nums = existing
    .filter((s) => s.startsWith(prefix))
    .map((s) => parseInt(s.slice(prefix.length), 10))
    .filter((n) => !isNaN(n));
  return `${prefix}${nums.length ? Math.max(...nums) + 1 : start}`;
};

/** Every word typed must appear somewhere in the fields, so "seq 301" finds Sequin code 301. */
export const matches = (query: string, ...fields: (string | number | undefined)[]) => {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return true;
  const text = fields.filter((f) => f !== undefined && f !== null).join(' ').toLowerCase();
  return words.every((w) => text.includes(w));
};

/** Change from previous to current as a percentage (null when there is nothing to compare) */
export const pctChange = (current: number, previous: number) => (previous ? ((current - previous) / Math.abs(previous)) * 100 : null);
