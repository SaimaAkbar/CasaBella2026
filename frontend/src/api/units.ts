import { apiRequest, toQueryString } from './client';
import type { Unit, UnitInput, UnitQuery } from '../types/unit';

export function fetchUnits(token: string, query: UnitQuery = {}): Promise<Unit[]> {
  return apiRequest<Unit[]>(
    `/units${toQueryString({
      propertyId: query.propertyId,
      unitType: query.unitType || undefined,
      status: query.status || undefined,
      isActive:
        query.isActive === '' || query.isActive === undefined
          ? undefined
          : query.isActive,
      search: query.search,
    })}`,
    { token },
  );
}

export function fetchUnit(token: string, id: string): Promise<Unit> {
  return apiRequest<Unit>(`/units/${id}`, { token });
}

export function createUnit(token: string, payload: UnitInput): Promise<Unit> {
  return apiRequest<Unit>('/units', {
    method: 'POST',
    token,
    body: payload,
  });
}

export function updateUnit(
  token: string,
  id: string,
  payload: Partial<UnitInput>,
): Promise<Unit> {
  return apiRequest<Unit>(`/units/${id}`, {
    method: 'PATCH',
    token,
    body: payload,
  });
}

export function archiveUnit(token: string, id: string): Promise<Unit> {
  return apiRequest<Unit>(`/units/${id}`, {
    method: 'DELETE',
    token,
  });
}
