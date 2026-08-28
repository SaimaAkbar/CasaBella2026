jest.mock('../../generated/prisma/client', () => ({
  Role: { SUPER_ADMIN: 'SUPER_ADMIN', ADMIN: 'ADMIN', RECEPTIONIST: 'RECEPTIONIST' },
  BackupStatus: {
    PENDING: 'PENDING',
    IN_PROGRESS: 'IN_PROGRESS',
    COMPLETED: 'COMPLETED',
    FAILED: 'FAILED',
    DELETED: 'DELETED',
  },
  BackupType: { MANUAL: 'MANUAL', SCHEDULED: 'SCHEDULED', PRE_RESTORE: 'PRE_RESTORE' },
  BackupStorageType: { LOCAL: 'LOCAL', CLOUD: 'CLOUD' },
  RestoreStatus: {
    PENDING: 'PENDING',
    IN_PROGRESS: 'IN_PROGRESS',
    COMPLETED: 'COMPLETED',
    FAILED: 'FAILED',
  },
  NotificationType: { SUCCESS: 'SUCCESS', ERROR: 'ERROR' },
  NotificationPriority: { NORMAL: 'NORMAL', CRITICAL: 'CRITICAL', HIGH: 'HIGH' },
  Status: { ACTIVE: 'ACTIVE' },
}));

jest.mock('../prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { Role, Status } from '../../generated/prisma/client';
import type { AuthUser } from '../common/types/auth-user.type';
import { BackupsService } from './backups.service';

function user(role: Role, id = 'u1'): AuthUser {
  return {
    id,
    fullName: 'Test',
    email: 't@t.com',
    phone: '1',
    role,
    status: Status.ACTIVE,
    canAccessSalary: false,
    canAccessProfitLoss: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

describe('BackupsService restore gates', () => {
  const prisma = {
    backupRecord: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    restoreHistory: { create: jest.fn(), findMany: jest.fn(), update: jest.fn() },
    user: { findUnique: jest.fn() },
    $disconnect: jest.fn(),
    $connect: jest.fn(),
    $queryRaw: jest.fn(),
  };
  const auditLogs = { write: jest.fn() };
  const notifications = { notifySuperAdmins: jest.fn() };
  const settings = {
    getBoolean: jest.fn().mockResolvedValue(false),
    getNumber: jest.fn().mockResolvedValue(30),
    updateOne: jest.fn(),
  };

  let service: BackupsService;

  beforeEach(() => {
    jest.resetAllMocks();
    settings.getBoolean.mockResolvedValue(false);
    settings.getNumber.mockResolvedValue(30);
    service = new BackupsService(
      prisma as never,
      auditLogs as never,
      notifications as never,
      settings as never,
    );
  });

  it('Admin receives Forbidden on list', async () => {
    await expect(service.list(user(Role.ADMIN))).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('Receptionist receives Forbidden on create', async () => {
    await expect(
      service.createManualBackup(user(Role.RECEPTIONIST)),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('restore requires exact confirmation text', async () => {
    await expect(
      service.restore(
        'b1',
        {
          confirmationText: 'restore database',
          reason: 'test restore reason',
          currentPassword: 'x',
        },
        user(Role.SUPER_ADMIN),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
