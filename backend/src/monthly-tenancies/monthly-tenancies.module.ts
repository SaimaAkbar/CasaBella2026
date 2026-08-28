import { Module } from '@nestjs/common';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { MonthlyTenantsModule } from '../monthly-tenants/monthly-tenants.module';
import { PaymentsModule } from '../payments/payments.module';
import {
  MonthlyTenanciesController,
  MonthlyUnitAssignmentsController,
} from './monthly-tenancies.controller';
import { MonthlyTenanciesService } from './monthly-tenancies.service';

@Module({
  imports: [MonthlyTenantsModule, PaymentsModule, AuditLogsModule],
  controllers: [MonthlyTenanciesController, MonthlyUnitAssignmentsController],
  providers: [MonthlyTenanciesService],
  exports: [MonthlyTenanciesService],
})
export class MonthlyTenanciesModule {}
