import { calculateSettlementShares } from './settlement-calculation';
import { Role, SettlementType } from '../../generated/prisma/client';

describe('calculateSettlementShares', () => {
  it('FIXED_AMOUNT derives organizationShare from total and tenantShare', () => {
    const result = calculateSettlementShares({
      settlementType: SettlementType.FIXED_AMOUNT,
      totalGuestCharge: 10000,
      tenantShare: 3000,
      role: Role.ADMIN,
    });
    expect(result.tenantShare.toString()).toBe('3000');
    expect(result.organizationShare.toString()).toBe('7000');
    expect(result.rentCreditAmount.toString()).toBe('0');
  });

  it('FIXED_AMOUNT rejects tenantShare above total', () => {
    expect(() =>
      calculateSettlementShares({
        settlementType: SettlementType.FIXED_AMOUNT,
        totalGuestCharge: 1000,
        tenantShare: 1001,
        role: Role.ADMIN,
      }),
    ).toThrow(/cannot exceed/);
  });

  it('PERCENTAGE requires shares totaling 100', () => {
    expect(() =>
      calculateSettlementShares({
        settlementType: SettlementType.PERCENTAGE,
        totalGuestCharge: 10000,
        tenantSharePercentage: 40,
        organizationSharePercentage: 50,
        role: Role.ADMIN,
      }),
    ).toThrow(/must total 100/);
  });

  it('PERCENTAGE calculates both shares from percentages', () => {
    const result = calculateSettlementShares({
      settlementType: SettlementType.PERCENTAGE,
      totalGuestCharge: 10000,
      tenantSharePercentage: 40,
      organizationSharePercentage: 60,
      role: Role.ADMIN,
    });
    expect(result.tenantShare.toString()).toBe('4000');
    expect(result.organizationShare.toString()).toBe('6000');
  });

  it('NO_TENANT_SHARE assigns full charge to organization', () => {
    const result = calculateSettlementShares({
      settlementType: SettlementType.NO_TENANT_SHARE,
      totalGuestCharge: 8500.5,
      role: Role.RECEPTIONIST,
    });
    expect(result.tenantShare.toString()).toBe('0');
    expect(result.organizationShare.toString()).toBe('8500.5');
  });

  it('RENT_CREDIT stores tenant share as rentCreditAmount', () => {
    const result = calculateSettlementShares({
      settlementType: SettlementType.RENT_CREDIT,
      totalGuestCharge: 12000,
      tenantShare: 2000,
      role: Role.SUPER_ADMIN,
    });
    expect(result.rentCreditAmount.toString()).toBe('2000');
    expect(result.organizationShare.toString()).toBe('10000');
  });

  it('CUSTOM requires Super Admin and mandatory reason', () => {
    expect(() =>
      calculateSettlementShares({
        settlementType: SettlementType.CUSTOM,
        totalGuestCharge: 1000,
        tenantShare: 400,
        organizationShare: 600,
        role: Role.ADMIN,
      }),
    ).toThrow(/Super Admin/);

    expect(() =>
      calculateSettlementShares({
        settlementType: SettlementType.CUSTOM,
        totalGuestCharge: 1000,
        tenantShare: 400,
        organizationShare: 600,
        role: Role.SUPER_ADMIN,
      }),
    ).toThrow(/reason is required/);
  });

  it('CUSTOM requires shares to equal total', () => {
    expect(() =>
      calculateSettlementShares({
        settlementType: SettlementType.CUSTOM,
        totalGuestCharge: 1000,
        tenantShare: 400,
        organizationShare: 500,
        reason: 'special deal',
        role: Role.SUPER_ADMIN,
      }),
    ).toThrow(/must equal totalGuestCharge/);
  });
});
