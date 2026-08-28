import type { MonthlyOccupancyState, MonthlyTenancyStatus } from './monthly-tenancy';

export type TenantTenancySummary = {
  id: string;
  tenantId: string;
  unitId: string;
  agreementStart: string;
  agreementEnd: string | null;
  occupancyState: MonthlyOccupancyState;
  tenancyStatus: MonthlyTenancyStatus;
  monthlyRent?: string;
  endedAt: string | null;
  createdAt: string;
  unit?: {
    id: string;
    unitNumber: string;
    status: string;
    property?: {
      id: string;
      name: string;
    };
  };
};

export type MonthlyTenant = {
  id: string;
  fullName: string;
  phone: string;
  alternatePhone?: string | null;
  email?: string | null;
  cnic?: string | null;
  address?: string | null;
  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;
  notes?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  tenancyCount?: number;
  /** Sum of monthlyRent on ACTIVE assignments (admins / super admins). */
  currentMonthlyRentTotal?: string;
  currentTenancy?: TenantTenancySummary | null;
  tenancies?: TenantTenancySummary[];
  activeAgreement?: {
    id: string;
    agreementNumber: string;
    agreementStart: string;
    agreementEnd: string | null;
    billingDay: number;
    securityDeposit: string;
    status: string;
    notes?: string | null;
  } | null;
};

export type MonthlyTenantInput = {
  fullName: string;
  phone: string;
  alternatePhone?: string;
  email?: string;
  cnic?: string;
  address?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  notes?: string;
};

export type MonthlyTenantFormValues = {
  fullName: string;
  phone: string;
  alternatePhone: string;
  email: string;
  cnic: string;
  address: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  notes: string;
};

export type MonthlyTenantQuery = {
  search?: string;
  isActive?: boolean;
};
