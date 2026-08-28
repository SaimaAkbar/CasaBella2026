jest.mock('../../generated/prisma/client', () => ({
  Role: {
    SUPER_ADMIN: 'SUPER_ADMIN',
    ADMIN: 'ADMIN',
    RECEPTIONIST: 'RECEPTIONIST',
  },
}));

import { Role } from '../../generated/prisma/client';
import { canAccessProfitLossData } from '../common/utils/profit-loss-access';

describe('canAccessProfitLossData', () => {
  it('allows Super Admin always', () => {
    expect(canAccessProfitLossData(Role.SUPER_ADMIN, false)).toBe(true);
  });

  it('denies Admin without grant', () => {
    expect(canAccessProfitLossData(Role.ADMIN, false)).toBe(false);
  });

  it('allows Admin with grant', () => {
    expect(canAccessProfitLossData(Role.ADMIN, true)).toBe(true);
  });

  it('denies Receptionist even with flag', () => {
    expect(canAccessProfitLossData(Role.RECEPTIONIST, true)).toBe(false);
  });
});
