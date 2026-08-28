import { BadRequestException } from '@nestjs/common';
import {
  OwnerStatementPaymentStatus,
  Prisma,
} from '../../generated/prisma/client';

function d(
  value: Prisma.Decimal | number | undefined,
  fallback = 0,
): Prisma.Decimal {
  if (value === undefined || value === null) {
    return new Prisma.Decimal(fallback);
  }
  const next =
    value instanceof Prisma.Decimal ? value : new Prisma.Decimal(value);
  return next;
}

export function calculateOwnerStatementTotals(input: {
  expectedAmount: Prisma.Decimal | number;
  previousBalance?: Prisma.Decimal | number;
  adjustmentAmount?: Prisma.Decimal | number;
  totalPaid?: Prisma.Decimal | number;
}) {
  const expectedAmount = d(input.expectedAmount);
  const previousBalance = d(input.previousBalance);
  const adjustmentAmount = d(input.adjustmentAmount);
  const totalPaid = d(input.totalPaid);

  if (expectedAmount.isNegative()) {
    throw new BadRequestException('Expected amount cannot be negative');
  }

  const totalPayableOrReceivable = expectedAmount
    .plus(previousBalance)
    .plus(adjustmentAmount);

  const remainingAmount = totalPayableOrReceivable.minus(totalPaid);

  return {
    expectedAmount,
    previousBalance,
    adjustmentAmount,
    totalPayableOrReceivable,
    totalPaid,
    remainingAmount,
  };
}

export function deriveOwnerStatementPaymentStatus(
  totalPayableOrReceivable: Prisma.Decimal,
  totalPaid: Prisma.Decimal,
  dueDate: Date,
  now = new Date(),
): OwnerStatementPaymentStatus {
  if (totalPaid.greaterThan(totalPayableOrReceivable)) {
    return OwnerStatementPaymentStatus.OVERPAID;
  }
  if (
    totalPaid.greaterThanOrEqualTo(totalPayableOrReceivable) &&
    totalPayableOrReceivable.greaterThan(0)
  ) {
    return OwnerStatementPaymentStatus.PAID;
  }
  if (totalPaid.equals(0)) {
    if (now > dueDate && totalPayableOrReceivable.greaterThan(0)) {
      return OwnerStatementPaymentStatus.OVERDUE;
    }
    return OwnerStatementPaymentStatus.UNPAID;
  }
  if (now > dueDate) {
    return OwnerStatementPaymentStatus.OVERDUE;
  }
  return OwnerStatementPaymentStatus.PARTIAL;
}

export function buildOwnerDueDate(
  year: number,
  month: number,
  dueDay: number,
): Date {
  if (month < 1 || month > 12) {
    throw new BadRequestException('Invalid month');
  }
  if (year < 2000 || year > 2100) {
    throw new BadRequestException('Invalid year');
  }
  const day = Math.min(Math.max(dueDay, 1), 28);
  return new Date(Date.UTC(year, month - 1, day));
}

export function serializeMoney(value: Prisma.Decimal | null | undefined) {
  return value?.toString() ?? '0';
}

export function assignmentValidForMonth(
  agreementStart: Date,
  agreementEnd: Date | null,
  year: number,
  month: number,
): boolean {
  const periodStart = new Date(Date.UTC(year, month - 1, 1));
  const periodEnd = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
  if (agreementStart > periodEnd) return false;
  if (agreementEnd && agreementEnd < periodStart) return false;
  return true;
}

/**
 * Resolve agreed monthly amount for a billing period from revision history.
 * Uses the latest revision with effectiveFrom <= period end.
 * If only future revisions exist, uses the previous amount of the earliest revision
 * (so past months keep the pre-revision amount after a revise).
 * Past statements keep their stored expectedAmount and are never rewritten.
 */
export function resolveEffectiveMonthlyAmount(input: {
  currentFixedMonthlyAmount: Prisma.Decimal | number;
  agreementStart: Date;
  revisions: Array<{
    effectiveFrom: Date;
    newFixedMonthlyAmount: Prisma.Decimal | number;
    previousFixedMonthlyAmount?: Prisma.Decimal | number | null;
  }>;
  year: number;
  month: number;
}): Prisma.Decimal {
  const periodEnd = new Date(Date.UTC(input.year, input.month, 0, 23, 59, 59, 999));
  const applicable = [...input.revisions]
    .filter((r) => r.effectiveFrom <= periodEnd)
    .sort((a, b) => b.effectiveFrom.getTime() - a.effectiveFrom.getTime());

  if (applicable.length > 0) {
    return d(applicable[0].newFixedMonthlyAmount);
  }

  if (input.revisions.length > 0) {
    const earliest = [...input.revisions].sort(
      (a, b) => a.effectiveFrom.getTime() - b.effectiveFrom.getTime(),
    )[0];
    if (
      earliest.previousFixedMonthlyAmount !== undefined &&
      earliest.previousFixedMonthlyAmount !== null
    ) {
      return d(earliest.previousFixedMonthlyAmount);
    }
  }

  return d(input.currentFixedMonthlyAmount);
}

export function paymentStatusTick(
  status: OwnerStatementPaymentStatus | string,
): { icon: string; label: string } {
  switch (status) {
    case OwnerStatementPaymentStatus.PAID:
    case 'PAID':
      return { icon: '✅', label: 'Paid' };
    case OwnerStatementPaymentStatus.PARTIAL:
    case 'PARTIAL':
      return { icon: '🟡', label: 'Partial' };
    case OwnerStatementPaymentStatus.OVERDUE:
    case 'OVERDUE':
      return { icon: '⚠️', label: 'Overdue' };
    case OwnerStatementPaymentStatus.OVERPAID:
    case 'OVERPAID':
      return { icon: '✅', label: 'Overpaid' };
    case OwnerStatementPaymentStatus.UNPAID:
    case 'UNPAID':
    default:
      return { icon: '🔴', label: 'Unpaid' };
  }
}

/** Aggregate unit statement statuses into one owner overall status for a month. */
export function deriveOwnerOverallStatus(
  statuses: Array<OwnerStatementPaymentStatus | string>,
): OwnerStatementPaymentStatus {
  if (statuses.length === 0) {
    return OwnerStatementPaymentStatus.UNPAID;
  }
  const normalized = statuses.map((s) => String(s));
  const allPaid = normalized.every(
    (s) =>
      s === OwnerStatementPaymentStatus.PAID ||
      s === OwnerStatementPaymentStatus.OVERPAID ||
      s === 'PAID' ||
      s === 'OVERPAID',
  );
  if (allPaid) return OwnerStatementPaymentStatus.PAID;
  if (
    normalized.some(
      (s) => s === OwnerStatementPaymentStatus.OVERDUE || s === 'OVERDUE',
    )
  ) {
    return OwnerStatementPaymentStatus.OVERDUE;
  }
  if (
    normalized.some(
      (s) => s === OwnerStatementPaymentStatus.PARTIAL || s === 'PARTIAL',
    )
  ) {
    return OwnerStatementPaymentStatus.PARTIAL;
  }
  return OwnerStatementPaymentStatus.UNPAID;
}

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

export function formatOwnerPeriodLabel(month: number, year: number): string {
  const name = MONTH_NAMES[month - 1] ?? `Month ${month}`;
  return `${name} ${year}`;
}
