import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  NotificationPriority,
  NotificationType,
  Prisma,
  Role,
  Status,
} from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export type CreateNotificationInput = {
  userId?: string;
  recipientRole?: Role;
  type: NotificationType;
  title: string;
  message: string;
  relatedModule?: string;
  relatedId?: string;
  priority?: NotificationPriority;
  actionUrl?: string;
  icon?: string;
  expiresAt?: Date | null;
  /** Deduplication key. When set, only one active (unresolved) notification
   *  with this key will exist per user. A second call is silently ignored. */
  dedupeKey?: string;
};

export type NotificationQuery = {
  unreadOnly?: boolean;
  priority?: NotificationPriority;
  module?: string;
  search?: string;
  take?: number;
};

/** Roles that should receive a particular notification category. */
export const ROLE_SETS = {
  /** Operational: all three roles */
  ALL: [Role.SUPER_ADMIN, Role.ADMIN, Role.RECEPTIONIST],
  /** Financial / admin-level: SA + Admin only */
  ADMIN_UP: [Role.SUPER_ADMIN, Role.ADMIN],
  /** Super-admin only */
  SUPER_ADMIN_ONLY: [Role.SUPER_ADMIN],
} as const;

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Core create ────────────────────────────────────────────────────────────

  async create(input: CreateNotificationInput) {
    if (input.userId) {
      return this.createForUser(input.userId, input);
    }

    if (input.recipientRole) {
      return this.notifyRole(input.recipientRole, input);
    }

    return this.notifyEveryone(input);
  }

  async createInTransaction(
    tx: Prisma.TransactionClient,
    input: CreateNotificationInput & { userId: string },
  ) {
    return tx.notification.create({
      data: this.toCreateData(input, input.userId),
    });
  }

  // ─── Deduplication-aware single-user create ──────────────────────────────────

  /**
   * Creates a notification for a single user.
   * When `dedupeKey` is set, skips creation if an active (unresolved)
   * notification with the same key already exists for that user.
   * Returns the existing or newly created notification.
   */
  async createForUser(
    userId: string,
    input: Omit<CreateNotificationInput, 'userId' | 'recipientRole'> & { dedupeKey?: string },
  ) {
    if (input.dedupeKey) {
      const existing = await this.prisma.notification.findFirst({
        where: { userId, dedupeKey: input.dedupeKey, isResolved: false },
      });
      if (existing) return existing;
    }

    return this.prisma.notification.create({
      data: this.toCreateData(input, userId),
    });
  }

  // ─── Role-broadcast with deduplication ──────────────────────────────────────

  async notifySuperAdmins(
    input: Omit<CreateNotificationInput, 'userId' | 'recipientRole'>,
    tx?: Prisma.TransactionClient,
  ) {
    return this.notifyRole(Role.SUPER_ADMIN, input, tx);
  }

  async notifyRole(
    role: Role,
    input: Omit<CreateNotificationInput, 'userId' | 'recipientRole'>,
    tx?: Prisma.TransactionClient,
  ) {
    const client = tx ?? this.prisma;
    const users = await client.user.findMany({
      where: { role, status: Status.ACTIVE },
      select: { id: true },
    });

    if (users.length === 0) return [];

    for (const user of users) {
      // Dedup per-user when dedupeKey is provided
      if (input.dedupeKey) {
        const exists = await client.notification.findFirst({
          where: {
            userId: user.id,
            dedupeKey: input.dedupeKey,
            isResolved: false,
          },
        });
        if (exists) continue;
      }
      await client.notification.create({
        data: this.toCreateData({ ...input, recipientRole: role }, user.id),
      });
    }

    return users;
  }

  /**
   * Notify multiple roles at once with deduplication.
   * Convenience for operational events that go to, e.g., Admin + Super Admin.
   */
  async notifyRoles(
    roles: Role[],
    input: Omit<CreateNotificationInput, 'userId' | 'recipientRole'>,
  ) {
    for (const role of roles) {
      await this.notifyRole(role, input);
    }
  }

  async notifyEveryone(
    input: Omit<CreateNotificationInput, 'userId' | 'recipientRole'>,
  ) {
    const users = await this.prisma.user.findMany({
      where: { status: Status.ACTIVE },
      select: { id: true },
    });

    if (users.length === 0) return [];

    for (const user of users) {
      if (input.dedupeKey) {
        const exists = await this.prisma.notification.findFirst({
          where: {
            userId: user.id,
            dedupeKey: input.dedupeKey,
            isResolved: false,
          },
        });
        if (exists) continue;
      }
      await this.prisma.notification.create({
        data: this.toCreateData(input, user.id),
      });
    }

    return users;
  }

  // ─── Auto-resolution ─────────────────────────────────────────────────────────

  /**
   * Resolve all active notifications with a given dedupeKey pattern across
   * all users. Call this when the underlying condition is fixed
   * (e.g. rent fully paid, cleaning completed, approval processed).
   *
   * @param dedupeKey Exact key string, or pass `{ contains: '...' }` via startsWith
   */
  async resolveByDedupeKey(dedupeKey: string) {
    const now = new Date();
    const result = await this.prisma.notification.updateMany({
      where: { dedupeKey, isResolved: false },
      data: { isResolved: true, resolvedAt: now, isRead: true, readAt: now },
    });
    return result.count;
  }

  /**
   * Resolve all active notifications matching a dedupeKey prefix (startsWith).
   * Useful when you want to clear all alerts for an entity regardless of period.
   */
  async resolveByDedupePrefix(prefix: string) {
    const now = new Date();
    const result = await this.prisma.notification.updateMany({
      where: {
        dedupeKey: { startsWith: prefix },
        isResolved: false,
      },
      data: { isResolved: true, resolvedAt: now, isRead: true, readAt: now },
    });
    return result.count;
  }

  /**
   * Mark a single notification resolved by its id (used from controllers).
   */
  async markResolved(id: string, userId: string) {
    const existing = await this.prisma.notification.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Notification not found');
    if (existing.userId !== userId) {
      throw new ForbiddenException('Cannot update another user notification');
    }
    const now = new Date();
    const row = await this.prisma.notification.update({
      where: { id },
      data: { isResolved: true, resolvedAt: now, isRead: true, readAt: now },
    });
    return this.serialize(row);
  }

  // ─── Query ───────────────────────────────────────────────────────────────────

  async findMine(userId: string, query: NotificationQuery = {}) {
    await this.deleteExpired();

    const and: Prisma.NotificationWhereInput[] = [
      { OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
    ];

    if (query.search) {
      and.push({
        OR: [
          { title: { contains: query.search, mode: 'insensitive' } },
          { message: { contains: query.search, mode: 'insensitive' } },
        ],
      });
    }

    const rows = await this.prisma.notification.findMany({
      where: {
        userId,
        ...(query.unreadOnly ? { isRead: false } : {}),
        ...(query.priority ? { priority: query.priority } : {}),
        ...(query.module ? { relatedModule: query.module } : {}),
        AND: and,
      },
      orderBy: [
        { isRead: 'asc' },           // unread first
        { priority: 'desc' },         // CRITICAL > HIGH > NORMAL > LOW
        { createdAt: 'desc' },
      ],
      take: query.take ?? 100,
    });

    return rows.map((row) => this.serialize(row));
  }

  async unreadCount(userId: string) {
    await this.deleteExpired();
    return this.prisma.notification.count({
      where: {
        userId,
        isRead: false,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
    });
  }

  async dashboardSummary(userId: string) {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date();
    end.setHours(23, 59, 59, 999);

    const [unread, critical, todayReminders, upcomingExpiry] =
      await Promise.all([
        this.unreadCount(userId),
        this.prisma.notification.count({
          where: {
            userId,
            isRead: false,
            priority: NotificationPriority.CRITICAL,
            OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
          },
        }),
        this.prisma.notification.count({
          where: {
            userId,
            isRead: false,
            createdAt: { gte: start, lte: end },
            OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
          },
        }),
        this.prisma.notification.count({
          where: {
            userId,
            expiresAt: {
              gt: new Date(),
              lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            },
          },
        }),
      ]);

    return { unread, critical, todayReminders, upcomingExpiry };
  }

  // ─── Mark read ───────────────────────────────────────────────────────────────

  async markRead(id: string, userId: string) {
    const existing = await this.prisma.notification.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Notification not found');
    if (existing.userId !== userId) {
      throw new ForbiddenException('Cannot update another user notification');
    }
    const row = await this.prisma.notification.update({
      where: { id },
      data: { isRead: true, readAt: new Date() },
    });
    return this.serialize(row);
  }

  async markAllRead(userId: string) {
    await this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true, readAt: new Date() },
    });
    return { ok: true };
  }

  // ─── Expiry cleanup ──────────────────────────────────────────────────────────

  async deleteExpired() {
    const result = await this.prisma.notification.deleteMany({
      where: { expiresAt: { lte: new Date() } },
    });
    return { deleted: result.count };
  }

  // ─── Module-level helpers (used by other services) ──────────────────────────

  async notifyBookingEvent(input: {
    title: string;
    message: string;
    bookingId: string;
    type?: NotificationType;
    priority?: NotificationPriority;
    dedupeKey?: string;
    actionUrl?: string;
  }) {
    const payload = {
      type: input.type ?? NotificationType.REMINDER,
      title: input.title,
      message: input.message,
      relatedModule: 'BOOKINGS',
      relatedId: input.bookingId,
      actionUrl: input.actionUrl ?? `/daily-guests?bookingId=${input.bookingId}`,
      priority: input.priority ?? NotificationPriority.NORMAL,
      icon: 'booking',
      dedupeKey: input.dedupeKey,
    };
    await this.notifyRole(Role.RECEPTIONIST, payload);
    await this.notifyRole(Role.ADMIN, payload);
    return this.notifySuperAdmins(payload);
  }

  async notifyLowStock(input: {
    title: string;
    message: string;
    itemId: string;
  }) {
    return this.notifyRole(Role.ADMIN, {
      type: NotificationType.WARNING,
      title: input.title,
      message: input.message,
      relatedModule: 'INVENTORY',
      relatedId: input.itemId,
      actionUrl: '/inventory',
      priority: NotificationPriority.HIGH,
      icon: 'inventory',
    });
  }

  // ─── Private helpers ─────────────────────────────────────────────────────────

  private toCreateData(
    input: Omit<CreateNotificationInput, 'userId' | 'recipientRole'> & {
      recipientRole?: Role;
      dedupeKey?: string;
    },
    userId: string,
  ) {
    return {
      userId,
      type: input.type,
      title: input.title,
      message: input.message,
      relatedModule: input.relatedModule ?? null,
      relatedId: input.relatedId ?? null,
      priority: input.priority ?? NotificationPriority.NORMAL,
      actionUrl: input.actionUrl ?? null,
      icon: input.icon ?? null,
      recipientRole: input.recipientRole ?? null,
      expiresAt: input.expiresAt ?? null,
      dedupeKey: input.dedupeKey ?? null,
    };
  }

  serialize(row: {
    id: string;
    userId: string;
    type: NotificationType;
    title: string;
    message: string;
    relatedModule: string | null;
    relatedId: string | null;
    priority: NotificationPriority;
    actionUrl: string | null;
    icon: string | null;
    recipientRole: Role | null;
    isRead: boolean;
    readAt: Date | null;
    expiresAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
    dedupeKey: string | null;
    isResolved: boolean;
    resolvedAt: Date | null;
  }) {
    return {
      id: row.id,
      userId: row.userId,
      type: row.type,
      title: row.title,
      message: row.message,
      relatedModule: row.relatedModule,
      relatedId: row.relatedId,
      priority: row.priority,
      actionUrl: row.actionUrl,
      icon: row.icon,
      recipientRole: row.recipientRole,
      isRead: row.isRead,
      readAt: row.readAt?.toISOString() ?? null,
      expiresAt: row.expiresAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      dedupeKey: row.dedupeKey,
      isResolved: row.isResolved,
      resolvedAt: row.resolvedAt?.toISOString() ?? null,
    };
  }
}
