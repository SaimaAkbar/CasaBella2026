import type { ElectricityReading } from '../types/expense';
import type { MonthlyTenancy } from '../types/monthly-tenancy';

export function money(value: string | number | null | undefined): number {
  const amount = Number(value ?? 0);
  return Number.isNaN(amount) ? 0 : amount;
}

export type FinanceStatus =
  | 'PAID'
  | 'PARTIAL'
  | 'OVERDUE'
  | 'RENT_AND_ELECTRICITY_OVERDUE'
  | 'UNPAID';

export type AssignmentFinance = {
  monthlyRent: number;
  previousDue: number;
  rentPaid: number;
  rentRemaining: number;
  electricityBill: number | null;
  electricityPaid: number | null;
  electricityRemaining: number | null;
  readingRequired: boolean;
  electricityReadingId?: string;
  rentOverdue: boolean;
  electricityOverdue: boolean;
  totalOutstanding: number;
  status: FinanceStatus;
  paidRow: boolean;
  overdueRow: boolean;
};

function periodDue(year: number, month: number, billingDay?: number): Date {
  const lastDay = new Date(year, month, 0).getDate();
  const day = Math.min(Math.max(billingDay ?? lastDay, 1), lastDay);
  return new Date(year, month - 1, day, 23, 59, 59, 999);
}

function isOverdue(due: Date | null, remaining: number, now: Date): boolean {
  if (remaining <= 0) return false;
  if (!due) return false;
  return now.getTime() > due.getTime();
}

export function buildAssignmentFinance(
  tenancy: MonthlyTenancy,
  reading: ElectricityReading | undefined,
  viewYear: number,
  viewMonth: number,
  now = new Date(),
): AssignmentFinance {
  const monthlyRent = money(tenancy.monthlyRent);
  const previousDue = money(tenancy.previousBalance);
  const rentPaid = money(tenancy.totalReceived);
  const rentRemaining = Math.max(0, money(tenancy.remainingBalance));
  const rentDueDate = periodDue(
    viewYear,
    viewMonth,
    tenancy.agreement?.billingDay,
  );
  const rentOverdue = isOverdue(rentDueDate, rentRemaining, now);

  const currentMissing = reading != null && reading.currentUnits == null;
  const readingRequired = !reading || currentMissing;
  const billAmount = readingRequired
    ? null
    : money(reading?.expense?.amount ?? reading?.calculatedAmount);
  const electricityPaid = readingRequired
    ? null
    : money(reading?.expense?.paidAmount);
  const electricityRemaining = readingRequired
    ? null
    : money(reading?.expense?.remainingAmount);
  const elecDueRaw = reading?.dueDate ?? reading?.expense?.dueDate ?? null;
  const elecDue = elecDueRaw ? new Date(elecDueRaw) : null;
  const electricityOverdue = isOverdue(
    elecDue,
    electricityRemaining ?? 0,
    now,
  );

  const totalOutstanding = rentRemaining + (electricityRemaining ?? 0);
  const paidRow =
    rentRemaining === 0 &&
    (electricityRemaining ?? 0) === 0 &&
    previousDue <= 0 &&
    !readingRequired;
  const overdueRow = rentOverdue || electricityOverdue;

  let status: FinanceStatus = 'UNPAID';
  if (overdueRow && rentOverdue && electricityOverdue) {
    status = 'RENT_AND_ELECTRICITY_OVERDUE';
  } else if (overdueRow) {
    status = 'OVERDUE';
  } else if (paidRow) {
    status = 'PAID';
  } else if (rentPaid > 0 || (electricityPaid ?? 0) > 0) {
    status = 'PARTIAL';
  }

  return {
    monthlyRent,
    previousDue,
    rentPaid,
    rentRemaining,
    electricityBill: billAmount,
    electricityPaid,
    electricityRemaining,
    readingRequired,
    electricityReadingId: reading?.id,
    rentOverdue,
    electricityOverdue,
    totalOutstanding,
    status,
    paidRow,
    overdueRow,
  };
}

export function readingByUnitId(
  readings: ElectricityReading[],
): Map<string, ElectricityReading> {
  const map = new Map<string, ElectricityReading>();
  for (const reading of readings) {
    if (reading.unitId && !map.has(reading.unitId)) {
      map.set(reading.unitId, reading);
    }
  }
  return map;
}
