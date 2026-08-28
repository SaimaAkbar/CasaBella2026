import { Module } from '@nestjs/common';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { SettingsModule } from '../settings/settings.module';
import { OwnerMonthlyStatementsController } from './owner-monthly-statements.controller';
import { OwnerMonthlyStatementsService } from './owner-monthly-statements.service';
import { OwnerPaymentsController } from './owner-payments.controller';
import { OwnerPaymentsService } from './owner-payments.service';
import { OwnerUnitAssignmentsController } from './owner-unit-assignments.controller';
import { OwnerUnitAssignmentsService } from './owner-unit-assignments.service';
import { OwnersController } from './owners.controller';
import { OwnersService } from './owners.service';

@Module({
  imports: [AuditLogsModule, SettingsModule],
  controllers: [
    OwnersController,
    OwnerUnitAssignmentsController,
    OwnerMonthlyStatementsController,
    OwnerPaymentsController,
  ],
  providers: [
    OwnersService,
    OwnerUnitAssignmentsService,
    OwnerMonthlyStatementsService,
    OwnerPaymentsService,
  ],
  exports: [
    OwnersService,
    OwnerUnitAssignmentsService,
    OwnerMonthlyStatementsService,
    OwnerPaymentsService,
  ],
})
export class OwnersModule {}
