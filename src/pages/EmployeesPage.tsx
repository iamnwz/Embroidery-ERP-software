import { useEffect, useState } from 'react';
import { Plus, Download, ChevronLeft, ChevronRight } from 'lucide-react';
import { Badge, Chips, Field, FormButtons, Modal, NumInput, PageHeader, SearchBox, Select, Sheet, TextWithList, confirmAction, type Col } from '../components/ui';
import { notify } from '../components/ui/toast';
import { useStore } from '../store/store';
import { salaryNet } from '../store/selectors';
import { DESIGNATIONS } from '../config';
import { addMonths, currentMonth, fmtMonth, matches, money, num, uid } from '../lib/format';
import { downloadCSV } from '../lib/files';
import type { Employee, SalaryRecord } from '../types';
import { useLinkParams } from '../lib/useParams';

export default function EmployeesPage() {
  const [tab, setTab] = useState<'employees' | 'salaries'>('employees');
  const [openId, setOpenId] = useState<string | null>(null);
  useLinkParams(['open'], (p) => {
    setTab('employees');
    setOpenId(p.get('open'));
  });
  return (
    <>
      <PageHeader title="Employees / Salaries" />
      <div className="toolbar tabs-line">
        <Chips options={[{ id: 'employees', label: 'Employees' }, { id: 'salaries', label: 'Salaries' }]} value={tab} onChange={setTab} />
      </div>
      {tab === 'employees' ? <EmployeesTab openId={openId} onOpened={() => setOpenId(null)} /> : <SalariesTab />}
    </>
  );
}

function EmployeesTab({ openId, onOpened }: { openId: string | null; onOpened: () => void }) {
  const db = useStore();
  const [q, setQ] = useState('');
  const [edit, setEdit] = useState<Employee | 'new' | null>(null);
  useEffect(() => {
    if (!openId) return;
    const e = db.employees.find((x) => x.id === openId);
    if (e) setEdit(e);
    onOpened();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openId]);
  const rows = db.employees.filter((e) => matches(q, e.name, e.designation, e.phone)).sort((a, b) => Number(b.active) - Number(a.active));
  const cols: Col<Employee>[] = [
    { label: 'Name', cell: (e) => <span className="strong">{e.name}</span> },
    { label: 'Designation', cell: (e) => e.designation },
    { label: 'Phone', cell: (e) => e.phone },
    { label: 'Monthly salary', num: true, cell: (e) => num(e.salary), total: (l) => num(l.filter((e) => e.active).reduce((s, e) => s + e.salary, 0)) },
    { label: 'Status', cell: (e) => (e.active ? 'Working' : <span className="muted">Left</span>) },
  ];
  return (
    <>
      <div className="toolbar">
        <SearchBox value={q} onChange={setQ} placeholder="Search name, designation…" />
        <button className="btn btn-primary" onClick={() => setEdit('new')}><Plus size={16} /> Add employee</button>
        <span className="summary">{db.employees.filter((e) => e.active).length} working</span>
      </div>
      <Sheet cols={cols} rows={rows} onRowClick={(e) => setEdit(e)} />
      <p className="hint-line">Click a row to change details or salary.</p>
      {edit && <EmployeeForm employee={edit === 'new' ? undefined : edit} onClose={() => setEdit(null)} />}
    </>
  );
}

function SalariesTab() {
  const db = useStore();
  const [month, setMonth] = useState(currentMonth());
  const emp = new Map(db.employees.map((e) => [e.id, e]));
  const rows = db.salaries.filter((s) => s.month === month).sort((a, b) => (emp.get(a.employeeId)?.name ?? '').localeCompare(emp.get(b.employeeId)?.name ?? ''));
  const missing = db.employees.filter((e) => e.active && !rows.some((s) => s.employeeId === e.id)).length;
  const upd = (s: SalaryRecord, patch: Partial<SalaryRecord>) => db.save('salaries', { ...s, ...patch });
  const sum = (f: (s: SalaryRecord) => number) => (l: SalaryRecord[]) => num(l.reduce((a, s) => a + f(s), 0));

  const create = () => {
    const n = db.createSalarySheet(month);
    notify(n ? `Salary sheet made for ${n} employees` : 'Everyone already has a row for this month');
  };
  const remove = async (s: SalaryRecord) => {
    if (await confirmAction(`Remove ${emp.get(s.employeeId)?.name} from this month's sheet?`, 'Remove')) db.remove('salaries', s.id);
  };

  const cols: Col<SalaryRecord>[] = [
    { label: 'Employee', cell: (s) => <span className="strong nowrap">{emp.get(s.employeeId)?.name}</span> },
    { label: 'Designation', cell: (s) => <span className="muted nowrap">{emp.get(s.employeeId)?.designation}</span> },
    { label: 'Monthly salary', num: true, cell: (s) => <NumInput value={s.salary} onChange={(v) => upd(s, { salary: Number(v) || 0 })} />, total: sum((s) => s.salary) },
    { label: 'Bonus', num: true, cell: (s) => <NumInput value={s.bonus} onChange={(v) => upd(s, { bonus: Number(v) || 0 })} />, total: sum((s) => s.bonus) },
    { label: 'Advance', num: true, cell: (s) => <NumInput value={s.advance} onChange={(v) => upd(s, { advance: Number(v) || 0 })} />, total: sum((s) => s.advance) },
    { label: 'Deduction', num: true, cell: (s) => <NumInput value={s.deduction} onChange={(v) => upd(s, { deduction: Number(v) || 0 })} />, total: sum((s) => s.deduction) },
    { label: 'Payable', num: true, cell: (s) => <span className="strong">{num(salaryNet(s))}</span>, total: sum(salaryNet) },
    {
      label: 'Paid',
      cell: (s) => (
        <button className="link-btn" onClick={() => upd(s, { paid: !s.paid })} title="Click to change">
          <Badge>{s.paid ? 'Paid' : 'Unpaid'}</Badge>
        </button>
      ),
    },
    { label: 'Note', cell: (s) => <input className="input" value={s.note ?? ''} onChange={(e) => upd(s, { note: e.target.value || undefined })} /> },
    { label: ' ', cell: (s) => <button className="icon-btn" onClick={() => remove(s)} aria-label="Remove row">×</button>, className: () => 'act' },
  ];

  const exportCSV = () =>
    downloadCSV(`salaries-${month}.csv`, ['Employee', 'Designation', 'Monthly salary', 'Bonus', 'Advance', 'Deduction', 'Payable', 'Paid', 'Note'], rows.map((s) => [emp.get(s.employeeId)?.name ?? '', emp.get(s.employeeId)?.designation ?? '', s.salary, s.bonus, s.advance, s.deduction, salaryNet(s), s.paid ? 'Paid' : 'Unpaid', s.note ?? '']));

  return (
    <>
      <div className="toolbar">
        <div className="row" style={{ flexWrap: 'nowrap' }}>
          <button className="icon-btn" onClick={() => setMonth(addMonths(month, -1))} aria-label="Previous month"><ChevronLeft size={18} /></button>
          <strong style={{ minWidth: 130, textAlign: 'center' }}>{fmtMonth(month)}</strong>
          <button className="icon-btn" onClick={() => setMonth(addMonths(month, 1))} aria-label="Next month"><ChevronRight size={18} /></button>
        </div>
        {rows.length > 0 && missing > 0 && <button className="btn" onClick={create}><Plus size={16} /> Add {missing} new employee{missing > 1 ? 's' : ''} to this sheet</button>}
        {rows.length > 0 && <button className="btn" onClick={exportCSV}><Download size={16} /> Excel</button>}
        {rows.length > 0 && (
          <span className="summary">
            Total payable: <b>{money(rows.reduce((a, s) => a + salaryNet(s), 0))}</b> · {rows.filter((s) => !s.paid).length} unpaid
          </span>
        )}
      </div>
      {rows.length === 0 ? (
        <div className="sheet-wrap" style={{ padding: 32, textAlign: 'center' }}>
          <p className="muted">No salary sheet for {fmtMonth(month)} yet.</p>
          <button className="btn btn-primary" onClick={create}>Make salary sheet for {fmtMonth(month)}</button>
        </div>
      ) : (
        <Sheet cols={cols} rows={rows} />
      )}
      <p className="hint-line">Payable = Monthly salary + Bonus − Advance − Deduction. Type directly in the boxes — it saves by itself. Click Paid/Unpaid to change it.</p>
    </>
  );
}

function EmployeeForm({ employee, onClose }: { employee?: Employee; onClose: () => void }) {
  const db = useStore();
  const [f, setF] = useState({
    name: employee?.name ?? '',
    designation: employee?.designation ?? '',
    phone: employee?.phone ?? '',
    salary: (employee?.salary ?? '') as number | '',
    active: employee?.active ?? true,
    notes: employee?.notes ?? '',
  });
  const save = () => {
    if (!f.name.trim()) return notify('Please enter the name', 'error');
    db.save('employees', { id: employee?.id ?? uid(), name: f.name.trim(), designation: f.designation.trim(), phone: f.phone.trim() || undefined, salary: Number(f.salary) || 0, active: f.active, notes: f.notes.trim() || undefined });
    notify('Employee saved');
    onClose();
  };
  const del = async () => {
    if (!employee) return;
    if (db.salaries.some((s) => s.employeeId === employee.id) || db.production.some((p) => p.operatorId === employee.id)) return notify('This employee has salary or production records. Set the status to “Left” instead.', 'error');
    if (await confirmAction(`Delete ${employee.name}?`)) {
      db.remove('employees', employee.id);
      onClose();
    }
  };
  return (
    <Modal title={employee ? 'Edit employee' : 'Add employee'} onClose={onClose} width={480} footer={<FormButtons onSave={save} onCancel={onClose} onDelete={employee ? del : undefined} />}>
      <div className="form">
        <Field label="Name" wide><input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
        <Field label="Designation"><TextWithList listId="designations" value={f.designation} onChange={(v) => setF({ ...f, designation: v })} options={DESIGNATIONS} placeholder="e.g. Operator" /></Field>
        <Field label="Phone"><input className="input" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></Field>
        <Field label="Monthly salary (Rs)"><NumInput value={f.salary} onChange={(v) => setF({ ...f, salary: v })} /></Field>
        <Field label="Status"><Select value={f.active ? 'Working' : 'Left'} onChange={(v) => setF({ ...f, active: v === 'Working' })} options={['Working', 'Left']} /></Field>
        <Field label="Notes" wide><input className="input" value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></Field>
      </div>
    </Modal>
  );
}
