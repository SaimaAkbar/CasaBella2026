import { apiRequest } from './client';
import type {
  DashboardFilterOptions,
  DashboardFiltersState,
  DashboardRoomGridItem,
  DashboardSummary,
  DashboardUnitGridDetail,
} from '../types/dashboard';

function toQuery(params: Record<string, string | undefined>): string {
  const search = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value) {
      search.set(key, value);
    }
  });

  const query = search.toString();
  return query ? `?${query}` : '';
}

function buildSharedParams(
  filters: DashboardFiltersState,
  options?: { includeDisplayStatus?: boolean },
) {
  const displayStatus =
    filters.displayStatus || filters.status || undefined;
  return {
    propertyId: filters.propertyId || undefined,
    apartmentId: filters.apartmentId || filters.unitId || undefined,
    unitId: filters.unitId || filters.apartmentId || undefined,
    // Prefer displayStatus query param; keep status for backward compatibility.
    ...(options?.includeDisplayStatus !== false && displayStatus
      ? { displayStatus, status: displayStatus }
      : {}),
    unitType: filters.unitType || undefined,
    bookingType: filters.bookingType || undefined,
    search: filters.search || undefined,
  };
}

function buildPeriodParams(filters: DashboardFiltersState) {
  const now = new Date();

  if (filters.period === 'today') {
    return { today: 'true' };
  }

  if (filters.period === 'date') {
    return { date: filters.date || undefined };
  }

  if (filters.period === 'month') {
    return {
      month: filters.month || String(now.getMonth() + 1),
      year: filters.year || String(now.getFullYear()),
    };
  }

  if (filters.period === 'year') {
    return {
      year: filters.year || String(now.getFullYear()),
    };
  }

  if (filters.period === 'custom') {
    return {
      startDate: filters.dateFrom || undefined,
      endDate: filters.dateTo || undefined,
      dateFrom: filters.dateFrom || undefined,
      dateTo: filters.dateTo || undefined,
    };
  }

  return {};
}

function buildSummaryParams(filters: DashboardFiltersState) {
  // Summary card counts must ignore the active displayStatus filter so
  // cards remain a stable filter UI under property / type / search.
  return {
    ...buildSharedParams(filters, { includeDisplayStatus: false }),
    ...buildPeriodParams(filters),
  };
}

function buildGridParams(filters: DashboardFiltersState) {
  return {
    ...buildSharedParams(filters, { includeDisplayStatus: true }),
    ...buildPeriodParams(filters),
  };
}

/** Stable query-key fragment for dashboard fetches (React Query–style). */
export function dashboardFilterQueryKey(filters: DashboardFiltersState) {
  return [
    filters.propertyId || null,
    filters.unitId || filters.apartmentId || null,
    filters.unitType || null,
    filters.displayStatus || filters.status || null,
    filters.bookingType || null,
    filters.search || null,
    filters.period,
    filters.date || null,
    filters.month || null,
    filters.year || null,
    filters.dateFrom || null,
    filters.dateTo || null,
  ] as const;
}

export function fetchDashboardSummary(
  token: string,
  filters: DashboardFiltersState,
): Promise<DashboardSummary> {
  return apiRequest<DashboardSummary>(
    `/dashboard/summary${toQuery(buildSummaryParams(filters))}`,
    { token },
  );
}

export function fetchDashboardRoomGrid(
  token: string,
  filters: DashboardFiltersState,
): Promise<DashboardRoomGridItem[]> {
  return apiRequest<DashboardRoomGridItem[]>(
    `/dashboard/unit-grid${toQuery(buildGridParams(filters))}`,
    { token },
  );
}

export function fetchDashboardUnitDetail(
  token: string,
  unitId: string,
): Promise<DashboardUnitGridDetail> {
  return apiRequest<DashboardUnitGridDetail>(
    `/dashboard/unit-grid/${unitId}`,
    { token },
  );
}

export function fetchDashboardFilterOptions(
  token: string,
): Promise<DashboardFilterOptions> {
  return apiRequest<DashboardFilterOptions>('/dashboard/filter-options', {
    token,
  });
}

export type FinancialReconciliationReport = {
  period: {
    startDate: string;
    endDate: string;
    label: string;
    accountingView: 'CASH' | 'ACCRUAL';
  };
  netLabel: 'Net Cash Flow' | 'Net Profit';
  cards: {
    totalIncome: string;
    totalExpenses: string;
    net: string;
    outstandingReceivable: string;
  };
  incomeBreakdown: Array<{ source: string; amount: string }>;
  expenseBreakdown: Array<{ category: string; amount: string }>;
  outstandingBreakdown: {
    booking: string;
    monthlyBill: string;
    monthlyTenancyLegacy: string;
    total: string;
  };
  ownerSeparate: {
    receivable: string;
    received: string;
    outstandingReceivable: string;
    payable: string;
    paid: string;
    outstandingPayable: string;
    note: string;
  };
  securityDeposits: {
    agreementLiabilityTotal: string;
    paymentLedgerOperatingIncome: string;
    note: string;
  };
  lines: Array<{
    key: string;
    label: string;
    cardAmount: string;
    ledgerAmount: string;
    difference: string;
    matched: boolean;
    notes?: string;
  }>;
  badDataFlags: string[];
  status: 'PASSED' | 'FAILED';
  classification: Record<string, string>;
};

export function fetchFinancialReconciliation(
  token: string,
  filters: DashboardFiltersState,
): Promise<FinancialReconciliationReport> {
  return apiRequest<FinancialReconciliationReport>(
    `/dashboard/financial-reconciliation${toQuery(buildSummaryParams(filters))}`,
    { token },
  );
}
