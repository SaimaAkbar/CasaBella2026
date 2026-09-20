import { Module } from '@nestjs/common';
import { ReceiptsModule } from '../receipts/receipts.module';
import { SettingsModule } from '../settings/settings.module';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';

@Module({
  imports: [SettingsModule, ReceiptsModule],
  controllers: [PaymentsController],
  providers: [PaymentsService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
