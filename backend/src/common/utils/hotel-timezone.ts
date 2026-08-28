/** Matches settings catalog `business.timezone` default. Pakistan has no DST. */
export const HOTEL_TIMEZONE = 'Asia/Karachi';
export const HOTEL_UTC_OFFSET = '+05:00';

export function hotelCalendarYmd(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: HOTEL_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

export function hotelDayUtcRange(ymd: string): { start: Date; end: Date } {
  const start = new Date(`${ymd}T00:00:00.000${HOTEL_UTC_OFFSET}`);
  const end = new Date(`${ymd}T23:59:59.999${HOTEL_UTC_OFFSET}`);
  return { start, end };
}

export function hotelTodayUtcRange(now = new Date()): { start: Date; end: Date } {
  return hotelDayUtcRange(hotelCalendarYmd(now));
}
