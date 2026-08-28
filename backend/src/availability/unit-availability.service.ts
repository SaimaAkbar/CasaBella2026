import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  BookingStatus,
  MonthlyOccupancyState,
  MonthlyTenancyStatus,
  Prisma,
  UnitStatus,
} from '../../generated/prisma/client';
import { UNIT_NO_LONGER_AVAILABLE_MESSAGE } from '../common/constants/unit-availability';
import { sortByUnitNumber } from '../common/utils/natural-unit-sort';
import { PrismaService } from '../prisma/prisma.service';

export const ACTIVE_BOOKING_STATUSES: BookingStatus[] = [
  BookingStatus.PENDING,
  BookingStatus.CONFIRMED,
  BookingStatus.CHECKED_IN,
];

export type HotelUseEligibilityContext = {
  monthlyTenancyId: string;
  checkInDateTime?: Date;
  checkOutDateTime?: Date;
  excludeBookingId?: string;
};

/**
 * Centralized availability / eligibility checks for hotel-use on tenant units.
 * Controllers and booking flows must call this instead of duplicating rules.
 */
@Injectable()
export class UnitAvailabilityService {
  constructor(private readonly prisma: PrismaService) {}

  async assertHotelUseEligible(ctx: HotelUseEligibilityContext) {
    const tenancy = await this.prisma.monthlyTenancy.findUnique({
      where: { id: ctx.monthlyTenancyId },
      include: {
        unit: { include: { property: true } },
        tenant: true,
      },
    });

    if (!tenancy) {
      throw new ConflictException('Tenant unit assignment was not found');
    }

    if (tenancy.tenancyStatus !== MonthlyTenancyStatus.ACTIVE) {
      throw new ConflictException(
        'Hotel use requires an ACTIVE tenant unit assignment',
      );
    }

    if (tenancy.occupancyState !== MonthlyOccupancyState.EMPTY) {
      throw new ConflictException(
        'Hotel use is only allowed when the assigned unit is EMPTY (no tenant customer occupying it)',
      );
    }

    if (!tenancy.hotelUseAllowed) {
      throw new ConflictException(
        'Hotel use is not permitted on this tenant unit assignment',
      );
    }

    const unit = tenancy.unit;
    if (!unit.isActive || !unit.property.isActive) {
      throw new ConflictException('Unit is inactive and cannot host hotel use');
    }

    if (unit.status === UnitStatus.BLOCKED) {
      throw new ConflictException('Unit is BLOCKED and cannot host hotel use');
    }

    if (unit.status === UnitStatus.MAINTENANCE) {
      throw new ConflictException(
        'Unit is under MAINTENANCE and cannot host hotel use',
      );
    }

    if (ctx.checkInDateTime && ctx.checkOutDateTime) {
      await this.assertNoOverlappingBooking({
        unitId: unit.id,
        checkIn: ctx.checkInDateTime,
        checkOut: ctx.checkOutDateTime,
        excludeBookingId: ctx.excludeBookingId,
      });
    }

    return tenancy;
  }

  async assertNoOverlappingBooking(input: {
    unitId: string;
    checkIn: Date;
    checkOut: Date;
    excludeBookingId?: string;
  }) {
    const overlap = await this.prisma.booking.findFirst({
      where: {
        unitId: input.unitId,
        bookingStatus: { in: ACTIVE_BOOKING_STATUSES },
        ...(input.excludeBookingId
          ? { id: { not: input.excludeBookingId } }
          : {}),
        checkInDateTime: { lt: input.checkOut },
        checkOutDateTime: { gt: input.checkIn },
      },
      select: { id: true, bookingNumber: true },
    });

    if (overlap) {
      throw new ConflictException(
        `Unit already has an overlapping booking (${overlap.bookingNumber})`,
      );
    }
  }

  async listEligibleAssignments(filters?: {
    tenantId?: string;
    propertyId?: string;
    unitId?: string;
  }) {
    const where: Prisma.MonthlyTenancyWhereInput = {
      tenancyStatus: MonthlyTenancyStatus.ACTIVE,
      occupancyState: MonthlyOccupancyState.EMPTY,
      hotelUseAllowed: true,
      ...(filters?.tenantId ? { tenantId: filters.tenantId } : {}),
      ...(filters?.unitId ? { unitId: filters.unitId } : {}),
      unit: {
        isActive: true,
        status: {
          notIn: [UnitStatus.BLOCKED, UnitStatus.MAINTENANCE, UnitStatus.OCCUPIED],
        },
        property: { isActive: true },
        ...(filters?.propertyId ? { propertyId: filters.propertyId } : {}),
      },
    };

    return this.prisma.monthlyTenancy.findMany({
      where,
      include: {
        tenant: {
          select: { id: true, fullName: true, phone: true },
        },
        unit: {
          include: {
            property: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: [
        { unit: { property: { name: 'asc' } } },
        { unit: { unitNumber: 'asc' } },
      ],
    });
  }

  /**
   * Shared monthly-assignment eligibility.
   * Dashboard AVAILABLE rooms (including stale OCCUPIED with no live stay)
   * must be assignable here. Genuine conflicts only:
   * inactive, maintenance, blocked, cleaning, active tenancy, active booking.
   */
  async assertAssignableForMonthly(unitId: string, propertyId?: string) {
    const unit = await this.prisma.unit.findUnique({
      where: { id: unitId },
      include: { property: true },
    });

    if (!unit || !unit.isActive || !unit.property.isActive) {
      throw new NotFoundException(`Unit with id "${unitId}" not found`);
    }

    if (propertyId && unit.propertyId !== propertyId) {
      throw new BadRequestException(
        'Selected unit does not belong to the selected property.',
      );
    }

    if (
      unit.status === UnitStatus.MAINTENANCE ||
      unit.status === UnitStatus.BLOCKED ||
      unit.status === UnitStatus.CLEANING_REQUIRED
    ) {
      throw new ConflictException(UNIT_NO_LONGER_AVAILABLE_MESSAGE);
    }

    const activeTenancy = await this.prisma.monthlyTenancy.findFirst({
      where: {
        unitId,
        tenancyStatus: MonthlyTenancyStatus.ACTIVE,
      },
      select: { id: true },
    });
    if (activeTenancy) {
      throw new ConflictException(UNIT_NO_LONGER_AVAILABLE_MESSAGE);
    }

    const activeBooking = await this.prisma.booking.findFirst({
      where: {
        unitId,
        bookingStatus: { in: ACTIVE_BOOKING_STATUSES },
      },
      select: { id: true },
    });
    if (activeBooking) {
      throw new ConflictException(UNIT_NO_LONGER_AVAILABLE_MESSAGE);
    }

    return unit;
  }

  async listEligibleForMonthly(query: {
    propertyId: string;
    includeMonthlyVacant?: boolean;
    tenantId?: string;
    startDate?: string;
    endDate?: string;
  }) {
    const bookingNone: Prisma.BookingListRelationFilter = {
      none:
        query.startDate && query.endDate
          ? {
              bookingStatus: { in: ACTIVE_BOOKING_STATUSES },
              checkInDateTime: { lt: new Date(query.endDate) },
              checkOutDateTime: { gt: new Date(query.startDate) },
            }
          : { bookingStatus: { in: ACTIVE_BOOKING_STATUSES } },
    };

    const tenancyFilter: Prisma.UnitWhereInput = query.includeMonthlyVacant
      ? {
          OR: [
            {
              tenancies: {
                none: { tenancyStatus: MonthlyTenancyStatus.ACTIVE },
              },
            },
            {
              tenancies: {
                some: {
                  tenancyStatus: MonthlyTenancyStatus.ACTIVE,
                  occupancyState: MonthlyOccupancyState.EMPTY,
                  ...(query.tenantId ? { tenantId: query.tenantId } : {}),
                },
              },
            },
          ],
        }
      : {
          tenancies: {
            none: { tenancyStatus: MonthlyTenancyStatus.ACTIVE },
          },
        };

    const units = await this.prisma.unit.findMany({
      where: {
        propertyId: query.propertyId,
        isActive: true,
        property: { isActive: true },
        status: {
          notIn: [
            UnitStatus.MAINTENANCE,
            UnitStatus.BLOCKED,
            UnitStatus.CLEANING_REQUIRED,
          ],
        },
        ...tenancyFilter,
        bookings: bookingNone,
      },
      select: {
        id: true,
        unitNumber: true,
        unitType: true,
        floor: true,
        status: true,
        monthlyRent: true,
        propertyId: true,
        property: { select: { id: true, name: true } },
      },
    });

    return sortByUnitNumber(units, (unit) => unit.unitNumber).map((unit) => ({
      ...unit,
      monthlyRent: unit.monthlyRent?.toString() ?? null,
    }));
  }
}
