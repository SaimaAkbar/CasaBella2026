import { Module } from '@nestjs/common';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { SettingsModule } from '../settings/settings.module';
import { BackupSchedulerService } from './backup-scheduler.service';
import { BackupsController } from './backups.controller';
import { BackupsService } from './backups.service';

@Module({
  imports: [AuditLogsModule, NotificationsModule, SettingsModule],
  controllers: [BackupsController],
  providers: [BackupsService, BackupSchedulerService],
  exports: [BackupsService],
})
export class BackupsModule {}
