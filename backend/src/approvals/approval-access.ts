import { Role } from '../../generated/prisma/client';

/** Modules that participate in the centralized approval workflow. */
export const APPROVAL_MODULES = [
  'PROPERTY',
  'UNITS',
  'MONTHLY_TENANTS',
  'BOOKINGS',
  'PAYMENTS',
  'EXPENSES',
  'ELECTRICITY',
  'OWNERS',
  'EMPLOYEES',
  'SALARY',
  'INVENTORY',
  'SETTINGS',
] as const;

export type ApprovalModuleKey = (typeof APPROVAL_MODULES)[number];

/** Receptionist cannot create approval requests for these modules. */
export const RECEPTIONIST_APPROVAL_BLOCKED_MODULES: ReadonlySet<ApprovalModuleKey> =
  new Set();

export function canAccessApprovals(role: Role): boolean {
  return role === Role.SUPER_ADMIN;
}

export function canDecideApprovals(role: Role): boolean {
  return role === Role.SUPER_ADMIN;
}

export function canAccessAuditLogs(role: Role): boolean {
  return role === Role.SUPER_ADMIN;
}

export function canMutateAuditLogs(role: Role): boolean {
  return role === Role.SUPER_ADMIN;
}
