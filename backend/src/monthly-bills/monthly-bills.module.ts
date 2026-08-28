import { Module } from '@nestjs/common';
import { MonthlyBillsController } from './monthly-bills.controller';
import { MonthlyBillsService } from './monthly-bills.service';

@Module({
  controllers: [MonthlyBillsController],
  providers: [MonthlyBillsService],
  exports: [MonthlyBillsService],
})
export class MonthlyBillsModule {}
