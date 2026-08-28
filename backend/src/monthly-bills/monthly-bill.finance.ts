import { BadRequestException } from '@nestjs/common';
import {
  MonthlyBillPaymentStatus,
  Prisma,
} from '../../generated/prisma/client';

export type BillChargeInput = {
  baseRent: Prisma.Decimal | number;
  electricityCharges?: Prisma.Decimal | number;
  maintenanceCharges?: Prisma.Decimal | number;
  societyCharges?: Prisma.Decimal | number;
  cleaningCharges?: Prisma.Decimal | number;
  laundryCharges?: Prisma.Decimal | number;
  waterCharges?: Prisma.Decimal | number;
  otherCharges?: Prisma.Decimal | number;
  previousBalance?: Prisma.Decimal | number;
  credits?: Prisma.Decimal | number;
  totalReceived?: Prisma.Decimal | number;
};

function d(value: Prisma.Decimal | number | undefined, fallback = 0): Prisma.Decimal {
  if (value === undefined || value === null) {
    return new Prisma.Decimal(fallback);
  }
  const next = value instanceof Prisma.Decimal ? value : new Prisma.Decimal(value);
  if (next.isNegative()) {
    throw new BadRequestException('Monetary values cannot be negative');
  }
  return next;
}

export function calculateBillTotals(input: BillChargeInput) {
  const baseRent = d(input.baseRent);
  const electricityCharges = d(input.electricityCharges);
  const maintenanceCharges = d(input.maintenanceCharges);
  const societyCharges = d(input.societyCharges);
  const cleaningCharges = d(input.cleaningCharges);
  const laundryCharges = d(input.laundryCharges);
  const waterCharges = d(input.waterCharges);
  const otherCharges = d(input.otherCharges);
  const previousBalance = d(input.previousBalance);
  const credits = d(input.credits);
  const totalReceived = d(input.totalReceived);

  const totalPayable = baseRent
    .plus(electricityCharges)
    .plus(maintenanceCharges)
    .plus(societyCharges)
    .plus(cleaningCharges)
    .plus(laundryCharges)
    .plus(waterCharges)
    .plus(otherCharges)
    .plus(previousBalance)
    .minus(credits);

  if (totalPayable.isNegative()) {
    throw new BadRequestException('Credits cannot exceed charge total');
  }

  const remainingBalance = totalPayable.minus(totalReceived);

  return {
    baseRent,
    electricityCharges,
    maintenanceCharges,
    societyCharges,
    cleaningCharges,
    laundryCharges,
    waterCharges,
    otherCharges,
    previousBalance,
    credits,
    totalPayable,
    totalReceived,
    remainingBalance,
  };
}

export function deriveBillPaymentStatus(
  totalPayable: Prisma.Decimal,
  totalReceived: Prisma.Decimal,
  dueDate: Date,
  now = new Date(),
): MonthlyBillPaymentStatus {
  if (totalReceived.greaterThan(totalPayable)) {
    return MonthlyBillPaymentStatus.OVERPAID;
  }
  if (totalReceived.greaterThanOrEqualTo(totalPayable) && totalPayable.greaterThan(0)) {
    return MonthlyBillPaymentStatus.PAID;
  }
  if (totalReceived.equals(0)) {
    if (now > dueDate && totalPayable.greaterThan(0)) {
      return MonthlyBillPaymentStatus.OVERDUE;
    }
    return MonthlyBillPaymentStatus.UNPAID;
  }
  if (now < dueDate && totalReceived.greaterThan(0)) {
    return MonthlyBillPaymentStatus.ADVANCE;
  }
  if (totalReceived.greaterThanOrEqualTo(totalPayable.div(2))) {
    return MonthlyBillPaymentStatus.HALF_PAID;
  }
  if (now > dueDate) {
    return MonthlyBillPaymentStatus.OVERDUE;
  }
  return MonthlyBillPaymentStatus.PARTIAL;
}

export function buildDueDate(
  year: number,
  month: number,
  billingDay: number,
): Date {
  const day = Math.min(Math.max(billingDay, 1), 28);
  return new Date(Date.UTC(year, month - 1, day));
}

export function serializeMoney(value: Prisma.Decimal | null | undefined) {
  return value?.toString() ?? '0';
}
