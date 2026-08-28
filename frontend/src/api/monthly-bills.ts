import { apiRequest, toQueryString } from './client';

export type MonthlyBill = {
  id: string;
  agreementId: string;
  billingMonth: number;
  billingYear: number;
  baseRent?: string;
  electricityCharges?: string;
  credits?: string;
  totalPayable: string;
  totalReceived: string;
  remainingBalance: string;
  paymentStatus: string;
  dueDate: string;
  agreement?: {
    tenant: { fullName: string };
  };
};

export function fetchMonthlyBills(
  token: string,
  query: {
    agreementId?: string;
    billingMonth?: number;
    billingYear?: number;
  } = {},
): Promise<MonthlyBill[]> {
  return apiRequest<MonthlyBill[]>(
    `/monthly-bills${toQueryString(query)}`,
    { token },
  );
}

export function generateMonthlyBill(
  token: string,
  payload: {
    agreementId: string;
    billingMonth: number;
    billingYear: number;
  },
): Promise<MonthlyBill> {
  return apiRequest<MonthlyBill>('/monthly-bills/generate', {
    method: 'POST',
    token,
    body: payload,
  });
}
