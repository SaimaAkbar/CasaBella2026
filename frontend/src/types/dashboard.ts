import type { BookingStatus } from './booking';

export type UnitStatus =
  | 'AVAILABLE'
  | 'OCCUPIED'
  | 'CLEANING_REQUIRED'
  | 'MONTHLY_TENANT_VACANT'
  | 'MAINTENANCE'
  | 'BLOCKED';

export type UnitType = 'ROOM' | 'APARTMENT';

export type StatusTone =
  | 'green'
  | 'blue'
  | 'purple'
  | 'red'
  | 'white'
  | 'gray'
  | 'blocked';

export type DashboardBookingType = 'HOURLY' | 'DAILY' | 'MONTHLY';

export type DashboardSummary = {
  totalProperties: number;
  totalApartments: number;
  totalRooms: number;
  occupied: number;
  available: number;
  cleaning: number;
  monthlyEmpty: number;
  maintenance: number;
  blocked?: number;
  todayCheckin: number;
  todayCheckout: number;
  income?: number;
  expenses?: number;
  unpaidExpenses?: number;
  expenseBreakdown?: Array<{ category: string; amount: number }>;
  incomeBreakdown?: Array<{ source: string; amount: number }>;
  profit?: number;
  netLabel?: 'Net Cash Flow' | 'Net Profit';
  accountingView?: 'CASH' | 'ACCRUAL';
  outstanding?: number;
  ownerReceivable?: number;
  ownerPayable?: number;
  ownerReceivedThisMonth?: number;
  ownerPaidThisMonth?: number;
  ownerOutstandingReceivable?: number;
  ownerOutstandingPayable?: number;
  ownerPaymentsDueToday?: number;
  ownerOverdueStatements?: number;
  employeeCount?: number;
  salaryPayable?: number;
  salaryPaid?: number;
  salaryOutstanding?: number;
  salaryAdvances?: number;
  lowStockItems?: number;
  inventoryExpense?: number;
  damagedRoomAssets?: number;
  pendingApprovals?: number;
  todaysActivity?: number;
  criticalRequests?: number;
  rejectedToday?: number;
};

export type UnitGridAllowedActions = {
  newBooking: boolean;
  checkIn: boolean;
  checkOut: boolean;
  cancelBooking: boolean;
  markNoShow: boolean;
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

export type DashboardRoomGridItem = {
  id: string;
  propertyId: string;
  propertyName: string;
  roomNumber: string;
  unitNumber?: string;
  apartmentName: string | null;
  unitType: UnitType;
  status: UnitStatus;
  statusLabel?: string;
  statusTone: StatusTone;
  hotelUseAllowed?: boolean;
  hasOutstanding?: boolean;
  bookingType?: DashboardBookingType | null;
  guestName: string | null;
  monthlyTenant: string | null;
  occupancySource?: 'NORMAL_HOTEL_UNIT' | 'HOTEL_GUEST_ON_TENANT_UNIT' | null;
  settlementType?: string | null;
  bookingId?: string | null;
  tenancyId?: string | null;
  checkInDate?: string | null;
  checkoutDate: string | null;
  rent: string | null;
  paid: string | null;
  remaining: string | null;
  cleaningCleared?: boolean | null;
  accountsCleared?: boolean | null;
  assetWarning?: boolean;
  damagedAssetCount?: number;
  /** True when a DAILY/HOURLY guest is CHECKED_IN and can leave now (including early). */
  canCheckOut?: boolean;
  bookingStatus?: BookingStatus | null;
};

export type DashboardUnitGridDetail = DashboardRoomGridItem & {
  floor: number | null;
  bedrooms: number | null;
  notes: string | null;
  monthlyRent: string | null;
  dailyRate: string | null;
  hourlyRate: string | null;
  allowedActions: UnitGridAllowedActions;
  confirmedBookingId: string | null;
  pendingClearanceBookingId: string | null;
};

export type DashboardFilterOptions = {
  properties: Array<{ id: string; name: string }>;
  apartments: Array<{
    id: string;
    unitNumber: string;
    propertyId: string;
    propertyName: string;
    unitType?: UnitType;
  }>;
  units?: Array<{
    id: string;
    unitNumber: string;
    propertyId: string;
    propertyName: string;
    unitType: UnitType;
  }>;
};

/** Canonical display-status filter values (aligned with resolveUnitStatus). */
export type DashboardDisplayStatus =
  | ''
  | 'AVAILABLE'
  | 'OCCUPIED'
  | 'CLEANING_REQUIRED'
  | 'MONTHLY_TENANT_VACANT'
  | 'MAINTENANCE'
  | 'BLOCKED';

export type DashboardFiltersState = {
  propertyId: string;
  apartmentId: string;
  unitId: string;
  /** Active status filter for the room grid (one at a time). */
  displayStatus: DashboardDisplayStatus;
  /** @deprecated Prefer displayStatus — kept in sync for older filter UIs. */
  status: string;
  unitType: string;
  bookingType: string;
  search: string;
  period: 'all' | 'today' | 'month' | 'year' | 'custom' | 'date';
  date: string;
  month: string;
  year: string;
  dateFrom: string;
  dateTo: string;
};

/** Navigation preset when leaving the dashboard to book / assign. */
export type DashboardUnitNavState = {
  source: 'dashboard';
  propertyId: string;
  unitId: string;
  unitNumber?: string;
  propertyName?: string;
  openBooking?: boolean;
  openAssign?: boolean;
  returnToDashboard?: boolean;
};

export type UnitGridViewMode = 'grid' | 'compact' | 'list';
