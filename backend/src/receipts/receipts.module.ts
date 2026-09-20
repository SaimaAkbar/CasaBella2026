import { Module } from '@nestjs/common';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { SettingsModule } from '../settings/settings.module';
import { LocalPrinterService } from './local-printer.service';
import { ReceiptNumberService } from './receipt-number.service';
import { ReceiptsController } from './receipts.controller';
import { ReceiptsService } from './receipts.service';

@Module({
  imports: [SettingsModule, AuditLogsModule],
  controllers: [ReceiptsController],
  providers: [ReceiptsService, ReceiptNumberService, LocalPrinterService],
  exports: [ReceiptsService, ReceiptNumberService],
})
export class ReceiptsModule {}
