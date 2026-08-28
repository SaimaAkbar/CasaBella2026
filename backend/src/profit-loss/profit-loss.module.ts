import { Module } from '@nestjs/common';
import { FinancialSummaryService } from './financial-summary.service';
import { ProfitLossController } from './profit-loss.controller';
import { ProfitLossService } from './profit-loss.service';

@Module({
  controllers: [ProfitLossController],
  providers: [ProfitLossService, FinancialSummaryService],
  exports: [ProfitLossService, FinancialSummaryService],
})
export class ProfitLossModule {}
