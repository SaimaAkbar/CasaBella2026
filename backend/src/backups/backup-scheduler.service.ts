import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { Role, Status } from '../../generated/prisma/client';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import { BackupsService } from './backups.service';

@Injectable()
export class BackupSchedulerService {
  private readonly logger = new Logger(BackupSchedulerService.name);
  private running = false;
  private lastRunAt: Date | null = null;
  private lastRunStatus: 'SUCCESS' | 'FAILED' | 'SKIPPED' | null = null;

  constructor(
    private readonly backups: BackupsService,
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
    private readonly auditLogs: AuditLogsService,
  ) {}

  /** Daily 02:00 Asia/Karachi — also gated by AUTO_BACKUP_ENABLED / settings. */
  @Cron(process.env.AUTO_BACKUP_CRON || '0 2 * * *', {
    timeZone: 'Asia/Karachi',
    name: 'scheduled-database-backup',
  })
  async handleScheduledBackup() {
    const enabled =
      process.env.AUTO_BACKUP_ENABLED === 'true' ||
      (await this.settings.getBoolean('backup.autoEnabled', false));

    if (!enabled) {
      return;
    }

    if (this.running || this.backups.isBusy()) {
      this.logger.warn('Skipping scheduled backup — another job is in progress');
      this.lastRunStatus = 'SKIPPED';
      return;
    }

    this.running = true;
    try {
      const superAdmin = await this.prisma.user.findFirst({
        where: { role: Role.SUPER_ADMIN, status: Status.ACTIVE },
        orderBy: { createdAt: 'asc' },
      });

      if (!superAdmin) {
        this.logger.error('No active Super Admin found for scheduled backup');
        this.lastRunStatus = 'FAILED';
        return;
      }

      await this.backups.createScheduledBackup(superAdmin.id);
      this.lastRunAt = new Date();
      this.lastRunStatus = 'SUCCESS';

      await this.auditLogs.write({
        module: 'BACKUPS',
        action: 'SCHEDULED_BACKUP',
        userId: superAdmin.id,
        role: Role.SUPER_ADMIN,
        newData: { at: this.lastRunAt.toISOString() },
      });

      const retentionDays = Number(process.env.BACKUP_RETENTION_DAYS ?? 30);
      if (retentionDays > 0) {
        await this.backups.cleanupAsSystem(superAdmin.id);
      }
    } catch (error) {
      this.lastRunStatus = 'FAILED';
      this.lastRunAt = new Date();
      this.logger.error(
        `Scheduled backup failed: ${
          error instanceof Error ? error.message : 'unknown'
        }`,
      );
    } finally {
      this.running = false;
    }
  }

  getStatus() {
    const cron = process.env.AUTO_BACKUP_CRON || '0 2 * * *';
    return {
      autoBackupEnabledEnv: process.env.AUTO_BACKUP_ENABLED === 'true',
      cron,
      timezone: 'Asia/Karachi',
      retentionDays: Number(process.env.BACKUP_RETENTION_DAYS ?? 30),
      running: this.running,
      lastRunAt: this.lastRunAt?.toISOString() ?? null,
      lastRunStatus: this.lastRunStatus,
      nextRunHint: `Cron "${cron}" (Asia/Karachi)`,
      backupDirectoryConfigured: Boolean(process.env.BACKUP_DIRECTORY),
    };
  }
}
