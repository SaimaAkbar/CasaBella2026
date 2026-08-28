import { apiRequest, toQueryString } from './client';
import type {
  ExpenseBreakdownRow,
  IncomeBreakdownRow,
  NamedAmount,
  ProfitLossByPropertyRow,
  ProfitLossByUnitRow,
  ProfitLossQuery,
  ProfitLossSummary,
  ProfitLossTrendRow,
} from '../types/profit-loss';

function queryParams(query: ProfitLossQuery) {
  return toQueryString({
    date: query.date || undefined,
    month:
      query.month === '' || query.month === undefined
        ? undefined
        : query.month,
    year:
      query.year === '' || query.year === undefined ? undefined : query.year,
    startDate: query.startDate || undefined,
    endDate: query.endDate || undefined,
    propertyId: query.propertyId || undefined,
    unitId: query.unitId || undefined,
    accountingView: query.accountingView || undefined,
  });
}

export function fetchProfitLossSummary(
  token: string,
  query: ProfitLossQuery = {},
): Promise<ProfitLossSummary> {
  return apiRequest<ProfitLossSummary>(
    `/profit-loss/summary${queryParams(query)}`,
    { token },
  );
}

export function fetchProfitLossTrend(
  token: string,
  query: Pick<
    ProfitLossQuery,
    'year' | 'propertyId' | 'unitId' | 'accountingView'
  > = {},
): Promise<ProfitLossTrendRow[]> {
  return apiRequest<ProfitLossTrendRow[]>(
    `/profit-loss/trend${queryParams(query)}`,
    { token },
  );
}

export function fetchProfitLossByProperty(
  token: string,
  query: ProfitLossQuery = {},
): Promise<ProfitLossByPropertyRow[]> {
  return apiRequest<ProfitLossByPropertyRow[]>(
    `/profit-loss/by-property${queryParams(query)}`,
    { token },
  );
}

export function fetchProfitLossByUnit(
  token: string,
  query: ProfitLossQuery & { propertyId: string },
): Promise<ProfitLossByUnitRow[]> {
  return apiRequest<ProfitLossByUnitRow[]>(
    `/profit-loss/by-unit${queryParams(query)}`,
    { token },
  );
}

export function fetchIncomeBreakdown(
  token: string,
  query: ProfitLossQuery = {},
): Promise<IncomeBreakdownRow[]> {
  return apiRequest<IncomeBreakdownRow[]>(
    `/profit-loss/income-breakdown${queryParams(query)}`,
    { token },
  );
}

export function fetchExpenseBreakdown(
  token: string,
  query: ProfitLossQuery = {},
): Promise<ExpenseBreakdownRow[]> {
  return apiRequest<ExpenseBreakdownRow[]>(
    `/profit-loss/expense-breakdown${queryParams(query)}`,
    { token },
  );
}

export function fetchIncomeSources(
  token: string,
  query: ProfitLossQuery = {},
): Promise<NamedAmount[]> {
  return apiRequest<NamedAmount[]>(
    `/profit-loss/income-sources${queryParams(query)}`,
    { token },
  );
}

export function fetchExpenseCategories(
  token: string,
  query: ProfitLossQuery = {},
): Promise<NamedAmount[]> {
  return apiRequest<NamedAmount[]>(
    `/profit-loss/expense-categories${queryParams(query)}`,
    { token },
  );
}
