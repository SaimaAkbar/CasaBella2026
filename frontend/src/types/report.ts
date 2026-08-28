export const REPORT_TYPES = [
  'occupancy',
  'daily-bookings',
  'monthly-tenants',
  'payments',
  'outstanding-balances',
  'expenses',
  'electricity',
  'property-income',
  'profit-loss',
  'owners',
  'owner-payments',
  'employees',
  'salaries',
  'inventory-stock',
  'inventory-movements',
  'room-assets',
  'audit-logs',
] as const;

export type ReportType = (typeof REPORT_TYPES)[number];

export type ExportFormat = 'pdf' | 'xlsx' | 'csv';

export type ReportCategory =
  | 'Operations'
  | 'Guests and Tenants'
  | 'Finance'
  | 'Owners'
  | 'Employees'
  | 'Inventory'
  | 'Audit';

export type ReportColumn = {
  key: string;
  header: string;
  sensitive?: boolean;
};

export type ReportPagination = {
  page: number;
  limit: number;
  total: number;
};

export type ReportPayload = {
  reportName: string;
  reportType: ReportType;
  generatedAt: string;
  generatedBy: { id: string; fullName: string; role: string };
  filters: Record<string, unknown>;
  summary: Record<string, string | number | null>;
  columns: ReportColumn[];
  rows: Array<Record<string, unknown>>;
  totals: Record<string, string | number | null>;
  pagination: ReportPagination;
  metadata?: {
    notice?: string;
    availability?: 'READY' | 'NOT_IMPLEMENTED';
    confidential?: boolean;
  };
};

export type ReportCatalogItem = {
  reportType: ReportType;
  reportName: string;
  description: string;
  category: ReportCategory;
  availability: 'READY' | 'NOT_IMPLEMENTED';
};

export type ReportQuery = {
  date?: string;
  month?: number;
  year?: number;
  startDate?: string;
  endDate?: string;
  propertyId?: string;
  unitId?: string;
  tenantId?: string;
  guestId?: string;
  employeeId?: string;
  categoryId?: string;
  bookingType?: string;
  bookingStatus?: string;
  paymentStatus?: string;
  paymentMethod?: string;
  movementType?: string;
  condition?: string;
  accountingView?: 'ACCRUAL' | 'CASH';
  search?: string;
  page?: number;
  limit?: number;
};
