import { useCallback, useEffect, useState } from 'react';
import {
  cleanupBackups,
  createBackup,
  deleteBackup,
  disableMaintenance,
  downloadBackup,
  enableMaintenance,
  fetchBackupScheduleStatus,
  fetchBackupStatistics,
  fetchBackups,
  fetchMaintenanceStatus,
  restoreBackup,
  updateBackupSchedule,
  verifyBackup,
  type BackupRecord,
  type BackupScheduleStatus,
  type BackupStatistics,
  type BackupVerification,
} from '../api/backups';
import { PageHeader } from '../components/PageHeader';
import { DataTable, type DataTableColumn } from '../components/ui/DataTable';
import { EmptyState } from '../components/ui/EmptyState';
import { ErrorState } from '../components/ui/ErrorState';
import { FormModal } from '../components/ui/FormModal';
import { LoadingState } from '../components/ui/LoadingState';
import { Toast } from '../components/ui/Toast';
import { useAuth } from '../context/AuthContext';
import { useApiErrorHandler } from '../hooks/useApiErrorHandler';
import '../styles/forms.css';
import './SettingsPage.css';

function formatBytes(value: number | null): string {
  if (value == null) return '—';
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function formatWhen(value: string | null): string {
  if (!value) return '—';
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

export function BackupsPage() {
  const { token, user } = useAuth();
  const handleApiError = useApiErrorHandler();
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';

  const [rows, setRows] = useState<BackupRecord[]>([]);
  const [stats, setStats] = useState<BackupStatistics | null>(null);
  const [schedule, setSchedule] = useState<BackupScheduleStatus | null>(null);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [autoEnabled, setAutoEnabled] = useState(false);
  const [retentionDays, setRetentionDays] = useState(30);
  const [maintenance, setMaintenance] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{
    message: string;
    tone: 'success' | 'error';
  }>({ message: '', tone: 'success' });

  const [restoreRow, setRestoreRow] = useState<BackupRecord | null>(null);
  const [verification, setVerification] = useState<BackupVerification | null>(
    null,
  );
  const [reason, setReason] = useState('');
  const [confirmationText, setConfirmationText] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');

  const load = useCallback(async () => {
    if (!token || !isSuperAdmin) return;
    setIsLoading(true);
    setError('');
    try {
      const [list, statistics, maint, scheduleStatus] = await Promise.all([
        fetchBackups(token),
        fetchBackupStatistics(token),
        fetchMaintenanceStatus(token),
        fetchBackupScheduleStatus(token),
      ]);
      setRows(list);
      setStats(statistics);
      setMaintenance(maint.enabled);
      setSchedule(scheduleStatus);
      setAutoEnabled(
        statistics.autoBackupEnabled || scheduleStatus.autoBackupEnabledEnv,
      );
      setRetentionDays(statistics.retentionDays);
    } catch (err) {
      setError(handleApiError(err, 'Unable to load backups'));
    } finally {
      setIsLoading(false);
    }
  }, [token, isSuperAdmin, handleApiError]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleCreate() {
    if (!token) return;
    setBusy(true);
    try {
      await createBackup(token);
      setToast({ message: 'Backup created', tone: 'success' });
      await load();
    } catch (err) {
      setToast({
        message: handleApiError(err, 'Backup failed'),
        tone: 'error',
      });
    } finally {
      setBusy(false);
    }
  }

  async function handleVerify(row: BackupRecord) {
    if (!token) return;
    try {
      const result = await verifyBackup(token, row.id);
      setToast({
        message: result.valid ? 'Backup verified' : 'Verification failed',
        tone: result.valid ? 'success' : 'error',
      });
      if (restoreRow?.id === row.id) setVerification(result);
    } catch (err) {
      setToast({
        message: handleApiError(err, 'Verification failed'),
        tone: 'error',
      });
    }
  }

  async function openRestore(row: BackupRecord) {
    if (!token) return;
    setRestoreRow(row);
    setReason('');
    setConfirmationText('');
    setCurrentPassword('');
    try {
      setVerification(await verifyBackup(token, row.id));
    } catch {
      setVerification(null);
    }
  }

  async function handleRestore() {
    if (!token || !restoreRow) return;
    setBusy(true);
    try {
      await restoreBackup(token, restoreRow.id, {
        confirmationText,
        reason,
        currentPassword,
      });
      setToast({ message: 'Restore completed', tone: 'success' });
      setRestoreRow(null);
      await load();
    } catch (err) {
      setToast({
        message: handleApiError(err, 'Restore failed'),
        tone: 'error',
      });
    } finally {
      setBusy(false);
    }
  }

  const canRestore =
    Boolean(verification?.valid) &&
    reason.trim().length >= 5 &&
    confirmationText === 'RESTORE DATABASE' &&
    currentPassword.length > 0 &&
    !busy;

  const columns: DataTableColumn<BackupRecord>[] = [
    { key: 'number', header: 'Backup #', render: (r) => r.backupNumber },
    { key: 'type', header: 'Type', render: (r) => r.backupType },
    { key: 'file', header: 'File', render: (r) => r.fileName },
    {
      key: 'date',
      header: 'Date',
      render: (r) => formatWhen(r.completedAt ?? r.startedAt),
    },
    {
      key: 'size',
      header: 'Size',
      render: (r) => formatBytes(r.fileSizeBytes),
    },
    { key: 'status', header: 'Status', render: (r) => r.status },
    {
      key: 'by',
      header: 'Created By',
      render: (r) => r.createdBy?.fullName ?? '—',
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (r) => (
        <div className="approvals-actions">
          <button type="button" onClick={() => void handleVerify(r)}>
            Verify
          </button>
          <button
            type="button"
            disabled={r.status !== 'COMPLETED'}
            onClick={() => token && void downloadBackup(token, r.id, r.fileName)}
          >
            Download
          </button>
          <button
            type="button"
            disabled={r.status !== 'COMPLETED'}
            onClick={() => void openRestore(r)}
          >
            Restore
          </button>
          <button
            type="button"
            className="approvals-actions__reject"
            onClick={() =>
              token &&
              window.confirm('Delete this backup?') &&
              void deleteBackup(token, r.id).then(load)
            }
          >
            Delete
          </button>
        </div>
      ),
    },
  ];

  if (!isSuperAdmin) {
    return (
      <section className="module-page">
        <PageHeader title="System Backup" breadcrumb={['Home', 'System Backup']} />
        <EmptyState
          title="Super Admin only"
          description="Backup and restore operations are restricted to Super Admin."
        />
      </section>
    );
  }

  return (
    <section className="module-page">
      <PageHeader
        title="System Backup"
        breadcrumb={['Home', 'System Backup']}
        actions={
          <div className="settings-page__actions">
            <button
              type="button"
              className="btn btn--ghost"
              disabled={busy}
              onClick={() => void load()}
            >
              Refresh
            </button>
            <button
              type="button"
              className="btn btn--ghost"
              disabled={busy}
              onClick={() =>
                token &&
                void (maintenance
                  ? disableMaintenance(token)
                  : enableMaintenance(token)
                ).then(load)
              }
            >
              {maintenance ? 'Disable maintenance' : 'Enable maintenance'}
            </button>
            <button
              type="button"
              className="btn btn--ghost"
              disabled={busy}
              onClick={() => setScheduleOpen(true)}
            >
              Configure schedule
            </button>
            <button
              type="button"
              className="btn btn--ghost"
              disabled={busy}
              onClick={() => token && void cleanupBackups(token).then(load)}
            >
              Cleanup old
            </button>
            <button
              type="button"
              className="btn btn--primary"
              disabled={busy}
              onClick={() => void handleCreate()}
            >
              {busy ? 'Working…' : 'Create backup'}
            </button>
          </div>
        }
      />

      {stats ? (
        <div className="settings-color-grid" style={{ marginBottom: '1rem' }}>
          <div className="settings-color-card__swatch">
            Last success: {formatWhen(stats.lastSuccessfulBackupAt)}
          </div>
          <div className="settings-color-card__swatch">
            Total: {stats.totalBackups}
          </div>
          <div className="settings-color-card__swatch">
            Storage: {formatBytes(stats.storageUsedBytes)}
          </div>
          <div className="settings-color-card__swatch">
            Failed: {stats.failedBackups}
          </div>
          <div className="settings-color-card__swatch">
            Retention: {stats.retentionDays} days
          </div>
          <div className="settings-color-card__swatch">
            Scheduled: {stats.scheduledBackupStatus ?? 'DISABLED'}
          </div>
          <div className="settings-color-card__swatch">
            Maintenance: {maintenance ? 'ON' : 'OFF'}
          </div>
        </div>
      ) : null}

      {isLoading ? <LoadingState message="Loading backups…" /> : null}
      {error ? <ErrorState message={error} onRetry={() => void load()} /> : null}
      {!isLoading && !error && rows.length === 0 ? (
        <EmptyState
          title="No backups yet"
          description="Create a manual backup to get started."
        />
      ) : null}
      {!isLoading && !error && rows.length > 0 ? (
        <DataTable columns={columns} rows={rows} rowKey={(r) => r.id} />
      ) : null}

      <FormModal
        open={scheduleOpen}
        title="Backup schedule"
        onClose={() => setScheduleOpen(false)}
      >
        <div className="module-form">
          <p>
            Cron (env <code>AUTO_BACKUP_CRON</code>):{' '}
            <strong>{schedule?.cron ?? '0 2 * * *'}</strong> (
            {schedule?.timezone ?? 'Asia/Karachi'})
          </p>
          <p>
            Last run: {formatWhen(schedule?.lastRunAt ?? null)} (
            {schedule?.lastRunStatus ?? '—'})
          </p>
          <p>Directory configured: {schedule?.backupDirectoryConfigured ? 'Yes' : 'Default local path'}</p>
          <p className="settings-page__warning">
            Database credentials and absolute server paths are never shown here.
            Set <code>AUTO_BACKUP_ENABLED=true</code> in server env for production
            cron, or toggle the setting below.
          </p>
          <label>
            <span>Enable automatic backup (setting)</span>
            <input
              type="checkbox"
              checked={autoEnabled}
              onChange={(e) => setAutoEnabled(e.target.checked)}
            />
          </label>
          <label>
            <span>Retention days</span>
            <input
              type="number"
              min={1}
              max={365}
              value={retentionDays}
              onChange={(e) => setRetentionDays(Number(e.target.value))}
            />
          </label>
          <button
            type="button"
            className="btn btn--primary"
            disabled={busy || !token}
            onClick={() => {
              if (!token) return;
              setBusy(true);
              void updateBackupSchedule(token, {
                autoEnabled,
                retentionDays,
              })
                .then(() => {
                  setToast({ message: 'Schedule settings saved', tone: 'success' });
                  setScheduleOpen(false);
                  return load();
                })
                .catch((err) =>
                  setToast({
                    message: handleApiError(err, 'Unable to save schedule'),
                    tone: 'error',
                  }),
                )
                .finally(() => setBusy(false));
            }}
          >
            Save schedule
          </button>
        </div>
      </FormModal>

      <FormModal
        open={Boolean(restoreRow)}
        title="Restore database"
        onClose={() => setRestoreRow(null)}
      >
        <p className="settings-page__warning">
          This will replace the current database. Type RESTORE DATABASE to
          confirm. A pre-restore backup is created automatically.
        </p>
        <div className="module-form">
          <p>
            Backup: <strong>{restoreRow?.backupNumber}</strong> (
            {formatBytes(restoreRow?.fileSizeBytes ?? null)})
          </p>
          <p>
            Verification:{' '}
            {verification
              ? verification.valid
                ? 'Valid'
                : 'Failed'
              : 'Pending'}
          </p>
          <label>
            <span>Reason</span>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </label>
          <label>
            <span>Confirmation text</span>
            <input
              value={confirmationText}
              onChange={(e) => setConfirmationText(e.target.value)}
              placeholder="RESTORE DATABASE"
            />
          </label>
          <label>
            <span>Your password</span>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
            />
          </label>
          <button
            type="button"
            className="btn btn--primary"
            disabled={!canRestore}
            onClick={() => void handleRestore()}
          >
            {busy ? 'Restoring…' : 'Restore database'}
          </button>
        </div>
      </FormModal>

      {toast.message ? (
        <Toast
          message={toast.message}
          tone={toast.tone}
          onClose={() => setToast({ message: '', tone: 'success' })}
        />
      ) : null}
    </section>
  );
}
