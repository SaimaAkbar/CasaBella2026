import { Prisma } from '../../generated/prisma/client';

type RevisionRow = {
  oldSalary: Prisma.Decimal;
  newSalary: Prisma.Decimal;
  effectiveMonth: number;
  effectiveYear: number;
};

function periodKey(year: number, month: number) {
  return year * 100 + month;
}

/** Resolve base salary for a month using SalaryRevision timeline. */
export function resolveEffectiveSalary(
  currentMonthlySalary: Prisma.Decimal,
  revisions: RevisionRow[],
  salaryMonth: number,
  salaryYear: number,
): Prisma.Decimal {
  if (revisions.length === 0) {
    return currentMonthlySalary;
  }

  const target = periodKey(salaryYear, salaryMonth);
  const sorted = [...revisions].sort(
    (a, b) =>
      periodKey(a.effectiveYear, a.effectiveMonth) -
      periodKey(b.effectiveYear, b.effectiveMonth),
  );

  const future = sorted.filter(
    (row) => periodKey(row.effectiveYear, row.effectiveMonth) > target,
  );
  if (future.length > 0) {
    return future[0].oldSalary;
  }

  const pastOrEqual = sorted.filter(
    (row) => periodKey(row.effectiveYear, row.effectiveMonth) <= target,
  );
  if (pastOrEqual.length > 0) {
    return pastOrEqual[pastOrEqual.length - 1].newSalary;
  }

  return currentMonthlySalary;
}
