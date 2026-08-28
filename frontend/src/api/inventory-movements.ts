import { apiRequest, toQueryString } from './client';
import type {
  AdjustMovementInput,
  DamageOrLossMovementInput,
  InventoryMovement,
  InventoryMovementQuery,
  IssueMovementInput,
  PurchaseMovementInput,
  ReturnMovementInput,
  TransferMovementInput,
} from '../types/inventory';

function queryParams(query: InventoryMovementQuery) {
  return toQueryString({
    itemId: query.itemId || undefined,
    movementType: query.movementType || undefined,
    propertyId: query.propertyId || undefined,
    unitId: query.unitId || undefined,
    bookingId: query.bookingId || undefined,
    monthlyTenancyId: query.monthlyTenancyId || undefined,
    employeeId: query.employeeId || undefined,
    date: query.date || undefined,
    month:
      query.month === '' || query.month === undefined
        ? undefined
        : query.month,
    year:
      query.year === '' || query.year === undefined ? undefined : query.year,
    startDate: query.startDate || undefined,
    endDate: query.endDate || undefined,
    search: query.search || undefined,
  });
}

export function fetchInventoryMovements(
  token: string,
  query: InventoryMovementQuery = {},
): Promise<InventoryMovement[]> {
  return apiRequest<InventoryMovement[]>(
    `/inventory-movements${queryParams(query)}`,
    { token },
  );
}

export function fetchInventoryMovement(
  token: string,
  id: string,
): Promise<InventoryMovement> {
  return apiRequest<InventoryMovement>(`/inventory-movements/${id}`, {
    token,
  });
}

export function purchaseStock(
  token: string,
  payload: PurchaseMovementInput,
): Promise<InventoryMovement> {
  return apiRequest<InventoryMovement>('/inventory-movements/purchase', {
    method: 'POST',
    token,
    body: payload,
  });
}

export function issueStock(
  token: string,
  payload: IssueMovementInput,
): Promise<InventoryMovement> {
  return apiRequest<InventoryMovement>('/inventory-movements/issue', {
    method: 'POST',
    token,
    body: payload,
  });
}

export function returnStock(
  token: string,
  payload: ReturnMovementInput,
): Promise<InventoryMovement> {
  return apiRequest<InventoryMovement>('/inventory-movements/return', {
    method: 'POST',
    token,
    body: payload,
  });
}

export function transferStock(
  token: string,
  payload: TransferMovementInput,
): Promise<InventoryMovement> {
  return apiRequest<InventoryMovement>('/inventory-movements/transfer', {
    method: 'POST',
    token,
    body: payload,
  });
}

export function adjustStock(
  token: string,
  payload: AdjustMovementInput,
): Promise<InventoryMovement> {
  return apiRequest<InventoryMovement>('/inventory-movements/adjust', {
    method: 'POST',
    token,
    body: payload,
  });
}

export function damageStock(
  token: string,
  payload: DamageOrLossMovementInput,
): Promise<InventoryMovement> {
  return apiRequest<InventoryMovement>('/inventory-movements/damage', {
    method: 'POST',
    token,
    body: payload,
  });
}

export function lossStock(
  token: string,
  payload: DamageOrLossMovementInput,
): Promise<InventoryMovement> {
  return apiRequest<InventoryMovement>('/inventory-movements/loss', {
    method: 'POST',
    token,
    body: payload,
  });
}
