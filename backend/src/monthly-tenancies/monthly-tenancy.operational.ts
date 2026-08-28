import { Prisma } from '../../generated/prisma/client';
import { serializeMoney } from './monthly-tenancy.finance';

export const OPERATIONAL_STATUSES = [
  'RENT_AND_ELECTRICITY_OVERDUE',
  'RENT_OVERDUE',
  'ELECTRICITY_OVERDUE',
  'OVERDUE',
  'PARTIAL',
  'UNPAID',
  'PAID',
] as const;

export type OperationalStatus = (typeof OPERATIONAL_STATUSES)[number];

export const OPERATIONAL_STATUS_FILTERS = [
  'RENT_OVERDUE',
  'ELECTRICITY_OVERDUE',
  'ANY_OUTSTANDING',
] as const;

export type OperationalStatusFilter =
  | (typeof OPERATIONAL_STATUS_FILTERS)[number]
  | 'PAID'
  | 'PARTIAL'
  | 'UNPAID'
  | 'OUTSTANDING';

function toDecimal(value: Prisma.Decimal | number | string | null | undefined) {
  if (value instanceof Prisma.Decimal) return value;
  return new Prisma.Decimal(value ?? 0);
}

export type RentOperational = {
  currentRent: string;
  previousBalance: string;
  totalPayable: string;
  paid: string;
  remaining: string;
  overdue: boolean;
};

export type ElectricityOperational = {
  billId: string | null;
  billingMonth: number;
  billingYear: number;
  finalBill: string | null;
  paid: string;
  remaining: string;
  dueDate: string | null;
  status: string | null;
  readingRequired: boolean;
  lateFine: string;
  expenseId: string | null;
  previousUnits: string | null;
  currentUnits: string | null;
  oldestDuePeriod: string | null;
  outstandingAll: string;
};

export type TenantOperationalSnapshot = {
  rent: RentOperational;
  electricity: ElectricityOperational;
  totalOutstanding: string;
  operationalStatus: OperationalStatus;
  rowOverdue: boolean;
};

export function deriveOperationalStatus(input: {
  rentRemaining: Prisma.Decimal | number | string;
  rentPaid: Prisma.Decimal | number | string;
  rentOverdue: boolean;
  electricityRemaining: Prisma.Decimal | number | string;
  electricityOverdue: boolean;
}): OperationalStatus {
  const rentRemaining = toDecimal(input.rentRemaining);
  const rentPaid = toDecimal(input.rentPaid);
  const electricityRemaining = toDecimal(input.electricityRemaining);
  const rentOverdue = input.rentOverdue && rentRemaining.greaterThan(0);
  const electricityOverdue =
    input.electricityOverdue && electricityRemaining.greaterThan(0);

  if (rentOverdue && electricityOverdue) {
    return 'RENT_AND_ELECTRICITY_OVERDUE';
  }
  if (rentOverdue) return 'RENT_OVERDUE';
  if (electricityOverdue) return 'ELECTRICITY_OVERDUE';

  const total = rentRemaining.plus(electricityRemaining);
  if (total.lessThanOrEqualTo(0)) return 'PAID';
  if (rentPaid.greaterThan(0) || electricityRemaining.greaterThan(0)) {
    if (
      rentPaid.greaterThan(0) &&
      (rentRemaining.greaterThan(0) || electricityRemaining.greaterThan(0))
    ) {
      return 'PARTIAL';
    }
  }
  if (rentPaid.greaterThan(0) && rentRemaining.greaterThan(0)) return 'PARTIAL';
  if (total.greaterThan(0) && rentPaid.greaterThan(0)) return 'PARTIAL';
  return 'UNPAID';
}

export function matchesOperationalFilter(
  snapshot: TenantOperationalSnapshot,
  filter?: string,
): boolean {
  if (!filter) return true;
  const next = filter.trim().toUpperCase();
  if (next === 'ANY_OUTSTANDING') {
    return toDecimal(snapshot.totalOutstanding).greaterThan(0);
  }
  if (next === 'RENT_OVERDUE') {
    return (
      snapshot.operationalStatus === 'RENT_OVERDUE' ||
      snapshot.operationalStatus === 'RENT_AND_ELECTRICITY_OVERDUE'
    );
  }
  if (next === 'ELECTRICITY_OVERDUE') {
    return (
      snapshot.operationalStatus === 'ELECTRICITY_OVERDUE' ||
      snapshot.operationalStatus === 'RENT_AND_ELECTRICITY_OVERDUE'
    );
  }
  if (next === 'OUTSTANDING') {
    return toDecimal(snapshot.totalOutstanding).greaterThan(0);
  }
  if (next === 'PAID' || next === 'PARTIAL' || next === 'UNPAID') {
    return snapshot.operationalStatus === next;
  }
  return true;
}

export function isOperationalStatusFilter(value?: string): boolean {
  if (!value) return false;
  const next = value.trim().toUpperCase();
  return (OPERATIONAL_STATUS_FILTERS as readonly string[]).includes(next);
}

export function buildTenantOperationalSnapshot(input: {
  currentRent: Prisma.Decimal | number | string;
  previousBalance: Prisma.Decimal | number | string;
  totalPayable: Prisma.Decimal | number | string;
  rentPaid: Prisma.Decimal | number | string;
  rentRemaining: Prisma.Decimal | number | string;
  rentOverdue: boolean;
  viewingMonth: number;
  viewingYear: number;
  electricity?: {
    billId: string | null;
    finalBill?: Prisma.Decimal | number | string | null;
    paid?: Prisma.Decimal | number | string;
    remaining?: Prisma.Decimal | number | string;
    dueDate?: Date | string | null;
    status?: string | null;
    readingRequired: boolean;
    lateFine?: Prisma.Decimal | number | string;
    expenseId?: string | null;
    previousUnits?: string | null;
    currentUnits?: string | null;
  };
  electricityOutstandingAll: Prisma.Decimal | number | string;
  electricityOverdue: boolean;
  oldestElectricityDue?: { billingMonth: number; billingYear: number } | null;
}): TenantOperationalSnapshot {
  const rentRemaining = toDecimal(input.rentRemaining);
  const rentPaid = toDecimal(input.rentPaid);
  const electricityRemainingAll = toDecimal(input.electricityOutstandingAll);
  const selectedRemaining = toDecimal(input.electricity?.remaining);
  const totalOutstanding = rentRemaining.plus(electricityRemainingAll);
  const operationalStatus = deriveOperationalStatus({
    rentRemaining,
    rentPaid,
    rentOverdue: input.rentOverdue,
    electricityRemaining: electricityRemainingAll,
    electricityOverdue: input.electricityOverdue,
  });

  return {
    rent: {
      currentRent: serializeMoney(toDecimal(input.currentRent)),
      previousBalance: serializeMoney(toDecimal(input.previousBalance)),
      totalPayable: serializeMoney(toDecimal(input.totalPayable)),
      paid: serializeMoney(rentPaid),
      remaining: serializeMoney(rentRemaining),
      overdue: input.rentOverdue && rentRemaining.greaterThan(0),
    },
    electricity: {
      billId: input.electricity?.billId ?? null,
      billingMonth: input.viewingMonth,
      billingYear: input.viewingYear,
      finalBill:
        input.electricity?.readingRequired || input.electricity?.finalBill == null
          ? null
          : serializeMoney(toDecimal(input.electricity.finalBill)),
      paid: serializeMoney(toDecimal(input.electricity?.paid)),
      remaining: serializeMoney(selectedRemaining),
      dueDate: input.electricity?.dueDate
        ? new Date(input.electricity.dueDate).toISOString()
        : null,
      status: input.electricity?.status ?? null,
      readingRequired: Boolean(input.electricity?.readingRequired),
      lateFine: serializeMoney(toDecimal(input.electricity?.lateFine)),
      expenseId: input.electricity?.expenseId ?? null,
      previousUnits: input.electricity?.previousUnits ?? null,
      currentUnits: input.electricity?.currentUnits ?? null,
      oldestDuePeriod: input.oldestElectricityDue
        ? `${input.oldestElectricityDue.billingYear}-${String(
            input.oldestElectricityDue.billingMonth,
          ).padStart(2, '0')}`
        : null,
      outstandingAll: serializeMoney(electricityRemainingAll),
    },
    totalOutstanding: serializeMoney(totalOutstanding),
    operationalStatus,
    rowOverdue:
      (input.rentOverdue && rentRemaining.greaterThan(0)) ||
      (input.electricityOverdue && electricityRemainingAll.greaterThan(0)),
  };
}
