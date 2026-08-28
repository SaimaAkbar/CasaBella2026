import { Module } from '@nestjs/common';
import { ApprovalsModule } from '../approvals/approvals.module';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { ExpenseCategoriesModule } from '../expense-categories/expense-categories.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { ExpensesController } from './expenses.controller';
import { ExpensesService } from './expenses.service';

@Module({
  imports: [
    ExpenseCategoriesModule,
    ApprovalsModule,
    AuditLogsModule,
    NotificationsModule,
  ],
  controllers: [ExpensesController],
  providers: [ExpensesService],
  exports: [ExpensesService],
})
export class ExpensesModule {}
