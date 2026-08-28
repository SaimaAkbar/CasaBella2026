import { apiRequest, toQueryString } from './client';
import type {
  MonthlyTenant,
  MonthlyTenantInput,
  MonthlyTenantQuery,
} from '../types/monthly-tenant';

export function fetchMonthlyTenants(
  token: string,
  query: MonthlyTenantQuery = {},
): Promise<MonthlyTenant[]> {
  return apiRequest<MonthlyTenant[]>(
    `/monthly-tenants${toQueryString({
      search: query.search,
      isActive: query.isActive,
    })}`,
    { token },
  );
}

export function fetchMonthlyTenant(
  token: string,
  id: string,
): Promise<MonthlyTenant> {
  return apiRequest<MonthlyTenant>(`/monthly-tenants/${id}`, { token });
}

export function createMonthlyTenant(
  token: string,
  payload: MonthlyTenantInput,
): Promise<MonthlyTenant> {
  return apiRequest<MonthlyTenant>('/monthly-tenants', {
    method: 'POST',
    token,
    body: payload,
  });
}

export function updateMonthlyTenant(
  token: string,
  id: string,
  payload: Partial<MonthlyTenantInput>,
): Promise<MonthlyTenant> {
  return apiRequest<MonthlyTenant>(`/monthly-tenants/${id}`, {
    method: 'PATCH',
    token,
    body: payload,
  });
}

export function archiveMonthlyTenant(
  token: string,
  id: string,
): Promise<MonthlyTenant> {
  return apiRequest<MonthlyTenant>(`/monthly-tenants/${id}`, {
    method: 'DELETE',
    token,
  });
}
