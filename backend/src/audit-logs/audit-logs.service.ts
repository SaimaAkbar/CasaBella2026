import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Role } from '../../generated/prisma/client';
import type { AuditContext } from '../common/types/audit-context.type';
import { canAccessAuditLogs } from '../approvals/approval-access';
import { PrismaService } from '../prisma/prisma.service';
import { QueryAuditLogsDto } from './dto/query-audit-logs.dto';

export type WriteAuditInput = {
  module: string;
  action: string;
  recordId?: string | null;
  userId?: string | null;
  role?: string | null;
  oldData?: unknown;
  newData?: unknown;
  context?: AuditContext;
};

@Injectable()
export class AuditLogsService {
  constructor(private readonly prisma: PrismaService) {}

  async write(input: WriteAuditInput) {
    return this.prisma.auditLog.create({
      data: {
        module: input.module,
        action: input.action,
        recordId: input.recordId ?? null,
        userId: input.userId ?? null,
        role: input.role ?? null,
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
        ipAddress: input.context?.ipAddress,
        device: input.context?.device,
        browser: input.context?.browser,
        os: input.context?.os,
      },
    });
  }

  async writeInTransaction(
    tx: Prisma.TransactionClient,
    input: WriteAuditInput,
  ) {
    return tx.auditLog.create({
      data: {
        module: input.module,
        action: input.action,
        recordId: input.recordId ?? null,
        userId: input.userId ?? null,
        role: input.role ?? null,
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
        ipAddress: input.context?.ipAddress,
        device: input.context?.device,
        browser: input.context?.browser,
        os: input.context?.os,
      },
    });
  }

  async findAll(query: QueryAuditLogsDto, role: Role) {
    if (!canAccessAuditLogs(role)) {
      throw new ForbiddenException('No access to audit logs');
    }

    const where: Prisma.AuditLogWhereInput = {};

    if (query.module) where.module = query.module;
    if (query.action) where.action = query.action;
    if (query.userId) where.userId = query.userId;
    if (query.role) where.role = query.role;
    if (query.recordId) where.recordId = query.recordId;

    if (query.dateFrom || query.dateTo) {
      where.createdAt = {};
      if (query.dateFrom) {
        where.createdAt.gte = new Date(query.dateFrom);
      }
      if (query.dateTo) {
        const end = new Date(query.dateTo);
        end.setHours(23, 59, 59, 999);
        where.createdAt.lte = end;
      }
    }

    if (query.search?.trim()) {
      const term = query.search.trim();
      where.OR = [
        { module: { contains: term, mode: 'insensitive' } },
        { action: { contains: term, mode: 'insensitive' } },
        { recordId: { contains: term, mode: 'insensitive' } },
        { ipAddress: { contains: term, mode: 'insensitive' } },
        { user: { fullName: { contains: term, mode: 'insensitive' } } },
        { user: { email: { contains: term, mode: 'insensitive' } } },
      ];
    }

    const rows = await this.prisma.auditLog.findMany({
      where,
      include: {
        user: {
          select: { id: true, fullName: true, email: true, role: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: query.limit ?? 100,
      skip: query.offset ?? 0,
    });

    return rows.map((row) => this.serialize(row));
  }

  async findOne(id: string, role: Role) {
    if (!canAccessAuditLogs(role)) {
      throw new ForbiddenException('No access to audit logs');
    }

    const row = await this.prisma.auditLog.findUnique({
      where: { id },
      include: {
        user: {
          select: { id: true, fullName: true, email: true, role: true },
        },
      },
    });

    if (!row) {
      throw new NotFoundException('Audit log not found');
    }

    return this.serialize(row);
  }

  private serialize(
    row: Prisma.AuditLogGetPayload<{
      include: {
        user: {
          select: { id: true; fullName: true; email: true; role: true };
        };
      };
    }>,
  ) {
    return {
      id: row.id,
      module: row.module,
      action: row.action,
      recordId: row.recordId,
      userId: row.userId,
      role: row.role,
      oldData: row.oldData,
      newData: row.newData,
      ipAddress: row.ipAddress,
      device: row.device,
      browser: row.browser,
      os: row.os,
      createdAt: row.createdAt.toISOString(),
      user: row.user
        ? {
            id: row.user.id,
            fullName: row.user.fullName,
            email: row.user.email,
            role: row.user.role,
          }
        : null,
    };
  }
}
