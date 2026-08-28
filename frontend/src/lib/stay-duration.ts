/** Hotel calendar nights (Pakistan). Same-day stay bills as 1 night. */
export function calendarNightsBetween(
  checkIn: string,
  checkOut: string,
): number | null {
  const start = new Date(checkIn);
  const end = new Date(checkOut);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return null;
  }
  if (end <= start) return null;
  const startDay = Date.UTC(
    start.getFullYear(),
    start.getMonth(),
    start.getDate(),
  );
  const endDay = Date.UTC(end.getFullYear(), end.getMonth(), end.getDate());
  return Math.round((endDay - startDay) / 86_400_000);
}

export function dailyNightCount(
  checkIn: string,
  checkOut: string,
): number | null {
  const nights = calendarNightsBetween(checkIn, checkOut);
  if (nights == null) return null;
  return nights === 0 ? 1 : nights;
}

/** Whole hours elapsed, rounded up, minimum 1. */
export function elapsedHourCount(
  checkIn: string,
  checkOut: string,
): number | null {
  const start = new Date(checkIn);
  const end = new Date(checkOut);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return null;
  }
  if (end <= start) return null;
  return Math.max(1, Math.ceil((end.getTime() - start.getTime()) / 3_600_000));
}
