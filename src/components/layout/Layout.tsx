import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { Home, ClipboardList, Factory, Boxes, ShoppingCart, Users, UserCog, Receipt, FileText, Settings, Menu, FileSpreadsheet, LogOut } from 'lucide-react';
import { useStore } from '../../store/store';
import { GlobalSearch } from '../GlobalSearch';
import { MonthExportModal } from '../MonthExport';
import { supabase } from '../../lib/supabase';
import { flush, hasUnsaved, useSaveStatus } from '../../store/cloud';
import { confirmAction } from '../ui';

/** Small "All saved / Saving… / Not saved" line in the sidebar */
function SaveStatus() {
  const { state, pending, message } = useSaveStatus();
  if (state === 'error')
    return (
      <span className="save-status err" title={message}>
        ● Not saved — retrying{pending ? ` (${pending})` : ''}
      </span>
    );
  if (state === 'saving') return <span className="save-status busy">● Saving…</span>;
  return <span className="save-status ok">● All changes saved</span>;
}

async function logOut() {
  if (hasUnsaved()) {
    const ok = await flush();
    if (!ok && !(await confirmAction('Some changes are not saved yet (no internet?). Log out anyway and lose them?', 'Log out'))) return;
  }
  await supabase?.auth.signOut();
}

export const NAV = [
  { to: '/', label: 'Dashboard', icon: Home },
  { to: '/orders', label: 'Orders', icon: ClipboardList },
  { to: '/production', label: 'Production', icon: Factory },
  { to: '/inventory', label: 'Inventory', icon: Boxes },
  { to: '/purchases', label: 'Purchases', icon: ShoppingCart },
  { to: '/customers', label: 'Customers', icon: Users },
  { to: '/employees', label: 'Employees / Salaries', icon: UserCog },
  { to: '/expenses', label: 'Expenses', icon: Receipt },
  { to: '/reports', label: 'Reports', icon: FileText },
];

export function Layout() {
  const factoryName = useStore((s) => s.settings.factoryName);
  const [open, setOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const loc = useLocation();
  useEffect(() => setOpen(false), [loc.pathname]);
  const current = [...NAV, { to: '/settings', label: 'Settings' }].find((i) => (i.to === '/' ? loc.pathname === '/' : loc.pathname.startsWith(i.to)));
  const name = factoryName || 'Embroidery Factory';

  return (
    <div className={`app ${open ? 'nav-open' : ''}`}>
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark" aria-hidden>{name.trim().charAt(0).toUpperCase()}</span>
          <div>
            <strong>{name}</strong>
            <span>Factory records</span>
          </div>
        </div>
        <GlobalSearch />
        <nav className="nav">
          {NAV.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
              <Icon size={18} strokeWidth={1.8} />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="nav-foot">
          <button className="nav-item nav-export" onClick={() => setExportOpen(true)}>
            <FileSpreadsheet size={17} strokeWidth={1.8} />
            Month-end Excel
          </button>
          <NavLink to="/settings" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <Settings size={16} strokeWidth={1.8} />
            Settings & backup
          </NavLink>
          <div className="save-row">
            <SaveStatus />
            <button className="link-btn small" onClick={logOut} title="Log out">
              <LogOut size={14} /> Log out
            </button>
          </div>
        </div>
      </aside>
      <div className="scrim" onClick={() => setOpen(false)} />
      <div className="main">
        <header className="topbar">
          <button className="icon-btn" onClick={() => setOpen(true)} aria-label="Open menu">
            <Menu size={20} />
          </button>
          <strong>{current?.label}</strong>
        </header>
        <main className="content">
          <Outlet />
        </main>
      </div>
      {exportOpen && <MonthExportModal onClose={() => setExportOpen(false)} />}
    </div>
  );
}
