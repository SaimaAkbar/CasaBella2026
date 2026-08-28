import { apiRequest, toQueryString } from './client';
import type {
  Booking,
  BookingEligibleUnit,
  BookingInput,
  BookingQuery,
  BookingSummary,
} from '../types/booking';

function queryParams(query: BookingQuery) {
  return toQueryString({
    propertyId: query.propertyId,
    unitId: query.unitId,
    guestId: query.guestId,
    bookingType: query.bookingType || undefined,
    bookingStatus: query.bookingStatus || undefined,
    paymentState: query.paymentState || undefined,
    checkInDate: query.checkInDate,
    checkOutDate: query.checkOutDate,
    month: query.month === '' || query.month === undefined ? undefined : query.month,
    year: query.year === '' || query.year === undefined ? undefined : query.year,
    startDate: query.startDate,
    endDate: query.endDate,
    today: query.today ? 'true' : undefined,
    search: query.search,
  });
}

export function fetchBookings(
  token: string,
  query: BookingQuery = {},
): Promise<Booking[]> {
  return apiRequest<Booking[]>(`/bookings${queryParams(query)}`, { token });
}

export function fetchBookingSummary(
  token: string,
  query: BookingQuery = {},
): Promise<BookingSummary> {
  return apiRequest<BookingSummary>(
    `/bookings/summary/stats${queryParams(query)}`,
    { token },
  );
}

export function fetchBookingEligibleUnits(
  token: string,
  propertyId?: string,
): Promise<BookingEligibleUnit[]> {
  return apiRequest<BookingEligibleUnit[]>(
    `/bookings/eligible-units${toQueryString({ propertyId })}`,
    { token },
  );
}

export function fetchBooking(token: string, id: string): Promise<Booking> {
  return apiRequest<Booking>(`/bookings/${id}`, { token });
}

export function createBooking(
  token: string,
  payload: BookingInput,
): Promise<Booking> {
  return apiRequest<Booking>('/bookings', {
    method: 'POST',
    token,
    body: payload,
  });
}

export function updateBooking(
  token: string,
  id: string,
  payload: Partial<BookingInput>,
): Promise<Booking> {
  return apiRequest<Booking>(`/bookings/${id}`, {
    method: 'PATCH',
    token,
    body: payload,
  });
}

export function confirmBooking(token: string, id: string): Promise<Booking> {
  return apiRequest<Booking>(`/bookings/${id}/confirm`, {
    method: 'POST',
    token,
  });
}

export function checkInBooking(token: string, id: string): Promise<Booking> {
  return apiRequest<Booking>(`/bookings/${id}/check-in`, {
    method: 'POST',
    token,
  });
}

export function checkOutBooking(
  token: string,
  id: string,
  payload: {
    receivedAmount?: number;
    electricityCharges?: number;
    cleaningCharges?: number;
    laundryCharges?: number;
    maintenanceCharges?: number;
    otherCharges?: number;
    discountAmount?: number;
    allowAdvance?: boolean;
    notes?: string;
  } = {},
): Promise<Booking> {
  return apiRequest<Booking>(`/bookings/${id}/check-out`, {
    method: 'POST',
    token,
    body: payload,
  });
}

export function cancelBooking(token: string, id: string): Promise<Booking> {
  return apiRequest<Booking>(`/bookings/${id}/cancel`, {
    method: 'POST',
    token,
  });
}

export function markBookingNoShow(token: string, id: string): Promise<Booking> {
  return apiRequest<Booking>(`/bookings/${id}/no-show`, {
    method: 'POST',
    token,
  });
}

export function markCleaningCleared(
  token: string,
  id: string,
): Promise<Booking> {
  return apiRequest<Booking>(`/bookings/${id}/mark-cleaning-cleared`, {
    method: 'POST',
    token,
  });
}

export function markAccountsCleared(
  token: string,
  id: string,
): Promise<Booking> {
  return apiRequest<Booking>(`/bookings/${id}/mark-accounts-cleared`, {
    method: 'POST',
    token,
  });
}
