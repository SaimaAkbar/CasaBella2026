import { Module } from '@nestjs/common';
import { ApprovalsModule } from '../approvals/approvals.module';
import { ProfitLossModule } from '../profit-loss/profit-loss.module';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

@Module({
  imports: [ProfitLossModule, ApprovalsModule],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
