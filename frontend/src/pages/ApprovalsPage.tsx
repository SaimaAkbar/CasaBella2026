import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  approveApprovalRequest,
  fetchApprovalRequests,
  rejectApprovalRequest,
} from '../api/approvals';
import { PageHeader } from '../components/PageHeader';
import { DataTable, type DataTableColumn } from '../components/ui/DataTable';
import { EmptyState } from '../components/ui/EmptyState';
import { ErrorState } from '../components/ui/ErrorState';
import { FilterBar } from '../components/ui/FilterBar';
import { FormModal } from '../components/ui/FormModal';
import { LoadingState } from '../components/ui/LoadingState';
import { Toast } from '../components/ui/Toast';
import { useAuth } from '../context/AuthContext';
import { useApiErrorHandler } from '../hooks/useApiErrorHandler';
import { buildDiffRows, formatApprovalDiffValue } from '../lib/diff';
import type {
  ApprovalModuleName,
  ApprovalPriority,
  ApprovalRequest,
  ApprovalStatus,
} from '../types/approval';
import '../styles/forms.css';
import './ApprovalsPage.css';

type TabKey = 'PENDING' | 'APPROVED' | 'REJECTED';

const MODULES: ApprovalModuleName[] = [
  'PROPERTY',
  'UNITS',
  'MONTHLY_TENANTS',
  'BOOKINGS',
  'PAYMENTS',
  'EXPENSES',
  'ELECTRICITY',
  'OWNERS',
  'EMPLOYEES',
  'SALARY',
  'INVENTORY',
  'SETTINGS',
];

function statusBadgeClass(status: ApprovalStatus): string {
  if (status === 'PENDING') return 'approval-badge approval-badge--pending';
  if (status === 'APPROVED') return 'approval-badge approval-badge--approved';
  if (status === 'REJECTED') return 'approval-badge approval-badge--rejected';
  return 'approval-badge approval-badge--cancelled';
}

function priorityBadgeClass(priority: ApprovalPriority): string {
  return `approval-badge approval-badge--priority-${priority.toLowerCase()}`;
}

function formatDate(value: string | null): string {
  if (!value) return '—';
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

export function ApprovalsPage() {
  const { token, user } = useAuth();
  const handleApiError = useApiErrorHandler();
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';

  const [tab, setTab] = useState<TabKey>('PENDING');
  const [rows, setRows] = useState<ApprovalRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState<{
    message: string;
    tone: 'success' | 'error';
  }>({ message: '', tone: 'success' });

  const [moduleName, setModuleName] = useState('');
  const [priority, setPriority] = useState('');
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const [selected, setSelected] = useState<ApprovalRequest | null>(null);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setIsLoading(true);
    setError('');
    try {
      const data = await fetchApprovalRequests(token, {
        status: tab,
        moduleName: (moduleName || undefined) as ApprovalModuleName | undefined,
        priority: (priority || undefined) as ApprovalPriority | undefined,
        search,
        dateFrom,
        dateTo,
      });
      setRows(data);
    } catch (err) {
      setError(handleApiError(err, 'Unable to load approvals'));
    } finally {
      setIsLoading(false);
    }
  }, [token, tab, moduleName, priority, search, dateFrom, dateTo, handleApiError]);

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

  async function handleApprove(row: ApprovalRequest) {
    if (!token || !isSuperAdmin) return;
    setBusy(true);
    try {
      await approveApprovalRequest(token, row.id);
      setToast({ message: 'Request approved and applied.', tone: 'success' });
      setSelected(null);
      await load();
    } catch (err) {
      setToast({
        message: handleApiError(err, 'Unable to approve request'),
        tone: 'error',
      });
    } finally {
      setBusy(false);
    }
  }

  async function handleReject() {
    if (!token || !selected || !isSuperAdmin) return;
    if (!rejectionReason.trim()) {
      setToast({ message: 'Rejection reason is required.', tone: 'error' });
      return;
    }
    setBusy(true);
    try {
      await rejectApprovalRequest(token, selected.id, rejectionReason.trim());
      setToast({ message: 'Request rejected.', tone: 'success' });
      setRejectOpen(false);
      setRejectionReason('');
      setSelected(null);
      await load();
    } catch (err) {
      setToast({
        message: handleApiError(err, 'Unable to reject request'),
        tone: 'error',
      });
    } finally {
      setBusy(false);
    }
  }

  const columns: Array<DataTableColumn<ApprovalRequest>> = [
    {
      key: 'module',
      header: 'Module',
      render: (row) => row.moduleName,
    },
    {
      key: 'action',
      header: 'Action',
      render: (row) => row.actionType,
    },
    {
      key: 'record',
      header: 'Record',
      render: (row) => (
        <code style={{ fontSize: '0.75rem' }}>{row.recordId.slice(0, 8)}…</code>
      ),
    },
    {
      key: 'requestedBy',
      header: 'Requested By',
      render: (row) => row.requestedBy?.fullName ?? '—',
    },
    {
      key: 'date',
      header: 'Date',
      render: (row) => formatDate(row.requestedDate),
    },
    {
      key: 'priority',
      header: 'Priority',
      render: (row) => (
        <span className={priorityBadgeClass(row.priority)}>{row.priority}</span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => (
        <span className={statusBadgeClass(row.status)}>{row.status}</span>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (row) => (
        <div className="approvals-actions">
          <button type="button" onClick={() => setSelected(row)}>
            View
          </button>
          {isSuperAdmin && row.status === 'PENDING' ? (
            <>
              <button
                type="button"
                disabled={busy}
                onClick={() => void handleApprove(row)}
              >
                Approve
              </button>
              <button
                type="button"
                className="approvals-actions__reject"
                disabled={busy}
                onClick={() => {
                  setSelected(row);
                  setRejectOpen(true);
                }}
              >
                Reject
              </button>
            </>
          ) : null}
        </div>
      ),
    },
  ];

  if (user?.role && user.role !== 'SUPER_ADMIN') {
    return (
      <section className="approvals-page">
        <PageHeader title="Approvals" breadcrumb={['Home', 'Approvals']} />
        <ErrorState message="Only Super Admin can access approvals." />
      </section>
    );
  }

  return (
    <section className="approvals-page">
      <PageHeader title="Approvals" breadcrumb={['Home', 'Approvals']} />

      <div className="approvals-tabs">
        {(['PENDING', 'APPROVED', 'REJECTED'] as TabKey[]).map((key) => (
          <button
            key={key}
            type="button"
            className={
              tab === key
                ? 'approvals-tabs__btn approvals-tabs__btn--active'
                : 'approvals-tabs__btn'
            }
            onClick={() => setTab(key)}
          >
            {key}
          </button>
        ))}
      </div>

      <FilterBar>
        <label className="form-field">
          <span>Module</span>
          <select
            value={moduleName}
            onChange={(e) => setModuleName(e.target.value)}
          >
            <option value="">All</option>
            {MODULES.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </label>
        <label className="form-field">
          <span>Priority</span>
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
          >
            <option value="">All</option>
            <option value="LOW">LOW</option>
            <option value="NORMAL">NORMAL</option>
            <option value="HIGH">HIGH</option>
            <option value="CRITICAL">CRITICAL</option>
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
            placeholder="Record, reason, user…"
          />
        </label>
      </FilterBar>

      {isLoading ? <LoadingState message="Loading approvals…" /> : null}
      {!isLoading && error ? <ErrorState message={error} /> : null}
      {!isLoading && !error && rows.length === 0 ? (
        <EmptyState title="No approval requests" description="Nothing in this tab." />
      ) : null}
      {!isLoading && !error && rows.length > 0 ? (
        <DataTable columns={columns} rows={rows} rowKey={(row) => row.id} />
      ) : null}

      <FormModal
        open={Boolean(selected) && !rejectOpen}
        title="Approval Details"
        onClose={() => setSelected(null)}
      >
        {selected ? (
          <div className="diff-panel">
            <div className="diff-meta">
              <div>
                <strong>{selected.moduleName}</strong> · {selected.actionType}
              </div>
              <div>Record: {selected.recordId}</div>
              <div>Requested by: {selected.requestedBy?.fullName ?? '—'}</div>
              <div>Date: {formatDate(selected.requestedDate)}</div>
              <div>
                Status:{' '}
                <span className={statusBadgeClass(selected.status)}>
                  {selected.status}
                </span>
              </div>
              <div>Reason: {selected.reason || '—'}</div>
              {selected.rejectionReason ? (
                <div>Rejection: {selected.rejectionReason}</div>
              ) : null}
            </div>

            <table className="diff-table">
              <thead>
                <tr>
                  <th>Field</th>
                  <th>Before</th>
                  <th></th>
                  <th>After</th>
                </tr>
              </thead>
              <tbody>
                {diffRows.length === 0 ? (
                  <tr>
                    <td colSpan={4}>No field changes to compare.</td>
                  </tr>
                ) : (
                  diffRows.map((row) => (
                    <tr
                      key={row.key}
                      className={row.changed ? 'diff-table__changed' : undefined}
                    >
                      <td>{row.label}</td>
                      <td className={row.changed ? 'diff-table__old' : undefined}>
                        {formatApprovalDiffValue(row.key, row.oldValue)}
                      </td>
                      <td className="diff-arrow">→</td>
                      <td className={row.changed ? 'diff-table__new' : undefined}>
                        {formatApprovalDiffValue(row.key, row.newValue)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>

            {isSuperAdmin && selected.status === 'PENDING' ? (
              <div className="diff-actions">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void handleApprove(selected)}
                >
                  Approve
                </button>
                <button
                  type="button"
                  className="diff-actions__reject"
                  disabled={busy}
                  onClick={() => setRejectOpen(true)}
                >
                  Reject
                </button>
              </div>
            ) : null}
          </div>
        ) : null}
      </FormModal>

      <FormModal
        open={rejectOpen}
        title="Reject Approval"
        onClose={() => {
          setRejectOpen(false);
          setRejectionReason('');
        }}
      >
        <form
          className="form-grid"
          onSubmit={(e) => {
            e.preventDefault();
            void handleReject();
          }}
        >
          <label className="form-field">
            <span>Rejection Reason *</span>
            <textarea
              rows={4}
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              required
            />
          </label>
          <div className="diff-actions">
            <button type="submit" className="diff-actions__reject" disabled={busy}>
              Confirm Reject
            </button>
          </div>
        </form>
      </FormModal>

      <Toast
        message={toast.message}
        tone={toast.tone}
        onClose={() => setToast({ message: '', tone: 'success' })}
      />
    </section>
  );
}
