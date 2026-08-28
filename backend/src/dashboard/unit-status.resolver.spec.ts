import { resolveUnitStatus } from './unit-status.resolver';
import {
  BookingType,
  MonthlyOccupancyState,
  UnitStatus,
} from '../../generated/prisma/client';

describe('resolveUnitStatus', () => {
  it('prioritizes BLOCKED over occupancy', () => {
    const result = resolveUnitStatus({
      unitStatus: UnitStatus.BLOCKED,
      checkedInBooking: {
        bookingType: BookingType.DAILY,
        remainingAmount: 100,
      },
    });
    expect(result.status).toBe(UnitStatus.BLOCKED);
    expect(result.statusTone).toBe('blocked');
    expect(result.priority).toBe(1);
  });

  it('marks checkout pending when neither clearance is done', () => {
    const result = resolveUnitStatus({
      unitStatus: UnitStatus.CLEANING_REQUIRED,
      pendingClearanceBooking: {
        cleaningCleared: false,
        accountsCleared: false,
      },
    });
    expect(result.statusTone).toBe('red');
    expect(result.statusLabel).toBe('CHECKOUT PENDING');
    expect(result.priority).toBe(3);
  });

  it('labels account pending when cleaning cleared only', () => {
    const result = resolveUnitStatus({
      unitStatus: UnitStatus.CLEANING_REQUIRED,
      pendingClearanceBooking: {
        cleaningCleared: true,
        accountsCleared: false,
      },
    });
    expect(result.statusLabel).toBe('ACCOUNT PENDING');
  });

  it('paints daily occupancy purple, distinct from monthly blue', () => {
    const result = resolveUnitStatus({
      unitStatus: UnitStatus.OCCUPIED,
      checkedInBooking: {
        bookingType: BookingType.DAILY,
        remainingAmount: 5000,
      },
    });
    expect(result.statusTone).toBe('purple');
    expect(result.statusLabel).toBe('DAILY OCCUPIED');
    expect(result.hasOutstanding).toBe(true);
    expect(result.bookingType).toBe('DAILY');
  });

  it('paints assigned (pending) daily rooms purple immediately', () => {
    const result = resolveUnitStatus({
      unitStatus: UnitStatus.AVAILABLE,
      checkedInBooking: {
        bookingType: BookingType.DAILY,
        remainingAmount: 0,
        bookingStatus: 'PENDING',
      },
    });
    expect(result.status).toBe(UnitStatus.OCCUPIED);
    expect(result.statusTone).toBe('purple');
    expect(result.statusLabel).toBe('DAILY ASSIGNED');
  });

  it('keeps monthly occupancy blue even with outstanding balance', () => {
    const result = resolveUnitStatus({
      unitStatus: UnitStatus.OCCUPIED,
      activeTenancy: {
        occupancyState: MonthlyOccupancyState.OCCUPIED,
        remainingBalance: 5000,
      },
    });
    expect(result.statusTone).toBe('blue');
    expect(result.hasOutstanding).toBe(true);
    expect(result.bookingType).toBe('MONTHLY');
  });

  it('paints hourly occupancy purple with outstanding balance', () => {
    const result = resolveUnitStatus({
      unitStatus: UnitStatus.OCCUPIED,
      checkedInBooking: {
        bookingType: BookingType.HOURLY,
        remainingAmount: 5000,
      },
    });
    expect(result.statusTone).toBe('purple');
    expect(result.hasOutstanding).toBe(true);
    expect(result.bookingType).toBe('HOURLY');
  });

  it('marks monthly vacant with hotel use allowed', () => {
    const result = resolveUnitStatus({
      unitStatus: UnitStatus.MONTHLY_TENANT_VACANT,
      activeTenancy: {
        occupancyState: MonthlyOccupancyState.EMPTY,
      },
    });
    expect(result.statusTone).toBe('white');
    expect(result.hotelUseAllowed).toBe(true);
    expect(result.bookingType).toBe('MONTHLY');
    expect(result.priority).toBe(5);
  });

  it('returns available green by default', () => {
    const result = resolveUnitStatus({
      unitStatus: UnitStatus.AVAILABLE,
    });
    expect(result.status).toBe(UnitStatus.AVAILABLE);
    expect(result.statusTone).toBe('green');
    expect(result.priority).toBe(6);
  });
});
