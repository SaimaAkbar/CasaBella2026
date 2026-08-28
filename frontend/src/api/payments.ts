import { apiRequest, toQueryString } from './client';
import type {
  CreatePaymentInput,
  OutstandingBookingSource,
  OutstandingTenancySource,
  Payment,
  PaymentForType,
  PaymentQuery,
  PaymentSummary,
} from '../types/payment';

function queryParams(query: PaymentQuery) {
  return toQueryString({
    paymentForType: query.paymentForType || undefined,
    bookingId: query.bookingId,
    monthlyTenancyId: query.monthlyTenancyId,
    paymentMethod: query.paymentMethod || undefined,
    transactionType: query.transactionType || undefined,
    status: query.status || undefined,
    today: query.today ? 'true' : undefined,
    month: query.month === '' || query.month === undefined ? undefined : query.month,
    year: query.year === '' || query.year === undefined ? undefined : query.year,
    startDate: query.startDate,
    endDate: query.endDate,
    search: query.search,
  });
}

export function fetchPayments(
  token: string,
  query: PaymentQuery = {},
): Promise<Payment[]> {
  return apiRequest<Payment[]>(`/payments${queryParams(query)}`, { token });
}

export function fetchPaymentSummary(
  token: string,
  query: PaymentQuery = {},
): Promise<PaymentSummary> {
  return apiRequest<PaymentSummary>(
    `/payments/summary/stats${queryParams(query)}`,
    { token },
  );
}

export function fetchPayment(token: string, id: string): Promise<Payment> {
  return apiRequest<Payment>(`/payments/${id}`, { token });
}

export function fetchPaymentsByBooking(
  token: string,
  bookingId: string,
): Promise<Payment[]> {
  return apiRequest<Payment[]>(`/payments/by-booking/${bookingId}`, { token });
}

export function fetchPaymentsByTenancy(
  token: string,
  monthlyTenancyId: string,
): Promise<Payment[]> {
  return apiRequest<Payment[]>(
    `/payments/by-tenancy/${monthlyTenancyId}`,
    { token },
  );
}

export function fetchOutstandingSources(
  token: string,
  paymentForType: PaymentForType,
  includeSettled = false,
): Promise<OutstandingBookingSource[] | OutstandingTenancySource[]> {
  return apiRequest(
    `/payments/outstanding-sources${toQueryString({
      paymentForType,
      includeSettled: includeSettled ? 'true' : undefined,
    })}`,
    { token },
  );
}

export function createPayment(
  token: string,
  payload: CreatePaymentInput,
): Promise<Payment> {
  return apiRequest<Payment>('/payments', {
    method: 'POST',
    token,
    body: payload,
  });
}

export function refundPayment(
  token: string,
  id: string,
  payload: { amount: number; reason: string },
): Promise<Payment> {
  return apiRequest<Payment>(`/payments/${id}/refund`, {
    method: 'POST',
    token,
    body: payload,
  });
}

export function reversePayment(
  token: string,
  id: string,
  payload: { reason: string },
): Promise<Payment> {
  return apiRequest<Payment>(`/payments/${id}/reverse`, {
    method: 'POST',
    token,
    body: payload,
  });
}

export function createPaymentAdjustment(
  token: string,
  payload: {
    paymentForType: 'MONTHLY_TENANCY' | 'BOOKING';
    monthlyTenancyId?: string;
    bookingId?: string;
    amount: number;
    adjustmentDirection: 'CREDIT' | 'DEBIT';
    reason: string;
    paymentDate: string;
    paymentMethod?: string;
    notes?: string;
  },
): Promise<Payment> {
  return createAdjustment(token, payload);
}

export function createAdjustment(
  token: string,
  payload: {
    paymentForType: 'BOOKING' | 'MONTHLY_TENANCY';
    bookingId?: string;
    monthlyTenancyId?: string;
    amount: number;
    adjustmentDirection: 'CREDIT' | 'DEBIT';
    reason: string;
    paymentDate: string;
    notes?: string;
  },
): Promise<Payment> {
  return apiRequest<Payment>('/payments/adjustment', {
    method: 'POST',
    token,
    body: payload,
  });
}
