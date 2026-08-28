import { PaymentState, Prisma } from '../../generated/prisma/client';

export type PaymentStatusFilter =
  | 'PAID'
  | 'PARTIAL'
  | 'UNPAID'
  | 'OUTSTANDING';

export type DisplayPaymentStatus =
  | 'UNPAID'
  | 'PARTIAL'
  | 'PAID'
  | 'OVERDUE'
  | 'OVERPAID'
  | 'REFUNDED'
  | 'REVERSED';

function toDecimal(value: Prisma.Decimal | number | string) {
  return value instanceof Prisma.Decimal
    ? value
    : new Prisma.Decimal(value);
}

/**
 * Authoritative money status from ledger totals.
 * Partial is calculated — never stored as a separate money field.
 *
 * UNPAID: paid = 0 and remaining > 0
 * PARTIAL: paid > 0 and remaining > 0
 * PAID: remaining <= 0 (and not overpaid)
 * OVERPAID: paid > payable
 */
export function deriveLedgerPaymentState(options: {
  totalPayable: Prisma.Decimal | number | string;
  totalReceived: Prisma.Decimal | number | string;
  hasCompletedRefunds?: boolean;
  hasCompletedReversals?: boolean;
}): PaymentState {
  const totalPayable = toDecimal(options.totalPayable);
  const totalReceived = toDecimal(options.totalReceived);

  if (totalReceived.equals(0)) {
    if (options.hasCompletedRefunds) return PaymentState.REFUNDED;
    if (options.hasCompletedReversals) return PaymentState.REVERSED;
    return PaymentState.UNPAID;
  }

  if (totalReceived.greaterThan(totalPayable)) {
    return PaymentState.OVERPAID;
  }

  if (totalReceived.greaterThanOrEqualTo(totalPayable)) {
    return PaymentState.PAID;
  }

  return PaymentState.PARTIAL;
}

export function deriveDisplayPaymentStatus(options: {
  totalPayable: Prisma.Decimal | number | string;
  totalReceived: Prisma.Decimal | number | string;
  remaining: Prisma.Decimal | number | string;
  overdue: boolean;
  hasCompletedRefunds?: boolean;
  hasCompletedReversals?: boolean;
}): DisplayPaymentStatus {
  const remaining = toDecimal(options.remaining);
  const totalReceived = toDecimal(options.totalReceived);
  const stored = deriveLedgerPaymentState(options);

  if (stored === PaymentState.REFUNDED) return 'REFUNDED';
  if (stored === PaymentState.REVERSED) return 'REVERSED';
  if (stored === PaymentState.OVERPAID) return 'OVERPAID';
  if (remaining.lessThanOrEqualTo(0)) return 'PAID';
  if (options.overdue) return 'OVERDUE';
  if (totalReceived.equals(0)) return 'UNPAID';
  return 'PARTIAL';
}

export function isMonthlyRentOverdue(options: {
  remaining: Prisma.Decimal | number | string;
  billingDay?: number | null;
  agreementStart?: Date | null;
  now?: Date;
}): boolean {
  const remaining = toDecimal(options.remaining);
  if (remaining.lessThanOrEqualTo(0)) return false;

  const now = options.now ?? new Date();
  const day = Math.min(Math.max(options.billingDay ?? 1, 1), 28);
  let due = new Date(now.getFullYear(), now.getMonth(), day, 23, 59, 59, 999);

  if (options.agreementStart && options.agreementStart > due) {
    due = new Date(due.getFullYear(), due.getMonth() + 1, day, 23, 59, 59, 999);
  }

  return now > due;
}

export function isBookingOverdue(options: {
  remaining: Prisma.Decimal | number | string;
  checkOutDateTime: Date;
  now?: Date;
}): boolean {
  const remaining = toDecimal(options.remaining);
  if (remaining.lessThanOrEqualTo(0)) return false;
  const now = options.now ?? new Date();
  return now > options.checkOutDateTime;
}

export function remainingReceivedFilter(
  filter: PaymentStatusFilter | undefined,
  fields: { received: string; remaining: string },
): Record<string, unknown> | undefined {
  if (!filter) return undefined;

  if (filter === 'PAID') {
    return { [fields.remaining]: { lte: 0 } };
  }

  if (filter === 'OUTSTANDING') {
    return { [fields.remaining]: { gt: 0 } };
  }

  if (filter === 'UNPAID') {
    return {
      [fields.received]: { equals: 0 },
      [fields.remaining]: { gt: 0 },
    };
  }

  return {
    [fields.received]: { gt: 0 },
    [fields.remaining]: { gt: 0 },
  };
}
