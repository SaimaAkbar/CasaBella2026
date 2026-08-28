jest.mock('../../generated/prisma/client', () => ({
  Role: {
    SUPER_ADMIN: 'SUPER_ADMIN',
    ADMIN: 'ADMIN',
    RECEPTIONIST: 'RECEPTIONIST',
  },
}));

import { Role } from '../../generated/prisma/client';
import {
  canAccessReport,
  listReportCatalog,
} from './report-permissions';

describe('report permissions', () => {
  it('allows Super Admin all catalog items', () => {
    const catalog = listReportCatalog({
      role: Role.SUPER_ADMIN,
      canAccessSalary: false,
      canAccessProfitLoss: false,
    });
    expect(catalog.length).toBeGreaterThan(10);
    expect(
      canAccessReport('audit-logs', {
        role: Role.SUPER_ADMIN,
        canAccessSalary: false,
        canAccessProfitLoss: false,
      }),
    ).toBe(true);
  });

  it('hides all reports from Admin and Receptionist', () => {
    const admin = {
      role: Role.ADMIN,
      canAccessSalary: true,
      canAccessProfitLoss: true,
    };
    const receptionist = {
      role: Role.RECEPTIONIST,
      canAccessSalary: true,
      canAccessProfitLoss: true,
    };
    expect(listReportCatalog(admin)).toEqual([]);
    expect(listReportCatalog(receptionist)).toEqual([]);
    expect(canAccessReport('occupancy', admin)).toBe(false);
    expect(canAccessReport('occupancy', receptionist)).toBe(false);
    expect(canAccessReport('profit-loss', admin)).toBe(false);
  });
});
