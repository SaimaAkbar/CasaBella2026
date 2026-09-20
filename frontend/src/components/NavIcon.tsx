export type NavIconName =
  | 'dashboard'
  | 'properties'
  | 'rooms'
  | 'tenants'
  | 'guests'
  | 'online'
  | 'facilities'
  | 'payments'
  | 'expenses'
  | 'owners'
  | 'employees'
  | 'inventory'
  | 'profit'
  | 'reports'
  | 'approvals'
  | 'notifications'
  | 'audit'
  | 'settings'
  | 'backups'
  | 'logout';

const PATHS: Record<NavIconName, string> = {
  dashboard:
    'M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z',
  properties:
    'M3 21V8l9-5 9 5v13h-6v-7H9v7H3z',
  rooms:
    'M3 7h18v12H3V7zm2 2v3h5V9H5zm7 0v3h5V9h-5zM5 14v3h14v-3H5z',
  tenants:
    'M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4zm-7 9a7 7 0 0 1 14 0',
  guests:
    'M16 11a4 4 0 1 0-4-4 4 4 0 0 0 4 4zM8 13a3.5 3.5 0 1 0-3.5-3.5A3.5 3.5 0 0 0 8 13zm8 2c-2.5 0-7 1.25-7 3.75V21h14v-2.25C23 16.25 18.5 15 16 15zM8 15c-2.67 0-8 1.34-8 4v2h7v-2c0-1.1.5-2.1 1.3-2.9C8.1 15.05 8.05 15 8 15z',
  online:
    'M12 3a9 9 0 1 0 9 9h-3a6 6 0 1 1-6-6V3zm1 0v8h8a9 9 0 0 0-8-8z',
  facilities:
    'M12 3l8 4v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V7l8-4zm0 5v8m-4-4h8',
  payments:
    'M3 6h18v12H3V6zm2 4h14M7 16h4',
  expenses:
    'M12 3v18M7 8h7a3 3 0 0 1 0 6H9a3 3 0 0 0 0 6h8',
  owners:
    'M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4zm-8 9v-1a6 6 0 0 1 12 0v1M17 8l4 2v3',
  employees:
    'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0-4-4 4 4 0 0 0 4 4zm8 0a3 3 0 1 0-2-5',
  inventory:
    'M3 7l9-4 9 4-9 4-9-4zm0 5l9 4 9-4M3 17l9 4 9-4',
  profit:
    'M4 19V5m0 14h16M8 15l3-4 3 2 4-6',
  reports:
    'M6 3h9l5 5v13H6V3zm9 0v5h5M9 13h6M9 17h6',
  approvals:
    'M9 11l3 3L22 4M5 20h14a2 2 0 0 0 2-2V8',
  notifications:
    'M12 22a2 2 0 0 0 2-2H10a2 2 0 0 0 2 2zm6-6V11a6 6 0 1 0-12 0v5l-2 2h16l-2-2z',
  audit:
    'M9 5H5v14h14v-4M14 5h5v5M20 4l-9 9',
  settings:
    'M12 15a3 3 0 1 0-3-3 3 3 0 0 0 3 3zm7.4-3a7.4 7.4 0 0 0-.1-1l2-1.5-2-3.5-2.4 1a7.6 7.6 0 0 0-1.7-1L13 2h-4l-.2 2.9a7.6 7.6 0 0 0-1.7 1L4.7 5.9l-2 3.5 2 1.5a7.4 7.4 0 0 0 0 2l-2 1.5 2 3.5 2.4-1a7.6 7.6 0 0 0 1.7 1L9 22h4l.2-2.9a7.6 7.6 0 0 0 1.7-1l2.4 1 2-3.5-2-1.5c.1-.3.1-.7.1-1z',
  backups:
    'M12 3a9 9 0 0 0-9 9h3l-4 4-4-4h3a12 12 0 1 1 3.5 8.5',
  logout:
    'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9',
};

type NavIconProps = {
  name: NavIconName;
  size?: number;
  className?: string;
};

export function NavIcon({ name, size = 18, className }: NavIconProps) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={PATHS[name]} />
    </svg>
  );
}

export function navIconForPath(path: string): NavIconName {
  const map: Record<string, NavIconName> = {
    '/dashboard': 'dashboard',
    '/properties': 'properties',
    '/rooms': 'rooms',
    '/monthly-tenants': 'tenants',
    '/daily-guests': 'guests',
    '/online-bookings': 'online',
    '/website-facilities': 'facilities',
    '/payments': 'payments',
    '/expenses': 'expenses',
    '/owners': 'owners',
    '/employees': 'employees',
    '/inventory': 'inventory',
    '/profit-loss': 'profit',
    '/reports': 'reports',
    '/approvals': 'approvals',
    '/notifications': 'notifications',
    '/audit-logs': 'audit',
    '/settings': 'settings',
    '/backups': 'backups',
  };
  return map[path] ?? 'dashboard';
}
