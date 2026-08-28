import { apiRequest } from './client';
import type { ExpenseCategory } from '../types/expense';

export function fetchExpenseCategories(
  token: string,
  includeInactive = false,
): Promise<ExpenseCategory[]> {
  const qs = includeInactive ? '?includeInactive=true' : '';
  return apiRequest<ExpenseCategory[]>(`/expense-categories${qs}`, { token });
}

export function createExpenseCategory(
  token: string,
  payload: { name: string; description?: string },
): Promise<ExpenseCategory> {
  return apiRequest<ExpenseCategory>('/expense-categories', {
    method: 'POST',
    token,
    body: payload,
  });
}

export function updateExpenseCategory(
  token: string,
  id: string,
  payload: { name?: string; description?: string },
): Promise<ExpenseCategory> {
  return apiRequest<ExpenseCategory>(`/expense-categories/${id}`, {
    method: 'PATCH',
    token,
    body: payload,
  });
}

export function archiveExpenseCategory(
  token: string,
  id: string,
): Promise<ExpenseCategory> {
  return apiRequest<ExpenseCategory>(`/expense-categories/${id}`, {
    method: 'DELETE',
    token,
  });
}
