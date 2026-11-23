import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, FileSpreadsheet, Download } from 'lucide-react';
import { Modal } from './ui';
import { notify } from './ui/toast';
import { useStore, getDB } from '../store/store';
import { monthHisab } from '../store/selectors';
import { addMonths, currentMonth, fmtMonth, money } from '../lib/format';
import { downloadMonthExcel } from '../lib/downloadMonthExcel';

const TABS = ['Hisaab Summary', 'Orders', 'Production', 'Stock', 'Stock IN-OUT', 'Purchases', 'Customers', 'Suppliers', 'Salaries', 'Expenses'];

/** Popup: choose a month and download that month's complete hisaab as one Excel file. */
export function MonthExportModal({ onClose }: { onClose: () => void }) {
  const db = useStore();
  const [month, setMonth] = useState(currentMonth());
  const [busy, setBusy] = useState(false);
  const h = useMemo(() => monthHisab(db, month), [db, month]);
  const isFuture = month > currentMonth();

  const download = async () => {
    setBusy(true);
    try {
      const name = await downloadMonthExcel(getDB(), month);
      notify(`Saved ${name}`);
      onClose();
    } catch (e) {
      console.error(e);
      notify('Could not make the Excel file. Please try again.', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      title="Month-end Excel file"
      onClose={onClose}
      width={560}
      footer={
        <>
          <span className="spacer" />
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={download} disabled={busy || isFuture}>
            <Download size={16} /> {busy ? 'Making file…' : `Download ${fmtMonth(month).split(' ')[0]} Excel`}
          </button>
        </>
      }
    >
      <div className="stack" style={{ gap: 14 }}>
        <p className="muted" style={{ margin: 0 }}>
          Saves the whole month’s hisaab-kitaab in one Excel file (.xlsx) on this computer. Keep it in a folder such as <b>Factory Hisaab / {month.slice(0, 4)}</b> to build your yearly record.
        </p>
        <div className="month-pick">
          <button className="icon-btn" onClick={() => setMonth(addMonths(month, -1))} aria-label="Previous month"><ChevronLeft size={20} /></button>
          <strong>{fmtMonth(month)}</strong>
          <button className="icon-btn" onClick={() => setMonth(addMonths(month, 1))} aria-label="Next month"><ChevronRight size={20} /></button>
        </div>
        {isFuture ? (
          <div className="notice">This month has not started yet.</div>
        ) : (
          <div className="calc" style={{ gridColumn: 'auto' }}>
            <div><span>Sales</span><strong>{money(h.sales)}</strong></div>
            <div><span>Spending</span><strong>{money(h.spending)}</strong></div>
            <div><span>{h.profit < 0 ? 'Loss' : 'Profit'}</span><strong className={h.profit < 0 ? 'text-danger' : 'text-green'}>{money(h.profit)}</strong></div>
            <div><span>Orders</span><strong>{h.orders}</strong></div>
          </div>
        )}
        {!isFuture && !h.salarySheet && <p className="small muted" style={{ margin: 0 }}>Salary sheet for this month is not made yet, so salaries will show as 0. Make it first under Employees / Salaries if you want it included.</p>}
        <div>
          <div className="field-label" style={{ marginBottom: 6 }}>The file will have these tabs</div>
          <div className="tab-list">
            {TABS.map((t) => (
              <span key={t}><FileSpreadsheet size={13} /> {t}</span>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );
}

/** Button that opens the month-end export popup */
export function MonthExportButton({ primary, label = 'Month-end Excel' }: { primary?: boolean; label?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className={`btn ${primary ? 'btn-primary' : ''}`} onClick={() => setOpen(true)}>
        <FileSpreadsheet size={16} /> {label}
      </button>
      {open && <MonthExportModal onClose={() => setOpen(false)} />}
    </>
  );
}
