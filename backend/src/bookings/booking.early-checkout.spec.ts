import { BookingType } from '../../generated/prisma/client';
import {
  calculateCheckoutQuote,
  moneyDue,
  resolveEarlyCheckoutPolicy,
} from './booking.early-checkout';

jest.mock('../../generated/prisma/client', () => {
  const { Decimal } = require('@prisma/client/runtime/client');
  return {
    Prisma: { Decimal },
    BookingType: { HOURLY: 'HOURLY', DAILY: 'DAILY' },
    PaymentState: {
      UNPAID: 'UNPAID',
      PARTIAL: 'PARTIAL',
      PAID: 'PAID',
      OVERPAID: 'OVERPAID',
    },
  };
});

const planned = {
  bookingType: BookingType.DAILY,
  checkInDateTime: new Date('2026-08-16T14:00:00+05:00'),
  checkOutDateTime: new Date('2026-08-20T12:00:00+05:00'),
  actualCheckInAt: new Date('2026-08-16T14:18:00+05:00'),
  dailyRate: 5000,
  hourlyRate: null,
  numberOfDays: 4,
  numberOfHours: null,
  roomCharges: 20000,
  otherCharges: 0,
  electricityCharges: 0,
  cleaningCharges: 0,
  laundryCharges: 0,
  maintenanceCharges: 0,
  discountAmount: 0,
  totalAmount: 20000,
  receivedAmount: 6000,
};

const policy = {
  policy: 'ACTUAL_STAY_ONLY' as const,
  penaltyType: 'FLAT' as const,
  penaltyValue: 0,
  minDailyNights: 1,
  minHourlyHours: 1,
};

describe('early checkout quote', () => {
  it('rebills 2 nights at 5000 with 6000 paid as PARTIAL remaining 4000', () => {
    const quote = calculateCheckoutQuote({
      source: planned,
      now: new Date('2026-08-18T10:35:00+05:00'),
      config: policy,
    });
    expect(quote.isEarlyCheckout).toBe(true);
    expect(quote.plannedNights).toBe(4);
    expect(quote.actualNights).toBe(2);
    expect(quote.originalRoomCharges.toString()).toBe('20000');
    expect(quote.revisedRoomCharges.toString()).toBe('10000');
    expect(quote.revisedTotalAmount.toString()).toBe('10000');
    expect(quote.paid.toString()).toBe('6000');
    expect(quote.remaining.toString()).toBe('4000');
    expect(quote.refundDue.toString()).toBe('0');
    expect(quote.paymentState).toBe('PARTIAL');
  });

  it('keeps amenities and shows remaining 4000 on 12000 revised bill', () => {
    const quote = calculateCheckoutQuote({
      source: { ...planned, otherCharges: 2000, totalAmount: 22000, receivedAmount: 8000 },
      now: new Date('2026-08-18T10:35:00+05:00'),
      config: policy,
    });
    expect(quote.otherCharges.toString()).toBe('2000');
    expect(quote.revisedTotalAmount.toString()).toBe('12000');
    expect(quote.remaining.toString()).toBe('4000');
    expect(quote.paymentState).toBe('PARTIAL');
  });

  it('does not show overpayment as negative remaining', () => {
    const quote = calculateCheckoutQuote({
      source: { ...planned, receivedAmount: 15000 },
      now: new Date('2026-08-18T10:35:00+05:00'),
      config: policy,
    });
    expect(quote.revisedTotalAmount.toString()).toBe('10000');
    expect(quote.remaining.toString()).toBe('0');
    expect(quote.refundDue.toString()).toBe('5000');
    expect(quote.paymentState).toBe('OVERPAID');
  });

  it('FULL_BOOKING_CHARGE keeps 4-night room charges', () => {
    const quote = calculateCheckoutQuote({
      source: planned,
      now: new Date('2026-08-18T10:35:00+05:00'),
      config: { ...policy, policy: 'FULL_BOOKING_CHARGE' },
    });
    expect(quote.actualNights).toBe(2);
    expect(quote.revisedRoomCharges.toString()).toBe('20000');
    expect(quote.revisedTotalAmount.toString()).toBe('20000');
  });

  it('adds a one-night penalty on actual stay', () => {
    const quote = calculateCheckoutQuote({
      source: planned,
      now: new Date('2026-08-18T10:35:00+05:00'),
      config: {
        ...policy,
        policy: 'ACTUAL_STAY_PLUS_PENALTY',
        penaltyType: 'ONE_NIGHT',
        penaltyValue: 1,
      },
    });
    expect(quote.revisedRoomCharges.toString()).toBe('10000');
    expect(quote.penaltyAmount.toString()).toBe('5000');
    expect(quote.revisedTotalAmount.toString()).toBe('15000');
  });

  it('calculates hourly stay in hours, not nights', () => {
    const quote = calculateCheckoutQuote({
      source: {
        ...planned,
        bookingType: BookingType.HOURLY,
        checkOutDateTime: new Date('2026-08-16T18:00:00+05:00'),
        hourlyRate: 1000,
        dailyRate: null,
        numberOfHours: 4,
        numberOfDays: null,
        roomCharges: 4000,
        totalAmount: 4000,
        receivedAmount: 0,
      },
      now: new Date('2026-08-16T17:40:00+05:00'),
      config: policy,
    });
    expect(quote.actualHours).toBe(4);
    expect(quote.actualNights).toBeNull();
    expect(quote.revisedRoomCharges.toString()).toBe('4000');
  });

  it('does not treat on-time checkout as early', () => {
    const quote = calculateCheckoutQuote({
      source: planned,
      now: new Date('2026-08-20T12:00:00+05:00'),
      config: policy,
    });
    expect(quote.isEarlyCheckout).toBe(false);
    expect(quote.revisedRoomCharges.toString()).toBe('20000');
  });

  it('maps unknown policy to ACTUAL_STAY_ONLY', () => {
    expect(resolveEarlyCheckoutPolicy(undefined)).toBe('ACTUAL_STAY_ONLY');
    expect(resolveEarlyCheckoutPolicy('nope')).toBe('ACTUAL_STAY_ONLY');
  });

  it('splits signed remaining into debt vs refund due', () => {
    expect(moneyDue(-5000).refundDue.toString()).toBe('5000');
    expect(moneyDue(-5000).remaining.toString()).toBe('0');
    expect(moneyDue(4000).remaining.toString()).toBe('4000');
  });
});
