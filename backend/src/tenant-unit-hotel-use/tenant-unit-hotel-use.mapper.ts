import {
  Prisma,
  Role,
  SettlementStatus,
  SettlementType,
} from '../../generated/prisma/client';
import { serializeSettlementMoney } from './settlement-calculation';

type HotelUseRecord = {
  id: string;
  monthlyTenancyId: string;
  bookingId: string | null;
  settlementType: SettlementType;
  totalGuestCharge: { toString(): string };
  tenantShare: { toString(): string };
  organizationShare: { toString(): string };
  tenantSharePercentage: { toString(): string } | null;
  organizationSharePercentage: { toString(): string } | null;
  rentCreditAmount: { toString(): string };
  status: SettlementStatus;
  reason: string | null;
  billingMonth: number | null;
  billingYear: number | null;
  createdByUserId: string;
  approvedByUserId: string | null;
  approvedAt: Date | null;
  settledAt: Date | null;
  cancelledAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: { id: string; fullName: string; role: Role };
  approvedBy?: { id: string; fullName: string; role: Role } | null;
  monthlyTenancy?: {
    id: string;
    tenantId: string;
    unitId: string;
    hotelUseAllowed: boolean;
    occupancyState: string;
    tenancyStatus: string;
    monthlyRent: { toString(): string };
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
  booking?: {
    id: string;
    bookingNumber: string;
    bookingStatus: string;
    occupancySource: string;
    checkInDateTime: Date;
    checkOutDateTime: Date;
    guest?: { id: string; fullName: string; phone: string };
  } | null;
  rentCredits?: Array<{
    id: string;
    amount: { toString(): string };
    billingMonth: number;
    billingYear: number;
    reason: string;
    creditDate: Date;
    paymentId: string | null;
  }>;
};

function money(value: { toString(): string }) {
  return serializeSettlementMoney(new Prisma.Decimal(value.toString()));
}

export function mapHotelUseForRole(record: HotelUseRecord, role: Role) {
  const base = {
    id: record.id,
    monthlyTenancyId: record.monthlyTenancyId,
    tenantUnitAssignmentId: record.monthlyTenancyId,
    bookingId: record.bookingId,
    settlementType: record.settlementType,
    status: record.status,
    reason: record.reason,
    billingMonth: record.billingMonth,
    billingYear: record.billingYear,
    createdByUserId: record.createdByUserId,
    approvedByUserId: record.approvedByUserId,
    approvedAt: record.approvedAt,
    settledAt: record.settledAt,
    cancelledAt: record.cancelledAt,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    createdBy: record.createdBy
      ? {
          id: record.createdBy.id,
          fullName: record.createdBy.fullName,
          role: record.createdBy.role,
        }
      : undefined,
    approvedBy: record.approvedBy
      ? {
          id: record.approvedBy.id,
          fullName: record.approvedBy.fullName,
          role: record.approvedBy.role,
        }
      : null,
    monthlyTenancy: record.monthlyTenancy
      ? {
          id: record.monthlyTenancy.id,
          tenantId: record.monthlyTenancy.tenantId,
          unitId: record.monthlyTenancy.unitId,
          hotelUseAllowed: record.monthlyTenancy.hotelUseAllowed,
          occupancyState: record.monthlyTenancy.occupancyState,
          tenancyStatus: record.monthlyTenancy.tenancyStatus,
          tenant: record.monthlyTenancy.tenant,
          unit: record.monthlyTenancy.unit,
        }
      : undefined,
    booking: record.booking
      ? {
          id: record.booking.id,
          bookingNumber: record.booking.bookingNumber,
          bookingStatus: record.booking.bookingStatus,
          occupancySource: record.booking.occupancySource,
          checkInDateTime: record.booking.checkInDateTime,
          checkOutDateTime: record.booking.checkOutDateTime,
          guest: record.booking.guest,
        }
      : null,
  };

  if (role === Role.RECEPTIONIST) {
    return {
      ...base,
      // Operational only — hide share finance
      totalGuestCharge: undefined,
      tenantShare: undefined,
      organizationShare: undefined,
      rentCreditAmount: undefined,
      tenantSharePercentage: undefined,
      organizationSharePercentage: undefined,
      rentCredits: undefined,
    };
  }

  return {
    ...base,
    totalGuestCharge: money(record.totalGuestCharge),
    tenantShare: money(record.tenantShare),
    organizationShare: money(record.organizationShare),
    tenantSharePercentage: record.tenantSharePercentage
      ? money(record.tenantSharePercentage)
      : null,
    organizationSharePercentage: record.organizationSharePercentage
      ? money(record.organizationSharePercentage)
      : null,
    rentCreditAmount: money(record.rentCreditAmount),
    monthlyTenancy: record.monthlyTenancy
      ? {
          ...base.monthlyTenancy!,
          monthlyRent: money(record.monthlyTenancy.monthlyRent),
        }
      : undefined,
    rentCredits: (record.rentCredits ?? []).map((row) => ({
      id: row.id,
      amount: money(row.amount),
      billingMonth: row.billingMonth,
      billingYear: row.billingYear,
      reason: row.reason,
      creditDate: row.creditDate,
      paymentId: row.paymentId,
    })),
  };
}
