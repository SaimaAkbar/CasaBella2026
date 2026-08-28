import { apiRequest, toQueryString } from './client';
import type {
  EligibleUnit,
  MonthlyTenancy,
  MonthlyTenancyInput,
  MonthlyTenancyQuery,
  MonthlyTenancySummary,
} from '../types/monthly-tenancy';

function queryParams(query: MonthlyTenancyQuery) {
  return toQueryString({
    tenantId: query.tenantId,
    propertyId: query.propertyId,
    unitId: query.unitId,
    tenancyStatus: query.tenancyStatus || undefined,
    occupancyState: query.occupancyState || undefined,
    month: query.month === '' || query.month === undefined ? undefined : query.month,
    year: query.year === '' || query.year === undefined ? undefined : query.year,
    startDate: query.startDate,
    endDate: query.endDate,
    search: query.search,
  });
}

export function fetchMonthlyTenancies(
  token: string,
  query: MonthlyTenancyQuery = {},
): Promise<MonthlyTenancy[]> {
  return apiRequest<MonthlyTenancy[]>(
    `/monthly-tenancies${queryParams(query)}`,
    { token },
  );
}

export function fetchMonthlyTenancySummary(
  token: string,
  query: MonthlyTenancyQuery = {},
): Promise<MonthlyTenancySummary> {
  return apiRequest<MonthlyTenancySummary>(
    `/monthly-tenancies/summary/stats${queryParams(query)}`,
    { token },
  );
}

export function fetchEligibleUnits(
  token: string,
  query: {
    propertyId: string;
    tenantId?: string;
    startDate?: string;
    endDate?: string;
    includeMonthlyVacant?: boolean;
  },
): Promise<EligibleUnit[]> {
  return apiRequest<EligibleUnit[]>(
    `/monthly-unit-assignments/eligible-units${toQueryString({
      propertyId: query.propertyId,
      tenantId: query.tenantId,
      startDate: query.startDate,
      endDate: query.endDate,
      includeMonthlyVacant: query.includeMonthlyVacant,
    })}`,
    { token },
  );
}

export function fetchMonthlyTenancy(
  token: string,
  id: string,
): Promise<MonthlyTenancy> {
  return apiRequest<MonthlyTenancy>(`/monthly-tenancies/${id}`, { token });
}

export function createMonthlyTenancy(
  token: string,
  payload: MonthlyTenancyInput,
): Promise<MonthlyTenancy> {
  return apiRequest<MonthlyTenancy>('/monthly-tenancies', {
    method: 'POST',
    token,
    body: payload,
  });
}

export function updateMonthlyTenancy(
  token: string,
  id: string,
  payload: Partial<MonthlyTenancyInput>,
): Promise<MonthlyTenancy> {
  return apiRequest<MonthlyTenancy>(`/monthly-tenancies/${id}`, {
    method: 'PATCH',
    token,
    body: payload,
  });
}

export function markTenancyEmpty(
  token: string,
  id: string,
): Promise<MonthlyTenancy> {
  return apiRequest<MonthlyTenancy>(`/monthly-tenancies/${id}/mark-empty`, {
    method: 'POST',
    token,
  });
}

export function markTenancyOccupied(
  token: string,
  id: string,
): Promise<MonthlyTenancy> {
  return apiRequest<MonthlyTenancy>(`/monthly-tenancies/${id}/mark-occupied`, {
    method: 'POST',
    token,
  });
}

export function changeAssignmentUnit(
  token: string,
  id: string,
  payload: {
    propertyId: string;
    unitId: string;
    assignmentStart?: string;
    monthlyRent?: number;
    hotelUseAllowed?: boolean;
  },
): Promise<MonthlyTenancy> {
  return apiRequest<MonthlyTenancy>(
    `/monthly-unit-assignments/${id}/change-unit`,
    {
      method: 'POST',
      token,
      body: payload,
    },
  );
}

export function endMonthlyTenancy(
  token: string,
  id: string,
): Promise<MonthlyTenancy> {
  return apiRequest<MonthlyTenancy>(`/monthly-tenancies/${id}/end`, {
    method: 'POST',
    token,
  });
}

export function recordRentRevision(
  token: string,
  id: string,
  payload: { newRent: number; effectiveFrom: string; reason?: string },
): Promise<MonthlyTenancy> {
  return apiRequest<MonthlyTenancy>(
    `/monthly-tenancies/${id}/rent-revision`,
    {
      method: 'POST',
      token,
      body: payload,
    },
  );
}
