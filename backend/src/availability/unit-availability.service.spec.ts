import { ConflictException } from '@nestjs/common';
import {
  MonthlyOccupancyState,
  MonthlyTenancyStatus,
  UnitStatus,
} from '../../generated/prisma/client';
import { UnitAvailabilityService } from './unit-availability.service';

describe('UnitAvailabilityService eligibility messages', () => {
  function buildService(tenancy: Record<string, unknown> | null) {
    const prisma = {
      monthlyTenancy: {
        findUnique: jest.fn().mockResolvedValue(tenancy),
      },
      booking: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
    };
    return new UnitAvailabilityService(prisma as never);
  }

  it('rejects OCCUPIED assignments', async () => {
    const service = buildService({
      id: 't1',
      tenancyStatus: MonthlyTenancyStatus.ACTIVE,
      occupancyState: MonthlyOccupancyState.OCCUPIED,
      hotelUseAllowed: true,
      unit: {
        isActive: true,
        status: UnitStatus.OCCUPIED,
        property: { isActive: true },
      },
    });

    await expect(
      service.assertHotelUseEligible({ monthlyTenancyId: 't1' }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects when hotelUseAllowed is false', async () => {
    const service = buildService({
      id: 't1',
      tenancyStatus: MonthlyTenancyStatus.ACTIVE,
      occupancyState: MonthlyOccupancyState.EMPTY,
      hotelUseAllowed: false,
      unit: {
        isActive: true,
        status: UnitStatus.MONTHLY_TENANT_VACANT,
        property: { isActive: true },
      },
    });

    await expect(
      service.assertHotelUseEligible({ monthlyTenancyId: 't1' }),
    ).rejects.toThrow(/not permitted/);
  });

  it('allows empty assignment with hotelUseAllowed', async () => {
    const tenancy = {
      id: 't1',
      tenancyStatus: MonthlyTenancyStatus.ACTIVE,
      occupancyState: MonthlyOccupancyState.EMPTY,
      hotelUseAllowed: true,
      unit: {
        id: 'u1',
        isActive: true,
        status: UnitStatus.MONTHLY_TENANT_VACANT,
        property: { isActive: true },
      },
    };
    const service = buildService(tenancy);
    await expect(
      service.assertHotelUseEligible({ monthlyTenancyId: 't1' }),
    ).resolves.toEqual(tenancy);
  });
});
