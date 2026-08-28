import { BadRequestException } from '@nestjs/common';

export const CHECKOUT_AFTER_CHECKIN_MESSAGE =
  'Check-out date must be after check-in date.';

const HOTEL_TIME_ZONE = 'Asia/Karachi';

function dateKey(value: Date | string): string {
  const parsed = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(parsed.getTime())) {
    throw new BadRequestException('Invalid check-in or check-out date/time');
  }

  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: HOTEL_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(parsed);
  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;
  if (!year || !month || !day) {
    throw new BadRequestException('Invalid check-in or check-out date/time');
  }
  return `${year}-${month}-${day}`;
}

function utcFromDateKey(key: string): number {
  const [year, month, day] = key.split('-').map(Number);
  return Date.UTC(year, month - 1, day);
}

/** Calendar nights from the date portion of check-in / check-out. */
export function calendarNightsBetween(
  checkIn: Date | string,
  checkOut: Date | string,
): number {
  const nights = Math.round(
    (utcFromDateKey(dateKey(checkOut)) - utcFromDateKey(dateKey(checkIn))) /
      86_400_000,
  );

  if (nights < 0) {
    throw new BadRequestException(CHECKOUT_AFTER_CHECKIN_MESSAGE);
  }

  return nights;
}

/**
 * Daily stays bill by nights.
 * Same-calendar-day booking (check-out still after check-in) is 1 night.
 */
export function dailyNightCount(
  checkIn: Date | string,
  checkOut: Date | string,
): number {
  const nights = calendarNightsBetween(checkIn, checkOut);
  return nights === 0 ? 1 : nights;
}

export function hotelNightCount(
  checkIn: Date | string,
  checkOut: Date | string,
): number {
  return dailyNightCount(checkIn, checkOut);
}

export function elapsedHourCount(
  checkIn: Date | string,
  checkOut: Date | string,
): number {
  const start = new Date(checkIn);
  const end = new Date(checkOut);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    throw new BadRequestException('Invalid check-in or check-out date/time');
  }
  if (end <= start) {
    throw new BadRequestException(CHECKOUT_AFTER_CHECKIN_MESSAGE);
  }
  return Math.max(1, Math.ceil((end.getTime() - start.getTime()) / 3_600_000));
}

export function assertCheckOutAfterCheckIn(
  checkIn: Date | string,
  checkOut: Date | string,
) {
  const start = new Date(checkIn);
  const end = new Date(checkOut);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    throw new BadRequestException('Invalid check-in or check-out date/time');
  }

  if (end <= start) {
    throw new BadRequestException(CHECKOUT_AFTER_CHECKIN_MESSAGE);
  }
}
