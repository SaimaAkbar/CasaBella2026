import { Module } from '@nestjs/common';
import { ApprovalsModule } from '../approvals/approvals.module';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { AvailabilityModule } from '../availability/availability.module';
import { GuestsModule } from '../guests/guests.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PaymentsModule } from '../payments/payments.module';
import { SettingsModule } from '../settings/settings.module';
import { BookingsController } from './bookings.controller';
import { BookingsService } from './bookings.service';

@Module({
  imports: [
    GuestsModule,
    PaymentsModule,
    ApprovalsModule,
    AuditLogsModule,
    SettingsModule,
    NotificationsModule,
    AvailabilityModule,
  ],
  controllers: [BookingsController],
  providers: [BookingsService],
  exports: [BookingsService],
})
export class BookingsModule {}
