import { useCallback, useEffect, useMemo, useState } from 'react';
import { DataTable, type DataTableColumn } from '../ui/DataTable';
import { FormModal } from '../ui/FormModal';
import { useAuth } from '../../context/AuthContext';
import { Toast } from '../ui/Toast';
import { useApiErrorHandler } from '../../hooks/useApiErrorHandler';
import type { AuthUser } from '../../types/auth';
import {
  fetchUsers,
  createUser,
  updateUser,
  resetUserPassword,
  changeUserStatus,
  changeUserRole,
} from '../../api/users';

export function UsersManagement() {
  const { token, user } = useAuth();
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';
  const handleApiError = useApiErrorHandler();

  const [rows, setRows] = useState<AuthUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ message: string; tone: 'success' | 'error' }>({ message: '', tone: 'success' });

  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<AuthUser | null>(null);
  const [resetting, setResetting] = useState<AuthUser | null>(null);

  const load = useCallback(async () => {
    if (!token || !isSuperAdmin) return;
    setLoading(true);
    try {
      const data = await fetchUsers(token);
      setRows(data);
    } catch (err) {
      setToast({ message: handleApiError(err, 'Unable to load users'), tone: 'error' });
    } finally {
      setLoading(false);
    }
  }, [token, isSuperAdmin, handleApiError]);

  useEffect(() => {
    void load();
  }, [load]);

  const columns = useMemo<Array<DataTableColumn<AuthUser>>>(() => [
    { key: 'name', header: 'Name', render: (r) => r.fullName },
    { key: 'email', header: 'Login Email', render: (r) => r.email },
    { key: 'role', header: 'Role', render: (r) => r.role },
    { key: 'phone', header: 'Phone', render: (r) => r.phone || '—' },
    { key: 'status', header: 'Status', render: (r) => r.status },
    { key: 'lastLogin', header: 'Last Login', render: (r) => (r.lastLoginAt ? new Date(r.lastLoginAt).toLocaleString() : '—') },
    {
      key: 'actions',
      header: 'Actions',
      render: (r) => {
        const isSelf = user?.id === r.id;
        return (
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" className="btn btn--ghost" onClick={() => setEditing(r)} disabled={isSelf}>Edit</button>
            <button type="button" className="btn btn--ghost" onClick={() => setResetting(r)} disabled={isSelf}>Reset Password</button>
          <button
            type="button"
            className="btn btn--ghost"
            onClick={async () => {
              if (!token) return;
              if (user?.id === r.id) return;
              const confirm = window.confirm(`${r.fullName}: ${r.status === 'ACTIVE' ? 'Deactivate' : 'Activate'} user?`);
              if (!confirm) return;
              try {
                await changeUserStatus(token, r.id, r.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE');
                setToast({ message: 'User status updated', tone: 'success' });
                await load();
              } catch (err) {
                setToast({ message: handleApiError(err, 'Unable to change status'), tone: 'error' });
              }
            }}
          >
            {r.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
          </button>
          <button
            type="button"
            className="btn btn--ghost"
            onClick={async () => {
              if (!token) return;
              if (user?.id === r.id) return;
              const targetRole = r.role === 'ADMIN' ? 'RECEPTIONIST' : 'ADMIN';
              if (!window.confirm(`Change ${r.fullName} from ${r.role} to ${targetRole}?`)) return;
              try {
                await changeUserRole(token, r.id, targetRole as 'ADMIN' | 'RECEPTIONIST');
                setToast({ message: 'User role updated', tone: 'success' });
                await load();
              } catch (err) {
                setToast({ message: handleApiError(err, 'Unable to change role'), tone: 'error' });
              }
            }}
          >
            Change Role
          </button>
        </div>
        );
      },
    },
  ], [handleApiError, load, token]);

  return (
    <section>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3>User Management</h3>
        <div>
          <button type="button" className="btn btn--primary" onClick={() => setShowAdd(true)}>+ Add User</button>
        </div>
      </div>

      {loading ? <p>Loading…</p> : null}

      <DataTable columns={columns} rows={rows} rowKey={(r) => r.id} />

      <FormModal open={showAdd} title="Add User" onClose={() => setShowAdd(false)}>
        <AddEditUserForm
          token={token}
          onSaved={async () => {
            setShowAdd(false);
            setToast({ message: 'User created', tone: 'success' });
            await load();
          }}
          onError={(msg) => setToast({ message: msg, tone: 'error' })}
        />
      </FormModal>

      <FormModal open={Boolean(editing)} title="Edit User" onClose={() => setEditing(null)}>
        {editing ? (
          <AddEditUserForm
            token={token}
            initial={editing}
            onSaved={async () => {
              setEditing(null);
              setToast({ message: 'User updated', tone: 'success' });
              await load();
            }}
            onError={(msg) => setToast({ message: msg, tone: 'error' })}
          />
        ) : null}
      </FormModal>

      <FormModal open={Boolean(resetting)} title="Reset Password" onClose={() => setResetting(null)}>
        {resetting ? (
          <ResetPasswordForm
            token={token}
            user={resetting}
            onDone={async () => {
              setResetting(null);
              setToast({ message: 'Password reset', tone: 'success' });
              await load();
            }}
            onError={(msg) => setToast({ message: msg, tone: 'error' })}
          />
        ) : null}
      </FormModal>

      {toast.message ? <Toast message={toast.message} tone={toast.tone} onClose={() => setToast({ message: '', tone: 'success' })} /> : null}
    </section>
  );
}

function AddEditUserForm({ token, initial, onSaved, onError }: {
  token?: string | null;
  initial?: AuthUser | null;
  onSaved: () => void | Promise<void>;
  onError: (msg: string) => void;
}) {
  const [fullName, setFullName] = useState(initial?.fullName ?? '');
  const [email, setEmail] = useState(initial?.email ?? '');
  const [phone, setPhone] = useState(initial?.phone ?? '');
  const [role, setRole] = useState<'ADMIN' | 'RECEPTIONIST'>(initial?.role === 'ADMIN' ? 'ADMIN' : 'RECEPTIONIST');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');

  async function handleSave(e?: React.FormEvent) {
    e?.preventDefault();
    if (!token) return;
    try {
      if (initial) {
        await updateUser(token, initial.id, { fullName, email, phone, role });
      } else {
        if (password !== confirm) {
          onError('Password confirmation does not match');
          return;
        }
        await createUser(token, { fullName, email, phone, role, password });
      }

      await onSaved();
    } catch (err) {
      onError(String(err));
    }
  }

  return (
    <form onSubmit={handleSave} className="module-form">
      <label>
        <span>Full Name</span>
        <input value={fullName} onChange={(e) => setFullName(e.target.value)} />
      </label>
      <label>
        <span>Email</span>
        <input value={email} onChange={(e) => setEmail(e.target.value)} />
      </label>
      <label>
        <span>Phone</span>
        <input value={phone} onChange={(e) => setPhone(e.target.value)} />
      </label>
      <label>
        <span>Role</span>
        <select value={role} onChange={(e) => setRole(e.target.value as any)}>
          <option value="ADMIN">ADMIN</option>
          <option value="RECEPTIONIST">RECEPTIONIST</option>
        </select>
      </label>
      {!initial ? (
        <>
          <label>
            <span>Password</span>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </label>
          <label>
            <span>Confirm Password</span>
            <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          </label>
        </>
      ) : null}

      <div style={{ display: 'flex', gap: 8 }}>
        <button type="submit" className="btn btn--primary">Save</button>
      </div>
    </form>
  );
}

function ResetPasswordForm({ token, user, onDone, onError }: {
  token?: string | null;
  user: AuthUser;
  onDone: () => void | Promise<void>;
  onError: (msg: string) => void;
}) {
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleReset(e?: React.FormEvent) {
    e?.preventDefault();
    if (isSubmitting) return;
    if (!token) {
      onError('Missing authentication token');
      return;
    }

    if (!newPassword || !confirm) {
      onError('Please enter and confirm the new password.');
      return;
    }

    if (newPassword !== confirm) {
      onError('Passwords do not match.');
      return;
    }

    if (newPassword.length < 8) {
      onError('Password must be at least 8 characters.');
      return;
    }

    setIsSubmitting(true);
    try {
      await resetUserPassword(token, user.id, { newPassword, confirmPassword: confirm });
      await onDone();
    } catch (err) {
      // surface useful message and log technical details
      console.error('Reset password error', err);
      onError(String(err));
    } finally {
      setIsSubmitting(false);
      setNewPassword('');
      setConfirm('');
    }
  }

  return (
    <form onSubmit={handleReset} className="module-form">
      <p>User: {user.fullName}</p>
      <p>Role: {user.role}</p>
      <label>
        <span>New Password</span>
        <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} disabled={isSubmitting} />
      </label>
      <label>
        <span>Confirm Password</span>
        <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} disabled={isSubmitting} />
      </label>
      <div style={{ display: 'flex', gap: 8 }}>
        <button type="submit" className="btn btn--primary" disabled={isSubmitting}>{isSubmitting ? 'RESETTING…' : 'RESET PASSWORD'}</button>
      </div>
    </form>
  );
}
