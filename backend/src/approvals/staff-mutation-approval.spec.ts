jest.mock('../../generated/prisma/client', () => ({
  ApprovalModuleName: {
    PROPERTY: 'PROPERTY',
    UNITS: 'UNITS',
    MONTHLY_TENANTS: 'MONTHLY_TENANTS',
    BOOKINGS: 'BOOKINGS',
    PAYMENTS: 'PAYMENTS',
    EXPENSES: 'EXPENSES',
    ELECTRICITY: 'ELECTRICITY',
    OWNERS: 'OWNERS',
    EMPLOYEES: 'EMPLOYEES',
    SALARY: 'SALARY',
    INVENTORY: 'INVENTORY',
    SETTINGS: 'SETTINGS',
  },
  ApprovalActionType: {
    CREATE: 'CREATE',
    UPDATE: 'UPDATE',
    DELETE: 'DELETE',
    ARCHIVE: 'ARCHIVE',
  },
}));

import { ApprovalActionType, ApprovalModuleName } from '../../generated/prisma/client';
import {
  actionTypeFromRequest,
  moduleNameFromPath,
  recordIdFromPath,
  shouldQueueStaffMutation,
} from './staff-mutation-approval';

describe('staff mutation approval routing', () => {
  it('queues Admin/Receptionist edits and deletes', () => {
    expect(shouldQueueStaffMutation('PATCH', '/properties/abc')).toBe(true);
    expect(shouldQueueStaffMutation('PUT', '/units/u1')).toBe(true);
    expect(shouldQueueStaffMutation('DELETE', '/expenses/e1')).toBe(true);
    expect(
      shouldQueueStaffMutation(
        'PATCH',
        '/monthly-tenants/11111111-1111-1111-1111-111111111111',
      ),
    ).toBe(true);
  });

  it('queues actions on existing records', () => {
    expect(
      shouldQueueStaffMutation(
        'POST',
        '/bookings/11111111-1111-1111-1111-111111111111/confirm',
      ),
    ).toBe(true);
  });

  it('does not queue reads, auth, or desk till operations', () => {
    expect(shouldQueueStaffMutation('GET', '/properties')).toBe(false);
    expect(shouldQueueStaffMutation('POST', '/auth/login')).toBe(false);
    expect(shouldQueueStaffMutation('POST', '/payments')).toBe(false);
    expect(shouldQueueStaffMutation('POST', '/bookings')).toBe(false);
    expect(shouldQueueStaffMutation('POST', '/guests')).toBe(false);
    expect(
      shouldQueueStaffMutation(
        'POST',
        '/bookings/11111111-1111-1111-1111-111111111111/check-in',
      ),
    ).toBe(false);
    expect(
      shouldQueueStaffMutation(
        'POST',
        '/bookings/11111111-1111-1111-1111-111111111111/check-out',
      ),
    ).toBe(false);
    expect(
      shouldQueueStaffMutation(
        'POST',
        '/bookings/11111111-1111-1111-1111-111111111111/cancel',
      ),
    ).toBe(false);
    expect(
      shouldQueueStaffMutation(
        'POST',
        '/bookings/11111111-1111-1111-1111-111111111111/no-show',
      ),
    ).toBe(false);
    expect(
      shouldQueueStaffMutation(
        'POST',
        '/electricity-readings/11111111-1111-1111-1111-111111111111/record-payment',
      ),
    ).toBe(false);
    expect(
      shouldQueueStaffMutation(
        'POST',
        '/online-bookings/payments/11111111-1111-1111-1111-111111111111/verify',
      ),
    ).toBe(false);
    expect(
      shouldQueueStaffMutation(
        'POST',
        '/online-bookings/payments/11111111-1111-1111-1111-111111111111/reject',
      ),
    ).toBe(false);
    expect(
      shouldQueueStaffMutation('PATCH', '/notifications/1/read'),
    ).toBe(false);
    expect(shouldQueueStaffMutation('POST', '/approval-requests')).toBe(false);
  });

  it('maps path prefixes to approval modules', () => {
    expect(moduleNameFromPath('/properties/x')).toBe(ApprovalModuleName.PROPERTY);
    expect(moduleNameFromPath('/units')).toBe(ApprovalModuleName.UNITS);
    expect(moduleNameFromPath('/monthly-tenancies/x')).toBe(
      ApprovalModuleName.MONTHLY_TENANTS,
    );
    expect(moduleNameFromPath('/guests/x')).toBe(ApprovalModuleName.BOOKINGS);
    expect(moduleNameFromPath('/electricity-readings/settings/rate')).toBe(
      ApprovalModuleName.ELECTRICITY,
    );
  });

  it('derives action type and record id', () => {
    expect(actionTypeFromRequest('POST', '/properties')).toBe(
      ApprovalActionType.CREATE,
    );
    expect(
      actionTypeFromRequest(
        'PATCH',
        '/units/11111111-1111-1111-1111-111111111111',
      ),
    ).toBe(ApprovalActionType.UPDATE);
    expect(
      actionTypeFromRequest(
        'POST',
        '/units/11111111-1111-1111-1111-111111111111/archive',
      ),
    ).toBe(ApprovalActionType.ARCHIVE);
    expect(
      recordIdFromPath(
        'PATCH',
        '/units/11111111-1111-1111-1111-111111111111',
      ),
    ).toBe('11111111-1111-1111-1111-111111111111');
    expect(recordIdFromPath('PATCH', '/electricity-readings/settings/rate')).toBe(
      'route:PATCH:/electricity-readings/settings/rate',
    );
  });
});
