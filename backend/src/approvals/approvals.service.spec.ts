jest.mock('../../generated/prisma/client', () => ({
  Role: {
    SUPER_ADMIN: 'SUPER_ADMIN',
    ADMIN: 'ADMIN',
    RECEPTIONIST: 'RECEPTIONIST',
  },
  ApprovalModuleName: {
    BOOKINGS: 'BOOKINGS',
    EXPENSES: 'EXPENSES',
  },
  ApprovalActionType: {
    UPDATE: 'UPDATE',
    DELETE: 'DELETE',
  },
  ApprovalStatus: {
    PENDING: 'PENDING',
    APPROVED: 'APPROVED',
    REJECTED: 'REJECTED',
    CANCELLED: 'CANCELLED',
  },
  ApprovalPriority: {
    LOW: 'LOW',
    NORMAL: 'NORMAL',
    HIGH: 'HIGH',
    CRITICAL: 'CRITICAL',
  },
  NotificationType: {
    APPROVAL_REQUESTED: 'APPROVAL_REQUESTED',
    APPROVAL_APPROVED: 'APPROVAL_APPROVED',
    APPROVAL_REJECTED: 'APPROVAL_REJECTED',
    SYSTEM: 'SYSTEM',
  },
  Prisma: {
    DbNull: Symbol('DbNull'),
  },
  Status: { ACTIVE: 'ACTIVE' },
  PrismaClient: class PrismaClient {},
}));

import {
  ApprovalActionType,
  ApprovalModuleName,
  ApprovalPriority,
  ApprovalStatus,
  Role,
  Status,
} from '../../generated/prisma/client';
import { ForbiddenException } from '@nestjs/common';
import type { AuthUser } from '../common/types/auth-user.type';
import { ApprovalsService } from './approvals.service';

function makeUser(role: Role, id = 'user-1'): AuthUser {
  return {
    id,
    fullName: 'Test User',
    email: 'test@hotel.com',
    phone: '0300',
    role,
    status: Status.ACTIVE,
    canAccessSalary: false,
    canAccessProfitLoss: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

describe('ApprovalsService', () => {
  const prisma = {
    approvalRequest: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      count: jest.fn(),
    },
    auditLog: { count: jest.fn() },
    $transaction: jest.fn(),
  };

  const auditLogs = {
    writeInTransaction: jest.fn(),
  };

  const notifications = {
    notifySuperAdmins: jest.fn(),
    createInTransaction: jest.fn(),
  };

  const applicator = {
    apply: jest.fn(),
  };

  let service: ApprovalsService;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.approvalRequest.findUnique.mockReset();
    prisma.approvalRequest.findFirst.mockReset();
    prisma.$transaction.mockReset();
    service = new ApprovalsService(
      prisma as never,
      auditLogs as never,
      notifications as never,
      applicator as never,
      { backfillPending: jest.fn(async (row: { oldData: unknown }) => row.oldData) } as never,
    );
  });

  it('SUPER_ADMIN submit returns null (direct apply by caller)', async () => {
    const result = await service.submit({
      moduleName: ApprovalModuleName.BOOKINGS,
      recordId: 'booking-1',
      actionType: ApprovalActionType.UPDATE,
      actor: makeUser(Role.SUPER_ADMIN),
      oldData: { notes: 'a' },
      newData: { patch: { notes: 'b' } },
    });

    expect(result).toBeNull();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('ADMIN submit creates PENDING approval and does not mutate domain', async () => {
    const created = {
      id: 'apr-1',
      moduleName: ApprovalModuleName.BOOKINGS,
      recordId: 'booking-1',
      actionType: ApprovalActionType.UPDATE,
      requestedById: 'user-1',
      approvedById: null,
      requestedDate: new Date('2026-08-01T10:00:00Z'),
      approvedDate: null,
      status: ApprovalStatus.PENDING,
      oldData: { notes: 'old' },
      newData: { patch: { notes: 'new' } },
      reason: 'Admin booking edit',
      rejectionReason: null,
      priority: ApprovalPriority.NORMAL,
      createdAt: new Date('2026-08-01T10:00:00Z'),
      updatedAt: new Date('2026-08-01T10:00:00Z'),
      requestedBy: {
        id: 'user-1',
        fullName: 'Test User',
        email: 'test@hotel.com',
        role: Role.ADMIN,
      },
      approvedBy: null,
    };

    prisma.approvalRequest.findFirst.mockResolvedValue(null);
    prisma.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => {
      const tx = {
        approvalRequest: {
          create: jest.fn().mockResolvedValue(created),
        },
      };
      return fn(tx);
    });

    const result = await service.submit({
      moduleName: ApprovalModuleName.BOOKINGS,
      recordId: 'booking-1',
      actionType: ApprovalActionType.UPDATE,
      actor: makeUser(Role.ADMIN),
      oldData: { notes: 'old' },
      newData: { patch: { notes: 'new' } },
      reason: 'Admin booking edit',
    });

    expect(result?.pendingApproval).toBe(true);
    expect(result?.approvalRequest.status).toBe(ApprovalStatus.PENDING);
    expect(result?.approvalRequest.recordId).toBe('booking-1');
    expect(notifications.notifySuperAdmins).toHaveBeenCalled();
    expect(auditLogs.writeInTransaction).toHaveBeenCalled();
  });

  it('RECEPTIONIST submit creates PENDING approval and does not mutate domain', async () => {
    const created = {
      id: 'apr-2',
      moduleName: ApprovalModuleName.BOOKINGS,
      recordId: 'booking-1',
      actionType: ApprovalActionType.UPDATE,
      requestedById: 'user-1',
      approvedById: null,
      requestedDate: new Date('2026-08-01T10:00:00Z'),
      approvedDate: null,
      status: ApprovalStatus.PENDING,
      oldData: {},
      newData: {},
      reason: 'Receptionist booking edit',
      rejectionReason: null,
      priority: ApprovalPriority.NORMAL,
      createdAt: new Date('2026-08-01T10:00:00Z'),
      updatedAt: new Date('2026-08-01T10:00:00Z'),
      requestedBy: {
        id: 'user-1',
        fullName: 'Test User',
        email: 'test@hotel.com',
        role: Role.RECEPTIONIST,
      },
      approvedBy: null,
    };

    prisma.approvalRequest.findFirst.mockResolvedValue(null);
    prisma.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => {
      const tx = {
        approvalRequest: {
          create: jest.fn().mockResolvedValue(created),
        },
      };
      return fn(tx);
    });

    const result = await service.submit({
      moduleName: ApprovalModuleName.BOOKINGS,
      recordId: 'booking-1',
      actionType: ApprovalActionType.UPDATE,
      actor: makeUser(Role.RECEPTIONIST),
      oldData: {},
      newData: {},
      reason: 'Receptionist booking edit',
    });

    expect(result?.pendingApproval).toBe(true);
    expect(result?.approvalRequest.status).toBe(ApprovalStatus.PENDING);
    expect(notifications.notifySuperAdmins).toHaveBeenCalled();
  });

  it('ADMIN cannot approve', async () => {
    await expect(
      service.approve('apr-1', makeUser(Role.ADMIN)),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('SUPER_ADMIN approve applies change and writes audit + notification', async () => {
    const pending = {
      id: 'apr-1',
      moduleName: ApprovalModuleName.BOOKINGS,
      recordId: 'booking-1',
      actionType: ApprovalActionType.UPDATE,
      requestedById: 'admin-1',
      approvedById: null,
      requestedDate: new Date(),
      approvedDate: null,
      status: ApprovalStatus.PENDING,
      oldData: { notes: 'old' },
      newData: { patch: { notes: 'new' } },
      reason: 'edit',
      rejectionReason: null,
      priority: ApprovalPriority.NORMAL,
      createdAt: new Date(),
      updatedAt: new Date(),
      requestedBy: {
        id: 'admin-1',
        fullName: 'Admin',
        email: 'admin@hotel.com',
        role: Role.ADMIN,
      },
      approvedBy: null,
    };

    const approved = {
      ...pending,
      status: ApprovalStatus.APPROVED,
      approvedById: 'super-1',
      approvedDate: new Date(),
      approvedBy: {
        id: 'super-1',
        fullName: 'Super',
        email: 'super@hotel.com',
        role: Role.SUPER_ADMIN,
      },
    };

    prisma.approvalRequest.findUnique
      .mockResolvedValueOnce(pending)
      .mockResolvedValueOnce(approved);
    prisma.approvalRequest.updateMany.mockResolvedValue({ count: 1 });
    applicator.apply.mockResolvedValue({
      applied: true,
      result: { id: 'booking-1', notes: 'new' },
    });
    prisma.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) =>
      fn({
        approvalRequest: {
          findUniqueOrThrow: jest.fn().mockResolvedValue(approved),
        },
      }),
    );

    const result = await service.approve(
      'apr-1',
      makeUser(Role.SUPER_ADMIN, 'super-1'),
    );

    expect(applicator.apply).toHaveBeenCalledWith(pending, 'super-1');
    expect(result.status).toBe(ApprovalStatus.APPROVED);
    expect(result.applyResult.applied).toBe(true);
    expect(notifications.createInTransaction).toHaveBeenCalled();
    expect(auditLogs.writeInTransaction).toHaveBeenCalled();
  });

  it('SUPER_ADMIN reject leaves domain unchanged and requires reason', async () => {
    const pending = {
      id: 'apr-1',
      moduleName: ApprovalModuleName.BOOKINGS,
      recordId: 'booking-1',
      actionType: ApprovalActionType.UPDATE,
      requestedById: 'admin-1',
      approvedById: null,
      requestedDate: new Date(),
      approvedDate: null,
      status: ApprovalStatus.PENDING,
      oldData: { notes: 'old' },
      newData: { patch: { notes: 'new' } },
      reason: 'edit',
      rejectionReason: null,
      priority: ApprovalPriority.NORMAL,
      createdAt: new Date(),
      updatedAt: new Date(),
      requestedBy: {
        id: 'admin-1',
        fullName: 'Admin',
        email: 'admin@hotel.com',
        role: Role.ADMIN,
      },
      approvedBy: null,
    };

    const rejected = {
      ...pending,
      status: ApprovalStatus.REJECTED,
      rejectionReason: 'Incorrect amount',
      approvedById: 'super-1',
      approvedDate: new Date(),
      approvedBy: {
        id: 'super-1',
        fullName: 'Super',
        email: 'super@hotel.com',
        role: Role.SUPER_ADMIN,
      },
    };

    prisma.approvalRequest.findUnique.mockResolvedValue(pending);
    prisma.approvalRequest.updateMany.mockResolvedValue({ count: 1 });
    prisma.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) =>
      fn({
        approvalRequest: {
          updateMany: jest.fn().mockResolvedValue({ count: 1 }),
          findUniqueOrThrow: jest.fn().mockResolvedValue(rejected),
        },
      }),
    );

    const result = await service.reject(
      'apr-1',
      'Incorrect amount',
      makeUser(Role.SUPER_ADMIN, 'super-1'),
    );

    expect(applicator.apply).not.toHaveBeenCalled();
    expect(result.status).toBe(ApprovalStatus.REJECTED);
    expect(result.rejectionReason).toBe('Incorrect amount');
  });
});
