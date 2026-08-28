import { apiRequest } from './client';

export type BackupRecord = {
  id: string;
  backupNumber: string;
  backupType: string;
  fileName: string;
  fileSizeBytes: number | null;
  checksum: string | null;
  databaseName: string;
  status: string;
  startedAt: string;
  completedAt: string | null;
  failureReason: string | null;
  createdBy: { id: string; fullName: string; email: string } | null;
  createdAt: string;
};

export type BackupStatistics = {
  totalBackups: number;
  failedBackups: number;
  storageUsedBytes: number;
  lastSuccessfulBackupAt: string | null;
  retentionDays: number;
  autoBackupEnabled: boolean;
  autoBackupCron?: string;
  backupDirectoryConfigured: boolean;
  scheduledBackupStatus?: string;
};

export type BackupScheduleStatus = {
  autoBackupEnabledEnv: boolean;
  cron: string;
  timezone: string;
  retentionDays: number;
  running: boolean;
  lastRunAt: string | null;
  lastRunStatus: string | null;
  nextRunHint: string;
  backupDirectoryConfigured: boolean;
};

export type BackupVerification = {
  valid: boolean;
  fileExists: boolean;
  size: number;
  checksumStatus: string;
  archiveReadable: boolean;
  verifiedAt: string;
  status: string;
};

export function fetchBackups(token: string) {
  return apiRequest<BackupRecord[]>('/backups', { token });
}

export function fetchBackupStatistics(token: string) {
  return apiRequest<BackupStatistics>('/backups/statistics', { token });
}

export function createBackup(token: string) {
  return apiRequest<BackupRecord>('/backups', { method: 'POST', token });
}

export function verifyBackup(token: string, id: string) {
  return apiRequest<BackupVerification>(`/backups/${id}/verify`, {
    method: 'POST',
    token,
  });
}

export function restoreBackup(
  token: string,
  id: string,
  body: {
    confirmationText: string;
    reason: string;
    currentPassword: string;
  },
) {
  return apiRequest<{ ok: boolean }>(`/backups/${id}/restore`, {
    method: 'POST',
    token,
    body,
  });
}

export function deleteBackup(token: string, id: string) {
  return apiRequest<BackupRecord>(`/backups/${id}`, {
    method: 'DELETE',
    token,
  });
}

export function cleanupBackups(token: string) {
  return apiRequest<{ deleted: number; retentionDays: number }>(
    '/backups/cleanup',
    { method: 'POST', token },
  );
}

export function fetchBackupScheduleStatus(token: string) {
  return apiRequest<BackupScheduleStatus>('/backups/schedule/status', {
    token,
  });
}

export function updateBackupSchedule(
  token: string,
  body: { autoEnabled?: boolean; retentionDays?: number },
) {
  return apiRequest<{ autoEnabled: boolean; retentionDays: number; note: string }>(
    '/backups/schedule',
    { method: 'POST', token, body },
  );
}

export async function downloadBackup(token: string, id: string, fileName: string) {
  const base = import.meta.env.VITE_API_URL as string;
  const response = await fetch(`${base}/backups/${id}/download`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    throw new Error('Download failed');
  }
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function fetchMaintenanceStatus(token?: string | null) {
  return apiRequest<{ enabled: boolean; message: string }>(
    '/system/maintenance/status',
    token ? { token } : undefined,
  );
}

export function enableMaintenance(token: string, message?: string) {
  return apiRequest<{ enabled: boolean; message: string }>(
    '/system/maintenance/enable',
    { method: 'POST', token, body: { message } },
  );
}

export function disableMaintenance(token: string) {
  return apiRequest<{ enabled: boolean; message: string }>(
    '/system/maintenance/disable',
    { method: 'POST', token },
  );
}
