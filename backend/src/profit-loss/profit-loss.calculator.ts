import { Prisma } from '../../generated/prisma/client';
import {
  parseAdjustmentDirection,
  type PaymentLedgerRow,
} from '../payments/payment-balance';
import { resultTypeFromNet } from './profit-loss.period';
import type { ProfitLossResultType } from './profit-loss.types';

export function money(value: Prisma.Decimal | number | string | null | undefined) {
  if (value instanceof Prisma.Decimal) return value.toString();
  if (value === null || value === undefined) return '0';
  return new Prisma.Decimal(value).toString();
}

export function toDecimal(value: Prisma.Decimal | number | string | null | undefined) {
  if (value instanceof Prisma.Decimal) return value;
  return new Prisma.Decimal(value ?? 0);
}

/**
 * Security deposits are NON-INCOME liabilities.
 * Marked in Payment.notes as SECURITY_DEPOSIT / security deposit.
 * Agreement.securityDeposit is informational only (not in Payment ledger).
 */
export function isSecurityDepositPayment(notes?: string | null): boolean {
  if (!notes) return false;
  return /SECURITY_DEPOSIT|security\s*deposit/i.test(notes);
}

/**
 * Net contribution of one payment row for P&L / cash income.
 * Matches payment-balance rules; pending/cancelled excluded.
 * Security deposits contribute 0 to operating income.
 */
export function signedIncomeAmount(
  row: PaymentLedgerRow & { notes?: string | null },
): Prisma.Decimal {
  if (isSecurityDepositPayment(row.notes)) {
    return new Prisma.Decimal(0);
  }

  const amount = toDecimal(row.amount);

  if (row.transactionType === 'PAYMENT') {
    if (
      row.status === 'COMPLETED' ||
      row.status === 'REFUNDED' ||
      row.status === 'REVERSED'
    ) {
      return amount;
    }
    return new Prisma.Decimal(0);
  }

  if (row.status !== 'COMPLETED') {
    return new Prisma.Decimal(0);
  }

  if (row.transactionType === 'REFUND' || row.transactionType === 'REVERSAL') {
    return amount.negated();
  }

  if (row.transactionType === 'ADJUSTMENT') {
    return parseAdjustmentDirection(row.notes) === 'DEBIT'
      ? amount.negated()
      : amount;
  }

  return new Prisma.Decimal(0);
}

export function sumSignedIncome(
  rows: Array<PaymentLedgerRow & { notes?: string | null }>,
): Prisma.Decimal {
  return rows.reduce(
    (total, row) => total.plus(signedIncomeAmount(row)),
    new Prisma.Decimal(0),
  );
}

export function buildResult(
  income: Prisma.Decimal,
  expenses: Prisma.Decimal,
): { netAmount: string; resultType: ProfitLossResultType } {
  const net = income.minus(expenses);
  return {
    netAmount: money(net),
    resultType: resultTypeFromNet(net),
  };
}

const CATEGORY_BUCKETS: Record<
  string,
  | 'rent'
  | 'electricity'
  | 'maintenance'
  | 'society'
  | 'cleaning'
  | 'laundry'
  | 'salary'
  | 'inventory'
  | 'otherExpenses'
> = {
  Rent: 'rent',
  Electricity: 'electricity',
  Maintenance: 'maintenance',
  'Society Bill': 'society',
  Cleaning: 'cleaning',
  Laundry: 'laundry',
  Salary: 'salary',
  Inventory: 'inventory',
};

export function bucketExpenseCategory(name: string) {
  return CATEGORY_BUCKETS[name] ?? 'otherExpenses';
}

export function emptyCategoryBuckets() {
  return {
    rent: new Prisma.Decimal(0),
    electricity: new Prisma.Decimal(0),
    maintenance: new Prisma.Decimal(0),
    society: new Prisma.Decimal(0),
    cleaning: new Prisma.Decimal(0),
    laundry: new Prisma.Decimal(0),
    salary: new Prisma.Decimal(0),
    inventory: new Prisma.Decimal(0),
    otherExpenses: new Prisma.Decimal(0),
  };
}

/**
 * Accrual recognized amount for one MonthlyBill:
 * period charges net of credits = totalPayable − previousBalance
 * (previousBalance is prior-period carry-forward, not this period's revenue).
 */
export function recognizedBillIncome(row: {
  totalPayable: Prisma.Decimal | number | string;
  previousBalance: Prisma.Decimal | number | string;
}): Prisma.Decimal {
  return toDecimal(row.totalPayable).minus(toDecimal(row.previousBalance));
}
