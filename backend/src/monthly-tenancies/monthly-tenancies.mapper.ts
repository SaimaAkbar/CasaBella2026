import {
  MonthlyOccupancyState,
  MonthlyTenancyStatus,
  Prisma,
  Role,
} from '../../generated/prisma/client';
import {
  derivePaymentState,
  serializeMoney,
} from './monthly-tenancy.finance';

type TenancyRecord = {
  id: string;
  tenantId: string;
  agreementId?: string;
  unitId: string;
  agreementStart: Date;
  agreementEnd: Date | null;
  securityDeposit: Prisma.Decimal;
  monthlyRent: Prisma.Decimal;
  maintenanceCharges: Prisma.Decimal;
  laundryCharges: Prisma.Decimal;
  cleaningCharges: Prisma.Decimal;
  waterCharges: Prisma.Decimal;
  societyCharges: Prisma.Decimal;
  electricityCharges: Prisma.Decimal;
  otherCharges: Prisma.Decimal;
  previousBalance: Prisma.Decimal;
  totalPayable: Prisma.Decimal;
  totalReceived: Prisma.Decimal;
  remainingBalance: Prisma.Decimal;
  occupancyState: MonthlyOccupancyState;
  hotelUseAllowed: boolean;
  tenancyStatus: MonthlyTenancyStatus;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  endedAt: Date | null;
  agreement?: {
    id: string;
    agreementNumber: string;
    status: string;
    billingDay?: number;
    securityDeposit?: Prisma.Decimal;
  } | null;
  tenant?: {
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
    isActive?: boolean;
  };
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

export function mapTenancyForRole(tenancy: TenancyRecord, role: Role) {
  const paymentState = derivePaymentState(
    tenancy.totalPayable,
    tenancy.totalReceived,
    tenancy.agreementStart,
  );

  const base = {
    id: tenancy.id,
    tenantId: tenancy.tenantId,
    agreementId: tenancy.agreementId ?? tenancy.agreement?.id,
    unitId: tenancy.unitId,
    agreementStart: tenancy.agreementStart,
    agreementEnd: tenancy.agreementEnd,
    occupancyState: tenancy.occupancyState,
    hotelUseAllowed: tenancy.hotelUseAllowed,
    tenancyStatus: tenancy.tenancyStatus,
    notes: tenancy.notes,
    createdAt: tenancy.createdAt,
    updatedAt: tenancy.updatedAt,
    endedAt: tenancy.endedAt,
    paymentState,
    agreement: tenancy.agreement
      ? {
          id: tenancy.agreement.id,
          agreementNumber: tenancy.agreement.agreementNumber,
          status: tenancy.agreement.status,
          billingDay: tenancy.agreement.billingDay,
        }
      : undefined,
    tenant: tenancy.tenant
      ? {
          id: tenancy.tenant.id,
          fullName: tenancy.tenant.fullName,
          phone: tenancy.tenant.phone,
        }
      : undefined,
    unit: tenancy.unit
      ? {
          id: tenancy.unit.id,
          unitNumber: tenancy.unit.unitNumber,
          unitType: tenancy.unit.unitType,
          floor: tenancy.unit.floor ?? null,
          status: tenancy.unit.status,
          property: tenancy.unit.property,
        }
      : undefined,
  };

  if (role === Role.RECEPTIONIST) {
    return base;
  }

  return {
    ...base,
    securityDeposit: serializeMoney(tenancy.securityDeposit),
    monthlyRent: serializeMoney(tenancy.monthlyRent),
    maintenanceCharges: serializeMoney(tenancy.maintenanceCharges),
    laundryCharges: serializeMoney(tenancy.laundryCharges),
    cleaningCharges: serializeMoney(tenancy.cleaningCharges),
    waterCharges: serializeMoney(tenancy.waterCharges),
    societyCharges: serializeMoney(tenancy.societyCharges),
    electricityCharges: serializeMoney(tenancy.electricityCharges),
    otherCharges: serializeMoney(tenancy.otherCharges),
    previousBalance: serializeMoney(tenancy.previousBalance),
    totalPayable: serializeMoney(tenancy.totalPayable),
    totalReceived: serializeMoney(tenancy.totalReceived),
    remainingBalance: serializeMoney(tenancy.remainingBalance),
    tenant: tenancy.tenant
      ? {
          id: tenancy.tenant.id,
          fullName: tenancy.tenant.fullName,
          phone: tenancy.tenant.phone,
          alternatePhone: tenancy.tenant.alternatePhone ?? null,
          email: tenancy.tenant.email ?? null,
          cnic: tenancy.tenant.cnic ?? null,
          address: tenancy.tenant.address ?? null,
          emergencyContactName: tenancy.tenant.emergencyContactName ?? null,
          emergencyContactPhone: tenancy.tenant.emergencyContactPhone ?? null,
          notes: tenancy.tenant.notes ?? null,
          isActive: tenancy.tenant.isActive ?? true,
        }
      : undefined,
  };
}
