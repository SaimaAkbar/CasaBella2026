import { useMemo, useState } from 'react';
import { NotificationBell } from '../components/NotificationBell';
import { ProfileMenu } from '../components/ProfileMenu';
import { RoleBadge } from '../components/RoleBadge';
import { SearchBar } from '../components/SearchBar';
import { useAuth } from '../context/AuthContext';
import './TopNavbar.css';

type TopNavbarProps = {
  collapsed: boolean;
  onToggleSidebar: () => void;
};

function formatToday(): string {
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date());
}

export function TopNavbar({ collapsed, onToggleSidebar }: TopNavbarProps) {
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const currentDate = useMemo(() => formatToday(), []);

  if (!user) {
    return null;
  }

  return (
    <header className="top-navbar">
      <div className="top-navbar__left">
        <button
          type="button"
          className="top-navbar__toggle"
          onClick={onToggleSidebar}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <span aria-hidden="true">☰</span>
        </button>

        <div className="top-navbar__brand">
          <span className="top-navbar__brand-mark" aria-hidden="true">
            R
          </span>
          <div className="top-navbar__brand-text">
            <strong>Hotel Residences</strong>
            <span>POS Console</span>
          </div>
        </div>

        <div className="top-navbar__user">
          <p className="top-navbar__user-label">Current User</p>
          <div className="top-navbar__user-row">
            <strong>{user.fullName}</strong>
            <RoleBadge role={user.role} />
          </div>
        </div>
      </div>

      <div
        className={[
          'top-navbar__center',
          searchOpen ? 'top-navbar__center--open' : '',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        <SearchBar value={search} onChange={setSearch} placeholder="Search..." />
      </div>

      <div className="top-navbar__right">
        <button
          type="button"
          className="top-navbar__search-toggle"
          aria-label="Toggle search"
          onClick={() => setSearchOpen((v) => !v)}
        >
          ⌕
        </button>
        <time className="top-navbar__date" dateTime={new Date().toISOString()}>
          {currentDate}
        </time>
        <NotificationBell />
        <ProfileMenu />
      </div>
    </header>
  );
}
