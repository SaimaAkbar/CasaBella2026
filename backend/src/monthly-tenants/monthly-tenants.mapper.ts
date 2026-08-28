import {
  MonthlyOccupancyState,
  MonthlyTenancyStatus,
  Role,
} from '../../generated/prisma/client';

type UnitSummary = {
  id: string;
  unitNumber: string;
  status: string;
  property?: { id: string; name: string } | null;
};

type TenancySummaryRecord = {
  id: string;
  tenantId: string;
  unitId: string;
  agreementStart: Date;
  agreementEnd: Date | null;
  occupancyState: MonthlyOccupancyState;
  tenancyStatus: MonthlyTenancyStatus;
  endedAt: Date | null;
  createdAt: Date;
  unit?: UnitSummary | null;
};

export type TenantRecord = {
  id: string;
  fullName: string;
  phone: string;
  alternatePhone: string | null;
  email: string | null;
  cnic: string | null;
  address: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  notes: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  tenancies?: TenancySummaryRecord[];
  _count?: { tenancies: number };
};

function mapTenancySummary(tenancy: TenancySummaryRecord) {
  return {
    id: tenancy.id,
    tenantId: tenancy.tenantId,
    unitId: tenancy.unitId,
    agreementStart: tenancy.agreementStart,
    agreementEnd: tenancy.agreementEnd,
    occupancyState: tenancy.occupancyState,
    tenancyStatus: tenancy.tenancyStatus,
    endedAt: tenancy.endedAt,
    createdAt: tenancy.createdAt,
    unit: tenancy.unit
      ? {
          id: tenancy.unit.id,
          unitNumber: tenancy.unit.unitNumber,
          status: tenancy.unit.status,
          property: tenancy.unit.property ?? undefined,
        }
      : undefined,
  };
}

function pickCurrentTenancy(tenancies: TenancySummaryRecord[] | undefined) {
  if (!tenancies?.length) return null;
  const active = tenancies.find(
    (row) => row.tenancyStatus === MonthlyTenancyStatus.ACTIVE,
  );
  return active ?? tenancies[0] ?? null;
}

export function mapTenantForRole(tenant: TenantRecord, role: Role) {
  const tenancyCount =
    tenant._count?.tenancies ?? tenant.tenancies?.length ?? 0;
  const current = pickCurrentTenancy(tenant.tenancies);
  const currentTenancy = current ? mapTenancySummary(current) : null;
  const history = tenant.tenancies?.map(mapTenancySummary);

  if (role === Role.RECEPTIONIST) {
    return {
      id: tenant.id,
      fullName: tenant.fullName,
      phone: tenant.phone,
      isActive: tenant.isActive,
      createdAt: tenant.createdAt,
      updatedAt: tenant.updatedAt,
      tenancyCount,
      currentTenancy,
      ...(history ? { tenancies: history } : {}),
    };
  }

  return {
    id: tenant.id,
    fullName: tenant.fullName,
    phone: tenant.phone,
    alternatePhone: tenant.alternatePhone,
    email: tenant.email,
    cnic: tenant.cnic,
    address: tenant.address,
    emergencyContactName: tenant.emergencyContactName,
    emergencyContactPhone: tenant.emergencyContactPhone,
    notes: tenant.notes,
    isActive: tenant.isActive,
    createdAt: tenant.createdAt,
    updatedAt: tenant.updatedAt,
    tenancyCount,
    currentTenancy,
    ...(history ? { tenancies: history } : {}),
  };
}
