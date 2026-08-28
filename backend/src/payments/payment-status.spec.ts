import { Prisma } from '../../generated/prisma/client';
import {
  deriveDisplayPaymentStatus,
  deriveLedgerPaymentState,
} from './payment-status';

jest.mock('../../generated/prisma/client', () => {
  const { Decimal } = require('@prisma/client/runtime/client');
  return {
    Prisma: { Decimal },
    PaymentState: {
      UNPAID: 'UNPAID',
      PARTIAL: 'PARTIAL',
      PAID: 'PAID',
      OVERPAID: 'OVERPAID',
      REFUNDED: 'REFUNDED',
      REVERSED: 'REVERSED',
    },
  };
});

describe('payment status from ledger totals', () => {
  it('monthly 50000 with 20000 paid is PARTIAL remaining 30000', () => {
    const total = new Prisma.Decimal(50000);
    const received = new Prisma.Decimal(20000);
    const remaining = total.minus(received);
    expect(remaining.toString()).toBe('30000');
    expect(
      deriveLedgerPaymentState({
        totalPayable: total,
        totalReceived: received,
      }),
    ).toBe('PARTIAL');
    expect(
      deriveDisplayPaymentStatus({
        totalPayable: total,
        totalReceived: received,
        remaining,
        overdue: false,
      }),
    ).toBe('PARTIAL');
  });

  it('second installment completing the bill is PAID remaining 0', () => {
    const total = new Prisma.Decimal(50000);
    const received = new Prisma.Decimal(50000);
    const remaining = total.minus(received);
    expect(remaining.toString()).toBe('0');
    expect(
      deriveLedgerPaymentState({
        totalPayable: total,
        totalReceived: received,
      }),
    ).toBe('PAID');
  });

  it('guest bill 15000 paid 5000 is PARTIAL remaining 10000', () => {
    const total = new Prisma.Decimal(15000);
    const received = new Prisma.Decimal(50000).minus(45000);
    const remaining = total.minus(received);
    expect(received.toString()).toBe('5000');
    expect(remaining.toString()).toBe('10000');
    expect(
      deriveDisplayPaymentStatus({
        totalPayable: total,
        totalReceived: received,
        remaining,
        overdue: false,
      }),
    ).toBe('PARTIAL');
  });

  it('zero received is UNPAID, overdue remaining is OVERDUE', () => {
    expect(
      deriveDisplayPaymentStatus({
        totalPayable: 50000,
        totalReceived: 0,
        remaining: 50000,
        overdue: false,
      }),
    ).toBe('UNPAID');
    expect(
      deriveDisplayPaymentStatus({
        totalPayable: 50000,
        totalReceived: 20000,
        remaining: 30000,
        overdue: true,
      }),
    ).toBe('OVERDUE');
  });
});
