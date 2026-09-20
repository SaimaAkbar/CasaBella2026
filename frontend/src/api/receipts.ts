import { apiRequest } from './client';
import type { PrinterConfig, ReceiptPrintTarget, ThermalReceipt } from '../types/receipt';

export function fetchPrinterConfig(token: string): Promise<PrinterConfig> {
  return apiRequest<PrinterConfig>('/receipts/config', { token });
}

export function fetchInstalledPrinters(token: string): Promise<{
  printers: string[];
  resolvedPrinterName: string;
}> {
  return apiRequest<{ printers: string[]; resolvedPrinterName: string }>(
    '/receipts/printers',
    { token },
  );
}

export function testReceiptPrint(
  token: string,
  payload?: { printerName?: string },
): Promise<{ printerName: string }> {
  return apiRequest<{ printerName: string }>('/receipts/test-print', {
    method: 'POST',
    token,
    body: payload ?? {},
  });
}

export function fetchPaymentReceipt(
  token: string,
  paymentId: string,
  billingMonth?: string,
): Promise<ThermalReceipt> {
  const query = billingMonth
    ? `?billingMonth=${encodeURIComponent(billingMonth)}`
    : '';
  return apiRequest<ThermalReceipt>(`/receipts/payments/${paymentId}${query}`, {
    token,
  });
}

export function logPaymentReceiptPrint(
  token: string,
  paymentId: string,
  payload: { printerName?: string },
  billingMonth?: string,
): Promise<ThermalReceipt> {
  const query = billingMonth
    ? `?billingMonth=${encodeURIComponent(billingMonth)}`
    : '';
  return apiRequest<ThermalReceipt>(
    `/receipts/payments/${paymentId}/print${query}`,
    { method: 'POST', token, body: payload },
  );
}

export function fetchExpensePaymentReceipt(
  token: string,
  expensePaymentId: string,
): Promise<ThermalReceipt> {
  return apiRequest<ThermalReceipt>(
    `/receipts/expense-payments/${expensePaymentId}`,
    { token },
  );
}

export function logExpensePaymentReceiptPrint(
  token: string,
  expensePaymentId: string,
  payload: { printerName?: string },
): Promise<ThermalReceipt> {
  return apiRequest<ThermalReceipt>(
    `/receipts/expense-payments/${expensePaymentId}/print`,
    { method: 'POST', token, body: payload },
  );
}

export function fetchOwnerPaymentReceipt(
  token: string,
  paymentId: string,
): Promise<ThermalReceipt> {
  return apiRequest<ThermalReceipt>(`/receipts/owner-payments/${paymentId}`, {
    token,
  });
}

export function logOwnerPaymentReceiptPrint(
  token: string,
  paymentId: string,
  payload: { printerName?: string },
): Promise<ThermalReceipt> {
  return apiRequest<ThermalReceipt>(
    `/receipts/owner-payments/${paymentId}/print`,
    { method: 'POST', token, body: payload },
  );
}

export function printBookingBill(
  token: string,
  bookingId: string,
  payload?: { printerName?: string },
): Promise<ThermalReceipt> {
  return apiRequest<ThermalReceipt>(`/receipts/bookings/${bookingId}/print`, {
    method: 'POST',
    token,
    body: payload ?? {},
  });
}

export function fetchBookingBill(
  token: string,
  bookingId: string,
): Promise<ThermalReceipt> {
  return apiRequest<ThermalReceipt>(`/receipts/bookings/${bookingId}`, {
    token,
  });
}

export function printTenancyBill(
  token: string,
  monthlyTenancyId: string,
  payload?: { printerName?: string },
): Promise<ThermalReceipt> {
  return apiRequest<ThermalReceipt>(
    `/receipts/tenancies/${monthlyTenancyId}/print`,
    { method: 'POST', token, body: payload ?? {} },
  );
}

export function fetchTenancyBill(
  token: string,
  monthlyTenancyId: string,
): Promise<ThermalReceipt> {
  return apiRequest<ThermalReceipt>(
    `/receipts/tenancies/${monthlyTenancyId}`,
    { token },
  );
}

export async function fetchReceiptForPrint(
  token: string,
  target: ReceiptPrintTarget,
): Promise<ThermalReceipt> {
  if (target.sourceType === 'payment') {
    return fetchPaymentReceipt(token, target.sourceId, target.billingMonth);
  }
  if (target.sourceType === 'expense_payment') {
    return fetchExpensePaymentReceipt(token, target.sourceId);
  }
  if (target.sourceType === 'booking_bill') {
    return fetchBookingBill(token, target.sourceId);
  }
  if (target.sourceType === 'tenancy_bill') {
    return fetchTenancyBill(token, target.sourceId);
  }
  return fetchOwnerPaymentReceipt(token, target.sourceId);
}

export async function logReceiptPrint(
  token: string,
  target: ReceiptPrintTarget,
  printerName?: string,
): Promise<ThermalReceipt> {
  const payload = { printerName };
  if (target.sourceType === 'payment') {
    return logPaymentReceiptPrint(
      token,
      target.sourceId,
      payload,
      target.billingMonth,
    );
  }
  if (target.sourceType === 'expense_payment') {
    return logExpensePaymentReceiptPrint(token, target.sourceId, payload);
  }
  if (target.sourceType === 'booking_bill') {
    return printBookingBill(token, target.sourceId, payload);
  }
  if (target.sourceType === 'tenancy_bill') {
    return printTenancyBill(token, target.sourceId, payload);
  }
  return logOwnerPaymentReceiptPrint(token, target.sourceId, payload);
}
