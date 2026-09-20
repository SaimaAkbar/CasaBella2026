import { useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { OnlineBookingAlert } from '../components/OnlineBookingAlert';
import { Sidebar } from './Sidebar';
import { TopNavbar } from './TopNavbar';
import './AppLayout.css';

const SIDEBAR_STORAGE_KEY = 'hotel_sidebar_collapsed';

export function AppLayout() {
  const [collapsed, setCollapsed] = useState(() => {
    return localStorage.getItem(SIDEBAR_STORAGE_KEY) === 'true';
  });
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    localStorage.setItem(SIDEBAR_STORAGE_KEY, String(collapsed));
  }, [collapsed]);

  function handleToggleSidebar() {
    if (window.matchMedia('(max-width: 960px)').matches) {
      setMobileOpen((current) => !current);
      return;
    }

    setCollapsed((current) => !current);
  }

  return (
    <div
      className={[
        'app-layout',
        collapsed ? 'app-layout--collapsed' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <Sidebar
        collapsed={collapsed}
        mobileOpen={mobileOpen}
        onNavigate={() => setMobileOpen(false)}
      />

      {mobileOpen ? (
        <button
          type="button"
          className="app-layout__overlay"
          aria-label="Close sidebar"
          onClick={() => setMobileOpen(false)}
        />
      ) : null}

      <div className="app-layout__main">
        <TopNavbar
          collapsed={collapsed}
          onToggleSidebar={handleToggleSidebar}
        />
        <main className="app-layout__content">
          <Outlet />
        </main>
      </div>

      <OnlineBookingAlert />
    </div>
  );
}
