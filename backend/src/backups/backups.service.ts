import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { createHash } from 'crypto';
import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as bcrypt from 'bcrypt';
import {
  BackupStatus,
  BackupStorageType,
  BackupType,
  RestoreStatus,
  Role,
  Status,
} from '../../generated/prisma/client';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import type { AuditContext } from '../common/types/audit-context.type';
import type { AuthUser } from '../common/types/auth-user.type';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import {
  NotificationPriority,
  NotificationType,
} from '../../generated/prisma/client';
import {
  assertInsideBackupDir,
  assertSafeFileName,
  getBackupDirectory,
  parseDatabaseUrl,
} from './backup-paths';
import { RestoreBackupDto } from './dto/restore-backup.dto';
import { UpdateBackupScheduleDto } from './dto/update-backup-schedule.dto';

@Injectable()
export class BackupsService {
  private restoreInProgress = false;
  private backupInProgress = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogs: AuditLogsService,
    private readonly notifications: NotificationsService,
    private readonly settings: SettingsService,
  ) {}

  isBusy() {
    return this.restoreInProgress || this.backupInProgress;
  }

  private assertSuperAdmin(user: AuthUser) {
    if (user.role !== Role.SUPER_ADMIN) {
      throw new ForbiddenException('Only Super Admin can manage backups');
    }
  }

  async list(user: AuthUser) {
    this.assertSuperAdmin(user);
    const rows = await this.prisma.backupRecord.findMany({
      where: { status: { not: BackupStatus.DELETED } },
      orderBy: { createdAt: 'desc' },
      include: {
        createdBy: { select: { id: true, fullName: true, email: true } },
      },
      take: 100,
    });
    return rows.map((row) => this.serialize(row));
  }

  async statistics(user: AuthUser) {
    this.assertSuperAdmin(user);
    const rows = await this.prisma.backupRecord.findMany({
      where: { status: { not: BackupStatus.DELETED } },
      select: {
        status: true,
        fileSizeBytes: true,
        completedAt: true,
        backupType: true,
      },
    });

    const completed = rows.filter((r) => r.status === BackupStatus.COMPLETED);
    const failed = rows.filter((r) => r.status === BackupStatus.FAILED);
    const last = completed
      .slice()
      .sort(
        (a, b) =>
          (b.completedAt?.getTime() ?? 0) - (a.completedAt?.getTime() ?? 0),
      )[0];

    const storageUsed = completed.reduce(
      (sum, row) => sum + Number(row.fileSizeBytes ?? 0n),
      0,
    );

    return {
      totalBackups: rows.length,
      failedBackups: failed.length,
      storageUsedBytes: storageUsed,
      lastSuccessfulBackupAt: last?.completedAt?.toISOString() ?? null,
      retentionDays: Number(process.env.BACKUP_RETENTION_DAYS ?? 30),
      autoBackupEnabled:
        process.env.AUTO_BACKUP_ENABLED === 'true' ||
        (await this.settings.getBoolean('backup.autoEnabled', false)),
      autoBackupCron: process.env.AUTO_BACKUP_CRON || '0 2 * * *',
      backupDirectoryConfigured: Boolean(process.env.BACKUP_DIRECTORY),
      scheduledBackupStatus:
        process.env.AUTO_BACKUP_ENABLED === 'true' ||
        (await this.settings.getBoolean('backup.autoEnabled', false))
          ? 'ENABLED'
          : 'DISABLED',
    };
  }

  async getOne(id: string, user: AuthUser) {
    this.assertSuperAdmin(user);
    const row = await this.prisma.backupRecord.findUnique({
      where: { id },
      include: {
        createdBy: { select: { id: true, fullName: true, email: true } },
      },
    });
    if (!row || row.status === BackupStatus.DELETED) {
      throw new NotFoundException('Backup not found');
    }
    return this.serialize(row);
  }

  async updateScheduleSettings(
    user: AuthUser,
    dto: UpdateBackupScheduleDto,
    context?: AuditContext,
  ) {
    this.assertSuperAdmin(user);

    if (dto.autoEnabled !== undefined) {
      await this.settings.updateOne('backup.autoEnabled', dto.autoEnabled, user, {
        reason: dto.notes ?? 'Backup schedule update',
        context,
      });
    }

    if (dto.retentionDays !== undefined) {
      await this.settings.updateOne(
        'backup.retentionDays',
        dto.retentionDays,
        user,
        {
          reason: dto.notes ?? 'Backup retention update',
          context,
        },
      );
    }

    await this.auditLogs.write({
      module: 'BACKUPS',
      action: 'SCHEDULE_UPDATED',
      userId: user.id,
      role: user.role,
      newData: {
        autoEnabled: dto.autoEnabled,
        retentionDays: dto.retentionDays,
      },
      context,
    });

    return {
      autoEnabled: await this.settings.getBoolean('backup.autoEnabled', false),
      retentionDays: await this.settings.getNumber(
        'backup.retentionDays',
        Number(process.env.BACKUP_RETENTION_DAYS ?? 30),
      ),
      note: 'Cron expression is controlled by AUTO_BACKUP_CRON env (default 02:00 Asia/Karachi). Set AUTO_BACKUP_ENABLED=true or enable backup.autoEnabled.',
    };
  }

  async createManualBackup(user: AuthUser, notes?: string, context?: AuditContext) {
    this.assertSuperAdmin(user);
    return this.runBackup(BackupType.MANUAL, user.id, notes, context);
  }

  async createScheduledBackup(userId: string) {
    return this.runBackup(
      BackupType.SCHEDULED,
      userId,
      'Automatic scheduled backup',
    );
  }

  async createPreRestoreBackup(userId: string) {
    return this.runBackup(BackupType.PRE_RESTORE, userId, 'Automatic pre-restore backup');
  }

  private async runBackup(
    backupType: BackupType,
    userId: string,
    notes?: string,
    context?: AuditContext,
  ) {
    if (this.backupInProgress) {
      throw new ConflictException('A backup is already in progress');
    }
    this.backupInProgress = true;

    try {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      throw new ServiceUnavailableException('DATABASE_URL is not configured');
    }

    const db = parseDatabaseUrl(databaseUrl);
    if (!db.database || !/^[A-Za-z0-9_-]+$/.test(db.database)) {
      throw new BadRequestException('Invalid database name');
    }

    const backupNumber = await this.nextBackupNumber();
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = assertSafeFileName(`${backupNumber}-${stamp}.backup`);
    const filePath = path.join(getBackupDirectory(), fileName);

    const record = await this.prisma.backupRecord.create({
      data: {
        backupNumber,
        backupType,
        storageType: BackupStorageType.LOCAL,
        fileName,
        filePath,
        databaseName: db.database,
        applicationVersion: process.env.APPLICATION_VERSION ?? '1.0.0',
        status: BackupStatus.PENDING,
        notes,
        createdByUserId: userId,
      },
    });

    await this.prisma.backupRecord.update({
      where: { id: record.id },
      data: { status: BackupStatus.IN_PROGRESS },
    });

    try {
      await this.execPgTool(
        process.env.PG_DUMP_PATH || 'pg_dump',
        [
          '-h',
          db.host,
          '-p',
          db.port,
          '-U',
          db.user,
          '-d',
          db.database,
          '-F',
          'c',
          '-f',
          filePath,
        ],
        db.password,
      );

      const stat = fs.statSync(filePath);
      if (stat.size <= 0) {
        throw new Error('Backup file is empty');
      }
      const checksum = await this.checksumFile(filePath);

      const completed = await this.prisma.backupRecord.update({
        where: { id: record.id },
        data: {
          status: BackupStatus.COMPLETED,
          completedAt: new Date(),
          fileSizeBytes: BigInt(stat.size),
          checksum,
        },
        include: {
          createdBy: { select: { id: true, fullName: true, email: true } },
        },
      });

      await this.notifications.notifySuperAdmins({
        type: NotificationType.SUCCESS,
        title: 'Backup completed',
        message: `Backup ${backupNumber} completed successfully.`,
        relatedModule: 'BACKUPS',
        relatedId: completed.id,
        actionUrl: '/backups',
        priority: NotificationPriority.NORMAL,
      });

      await this.auditLogs.write({
        module: 'BACKUPS',
        action: 'BACKUP_CREATED',
        recordId: completed.id,
        userId,
        role: Role.SUPER_ADMIN,
        newData: {
          backupNumber,
          backupType,
          fileName,
          fileSizeBytes: Number(stat.size),
        },
        context,
      });

      return this.serialize(completed);
    } catch (error) {
      const reason =
        error instanceof Error ? error.message : 'Backup failed';
      try {
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      } catch {
        // ignore cleanup errors
      }

      await this.prisma.backupRecord.update({
        where: { id: record.id },
        data: {
          status: BackupStatus.FAILED,
          failureReason: reason.slice(0, 500),
          completedAt: new Date(),
        },
      });

      await this.notifications.notifySuperAdmins({
        type: NotificationType.ERROR,
        title: 'Backup failed',
        message: `Backup ${backupNumber} failed.`,
        relatedModule: 'BACKUPS',
        relatedId: record.id,
        actionUrl: '/backups',
        priority: NotificationPriority.CRITICAL,
      });

      await this.auditLogs.write({
        module: 'BACKUPS',
        action: 'BACKUP_FAILED',
        recordId: record.id,
        userId,
        role: Role.SUPER_ADMIN,
        newData: { backupNumber, reason: reason.slice(0, 200) },
        context,
      });

      throw new ServiceUnavailableException('Backup failed');
    }
    } finally {
      this.backupInProgress = false;
    }
  }

  async verify(id: string, user: AuthUser) {
    this.assertSuperAdmin(user);
    const row = await this.prisma.backupRecord.findUnique({ where: { id } });
    if (!row || row.status === BackupStatus.DELETED) {
      throw new NotFoundException('Backup not found');
    }

    const filePath = assertInsideBackupDir(row.filePath);
    const exists = fs.existsSync(filePath);
    const size = exists ? fs.statSync(filePath).size : 0;
    let checksumStatus: 'match' | 'mismatch' | 'missing' | 'skipped' = 'skipped';
    if (exists && row.checksum) {
      const current = await this.checksumFile(filePath);
      checksumStatus = current === row.checksum ? 'match' : 'mismatch';
    } else if (!row.checksum) {
      checksumStatus = 'missing';
    }

    let archiveReadable = false;
    if (exists && size > 0 && row.status === BackupStatus.COMPLETED) {
      try {
        const databaseUrl = process.env.DATABASE_URL!;
        const db = parseDatabaseUrl(databaseUrl);
        await this.execPgTool(
          process.env.PG_RESTORE_PATH || 'pg_restore',
          ['-l', filePath],
          db.password,
        );
        archiveReadable = true;
      } catch {
        archiveReadable = false;
      }
    }

    const valid =
      exists &&
      size > 0 &&
      row.status === BackupStatus.COMPLETED &&
      checksumStatus !== 'mismatch' &&
      archiveReadable;

    return {
      valid,
      fileExists: exists,
      size,
      checksumStatus,
      archiveReadable,
      verifiedAt: new Date().toISOString(),
      status: row.status,
    };
  }

  async getDownloadStream(id: string, user: AuthUser) {
    this.assertSuperAdmin(user);
    const row = await this.prisma.backupRecord.findUnique({ where: { id } });
    if (!row || row.status !== BackupStatus.COMPLETED) {
      throw new NotFoundException('Completed backup not found');
    }
    const filePath = assertInsideBackupDir(row.filePath);
    if (!fs.existsSync(filePath)) {
      throw new NotFoundException('Backup file missing on disk');
    }

    await this.auditLogs.write({
      module: 'BACKUPS',
      action: 'BACKUP_DOWNLOADED',
      recordId: row.id,
      userId: user.id,
      role: user.role,
      newData: { backupNumber: row.backupNumber, fileName: row.fileName },
    });

    return {
      fileName: row.fileName,
      stream: fs.createReadStream(filePath),
    };
  }

  async restore(id: string, dto: RestoreBackupDto, user: AuthUser, context?: AuditContext) {
    this.assertSuperAdmin(user);
    if (this.restoreInProgress) {
      throw new ConflictException('A restore is already in progress');
    }
    if (dto.confirmationText !== 'RESTORE DATABASE') {
      throw new BadRequestException(
        'confirmationText must be exactly RESTORE DATABASE',
      );
    }

    const fullUser = await this.prisma.user.findUnique({ where: { id: user.id } });
    if (!fullUser) throw new ForbiddenException('User not found');
    const passwordOk = await bcrypt.compare(dto.currentPassword, fullUser.password);
    if (!passwordOk) {
      throw new ForbiddenException('Invalid credentials');
    }

    const verification = await this.verify(id, user);
    if (!verification.valid) {
      throw new BadRequestException('Backup failed verification');
    }

    const backup = await this.prisma.backupRecord.findUnique({ where: { id } });
    if (!backup) throw new NotFoundException('Backup not found');

    this.restoreInProgress = true;
    const history = await this.prisma.restoreHistory.create({
      data: {
        backupId: id,
        status: RestoreStatus.IN_PROGRESS,
        reason: dto.reason,
        confirmationText: dto.confirmationText,
        restoredByUserId: user.id,
      },
    });

    let preRestoreId: string | undefined;
    try {
      await this.settings.updateOne(
        'system.maintenanceMode',
        true,
        user,
        { reason: 'Entered for restore', context },
      );

      const pre = await this.createPreRestoreBackup(user.id);
      preRestoreId = pre.id;

      const databaseUrl = process.env.DATABASE_URL!;
      const db = parseDatabaseUrl(databaseUrl);
      const filePath = assertInsideBackupDir(backup.filePath);

      await this.prisma.$disconnect();
      await this.execPgTool(
        process.env.PG_RESTORE_PATH || 'pg_restore',
        [
          '-h',
          db.host,
          '-p',
          db.port,
          '-U',
          db.user,
          '-d',
          db.database,
          '--clean',
          '--if-exists',
          filePath,
        ],
        db.password,
      );
      await this.prisma.$connect();

      await this.prisma.$queryRaw`SELECT 1`;

      await this.prisma.restoreHistory.update({
        where: { id: history.id },
        data: {
          status: RestoreStatus.COMPLETED,
          completedAt: new Date(),
          preRestoreBackupId: preRestoreId,
        },
      });

      await this.prisma.backupRecord.update({
        where: { id },
        data: {
          restoredAt: new Date(),
          restoredByUserId: user.id,
        },
      });

      await this.settings.updateOne(
        'system.maintenanceMode',
        false,
        user,
        { reason: 'Exited after successful restore', context },
      );

      await this.notifications.notifySuperAdmins({
        type: NotificationType.SUCCESS,
        title: 'Restore completed',
        message: `Database restored from ${backup.backupNumber}.`,
        relatedModule: 'BACKUPS',
        relatedId: id,
        actionUrl: '/backups',
        priority: NotificationPriority.HIGH,
      });

      await this.auditLogs.write({
        module: 'BACKUPS',
        action: 'BACKUP_RESTORED',
        recordId: id,
        userId: user.id,
        role: user.role,
        newData: {
          backupNumber: backup.backupNumber,
          reason: dto.reason,
          preRestoreBackupId: preRestoreId,
        },
        context,
      });

      return { ok: true, preRestoreBackupId: preRestoreId };
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'Restore failed';
      try {
        await this.prisma.$connect();
      } catch {
        // ignore
      }
      await this.prisma.restoreHistory.update({
        where: { id: history.id },
        data: {
          status: RestoreStatus.FAILED,
          failureReason: reason.slice(0, 500),
          completedAt: new Date(),
          preRestoreBackupId: preRestoreId,
        },
      });
      try {
        await this.settings.updateOne(
          'system.maintenanceMode',
          false,
          user,
          { reason: 'Exited after failed restore', context },
        );
      } catch {
        // keep maintenance if settings unavailable
      }

      await this.notifications.notifySuperAdmins({
        type: NotificationType.ERROR,
        title: 'Restore failed',
        message: `Restore from ${backup.backupNumber} failed. Pre-restore backup was preserved.`,
        relatedModule: 'BACKUPS',
        relatedId: id,
        actionUrl: '/backups',
        priority: NotificationPriority.CRITICAL,
      });

      throw new ServiceUnavailableException(
        'Restore failed. See DISASTER_RECOVERY.md for manual recovery steps.',
      );
    } finally {
      this.restoreInProgress = false;
    }
  }

  async delete(id: string, user: AuthUser, context?: AuditContext) {
    this.assertSuperAdmin(user);
    if (this.restoreInProgress) {
      throw new ConflictException('Cannot delete while restore is in progress');
    }
    const row = await this.prisma.backupRecord.findUnique({ where: { id } });
    if (!row || row.status === BackupStatus.DELETED) {
      throw new NotFoundException('Backup not found');
    }

    try {
      const filePath = assertInsideBackupDir(row.filePath);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    } catch {
      // still mark deleted
    }

    const updated = await this.prisma.backupRecord.update({
      where: { id },
      data: { status: BackupStatus.DELETED },
      include: {
        createdBy: { select: { id: true, fullName: true, email: true } },
      },
    });

    await this.auditLogs.write({
      module: 'BACKUPS',
      action: 'BACKUP_DELETED',
      recordId: id,
      userId: user.id,
      role: user.role,
      oldData: { backupNumber: row.backupNumber, fileName: row.fileName },
      context,
    });

    return this.serialize(updated);
  }

  async cleanup(user: AuthUser, context?: AuditContext) {
    this.assertSuperAdmin(user);
    return this.cleanupInternal(user.id, user.role, context);
  }

  /** Used by scheduler without AuthUser object. */
  async cleanupAsSystem(superAdminUserId: string) {
    return this.cleanupInternal(superAdminUserId, Role.SUPER_ADMIN);
  }

  private async cleanupInternal(
    userId: string,
    role: Role,
    context?: AuditContext,
  ) {
    const days = Number(process.env.BACKUP_RETENTION_DAYS ?? 30);
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const latest = await this.prisma.backupRecord.findFirst({
      where: { status: BackupStatus.COMPLETED },
      orderBy: { completedAt: 'desc' },
    });

    const failedRestores = await this.prisma.restoreHistory.findMany({
      where: { status: RestoreStatus.FAILED },
      select: { backupId: true, preRestoreBackupId: true },
    });
    const protectedIds = new Set<string>();
    for (const row of failedRestores) {
      protectedIds.add(row.backupId);
      if (row.preRestoreBackupId) protectedIds.add(row.preRestoreBackupId);
    }
    if (latest) protectedIds.add(latest.id);

    const candidates = await this.prisma.backupRecord.findMany({
      where: {
        status: { in: [BackupStatus.COMPLETED, BackupStatus.FAILED] },
        OR: [
          { completedAt: { lt: cutoff } },
          { status: BackupStatus.FAILED, startedAt: { lt: cutoff } },
        ],
        id: { notIn: Array.from(protectedIds) },
      },
    });

    let deleted = 0;
    const actor: AuthUser = {
      id: userId,
      fullName: 'System',
      email: 'system@local',
      phone: '',
      role,
      status: Status.ACTIVE,
      canAccessSalary: true,
      canAccessProfitLoss: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    for (const row of candidates) {
      await this.delete(row.id, actor, context);
      deleted += 1;
    }

    await this.auditLogs.write({
      module: 'BACKUPS',
      action: 'BACKUP_CLEANUP',
      userId,
      role,
      newData: { deleted, retentionDays: days },
      context,
    });

    return { deleted, retentionDays: days };
  }

  private async nextBackupNumber() {
    const now = new Date();
    const yyyy = now.getUTCFullYear();
    const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(now.getUTCDate()).padStart(2, '0');
    const dateKey = `${yyyy}${mm}${dd}`;
    const settingKey = `backup_seq_${dateKey}`;

    const rows = await this.prisma.$queryRaw<Array<{ value: string }>>`
      INSERT INTO "SystemSetting" (key, value, "createdAt", "updatedAt")
      VALUES (${settingKey}, '1', NOW(), NOW())
      ON CONFLICT (key)
      DO UPDATE SET
        value = (CAST("SystemSetting".value AS INTEGER) + 1)::text,
        "updatedAt" = NOW()
      RETURNING value
    `;
    const seq = String(rows[0]?.value ?? '1').padStart(4, '0');
    return `BKP-${dateKey}-${seq}`;
  }

  private execPgTool(command: string, args: string[], password: string) {
    return new Promise<void>((resolve, reject) => {
      const child = spawn(command, args, {
        shell: false,
        env: {
          ...process.env,
          PGPASSWORD: password,
          PGSSLMODE: process.env.PGSSLMODE,
        },
      });

      let stderr = '';
      child.stderr.on('data', (chunk: Buffer) => {
        stderr += chunk.toString('utf8');
      });
      child.on('error', (err) => reject(err));
      child.on('close', (code) => {
        if (code === 0) resolve();
        else reject(new Error(stderr.slice(0, 300) || `Command failed: ${command}`));
      });
    });
  }

  private async checksumFile(filePath: string) {
    return new Promise<string>((resolve, reject) => {
      const hash = createHash('sha256');
      const stream = fs.createReadStream(filePath);
      stream.on('data', (chunk) => hash.update(chunk));
      stream.on('error', reject);
      stream.on('end', () => resolve(hash.digest('hex')));
    });
  }

  private serialize(row: {
    id: string;
    backupNumber: string;
    backupType: BackupType;
    storageType: BackupStorageType;
    fileName: string;
    filePath: string;
    fileSizeBytes: bigint | null;
    checksum: string | null;
    databaseName: string;
    databaseVersion: string | null;
    applicationVersion: string | null;
    status: BackupStatus;
    startedAt: Date;
    completedAt: Date | null;
    failureReason: string | null;
    notes: string | null;
    createdByUserId: string;
    restoredByUserId: string | null;
    restoredAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
    createdBy?: { id: string; fullName: string; email: string } | null;
  }) {
    return {
      id: row.id,
      backupNumber: row.backupNumber,
      backupType: row.backupType,
      storageType: row.storageType,
      fileName: row.fileName,
      fileSizeBytes: row.fileSizeBytes != null ? Number(row.fileSizeBytes) : null,
      checksum: row.checksum,
      databaseName: row.databaseName,
      databaseVersion: row.databaseVersion,
      applicationVersion: row.applicationVersion,
      status: row.status,
      startedAt: row.startedAt.toISOString(),
      completedAt: row.completedAt?.toISOString() ?? null,
      failureReason: row.failureReason,
      notes: row.notes,
      createdByUserId: row.createdByUserId,
      restoredByUserId: row.restoredByUserId,
      restoredAt: row.restoredAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      createdBy: row.createdBy ?? null,
      // Never expose absolute server path to clients
      hasFile: true,
    };
  }
}
