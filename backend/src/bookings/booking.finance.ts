import { BadRequestException } from '@nestjs/common';
import { BookingType, PaymentState, Prisma } from '../../generated/prisma/client';
import {
  assertCheckOutAfterCheckIn,
  dailyNightCount,
  elapsedHourCount,
} from './booking.duration';

export type BookingChargeInput = {
  bookingType: BookingType;
  hourlyRate?: number | null;
  dailyRate?: number | null;
  numberOfHours?: number | null;
  numberOfDays?: number | null;
  electricityCharges?: number;
  cleaningCharges?: number;
  laundryCharges?: number;
  maintenanceCharges?: number;
  otherCharges?: number;
  otherChargesDescription?: string | null;
  discountAmount?: number;
  receivedAmount?: number;
  /** Used for ADVANCE vs PARTIAL when stay has not started */
  checkInDateTime?: Date | string;
  checkOutDateTime?: Date | string;
  now?: Date;
};

/**
 * PaymentState rules (exact):
 * 1. receivedAmount === 0 → UNPAID
 * 2. receivedAmount > totalAmount → ADVANCE (overpayment / Super Admin adjustment)
 * 3. receivedAmount >= totalAmount → PAID
 * 4. receivedAmount > 0 AND now < checkInDateTime AND received < total → ADVANCE
 * 5. receivedAmount >= totalAmount / 2 → HALF_PAID
 * 6. otherwise → PARTIAL
 */
export function derivePaymentState(
  totalAmount: Prisma.Decimal,
  receivedAmount: Prisma.Decimal,
  checkInDateTime: Date,
  now = new Date(),
): PaymentState {
  if (receivedAmount.equals(0)) {
    return PaymentState.UNPAID;
  }

  if (receivedAmount.greaterThan(totalAmount)) {
    return PaymentState.ADVANCE;
  }

  if (receivedAmount.greaterThanOrEqualTo(totalAmount)) {
    return PaymentState.PAID;
  }

  if (now < checkInDateTime) {
    return PaymentState.ADVANCE;
  }

  const half = totalAmount.div(2);
  if (receivedAmount.greaterThanOrEqualTo(half)) {
    return PaymentState.HALF_PAID;
  }

  return PaymentState.PARTIAL;
}

function toDecimal(value: number | undefined | null, fallback = 0): Prisma.Decimal {
  const amount = value ?? fallback;

  if (amount < 0) {
    throw new BadRequestException('Monetary values cannot be negative');
  }

  return new Prisma.Decimal(amount);
}

export function calculateBookingTotals(
  input: BookingChargeInput,
  options?: { allowAdvance?: boolean },
) {
  let roomCharges: Prisma.Decimal;
  let numberOfHours: number | null = null;
  let numberOfDays: number | null = null;
  let hourlyRate: Prisma.Decimal | null = null;
  let dailyRate: Prisma.Decimal | null = null;

  if (input.bookingType === BookingType.HOURLY) {
    if (input.checkInDateTime && input.checkOutDateTime) {
      assertCheckOutAfterCheckIn(input.checkInDateTime, input.checkOutDateTime);
    }
    const hours =
      input.checkInDateTime && input.checkOutDateTime
        ? elapsedHourCount(input.checkInDateTime, input.checkOutDateTime)
        : (input.numberOfHours ?? 0);
    if (!Number.isInteger(hours) || hours <= 0) {
      throw new BadRequestException('numberOfHours must be greater than 0');
    }
    if (input.hourlyRate === undefined || input.hourlyRate === null) {
      throw new BadRequestException('hourlyRate is required for hourly bookings');
    }
    hourlyRate = toDecimal(input.hourlyRate);
    numberOfHours = hours;
    roomCharges = hourlyRate.mul(hours);
  } else {
    if (input.checkInDateTime && input.checkOutDateTime) {
      assertCheckOutAfterCheckIn(input.checkInDateTime, input.checkOutDateTime);
      numberOfDays = dailyNightCount(
        input.checkInDateTime,
        input.checkOutDateTime,
      );
    } else {
      const days = input.numberOfDays ?? 0;
      if (!Number.isInteger(days) || days < 1) {
        throw new BadRequestException('numberOfDays must be at least 1');
      }
      numberOfDays = days;
    }
    if (input.dailyRate === undefined || input.dailyRate === null) {
      throw new BadRequestException('dailyRate is required for daily bookings');
    }
    dailyRate = toDecimal(input.dailyRate);
    roomCharges = dailyRate.mul(numberOfDays);
  }

  const electricityCharges = toDecimal(input.electricityCharges);
  const cleaningCharges = toDecimal(input.cleaningCharges);
  const laundryCharges = toDecimal(input.laundryCharges);
  const maintenanceCharges = toDecimal(input.maintenanceCharges);
  const otherCharges = toDecimal(input.otherCharges);
  const discountAmount = toDecimal(input.discountAmount);
  const receivedAmount = toDecimal(input.receivedAmount);

  const grossAmount = roomCharges
    .plus(electricityCharges)
    .plus(cleaningCharges)
    .plus(laundryCharges)
    .plus(maintenanceCharges)
    .plus(otherCharges);

  if (discountAmount.greaterThan(grossAmount)) {
    throw new BadRequestException('discountAmount cannot exceed gross amount');
  }

  const totalAmount = grossAmount.minus(discountAmount);

  if (receivedAmount.greaterThan(totalAmount) && !options?.allowAdvance) {
    throw new BadRequestException(
      'receivedAmount cannot exceed totalAmount without Super Admin advance approval',
    );
  }

  const remainingAmount = totalAmount.minus(receivedAmount);
  const checkIn = input.checkInDateTime
    ? new Date(input.checkInDateTime)
    : new Date();

  return {
    hourlyRate,
    dailyRate,
    numberOfHours,
    numberOfDays,
    roomCharges,
    electricityCharges,
    cleaningCharges,
    laundryCharges,
    maintenanceCharges,
    otherCharges,
    discountAmount,
    totalAmount,
    receivedAmount,
    remainingAmount,
    paymentState: derivePaymentState(
      totalAmount,
      receivedAmount,
      checkIn,
      input.now ?? new Date(),
    ),
  };
}

export function serializeMoney(value: Prisma.Decimal | null | undefined) {
  return value?.toString() ?? '0';
}

/** Receptionist may apply discounts up to 10% of gross or PKR 2,000, whichever is lower. */
export function assertDiscountAllowed(
  role: string,
  discountAmount: number,
  grossAmount: Prisma.Decimal,
) {
  if (role === 'SUPER_ADMIN' || role === 'ADMIN') {
    return;
  }

  if (discountAmount <= 0) {
    return;
  }

  const discount = new Prisma.Decimal(discountAmount);
  const tenPercent = grossAmount.mul(0.1);
  const cap = Prisma.Decimal.min(tenPercent, new Prisma.Decimal(2000));

  if (discount.greaterThan(cap)) {
    throw new BadRequestException(
      'Large discounts require Admin/Super Admin approval (max 10% of gross or PKR 2,000 for Receptionist)',
    );
  }
}
