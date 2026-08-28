import { BadRequestException } from '@nestjs/common';
import { BookingType, PaymentState, Prisma } from '../../generated/prisma/client';
import { deriveLedgerPaymentState } from '../payments/payment-status';
import { elapsedHourCount, hotelNightCount } from './booking.duration';
import { serializeMoney } from './booking.finance';

export const EARLY_CHECKOUT_POLICIES = [
  'ACTUAL_STAY_ONLY',
  'FULL_BOOKING_CHARGE',
  'ACTUAL_STAY_PLUS_PENALTY',
  'MANUAL_SUPER_ADMIN_ADJUSTMENT',
] as const;

export type EarlyCheckoutPolicy = (typeof EARLY_CHECKOUT_POLICIES)[number];

export const EARLY_CHECKOUT_PENALTY_TYPES = [
  'FLAT',
  'PERCENT',
  'ONE_NIGHT',
] as const;

export type EarlyCheckoutPenaltyType =
  (typeof EARLY_CHECKOUT_PENALTY_TYPES)[number];

export type EarlyCheckoutPolicyConfig = {
  policy: EarlyCheckoutPolicy;
  penaltyType: EarlyCheckoutPenaltyType;
  penaltyValue: number;
  minDailyNights: number;
  minHourlyHours: number;
};

export type CheckoutFinanceSnapshot = {
  policy: EarlyCheckoutPolicy;
  isEarlyCheckout: boolean;
  originalRoomCharges: string;
  originalTotalAmount: string;
  originalNumberOfDays: number | null;
  originalNumberOfHours: number | null;
  revisedRoomCharges: string;
  revisedTotalAmount: string;
  actualNights: number | null;
  actualHours: number | null;
  penaltyAmount: string;
  adjustmentAmount: string;
  adjustmentReason: string | null;
  outstandingReason: string | null;
};

export type CheckoutChargeSource = {
  bookingType: BookingType | string;
  checkInDateTime: Date;
  checkOutDateTime: Date;
  actualCheckInAt?: Date | null;
  hourlyRate?: Prisma.Decimal | number | string | null;
  dailyRate?: Prisma.Decimal | number | string | null;
  numberOfHours?: number | null;
  numberOfDays?: number | null;
  roomCharges: Prisma.Decimal | number | string;
  electricityCharges?: Prisma.Decimal | number | string;
  cleaningCharges?: Prisma.Decimal | number | string;
  laundryCharges?: Prisma.Decimal | number | string;
  maintenanceCharges?: Prisma.Decimal | number | string;
  otherCharges?: Prisma.Decimal | number | string;
  discountAmount?: Prisma.Decimal | number | string;
  totalAmount: Prisma.Decimal | number | string;
  receivedAmount: Prisma.Decimal | number | string;
};

export type CheckoutQuoteInput = {
  source: CheckoutChargeSource;
  now: Date;
  config: EarlyCheckoutPolicyConfig;
  extraReceived?: number;
  revisedTotalAmount?: number;
  adjustmentReason?: string | null;
  outstandingReason?: string | null;
};

export type CheckoutQuote = {
  policy: EarlyCheckoutPolicy;
  isEarlyCheckout: boolean;
  actualCheckIn: Date;
  actualCheckOut: Date;
  plannedNights: number | null;
  actualNights: number | null;
  plannedHours: number | null;
  actualHours: number | null;
  originalRoomCharges: Prisma.Decimal;
  revisedRoomCharges: Prisma.Decimal;
  otherCharges: Prisma.Decimal;
  electricityCharges: Prisma.Decimal;
  cleaningCharges: Prisma.Decimal;
  laundryCharges: Prisma.Decimal;
  maintenanceCharges: Prisma.Decimal;
  discountAmount: Prisma.Decimal;
  penaltyAmount: Prisma.Decimal;
  adjustmentAmount: Prisma.Decimal;
  originalTotalAmount: Prisma.Decimal;
  revisedTotalAmount: Prisma.Decimal;
  paid: Prisma.Decimal;
  remaining: Prisma.Decimal;
  refundDue: Prisma.Decimal;
  paymentState: PaymentState;
  numberOfDays: number | null;
  numberOfHours: number | null;
  snapshot: CheckoutFinanceSnapshot;
};

export function resolveEarlyCheckoutPolicy(raw?: string | null): EarlyCheckoutPolicy {
  const value = (raw ?? '').trim().toUpperCase();
  if ((EARLY_CHECKOUT_POLICIES as readonly string[]).includes(value)) {
    return value as EarlyCheckoutPolicy;
  }
  return 'ACTUAL_STAY_ONLY';
}

export function resolveEarlyCheckoutPenaltyType(
  raw?: string | null,
): EarlyCheckoutPenaltyType {
  const value = (raw ?? '').trim().toUpperCase();
  if ((EARLY_CHECKOUT_PENALTY_TYPES as readonly string[]).includes(value)) {
    return value as EarlyCheckoutPenaltyType;
  }
  return 'FLAT';
}

export function moneyDue(remaining: Prisma.Decimal | number | string) {
  const value =
    remaining instanceof Prisma.Decimal
      ? remaining
      : new Prisma.Decimal(remaining);
  if (value.lessThan(0)) {
    return { remaining: new Prisma.Decimal(0), refundDue: value.abs() };
  }
  return { remaining: value, refundDue: new Prisma.Decimal(0) };
}

export function checkoutFinanceFromJson(
  value: unknown,
): CheckoutFinanceSnapshot | null {
  if (!value || typeof value !== 'object') return null;
  const row = value as Record<string, unknown>;
  if (typeof row.originalTotalAmount !== 'string') return null;
  return {
    policy: resolveEarlyCheckoutPolicy(String(row.policy ?? '')),
    isEarlyCheckout: Boolean(row.isEarlyCheckout),
    originalRoomCharges: String(row.originalRoomCharges ?? '0'),
    originalTotalAmount: String(row.originalTotalAmount ?? '0'),
    originalNumberOfDays:
      typeof row.originalNumberOfDays === 'number' ? row.originalNumberOfDays : null,
    originalNumberOfHours:
      typeof row.originalNumberOfHours === 'number'
        ? row.originalNumberOfHours
        : null,
    revisedRoomCharges: String(row.revisedRoomCharges ?? '0'),
    revisedTotalAmount: String(row.revisedTotalAmount ?? '0'),
    actualNights: typeof row.actualNights === 'number' ? row.actualNights : null,
    actualHours: typeof row.actualHours === 'number' ? row.actualHours : null,
    penaltyAmount: String(row.penaltyAmount ?? '0'),
    adjustmentAmount: String(row.adjustmentAmount ?? '0'),
    adjustmentReason:
      typeof row.adjustmentReason === 'string' ? row.adjustmentReason : null,
    outstandingReason:
      typeof row.outstandingReason === 'string' ? row.outstandingReason : null,
  };
}

export function calculateCheckoutQuote(input: CheckoutQuoteInput): CheckoutQuote {
  const { source, now, config } = input;
  const actualCheckIn = source.actualCheckInAt ?? source.checkInDateTime;
  const actualCheckOut = now;
  const isHourly = source.bookingType === BookingType.HOURLY;
  const isEarlyCheckout = actualCheckOut.getTime() < source.checkOutDateTime.getTime();

  const plannedNights = isHourly
    ? null
    : Math.max(
        config.minDailyNights || 1,
        source.numberOfDays ??
          hotelNightCount(source.checkInDateTime, source.checkOutDateTime),
      );
  const plannedHours = isHourly
    ? Math.max(config.minHourlyHours || 1, source.numberOfHours ?? 1)
    : null;
  const actualNights = isHourly
    ? null
    : Math.max(
        config.minDailyNights || 1,
        hotelNightCount(actualCheckIn, actualCheckOut),
      );
  const actualHours = isHourly
    ? Math.max(
        config.minHourlyHours || 1,
        elapsedHourCount(actualCheckIn, actualCheckOut),
      )
    : null;

  const originalRoomCharges = toDecimal(source.roomCharges);
  const originalTotalAmount = toDecimal(source.totalAmount);
  const otherCharges = toDecimal(source.otherCharges);
  const electricityCharges = toDecimal(source.electricityCharges);
  const cleaningCharges = toDecimal(source.cleaningCharges);
  const laundryCharges = toDecimal(source.laundryCharges);
  const maintenanceCharges = toDecimal(source.maintenanceCharges);
  const discountAmount = toDecimal(source.discountAmount);
  const existingReceived = toDecimal(source.receivedAmount);
  const extraReceived = toDecimal(input.extraReceived);
  const paid = existingReceived.plus(extraReceived);

  const billedNights = !isHourly
    ? isEarlyCheckout && usesActualStay(config.policy)
      ? actualNights!
      : plannedNights!
    : null;
  const billedHours = isHourly
    ? isEarlyCheckout && usesActualStay(config.policy)
      ? actualHours!
      : plannedHours!
    : null;

  let revisedRoomCharges = originalRoomCharges;
  if (isEarlyCheckout && usesActualStay(config.policy)) {
    revisedRoomCharges = isHourly
      ? toDecimal(source.hourlyRate).mul(billedHours ?? 0)
      : toDecimal(source.dailyRate).mul(billedNights ?? 0);
  }

  let penaltyAmount = new Prisma.Decimal(0);
  if (isEarlyCheckout && config.policy === 'ACTUAL_STAY_PLUS_PENALTY') {
    penaltyAmount = computePenalty({
      type: config.penaltyType,
      value: config.penaltyValue,
      originalRoomCharges,
      dailyRate: toDecimal(source.dailyRate),
      isHourly,
    });
  }

  const amenities = electricityCharges
    .plus(cleaningCharges)
    .plus(laundryCharges)
    .plus(maintenanceCharges)
    .plus(otherCharges);

  let revisedTotalAmount = revisedRoomCharges
    .plus(amenities)
    .plus(penaltyAmount)
    .minus(discountAmount);

  if (revisedTotalAmount.lessThan(0)) {
    throw new BadRequestException('Revised checkout total cannot be negative');
  }

  let adjustmentAmount = new Prisma.Decimal(0);
  if (input.revisedTotalAmount !== undefined && input.revisedTotalAmount !== null) {
    const requested = toDecimal(input.revisedTotalAmount);
    adjustmentAmount = requested.minus(revisedTotalAmount);
    revisedTotalAmount = requested;
  }

  const signedRemaining = revisedTotalAmount.minus(paid);
  const dues = moneyDue(signedRemaining);
  const paymentState = deriveLedgerPaymentState({
    totalPayable: revisedTotalAmount,
    totalReceived: paid,
  });

  const snapshot: CheckoutFinanceSnapshot = {
    policy: config.policy,
    isEarlyCheckout,
    originalRoomCharges: serializeMoney(originalRoomCharges),
    originalTotalAmount: serializeMoney(originalTotalAmount),
    originalNumberOfDays: source.numberOfDays ?? plannedNights,
    originalNumberOfHours: source.numberOfHours ?? plannedHours,
    revisedRoomCharges: serializeMoney(revisedRoomCharges),
    revisedTotalAmount: serializeMoney(revisedTotalAmount),
    actualNights,
    actualHours,
    penaltyAmount: serializeMoney(penaltyAmount),
    adjustmentAmount: serializeMoney(adjustmentAmount),
    adjustmentReason: input.adjustmentReason?.trim() || null,
    outstandingReason: input.outstandingReason?.trim() || null,
  };

  return {
    policy: config.policy,
    isEarlyCheckout,
    actualCheckIn,
    actualCheckOut,
    plannedNights,
    actualNights,
    plannedHours,
    actualHours,
    originalRoomCharges,
    revisedRoomCharges,
    otherCharges,
    electricityCharges,
    cleaningCharges,
    laundryCharges,
    maintenanceCharges,
    discountAmount,
    penaltyAmount,
    adjustmentAmount,
    originalTotalAmount,
    revisedTotalAmount,
    paid,
    remaining: dues.remaining,
    refundDue: dues.refundDue,
    paymentState,
    numberOfDays: billedNights,
    numberOfHours: billedHours,
    snapshot,
  };
}

function usesActualStay(policy: EarlyCheckoutPolicy) {
  return (
    policy === 'ACTUAL_STAY_ONLY' ||
    policy === 'ACTUAL_STAY_PLUS_PENALTY' ||
    policy === 'MANUAL_SUPER_ADMIN_ADJUSTMENT'
  );
}

function computePenalty(input: {
  type: EarlyCheckoutPenaltyType;
  value: number;
  originalRoomCharges: Prisma.Decimal;
  dailyRate: Prisma.Decimal;
  isHourly: boolean;
}): Prisma.Decimal {
  const amount = Number(input.value);
  if (!Number.isFinite(amount) || amount <= 0) {
    return new Prisma.Decimal(0);
  }
  if (input.type === 'PERCENT') {
    return input.originalRoomCharges.mul(amount).div(100);
  }
  if (input.type === 'ONE_NIGHT') {
    if (input.isHourly) return new Prisma.Decimal(0);
    return input.dailyRate;
  }
  return toDecimal(amount);
}

function toDecimal(value: Prisma.Decimal | number | string | null | undefined) {
  if (value instanceof Prisma.Decimal) return value;
  const amount = Number(value ?? 0);
  if (!Number.isFinite(amount) || amount < 0) {
    return new Prisma.Decimal(0);
  }
  return new Prisma.Decimal(amount);
}
