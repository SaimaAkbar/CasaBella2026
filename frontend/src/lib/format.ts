export function formatPkr(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === '') {
    return '—';
  }

  const amount = typeof value === 'number' ? value : Number(value);

  if (Number.isNaN(amount)) {
    return String(value);
  }

  return new Intl.NumberFormat('en-PK', {
    style: 'currency',
    currency: 'PKR',
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatDate(value: string | Date | null | undefined): string {
  if (!value) {
    return '—';
  }

  const date = typeof value === 'string' ? new Date(value) : value;

  if (Number.isNaN(date.getTime())) {
    return '—';
  }

  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(date);
}

const SHORT_MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;

/** Compact date for advance banners, e.g. 25-Jan-2027 */
export function formatDateShort(
  value: string | Date | null | undefined,
): string {
  if (!value) return '—';
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return '—';
  return `${date.getDate()}-${SHORT_MONTHS[date.getMonth()]}-${date.getFullYear()}`;
}

export function formatLabel(value: string): string {
  return value.replaceAll('_', ' ');
}

/** Clock time only, e.g. 3:00 PM */
export function formatHotelTime(
  value: string | Date | null | undefined,
): string {
  if (!value) return '—';
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

/** Hotel date + time, e.g. 16-Aug-2026 3:00 PM */
export function formatHotelDateTime(
  value: string | Date | null | undefined,
): string {
  if (!value) return '—';
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return '—';
  return `${formatDateShort(date)} ${formatHotelTime(date)}`;
}
