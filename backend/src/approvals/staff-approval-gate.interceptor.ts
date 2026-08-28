import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import type { Request } from 'express';
import { from, type Observable } from 'rxjs';
import {
  ApprovalActionType,
  ApprovalPriority,
  Role,
} from '../../generated/prisma/client';
import type { AuthUser } from '../common/types/auth-user.type';
import { extractAuditContext } from '../common/utils/request-meta';
import { ApprovalRecordSnapshotService } from './approval-record-snapshot.service';
import { ApprovalsService } from './approvals.service';
import {
  APPROVAL_REPLAY_HEADER,
  HTTP_REPLAY_KIND,
  actionTypeFromRequest,
  moduleNameFromPath,
  normalizeRoute,
  recordIdFromPath,
  reasonFromBody,
  shouldQueueStaffMutation,
  type HttpReplayPayload,
} from './staff-mutation-approval';

@Injectable()
export class StaffApprovalGateInterceptor implements NestInterceptor {
  constructor(
    private readonly approvals: ApprovalsService,
    private readonly snapshots: ApprovalRecordSnapshotService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>();
    const user = request.user as AuthUser | undefined;
    const method = request.method;
    const path = normalizeRoute(request.path || request.url || '/');

    if (request.headers[APPROVAL_REPLAY_HEADER]) {
      return next.handle();
    }

    if (
      !user ||
      (user.role !== Role.ADMIN && user.role !== Role.RECEPTIONIST) ||
      !shouldQueueStaffMutation(method, path)
    ) {
      return next.handle();
    }

    return from(this.queue(request, user));
  }

  private async queue(request: Request, user: AuthUser) {
    const method = request.method.toUpperCase();
    const path = normalizeRoute(request.path || request.url || '/');
    const payload: HttpReplayPayload = {
      kind: HTTP_REPLAY_KIND,
      method,
      path,
      query: (request.query ?? {}) as Record<string, unknown>,
      body: request.body,
    };
    const actionType = actionTypeFromRequest(method, path);
    const moduleName = moduleNameFromPath(path);
    const recordId = recordIdFromPath(method, path);
    const oldData =
      actionType === ApprovalActionType.CREATE
        ? null
        : await this.snapshots.capture(moduleName, recordId, path);
    const moduleLabel = moduleName.replaceAll('_', ' ').toLowerCase();

    return this.approvals.submit({
      moduleName,
      recordId,
      actionType,
      actor: user,
      oldData,
      newData: payload,
      reason:
        reasonFromBody(request.body) ??
        `${user.fullName} requested ${actionType.toLowerCase()} on ${moduleLabel}`,
      priority:
        actionType === ApprovalActionType.DELETE ||
        actionType === ApprovalActionType.ARCHIVE
          ? ApprovalPriority.HIGH
          : ApprovalPriority.NORMAL,
      context: extractAuditContext(request),
    });
  }
}
