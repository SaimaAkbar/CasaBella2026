import { apiRequest, toQueryString } from './client';
import type {
  ApartmentOwnerSummary,
  Owner,
  OwnerDetailSummary,
  OwnerInput,
  OwnerListResponse,
  OwnerMonthlyStatement,
  OwnerMonthlySummary,
  OwnerOverview,
  OwnerPayment,
  OwnerPaymentInput,
  OwnerStatementTotals,
  OwnerUnitAssignment,
  OwnerUnitAssignmentInput,
  OwnerYearView,
} from '../types/owner';

function normalizeOwnerList(
  payload: OwnerListResponse | Owner[],
): OwnerListResponse {
  if (Array.isArray(payload)) {
    return {
      items: payload,
      totals: {
        totalOwners: payload.length,
        assignedApartments: 0,
        expectedThisMonth: '0',
        outstandingThisMonth: '0',
      },
    };
  }
  return {
    items: payload.items ?? [],
    totals: payload.totals ?? {
      totalOwners: payload.items?.length ?? 0,
      assignedApartments: 0,
      expectedThisMonth: '0',
      outstandingThisMonth: '0',
    },
  };
}

export function fetchOwners(
  token: string,
  query: Record<string, string | number | boolean | undefined> = {},
): Promise<OwnerListResponse> {
  return apiRequest<OwnerListResponse | Owner[]>(
    `/owners${toQueryString(query)}`,
    { token },
  ).then(normalizeOwnerList);
}

export function fetchOwner(
  token: string,
  id: string,
): Promise<Owner> {
  return apiRequest<Owner>(`/owners/${id}`, { token });
}

export function fetchOwnersMonthlySummary(
  token: string,
  query: {
    month: number;
    year: number;
    propertyId?: string;
    search?: string;
  },
): Promise<OwnerMonthlySummary> {
  return apiRequest<OwnerMonthlySummary>(
    `/owners/monthly-summary${toQueryString(query)}`,
    { token },
  );
}

export function fetchOwnerSummary(
  token: string,
  id: string,
): Promise<OwnerDetailSummary> {
  return apiRequest<OwnerDetailSummary>(`/owners/${id}/summary`, { token });
}

export function fetchOwnerYearView(
  token: string,
  id: string,
  year: number,
): Promise<OwnerYearView> {
  return apiRequest<OwnerYearView>(
    `/owners/${id}/year-view${toQueryString({ year })}`,
    { token },
  );
}

export function createOwner(token: string, payload: OwnerInput): Promise<Owner> {
  return apiRequest<Owner>('/owners', { method: 'POST', token, body: payload });
}

export function updateOwner(
  token: string,
  id: string,
  payload: Partial<OwnerInput>,
): Promise<Owner> {
  return apiRequest<Owner>(`/owners/${id}`, {
    method: 'PATCH',
    token,
    body: payload,
  });
}

export function archiveOwner(token: string, id: string): Promise<Owner> {
  return apiRequest<Owner>(`/owners/${id}`, { method: 'DELETE', token });
}

export function fetchOwnerOverview(
  token: string,
  query: Record<string, string | number | undefined> = {},
): Promise<OwnerOverview> {
  return apiRequest<OwnerOverview>(`/owners/overview${toQueryString(query)}`, {
    token,
  });
}

export function fetchApartmentSummary(
  token: string,
  query: Record<string, string | number | undefined> = {},
): Promise<ApartmentOwnerSummary[]> {
  return apiRequest<ApartmentOwnerSummary[]>(
    `/owners/apartment-summary${toQueryString(query)}`,
    { token },
  );
}

export function fetchOwnerAssignments(
  token: string,
  query: Record<string, string | undefined> = {},
): Promise<OwnerUnitAssignment[]> {
  return apiRequest<OwnerUnitAssignment[]>(
    `/owner-unit-assignments${toQueryString(query)}`,
    { token },
  );
}

export function createOwnerAssignment(
  token: string,
  payload: OwnerUnitAssignmentInput,
): Promise<OwnerUnitAssignment> {
  return apiRequest<OwnerUnitAssignment>('/owner-unit-assignments', {
    method: 'POST',
    token,
    body: payload,
  });
}

export function updateOwnerAssignment(
  token: string,
  id: string,
  payload: Record<string, unknown>,
): Promise<OwnerUnitAssignment> {
  return apiRequest<OwnerUnitAssignment>(`/owner-unit-assignments/${id}`, {
    method: 'PATCH',
    token,
    body: payload,
  });
}

export function endOwnerAssignment(
  token: string,
  id: string,
  payload: { reason?: string } = {},
): Promise<OwnerUnitAssignment> {
  return apiRequest<OwnerUnitAssignment>(`/owner-unit-assignments/${id}/end`, {
    method: 'POST',
    token,
    body: payload,
  });
}

export function reviseOwnerAssignment(
  token: string,
  id: string,
  payload: {
    newFixedMonthlyAmount: number;
    newOwnershipPercentage?: number;
    effectiveFrom: string;
    reason: string;
  },
): Promise<{ assignment: OwnerUnitAssignment; revision: unknown }> {
  return apiRequest(`/owner-unit-assignments/${id}/revise`, {
    method: 'POST',
    token,
    body: payload,
  });
}

export function archiveOwnerAssignment(
  token: string,
  id: string,
): Promise<OwnerUnitAssignment> {
  return apiRequest<OwnerUnitAssignment>(`/owner-unit-assignments/${id}`, {
    method: 'DELETE',
    token,
  });
}

export type GenerateOwnerStatementsResult = {
  created: number;
  skipped: number;
  failed: number;
  details?: Array<{
    assignmentId: string;
    ownerId: string;
    unitId: string;
    status: 'CREATED' | 'SKIPPED' | 'FAILED';
    message?: string;
    statementId?: string;
  }>;
};

export function generateOwnerStatements(
  token: string,
  payload: {
    month: number;
    year: number;
    propertyId?: string;
    ownerId?: string;
    unitId?: string;
  },
): Promise<GenerateOwnerStatementsResult> {
  return apiRequest<GenerateOwnerStatementsResult>(
    '/owner-monthly-statements/generate',
    {
      method: 'POST',
      token,
      body: payload,
    },
  );
}

export function fetchOwnerStatements(
  token: string,
  query: Record<string, string | number | undefined> = {},
): Promise<OwnerMonthlyStatement[]> {
  return apiRequest<OwnerMonthlyStatement[]>(
    `/owner-monthly-statements${toQueryString(query)}`,
    { token },
  );
}

export function fetchOwnerStatementTotals(
  token: string,
  query: Record<string, string | number | undefined> = {},
): Promise<OwnerStatementTotals> {
  return apiRequest<OwnerStatementTotals>(
    `/owner-monthly-statements/totals${toQueryString(query)}`,
    { token },
  );
}

export function finalizeOwnerStatement(
  token: string,
  id: string,
): Promise<OwnerMonthlyStatement> {
  return apiRequest<OwnerMonthlyStatement>(
    `/owner-monthly-statements/${id}/finalize`,
    { method: 'POST', token },
  );
}

export function createOwnerPayment(
  token: string,
  payload: OwnerPaymentInput,
): Promise<OwnerPayment> {
  return apiRequest<OwnerPayment>('/owner-payment-transactions', {
    method: 'POST',
    token,
    body: payload,
  });
}

/** Super Admin — posts remaining balance as COMPLETED payment (ledger). */
export function markOwnerStatementPaid(
  token: string,
  payload: {
    ownerMonthlyStatementId: string;
    paymentMethod?: string;
    paymentDate?: string;
  },
): Promise<OwnerPayment> {
  return apiRequest<OwnerPayment>('/owner-payment-transactions/mark-paid', {
    method: 'POST',
    token,
    body: payload,
  });
}

export function fetchOwnerPayments(
  token: string,
  query: Record<string, string | undefined> = {},
): Promise<OwnerPayment[]> {
  return apiRequest<OwnerPayment[]>(
    `/owner-payment-transactions${toQueryString(query)}`,
    { token },
  );
}

export function reverseOwnerPayment(
  token: string,
  id: string,
  reason: string,
): Promise<OwnerPayment> {
  return apiRequest<OwnerPayment>(
    `/owner-payment-transactions/${id}/reverse`,
    { method: 'POST', token, body: { reason } },
  );
}
