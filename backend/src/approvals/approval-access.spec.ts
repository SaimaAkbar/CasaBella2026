jest.mock('../../generated/prisma/client', () => ({
  Role: {
    SUPER_ADMIN: 'SUPER_ADMIN',
    ADMIN: 'ADMIN',
    RECEPTIONIST: 'RECEPTIONIST',
  },
}));

import { Role } from '../../generated/prisma/client';
import {
  canAccessApprovals,
  canAccessAuditLogs,
  canDecideApprovals,
  canMutateAuditLogs,
} from './approval-access';

describe('approval-access', () => {
  it('gates approval screen access', () => {
    expect(canAccessApprovals(Role.SUPER_ADMIN)).toBe(true);
    expect(canAccessApprovals(Role.ADMIN)).toBe(false);
    expect(canAccessApprovals(Role.RECEPTIONIST)).toBe(false);
  });

  it('only Super Admin can approve/reject', () => {
    expect(canDecideApprovals(Role.SUPER_ADMIN)).toBe(true);
    expect(canDecideApprovals(Role.ADMIN)).toBe(false);
    expect(canDecideApprovals(Role.RECEPTIONIST)).toBe(false);
  });

  it('gates audit access and mutation', () => {
    expect(canAccessAuditLogs(Role.SUPER_ADMIN)).toBe(true);
    expect(canAccessAuditLogs(Role.ADMIN)).toBe(false);
    expect(canAccessAuditLogs(Role.RECEPTIONIST)).toBe(false);
    expect(canMutateAuditLogs(Role.SUPER_ADMIN)).toBe(true);
    expect(canMutateAuditLogs(Role.ADMIN)).toBe(false);
  });
});
