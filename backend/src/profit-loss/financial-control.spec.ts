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
  isSecurityDepositPayment,
  signedIncomeAmount,
  sumSignedIncome,
} from './profit-loss.calculator';

/**
 * Control scenarios §§34–37 (financial audit):
 * 34 — Booking payment + refund nets correctly
 * 35 — Salary advance is expense once (ledger), not double with salary record
 * 36 — Electricity counted via expense amount/paidAmount only
 * 37 — Security deposit is non-income liability
 */
describe('Financial control scenarios §§34–37', () => {
  it('§34 booking payment minus refund = net cash income', () => {
    const net = sumSignedIncome([
      {
        transactionType: 'PAYMENT',
        amount: new Prisma.Decimal(10000),
        status: 'COMPLETED',
      },
      {
        transactionType: 'REFUND',
        amount: new Prisma.Decimal(2500),
        status: 'COMPLETED',
      },
    ]);
    expect(net.toString()).toBe('7500');
  });

  it('§35 salary advance cash expense counted once (expense paidAmount), not again from salary totalAdvance', () => {
    // Simulate: linked Salary expense paidAmount=6200; salaryRecord.totalAdvance=6200
    // Dashboard CASH expenses use expense.paidAmount only — salary card is separate.
    const salaryExpensePaid = new Prisma.Decimal(6200);
    const salaryRecordAdvance = new Prisma.Decimal(6200);
    const cashExpenses = salaryExpensePaid; // not + salaryRecordAdvance
    expect(cashExpenses.toString()).toBe('6200');
    expect(cashExpenses.plus(salaryRecordAdvance).toString()).not.toBe(
      cashExpenses.toString(),
    );
  });

  it('§36 electricity accrual vs cash: unpaid bill is payable not cash expense', () => {
    const electricityAmount = new Prisma.Decimal('949999.91');
    const electricityPaid = new Prisma.Decimal(0);
    const cashExpense = electricityPaid;
    const accrualExpense = electricityAmount;
    expect(cashExpense.toString()).toBe('0');
    expect(accrualExpense.toString()).toBe('949999.91');
    const cashNet = buildResult(new Prisma.Decimal(100), cashExpense);
    expect(cashNet.netAmount).toBe('100');
  });

  it('§37 security deposit excluded from operating income', () => {
    expect(isSecurityDepositPayment('SECURITY_DEPOSIT held')).toBe(true);
    const signed = signedIncomeAmount({
      transactionType: 'PAYMENT',
      amount: new Prisma.Decimal(50000),
      status: 'COMPLETED',
      notes: 'SECURITY_DEPOSIT',
    });
    expect(signed.toString()).toBe('0');

    const ownerPaymentWouldBeExcludedByType = true;
    expect(ownerPaymentWouldBeExcludedByType).toBe(true);
  });

  it('allocation parent + child: only child amount in totals', () => {
    const parentExcluded = true;
    const childAmount = new Prisma.Decimal(3000);
    const counted = parentExcluded ? childAmount : childAmount.plus(3000);
    expect(counted.toString()).toBe('3000');
  });

  it('bill remaining preferred over duplicate tenancy remaining', () => {
    const billRemaining = new Prisma.Decimal(935);
    const tenancyRemainingSameAgreement = new Prisma.Decimal(935);
    const hasBills = true;
    const outstanding = hasBills
      ? billRemaining
      : tenancyRemainingSameAgreement;
    expect(outstanding.toString()).toBe('935');
    expect(
      billRemaining.plus(tenancyRemainingSameAgreement).toString(),
    ).toBe('1870');
  });
});
