import type { MonthlyTenant } from './monthly-tenant';

export type MonthlyOccupancyState = 'OCCUPIED' | 'EMPTY';
export type MonthlyTenancyStatus = 'ACTIVE' | 'ENDED' | 'CANCELLED';
export type PaymentDisplayState =
  | 'UNPAID'
  | 'ADVANCE'
  | 'PARTIAL'
  | 'HALF_PAID'
  | 'PAID'
  | 'OVERPAID'
  | 'REFUNDED'
  | 'REVERSED';

export type MonthlyTenancy = {
  id: string;
  tenantId: string;
  agreementId?: string;
  unitId: string;
  agreementStart: string;
  agreementEnd: string | null;
  securityDeposit?: string;
  monthlyRent?: string;
  maintenanceCharges?: string;
  laundryCharges?: string;
  cleaningCharges?: string;
  waterCharges?: string;
  societyCharges?: string;
  electricityCharges?: string;
  otherCharges?: string;
  previousBalance?: string;
  totalPayable?: string;
  totalReceived?: string;
  remainingBalance?: string;
  occupancyState: MonthlyOccupancyState;
  hotelUseAllowed?: boolean;
  tenancyStatus: MonthlyTenancyStatus;
  paymentState: PaymentDisplayState;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  endedAt: string | null;
  electricityReadingRequired?: boolean;
  electricityBillAmount?: string;
  electricityPaidAmount?: string;
  electricityRemainingAmount?: string;
  totalOutstanding?: string;
  agreement?: {
    id: string;
    agreementNumber: string;
    status: string;
    billingDay?: number;
  };
  tenant?: Pick<MonthlyTenant, 'id' | 'fullName' | 'phone'> &
    Partial<
      Pick<
        MonthlyTenant,
        | 'alternatePhone'
        | 'email'
        | 'cnic'
        | 'address'
        | 'emergencyContactName'
        | 'emergencyContactPhone'
        | 'notes'
        | 'isActive'
      >
    >;
  unit?: {
    id: string;
    unitNumber: string;
    unitType?: string;
    floor?: number | null;
    status: string;
    property?: {
      id: string;
      name: string;
    };
  };
};

export type MonthlyTenancySummary = {
  activeMonthlyTenants: number;
  occupiedMonthlyUnits: number;
  emptyMonthlyUnits: number;
  monthlyRentTotal?: string;
  totalReceived?: string;
  remainingBalance?: string;
};

export type EligibleUnit = {
  id: string;
  unitNumber: string;
  unitType: string;
  floor: number | null;
  status: string;
  monthlyRent: string | null;
  propertyId: string;
  property: { id: string; name: string };
};

export type MonthlyTenancyQuery = {
  tenantId?: string;
  propertyId?: string;
  unitId?: string;
  tenancyStatus?: MonthlyTenancyStatus | '';
  occupancyState?: MonthlyOccupancyState | '';
  month?: number | '';
  year?: number | '';
  startDate?: string;
  endDate?: string;
  search?: string;
};

export type MonthlyTenancyInput = {
  tenantId: string;
  agreementId: string;
  propertyId: string;
  unitId: string;
  agreementStart: string;
  agreementEnd?: string;
  securityDeposit?: number;
  monthlyRent: number;
  maintenanceCharges?: number;
  laundryCharges?: number;
  cleaningCharges?: number;
  waterCharges?: number;
  societyCharges?: number;
  electricityCharges?: number;
  otherCharges?: number;
  previousBalance?: number;
  totalReceived?: number;
  allowAdvance?: boolean;
  occupancyState: MonthlyOccupancyState;
  hotelUseAllowed?: boolean;
  notes?: string;
};

export type TenancyFormValues = {
  tenantId: string;
  agreementId: string;
  propertyId: string;
  unitId: string;
  agreementStart: string;
  agreementEnd: string;
  securityDeposit: string;
  monthlyRent: string;
  maintenanceCharges: string;
  laundryCharges: string;
  cleaningCharges: string;
  waterCharges: string;
  societyCharges: string;
  electricityCharges: string;
  otherCharges: string;
  previousBalance: string;
  totalReceived: string;
  allowAdvance: boolean;
  occupancyState: MonthlyOccupancyState | '';
  hotelUseAllowed: boolean;
  notes: string;
};
