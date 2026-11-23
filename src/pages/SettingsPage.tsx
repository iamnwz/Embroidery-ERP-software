import { useRef, useState } from 'react';
import { Download, Upload, RotateCcw, Eraser } from 'lucide-react';
import { Box, Field, PageHeader, confirmAction } from '../components/ui';
import { MonthExportButton } from '../components/MonthExport';
import { notify } from '../components/ui/toast';
import { getDB, useStore } from '../store/store';
import { downloadBlob } from '../lib/files';
import { today } from '../lib/format';
import type { DB } from '../types';

export default function SettingsPage() {
  const db = useStore();
  const fileRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(db.settings.factoryName);

  const exportBackup = () => {
    downloadBlob(`factory-backup-${today()}.json`, new Blob([JSON.stringify(getDB(), null, 2)], { type: 'application/json' }));
    notify('Backup file downloaded');
  };

  const importBackup = async (file?: File) => {
    if (!file) return;
    try {
      const data = JSON.parse(await file.text()) as DB;
      if (!data || !Array.isArray(data.orders) || !Array.isArray(data.items)) throw new Error('bad');
      if (!(await confirmAction('This will replace all current records with the backup file. Continue?', 'Restore'))) return;
      db.importData(data);
      setName(data.settings?.factoryName ?? name);
      notify('Backup restored');
    } catch {
      notify('This file is not a valid backup', 'error');
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <>
      <PageHeader title="Settings & backup" />
      <div className="stack" style={{ maxWidth: 640 }}>
        <Box title="Factory name">
          <div style={{ padding: 16 }} className="row">
            <Field label="Name shown in the menu and on reports">
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} style={{ width: 320 }} />
            </Field>
            <button className="btn btn-primary" style={{ alignSelf: 'flex-end' }} onClick={() => { db.updateSettings({ factoryName: name }); notify('Saved'); }}>Save</button>
          </div>
        </Box>
        <Box title="Month-end Excel file">
          <div style={{ padding: 16 }} className="stack">
            <p className="muted" style={{ margin: 0 }}>At the end of every month, download that month’s complete hisaab (summary, orders, production, stock, purchases, customers, suppliers, salaries, expenses) as one Excel file and keep it on your computer.</p>
            <div className="row">
              <MonthExportButton primary label="Download month-end Excel" />
            </div>
          </div>
        </Box>
        <Box title="Backup">
          <div style={{ padding: 16 }} className="stack">
            <p className="muted" style={{ margin: 0 }}>All records are saved on this computer, in this browser. Download a backup regularly. The same file can be used to move the records to another computer.</p>
            <div className="row">
              <button className="btn" onClick={exportBackup}><Download size={16} /> Download backup</button>
              <button className="btn" onClick={() => fileRef.current?.click()}><Upload size={16} /> Restore from backup</button>
              <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(e) => importBackup(e.target.files?.[0])} />
            </div>
          </div>
        </Box>
        <Box title="Demo data">
          <div style={{ padding: 16 }} className="stack">
            <p className="muted" style={{ margin: 0 }}>The software currently has sample records. When you are ready to enter real records, clear everything.</p>
            <div className="row">
              <button className="btn" onClick={async () => { if (await confirmAction('Replace all records with fresh sample data?', 'Reset')) { db.resetDemo(); setName(useStore.getState().settings.factoryName); notify('Sample data restored'); } }}><RotateCcw size={16} /> Reset sample data</button>
              <button className="btn btn-danger" onClick={async () => { if (await confirmAction('Delete ALL records (orders, stock, employees, everything)? Download a backup first if you may need them.', 'Delete everything')) { db.clearAll(); notify('All records cleared'); } }}><Eraser size={16} /> Clear all data</button>
            </div>
          </div>
        </Box>
      </div>
    </>
  );
}
