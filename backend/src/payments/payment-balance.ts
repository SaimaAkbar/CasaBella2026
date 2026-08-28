import { PaymentState, Prisma } from '../../generated/prisma/client';

export type PaymentLedgerRow = {
  transactionType: 'PAYMENT' | 'REFUND' | 'REVERSAL' | 'ADJUSTMENT';
  amount: Prisma.Decimal;
  status: string;
  notes?: string | null;
};

/**
 * Net received from ledger rows:
 * + PAYMENT (COMPLETED, REFUNDED, or REVERSED — corrections adjust via linked rows)
 * + ADJUSTMENT CREDIT
 * - REFUND / REVERSAL (COMPLETED)
 * - ADJUSTMENT DEBIT
 *
 * Adjustment direction is stored in notes as `ADJUSTMENT_DIRECTION:CREDIT|DEBIT`.
 */
export function sumNetReceived(rows: PaymentLedgerRow[]): Prisma.Decimal {
  let total = new Prisma.Decimal(0);

  for (const row of rows) {
    const amount = new Prisma.Decimal(row.amount.toString());

    if (row.transactionType === 'PAYMENT') {
      if (
        row.status === 'COMPLETED' ||
        row.status === 'REFUNDED' ||
        row.status === 'REVERSED'
      ) {
        total = total.plus(amount);
      }
      continue;
    }

    if (row.status !== 'COMPLETED') {
      continue;
    }

    switch (row.transactionType) {
      case 'REFUND':
      case 'REVERSAL':
        total = total.minus(amount);
        break;
      case 'ADJUSTMENT': {
        const direction = parseAdjustmentDirection(row.notes);
        total =
          direction === 'DEBIT' ? total.minus(amount) : total.plus(amount);
        break;
      }
      default:
        break;
    }
  }

  return total;
}

export function parseAdjustmentDirection(
  notes?: string | null,
): 'CREDIT' | 'DEBIT' {
  if (!notes) return 'CREDIT';
  const match = notes.match(/ADJUSTMENT_DIRECTION:(CREDIT|DEBIT)/i);
  return match?.[1]?.toUpperCase() === 'DEBIT' ? 'DEBIT' : 'CREDIT';
}

export function buildAdjustmentNotes(
  direction: 'CREDIT' | 'DEBIT',
  reason: string,
  notes?: string,
) {
  const base = `ADJUSTMENT_DIRECTION:${direction}; REASON:${reason.trim()}`;
  return notes?.trim() ? `${base}; ${notes.trim()}` : base;
}

/**
 * Derived display state for Booking / Monthly Tenancy summaries.
 *
 * 1. received = 0 and has refunds → REFUNDED
 * 2. received = 0 and has reversals → REVERSED
 * 3. received = 0 → UNPAID
 * 4. received > total → OVERPAID
 * 5. received >= total → PAID
 * 6. before start and received < total → ADVANCE
 * 7. received >= half → HALF_PAID
 * 8. else → PARTIAL
 */
export function deriveSourcePaymentState(options: {
  totalPayable: Prisma.Decimal;
  totalReceived: Prisma.Decimal;
  startDate: Date;
  hasCompletedRefunds?: boolean;
  hasCompletedReversals?: boolean;
  now?: Date;
}): PaymentState {
  const {
    totalPayable,
    totalReceived,
    startDate,
    hasCompletedRefunds = false,
    hasCompletedReversals = false,
    now = new Date(),
  } = options;

  if (totalReceived.equals(0)) {
    if (hasCompletedRefunds) return PaymentState.REFUNDED;
    if (hasCompletedReversals) return PaymentState.REVERSED;
    return PaymentState.UNPAID;
  }

  if (totalReceived.greaterThan(totalPayable)) {
    return PaymentState.OVERPAID;
  }

  if (totalReceived.greaterThanOrEqualTo(totalPayable)) {
    return PaymentState.PAID;
  }

  if (now < startDate) {
    return PaymentState.ADVANCE;
  }

  const half = totalPayable.div(2);
  if (totalReceived.equals(half) || totalReceived.greaterThanOrEqualTo(half)) {
    return PaymentState.HALF_PAID;
  }

  return PaymentState.PARTIAL;
}

export function serializeMoney(value: Prisma.Decimal | null | undefined) {
  return value?.toString() ?? '0';
}
