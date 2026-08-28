import { apiRequest, toQueryString } from './client';
import type {
  BulkCreateExpensesInput,
  CreateExpenseInput,
  Expense,
  ExpenseMonthlySummary,
  ExpenseQuery,
  ExpenseSummary,
  PropertyMonthView,
  RecordExpensePaymentInput,
  UnitMonthExpenseStatus,
} from '../types/expense';

function queryParams(query: ExpenseQuery) {
  return toQueryString({
    categoryId: query.categoryId || undefined,
    categoryName: query.categoryName || undefined,
    expenseScope: query.expenseScope || undefined,
    propertyId: query.propertyId || undefined,
    unitId: query.unitId || undefined,
    bookingId: query.bookingId || undefined,
    monthlyTenancyId: query.monthlyTenancyId || undefined,
    paymentStatus: query.paymentStatus || undefined,
    paymentMethod: query.paymentMethod || undefined,
    isFinalized:
      query.isFinalized === '' || query.isFinalized === undefined
        ? undefined
        : String(query.isFinalized),
    date: query.date || undefined,
    month:
      query.month === '' || query.month === undefined ? undefined : query.month,
    year:
      query.year === '' || query.year === undefined ? undefined : query.year,
    startDate: query.startDate || undefined,
    endDate: query.endDate || undefined,
    today: query.today ? 'true' : undefined,
    search: query.search || undefined,
  });
}

export function fetchExpenses(
  token: string,
  query: ExpenseQuery = {},
): Promise<Expense[]> {
  return apiRequest<Expense[]>(`/expenses${queryParams(query)}`, { token });
}

export function fetchExpenseSummary(
  token: string,
  query: ExpenseQuery = {},
): Promise<ExpenseSummary> {
  return apiRequest<ExpenseSummary>(
    `/expenses/summary/stats${queryParams(query)}`,
    { token },
  );
}

export function fetchExpenseMonthlySummary(
  token: string,
  query: { month: number; year: number; propertyId?: string },
): Promise<ExpenseMonthlySummary> {
  return apiRequest<ExpenseMonthlySummary>(
    `/expenses/monthly-summary${toQueryString(query)}`,
    { token },
  );
}

export function fetchPropertyMonthView(
  token: string,
  query: {
    propertyId: string;
    month: number;
    year: number;
    search?: string;
    status?: UnitMonthExpenseStatus | '';
  },
): Promise<PropertyMonthView> {
  return apiRequest<PropertyMonthView>(
    `/expenses/property-month-view${toQueryString({
      propertyId: query.propertyId,
      month: query.month,
      year: query.year,
      search: query.search || undefined,
      status: query.status || undefined,
    })}`,
    { token },
  );
}

export function fetchExpense(token: string, id: string): Promise<Expense> {
  return apiRequest<Expense>(`/expenses/${id}`, { token });
}

export function createExpense(
  token: string,
  payload: CreateExpenseInput,
): Promise<Expense> {
  return apiRequest<Expense>('/expenses', {
    method: 'POST',
    token,
    body: payload,
  });
}

export function bulkCreateExpenses(
  token: string,
  payload: BulkCreateExpensesInput,
): Promise<Expense[]> {
  return apiRequest<Expense[]>('/expenses/bulk', {
    method: 'POST',
    token,
    body: payload,
  });
}

export function updateExpense(
  token: string,
  id: string,
  payload: Partial<CreateExpenseInput>,
): Promise<Expense> {
  return apiRequest<Expense>(`/expenses/${id}`, {
    method: 'PATCH',
    token,
    body: payload,
  });
}

export function archiveExpense(token: string, id: string): Promise<Expense> {
  return apiRequest<Expense>(`/expenses/${id}`, {
    method: 'DELETE',
    token,
  });
}

export function finalizeExpense(token: string, id: string): Promise<Expense> {
  return apiRequest<Expense>(`/expenses/${id}/finalize`, {
    method: 'POST',
    token,
  });
}

export function markExpensePaid(token: string, id: string): Promise<Expense> {
  return apiRequest<Expense>(`/expenses/${id}/mark-paid`, {
    method: 'POST',
    token,
  });
}

export function recordExpensePayment(
  token: string,
  id: string,
  payload: RecordExpensePaymentInput,
): Promise<Expense> {
  return apiRequest<Expense>(`/expenses/${id}/record-payment`, {
    method: 'POST',
    token,
    body: payload,
  });
}
