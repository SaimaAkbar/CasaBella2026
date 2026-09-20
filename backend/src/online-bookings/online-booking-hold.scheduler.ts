import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { OnlineBookingsService } from './online-bookings.service';

@Injectable()
export class OnlineBookingHoldScheduler {
  private readonly logger = new Logger(OnlineBookingHoldScheduler.name);

  constructor(private readonly onlineBookings: OnlineBookingsService) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async expireHolds() {
    try {
      const result = await this.onlineBookings.expireStaleHolds();
      if (result.expired > 0) {
        this.logger.log(
          `Expired ${result.expired} unpaid ONLINE booking hold(s)`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Failed to expire online booking holds: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }
}
