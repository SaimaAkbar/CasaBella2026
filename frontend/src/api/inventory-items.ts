import { apiRequest, toQueryString } from './client';
import type {
  InventoryItem,
  InventoryItemInput,
  InventoryItemQuery,
  InventorySummary,
} from '../types/inventory';

function queryParams(query: InventoryItemQuery) {
  return toQueryString({
    categoryId: query.categoryId || undefined,
    isConsumable:
      query.isConsumable === '' || query.isConsumable === undefined
        ? undefined
        : String(query.isConsumable),
    isActive:
      query.isActive === '' || query.isActive === undefined
        ? undefined
        : String(query.isActive),
    lowStock:
      query.lowStock === '' || query.lowStock === undefined
        ? undefined
        : String(query.lowStock),
    search: query.search || undefined,
  });
}

export function fetchInventoryItems(
  token: string,
  query: InventoryItemQuery = {},
): Promise<InventoryItem[]> {
  return apiRequest<InventoryItem[]>(
    `/inventory-items${queryParams(query)}`,
    { token },
  );
}

export function fetchInventorySummary(
  token: string,
): Promise<InventorySummary> {
  return apiRequest<InventorySummary>('/inventory-items/summary/stats', {
    token,
  });
}

export function fetchInventoryItem(
  token: string,
  id: string,
): Promise<InventoryItem> {
  return apiRequest<InventoryItem>(`/inventory-items/${id}`, { token });
}

export function createInventoryItem(
  token: string,
  payload: InventoryItemInput,
): Promise<InventoryItem> {
  return apiRequest<InventoryItem>('/inventory-items', {
    method: 'POST',
    token,
    body: payload,
  });
}

export function updateInventoryItem(
  token: string,
  id: string,
  payload: Partial<InventoryItemInput> & { isActive?: boolean },
): Promise<InventoryItem> {
  return apiRequest<InventoryItem>(`/inventory-items/${id}`, {
    method: 'PATCH',
    token,
    body: payload,
  });
}

export function archiveInventoryItem(
  token: string,
  id: string,
): Promise<InventoryItem> {
  return apiRequest<InventoryItem>(`/inventory-items/${id}`, {
    method: 'DELETE',
    token,
  });
}
