import {
  BadRequestException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ModuleRef } from '@nestjs/core';
import {
  ApprovalActionType,
  ApprovalModuleName,
  ApprovalRequest,
  Role,
} from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  APPROVAL_REPLAY_HEADER,
  isHttpReplayPayload,
} from './staff-mutation-approval';

export type ApprovalApplyResult = {
  applied: boolean;
  result?: unknown;
};

type ApprovalApplyHandler = (
  request: ApprovalRequest,
  actorId: string,
) => Promise<unknown>;

type BookingApplyService = {
  applyApprovedChange: (
    actionType: ApprovalActionType,
    recordId: string,
    newData: unknown,
    actorId: string,
  ) => Promise<unknown>;
};

type ExpenseApplyService = {
  applyApprovedChange: (
    actionType: ApprovalActionType,
    recordId: string,
    newData: unknown,
    actorId: string,
  ) => Promise<unknown>;
};

/**
 * Routes approved ApprovalRequest rows to the owning module's apply hook.
 * Modules register applyApprovedChange; this service never duplicates domain logic.
 */
@Injectable()
export class ApprovalApplicatorService {
  private readonly logger = new Logger(ApprovalApplicatorService.name);
  private readonly handlers = new Map<string, ApprovalApplyHandler>();

  constructor(
    private readonly moduleRef: ModuleRef,
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  register(moduleName: ApprovalModuleName, handler: ApprovalApplyHandler) {
    this.handlers.set(moduleName, handler);
  }

  async apply(request: ApprovalRequest, actorId: string): Promise<ApprovalApplyResult> {
    if (isHttpReplayPayload(request.newData)) {
      const result = await this.replayHttp(request, actorId);
      return { applied: true, result };
    }

    const registered = this.handlers.get(request.moduleName);
    if (registered) {
      const result = await registered(request, actorId);
      return { applied: true, result };
    }
    switch (request.moduleName) {
      case ApprovalModuleName.BOOKINGS:
        return this.applyBookings(request, actorId);
      case ApprovalModuleName.EXPENSES:
        return this.applyExpenses(request, actorId);
      default:
        this.logger.warn(
          `No applicator for module ${request.moduleName}; marking approved without domain apply`,
        );
        return { applied: false };
    }
  }

  private async applyBookings(
    request: ApprovalRequest,
    actorId: string,
  ): Promise<ApprovalApplyResult> {
    const service = this.resolveOptional<BookingApplyService>('BookingsService');
    if (!service?.applyApprovedChange) {
      throw new BadRequestException(
        'Bookings applicator is not available',
      );
    }

    const result = await service.applyApprovedChange(
      request.actionType,
      request.recordId,
      request.newData,
      actorId,
    );

    return { applied: true, result };
  }

  private async applyExpenses(
    request: ApprovalRequest,
    actorId: string,
  ): Promise<ApprovalApplyResult> {
    const service = this.resolveOptional<ExpenseApplyService>('ExpensesService');
    if (!service?.applyApprovedChange) {
      throw new BadRequestException(
        'Expenses applicator is not available',
      );
    }

    const result = await service.applyApprovedChange(
      request.actionType,
      request.recordId,
      request.newData,
      actorId,
    );

    return { applied: true, result };
  }

  private async replayHttp(request: ApprovalRequest, actorId: string) {
    const payload = request.newData;
    if (!isHttpReplayPayload(payload)) {
      throw new BadRequestException('Approval replay payload is invalid');
    }

    const actor = await this.prisma.user.findUnique({
      where: { id: actorId },
      select: { id: true, email: true, role: true, tokenVersion: true },
    });
    if (!actor) {
      throw new BadRequestException('Approving user was not found');
    }

    const token = await this.jwtService.signAsync({
      sub: actor.id,
      email: actor.email,
      role: actor.role,
      tv: actor.tokenVersion ?? 0,
    });

    const query = this.toQueryString(payload.query);
    const origin = `http://127.0.0.1:${process.env.PORT ?? 3000}`;
    const response = await fetch(`${origin}${payload.path}${query}`, {
      method: payload.method,
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        [APPROVAL_REPLAY_HEADER]: request.id,
      },
      body:
        payload.method === 'GET' ||
        payload.method === 'HEAD' ||
        payload.method === 'DELETE'
          ? undefined
          : JSON.stringify(payload.body ?? {}),
    });

    const raw = await response.text();
    let parsed: unknown = raw;
    if (raw) {
      try {
        parsed = JSON.parse(raw) as unknown;
      } catch {
        parsed = raw;
      }
    }

    if (!response.ok) {
      const message =
        parsed &&
        typeof parsed === 'object' &&
        'message' in parsed &&
        (parsed as { message?: unknown }).message
          ? Array.isArray((parsed as { message: unknown }).message)
            ? ((parsed as { message: string[] }).message).join(', ')
            : String((parsed as { message: unknown }).message)
          : `Replay failed with HTTP ${response.status}`;
      throw new BadRequestException(message);
    }

    return parsed;
  }

  private toQueryString(query?: Record<string, unknown>): string {
    if (!query) return '';
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null || value === '') continue;
      params.set(key, String(value));
    }
    const encoded = params.toString();
    return encoded ? `?${encoded}` : '';
  }

  private resolveOptional<T>(token: string): T | null {
    try {
      return this.moduleRef.get<T>(token, { strict: false });
    } catch {
      return null;
    }
  }

  /** Convenience for callers that only need Super Admin role token. */
  static superAdminRole(): Role {
    return Role.SUPER_ADMIN;
  }
}
