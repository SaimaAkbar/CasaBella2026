import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { ApprovalApplicatorService } from './approval-applicator.service';
import { ApprovalRecordSnapshotService } from './approval-record-snapshot.service';
import { ApprovalsController } from './approvals.controller';
import { ApprovalsService } from './approvals.service';
import { StaffApprovalGateInterceptor } from './staff-approval-gate.interceptor';

@Module({
  imports: [AuditLogsModule, NotificationsModule, AuthModule],
  controllers: [ApprovalsController],
  providers: [
    ApprovalsService,
    ApprovalApplicatorService,
    StaffApprovalGateInterceptor,
    ApprovalRecordSnapshotService,
  ],
  exports: [
    ApprovalsService,
    ApprovalApplicatorService,
    StaffApprovalGateInterceptor,
    ApprovalRecordSnapshotService,
  ],
})
export class ApprovalsModule {}
