import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { LogIn, UserPlus, RefreshCw } from 'lucide-react';
import { supabase, supabaseConfigured } from '../lib/supabase';
import { hydrate, loadAll, startSync, stopSync } from '../store/cloud';
import { emptyDB, useStore } from '../store/store';

type Phase = 'checking' | 'signedOut' | 'loading' | 'ready' | 'loadError';

/** Factory name entered on the "create owner account" screen, saved right after login. */
let pendingFactoryName: string | null = null;

/**
 * Shows the owner login (or first-time "create owner account") screen,
 * then loads all records from Supabase before showing the app.
 */
export function AuthGate({ children }: { children: ReactNode }) {
  const [phase, setPhase] = useState<Phase>('checking');
  const [loadError, setLoadError] = useState('');
  const loadedFor = useRef<string | null>(null);

  const load = useCallback(async (session: Session) => {
    if (loadedFor.current === session.user.id) return;
    loadedFor.current = session.user.id;
    setPhase('loading');
    try {
      const db = await loadAll();
      hydrate(db);
      startSync();
      // factory name typed while creating the owner account
      if (pendingFactoryName) {
        useStore.getState().updateSettings({ factoryName: pendingFactoryName });
        pendingFactoryName = null;
      }
      setPhase('ready');
    } catch (e) {
      loadedFor.current = null;
      setLoadError(e instanceof Error ? e.message : String((e as { message?: string })?.message ?? e));
      setPhase('loadError');
    }
  }, []);

  useEffect(() => {
    if (!supabase) return;
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      // run outside the auth callback (recommended by supabase-js)
      setTimeout(() => {
        if (session && (event === 'INITIAL_SESSION' || event === 'SIGNED_IN')) load(session);
        else if (!session) {
          loadedFor.current = null;
          stopSync();
          useStore.setState({ ...emptyDB() });
          setPhase('signedOut');
        }
      }, 0);
    });
    return () => data.subscription.unsubscribe();
  }, [load]);

  if (!supabaseConfigured) {
    return (
      <Centered>
        <h1>Database not connected</h1>
        <p className="muted">
          Add <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_PUBLISHABLE_KEY</code> to the <code>.env</code> file (or the hosting settings) and restart.
        </p>
      </Centered>
    );
  }
  if (phase === 'checking' || phase === 'loading')
    return (
      <Centered>
        <div className="spinner" aria-hidden />
        <p className="muted">{phase === 'loading' ? 'Loading your records…' : 'Starting…'}</p>
      </Centered>
    );
  if (phase === 'loadError')
    return (
      <Centered>
        <h1>Could not load records</h1>
        <p className="muted">{loadError || 'Please check the internet connection.'}</p>
        <div className="row" style={{ justifyContent: 'center' }}>
          <button className="btn btn-primary" onClick={async () => { const { data } = await supabase!.auth.getSession(); if (data.session) load(data.session); }}><RefreshCw size={16} /> Try again</button>
          <button className="btn" onClick={() => supabase!.auth.signOut()}>Log out</button>
        </div>
      </Centered>
    );
  if (phase === 'signedOut') return <LoginScreen />;
  return <>{children}</>;
}

function Centered({ children }: { children: ReactNode }) {
  return (
    <div className="auth-page">
      <div className="auth-card" style={{ textAlign: 'center' }}>{children}</div>
    </div>
  );
}

/* ---------- login / first-time setup ---------- */
function LoginScreen() {
  const [mode, setMode] = useState<'checking' | 'login' | 'setup'>('checking');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [factory, setFactory] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    supabase!.rpc('owner_exists').then(({ data, error: e }) => {
      if (e) {
        setMode('login');
        setError('Could not reach the database. Check the internet connection.');
      } else setMode(data ? 'login' : 'setup');
    });
  }, []);

  const submit = async (ev: FormEvent) => {
    ev.preventDefault();
    setError('');
    if (mode === 'setup') {
      if (password.length < 8) return setError('Password must be at least 8 characters.');
      if (password !== confirm) return setError('The two passwords do not match.');
    }
    setBusy(true);
    try {
      if (mode === 'login') {
        const { error: e } = await supabase!.auth.signInWithPassword({ email: email.trim(), password });
        if (e) setError(e.message === 'Invalid login credentials' ? 'Wrong email or password.' : e.message);
      } else {
        pendingFactoryName = factory.trim() || null;
        const { data, error: e } = await supabase!.auth.signUp({ email: email.trim(), password });
        if (e) {
          if (/owner account|database error/i.test(e.message)) {
            setMode('login');
            setError('An owner account already exists. Please log in.');
          } else setError(e.message);
        } else if (!data.session) {
          setError('Account created. Please log in.');
          setMode('login');
        }
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-page">
      <form className="auth-card" onSubmit={submit}>
        <div className="auth-mark" aria-hidden>E</div>
        <h1>{mode === 'setup' ? 'Create owner account' : 'Log in'}</h1>
        <p className="muted">
          {mode === 'setup'
            ? 'First time here. Choose the email and password the owner will use to log in. Only one account can be created.'
            : 'Embroidery factory records'}
        </p>
        {mode === 'checking' ? (
          <div className="spinner" aria-hidden />
        ) : (
          <div className="stack" style={{ gap: 12, textAlign: 'left' }}>
            {mode === 'setup' && (
              <label className="field">
                <span className="field-label">Factory name</span>
                <input className="input" value={factory} onChange={(e) => setFactory(e.target.value)} placeholder="e.g. Gulshan Embroidery Works" />
              </label>
            )}
            <label className="field">
              <span className="field-label">Email</span>
              <input className="input" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </label>
            <label className="field">
              <span className="field-label">Password</span>
              <input className="input" type="password" autoComplete={mode === 'setup' ? 'new-password' : 'current-password'} required value={password} onChange={(e) => setPassword(e.target.value)} />
            </label>
            {mode === 'setup' && (
              <label className="field">
                <span className="field-label">Password again</span>
                <input className="input" type="password" autoComplete="new-password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} />
              </label>
            )}
            {error && <div className="auth-error">{error}</div>}
            <button className="btn btn-primary auth-submit" disabled={busy}>
              {mode === 'setup' ? <UserPlus size={16} /> : <LogIn size={16} />}
              {busy ? 'Please wait…' : mode === 'setup' ? 'Create account' : 'Log in'}
            </button>
          </div>
        )}
      </form>
    </div>
  );
}
