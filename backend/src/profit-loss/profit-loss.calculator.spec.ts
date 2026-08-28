jest.mock('../../generated/prisma/client', () => {
  const { Decimal } = require('@prisma/client/runtime/client');
  return {
    Prisma: { Decimal },
    Role: {
      SUPER_ADMIN: 'SUPER_ADMIN',
      ADMIN: 'ADMIN',
      RECEPTIONIST: 'RECEPTIONIST',
    },
  };
});

import { Prisma } from '../../generated/prisma/client';
import {
  buildResult,
  bucketExpenseCategory,
  signedIncomeAmount,
  sumSignedIncome,
} from './profit-loss.calculator';
import { resolveReportingPeriod } from './profit-loss.period';

describe('ProfitLoss calculator', () => {
  it('BREAK_EVEN when no income and no expense', () => {
    expect(buildResult(new Prisma.Decimal(0), new Prisma.Decimal(0))).toEqual({
      netAmount: '0',
      resultType: 'BREAK_EVEN',
    });
  });

  it('PROFIT when income greater than expense', () => {
    expect(
      buildResult(new Prisma.Decimal(1000), new Prisma.Decimal(400)),
    ).toEqual({
      netAmount: '600',
      resultType: 'PROFIT',
    });
  });

  it('LOSS when expense greater than income', () => {
    expect(
      buildResult(new Prisma.Decimal(200), new Prisma.Decimal(500)),
    ).toEqual({
      netAmount: '-300',
      resultType: 'LOSS',
    });
  });

  it('refund reduces income', () => {
    const net = sumSignedIncome([
      {
        transactionType: 'PAYMENT',
        amount: new Prisma.Decimal(1000),
        status: 'COMPLETED',
      },
      {
        transactionType: 'REFUND',
        amount: new Prisma.Decimal(200),
        status: 'COMPLETED',
      },
    ]);
    expect(net.toString()).toBe('800');
  });

  it('reversal reduces income', () => {
    const net = sumSignedIncome([
      {
        transactionType: 'PAYMENT',
        amount: new Prisma.Decimal(500),
        status: 'COMPLETED',
      },
      {
        transactionType: 'REVERSAL',
        amount: new Prisma.Decimal(500),
        status: 'COMPLETED',
      },
    ]);
    expect(net.toString()).toBe('0');
  });

  it('cancelled payment is excluded', () => {
    const signed = signedIncomeAmount({
      transactionType: 'PAYMENT',
      amount: new Prisma.Decimal(900),
      status: 'CANCELLED',
    });
    expect(signed.toString()).toBe('0');
  });

  it('pending payment is excluded', () => {
    const signed = signedIncomeAmount({
      transactionType: 'PAYMENT',
      amount: new Prisma.Decimal(900),
      status: 'PENDING',
    });
    expect(signed.toString()).toBe('0');
  });

  it('positive adjustment increases income', () => {
    const signed = signedIncomeAmount({
      transactionType: 'ADJUSTMENT',
      amount: new Prisma.Decimal(50),
      status: 'COMPLETED',
      notes: 'ADJUSTMENT_DIRECTION:CREDIT; REASON:fix',
    });
    expect(signed.toString()).toBe('50');
  });

  it('debit adjustment decreases income', () => {
    const signed = signedIncomeAmount({
      transactionType: 'ADJUSTMENT',
      amount: new Prisma.Decimal(50),
      status: 'COMPLETED',
      notes: 'ADJUSTMENT_DIRECTION:DEBIT; REASON:fix',
    });
    expect(signed.toString()).toBe('-50');
  });

  it('maps expense categories to buckets', () => {
    expect(bucketExpenseCategory('Rent')).toBe('rent');
    expect(bucketExpenseCategory('Society Bill')).toBe('society');
    expect(bucketExpenseCategory('Repair')).toBe('otherExpenses');
    expect(bucketExpenseCategory('Custom')).toBe('otherExpenses');
  });
});

describe('ProfitLoss period resolution', () => {
  it('uses custom date range first', () => {
    const { period } = resolveReportingPeriod({
      startDate: '2026-01-01',
      endDate: '2026-01-31',
      month: 8,
      year: 2026,
    });
    expect(period.startDate).toBe('2026-01-01');
    expect(period.endDate).toBe('2026-01-31');
  });

  it('uses selected date', () => {
    const { period } = resolveReportingPeriod({ date: '2026-08-02' });
    expect(period.startDate).toBe('2026-08-02');
    expect(period.endDate).toBe('2026-08-02');
  });

  it('uses month and year', () => {
    const { period } = resolveReportingPeriod({ month: 2, year: 2026 });
    expect(period.startDate).toBe('2026-02-01');
    expect(period.endDate).toBe('2026-02-28');
  });

  it('uses full year', () => {
    const { period } = resolveReportingPeriod({ year: 2026 });
    expect(period.startDate).toBe('2026-01-01');
    expect(period.endDate).toBe('2026-12-31');
  });

  it('rejects start after end', () => {
    expect(() =>
      resolveReportingPeriod({
        startDate: '2026-02-01',
        endDate: '2026-01-01',
      }),
    ).toThrow('startDate must not be after endDate');
  });

  it('defaults accounting view to ACCRUAL', () => {
    const { period } = resolveReportingPeriod({ date: '2026-08-02' });
    expect(period.accountingView).toBe('ACCRUAL');
  });
});
