import { apiRequest, toQueryString } from './client';

export type MonthlyAgreementStatus =
  | 'DRAFT'
  | 'ACTIVE'
  | 'ENDED'
  | 'CANCELLED';

export type MonthlyAgreement = {
  id: string;
  tenantId: string;
  agreementNumber: string;
  agreementStart: string;
  agreementEnd: string | null;
  billingDay: number;
  securityDeposit?: string;
  status: MonthlyAgreementStatus;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  endedAt: string | null;
  assignmentCount?: number;
  activeAssignmentCount?: number;
  monthlyRentTotal?: string;
  tenant?: {
    id: string;
    fullName: string;
    phone: string;
    cnic?: string | null;
  };
  currentBill?: {
    id: string;
    billingMonth: number;
    billingYear: number;
    totalPayable: string;
    totalReceived: string;
    remainingBalance: string;
    paymentStatus: string;
    dueDate: string;
  } | null;
  assignments?: Array<{
    id: string;
    unitId: string;
    monthlyRent?: string;
    occupancyState: string;
    hotelUseAllowed: boolean;
    tenancyStatus: string;
    unit?: {
      id: string;
      unitNumber: string;
      unitType?: string;
      floor?: number | null;
      property?: { id: string; name: string };
    };
  }>;
};

export type MonthlyAgreementInput = {
  tenantId: string;
  agreementStart: string;
  agreementEnd?: string;
  billingDay?: number;
  securityDeposit?: number;
  notes?: string;
  activate?: boolean;
};

export function fetchMonthlyAgreements(
  token: string,
  query: {
    tenantId?: string;
    status?: MonthlyAgreementStatus;
    search?: string;
  } = {},
): Promise<MonthlyAgreement[]> {
  return apiRequest<MonthlyAgreement[]>(
    `/monthly-agreements${toQueryString(query)}`,
    { token },
  );
}

export function fetchMonthlyAgreement(
  token: string,
  id: string,
): Promise<MonthlyAgreement> {
  return apiRequest<MonthlyAgreement>(`/monthly-agreements/${id}`, { token });
}

export function createMonthlyAgreement(
  token: string,
  payload: MonthlyAgreementInput,
): Promise<MonthlyAgreement> {
  return apiRequest<MonthlyAgreement>('/monthly-agreements', {
    method: 'POST',
    token,
    body: payload,
  });
}

export function endMonthlyAgreement(
  token: string,
  id: string,
): Promise<MonthlyAgreement> {
  return apiRequest<MonthlyAgreement>(`/monthly-agreements/${id}/end`, {
    method: 'POST',
    token,
  });
}

export type MonthlyAgreementUpdateInput = {
  agreementEnd?: string;
  billingDay?: number;
  securityDeposit?: number;
  notes?: string;
};

export function updateMonthlyAgreement(
  token: string,
  id: string,
  payload: MonthlyAgreementUpdateInput,
): Promise<MonthlyAgreement> {
  return apiRequest<MonthlyAgreement>(`/monthly-agreements/${id}`, {
    method: 'PATCH',
    token,
    body: payload,
  });
}

export type MonthlyAgreementRenewInput = {
  agreementStart: string;
  agreementEnd?: string;
  billingDay?: number;
  securityDeposit?: number;
  notes?: string;
};

export function renewMonthlyAgreement(
  token: string,
  id: string,
  payload: MonthlyAgreementRenewInput,
): Promise<MonthlyAgreement> {
  return apiRequest<MonthlyAgreement>(`/monthly-agreements/${id}/renew`, {
    method: 'POST',
    token,
    body: payload,
  });
}
