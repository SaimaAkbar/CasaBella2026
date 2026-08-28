import { apiRequest, toQueryString } from './client';
import type { InventoryCategory } from '../types/inventory';

export function fetchInventoryCategories(
  token: string,
  includeInactive = false,
): Promise<InventoryCategory[]> {
  return apiRequest<InventoryCategory[]>(
    `/inventory-categories${toQueryString({
      includeInactive: includeInactive ? 'true' : undefined,
    })}`,
    { token },
  );
}

export function createInventoryCategory(
  token: string,
  payload: { name: string; description?: string },
): Promise<InventoryCategory> {
  return apiRequest<InventoryCategory>('/inventory-categories', {
    method: 'POST',
    token,
    body: payload,
  });
}

export function updateInventoryCategory(
  token: string,
  id: string,
  payload: { name?: string; description?: string; isActive?: boolean },
): Promise<InventoryCategory> {
  return apiRequest<InventoryCategory>(`/inventory-categories/${id}`, {
    method: 'PATCH',
    token,
    body: payload,
  });
}

export function archiveInventoryCategory(
  token: string,
  id: string,
): Promise<InventoryCategory> {
  return apiRequest<InventoryCategory>(`/inventory-categories/${id}`, {
    method: 'DELETE',
    token,
  });
}
