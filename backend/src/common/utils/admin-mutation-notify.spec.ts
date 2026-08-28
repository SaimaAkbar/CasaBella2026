import {
  describeAdminMutation,
  shouldNotifyAdminMutation,
} from './admin-mutation-notify';

describe('admin mutation notify helper', () => {
  it('notifies on Admin create/update/delete', () => {
    expect(shouldNotifyAdminMutation('PATCH', '/properties/abc')).toBe(true);
    expect(shouldNotifyAdminMutation('POST', '/bookings')).toBe(true);
    expect(shouldNotifyAdminMutation('DELETE', '/units/1')).toBe(true);
  });

  it('does not notify reads, auth, or notification actions', () => {
    expect(shouldNotifyAdminMutation('GET', '/properties')).toBe(false);
    expect(shouldNotifyAdminMutation('POST', '/auth/login')).toBe(false);
    expect(shouldNotifyAdminMutation('PATCH', '/notifications/1/read')).toBe(
      false,
    );
    expect(shouldNotifyAdminMutation('POST', '/approval-requests')).toBe(false);
  });

  it('describes the change in plain language', () => {
    expect(describeAdminMutation('PATCH', '/monthly-tenants/1')).toEqual({
      verb: 'edited',
      module: 'monthly tenants',
    });
  });
});
