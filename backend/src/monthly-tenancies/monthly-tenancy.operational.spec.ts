import { Prisma } from '../../generated/prisma/client';
import {
  buildTenantOperationalSnapshot,
  deriveOperationalStatus,
  matchesOperationalFilter,
} from './monthly-tenancy.operational';

jest.mock('../../generated/prisma/client', () => {
  const { Decimal } = require('@prisma/client/runtime/client');
  return { Prisma: { Decimal } };
});

describe('tenant operational totals', () => {
  it('totalOutstanding is remaining rent + remaining electricity, not full bills', () => {
    const snapshot = buildTenantOperationalSnapshot({
      currentRent: 50000,
      previousBalance: 20000,
      totalPayable: 70000,
      rentPaid: 30000,
      rentRemaining: 20000,
      rentOverdue: true,
      viewingMonth: 8,
      viewingYear: 2026,
      electricity: {
        billId: 'e1',
        finalBill: 11400,
        paid: 5000,
        remaining: 6400,
        readingRequired: false,
        lateFine: 0,
        status: 'PARTIAL',
      },
      electricityOutstandingAll: 6400,
      electricityOverdue: true,
    });

    expect(snapshot.totalOutstanding).toBe('26400');
    expect(snapshot.rent.remaining).toBe('20000');
    expect(snapshot.electricity.remaining).toBe('6400');
    expect(snapshot.operationalStatus).toBe('RENT_AND_ELECTRICITY_OVERDUE');
    expect(snapshot.rowOverdue).toBe(true);
  });

  it('reading required does not look like a zero bill', () => {
    const snapshot = buildTenantOperationalSnapshot({
      currentRent: 50000,
      previousBalance: 0,
      totalPayable: 50000,
      rentPaid: 50000,
      rentRemaining: 0,
      rentOverdue: false,
      viewingMonth: 8,
      viewingYear: 2026,
      electricity: {
        billId: 'e2',
        readingRequired: true,
      },
      electricityOutstandingAll: 0,
      electricityOverdue: false,
    });

    expect(snapshot.electricity.readingRequired).toBe(true);
    expect(snapshot.electricity.finalBill).toBeNull();
    expect(snapshot.operationalStatus).toBe('PAID');
    expect(snapshot.rowOverdue).toBe(false);
  });

  it('row stays overdue if rent is cleared but electricity remaining is overdue', () => {
    const status = deriveOperationalStatus({
      rentRemaining: 0,
      rentPaid: 50000,
      rentOverdue: false,
      electricityRemaining: 6500,
      electricityOverdue: true,
    });
    expect(status).toBe('ELECTRICITY_OVERDUE');
  });

  it('operational filters match combined overdue rows', () => {
    const snapshot = buildTenantOperationalSnapshot({
      currentRent: 50000,
      previousBalance: 20000,
      totalPayable: 70000,
      rentPaid: 30000,
      rentRemaining: 20000,
      rentOverdue: true,
      viewingMonth: 8,
      viewingYear: 2026,
      electricityOutstandingAll: 6500,
      electricityOverdue: true,
    });
    expect(matchesOperationalFilter(snapshot, 'RENT_OVERDUE')).toBe(true);
    expect(matchesOperationalFilter(snapshot, 'ELECTRICITY_OVERDUE')).toBe(true);
    expect(matchesOperationalFilter(snapshot, 'ANY_OUTSTANDING')).toBe(true);
    expect(matchesOperationalFilter(snapshot, 'PAID')).toBe(false);
  });

  it('current-month unpaid without overdue is UNPAID not red', () => {
    const snapshot = buildTenantOperationalSnapshot({
      currentRent: 50000,
      previousBalance: 0,
      totalPayable: 50000,
      rentPaid: 0,
      rentRemaining: 50000,
      rentOverdue: false,
      viewingMonth: 8,
      viewingYear: 2026,
      electricityOutstandingAll: 0,
      electricityOverdue: false,
    });
    expect(snapshot.operationalStatus).toBe('UNPAID');
    expect(snapshot.rowOverdue).toBe(false);
  });
});
