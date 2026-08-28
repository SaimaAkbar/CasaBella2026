export type SettlementType =
  | 'FIXED_AMOUNT'
  | 'PERCENTAGE'
  | 'NO_TENANT_SHARE'
  | 'RENT_CREDIT'
  | 'CUSTOM';

export type SettlementStatus = 'DRAFT' | 'APPROVED' | 'SETTLED' | 'CANCELLED';

export type EligibleHotelUseAssignment = {
  id: string;
  tenantUnitAssignmentId: string;
  tenantId: string;
  unitId: string;
  hotelUseAllowed: boolean;
  occupancyState: 'OCCUPIED' | 'EMPTY';
  tenancyStatus: 'ACTIVE' | 'ENDED' | 'CANCELLED';
  agreementStart: string;
  agreementEnd: string | null;
  monthlyRent?: string;
  tenant?: { id: string; fullName: string; phone: string };
  unit?: {
    id: string;
    unitNumber: string;
    unitType: string;
    floor: number | null;
    status: string;
    property?: { id: string; name: string };
  };
};

export type TenantUnitHotelUse = {
  id: string;
  monthlyTenancyId: string;
  tenantUnitAssignmentId: string;
  bookingId: string | null;
  settlementType: SettlementType;
  status: SettlementStatus;
  reason: string | null;
  billingMonth: number | null;
  billingYear: number | null;
  createdByUserId: string;
  approvedByUserId: string | null;
  approvedAt: string | null;
  settledAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
  updatedAt: string;
  totalGuestCharge?: string;
  tenantShare?: string;
  organizationShare?: string;
  tenantSharePercentage?: string | null;
  organizationSharePercentage?: string | null;
  rentCreditAmount?: string;
  createdBy?: { id: string; fullName: string; role: string };
  approvedBy?: { id: string; fullName: string; role: string } | null;
  monthlyTenancy?: {
    id: string;
    tenantId: string;
    unitId: string;
    hotelUseAllowed: boolean;
    occupancyState: string;
    tenancyStatus: string;
    monthlyRent?: string;
    tenant?: { id: string; fullName: string; phone: string };
    unit?: {
      id: string;
      unitNumber: string;
      unitType?: string;
      floor?: number | null;
      status: string;
      property?: { id: string; name: string };
    };
  };
  booking?: {
    id: string;
    bookingNumber: string;
    bookingStatus: string;
    occupancySource: string;
    checkInDateTime: string;
    checkOutDateTime: string;
    guest?: { id: string; fullName: string; phone: string };
  } | null;
  rentCredits?: Array<{
    id: string;
    amount: string;
    billingMonth: number;
    billingYear: number;
    reason: string;
    creditDate: string;
    paymentId: string | null;
  }>;
};

export type CreateHotelUseInput = {
  monthlyTenancyId: string;
  settlementType: SettlementType;
  totalGuestCharge: number;
  tenantShare?: number;
  organizationShare?: number;
  tenantSharePercentage?: number;
  organizationSharePercentage?: number;
  reason?: string;
  billingMonth?: number;
  billingYear?: number;
  plannedCheckInDateTime?: string;
  plannedCheckOutDateTime?: string;
};

export type CreateHotelUseBookingInput = {
  guestId?: string;
  guest?: {
    fullName: string;
    phone: string;
    cnicOrPassport?: string;
    email?: string;
    alternatePhone?: string;
  };
  bookingType: 'HOURLY' | 'DAILY';
  checkInDateTime: string;
  checkOutDateTime: string;
  hourlyRate?: number;
  dailyRate?: number;
  numberOfHours?: number;
  numberOfDays?: number;
  numberOfGuests?: number;
  electricityCharges?: number;
  cleaningCharges?: number;
  laundryCharges?: number;
  maintenanceCharges?: number;
  otherCharges?: number;
  discountAmount?: number;
  receivedAmount?: number;
  notes?: string;
  bookingSource?: string;
};

export type HotelUseQuery = {
  tenantId?: string;
  propertyId?: string;
  unitId?: string;
  monthlyTenancyId?: string;
  status?: SettlementStatus | '';
  month?: number | '';
  year?: number | '';
  search?: string;
};
