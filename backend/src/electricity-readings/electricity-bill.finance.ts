import { Prisma } from '../../generated/prisma/client';

export const DEFAULT_LATE_FINE_PERCENTAGE = 5;

export function computeUnitsConsumed(
  previousUnits: Prisma.Decimal,
  currentUnits: Prisma.Decimal,
): Prisma.Decimal {
  return currentUnits.minus(previousUnits);
}

export function computeBaseBill(
  consumedUnits: Prisma.Decimal,
  ratePerUnit: Prisma.Decimal,
): Prisma.Decimal {
  return consumedUnits.times(ratePerUnit);
}

export function computeFinalBill(
  baseBill: Prisma.Decimal,
  lateFineAmount: Prisma.Decimal,
): Prisma.Decimal {
  return baseBill.plus(lateFineAmount);
}

export function computeOneTimeLateFine(input: {
  baseBill: Prisma.Decimal;
  dueDate: Date | null;
  remainingBeforeFine: Prisma.Decimal;
  lateFineApplied: boolean;
  lateFinePercentage?: Prisma.Decimal | number | null;
  now?: Date;
}): { shouldApply: boolean; lateFineAmount: Prisma.Decimal } {
  const zero = new Prisma.Decimal(0);
  if (input.lateFineApplied) {
    return { shouldApply: false, lateFineAmount: zero };
  }
  if (!input.dueDate || input.remainingBeforeFine.lessThanOrEqualTo(0)) {
    return { shouldApply: false, lateFineAmount: zero };
  }
  const now = input.now ?? new Date();
  if (now.getTime() <= input.dueDate.getTime()) {
    return { shouldApply: false, lateFineAmount: zero };
  }
  const percentage = new Prisma.Decimal(
    input.lateFinePercentage ?? DEFAULT_LATE_FINE_PERCENTAGE,
  );
  return {
    shouldApply: true,
    lateFineAmount: input.baseBill.times(percentage).div(100),
  };
}
