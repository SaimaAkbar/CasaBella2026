export type NavItem = {
  id: string;
  label: string;
  path: string;
  title: string;
  breadcrumb: string[];
};

/** Primary sidebar navigation (Settings/Audit/Backup live in footer). */
export const APP_NAV_ITEMS: NavItem[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    path: '/dashboard',
    title: 'Dashboard',
    breadcrumb: ['Home', 'Dashboard'],
  },
  {
    id: 'properties',
    label: 'Properties',
    path: '/properties',
    title: 'Properties',
    breadcrumb: ['Home', 'Properties'],
  },
  {
    id: 'rooms',
    label: 'Rooms & Apartments',
    path: '/rooms',
    title: 'Rooms & Apartments',
    breadcrumb: ['Home', 'Rooms & Apartments'],
  },
  {
    id: 'monthly-tenants',
    label: 'Monthly Tenants',
    path: '/monthly-tenants',
    title: 'Monthly Tenants',
    breadcrumb: ['Home', 'Monthly Tenants'],
  },
  {
    id: 'daily-guests',
    label: 'Daily Guests',
    path: '/daily-guests',
    title: 'Daily Guests',
    breadcrumb: ['Home', 'Daily Guests'],
  },
  {
    id: 'payments',
    label: 'Payments',
    path: '/payments',
    title: 'Payments',
    breadcrumb: ['Home', 'Payments'],
  },
  {
    id: 'expenses',
    label: 'Expenses',
    path: '/expenses',
    title: 'Expenses',
    breadcrumb: ['Home', 'Expenses'],
  },
  {
    id: 'owners',
    label: 'Owners',
    path: '/owners',
    title: 'Owners',
    breadcrumb: ['Home', 'Owners'],
  },
  {
    id: 'employees',
    label: 'Employees',
    path: '/employees',
    title: 'Employees',
    breadcrumb: ['Home', 'Employees'],
  },
  {
    id: 'inventory',
    label: 'Inventory',
    path: '/inventory',
    title: 'Inventory',
    breadcrumb: ['Home', 'Inventory'],
  },
  {
    id: 'profit-loss',
    label: 'Profit & Loss',
    path: '/profit-loss',
    title: 'Profit & Loss',
    breadcrumb: ['Home', 'Profit & Loss'],
  },
  {
    id: 'reports',
    label: 'Reports',
    path: '/reports',
    title: 'Reports',
    breadcrumb: ['Home', 'Reports'],
  },
  {
    id: 'approvals',
    label: 'Approvals',
    path: '/approvals',
    title: 'Approvals',
    breadcrumb: ['Home', 'Approvals'],
  },
  // Notifications are accessible via the bell icon in the top header.
  // This entry is intentionally excluded from the sidebar.
];

export const APP_FOOTER_NAV_ITEMS: NavItem[] = [
  {
    id: 'audit-logs',
    label: 'Audit Log',
    path: '/audit-logs',
    title: 'Audit Log',
    breadcrumb: ['Home', 'Audit Log'],
  },
  {
    id: 'settings',
    label: 'Settings',
    path: '/settings',
    title: 'Settings',
    breadcrumb: ['Home', 'Settings'],
  },
  {
    id: 'backups',
    label: 'System Backup',
    path: '/backups',
    title: 'System Backup',
    breadcrumb: ['Home', 'System Backup'],
  },
];

/** All routed placeholder / page items (main + footer). */
export const ALL_NAV_ITEMS: NavItem[] = [
  ...APP_NAV_ITEMS,
  ...APP_FOOTER_NAV_ITEMS,
];

export function getNavItemByPath(pathname: string): NavItem | undefined {
  return ALL_NAV_ITEMS.find(
    (item) => pathname === item.path || pathname.startsWith(`${item.path}/`),
  );
}

export const SUPER_ADMIN_ONLY_PATHS = [
  '/reports',
  '/approvals',
  '/backups',
  '/owners',
  '/employees',
  '/payments',
  '/inventory',
  '/audit-logs',
  '/settings',
] as const;

export function isSuperAdminOnlyPath(pathname: string): boolean {
  return SUPER_ADMIN_ONLY_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
}

/** Admin/Receptionist clicks on Super Admin-only pages go to the dashboard. */
export function staffSafePath(
  pathname: string | null | undefined,
  role?: string,
): string | null {
  if (!pathname) return null;
  if (role === 'SUPER_ADMIN') return pathname;
  if (isSuperAdminOnlyPath(pathname)) return '/dashboard';
  return pathname;
}

export function resolveNotificationTarget(
  item: { actionUrl?: string | null; relatedModule?: string | null },
  role?: string,
): string | null {
  if (item.actionUrl) return staffSafePath(item.actionUrl, role);
  const mod = item.relatedModule;
  if (mod === 'APPROVALS') return staffSafePath('/approvals', role);
  if (mod === 'BOOKINGS') return '/daily-guests';
  if (mod === 'INVENTORY') return staffSafePath('/inventory', role);
  if (mod === 'ELECTRICITY') return '/expenses';
  if (mod === 'MONTHLY_TENANTS') return '/monthly-tenants';
  if (mod === 'OWNERS') return staffSafePath('/owners', role);
  if (mod === 'EMPLOYEES') return staffSafePath('/employees', role);
  if (mod === 'UNITS') return '/rooms';
  if (mod === 'PAYMENTS') return staffSafePath('/payments', role);
  if (mod === 'SETTINGS') return staffSafePath('/settings', role);
  return null;
}
