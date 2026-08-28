import { Module } from '@nestjs/common';
import { AvailabilityModule } from '../availability/availability.module';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { GuestsModule } from '../guests/guests.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PaymentsModule } from '../payments/payments.module';
import { SettingsModule } from '../settings/settings.module';
import {
  TenantUnitAssignmentsController,
  TenantUnitHotelUseController,
} from './tenant-unit-hotel-use.controller';
import { TenantUnitHotelUseService } from './tenant-unit-hotel-use.service';

@Module({
  imports: [
    AvailabilityModule,
    AuditLogsModule,
    GuestsModule,
    NotificationsModule,
    PaymentsModule,
    SettingsModule,
  ],
  controllers: [TenantUnitHotelUseController, TenantUnitAssignmentsController],
  providers: [TenantUnitHotelUseService],
  exports: [TenantUnitHotelUseService],
})
export class TenantUnitHotelUseModule {}
