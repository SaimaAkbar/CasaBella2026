import { BadRequestException } from '@nestjs/common';
import { PaymentState, Prisma } from '../../generated/prisma/client';

export type ChargeInput = {
  monthlyRent: number;
  securityDeposit?: number;
  maintenanceCharges?: number;
  laundryCharges?: number;
  cleaningCharges?: number;
  waterCharges?: number;
  societyCharges?: number;
  electricityCharges?: number;
  otherCharges?: number;
  previousBalance?: number;
  totalReceived?: number;
};

export type PaymentDisplayState =
  | 'UNPAID'
  | 'ADVANCE'
  | 'PARTIAL'
  | 'HALF_PAID'
  | 'PAID'
  | 'OVERPAID'
  | 'REFUNDED'
  | 'REVERSED';

function toDecimal(value: number | undefined, fallback = 0): Prisma.Decimal {
  const amount = value ?? fallback;

  if (amount < 0) {
    throw new BadRequestException('Monetary values cannot be negative');
  }

  return new Prisma.Decimal(amount);
}

export function calculateTenancyTotals(
  input: ChargeInput,
  options?: { allowAdvance?: boolean },
) {
  const monthlyRent = toDecimal(input.monthlyRent);
  const securityDeposit = toDecimal(input.securityDeposit);
  const maintenanceCharges = toDecimal(input.maintenanceCharges);
  const laundryCharges = toDecimal(input.laundryCharges);
  const cleaningCharges = toDecimal(input.cleaningCharges);
  const waterCharges = toDecimal(input.waterCharges);
  const societyCharges = toDecimal(input.societyCharges);
  const electricityCharges = toDecimal(input.electricityCharges);
  const otherCharges = toDecimal(input.otherCharges);
  const previousBalance = toDecimal(input.previousBalance);
  const totalReceived = toDecimal(input.totalReceived);

  const totalPayable = monthlyRent
    .plus(maintenanceCharges)
    .plus(laundryCharges)
    .plus(cleaningCharges)
    .plus(waterCharges)
    .plus(societyCharges)
    .plus(electricityCharges)
    .plus(otherCharges)
    .plus(previousBalance);

  if (totalReceived.greaterThan(totalPayable) && !options?.allowAdvance) {
    throw new BadRequestException(
      'Total received cannot exceed total payable without Super Admin advance approval',
    );
  }

  const remainingBalance = totalPayable.minus(totalReceived);

  return {
    securityDeposit,
    monthlyRent,
    maintenanceCharges,
    laundryCharges,
    cleaningCharges,
    waterCharges,
    societyCharges,
    electricityCharges,
    otherCharges,
    previousBalance,
    totalPayable,
    totalReceived,
    remainingBalance,
    paymentState: derivePaymentState(totalPayable, totalReceived),
  };
}

export function derivePaymentState(
  totalPayable: Prisma.Decimal,
  totalReceived: Prisma.Decimal,
  startDate?: Date,
  now = new Date(),
): PaymentDisplayState {
  if (totalReceived.equals(0)) {
    return 'UNPAID';
  }

  if (totalReceived.greaterThan(totalPayable)) {
    return 'OVERPAID';
  }

  if (totalReceived.greaterThanOrEqualTo(totalPayable)) {
    return 'PAID';
  }

  if (startDate && now < startDate) {
    return 'ADVANCE';
  }

  const half = totalPayable.div(2);

  if (totalReceived.greaterThanOrEqualTo(half)) {
    return 'HALF_PAID';
  }

  return 'PARTIAL';
}

/** Prefer Prisma PaymentState when mapping API responses. */
export function toPaymentStateEnum(
  state: PaymentDisplayState,
): PaymentState {
  return state as PaymentState;
}

export function serializeMoney(value: Prisma.Decimal | null | undefined) {
  return value?.toString() ?? '0';
}
