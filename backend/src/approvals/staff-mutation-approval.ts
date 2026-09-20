import {
  ApprovalActionType,
  ApprovalModuleName,
} from '../../generated/prisma/client';

export const HTTP_REPLAY_KIND = 'http_replay' as const;

export const APPROVAL_REPLAY_HEADER = 'x-approval-replay';

export type HttpReplayPayload = {
  kind: typeof HTTP_REPLAY_KIND;
  method: string;
  path: string;
  query?: Record<string, unknown>;
  body?: unknown;
};

const MUTE_PREFIXES = [
  '/auth',
  '/health',
  '/notifications',
  '/approval-requests',
];

/** Desk operations that must apply immediately (cash in hand / occupancy). */
const IMMEDIATE_POST_EXACT = new Set([
  '/payments',
  '/bookings',
  '/guests',
  '/units/upload-image',
]);

const IMMEDIATE_POST_SUFFIXES = [
  '/check-in',
  '/check-out',
  '/record-payment',
  '/cancel',
  '/no-show',
];

/** Online bank-transfer verification must apply as soon as staff confirms the bank. */
function isImmediateOnlineBankTransferPost(route: string): boolean {
  if (!route.startsWith('/online-bookings/payments/')) return false;
  return route.endsWith('/verify') || route.endsWith('/reject');
}

const UUID_RE =
  /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

const PREFIX_MODULES: Array<{ prefix: string; module: ApprovalModuleName }> = [
  { prefix: '/properties', module: ApprovalModuleName.PROPERTY },
  { prefix: '/units', module: ApprovalModuleName.UNITS },
  { prefix: '/monthly-tenants', module: ApprovalModuleName.MONTHLY_TENANTS },
  { prefix: '/monthly-tenancies', module: ApprovalModuleName.MONTHLY_TENANTS },
  { prefix: '/monthly-agreements', module: ApprovalModuleName.MONTHLY_TENANTS },
  { prefix: '/monthly-bills', module: ApprovalModuleName.MONTHLY_TENANTS },
  { prefix: '/tenant-unit-hotel-use', module: ApprovalModuleName.MONTHLY_TENANTS },
  { prefix: '/tenant-unit-assignments', module: ApprovalModuleName.MONTHLY_TENANTS },
  { prefix: '/bookings', module: ApprovalModuleName.BOOKINGS },
  { prefix: '/guests', module: ApprovalModuleName.BOOKINGS },
  { prefix: '/payments', module: ApprovalModuleName.PAYMENTS },
  { prefix: '/expenses', module: ApprovalModuleName.EXPENSES },
  { prefix: '/expense-categories', module: ApprovalModuleName.EXPENSES },
  { prefix: '/electricity-readings', module: ApprovalModuleName.ELECTRICITY },
  { prefix: '/electricity-rates', module: ApprovalModuleName.ELECTRICITY },
  { prefix: '/owners', module: ApprovalModuleName.OWNERS },
  { prefix: '/owner-unit-assignments', module: ApprovalModuleName.OWNERS },
  { prefix: '/owner-unit-agreements', module: ApprovalModuleName.OWNERS },
  { prefix: '/owner-monthly-statements', module: ApprovalModuleName.OWNERS },
  { prefix: '/owner-payment-transactions', module: ApprovalModuleName.OWNERS },
  { prefix: '/employees', module: ApprovalModuleName.EMPLOYEES },
  { prefix: '/salary-records', module: ApprovalModuleName.SALARY },
  { prefix: '/salary-transactions', module: ApprovalModuleName.SALARY },
  { prefix: '/inventory-items', module: ApprovalModuleName.INVENTORY },
  { prefix: '/inventory-categories', module: ApprovalModuleName.INVENTORY },
  { prefix: '/inventory-movements', module: ApprovalModuleName.INVENTORY },
  { prefix: '/room-assets', module: ApprovalModuleName.INVENTORY },
  { prefix: '/settings', module: ApprovalModuleName.SETTINGS },
  { prefix: '/users', module: ApprovalModuleName.SETTINGS },
];

export function normalizeRoute(path: string): string {
  const withoutQuery = (path.split('?')[0] || '/').trim();
  const collapsed = withoutQuery.replace(/\/+$/, '') || '/';
  return collapsed.startsWith('/') ? collapsed : `/${collapsed}`;
}

export function isHttpReplayPayload(
  value: unknown,
): value is HttpReplayPayload {
  if (!value || typeof value !== 'object') return false;
  const row = value as Record<string, unknown>;
  return (
    row.kind === HTTP_REPLAY_KIND &&
    typeof row.method === 'string' &&
    typeof row.path === 'string'
  );
}

export function shouldQueueStaffMutation(
  method: string,
  path: string,
): boolean {
  const verb = method.toUpperCase();
  if (!['POST', 'PATCH', 'PUT', 'DELETE'].includes(verb)) {
    return false;
  }

  const route = normalizeRoute(path);
  if (
    MUTE_PREFIXES.some(
      (prefix) => route === prefix || route.startsWith(`${prefix}/`),
    )
  ) {
    return false;
  }

  if (verb === 'POST' && isImmediateStaffPost(route)) {
    return false;
  }

  if (verb === 'POST' && isImmediateOnlineBankTransferPost(route)) {
    return false;
  }

  return true;
}

export function moduleNameFromPath(path: string): ApprovalModuleName {
  const route = normalizeRoute(path);
  const match = PREFIX_MODULES.find(
    (row) => route === row.prefix || route.startsWith(`${row.prefix}/`),
  );
  return match?.module ?? ApprovalModuleName.SETTINGS;
}

export function actionTypeFromRequest(
  method: string,
  path: string,
): ApprovalActionType {
  const verb = method.toUpperCase();
  const route = normalizeRoute(path);
  if (verb === 'DELETE' || route.endsWith('/archive')) {
    return route.endsWith('/archive')
      ? ApprovalActionType.ARCHIVE
      : ApprovalActionType.DELETE;
  }
  if (verb === 'POST' && !hasRecordUuid(route)) {
    return ApprovalActionType.CREATE;
  }
  return ApprovalActionType.UPDATE;
}

export function recordIdFromPath(method: string, path: string): string {
  const route = normalizeRoute(path);
  const matches = route.match(new RegExp(UUID_RE, 'gi'));
  if (matches && matches.length > 0) {
    return matches[matches.length - 1];
  }
  return `route:${method.toUpperCase()}:${route}`;
}

export function reasonFromBody(body: unknown): string | undefined {
  if (!body || typeof body !== 'object') return undefined;
  const row = body as Record<string, unknown>;
  if (typeof row.approvalReason === 'string' && row.approvalReason.trim()) {
    return row.approvalReason.trim();
  }
  if (typeof row.reason === 'string' && row.reason.trim()) {
    return row.reason.trim().slice(0, 2000);
  }
  return undefined;
}

function isImmediateStaffPost(route: string): boolean {
  if (IMMEDIATE_POST_EXACT.has(route)) return true;
  return IMMEDIATE_POST_SUFFIXES.some((suffix) => route.endsWith(suffix));
}

function hasRecordUuid(route: string): boolean {
  return UUID_RE.test(route);
}
