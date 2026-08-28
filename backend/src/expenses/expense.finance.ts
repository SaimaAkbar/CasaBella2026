import { BadRequestException } from '@nestjs/common';
import {
  ExpensePaymentStatus,
  Prisma,
} from '../../generated/prisma/client';

export function toMoney(value: number | undefined | null, fallback = 0) {
  const amount = value ?? fallback;
  if (amount < 0) {
    throw new BadRequestException('Monetary values cannot be negative');
  }
  return new Prisma.Decimal(amount);
}

export function calculateExpenseTotals(
  amountInput: number,
  paidAmountInput?: number,
  options?: { allowOverpay?: boolean; dueDate?: Date | null; now?: Date },
) {
  const amount = toMoney(amountInput);
  if (amount.lessThanOrEqualTo(0)) {
    throw new BadRequestException('Expense amount must be greater than zero');
  }

  const paidAmount = toMoney(paidAmountInput);
  if (paidAmount.greaterThan(amount) && !options?.allowOverpay) {
    throw new BadRequestException(
      'paidAmount cannot exceed amount without Super Admin approval',
    );
  }

  const remainingAmount = amount.minus(paidAmount);
  return {
    amount,
    paidAmount,
    remainingAmount,
    paymentStatus: deriveExpensePaymentStatus(
      amount,
      paidAmount,
      options?.dueDate,
      options?.now,
    ),
  };
}

export function deriveExpensePaymentStatus(
  amount: Prisma.Decimal,
  paidAmount: Prisma.Decimal,
  dueDate?: Date | null,
  now: Date = new Date(),
): ExpensePaymentStatus {
  if (paidAmount.greaterThanOrEqualTo(amount) && amount.greaterThan(0)) {
    return ExpensePaymentStatus.PAID;
  }

  const remaining = amount.minus(paidAmount);
  if (remaining.greaterThan(0) && dueDate && now > dueDate) {
    return ExpensePaymentStatus.OVERDUE;
  }

  if (paidAmount.equals(0)) return ExpensePaymentStatus.UNPAID;
  return ExpensePaymentStatus.PARTIAL;
}

export function serializeMoney(value: Prisma.Decimal | null | undefined) {
  return value?.toString() ?? '0';
}

/** Categories Receptionist may create when explicitly allowed for operations. */
export const RECEPTIONIST_ALLOWED_CATEGORIES = new Set([
  'Cleaning',
  'Laundry',
]);

/** Tab / system category display names used by the Expenses UI. */
export const EXPENSE_TAB_CATEGORIES = {
  electricity: 'Electricity',
  maintenance: 'Maintenance',
  society: 'Society Bill',
  water: 'Water',
  internet: 'Internet',
  cleaning: 'Cleaning',
  liftBill: 'Lift Bill',
  liftMaintenance: 'Lift Maintenance',
  other: 'Other',
} as const;

export const SYSTEM_EXPENSE_CATEGORY_NAMES = [
  'Rent',
  'Electricity',
  'Maintenance',
  'Society Bill',
  'Cleaning',
  'Laundry',
  'Salary',
  'Inventory',
  'Water',
  'Gas',
  'Internet',
  'Repair',
  'Fuel',
  'Lift Bill',
  'Lift Maintenance',
  'Other',
] as const;

export function monthPeriodLabel(month: number, year: number) {
  const names = [
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
  ];
  return `${names[month - 1] ?? `Month ${month}`} ${year}`;
}

export function shiftBillingMonth(month: number, year: number, delta: number) {
  const d = new Date(Date.UTC(year, month - 1 + delta, 1));
  return { month: d.getUTCMonth() + 1, year: d.getUTCFullYear() };
}
