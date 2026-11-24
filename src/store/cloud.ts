// Supabase persistence for the whole app.
//
// Reading: after login, every table is loaded once into the in-memory store.
// Writing: the store is watched; whenever a page saves something, only the records that
// were added / changed / deleted are sent to Supabase. Quick edits are combined, saves happen
// in order (parents before children), and failed saves are retried automatically.

import { create } from 'zustand';
import type { DB } from '../types';
import { supabase } from '../lib/supabase';
import { TABLES, fromRow, toRow, type Collection, type TableDef } from './dbSchema';
import { useStore } from './store';
import { notify } from '../components/ui/toast';

/* ---------- save status (shown in the sidebar) ---------- */
export type SaveState = 'saved' | 'saving' | 'error';
export const useSaveStatus = create<{ state: SaveState; pending: number; message?: string }>(() => ({ state: 'saved', pending: 0 }));

const sb = () => {
  if (!supabase) throw new Error('Supabase is not configured');
  return supabase;
};

/* ---------- loading ---------- */
const PAGE = 1000;

async function fetchAll(table: string): Promise<Record<string, unknown>[]> {
  const out: Record<string, unknown>[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await sb().from(table).select('*').order('pos', { ascending: true }).range(from, from + PAGE - 1);
    if (error) throw error;
    out.push(...(data as Record<string, unknown>[]));
    if (!data || data.length < PAGE) break;
  }
  return out;
}

export async function loadAll(): Promise<DB> {
  const [settingsRes, ...rows] = await Promise.all([
    sb().from('settings').select('factory_name').eq('id', 1).maybeSingle(),
    ...TABLES.map((d) => fetchAll(d.table)),
  ]);
  if (settingsRes.error) throw settingsRes.error;
  const db = { settings: { factoryName: (settingsRes.data?.factory_name as string) ?? 'My Embroidery Factory' } } as DB;
  TABLES.forEach((def, i) => {
    (db as unknown as Record<string, unknown[]>)[def.key] = rows[i].map((r) => fromRow(def, r));
  });
  return db;
}

/* ---------- pending changes ---------- */
const upserts = new Map<Collection, Map<string, Record<string, unknown>>>();
const deletes = new Map<Collection, Set<string>>();
let settingsPending: string | null = null;

const bucket = <V>(m: Map<Collection, V>, k: Collection, make: () => V) => m.get(k) ?? (m.set(k, make()), m.get(k)!);
const pendingCount = () =>
  [...upserts.values()].reduce((s, m) => s + m.size, 0) + [...deletes.values()].reduce((s, m) => s + m.size, 0) + (settingsPending !== null ? 1 : 0);

function queueUpsert(k: Collection, rec: Record<string, unknown>) {
  deletes.get(k)?.delete(rec.id as string);
  bucket(upserts, k, () => new Map()).set(rec.id as string, rec);
}
function queueDelete(k: Collection, id: string) {
  upserts.get(k)?.delete(id);
  bucket(deletes, k, () => new Set()).add(id);
}

/** Compare two versions of the store and queue only what changed */
function diff(next: DB, prev: DB) {
  if (next.settings !== prev.settings && next.settings.factoryName !== prev.settings.factoryName) settingsPending = next.settings.factoryName;
  for (const def of TABLES) {
    const a = prev[def.key] as unknown as Record<string, unknown>[];
    const b = next[def.key] as unknown as Record<string, unknown>[];
    if (a === b) continue;
    const old = new Map(a.map((r) => [r.id as string, r]));
    const seen = new Set<string>();
    for (const r of b) {
      const id = r.id as string;
      seen.add(id);
      if (old.get(id) !== r) queueUpsert(def.key, r);
    }
    for (const id of old.keys()) if (!seen.has(id)) queueDelete(def.key, id);
  }
}

/* ---------- sending ---------- */
const CHUNK = 500;
let timer: ReturnType<typeof setTimeout> | null = null;
let running = false;
let failures = 0;

function schedule(delay = 400) {
  useSaveStatus.setState({ state: useSaveStatus.getState().state === 'error' ? 'error' : 'saving', pending: pendingCount() });
  if (timer) clearTimeout(timer);
  timer = setTimeout(flush, delay);
}

async function sendUpserts(def: TableDef, recs: Record<string, unknown>[]) {
  for (let i = 0; i < recs.length; i += CHUNK) {
    const rows = recs.slice(i, i + CHUNK).map((r) => toRow(def, r));
    const { error } = await sb().from(def.table).upsert(rows, { onConflict: 'id' });
    if (error) throw error;
  }
}
async function sendDeletes(def: TableDef, ids: string[]) {
  for (let i = 0; i < ids.length; i += 200) {
    const { error } = await sb().from(def.table).delete().in('id', ids.slice(i, i + 200));
    if (error) throw error;
  }
}

/** Send everything that is waiting. Returns true when all is saved. */
export async function flush(): Promise<boolean> {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  if (running) return false;
  if (!pendingCount()) {
    useSaveStatus.setState({ state: 'saved', pending: 0, message: undefined });
    return true;
  }
  running = true;
  // take a snapshot; anything edited while we send stays queued for the next round
  const up = new Map([...upserts].map(([k, m]) => [k, new Map(m)]));
  const del = new Map([...deletes].map(([k, s]) => [k, new Set(s)]));
  const st = settingsPending;
  upserts.clear();
  deletes.clear();
  settingsPending = null;
  useSaveStatus.setState({ state: 'saving', pending: pendingCount() + [...up.values(), ...del.values()].reduce((s, x) => s + x.size, 0) });
  try {
    if (st !== null) {
      const { error } = await sb().from('settings').upsert({ id: 1, factory_name: st, updated_at: new Date().toISOString() });
      if (error) throw error;
    }
    for (const def of TABLES) {
      const m = up.get(def.key);
      if (m?.size) {
        await sendUpserts(def, [...m.values()]);
        up.delete(def.key);
      }
    }
    for (const def of [...TABLES].reverse()) {
      const s = del.get(def.key);
      if (s?.size) {
        await sendDeletes(def, [...s]);
        del.delete(def.key);
      }
    }
    failures = 0;
    running = false;
    if (pendingCount()) schedule(200);
    else useSaveStatus.setState({ state: 'saved', pending: 0, message: undefined });
    return !pendingCount();
  } catch (e) {
    // put back whatever was not sent (newer edits made meanwhile win)
    for (const [k, m] of up) for (const [id, r] of m) if (!upserts.get(k)?.has(id) && !deletes.get(k)?.has(id)) bucket(upserts, k, () => new Map()).set(id, r);
    for (const [k, s] of del) for (const id of s) if (!upserts.get(k)?.has(id)) bucket(deletes, k, () => new Set()).add(id);
    if (st !== null && settingsPending === null) settingsPending = st;
    failures++;
    running = false;
    const message = e instanceof Error ? e.message : (e as { message?: string })?.message ?? 'Could not save';
    console.error('Save to Supabase failed:', e);
    useSaveStatus.setState({ state: 'error', pending: pendingCount(), message });
    if (failures === 1) notify('Could not save to the database. Will keep trying — check the internet connection.', 'error');
    if (timer) clearTimeout(timer);
    timer = setTimeout(flush, Math.min(30000, 2000 * 2 ** Math.min(failures - 1, 4)));
    return false;
  }
}

/* ---------- start / stop ---------- */
let applyingRemote = false;
let unsubscribe: (() => void) | null = null;

/** Put loaded data in the store without sending it back */
export function hydrate(db: DB) {
  applyingRemote = true;
  useStore.setState({ ...db });
  applyingRemote = false;
}

export function startSync() {
  stopSync();
  unsubscribe = useStore.subscribe((next, prev) => {
    if (applyingRemote) return;
    diff(next, prev);
    if (pendingCount()) schedule();
  });
}

export function stopSync() {
  unsubscribe?.();
  unsubscribe = null;
  if (timer) clearTimeout(timer);
  timer = null;
  upserts.clear();
  deletes.clear();
  settingsPending = null;
  useSaveStatus.setState({ state: 'saved', pending: 0, message: undefined });
}

export const hasUnsaved = () => pendingCount() > 0 || running;

// warn before closing the tab while something is still being saved
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', (e) => {
    if (hasUnsaved()) {
      e.preventDefault();
      e.returnValue = '';
    }
  });
}
