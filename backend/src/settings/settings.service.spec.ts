jest.mock('../../generated/prisma/client', () => ({
  Role: {
    SUPER_ADMIN: 'SUPER_ADMIN',
    ADMIN: 'ADMIN',
    RECEPTIONIST: 'RECEPTIONIST',
  },
  SettingCategory: {
    BUSINESS: 'BUSINESS',
    FINANCE: 'FINANCE',
    ELECTRICITY: 'ELECTRICITY',
    SECURITY: 'SECURITY',
    DASHBOARD: 'DASHBOARD',
    NUMBERING: 'NUMBERING',
    SYSTEM: 'SYSTEM',
  },
  SettingDataType: {
    STRING: 'STRING',
    NUMBER: 'NUMBER',
    BOOLEAN: 'BOOLEAN',
    JSON: 'JSON',
    COLOR: 'COLOR',
  },
  Status: { ACTIVE: 'ACTIVE' },
}));

jest.mock('../prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { Role, Status } from '../../generated/prisma/client';
import type { AuthUser } from '../common/types/auth-user.type';
import { SettingsService } from './settings.service';
import { validateSettingValue } from './settings.validation';
import { SETTINGS_BY_KEY } from './settings.catalog';

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

describe('SettingsService', () => {
  const prisma = {
    systemSetting: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      upsert: jest.fn(),
      update: jest.fn(),
    },
  };
  const auditLogs = { write: jest.fn() };
  let service: SettingsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new SettingsService(prisma as never, auditLogs as never);
  });

  it('rejects receptionist from full settings list', async () => {
    await expect(
      service.findAll(makeUser(Role.RECEPTIONIST)),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('allows Super Admin to update business name', async () => {
    prisma.systemSetting.findUnique.mockResolvedValue({
      key: 'business.name',
      value: 'Old',
      updatedAt: new Date(),
      updatedByUserId: null,
    });
    prisma.systemSetting.upsert.mockResolvedValue({
      key: 'business.name',
      value: 'New Hotel',
      updatedAt: new Date(),
      updatedByUserId: 'user-1',
    });

    const result = await service.updateOne(
      'business.name',
      'New Hotel',
      makeUser(Role.SUPER_ADMIN),
    );

    expect(result.value).toBe('New Hotel');
    expect(auditLogs.write).toHaveBeenCalled();
  });

  it('blocks Admin from updating settings', async () => {
    await expect(
      service.updateOne('business.name', 'X', makeUser(Role.ADMIN)),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects invalid percentage', () => {
    const def = SETTINGS_BY_KEY.get('finance.defaultTaxPercentage')!;
    expect(() => validateSettingValue(def, 150)).toThrow(BadRequestException);
  });

  it('rejects invalid color', () => {
    const def = SETTINGS_BY_KEY.get('appearance.primaryGold')!;
    expect(() => validateSettingValue(def, 'blue')).toThrow(
      BadRequestException,
    );
  });

  it('returns public settings without sensitive keys', async () => {
    prisma.systemSetting.findMany.mockResolvedValue([
      {
        key: 'business.name',
        value: 'Hotel Residences',
        updatedAt: new Date(),
        updatedByUserId: null,
      },
    ]);

    const rows = await service.getPublicSettings();
    expect(rows.every((r) => r.isPublic)).toBe(true);
    expect(rows.some((r) => r.key.startsWith('security.'))).toBe(false);
  });

  it('clears cache after update', async () => {
    prisma.systemSetting.findUnique.mockResolvedValue({
      key: 'electricity.ratePerUnit',
      value: '95',
      updatedAt: new Date(),
      updatedByUserId: null,
    });
    prisma.systemSetting.upsert.mockResolvedValue({
      key: 'electricity.ratePerUnit',
      value: '100',
      updatedAt: new Date(),
      updatedByUserId: 'user-1',
    });

    await service.getValue('electricity.ratePerUnit');
    await service.updateOne(
      'electricity.ratePerUnit',
      100,
      makeUser(Role.SUPER_ADMIN),
    );

    prisma.systemSetting.findUnique.mockResolvedValue({
      key: 'electricity.ratePerUnit',
      value: '100',
      updatedAt: new Date(),
      updatedByUserId: 'user-1',
    });

    const next = await service.getValue<number>('electricity.ratePerUnit');
    expect(next).toBe(100);
  });
});
