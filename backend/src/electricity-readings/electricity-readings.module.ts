import { Module } from '@nestjs/common';
import { ApprovalsModule } from '../approvals/approvals.module';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { ExpensesModule } from '../expenses/expenses.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { SettingsModule } from '../settings/settings.module';
import {
  ElectricityRatesController,
  ElectricityReadingsController,
} from './electricity-readings.controller';
import { ElectricityReadingsService } from './electricity-readings.service';

@Module({
  imports: [
    ExpensesModule,
    SettingsModule,
    AuditLogsModule,
    ApprovalsModule,
    NotificationsModule,
  ],
  controllers: [ElectricityReadingsController, ElectricityRatesController],
  providers: [ElectricityReadingsService],
  exports: [ElectricityReadingsService],
})
export class ElectricityReadingsModule {}
