import { BadRequestException } from '@nestjs/common';
import type { AccountingView, ProfitLossFilterInput, ResolvedPeriod } from './profit-loss.types';

function parseDateOnly(value: string, field: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new BadRequestException(`${field} must be YYYY-MM-DD`);
  }
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    throw new BadRequestException(`Invalid ${field}`);
  }
  return date;
}

function endOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function toIsoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function monthName(month: number): string {
  return new Date(2000, month - 1, 1).toLocaleString('en', { month: 'long' });
}

/**
 * Resolve exactly one reporting period.
 * Priority: start/end → date → month+year → year → current month.
 */
export function resolveReportingPeriod(
  query: ProfitLossFilterInput,
): { period: ResolvedPeriod; range: { gte: Date; lte: Date } } {
  const accountingView: AccountingView =
    query.accountingView === 'CASH' ? 'CASH' : 'ACCRUAL';

  if (query.startDate || query.endDate) {
    if (!query.startDate || !query.endDate) {
      throw new BadRequestException(
        'Both startDate and endDate are required for a custom range',
      );
    }
    const start = startOfDay(parseDateOnly(query.startDate, 'startDate'));
    const end = endOfDay(parseDateOnly(query.endDate, 'endDate'));
    if (start.getTime() > end.getTime()) {
      throw new BadRequestException('startDate must not be after endDate');
    }
    return {
      period: {
        startDate: toIsoDate(start),
        endDate: toIsoDate(end),
        accountingView,
        label: `${toIsoDate(start)} → ${toIsoDate(end)}`,
      },
      range: { gte: start, lte: end },
    };
  }

  if (query.date) {
    const day = parseDateOnly(query.date, 'date');
    const start = startOfDay(day);
    const end = endOfDay(day);
    return {
      period: {
        startDate: toIsoDate(start),
        endDate: toIsoDate(end),
        accountingView,
        label: toIsoDate(start),
      },
      range: { gte: start, lte: end },
    };
  }

  if (query.month !== undefined) {
    if (query.year === undefined) {
      throw new BadRequestException('year is required when month is provided');
    }
    if (!Number.isInteger(query.month) || query.month < 1 || query.month > 12) {
      throw new BadRequestException('month must be between 1 and 12');
    }
    if (!Number.isInteger(query.year) || query.year < 2000 || query.year > 2100) {
      throw new BadRequestException('year must be a valid 4-digit year');
    }
    const start = new Date(query.year, query.month - 1, 1, 0, 0, 0, 0);
    const end = new Date(query.year, query.month, 0, 23, 59, 59, 999);
    return {
      period: {
        startDate: toIsoDate(start),
        endDate: toIsoDate(end),
        accountingView,
        label: `${monthName(query.month)} ${query.year}`,
      },
      range: { gte: start, lte: end },
    };
  }

  if (query.year !== undefined) {
    if (!Number.isInteger(query.year) || query.year < 2000 || query.year > 2100) {
      throw new BadRequestException('year must be a valid 4-digit year');
    }
    const start = new Date(query.year, 0, 1, 0, 0, 0, 0);
    const end = new Date(query.year, 11, 31, 23, 59, 59, 999);
    return {
      period: {
        startDate: toIsoDate(start),
        endDate: toIsoDate(end),
        accountingView,
        label: String(query.year),
      },
      range: { gte: start, lte: end },
    };
  }

  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  return {
    period: {
      startDate: toIsoDate(start),
      endDate: toIsoDate(end),
      accountingView,
      label: `${monthName(now.getMonth() + 1)} ${now.getFullYear()}`,
    },
    range: { gte: start, lte: end },
  };
}

export function resultTypeFromNet(
  net: { isZero: () => boolean; isNegative: () => boolean },
): 'PROFIT' | 'LOSS' | 'BREAK_EVEN' {
  if (net.isZero()) return 'BREAK_EVEN';
  if (net.isNegative()) return 'LOSS';
  return 'PROFIT';
}

/** Calendar months touched by [start, end] inclusive (local dates). */
export function monthsTouchedByRange(
  start: Date,
  end: Date,
): Array<{ month: number; year: number }> {
  const out: Array<{ month: number; year: number }> = [];
  let year = start.getFullYear();
  let month = start.getMonth() + 1;
  const endYear = end.getFullYear();
  const endMonth = end.getMonth() + 1;
  while (year < endYear || (year === endYear && month <= endMonth)) {
    out.push({ month, year });
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }
  return out;
}
