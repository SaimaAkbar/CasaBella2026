import { ForbiddenException } from '@nestjs/common';
import { Role } from '../../generated/prisma/client';
import type { ReportCatalogItem, ReportType } from './report.types';

export type ReportAccessContext = {
  role: Role;
  canAccessSalary: boolean;
  canAccessProfitLoss: boolean;
};

const CATALOG: ReportCatalogItem[] = [
  {
    reportType: 'occupancy',
    reportName: 'Occupancy Report',
    description: 'Current room and apartment occupancy snapshot',
    category: 'Operations',
    availability: 'READY',
  },
  {
    reportType: 'daily-bookings',
    reportName: 'Daily Guest Booking Report',
    description: 'Hourly and daily guest bookings for a period',
    category: 'Guests and Tenants',
    availability: 'READY',
  },
  {
    reportType: 'monthly-tenants',
    reportName: 'Monthly Tenant Report',
    description: 'Active and historical monthly tenancies',
    category: 'Guests and Tenants',
    availability: 'READY',
  },
  {
    reportType: 'payments',
    reportName: 'Payment Report',
    description: 'Payment ledger with net received',
    category: 'Finance',
    availability: 'READY',
  },
  {
    reportType: 'outstanding-balances',
    reportName: 'Outstanding Balance Report',
    description: 'Open balances for bookings and tenancies',
    category: 'Finance',
    availability: 'READY',
  },
  {
    reportType: 'expenses',
    reportName: 'Expense Report',
    description: 'Active expenses with category breakdown',
    category: 'Finance',
    availability: 'READY',
  },
  {
    reportType: 'electricity',
    reportName: 'Electricity Report',
    description: 'Meter readings and calculated bills',
    category: 'Finance',
    availability: 'READY',
  },
  {
    reportType: 'property-income',
    reportName: 'Property and Unit Income Report',
    description: 'Income and direct expenses by property/unit',
    category: 'Finance',
    availability: 'READY',
  },
  {
    reportType: 'profit-loss',
    reportName: 'Profit and Loss Report',
    description: 'Reuse of the Profit & Loss calculation service',
    category: 'Finance',
    availability: 'READY',
  },
  {
    reportType: 'owners',
    reportName: 'Owner Directory / Apartment Ownership Report',
    description: 'Owner profiles, shares and apartment ownership totals',
    category: 'Owners',
    availability: 'READY',
  },
  {
    reportType: 'owner-payments',
    reportName: 'Owner Monthly Collection / Payment History',
    description: 'Owner monthly statements, payments and outstanding balances',
    category: 'Owners',
    availability: 'READY',
  },
  {
    reportType: 'employees',
    reportName: 'Employee Report',
    description: 'Staff directory and employment status',
    category: 'Employees',
    availability: 'READY',
  },
  {
    reportType: 'salaries',
    reportName: 'Salary Report',
    description: 'Monthly salary records and balances',
    category: 'Employees',
    availability: 'READY',
  },
  {
    reportType: 'inventory-stock',
    reportName: 'Inventory Stock Report',
    description: 'Current stock levels and valuation',
    category: 'Inventory',
    availability: 'READY',
  },
  {
    reportType: 'inventory-movements',
    reportName: 'Inventory Movement Report',
    description: 'Purchases, issues, transfers and adjustments',
    category: 'Inventory',
    availability: 'READY',
  },
  {
    reportType: 'room-assets',
    reportName: 'Room Asset Report',
    description: 'Fixed assets assigned to rooms',
    category: 'Inventory',
    availability: 'READY',
  },
  {
    reportType: 'audit-logs',
    reportName: 'User Activity and Audit Report',
    description: 'System audit trail',
    category: 'Audit',
    availability: 'READY',
  },
];

export function listReportCatalog(ctx: ReportAccessContext): ReportCatalogItem[] {
  return CATALOG.filter((item) => canAccessReport(item.reportType, ctx));
}

export function canAccessReport(
  _reportType: ReportType,
  ctx: ReportAccessContext,
): boolean {
  return ctx.role === Role.SUPER_ADMIN;
}

export function assertReportAccess(
  reportType: ReportType,
  ctx: ReportAccessContext,
) {
  if (!canAccessReport(reportType, ctx)) {
    throw new ForbiddenException(
      'You do not have permission to access this report',
    );
  }
}

export function reportName(reportType: ReportType): string {
  return (
    CATALOG.find((item) => item.reportType === reportType)?.reportName ??
    reportType
  );
}
