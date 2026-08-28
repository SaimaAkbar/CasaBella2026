import { Module } from '@nestjs/common';
import { ExpensesModule } from '../expenses/expenses.module';
import { SalaryTransactionsController } from './salary-transactions.controller';
import { SalaryTransactionsService } from './salary-transactions.service';

@Module({
  imports: [ExpensesModule],
  controllers: [SalaryTransactionsController],
  providers: [SalaryTransactionsService],
  exports: [SalaryTransactionsService],
})
export class SalaryTransactionsModule {}
