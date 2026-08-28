import type { AuthUser } from '../common/types/auth-user.type';
import type {
  ReportColumn,
  ReportPagination,
  ReportPayload,
  ReportType,
} from './report.types';
import { reportName } from './report-permissions';

export function paginateRows<T>(
  rows: T[],
  page = 1,
  limit = 25,
): { rows: T[]; pagination: ReportPagination } {
  const safePage = Math.max(1, page);
  const safeLimit = Math.min(Math.max(1, limit), 500);
  const total = rows.length;
  const start = (safePage - 1) * safeLimit;
  return {
    rows: rows.slice(start, start + safeLimit),
    pagination: { page: safePage, limit: safeLimit, total },
  };
}

export function buildReport(input: {
  reportType: ReportType;
  user: AuthUser;
  filters: Record<string, unknown>;
  summary?: Record<string, string | number | null>;
  columns: ReportColumn[];
  rows: Array<Record<string, unknown>>;
  totals?: Record<string, string | number | null>;
  page?: number;
  limit?: number;
  metadata?: ReportPayload['metadata'];
  /** When true, do not paginate (used for exports). */
  allRows?: boolean;
}): ReportPayload {
  const paged = input.allRows
    ? {
        rows: input.rows,
        pagination: {
          page: 1,
          limit: input.rows.length,
          total: input.rows.length,
        },
      }
    : paginateRows(input.rows, input.page, input.limit);

  return {
    reportName: reportName(input.reportType),
    reportType: input.reportType,
    generatedAt: new Date().toISOString(),
    generatedBy: {
      id: input.user.id,
      fullName: input.user.fullName,
      role: input.user.role,
    },
    filters: input.filters,
    summary: input.summary ?? {},
    columns: input.columns,
    rows: paged.rows,
    totals: input.totals ?? {},
    pagination: paged.pagination,
    metadata: input.metadata,
  };
}

export function money(value: unknown): string {
  if (value === null || value === undefined || value === '') return '0';
  return String(value);
}
