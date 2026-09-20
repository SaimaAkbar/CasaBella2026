import { NavLink } from 'react-router-dom';
import { NavIcon, navIconForPath } from '../components/NavIcon';
import {
  APP_FOOTER_NAV_ITEMS,
  APP_NAV_ITEMS,
  SUPER_ADMIN_ONLY_PATHS,
  type NavItem,
} from '../config/navigation';
import { useAuth } from '../context/AuthContext';
import './Sidebar.css';

type SidebarProps = {
  collapsed: boolean;
  mobileOpen: boolean;
  onNavigate?: () => void;
};

function canSeeNavItem(
  item: NavItem,
  user: { role: string; canAccessProfitLoss?: boolean } | null,
): boolean {
  if (!user) return false;

  if (item.path === '/profit-loss') {
    return (
      user.role === 'SUPER_ADMIN' ||
      (user.role === 'ADMIN' && Boolean(user.canAccessProfitLoss))
    );
  }
  if (
    item.path === '/payments' ||
    item.path === '/website-facilities'
  ) {
    return user.role === 'SUPER_ADMIN' || user.role === 'ADMIN';
  }
  if ((SUPER_ADMIN_ONLY_PATHS as readonly string[]).includes(item.path)) {
    return user.role === 'SUPER_ADMIN';
  }
  return true;
}

export function Sidebar({ collapsed, mobileOpen, onNavigate }: SidebarProps) {
  const { logout, user } = useAuth();

  const mainNav = APP_NAV_ITEMS.filter((item) => canSeeNavItem(item, user));
  const footerNav = APP_FOOTER_NAV_ITEMS.filter((item) =>
    canSeeNavItem(item, user),
  );

  return (
    <aside
      className={[
        'sidebar',
        collapsed ? 'sidebar--collapsed' : '',
        mobileOpen ? 'sidebar--mobile-open' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <nav className="sidebar__nav" aria-label="Main">
        {mainNav.map((item) => (
          <NavLink
            key={item.id}
            to={item.path}
            className={({ isActive }) =>
              isActive ? 'sidebar__link sidebar__link--active' : 'sidebar__link'
            }
            title={item.label}
            onClick={onNavigate}
          >
            <NavIcon name={navIconForPath(item.path)} />
            {!collapsed ? <span>{item.label}</span> : null}
          </NavLink>
        ))}
      </nav>

      <div className="sidebar__footer">
        {footerNav.map((item) => (
          <NavLink
            key={item.id}
            to={item.path}
            className={({ isActive }) =>
              isActive ? 'sidebar__link sidebar__link--active' : 'sidebar__link'
            }
            title={item.label}
            onClick={onNavigate}
          >
            <NavIcon name={navIconForPath(item.path)} />
            {!collapsed ? <span>{item.label}</span> : null}
          </NavLink>
        ))}

        <button
          type="button"
          className="sidebar__logout"
          onClick={logout}
          title="Logout"
        >
          <NavIcon name="logout" />
          {!collapsed ? <span>Logout</span> : null}
        </button>
      </div>
    </aside>
  );
}
