import { Module } from '@nestjs/common';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { MonthlyTenantsModule } from '../monthly-tenants/monthly-tenants.module';
import { MonthlyAgreementsController } from './monthly-agreements.controller';
import { MonthlyAgreementsService } from './monthly-agreements.service';

@Module({
  imports: [MonthlyTenantsModule, AuditLogsModule],
  controllers: [MonthlyAgreementsController],
  providers: [MonthlyAgreementsService],
  exports: [MonthlyAgreementsService],
})
export class MonthlyAgreementsModule {}
