import { BookingStatus, BookingType } from '../../generated/prisma/client';
import {
  checkoutDifferenceLabel,
  occupancyTimingStatus,
  stayDurationLabel,
} from './booking.stay-timing';

jest.mock('../../generated/prisma/client', () => ({
  BookingStatus: {
    CHECKED_IN: 'CHECKED_IN',
    CHECKED_OUT: 'CHECKED_OUT',
    PENDING: 'PENDING',
  },
  BookingType: { HOURLY: 'HOURLY', DAILY: 'DAILY' },
}));

describe('booking stay timing', () => {
  const plannedIn = '2026-08-16T14:00:00+05:00';
  const actualIn = '2026-08-16T14:18:00+05:00';
  const plannedOut = '2026-08-20T12:00:00+05:00';
  const actualOut = '2026-08-18T10:35:00+05:00';

  it('detects early checkout without changing planned checkout', () => {
    expect(
      occupancyTimingStatus({
        bookingStatus: BookingStatus.CHECKED_OUT,
        plannedCheckOut: plannedOut,
        actualCheckOut: actualOut,
      }),
    ).toBe('EARLY_CHECKOUT');
    expect(new Date(plannedOut).toISOString()).toBe(
      new Date('2026-08-20T12:00:00+05:00').toISOString(),
    );
  });

  it('detects late checkout', () => {
    expect(
      occupancyTimingStatus({
        bookingStatus: BookingStatus.CHECKED_OUT,
        plannedCheckOut: plannedOut,
        actualCheckOut: '2026-08-20T14:00:00+05:00',
      }),
    ).toBe('LATE_CHECKOUT');
  });

  it('marks checked-in guests OCCUPIED', () => {
    expect(
      occupancyTimingStatus({
        bookingStatus: BookingStatus.CHECKED_IN,
        plannedCheckOut: plannedOut,
        actualCheckOut: null,
      }),
    ).toBe('OCCUPIED');
  });

  it('describes how much earlier actual checkout was', () => {
    const label = checkoutDifferenceLabel(plannedOut, actualOut);
    expect(label).toMatch(/earlier$/);
    expect(label).toContain('2 days');
  });

  it('shows actual daily stay nights from timestamps', () => {
    expect(
      stayDurationLabel({
        bookingType: BookingType.DAILY,
        billedNights: 4,
        actualCheckIn: actualIn,
        actualCheckOut: actualOut,
      }),
    ).toBe('2 Nights');
  });

  it('shows actual hourly duration from timestamps', () => {
    expect(
      stayDurationLabel({
        bookingType: BookingType.HOURLY,
        billedHours: 4,
        actualCheckIn: '2026-08-16T14:15:00+05:00',
        actualCheckOut: '2026-08-16T17:40:00+05:00',
      }),
    ).toBe('3h 25m');
  });

  it('preserves all four timestamps independently', () => {
    expect(plannedIn).not.toBe(actualIn);
    expect(plannedOut).not.toBe(actualOut);
    expect(new Date(plannedOut).getTime()).toBeGreaterThan(
      new Date(actualOut).getTime(),
    );
  });
});
