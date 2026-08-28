import { Prisma } from '../../generated/prisma/client';

export type OpenMonthlyBill = {
  id: string;
  remainingBalance: Prisma.Decimal;
};

export type TenancyPaymentSlice = {
  monthlyBillId?: string;
  amount: Prisma.Decimal;
};

/**
 * Oldest due first. Never skip an older open bill to put the whole
 * amount on the current month when older remaining exists.
 */
export function allocateOldestDueFirst(
  amount: Prisma.Decimal,
  bills: OpenMonthlyBill[],
): TenancyPaymentSlice[] {
  const slices: TenancyPaymentSlice[] = [];
  let leftover = amount;

  for (const bill of bills) {
    if (leftover.lessThanOrEqualTo(0)) break;
    if (bill.remainingBalance.lessThanOrEqualTo(0)) continue;
    const apply = leftover.lessThan(bill.remainingBalance)
      ? leftover
      : bill.remainingBalance;
    slices.push({ monthlyBillId: bill.id, amount: apply });
    leftover = leftover.minus(apply);
  }

  if (leftover.greaterThan(0)) {
    slices.push({ amount: leftover });
  }

  return slices.length > 0 ? slices : [{ amount }];
}
