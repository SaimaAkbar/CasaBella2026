import { BookingStatus, BookingType } from '../../generated/prisma/client';

export type OccupancyTimingStatus =
  | 'OCCUPIED'
  | 'EARLY_CHECKOUT'
  | 'LATE_CHECKOUT'
  | null;

export function occupancyTimingStatus(input: {
  bookingStatus: BookingStatus | string;
  plannedCheckOut: Date | string;
  actualCheckOut?: Date | string | null;
}): OccupancyTimingStatus {
  if (input.bookingStatus === BookingStatus.CHECKED_IN) {
    return 'OCCUPIED';
  }

  if (input.bookingStatus !== BookingStatus.CHECKED_OUT) {
    return null;
  }

  if (!input.actualCheckOut) {
    return null;
  }

  const actual = toDate(input.actualCheckOut);
  const planned = toDate(input.plannedCheckOut);
  if (!actual || !planned) {
    return null;
  }

  if (actual.getTime() < planned.getTime()) {
    return 'EARLY_CHECKOUT';
  }
  if (actual.getTime() > planned.getTime()) {
    return 'LATE_CHECKOUT';
  }
  return null;
}

export function formatDurationMs(ms: number): string {
  const safe = Math.max(0, Math.round(ms));
  const totalMinutes = Math.floor(safe / 60_000);
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes - days * 60 * 24) / 60);
  const minutes = totalMinutes % 60;
  const parts: string[] = [];
  if (days > 0) parts.push(`${days} ${days === 1 ? 'day' : 'days'}`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0 || parts.length === 0) parts.push(`${minutes}m`);
  return parts.join(' ');
}

export function checkoutDifferenceLabel(
  plannedCheckOut: Date | string,
  actualCheckOut: Date | string | null | undefined,
): string | null {
  if (!actualCheckOut) return null;
  const actual = toDate(actualCheckOut);
  const planned = toDate(plannedCheckOut);
  if (!actual || !planned) return null;
  const delta = planned.getTime() - actual.getTime();
  if (delta === 0) return 'On time';
  if (delta > 0) return `${formatDurationMs(delta)} earlier`;
  return `${formatDurationMs(-delta)} later`;
}

export function actualHourlyDurationLabel(
  actualCheckIn: Date | string | null | undefined,
  actualCheckOut: Date | string | null | undefined,
): string | null {
  if (!actualCheckIn || !actualCheckOut) return null;
  const start = toDate(actualCheckIn);
  const end = toDate(actualCheckOut);
  if (!start || !end || end.getTime() < start.getTime()) return null;
  return formatDurationMs(end.getTime() - start.getTime());
}

export function stayDurationLabel(input: {
  bookingType: BookingType | string;
  billedNights?: number | null;
  billedHours?: number | null;
  actualCheckIn?: Date | string | null;
  actualCheckOut?: Date | string | null;
}): string {
  if (input.bookingType === BookingType.HOURLY) {
    const actual = actualHourlyDurationLabel(
      input.actualCheckIn,
      input.actualCheckOut,
    );
    if (actual) return actual;
    const hours = input.billedHours ?? 0;
    return `${hours} ${hours === 1 ? 'Hour' : 'Hours'}`;
  }

  if (input.actualCheckIn && input.actualCheckOut) {
    const nights = calendarNights(input.actualCheckIn, input.actualCheckOut);
    if (nights !== null) {
      const billed = nights === 0 ? 1 : nights;
      return `${billed} ${billed === 1 ? 'Night' : 'Nights'}`;
    }
  }

  const nights = input.billedNights ?? 0;
  return `${nights} ${nights === 1 ? 'Night' : 'Nights'}`;
}

function calendarNights(
  checkIn: Date | string,
  checkOut: Date | string,
): number | null {
  const start = toDate(checkIn);
  const end = toDate(checkOut);
  if (!start || !end) return null;
  const startUtc = Date.UTC(
    start.getFullYear(),
    start.getMonth(),
    start.getDate(),
  );
  const endUtc = Date.UTC(end.getFullYear(), end.getMonth(), end.getDate());
  return Math.round((endUtc - startUtc) / 86_400_000);
}

function toDate(value: Date | string): Date | null {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}
