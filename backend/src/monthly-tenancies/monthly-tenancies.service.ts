import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  MonthlyOccupancyState,
  MonthlyTenancyStatus,
  Prisma,
  Role,
  UnitStatus,
} from '../../generated/prisma/client';
import { MonthlyTenantsService } from '../monthly-tenants/monthly-tenants.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMonthlyTenancyDto } from './dto/create-monthly-tenancy.dto';
import { QueryEligibleUnitsDto } from './dto/query-eligible-units.dto';
import { QueryMonthlyTenanciesDto } from './dto/query-monthly-tenancies.dto';
import { UpdateMonthlyTenancyDto } from './dto/update-monthly-tenancy.dto';
import { mapTenancyForRole } from './monthly-tenancies.mapper';
import {
  calculateTenancyTotals,
  serializeMoney,
} from './monthly-tenancy.finance';

const tenancyInclude = {
  tenant: true,
  unit: {
    include: {
      property: {
        select: { id: true, name: true },
      },
    },
  },
} satisfies Prisma.MonthlyTenancyInclude;

@Injectable()
export class MonthlyTenanciesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly monthlyTenantsService: MonthlyTenantsService,
  ) {}

  async create(
    dto: CreateMonthlyTenancyDto,
    role: Role,
    _userId?: string,
  ) {
    if (role === Role.RECEPTIONIST) {
      throw new ForbiddenException('Insufficient permissions');
    }

    await this.monthlyTenantsService.ensureActive(dto.tenantId);
    const unit = await this.getAssignableUnit(dto.unitId);
    this.assertAgreementDates(dto.agreementStart, dto.agreementEnd);

    const existingActive = await this.prisma.monthlyTenancy.findFirst({
      where: {
        unitId: dto.unitId,
        tenancyStatus: MonthlyTenancyStatus.ACTIVE,
      },
    });

    if (existingActive) {
      throw new ConflictException('This unit already has an active tenancy');
    }

    const allowAdvance = role === Role.SUPER_ADMIN && Boolean(dto.allowAdvance);
    const totals = calculateTenancyTotals(dto, { allowAdvance });
    const unitStatus = this.unitStatusForOccupancy(dto.occupancyState);

    const tenancy = await this.prisma.$transaction(async (tx) => {
      const created = await tx.monthlyTenancy.create({
        data: {
          tenantId: dto.tenantId,
          agreementId: dto.agreementId,
          unitId: dto.unitId,
          agreementStart: new Date(dto.agreementStart),
          agreementEnd: dto.agreementEnd
            ? new Date(dto.agreementEnd)
            : undefined,
          ...totals,
          occupancyState: dto.occupancyState,
          tenancyStatus: MonthlyTenancyStatus.ACTIVE,
          notes: dto.notes,
        },
        include: tenancyInclude,
      });

      await tx.unit.update({
        where: { id: unit.id },
        data: { status: unitStatus },
      });

      return created;
    });

    return mapTenancyForRole(tenancy, role);
  }

  async findAll(query: QueryMonthlyTenanciesDto, role: Role) {
    const where = this.buildWhere(query);

    const tenancies = await this.prisma.monthlyTenancy.findMany({
      where,
      include: tenancyInclude,
      orderBy: { createdAt: 'desc' },
    });

    return tenancies.map((tenancy) => mapTenancyForRole(tenancy, role));
  }

  async getSummary(query: QueryMonthlyTenanciesDto, role: Role) {
    const where = this.buildWhere(query);
    const activeWhere: Prisma.MonthlyTenancyWhereInput = {
      ...where,
      tenancyStatus: MonthlyTenancyStatus.ACTIVE,
    };

    const [activeCount, occupiedCount, emptyCount, aggregates] =
      await Promise.all([
        this.prisma.monthlyTenancy.count({ where: activeWhere }),
        this.prisma.monthlyTenancy.count({
          where: {
            ...activeWhere,
            occupancyState: MonthlyOccupancyState.OCCUPIED,
          },
        }),
        this.prisma.monthlyTenancy.count({
          where: {
            ...activeWhere,
            occupancyState: MonthlyOccupancyState.EMPTY,
          },
        }),
        this.prisma.monthlyTenancy.aggregate({
          where: activeWhere,
          _sum: {
            monthlyRent: true,
            totalReceived: true,
            remainingBalance: true,
          },
        }),
      ]);

    const base = {
      activeMonthlyTenants: activeCount,
      occupiedMonthlyUnits: occupiedCount,
      emptyMonthlyUnits: emptyCount,
    };

    if (role === Role.RECEPTIONIST) {
      return base;
    }

    return {
      ...base,
      monthlyRentTotal: serializeMoney(aggregates._sum.monthlyRent),
      totalReceived: serializeMoney(aggregates._sum.totalReceived),
      remainingBalance: serializeMoney(aggregates._sum.remainingBalance),
    };
  }

  async findOne(id: string, role: Role) {
    const tenancy = await this.prisma.monthlyTenancy.findUnique({
      where: { id },
      include: tenancyInclude,
    });

    if (!tenancy) {
      throw new NotFoundException(`Tenancy with id "${id}" not found`);
    }

    return mapTenancyForRole(tenancy, role);
  }

  async update(id: string, dto: UpdateMonthlyTenancyDto, role: Role) {
    if (role === Role.RECEPTIONIST) {
      throw new ForbiddenException('Insufficient permissions');
    }

    const existing = await this.getActiveOrThrow(id);

    if (role === Role.ADMIN) {
      const financialKeys: Array<keyof UpdateMonthlyTenancyDto> = [
        'securityDeposit',
        'monthlyRent',
        'maintenanceCharges',
        'laundryCharges',
        'cleaningCharges',
        'waterCharges',
        'societyCharges',
        'electricityCharges',
        'otherCharges',
        'previousBalance',
        'totalReceived',
      ];

      if (financialKeys.some((key) => dto[key] !== undefined)) {
        throw new ForbiddenException(
          'Financial edits after creation require Super Admin or a future approval workflow',
        );
      }
    }

    if (dto.agreementEnd) {
      this.assertAgreementDates(
        existing.agreementStart.toISOString(),
        dto.agreementEnd,
      );
    }

    const nextOccupancy = dto.occupancyState ?? existing.occupancyState;
    const allowAdvance = role === Role.SUPER_ADMIN && Boolean(dto.allowAdvance);

    const totals = calculateTenancyTotals(
      {
        monthlyRent: Number(
          dto.monthlyRent ?? existing.monthlyRent.toString(),
        ),
        securityDeposit: Number(
          dto.securityDeposit ?? existing.securityDeposit.toString(),
        ),
        maintenanceCharges: Number(
          dto.maintenanceCharges ?? existing.maintenanceCharges.toString(),
        ),
        laundryCharges: Number(
          dto.laundryCharges ?? existing.laundryCharges.toString(),
        ),
        cleaningCharges: Number(
          dto.cleaningCharges ?? existing.cleaningCharges.toString(),
        ),
        waterCharges: Number(
          dto.waterCharges ?? existing.waterCharges.toString(),
        ),
        societyCharges: Number(
          dto.societyCharges ?? existing.societyCharges.toString(),
        ),
        electricityCharges: Number(
          dto.electricityCharges ?? existing.electricityCharges.toString(),
        ),
        otherCharges: Number(
          dto.otherCharges ?? existing.otherCharges.toString(),
        ),
        previousBalance: Number(
          dto.previousBalance ?? existing.previousBalance.toString(),
        ),
        totalReceived: Number(
          dto.totalReceived ?? existing.totalReceived.toString(),
        ),
      },
      { allowAdvance },
    );

    const tenancy = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.monthlyTenancy.update({
        where: { id },
        data: {
          agreementEnd: dto.agreementEnd
            ? new Date(dto.agreementEnd)
            : undefined,
          ...totals,
          occupancyState: nextOccupancy,
          notes: dto.notes,
        },
        include: tenancyInclude,
      });

      if (
        existing.tenancyStatus === MonthlyTenancyStatus.ACTIVE &&
        dto.occupancyState &&
        dto.occupancyState !== existing.occupancyState
      ) {
        await tx.unit.update({
          where: { id: existing.unitId },
          data: { status: this.unitStatusForOccupancy(dto.occupancyState) },
        });
      }

      return updated;
    });

    return mapTenancyForRole(tenancy, role);
  }

  async markEmpty(id: string, role: Role) {
    return this.setOccupancy(id, MonthlyOccupancyState.EMPTY, role);
  }

  async markOccupied(id: string, role: Role) {
    return this.setOccupancy(id, MonthlyOccupancyState.OCCUPIED, role);
  }

  async endTenancy(id: string, role: Role) {
    if (role !== Role.SUPER_ADMIN) {
      throw new ForbiddenException('Only Super Admin can end a tenancy');
    }

    const existing = await this.getActiveOrThrow(id);

    const tenancy = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.monthlyTenancy.update({
        where: { id },
        data: {
          tenancyStatus: MonthlyTenancyStatus.ENDED,
          endedAt: new Date(),
        },
        include: tenancyInclude,
      });

      await tx.unit.update({
        where: { id: existing.unitId },
        data: { status: UnitStatus.CLEANING_REQUIRED },
      });

      return updated;
    });

    return mapTenancyForRole(tenancy, role);
  }

  async listEligibleUnits(query: QueryEligibleUnitsDto) {
    const bookingConflict =
      query.startDate && query.endDate
        ? {
            bookings: {
              none: {
                bookingStatus: {
                  in: [
                    'PENDING',
                    'CONFIRMED',
                    'CHECKED_IN',
                  ] as Prisma.EnumBookingStatusFilter['in'],
                },
                checkInDateTime: { lt: new Date(query.endDate) },
                checkOutDateTime: { gt: new Date(query.startDate) },
              },
            },
          }
        : {};

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
          notIn: [UnitStatus.MAINTENANCE, UnitStatus.BLOCKED],
        },
        ...tenancyFilter,
        ...bookingConflict,
      },
      orderBy: [{ unitNumber: 'asc' }],
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

    return units.map((unit) => ({
      ...unit,
      monthlyRent: unit.monthlyRent?.toString() ?? null,
    }));
  }

  async changeUnit(..._args: unknown[]) {
    throw new BadRequestException(
      'End the current assignment and create a new one to change rooms.',
    );
  }

  async recordRentRevision(..._args: unknown[]) {
    throw new BadRequestException('Rent revision is not available right now.');
  }

  async getRentRevisions(_id: string) {
    return [];
  }

  private async setOccupancy(
    id: string,
    occupancyState: MonthlyOccupancyState,
    role: Role,
  ) {
    if (
      role !== Role.SUPER_ADMIN &&
      role !== Role.ADMIN &&
      role !== Role.RECEPTIONIST
    ) {
      throw new ForbiddenException('Insufficient permissions');
    }

    const existing = await this.getActiveOrThrow(id);

    const tenancy = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.monthlyTenancy.update({
        where: { id },
        data: { occupancyState },
        include: tenancyInclude,
      });

      await tx.unit.update({
        where: { id: existing.unitId },
        data: { status: this.unitStatusForOccupancy(occupancyState) },
      });

      return updated;
    });

    return mapTenancyForRole(tenancy, role);
  }

  private async getAssignableUnit(unitId: string) {
    const unit = await this.prisma.unit.findUnique({
      where: { id: unitId },
      include: { property: true },
    });

    if (!unit || !unit.isActive || !unit.property.isActive) {
      throw new NotFoundException(`Unit with id "${unitId}" not found`);
    }

    if (
      unit.status === UnitStatus.MAINTENANCE ||
      unit.status === UnitStatus.BLOCKED
    ) {
      throw new BadRequestException(
        'Units in maintenance or blocked status cannot be assigned',
      );
    }

    return unit;
  }

  private async getActiveOrThrow(id: string) {
    const tenancy = await this.prisma.monthlyTenancy.findUnique({
      where: { id },
    });

    if (!tenancy) {
      throw new NotFoundException(`Tenancy with id "${id}" not found`);
    }

    if (tenancy.tenancyStatus !== MonthlyTenancyStatus.ACTIVE) {
      throw new BadRequestException('Only active tenancies can be updated');
    }

    return tenancy;
  }

  private assertAgreementDates(start: string, end?: string | null) {
    const startDate = new Date(start);

    if (Number.isNaN(startDate.getTime())) {
      throw new BadRequestException('Invalid agreement start date');
    }

    if (end) {
      const endDate = new Date(end);

      if (Number.isNaN(endDate.getTime())) {
        throw new BadRequestException('Invalid agreement end date');
      }

      if (endDate <= startDate) {
        throw new BadRequestException(
          'Agreement end must be later than agreement start',
        );
      }
    }
  }

  private unitStatusForOccupancy(state: MonthlyOccupancyState): UnitStatus {
    return state === MonthlyOccupancyState.OCCUPIED
      ? UnitStatus.OCCUPIED
      : UnitStatus.MONTHLY_TENANT_VACANT;
  }

  private buildWhere(
    query: QueryMonthlyTenanciesDto,
  ): Prisma.MonthlyTenancyWhereInput {
    const where: Prisma.MonthlyTenancyWhereInput = {};

    if (query.tenantId) where.tenantId = query.tenantId;
    if (query.unitId) where.unitId = query.unitId;
    if (query.tenancyStatus) where.tenancyStatus = query.tenancyStatus;
    if (query.occupancyState) where.occupancyState = query.occupancyState;

    if (query.propertyId) {
      where.unit = { propertyId: query.propertyId };
    }

    if (query.startDate || query.endDate) {
      where.agreementStart = {};
      if (query.startDate) {
        where.agreementStart.gte = new Date(`${query.startDate}T00:00:00.000Z`);
      }
      if (query.endDate) {
        where.agreementStart.lte = new Date(`${query.endDate}T23:59:59.999Z`);
      }
    } else if (query.year !== undefined && query.month !== undefined) {
      const start = new Date(Date.UTC(query.year, query.month - 1, 1));
      const end = new Date(Date.UTC(query.year, query.month, 0, 23, 59, 59, 999));
      where.agreementStart = { gte: start, lte: end };
    } else if (query.year !== undefined) {
      where.agreementStart = {
        gte: new Date(Date.UTC(query.year, 0, 1)),
        lte: new Date(Date.UTC(query.year, 11, 31, 23, 59, 59, 999)),
      };
    } else if (query.month !== undefined) {
      throw new BadRequestException('year is required when month is provided');
    }

    if (query.search?.trim()) {
      const term = query.search.trim();
      where.OR = [
        { tenant: { fullName: { contains: term, mode: 'insensitive' } } },
        { tenant: { phone: { contains: term, mode: 'insensitive' } } },
        { tenant: { cnic: { contains: term, mode: 'insensitive' } } },
        { unit: { unitNumber: { contains: term, mode: 'insensitive' } } },
      ];
    }

    return where;
  }
}
