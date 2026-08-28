import { useCallback, useEffect, useMemo, useState } from 'react';
import { fetchAuditLog, fetchAuditLogs } from '../api/audit-logs';
import { PageHeader } from '../components/PageHeader';
import { DataTable, type DataTableColumn } from '../components/ui/DataTable';
import { EmptyState } from '../components/ui/EmptyState';
import { ErrorState } from '../components/ui/ErrorState';
import { FilterBar } from '../components/ui/FilterBar';
import { FormModal } from '../components/ui/FormModal';
import { LoadingState } from '../components/ui/LoadingState';
import { useAuth } from '../context/AuthContext';
import { useApiErrorHandler } from '../hooks/useApiErrorHandler';
import { buildDiffRows, formatDiffValue } from '../lib/diff';
import type { AuditLog } from '../types/approval';
import '../styles/forms.css';
import './ApprovalsPage.css';

function formatDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

export function AuditLogsPage() {
  const { token, user } = useAuth();
  const handleApiError = useApiErrorHandler();

  const [rows, setRows] = useState<AuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<AuditLog | null>(null);

  const [module, setModule] = useState('');
  const [action, setAction] = useState('');
  const [role, setRole] = useState('');
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const load = useCallback(async () => {
    if (!token) return;
    setIsLoading(true);
    setError('');
    try {
      const data = await fetchAuditLogs(token, {
        module,
        action,
        role,
        search,
        dateFrom,
        dateTo,
      });
      setRows(data);
    } catch (err) {
      setError(handleApiError(err, 'Unable to load audit logs'));
    } finally {
      setIsLoading(false);
    }
  }, [token, module, action, role, search, dateFrom, dateTo, handleApiError]);

  useEffect(() => {
    void load();
  }, [load]);

  const diffRows = useMemo(
    () =>
      selected
        ? buildDiffRows(
            selected.oldData as Record<string, unknown> | null,
            selected.newData as Record<string, unknown> | null,
          )
        : [],
    [selected],
  );

  async function openDetails(id: string) {
    if (!token) return;
    try {
      const detail = await fetchAuditLog(token, id);
      setSelected(detail);
    } catch (err) {
      setError(handleApiError(err, 'Unable to load audit detail'));
    }
  }

  const columns: Array<DataTableColumn<AuditLog>> = [
    {
      key: 'date',
      header: 'Date',
      render: (row) => formatDate(row.createdAt),
    },
    {
      key: 'user',
      header: 'User',
      render: (row) => row.user?.fullName ?? '—',
    },
    {
      key: 'role',
      header: 'Role',
      render: (row) => row.role ?? '—',
    },
    {
      key: 'module',
      header: 'Module',
      render: (row) => row.module,
    },
    {
      key: 'action',
      header: 'Action',
      render: (row) => row.action,
    },
    {
      key: 'record',
      header: 'Record',
      render: (row) =>
        row.recordId ? (
          <code style={{ fontSize: '0.75rem' }}>
            {row.recordId.slice(0, 8)}…
          </code>
        ) : (
          '—'
        ),
    },
    {
      key: 'ip',
      header: 'IP',
      render: (row) => row.ipAddress ?? '—',
    },
    {
      key: 'device',
      header: 'Device',
      render: (row) => row.device ?? '—',
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (row) => (
        <div className="approvals-actions">
          <button type="button" onClick={() => void openDetails(row.id)}>
            View Details
          </button>
        </div>
      ),
    },
  ];

  if (user?.role === 'RECEPTIONIST') {
    return (
      <section className="approvals-page">
        <PageHeader title="Audit Log" breadcrumb={['Home', 'Audit Log']} />
        <ErrorState message="Receptionist does not have access to audit logs." />
      </section>
    );
  }

  return (
    <section className="approvals-page">
      <PageHeader title="Audit Log" breadcrumb={['Home', 'Audit Log']} />

      <FilterBar>
        <label className="form-field">
          <span>Module</span>
          <input
            value={module}
            onChange={(e) => setModule(e.target.value)}
            placeholder="BOOKINGS"
          />
        </label>
        <label className="form-field">
          <span>Action</span>
          <input
            value={action}
            onChange={(e) => setAction(e.target.value)}
            placeholder="UPDATE"
          />
        </label>
        <label className="form-field">
          <span>Role</span>
          <select value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="">All</option>
            <option value="SUPER_ADMIN">SUPER_ADMIN</option>
            <option value="ADMIN">ADMIN</option>
            <option value="RECEPTIONIST">RECEPTIONIST</option>
          </select>
        </label>
        <label className="form-field">
          <span>From</span>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
          />
        </label>
        <label className="form-field">
          <span>To</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
          />
        </label>
        <label className="form-field">
          <span>Search</span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="User, module, IP…"
          />
        </label>
      </FilterBar>

      {isLoading ? <LoadingState message="Loading audit logs…" /> : null}
      {!isLoading && error ? <ErrorState message={error} /> : null}
      {!isLoading && !error && rows.length === 0 ? (
        <EmptyState
          title="No audit entries"
          description="No activity matched filters."
        />
      ) : null}
      {!isLoading && !error && rows.length > 0 ? (
        <DataTable columns={columns} rows={rows} rowKey={(row) => row.id} />
      ) : null}

      <FormModal
        open={Boolean(selected)}
        title="Audit Details"
        onClose={() => setSelected(null)}
      >
        {selected ? (
          <div className="diff-panel">
            <div className="diff-meta">
              <div>
                <strong>{selected.module}</strong> · {selected.action}
              </div>
              <div>Who: {selected.user?.fullName ?? '—'} ({selected.role ?? '—'})</div>
              <div>When: {formatDate(selected.createdAt)}</div>
              <div>Record: {selected.recordId ?? '—'}</div>
              <div>
                Device: {selected.device ?? '—'} / {selected.browser ?? '—'} /{' '}
                {selected.os ?? '—'}
              </div>
              <div>IP: {selected.ipAddress ?? '—'}</div>
            </div>

            <div className="diff-arrow">Timeline</div>

            <table className="diff-table">
              <thead>
                <tr>
                  <th>Field</th>
                  <th>Old Value</th>
                  <th></th>
                  <th>New Value</th>
                </tr>
              </thead>
              <tbody>
                {diffRows.map((row) => (
                  <tr
                    key={row.key}
                    className={row.changed ? 'diff-table__changed' : undefined}
                  >
                    <td>{row.key}</td>
                    <td className={row.changed ? 'diff-table__old' : undefined}>
                      {formatDiffValue(row.oldValue)}
                    </td>
                    <td className="diff-arrow">↓</td>
                    <td className={row.changed ? 'diff-table__new' : undefined}>
                      {formatDiffValue(row.newValue)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </FormModal>
    </section>
  );
}
