import { apiRequest, toQueryString } from './client';
import type {
  CreateHotelUseBookingInput,
  CreateHotelUseInput,
  EligibleHotelUseAssignment,
  HotelUseQuery,
  TenantUnitHotelUse,
} from '../types/hotel-use';
import type { Booking } from '../types/booking';

function queryParams(query: HotelUseQuery) {
  return toQueryString({
    tenantId: query.tenantId,
    propertyId: query.propertyId,
    unitId: query.unitId,
    monthlyTenancyId: query.monthlyTenancyId,
    status: query.status || undefined,
    month: query.month === '' || query.month === undefined ? undefined : query.month,
    year: query.year === '' || query.year === undefined ? undefined : query.year,
    search: query.search,
  });
}

export function fetchEligibleHotelUseAssignments(
  token: string,
  query: { tenantId?: string; propertyId?: string; unitId?: string } = {},
): Promise<EligibleHotelUseAssignment[]> {
  return apiRequest<EligibleHotelUseAssignment[]>(
    `/tenant-unit-assignments/eligible-for-hotel-use${toQueryString(query)}`,
    { token },
  );
}

export function fetchHotelUses(
  token: string,
  query: HotelUseQuery = {},
): Promise<TenantUnitHotelUse[]> {
  return apiRequest<TenantUnitHotelUse[]>(
    `/tenant-unit-hotel-use${queryParams(query)}`,
    { token },
  );
}

export function fetchHotelUse(
  token: string,
  id: string,
): Promise<TenantUnitHotelUse> {
  return apiRequest<TenantUnitHotelUse>(`/tenant-unit-hotel-use/${id}`, {
    token,
  });
}

export function createHotelUse(
  token: string,
  payload: CreateHotelUseInput,
): Promise<TenantUnitHotelUse> {
  return apiRequest<TenantUnitHotelUse>('/tenant-unit-hotel-use', {
    method: 'POST',
    token,
    body: payload,
  });
}

export function approveHotelUse(
  token: string,
  id: string,
): Promise<TenantUnitHotelUse> {
  return apiRequest<TenantUnitHotelUse>(`/tenant-unit-hotel-use/${id}/approve`, {
    method: 'POST',
    token,
  });
}

export function cancelHotelUse(
  token: string,
  id: string,
): Promise<TenantUnitHotelUse> {
  return apiRequest<TenantUnitHotelUse>(`/tenant-unit-hotel-use/${id}/cancel`, {
    method: 'POST',
    token,
  });
}

export function settleHotelUse(
  token: string,
  id: string,
  payload: { billingMonth?: number; billingYear?: number; notes?: string } = {},
): Promise<TenantUnitHotelUse> {
  return apiRequest<TenantUnitHotelUse>(`/tenant-unit-hotel-use/${id}/settle`, {
    method: 'POST',
    token,
    body: payload,
  });
}

export function createHotelUseBooking(
  token: string,
  hotelUseId: string,
  payload: CreateHotelUseBookingInput,
): Promise<Booking> {
  return apiRequest<Booking>(
    `/tenant-unit-hotel-use/${hotelUseId}/create-booking`,
    {
      method: 'POST',
      token,
      body: payload,
    },
  );
}
