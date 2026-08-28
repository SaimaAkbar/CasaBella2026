import { apiRequest, toQueryString } from './client';
import type { AuditLog, AuditLogQuery } from '../types/approval';

function queryParams(query: AuditLogQuery) {
  return toQueryString({
    module: query.module || undefined,
    action: query.action || undefined,
    userId: query.userId || undefined,
    role: query.role || undefined,
    recordId: query.recordId || undefined,
    dateFrom: query.dateFrom || undefined,
    dateTo: query.dateTo || undefined,
    search: query.search || undefined,
  });
}

export function fetchAuditLogs(
  token: string,
  query: AuditLogQuery = {},
): Promise<AuditLog[]> {
  return apiRequest<AuditLog[]>(`/audit-logs${queryParams(query)}`, { token });
}

export function fetchAuditLog(token: string, id: string): Promise<AuditLog> {
  return apiRequest<AuditLog>(`/audit-logs/${id}`, { token });
}
