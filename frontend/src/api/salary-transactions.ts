import { apiRequest, toQueryString } from './client';
import type {
  CreateSalaryTransactionInput,
  SalaryTransaction,
  SalaryTransactionType,
} from '../types/employee';

export function fetchSalaryTransactions(
  token: string,
  query: {
    employeeId?: string;
    salaryRecordId?: string;
    transactionType?: SalaryTransactionType | '';
    month?: number | '';
    year?: number | '';
    search?: string;
  } = {},
): Promise<SalaryTransaction[]> {
  return apiRequest<SalaryTransaction[]>(
    `/salary-transactions${toQueryString({
      employeeId: query.employeeId || undefined,
      salaryRecordId: query.salaryRecordId || undefined,
      transactionType: query.transactionType || undefined,
      month:
        query.month === '' || query.month === undefined
          ? undefined
          : query.month,
      year:
        query.year === '' || query.year === undefined ? undefined : query.year,
      search: query.search || undefined,
    })}`,
    { token },
  );
}

export function createSalaryTransaction(
  token: string,
  payload: CreateSalaryTransactionInput,
): Promise<SalaryTransaction> {
  return apiRequest<SalaryTransaction>('/salary-transactions', {
    method: 'POST',
    token,
    body: payload,
  });
}

export function reverseSalaryTransaction(
  token: string,
  id: string,
  reason: string,
): Promise<SalaryTransaction> {
  return apiRequest<SalaryTransaction>(`/salary-transactions/${id}/reverse`, {
    method: 'POST',
    token,
    body: { reason },
  });
}
