import { apiRequest, toQueryString } from './client';
import type {
  ApprovalQuery,
  ApprovalRequest,
} from '../types/approval';

function queryParams(query: ApprovalQuery) {
  return toQueryString({
    status: query.status || undefined,
    moduleName: query.moduleName || undefined,
    requestedById: query.requestedById || undefined,
    priority: query.priority || undefined,
    dateFrom: query.dateFrom || undefined,
    dateTo: query.dateTo || undefined,
    search: query.search || undefined,
  });
}

export function fetchApprovalRequests(
  token: string,
  query: ApprovalQuery = {},
): Promise<ApprovalRequest[]> {
  return apiRequest<ApprovalRequest[]>(
    `/approval-requests${queryParams(query)}`,
    { token },
  );
}

export function fetchApprovalRequest(
  token: string,
  id: string,
): Promise<ApprovalRequest> {
  return apiRequest<ApprovalRequest>(`/approval-requests/${id}`, { token });
}

export function approveApprovalRequest(
  token: string,
  id: string,
): Promise<ApprovalRequest> {
  return apiRequest<ApprovalRequest>(`/approval-requests/${id}/approve`, {
    method: 'POST',
    token,
  });
}

export function rejectApprovalRequest(
  token: string,
  id: string,
  rejectionReason: string,
): Promise<ApprovalRequest> {
  return apiRequest<ApprovalRequest>(`/approval-requests/${id}/reject`, {
    method: 'POST',
    token,
    body: { rejectionReason },
  });
}
