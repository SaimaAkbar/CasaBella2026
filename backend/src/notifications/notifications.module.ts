import { Module } from '@nestjs/common';
import { NotificationGeneratorService } from './notification-generator.service';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';

@Module({
  controllers: [NotificationsController],
  providers: [NotificationsService, NotificationGeneratorService],
  exports: [NotificationsService, NotificationGeneratorService],
})
export class NotificationsModule {}
