import {
  BookingType,
  MonthlyOccupancyState,
  UnitStatus,
} from '../../generated/prisma/client';

export type StatusTone =
  | 'green'
  | 'blue'
  | 'purple'
  | 'red'
  | 'white'
  | 'gray'
  | 'blocked';

export type DashboardBookingType =
  | 'HOURLY'
  | 'DAILY'
  | 'MONTHLY';

export type ResolvedUnitStatus = {
  /** Canonical UnitStatus used for filtering and summary buckets. */
  status: UnitStatus;
  /** Human-readable label for cards (may be more specific than status). */
  statusLabel: string;
  statusTone: StatusTone;
  hotelUseAllowed: boolean;
  hasOutstanding: boolean;
  bookingType: DashboardBookingType | null;
  priority: 1 | 2 | 3 | 4 | 5 | 6;
};

export type UnitStatusResolutionInput = {
  unitStatus: UnitStatus;
  /**
   * Live hotel stay that occupies the unit: CHECKED_IN, CONFIRMED, or PENDING.
   * Dashboard assign-to-daily creates PENDING, so that must paint occupied immediately.
   */
  checkedInBooking?: {
    bookingType: BookingType;
    remainingAmount: { toString(): string } | number | string | null;
    checkOutDateTime?: Date | string | null;
    bookingStatus?: string | null;
  } | null;
  /**
   * Latest CHECKED_OUT booking that still needs cleaning and/or accounts clearance.
   * Clearance flags live on Booking, not Unit.
   */
  pendingClearanceBooking?: {
    cleaningCleared: boolean;
    accountsCleared: boolean;
  } | null;
  activeTenancy?: {
    occupancyState: MonthlyOccupancyState;
    remainingBalance?: { toString(): string } | number | string | null;
    hotelUseAllowed?: boolean;
  } | null;
};

function moneyPositive(
  value: { toString(): string } | number | string | null | undefined,
): boolean {
  if (value === null || value === undefined) {
    return false;
  }
  const n = typeof value === 'number' ? value : Number(value.toString());
  return Number.isFinite(n) && n > 0;
}

function isHotelGuestBooking(bookingType: BookingType): boolean {
  return (
    bookingType === BookingType.DAILY || bookingType === BookingType.HOURLY
  );
}

function occupiedToneForBooking(bookingType: BookingType): StatusTone {
  return isHotelGuestBooking(bookingType) ? 'purple' : 'blue';
}

function occupiedLabelForBooking(
  bookingType: BookingType,
  bookingStatus?: string | null,
): string {
  const assigned =
    bookingStatus === 'PENDING' || bookingStatus === 'CONFIRMED';
  if (bookingType === BookingType.DAILY) {
    return assigned ? 'DAILY ASSIGNED' : 'DAILY OCCUPIED';
  }
  if (bookingType === BookingType.HOURLY) {
    return assigned ? 'HOURLY ASSIGNED' : 'HOURLY OCCUPIED';
  }
  return 'OCCUPIED';
}

function clearanceLabel(
  cleaningCleared: boolean,
  accountsCleared: boolean,
): string {
  if (!cleaningCleared && !accountsCleared) {
    return 'CHECKOUT PENDING';
  }
  if (!cleaningCleared) {
    return 'CLEANING REQUIRED';
  }
  if (!accountsCleared) {
    return 'ACCOUNT PENDING';
  }
  return 'CLEANING REQUIRED';
}

/**
 * Single centralized status-resolution for dashboard unit cards.
 * Priority: 1 BLOCKED → 2 MAINTENANCE → 3 CHECKOUT/CLEANING/ACCOUNT PENDING
 * → 4 OCCUPIED → 5 MONTHLY TENANT VACANT → 6 AVAILABLE
 *
 * Outstanding balance on an occupied unit never upgrades tone to red.
 * Daily / hourly occupancy is purple; monthly occupancy is blue.
 */
export function resolveUnitStatus(
  input: UnitStatusResolutionInput,
): ResolvedUnitStatus {
  const {
    unitStatus,
    checkedInBooking,
    pendingClearanceBooking,
    activeTenancy,
  } = input;

  if (unitStatus === UnitStatus.BLOCKED) {
    return {
      status: UnitStatus.BLOCKED,
      statusLabel: 'BLOCKED',
      statusTone: 'blocked',
      hotelUseAllowed: false,
      hasOutstanding: false,
      bookingType: null,
      priority: 1,
    };
  }

  if (unitStatus === UnitStatus.MAINTENANCE) {
    return {
      status: UnitStatus.MAINTENANCE,
      statusLabel: 'MAINTENANCE',
      statusTone: 'gray',
      hotelUseAllowed: false,
      hasOutstanding: false,
      bookingType: null,
      priority: 2,
    };
  }

  const needsClearance =
    pendingClearanceBooking !== null &&
    pendingClearanceBooking !== undefined &&
    (!pendingClearanceBooking.cleaningCleared ||
      !pendingClearanceBooking.accountsCleared);

  if (needsClearance || unitStatus === UnitStatus.CLEANING_REQUIRED) {
    const cleaningCleared = pendingClearanceBooking?.cleaningCleared ?? false;
    const accountsCleared = pendingClearanceBooking?.accountsCleared ?? false;
    return {
      status: UnitStatus.CLEANING_REQUIRED,
      statusLabel: clearanceLabel(cleaningCleared, accountsCleared),
      statusTone: 'red',
      hotelUseAllowed: false,
      hasOutstanding: false,
      bookingType: null,
      priority: 3,
    };
  }

  if (checkedInBooking) {
    return {
      status: UnitStatus.OCCUPIED,
      statusLabel: occupiedLabelForBooking(
        checkedInBooking.bookingType,
        checkedInBooking.bookingStatus,
      ),
      statusTone: occupiedToneForBooking(checkedInBooking.bookingType),
      hotelUseAllowed: false,
      hasOutstanding: moneyPositive(checkedInBooking.remainingAmount),
      bookingType: checkedInBooking.bookingType,
      priority: 4,
    };
  }

  if (activeTenancy?.occupancyState === MonthlyOccupancyState.OCCUPIED) {
    return {
      status: UnitStatus.OCCUPIED,
      statusLabel: 'OCCUPIED',
      statusTone: 'blue',
      hotelUseAllowed: false,
      hasOutstanding: moneyPositive(activeTenancy.remainingBalance),
      bookingType: 'MONTHLY',
      priority: 4,
    };
  }

  if (unitStatus === UnitStatus.OCCUPIED) {
    return {
      status: UnitStatus.OCCUPIED,
      statusLabel: 'OCCUPIED',
      statusTone: 'blue',
      hotelUseAllowed: false,
      hasOutstanding: moneyPositive(activeTenancy?.remainingBalance),
      bookingType: activeTenancy ? 'MONTHLY' : null,
      priority: 4,
    };
  }

  if (
    unitStatus === UnitStatus.MONTHLY_TENANT_VACANT ||
    activeTenancy?.occupancyState === MonthlyOccupancyState.EMPTY
  ) {
    return {
      status: UnitStatus.MONTHLY_TENANT_VACANT,
      statusLabel: 'MONTHLY TENANT VACANT',
      statusTone: 'white',
      hotelUseAllowed: true,
      hasOutstanding: moneyPositive(activeTenancy?.remainingBalance),
      bookingType: 'MONTHLY',
      priority: 5,
    };
  }

  return {
    status: UnitStatus.AVAILABLE,
    statusLabel: 'AVAILABLE',
    statusTone: 'green',
    hotelUseAllowed: false,
    hasOutstanding: false,
    bookingType: null,
    priority: 6,
  };
}

export type UnitGridAllowedActions = {
  newBooking: boolean;
  checkIn: boolean;
  checkOut: boolean;
  receivePayment: boolean;
  markEmpty: boolean;
  markOccupied: boolean;
  markCleaningCleared: boolean;
  markAccountsCleared: boolean;
  viewBooking: boolean;
  viewTenant: boolean;
  maintenance: boolean;
  block: boolean;
  unblock: boolean;
};

export function resolveAllowedActions(input: {
  role: 'SUPER_ADMIN' | 'ADMIN' | 'RECEPTIONIST';
  resolved: ResolvedUnitStatus;
  hasCheckedInBooking: boolean;
  hasConfirmedBooking: boolean;
  hasPendingBooking?: boolean;
  hasPendingClearance: boolean;
  hasActiveTenancy: boolean;
  tenancyEmpty: boolean;
}): UnitGridAllowedActions {
  const canManageUnits =
    input.role === 'SUPER_ADMIN' || input.role === 'ADMIN';
  const operational = true;

  return {
    newBooking:
      operational &&
      (input.resolved.status === UnitStatus.AVAILABLE ||
        input.resolved.status === UnitStatus.MONTHLY_TENANT_VACANT),
    checkIn: operational && input.hasConfirmedBooking,
    checkOut: operational && input.hasCheckedInBooking,
    receivePayment:
      operational &&
      (input.hasCheckedInBooking ||
        input.hasActiveTenancy ||
        input.hasPendingClearance),
    markEmpty:
      operational && input.hasActiveTenancy && !input.tenancyEmpty,
    markOccupied:
      operational && input.hasActiveTenancy && input.tenancyEmpty,
    markCleaningCleared: operational && input.hasPendingClearance,
    markAccountsCleared: operational && input.hasPendingClearance,
    viewBooking:
      operational &&
      (input.hasCheckedInBooking ||
        input.hasConfirmedBooking ||
        input.hasPendingBooking ||
        input.hasPendingClearance),
    viewTenant: operational && input.hasActiveTenancy,
    maintenance:
      canManageUnits &&
      input.resolved.status !== UnitStatus.MAINTENANCE &&
      input.resolved.status !== UnitStatus.BLOCKED &&
      !input.hasCheckedInBooking,
    block:
      canManageUnits &&
      input.resolved.status !== UnitStatus.BLOCKED &&
      !input.hasCheckedInBooking,
    unblock: canManageUnits && input.resolved.status === UnitStatus.BLOCKED,
  };
}
