import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ApprovalActionType,
  ApprovalModuleName,
  ApprovalPriority,
  ApprovalStatus,
  NotificationType,
  Prisma,
  Role,
} from '../../generated/prisma/client';
import {
  canAccessApprovals,
  canDecideApprovals,
  RECEPTIONIST_APPROVAL_BLOCKED_MODULES,
  type ApprovalModuleKey,
} from './approval-access';
import { ApprovalApplicatorService } from './approval-applicator.service';
import { ApprovalRecordSnapshotService } from './approval-record-snapshot.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import type { AuditContext } from '../common/types/audit-context.type';
import type { AuthUser } from '../common/types/auth-user.type';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateApprovalRequestDto } from './dto/create-approval-request.dto';
import { QueryApprovalRequestsDto } from './dto/query-approval-requests.dto';

export type SubmitApprovalInput = {
  moduleName: ApprovalModuleName;
  recordId: string;
  actionType: ApprovalActionType;
  actor: AuthUser;
  oldData?: unknown;
  newData?: unknown;
  reason?: string;
  priority?: ApprovalPriority;
  context?: AuditContext;
};

export type PendingApprovalResponse = {
  pendingApproval: true;
  message: string;
  approvalRequest: ReturnType<ApprovalsService['serialize']>;
};

const approvalInclude = {
  requestedBy: {
    select: { id: true, fullName: true, email: true, role: true },
  },
  approvedBy: {
    select: { id: true, fullName: true, email: true, role: true },
  },
} satisfies Prisma.ApprovalRequestInclude;

@Injectable()
export class ApprovalsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogs: AuditLogsService,
    private readonly notifications: NotificationsService,
    private readonly applicator: ApprovalApplicatorService,
    private readonly snapshots: ApprovalRecordSnapshotService,
  ) {}

  /**
   * Central entry used by every module.
   * SUPER_ADMIN → caller applies directly (returns null).
   * ADMIN / RECEPTIONIST → creates PENDING request (record unchanged).
   */
  async submit(input: SubmitApprovalInput): Promise<PendingApprovalResponse | null> {
    if (input.actor.role === Role.SUPER_ADMIN) {
      return null;
    }

    if (
      input.actor.role !== Role.ADMIN &&
      input.actor.role !== Role.RECEPTIONIST
    ) {
      throw new ForbiddenException(
        'Only Admin or Receptionist can submit approval requests',
      );
    }

    if (
      input.actor.role === Role.RECEPTIONIST &&
      RECEPTIONIST_APPROVAL_BLOCKED_MODULES.has(
        input.moduleName as ApprovalModuleKey,
      )
    ) {
      throw new ForbiddenException(
        'Receptionist cannot create approval requests for this module',
      );
    }

    const request = await this.createInternal(input);
    return {
      pendingApproval: true,
      message:
        'Change submitted for Super Admin approval. The record was not modified.',
      approvalRequest: request,
    };
  }

  async createFromApi(dto: CreateApprovalRequestDto, actor: AuthUser, context?: AuditContext) {
    if (actor.role === Role.SUPER_ADMIN) {
      throw new BadRequestException(
        'Super Admin applies changes directly; approval requests are not required',
      );
    }

    if (actor.role !== Role.ADMIN && actor.role !== Role.RECEPTIONIST) {
      throw new ForbiddenException('No access to approval requests');
    }

    return this.createInternal({
      moduleName: dto.moduleName,
      recordId: dto.recordId,
      actionType: dto.actionType,
      actor,
      oldData: dto.oldData,
      newData: dto.newData,
      reason: dto.reason,
      priority: dto.priority,
      context,
    });
  }

  private async createInternal(input: SubmitApprovalInput) {
    const pending = await this.prisma.approvalRequest.findFirst({
      where: {
        moduleName: input.moduleName,
        recordId: input.recordId,
        actionType: input.actionType,
        status: ApprovalStatus.PENDING,
      },
    });

    if (pending) {
      throw new ConflictException(
        'A pending approval already exists for this record and action',
      );
    }

    const created = await this.prisma.$transaction(async (tx) => {
      const row = await tx.approvalRequest.create({
        data: {
          moduleName: input.moduleName,
          recordId: input.recordId,
          actionType: input.actionType,
          requestedById: input.actor.id,
          requestedDate: new Date(),
          status: ApprovalStatus.PENDING,
          oldData:
            input.oldData === undefined
              ? undefined
              : input.oldData === null
                ? Prisma.DbNull
                : (input.oldData as Prisma.InputJsonValue),
          newData:
            input.newData === undefined
              ? undefined
              : input.newData === null
                ? Prisma.DbNull
                : (input.newData as Prisma.InputJsonValue),
          reason: input.reason?.trim() || null,
          priority: input.priority ?? ApprovalPriority.NORMAL,
        },
        include: approvalInclude,
      });

      await this.auditLogs.writeInTransaction(tx, {
        module: 'APPROVALS',
        action: 'CREATE_REQUEST',
        recordId: row.id,
        userId: input.actor.id,
        role: input.actor.role,
        oldData: input.oldData ?? null,
        newData: {
          moduleName: input.moduleName,
          recordId: input.recordId,
          actionType: input.actionType,
          payload: input.newData ?? null,
        },
        context: input.context,
      });

      await this.notifications.notifySuperAdmins(
        {
          type: NotificationType.APPROVAL_REQUESTED,
          title: 'New approval request',
          message: `${input.actor.fullName} requested ${input.actionType} on ${input.moduleName} (${input.recordId})`,
          relatedModule: 'APPROVALS',
          relatedId: row.id,
          actionUrl: '/approvals',
          icon: 'approval',
          priority: input.priority,
        },
        tx,
      );

      return row;
    });

    return this.serialize(created);
  }

  async findAll(query: QueryApprovalRequestsDto, actor: AuthUser) {
    if (!canAccessApprovals(actor.role)) {
      throw new ForbiddenException('No access to approval requests');
    }

    const where: Prisma.ApprovalRequestWhereInput = {};

    if (actor.role === Role.ADMIN) {
      where.requestedById = actor.id;
    } else if (query.requestedById) {
      where.requestedById = query.requestedById;
    }

    if (query.status) where.status = query.status;
    if (query.moduleName) where.moduleName = query.moduleName;
    if (query.priority) where.priority = query.priority;

    if (query.dateFrom || query.dateTo) {
      where.requestedDate = {};
      if (query.dateFrom) {
        where.requestedDate.gte = new Date(query.dateFrom);
      }
      if (query.dateTo) {
        const end = new Date(query.dateTo);
        end.setHours(23, 59, 59, 999);
        where.requestedDate.lte = end;
      }
    }

    if (query.search?.trim()) {
      const term = query.search.trim();
      where.OR = [
        { recordId: { contains: term, mode: 'insensitive' } },
        { reason: { contains: term, mode: 'insensitive' } },
        { rejectionReason: { contains: term, mode: 'insensitive' } },
        { requestedBy: { fullName: { contains: term, mode: 'insensitive' } } },
        { requestedBy: { email: { contains: term, mode: 'insensitive' } } },
      ];
    }

    const rows = await this.prisma.approvalRequest.findMany({
      where,
      include: approvalInclude,
      orderBy: [{ priority: 'desc' }, { requestedDate: 'desc' }],
      take: query.limit ?? 100,
      skip: query.offset ?? 0,
    });

    const withSnapshots = await Promise.all(
      rows.map(async (row) => {
        const oldData = await this.snapshots.backfillPending(row);
        return this.serialize({ ...row, oldData });
      }),
    );

    return withSnapshots;
  }

  async findOne(id: string, actor: AuthUser) {
    if (!canAccessApprovals(actor.role)) {
      throw new ForbiddenException('No access to approval requests');
    }

    const row = await this.prisma.approvalRequest.findUnique({
      where: { id },
      include: approvalInclude,
    });

    if (!row) {
      throw new NotFoundException('Approval request not found');
    }

    if (
      actor.role === Role.ADMIN &&
      row.requestedById !== actor.id
    ) {
      throw new ForbiddenException('Admin can only view own approval requests');
    }

    const oldData = await this.snapshots.backfillPending(row);
    return this.serialize({ ...row, oldData });
  }

  async approve(id: string, actor: AuthUser, context?: AuditContext) {
    if (!canDecideApprovals(actor.role)) {
      throw new ForbiddenException('Only Super Admin can approve requests');
    }

    const existing = await this.prisma.approvalRequest.findUnique({
      where: { id },
      include: approvalInclude,
    });

    if (!existing) {
      throw new NotFoundException('Approval request not found');
    }

    if (existing.status !== ApprovalStatus.PENDING) {
      throw new BadRequestException('Only PENDING requests can be approved');
    }

    const claimed = await this.prisma.approvalRequest.updateMany({
      where: { id, status: ApprovalStatus.PENDING },
      data: {
        status: ApprovalStatus.APPROVED,
        approvedById: actor.id,
        approvedDate: new Date(),
      },
    });

    if (claimed.count === 0) {
      throw new ConflictException('Approval request is no longer pending');
    }

    let applyResult: Awaited<ReturnType<ApprovalApplicatorService['apply']>>;

    const existingWithOld = {
      ...existing,
      oldData: await this.snapshots.backfillPending(existing),
    };

    try {
      applyResult = await this.applicator.apply(existingWithOld, actor.id);
    } catch (error) {
      await this.prisma.approvalRequest.update({
        where: { id },
        data: {
          status: ApprovalStatus.PENDING,
          approvedById: null,
          approvedDate: null,
        },
      });
      throw error;
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const row = await tx.approvalRequest.findUniqueOrThrow({
        where: { id },
        include: approvalInclude,
      });

      await this.auditLogs.writeInTransaction(tx, {
        module: existing.moduleName,
        action: `APPROVE_${existing.actionType}`,
        recordId: existing.recordId,
        userId: actor.id,
        role: actor.role,
        oldData: existingWithOld.oldData,
        newData: existing.newData,
        context,
      });

      await this.auditLogs.writeInTransaction(tx, {
        module: 'APPROVALS',
        action: 'APPROVE',
        recordId: id,
        userId: actor.id,
        role: actor.role,
        oldData: { status: ApprovalStatus.PENDING },
        newData: {
          status: ApprovalStatus.APPROVED,
          applied: applyResult.applied,
        },
        context,
      });

      await this.notifications.createInTransaction(tx, {
        userId: existing.requestedById,
        type: NotificationType.APPROVAL_APPROVED,
        title: 'Approval approved',
        message: `Your ${existing.actionType} request on ${existing.moduleName} was approved.`,
        relatedModule: 'APPROVALS',
        relatedId: id,
        actionUrl: '/approvals',
        icon: 'approval',
        priority: existing.priority,
      });

      return row;
    });

    return {
      ...this.serialize(updated),
      applyResult,
    };
  }

  async reject(
    id: string,
    rejectionReason: string,
    actor: AuthUser,
    context?: AuditContext,
  ) {
    if (!canDecideApprovals(actor.role)) {
      throw new ForbiddenException('Only Super Admin can reject requests');
    }

    const reason = rejectionReason.trim();
    if (!reason) {
      throw new BadRequestException('rejectionReason is required');
    }

    const existing = await this.prisma.approvalRequest.findUnique({
      where: { id },
      include: approvalInclude,
    });

    if (!existing) {
      throw new NotFoundException('Approval request not found');
    }

    if (existing.status !== ApprovalStatus.PENDING) {
      throw new BadRequestException('Only PENDING requests can be rejected');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const locked = await tx.approvalRequest.updateMany({
        where: { id, status: ApprovalStatus.PENDING },
        data: {
          status: ApprovalStatus.REJECTED,
          approvedById: actor.id,
          approvedDate: new Date(),
          rejectionReason: reason,
        },
      });

      if (locked.count === 0) {
        throw new ConflictException('Approval request is no longer pending');
      }

      const row = await tx.approvalRequest.findUniqueOrThrow({
        where: { id },
        include: approvalInclude,
      });

      await this.auditLogs.writeInTransaction(tx, {
        module: existing.moduleName,
        action: `REJECT_${existing.actionType}`,
        recordId: existing.recordId,
        userId: actor.id,
        role: actor.role,
        oldData: existing.oldData,
        newData: existing.newData,
        context,
      });

      await this.auditLogs.writeInTransaction(tx, {
        module: 'APPROVALS',
        action: 'REJECT',
        recordId: id,
        userId: actor.id,
        role: actor.role,
        oldData: { status: ApprovalStatus.PENDING },
        newData: { status: ApprovalStatus.REJECTED, rejectionReason: reason },
        context,
      });

      await this.notifications.createInTransaction(tx, {
        userId: existing.requestedById,
        type: NotificationType.APPROVAL_REJECTED,
        title: 'Approval rejected',
        message: `Your ${existing.actionType} request on ${existing.moduleName} was rejected: ${reason}`,
        relatedModule: 'APPROVALS',
        relatedId: id,
        actionUrl: '/approvals',
        icon: 'approval',
        priority: existing.priority,
      });

      return row;
    });

    return this.serialize(updated);
  }

  async getDashboardStats(role: Role, userId: string) {
    if (!canAccessApprovals(role)) {
      return null;
    }

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    const ownFilter =
      role === Role.ADMIN ? { requestedById: userId } : {};

    const [pendingApprovals, criticalRequests, rejectedToday, todaysActivity] =
      await Promise.all([
        this.prisma.approvalRequest.count({
          where: { status: ApprovalStatus.PENDING, ...ownFilter },
        }),
        this.prisma.approvalRequest.count({
          where: {
            status: ApprovalStatus.PENDING,
            priority: ApprovalPriority.CRITICAL,
            ...ownFilter,
          },
        }),
        this.prisma.approvalRequest.count({
          where: {
            status: ApprovalStatus.REJECTED,
            approvedDate: { gte: startOfDay, lte: endOfDay },
            ...ownFilter,
          },
        }),
        this.prisma.auditLog.count({
          where: {
            createdAt: { gte: startOfDay, lte: endOfDay },
            ...(role === Role.ADMIN ? { userId } : {}),
          },
        }),
      ]);

    return {
      pendingApprovals,
      criticalRequests,
      rejectedToday,
      todaysActivity,
    };
  }

  serialize(
    row: Prisma.ApprovalRequestGetPayload<{ include: typeof approvalInclude }>,
  ) {
    return {
      id: row.id,
      moduleName: row.moduleName,
      recordId: row.recordId,
      actionType: row.actionType,
      requestedById: row.requestedById,
      approvedById: row.approvedById,
      requestedDate: row.requestedDate.toISOString(),
      approvedDate: row.approvedDate?.toISOString() ?? null,
      status: row.status,
      oldData: row.oldData,
      newData: row.newData,
      reason: row.reason,
      rejectionReason: row.rejectionReason,
      priority: row.priority,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      requestedBy: row.requestedBy
        ? {
            id: row.requestedBy.id,
            fullName: row.requestedBy.fullName,
            email: row.requestedBy.email,
            role: row.requestedBy.role,
          }
        : null,
      approvedBy: row.approvedBy
        ? {
            id: row.approvedBy.id,
            fullName: row.approvedBy.fullName,
            email: row.approvedBy.email,
            role: row.approvedBy.role,
          }
        : null,
    };
  }
}
