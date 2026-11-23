import { useEffect, useState } from 'react';
import { CheckCircle2, AlertTriangle, X } from 'lucide-react';

type Tone = 'success' | 'error';
interface ToastMsg {
  id: number;
  text: string;
  tone: Tone;
}

let listeners: ((t: ToastMsg) => void)[] = [];
let counter = 0;

/** Show a short message at the bottom-right. Usable from anywhere (including the store). */
export function notify(text: string, tone: Tone = 'success') {
  const t = { id: ++counter, text, tone };
  listeners.forEach((l) => l(t));
}

export function ToastHost() {
  const [list, setList] = useState<ToastMsg[]>([]);
  useEffect(() => {
    const l = (t: ToastMsg) => {
      setList((x) => [...x, t]);
      setTimeout(() => setList((x) => x.filter((y) => y.id !== t.id)), t.tone === 'error' ? 6000 : 3000);
    };
    listeners.push(l);
    return () => {
      listeners = listeners.filter((x) => x !== l);
    };
  }, []);
  return (
    <div className="toast-host" role="status" aria-live="polite">
      {list.map((t) => (
        <div key={t.id} className={`toast toast-${t.tone}`}>
          {t.tone === 'success' ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
          <span>{t.text}</span>
          <button className="icon-btn" onClick={() => setList((x) => x.filter((y) => y.id !== t.id))} aria-label="Dismiss">
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
