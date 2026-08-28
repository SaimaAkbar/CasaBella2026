import { apiRequest, toQueryString } from './client';
import type { PaymentMethod, SalaryPaymentStatus, SalaryRecord } from '../types/employee';

export type SalaryRecordQuery = {
  employeeId?: string;
  salaryMonth?: number | '';
  salaryYear?: number | '';
  paymentStatus?: SalaryPaymentStatus | '';
  finalized?: boolean | '';
  department?: string;
  search?: string;
};

function queryParams(query: SalaryRecordQuery) {
  return toQueryString({
    employeeId: query.employeeId || undefined,
    salaryMonth:
      query.salaryMonth === '' || query.salaryMonth === undefined
        ? undefined
        : query.salaryMonth,
    salaryYear:
      query.salaryYear === '' || query.salaryYear === undefined
        ? undefined
        : query.salaryYear,
    paymentStatus: query.paymentStatus || undefined,
    finalized:
      query.finalized === '' || query.finalized === undefined
        ? undefined
        : String(query.finalized),
    department: query.department || undefined,
    search: query.search || undefined,
  });
}

export function fetchSalaryRecords(
  token: string,
  query: SalaryRecordQuery = {},
): Promise<SalaryRecord[]> {
  return apiRequest<SalaryRecord[]>(`/salary-records${queryParams(query)}`, {
    token,
  });
}

export function fetchSalaryRecord(
  token: string,
  id: string,
): Promise<SalaryRecord> {
  return apiRequest<SalaryRecord>(`/salary-records/${id}`, { token });
}

export function generateMonthlySalaries(
  token: string,
  payload: {
    month: number;
    year: number;
    employeeId?: string;
    department?: string;
  },
): Promise<{
  created: number;
  skipped: number;
  failed: number;
  details: Array<{
    employeeId: string;
    employeeCode: string;
    fullName: string;
    status: string;
    message?: string;
  }>;
}> {
  return apiRequest('/salary-records/generate-monthly', {
    method: 'POST',
    token,
    body: payload,
  });
}

export function finalizeSalaryRecord(
  token: string,
  id: string,
): Promise<SalaryRecord> {
  return apiRequest<SalaryRecord>(`/salary-records/${id}/finalize`, {
    method: 'POST',
    token,
  });
}

export function approveSalaryRecord(
  token: string,
  id: string,
): Promise<SalaryRecord> {
  return apiRequest<SalaryRecord>(`/salary-records/${id}/approve`, {
    method: 'POST',
    token,
  });
}

export function markSalaryRecordPaid(
  token: string,
  id: string,
  paymentMethod?: PaymentMethod,
): Promise<SalaryRecord> {
  return apiRequest<SalaryRecord>(`/salary-records/${id}/mark-paid`, {
    method: 'POST',
    token,
    body: { paymentMethod },
  });
}
