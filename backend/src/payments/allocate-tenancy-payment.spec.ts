import { Prisma } from '../../generated/prisma/client';
import { allocateOldestDueFirst } from './allocate-tenancy-payment';

jest.mock('../../generated/prisma/client', () => {
  const { Decimal } = require('@prisma/client/runtime/client');
  return { Prisma: { Decimal } };
});

describe('allocateOldestDueFirst', () => {
  it('splits 15000 across July 10000 then August 5000', () => {
    const slices = allocateOldestDueFirst(new Prisma.Decimal(15000), [
      { id: 'july', remainingBalance: new Prisma.Decimal(10000) },
      { id: 'august', remainingBalance: new Prisma.Decimal(20000) },
    ]);
    expect(slices).toHaveLength(2);
    expect(slices[0]).toEqual({
      monthlyBillId: 'july',
      amount: new Prisma.Decimal(10000),
    });
    expect(slices[1]).toEqual({
      monthlyBillId: 'august',
      amount: new Prisma.Decimal(5000),
    });
  });

  it('does not skip an older bill just because current month can take the full amount', () => {
    const slices = allocateOldestDueFirst(new Prisma.Decimal(15000), [
      { id: 'july', remainingBalance: new Prisma.Decimal(10000) },
      { id: 'august', remainingBalance: new Prisma.Decimal(20000) },
    ]);
    expect(slices[0]?.monthlyBillId).toBe('july');
    expect(slices.some((slice) => slice.monthlyBillId === 'august')).toBe(true);
  });
});
