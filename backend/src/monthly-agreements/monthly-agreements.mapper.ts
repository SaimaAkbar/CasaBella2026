import { Prisma, Role } from '../../generated/prisma/client';

function money(value: Prisma.Decimal | null | undefined): string {
  return value?.toString() ?? '0';
}

type AssignmentRow = {
  id: string;
  unitId: string;
  monthlyRent: Prisma.Decimal;
  occupancyState: string;
  hotelUseAllowed: boolean;
  tenancyStatus: string;
  agreementStart: Date;
  agreementEnd: Date | null;
  endedAt: Date | null;
  unit?: {
    id: string;
    unitNumber: string;
    unitType: string;
    floor: number | null;
    status: string;
    property?: { id: string; name: string } | null;
  } | null;
};

type BillRow = {
  id: string;
  billingMonth: number;
  billingYear: number;
  totalPayable: Prisma.Decimal;
  totalReceived: Prisma.Decimal;
  remainingBalance: Prisma.Decimal;
  paymentStatus: string;
  dueDate: Date;
};

export type AgreementRecord = {
  id: string;
  tenantId: string;
  agreementNumber: string;
  agreementStart: Date;
  agreementEnd: Date | null;
  billingDay: number;
  securityDeposit: Prisma.Decimal;
  status: string;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  endedAt: Date | null;
  tenant?: {
    id: string;
    fullName: string;
    phone: string;
    cnic?: string | null;
  };
  assignments?: AssignmentRow[];
  bills?: BillRow[];
  _count?: { assignments: number };
};

export function mapAgreementForRole(row: AgreementRecord, role: Role) {
  const activeAssignments =
    row.assignments?.filter((a) => a.tenancyStatus === 'ACTIVE') ?? [];
  const monthlyRentTotal = activeAssignments.reduce(
    (sum, a) => sum.plus(a.monthlyRent),
    new Prisma.Decimal(0),
  );
  const currentBill = row.bills?.[0] ?? null;

  const base = {
    id: row.id,
    tenantId: row.tenantId,
    agreementNumber: row.agreementNumber,
    agreementStart: row.agreementStart,
    agreementEnd: row.agreementEnd,
    billingDay: row.billingDay,
    status: row.status,
    notes: row.notes,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    endedAt: row.endedAt,
    assignmentCount:
      row._count?.assignments ?? row.assignments?.length ?? 0,
    activeAssignmentCount: activeAssignments.length,
    tenant: row.tenant
      ? {
          id: row.tenant.id,
          fullName: row.tenant.fullName,
          phone: row.tenant.phone,
          ...(role === Role.RECEPTIONIST
            ? {}
            : { cnic: row.tenant.cnic ?? null }),
        }
      : undefined,
    assignments: row.assignments?.map((a) => ({
      id: a.id,
      unitId: a.unitId,
      occupancyState: a.occupancyState,
      hotelUseAllowed: a.hotelUseAllowed,
      tenancyStatus: a.tenancyStatus,
      agreementStart: a.agreementStart,
      agreementEnd: a.agreementEnd,
      endedAt: a.endedAt,
      ...(role === Role.RECEPTIONIST
        ? {}
        : { monthlyRent: money(a.monthlyRent) }),
      unit: a.unit
        ? {
            id: a.unit.id,
            unitNumber: a.unit.unitNumber,
            unitType: a.unit.unitType,
            floor: a.unit.floor,
            status: a.unit.status,
            property: a.unit.property ?? undefined,
          }
        : undefined,
    })),
  };

  if (role === Role.RECEPTIONIST) {
    return base;
  }

  return {
    ...base,
    securityDeposit: money(row.securityDeposit),
    monthlyRentTotal: money(monthlyRentTotal),
    currentBill: currentBill
      ? {
          id: currentBill.id,
          billingMonth: currentBill.billingMonth,
          billingYear: currentBill.billingYear,
          totalPayable: money(currentBill.totalPayable),
          totalReceived: money(currentBill.totalReceived),
          remainingBalance: money(currentBill.remainingBalance),
          paymentStatus: currentBill.paymentStatus,
          dueDate: currentBill.dueDate,
        }
      : null,
  };
}
