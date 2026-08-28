import { BookingType } from '../../generated/prisma/client';
import { Prisma } from '../../generated/prisma/client';
import { dailyNightCount } from './booking.duration';
import { calculateBookingTotals } from './booking.finance';

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
      REFUNDED: 'REFUNDED',
      REVERSED: 'REVERSED',
    },
  };
});

describe('dailyNightCount', () => {
  it('16-Aug-2026 to 19-Aug-2026 is 3 nights', () => {
    expect(
      dailyNightCount('2026-08-16T14:00:00+05:00', '2026-08-19T12:00:00+05:00'),
    ).toBe(3);
  });

  it('16-Aug-2026 to 20-Aug-2026 is 4 nights', () => {
    expect(
      dailyNightCount('2026-08-16T14:00:00+05:00', '2026-08-20T12:00:00+05:00'),
    ).toBe(4);
  });

  it('same-day daily stay is billed as 1 night', () => {
    expect(
      dailyNightCount('2026-08-16T10:00:00+05:00', '2026-08-16T18:00:00+05:00'),
    ).toBe(1);
  });
});

describe('calculateBookingTotals daily amenities bill', () => {
  it('5000/night × 3 nights + 2000 amenities = 17000', () => {
    const totals = calculateBookingTotals({
      bookingType: BookingType.DAILY,
      dailyRate: 5000,
      otherCharges: 2000,
      checkInDateTime: '2026-08-16T14:00:00+05:00',
      checkOutDateTime: '2026-08-19T12:00:00+05:00',
      receivedAmount: 0,
    });
    expect(totals.numberOfDays).toBe(3);
    expect(totals.roomCharges.toString()).toBe('15000');
    expect(totals.otherCharges.toString()).toBe('2000');
    expect(totals.totalAmount.toString()).toBe('17000');
    expect(totals.remainingAmount.toString()).toBe('17000');
  });

  it('ignores a manipulated frontend numberOfDays when dates are present', () => {
    const totals = calculateBookingTotals({
      bookingType: BookingType.DAILY,
      dailyRate: 5000,
      numberOfDays: 99,
      checkInDateTime: '2026-08-16T14:00:00+05:00',
      checkOutDateTime: '2026-08-19T12:00:00+05:00',
    });
    expect(totals.numberOfDays).toBe(3);
    expect(totals.roomCharges.toString()).toBe('15000');
  });

  it('partial payment 7000 of 17000 leaves 10000 remaining PARTIAL', () => {
    const totals = calculateBookingTotals({
      bookingType: BookingType.DAILY,
      dailyRate: 5000,
      otherCharges: 2000,
      checkInDateTime: '2026-08-16T14:00:00+05:00',
      checkOutDateTime: '2026-08-19T12:00:00+05:00',
      receivedAmount: 7000,
    });
    expect(totals.receivedAmount.toString()).toBe('7000');
    expect(totals.remainingAmount.toString()).toBe('10000');
    expect(totals.paymentState).toBe('PARTIAL');
  });

  it('hourly bookings still use hours × hourly rate, not nights', () => {
    const totals = calculateBookingTotals({
      bookingType: BookingType.HOURLY,
      hourlyRate: 1000,
      numberOfHours: 99,
      checkInDateTime: '2026-08-16T14:00:00+05:00',
      checkOutDateTime: '2026-08-16T19:00:00+05:00',
    });
    expect(totals.numberOfHours).toBe(5);
    expect(totals.numberOfDays).toBeNull();
    expect(totals.roomCharges.toString()).toBe('5000');
    expect(totals.totalAmount.toString()).toBe('5000');
  });
});
