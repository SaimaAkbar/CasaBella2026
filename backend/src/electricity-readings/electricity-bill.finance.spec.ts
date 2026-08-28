import {
  computeBaseBill,
  computeFinalBill,
  computeOneTimeLateFine,
  computeUnitsConsumed,
} from './electricity-bill.finance';
import { Prisma } from '../../generated/prisma/client';

describe('electricity bill finance', () => {
  it('computes units and base bill', () => {
    const units = computeUnitsConsumed(
      new Prisma.Decimal(1000),
      new Prisma.Decimal(1100),
    );
    expect(units.toString()).toBe('100');
    const base = computeBaseBill(units, new Prisma.Decimal(95));
    expect(base.toString()).toBe('9500');
  });

  it('applies one-time 5% fine only when overdue and unpaid', () => {
    const base = new Prisma.Decimal(9500);
    const due = new Date('2026-08-15T00:00:00.000Z');
    const beforeDue = computeOneTimeLateFine({
      baseBill: base,
      dueDate: due,
      remainingBeforeFine: base,
      lateFineApplied: false,
      now: new Date('2026-08-10T00:00:00.000Z'),
    });
    expect(beforeDue.shouldApply).toBe(false);

    const afterDue = computeOneTimeLateFine({
      baseBill: base,
      dueDate: due,
      remainingBeforeFine: base,
      lateFineApplied: false,
      now: new Date('2026-08-16T00:00:00.000Z'),
    });
    expect(afterDue.shouldApply).toBe(true);
    expect(afterDue.lateFineAmount.toString()).toBe('475');
    expect(computeFinalBill(base, afterDue.lateFineAmount).toString()).toBe(
      '9975',
    );

    const alreadyApplied = computeOneTimeLateFine({
      baseBill: base,
      dueDate: due,
      remainingBeforeFine: base,
      lateFineApplied: true,
      now: new Date('2026-09-01T00:00:00.000Z'),
    });
    expect(alreadyApplied.shouldApply).toBe(false);
  });
});
