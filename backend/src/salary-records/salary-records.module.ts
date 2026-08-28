import { Module } from '@nestjs/common';
import { SalaryTransactionsModule } from '../salary-transactions/salary-transactions.module';
import { SalaryRecordsController } from './salary-records.controller';
import { SalaryRecordsService } from './salary-records.service';

@Module({
  imports: [SalaryTransactionsModule],
  controllers: [SalaryRecordsController],
  providers: [SalaryRecordsService],
  exports: [SalaryRecordsService],
})
export class SalaryRecordsModule {}
