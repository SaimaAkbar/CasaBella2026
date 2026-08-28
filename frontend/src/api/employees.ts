import { apiRequest, toQueryString } from './client';
import type {
  Employee,
  EmployeeInput,
  EmployeeQuery,
  EmployeeSummary,
  YearlyMonthStatus,
} from '../types/employee';

function queryParams(query: EmployeeQuery) {
  return toQueryString({
    status: query.status || undefined,
    department: query.department || undefined,
    position: query.position || undefined,
    isActive:
      query.isActive === '' || query.isActive === undefined
        ? undefined
        : String(query.isActive),
    search: query.search || undefined,
  });
}

export function fetchEmployees(
  token: string,
  query: EmployeeQuery = {},
): Promise<Employee[]> {
  return apiRequest<Employee[]>(`/employees${queryParams(query)}`, { token });
}

export function fetchEmployeeSummary(
  token: string,
  query: { month?: number; year?: number } = {},
): Promise<EmployeeSummary> {
  return apiRequest<EmployeeSummary>(
    `/employees/salary-summary${toQueryString({
      month: query.month,
      year: query.year,
    })}`,
    { token },
  );
}

export function fetchEmployee(token: string, id: string): Promise<Employee> {
  return apiRequest<Employee>(`/employees/${id}`, { token });
}

export function fetchEmployeeYearlyStatus(
  token: string,
  id: string,
  year: number,
): Promise<YearlyMonthStatus[]> {
  return apiRequest<YearlyMonthStatus[]>(
    `/employees/${id}/yearly-status${toQueryString({ year })}`,
    { token },
  );
}

export function createEmployee(
  token: string,
  payload: EmployeeInput,
): Promise<Employee> {
  return apiRequest<Employee>('/employees', {
    method: 'POST',
    token,
    body: payload,
  });
}

export function updateEmployee(
  token: string,
  id: string,
  payload: Partial<EmployeeInput>,
): Promise<Employee> {
  return apiRequest<Employee>(`/employees/${id}`, {
    method: 'PATCH',
    token,
    body: payload,
  });
}

export function archiveEmployee(token: string, id: string): Promise<Employee> {
  return apiRequest<Employee>(`/employees/${id}`, {
    method: 'DELETE',
    token,
  });
}
