import { Module } from '@nestjs/common';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { GuestsModule } from '../guests/guests.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PaymentsModule } from '../payments/payments.module';
import { MailService } from './mail.service';
import { OnlineBookingHoldScheduler } from './online-booking-hold.scheduler';
import {
  OnlineBookingsAdminController,
  PublicOnlineBookingsController,
  SafepayWebhookController,
} from './online-bookings.controller';
import { OnlineBookingsService } from './online-bookings.service';
import { OnlinePaymentGatewayService } from './online-payment-gateway.service';
import { SafepayService } from './safepay.service';
import { SettingsModule } from '../settings/settings.module';

@Module({
  imports: [
    GuestsModule,
    PaymentsModule,
    NotificationsModule,
    AuditLogsModule,
    SettingsModule,
  ],
  controllers: [
    PublicOnlineBookingsController,
    SafepayWebhookController,
    OnlineBookingsAdminController,
  ],
  providers: [
    OnlineBookingsService,
    SafepayService,
    OnlinePaymentGatewayService,
    MailService,
    OnlineBookingHoldScheduler,
  ],
  exports: [OnlineBookingsService, SafepayService, OnlinePaymentGatewayService],
})
export class OnlineBookingsModule {}
