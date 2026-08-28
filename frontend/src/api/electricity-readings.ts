import { apiRequest, toQueryString } from './client';
import type {
  CreateElectricityReadingInput,
  ElectricityRateHistory,
  ElectricityReading,
  EnterCurrentReadingInput,
  GenerateElectricityMonthInput,
  InitializeElectricityBillInput,
  RecordExpensePaymentInput,
} from '../types/expense';
import type { PaymentMethod } from '../types/payment';

export function fetchElectricityRate(
  token: string,
): Promise<{ ratePerUnit: string }> {
  return apiRequest<{ ratePerUnit: string }>(
    '/electricity-readings/settings/rate',
    { token },
  );
}

export function fetchElectricityRateHistory(
  token: string,
): Promise<ElectricityRateHistory[]> {
  return apiRequest<ElectricityRateHistory[]>(
    '/electricity-readings/settings/rate-history',
    { token },
  );
}

export function updateElectricityRate(
  token: string,
  ratePerUnit: number,
  reason?: string,
): Promise<{ ratePerUnit: string }> {
  return apiRequest<{ ratePerUnit: string }>(
    '/electricity-readings/settings/rate',
    {
      method: 'PATCH',
      token,
      body: { ratePerUnit, reason },
    },
  );
}

export function initializeElectricityBill(
  token: string,
  payload: InitializeElectricityBillInput,
): Promise<ElectricityReading> {
  return apiRequest<ElectricityReading>('/electricity-readings/initialize', {
    method: 'POST',
    token,
    body: payload,
  });
}

export function generateElectricityMonth(
  token: string,
  payload: GenerateElectricityMonthInput,
): Promise<{
  created: ElectricityReading[];
  skipped: Array<{ unitId: string; unitNumber: string; reason: string }>;
}> {
  return apiRequest('/electricity-readings/generate-month', {
    method: 'POST',
    token,
    body: payload,
  });
}

export function fetchElectricityReadings(
  token: string,
  query: {
    propertyId?: string;
    unitId?: string;
    billingMonth?: number;
    billingYear?: number;
  } = {},
): Promise<ElectricityReading[]> {
  return apiRequest<ElectricityReading[]>(
    `/electricity-readings${toQueryString(query)}`,
    { token },
  );
}

export function createElectricityReading(
  token: string,
  payload: CreateElectricityReadingInput,
): Promise<ElectricityReading> {
  return apiRequest<ElectricityReading>('/electricity-readings', {
    method: 'POST',
    token,
    body: {
      propertyId: payload.propertyId,
      unitId: payload.unitId,
      previousUnits: payload.previousUnits ?? payload.previousReading,
      currentUnits: payload.currentUnits ?? payload.currentReading,
      ratePerUnit: payload.ratePerUnit,
      billingMonth: payload.billingMonth,
      billingYear: payload.billingYear,
      readingDate:
        payload.readingDate ?? new Date().toISOString().slice(0, 10),
      notes: payload.notes,
      overrideReason: payload.overrideReason,
    },
  });
}

export function enterElectricityCurrentReading(
  token: string,
  id: string,
  payload: EnterCurrentReadingInput | {
    currentReading: number;
    readingDate?: string;
    dueDate?: string;
    notes?: string;
  },
): Promise<ElectricityReading> {
  return apiRequest<ElectricityReading>(
    `/electricity-readings/${id}/enter-current`,
    {
      method: 'POST',
      token,
      body: payload,
    },
  );
}

export function archiveElectricityReading(
  token: string,
  id: string,
): Promise<{ id: string; archived: boolean }> {
  return apiRequest(`/electricity-readings/${id}`, {
    method: 'DELETE',
    token,
  });
}

export function recordElectricityPayment(
  token: string,
  id: string,
  payload: {
    amountPaid: number;
    paymentDate: string;
    paymentMethod: PaymentMethod | string;
    bankName?: string;
    transactionReference?: string;
    notes?: string;
  } | RecordExpensePaymentInput,
): Promise<ElectricityReading> {
  return apiRequest<ElectricityReading>(
    `/electricity-readings/${id}/record-payment`,
    {
      method: 'POST',
      token,
      body: {
        amountPaid: payload.amountPaid,
        paymentDate: payload.paymentDate,
        paymentMethod: payload.paymentMethod,
        bankName: payload.bankName,
        transactionReference: payload.transactionReference,
        notes: payload.notes,
      },
    },
  );
}
