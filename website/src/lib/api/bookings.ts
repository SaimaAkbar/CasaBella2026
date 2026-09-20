import type {
  BookingConfirmation,
  BookingQuote,
  BookingStatusResponse,
  GuestDetails,
  OnlinePaymentSelection,
  PublicUnit,
  StaySelection,
} from '../../types';
import {
  buildMockQuote,
  createBookingReference,
  mockIsAvailable,
  validateStayDates,
} from '../booking';
import { apiFetch, isMockMode } from './client';
import { getRoomById } from '../../data/rooms';
import { getResidenceById } from '../../data/residences';

function toIsoDateTime(date: string, endOfDay = false) {
  if (!date) return date;
  if (date.includes('T')) return date;
  return endOfDay ? `${date}T12:00:00.000Z` : `${date}T14:00:00.000Z`;
}

export async function fetchPublicUnits(
  unitType?: 'ROOM' | 'APARTMENT',
): Promise<PublicUnit[]> {
  if (isMockMode()) return [];
  const q = unitType ? `?unitType=${unitType}` : '';
  return apiFetch<PublicUnit[]>(`/public/units${q}`);
}

export async function fetchPublicUnit(id: string): Promise<PublicUnit | null> {
  if (isMockMode()) return null;
  try {
    return await apiFetch<PublicUnit>(`/public/units/${id}`);
  } catch {
    return null;
  }
}

export async function fetchOccupiedDates(
  unitId: string,
  from: string,
  to: string,
): Promise<{
  unitId: string;
  from: string;
  to: string;
  bookedDates: string[];
  ranges: Array<{ checkIn: string; checkOut: string; status: string }>;
}> {
  if (isMockMode()) {
    return { unitId, from, to, bookedDates: [], ranges: [] };
  }
  const q = new URLSearchParams({ from, to });
  return apiFetch(
    `/public/units/${encodeURIComponent(unitId)}/occupied-dates?${q.toString()}`,
  );
}

export async function checkAvailability(
  stay: StaySelection,
): Promise<BookingQuote> {
  const dateError = validateStayDates(stay.checkIn, stay.checkOut);
  if (dateError) {
    return {
      nights: 0,
      pricePerNight: null,
      subtotal: null,
      taxes: null,
      total: null,
      currency: 'PKR',
      available: false,
      message: dateError,
    };
  }

  if (!isMockMode()) {
    const availability = await apiFetch<{ available: boolean; message?: string }>(
      '/public/availability',
      {
        method: 'POST',
        body: JSON.stringify({
          unitId: stay.propertyId,
          checkInDateTime: toIsoDateTime(stay.checkIn, false),
          checkOutDateTime: toIsoDateTime(stay.checkOut, true),
        }),
      },
    );

    if (!availability.available) {
      return {
        nights: 0,
        pricePerNight: null,
        subtotal: null,
        taxes: null,
        total: null,
        currency: 'PKR',
        available: false,
        message: availability.message || 'NOT AVAILABLE FOR SELECTED DATES',
      };
    }

    return apiFetch<BookingQuote>('/public/online-bookings/quote', {
      method: 'POST',
      body: JSON.stringify({
        unitId: stay.propertyId,
        checkInDateTime: toIsoDateTime(stay.checkIn, false),
        checkOutDateTime: toIsoDateTime(stay.checkOut, true),
        adults: stay.adults,
        children: stay.children,
      }),
    }).then((q) => {
      const total = Number((q as { total?: number | string }).total ?? 0);
      const roomCharges = Number(
        (q as { roomCharges?: number | string }).roomCharges ?? total,
      );
      const taxes = Number((q as { taxes?: number | string }).taxes ?? 0);
      const nights = Number((q as { nights?: number }).nights ?? 0);
      const pricePerNight = Number(
        (q as { pricePerNight?: number | string; dailyRate?: number | string })
          .pricePerNight ??
          (q as { dailyRate?: number | string }).dailyRate ??
          0,
      );
      return {
        nights,
        pricePerNight,
        roomCharges,
        subtotal: roomCharges,
        taxes,
        additionalCharges: 0,
        discount: 0,
        total,
        currency: 'PKR' as const,
        available: true,
      };
    });
  }

  const property =
    stay.propertyType === 'room'
      ? getRoomById(stay.propertyId)
      : getResidenceById(stay.propertyId);

  const available = property
    ? mockIsAvailable(stay.checkIn, stay.checkOut, property.id) &&
      property.availableByDefault !== false
    : false;

  const price = property?.startingPrice.amount ?? null;
  return buildMockQuote(stay, price, available);
}

export async function submitBooking(input: {
  stay: StaySelection;
  guest: GuestDetails;
  quote: BookingQuote;
  paymentSelection: OnlinePaymentSelection;
}): Promise<BookingConfirmation> {
  if (!isMockMode()) {
    const result = await apiFetch<{
      bookingId: string;
      bookingNumber: string;
      checkoutUrl: string;
      expiresAt: string;
      paymentSelection: OnlinePaymentSelection;
      paymentTypeLabel: string;
      quote: BookingQuote & {
        payNowAmount?: string | number;
        remainingAfterPayment?: string | number;
        dailyRate?: string | number;
      };
    }>('/public/online-bookings/checkout', {
      method: 'POST',
      body: JSON.stringify({
        unitId: input.stay.propertyId,
        propertyId: input.stay.posPropertyId,
        checkInDateTime: toIsoDateTime(input.stay.checkIn, false),
        checkOutDateTime: toIsoDateTime(input.stay.checkOut, true),
        adults: input.stay.adults,
        children: input.stay.children,
        numberOfGuests: input.stay.adults + input.stay.children,
        notes: input.guest.notes || undefined,
        paymentSelection: input.paymentSelection,
        guest: {
          fullName: input.guest.fullName,
          phone: input.guest.phone,
          alternatePhone: input.guest.alternatePhone || undefined,
          email: input.guest.email || undefined,
          cnicOrPassport: input.guest.cnicOrPassport || undefined,
          address: input.guest.address || undefined,
          nationality: input.guest.nationality || undefined,
          emergencyContactName: input.guest.emergencyContactName || undefined,
          emergencyContactPhone: input.guest.emergencyContactPhone || undefined,
          vehicleNumber: input.guest.vehicleNumber || undefined,
          notes: input.guest.notes || undefined,
        },
        idempotencyKey:
          typeof crypto !== 'undefined' && 'randomUUID' in crypto
            ? crypto.randomUUID()
            : `web-${Date.now()}`,
      }),
    });

    const payNowAmount = Number(result.quote?.payNowAmount ?? 0);
    const remainingAfterPayment = Number(
      result.quote?.remainingAfterPayment ?? 0,
    );

    return {
      reference: result.bookingNumber,
      bookingId: result.bookingId,
      checkoutUrl: result.checkoutUrl,
      paymentStatus: 'PENDING',
      bookingStatus: 'PENDING',
      paymentSelection: result.paymentSelection || input.paymentSelection,
      paymentTypeLabel: result.paymentTypeLabel,
      payNowAmount,
      remainingAfterPayment,
      stay: input.stay,
      guest: input.guest,
      quote: {
        ...(result.quote || input.quote),
        total: Number(result.quote?.total ?? input.quote.total ?? 0),
        payNowAmount,
        remainingAfterPayment,
        paymentSelection: result.paymentSelection || input.paymentSelection,
        available: true,
        currency: 'PKR',
        nights: Number(result.quote?.nights ?? input.quote.nights ?? 0),
        pricePerNight: Number(
          result.quote?.dailyRate ?? input.quote.pricePerNight ?? 0,
        ),
        subtotal: Number(result.quote?.roomCharges ?? input.quote.subtotal ?? 0),
        taxes: Number(result.quote?.taxes ?? input.quote.taxes ?? 0),
      },
      createdAt: new Date().toISOString(),
      expiresAt: result.expiresAt,
    };
  }

  if (!input.quote.available) {
    throw new Error(input.quote.message || 'Selected stay is unavailable.');
  }

  const total = Number(input.quote.total ?? 0);
  const payNowAmount =
    input.paymentSelection === 'ADVANCE_50'
      ? Math.round(total * 50) / 100
      : total;

  return {
    reference: createBookingReference(),
    stay: input.stay,
    guest: input.guest,
    quote: {
      ...input.quote,
      payNowAmount,
      remainingAfterPayment: total - payNowAmount,
      paymentSelection: input.paymentSelection,
    },
    createdAt: new Date().toISOString(),
    paymentStatus: 'UNPAID',
    bookingStatus: 'PENDING',
    paymentSelection: input.paymentSelection,
    paymentTypeLabel:
      input.paymentSelection === 'ADVANCE_50' ? '50% Advance' : 'Full Payment',
    payNowAmount,
    remainingAfterPayment: total - payNowAmount,
  };
}

export type BankTransferPaymentPage = {
  bookingNumber: string;
  bookingStatus: string;
  paymentStatus: string;
  paymentStatusLabel: string;
  alreadySubmitted: boolean;
  guestName: string;
  unitLabel: string;
  checkInDateTime: string;
  checkOutDateTime: string;
  numberOfGuests: number;
  nights: number;
  quote: {
    nights: number;
    dailyRate: string | number;
    roomCharges: string | number;
    taxes: string | number;
    total: string | number;
    currency: string;
  };
  paymentSelection: OnlinePaymentSelection;
  paymentTypeLabel: string;
  expectedAmount: string | number;
  bookingTotalAmount: string | number;
  remainingAfterPayment: string | number;
  currency: string;
  bank: {
    accountName: string;
    iban: string;
    branch: string;
    instructions: string;
  };
  submitted: {
    transactionReference: string | null;
    submittedAmount: string | number | null;
    transferDate: string | null;
    senderName: string | null;
    senderBank: string | null;
    rejectionReason: string | null;
  } | null;
};

export type BankTransferSubmitResult = {
  ok: boolean;
  bookingNumber: string;
  bookingStatus: string;
  paymentStatus: string;
  paymentTypeLabel: string;
  submittedAmount: string | number;
  expectedAmount: string | number;
  remainingAfterPayment: string | number;
  message: string;
};

export async function fetchBankTransferPaymentPage(
  bookingNumber: string,
): Promise<BankTransferPaymentPage> {
  return apiFetch<BankTransferPaymentPage>(
    `/public/online-bookings/${encodeURIComponent(bookingNumber)}/payment`,
  );
}

export async function submitBankTransferPayment(input: {
  bookingNumber: string;
  paymentSelection: OnlinePaymentSelection;
  submittedAmount: number;
  transferDate: string;
  transactionReference: string;
  senderName: string;
  senderBank: string;
  receipt?: File | null;
}): Promise<BankTransferSubmitResult> {
  const form = new FormData();
  form.append('bookingNumber', input.bookingNumber);
  form.append('paymentSelection', input.paymentSelection);
  form.append('submittedAmount', String(input.submittedAmount));
  form.append('transferDate', input.transferDate);
  form.append('transactionReference', input.transactionReference);
  form.append('senderName', input.senderName);
  form.append('senderBank', input.senderBank);
  if (input.receipt) form.append('receipt', input.receipt);

  return apiFetch<BankTransferSubmitResult>(
    '/public/online-bookings/submit-bank-transfer',
    { method: 'POST', body: form },
  );
}

export async function fetchBookingStatus(
  bookingNumber: string,
): Promise<BookingStatusResponse> {
  if (isMockMode()) {
    return {
      bookingNumber,
      bookingStatus: 'PENDING',
      paymentStatus: 'UNPAID',
      paymentState: 'UNPAID',
      paymentLabel: 'Pending Payment',
      totalAmount: 0,
      receivedAmount: 0,
      remainingAmount: 0,
      unitLabel: 'Mock unit',
      checkInDateTime: new Date().toISOString(),
      checkOutDateTime: new Date().toISOString(),
      guestName: 'Guest',
      message: 'Mock catalogue mode — payment cannot be verified.',
    };
  }

  const raw = await apiFetch<{
    bookingNumber: string;
    bookingStatus: string;
    paymentState: string;
    paymentLabel?: string;
    totalAmount: string | number;
    receivedAmount?: string | number;
    remainingAmount?: string | number;
    checkInDateTime: string;
    checkOutDateTime: string;
    guest?: { fullName?: string };
    unit?: {
      displayName?: string | null;
      unitNumber?: string;
      property?: { name?: string };
    };
    onlinePayment?: {
      status?: string;
      paymentSelection?: OnlinePaymentSelection;
      paymentTypeLabel?: string;
      amount?: string | number;
      checkoutUrl?: string | null;
      gateway?: string;
      paymentReference?: string | null;
      rejectionReason?: string | null;
    } | null;
    paymentHoldExpiresAt?: string | null;
  }>(`/public/online-bookings/${encodeURIComponent(bookingNumber)}/status`);

  const paymentStatus = raw.onlinePayment?.status || 'PENDING';
  const unitLabel =
    raw.unit?.displayName ||
    [raw.unit?.unitNumber, raw.unit?.property?.name].filter(Boolean).join(' · ') ||
    '—';

  let message: string | undefined;
  if (paymentStatus === 'AUTHORIZED') {
    message =
      'Payment details received. Your reservation will be confirmed once our team verifies the payment against our bank records.';
  } else if (paymentStatus === 'PENDING') {
    message =
      'Your reservation is not confirmed yet. Complete bank transfer and submit payment details to continue.';
  } else if (paymentStatus === 'FAILED') {
    message =
      'We were unable to verify the payment associated with your reservation at this time.';
  } else if (
    paymentStatus === 'EXPIRED' ||
    paymentStatus === 'CANCELLED'
  ) {
    message = 'This booking hold has expired or been cancelled.';
  } else if (
    paymentStatus === 'PAID' &&
    raw.bookingStatus === 'CONFIRMED'
  ) {
    message =
      'Your payment has been successfully verified and your reservation is now confirmed.';
  }

  return {
    bookingNumber: raw.bookingNumber,
    bookingStatus: raw.bookingStatus,
    paymentStatus,
    paymentState: raw.paymentState,
    paymentLabel: raw.paymentLabel,
    totalAmount: Number(raw.totalAmount ?? 0),
    receivedAmount: Number(raw.receivedAmount ?? 0),
    remainingAmount: Number(raw.remainingAmount ?? 0),
    paymentSelection: raw.onlinePayment?.paymentSelection ?? null,
    paymentTypeLabel: raw.onlinePayment?.paymentTypeLabel,
    checkoutUrl: raw.onlinePayment?.checkoutUrl ?? null,
    paymentProvider: raw.onlinePayment?.gateway ?? null,
    paymentReference: raw.onlinePayment?.paymentReference ?? null,
    rejectionReason: raw.onlinePayment?.rejectionReason ?? null,
    unitLabel,
    checkInDateTime: raw.checkInDateTime,
    checkOutDateTime: raw.checkOutDateTime,
    guestName: raw.guest?.fullName || '—',
    message,
  };
}
