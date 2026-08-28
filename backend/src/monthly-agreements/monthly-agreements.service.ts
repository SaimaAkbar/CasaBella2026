import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  MonthlyAgreementStatus,
  MonthlyTenancyStatus,
  Prisma,
  Role,
  UnitStatus,
} from '../../generated/prisma/client';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { MonthlyTenantsService } from '../monthly-tenants/monthly-tenants.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMonthlyAgreementDto } from './dto/create-monthly-agreement.dto';
import { RenewMonthlyAgreementDto } from './dto/renew-monthly-agreement.dto';
import {
  QueryMonthlyAgreementsDto,
  UpdateMonthlyAgreementDto,
} from './dto/update-monthly-agreement.dto';
import { mapAgreementForRole } from './monthly-agreements.mapper';

const agreementInclude = {
  tenant: {
    select: { id: true, fullName: true, phone: true, cnic: true },
  },
  assignments: {
    orderBy: { createdAt: 'desc' as const },
    include: {
      unit: {
        include: {
          property: { select: { id: true, name: true } },
        },
      },
    },
  },
  bills: {
    orderBy: [{ billingYear: 'desc' as const }, { billingMonth: 'desc' as const }],
    take: 1,
  },
  _count: { select: { assignments: true } },
} satisfies Prisma.MonthlyAgreementInclude;

@Injectable()
export class MonthlyAgreementsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantsService: MonthlyTenantsService,
    private readonly auditLogs: AuditLogsService,
  ) {}

  async create(dto: CreateMonthlyAgreementDto, role: Role) {
    this.assertManage(role);
    await this.tenantsService.ensureActive(dto.tenantId);
    this.assertDates(dto.agreementStart, dto.agreementEnd);

    const activate = dto.activate !== false;
    const agreementNumber = await this.nextAgreementNumber(
      new Date(dto.agreementStart),
    );

    const created = await this.prisma.monthlyAgreement.create({
      data: {
        tenantId: dto.tenantId,
        agreementNumber,
        agreementStart: new Date(dto.agreementStart),
        agreementEnd: dto.agreementEnd
          ? new Date(dto.agreementEnd)
          : undefined,
        billingDay: dto.billingDay ?? 1,
        securityDeposit: new Prisma.Decimal(dto.securityDeposit ?? 0),
        status: activate
          ? MonthlyAgreementStatus.ACTIVE
          : MonthlyAgreementStatus.DRAFT,
        notes: dto.notes?.trim() || null,
      },
      include: agreementInclude,
    });

    return mapAgreementForRole(created, role);
  }

  async findAll(query: QueryMonthlyAgreementsDto, role: Role) {
    const where: Prisma.MonthlyAgreementWhereInput = {};
    if (query.tenantId) where.tenantId = query.tenantId;
    if (query.status) where.status = query.status;
    if (query.search?.trim()) {
      const term = query.search.trim();
      where.OR = [
        { agreementNumber: { contains: term, mode: 'insensitive' } },
        { tenant: { fullName: { contains: term, mode: 'insensitive' } } },
        { tenant: { phone: { contains: term, mode: 'insensitive' } } },
        { tenant: { cnic: { contains: term, mode: 'insensitive' } } },
      ];
    }

    const rows = await this.prisma.monthlyAgreement.findMany({
      where,
      include: agreementInclude,
      orderBy: { createdAt: 'desc' },
    });

    return rows.map((row) => mapAgreementForRole(row, role));
  }

  async findOne(id: string, role: Role) {
    const row = await this.prisma.monthlyAgreement.findUnique({
      where: { id },
      include: agreementInclude,
    });
    if (!row) {
      throw new NotFoundException(`Agreement with id "${id}" not found`);
    }
    return mapAgreementForRole(row, role);
  }

  async update(id: string, dto: UpdateMonthlyAgreementDto, role: Role, userId: string) {
    this.assertManage(role);
    const existing = await this.getOrThrow(id);

    if (dto.agreementEnd) {
      this.assertDates(
        existing.agreementStart.toISOString(),
        dto.agreementEnd,
      );
    }

    if (
      role === Role.ADMIN &&
      dto.securityDeposit !== undefined &&
      existing.status !== MonthlyAgreementStatus.DRAFT
    ) {
      throw new ForbiddenException(
        'Changing security deposit on a non-draft agreement requires Super Admin',
      );
    }

    const updated = await this.prisma.monthlyAgreement.update({
      where: { id },
      data: {
        agreementEnd: dto.agreementEnd
          ? new Date(dto.agreementEnd)
          : undefined,
        billingDay: dto.billingDay,
        securityDeposit:
          dto.securityDeposit !== undefined
            ? new Prisma.Decimal(dto.securityDeposit)
            : undefined,
        notes: dto.notes === undefined ? undefined : dto.notes.trim() || null,
      },
      include: agreementInclude,
    });

    await this.auditLogs.write({
      module: 'MONTHLY_TENANTS',
      action: 'AGREEMENT_UPDATED',
      recordId: id,
      userId,
      role,
      oldData: {
        agreementEnd: existing.agreementEnd?.toISOString() ?? null,
        billingDay: existing.billingDay,
        securityDeposit: existing.securityDeposit.toString(),
        notes: existing.notes,
      },
      newData: {
        agreementEnd: dto.agreementEnd ?? null,
        billingDay: dto.billingDay ?? null,
        securityDeposit: dto.securityDeposit ?? null,
        notes: dto.notes ?? null,
      },
    });

    return mapAgreementForRole(updated, role);
  }

  async activate(id: string, role: Role) {
    this.assertManage(role);
    const existing = await this.getOrThrow(id);
    if (existing.status !== MonthlyAgreementStatus.DRAFT) {
      throw new BadRequestException('Only DRAFT agreements can be activated');
    }

    const updated = await this.prisma.monthlyAgreement.update({
      where: { id },
      data: { status: MonthlyAgreementStatus.ACTIVE },
      include: agreementInclude,
    });
    return mapAgreementForRole(updated, role);
  }

  async end(id: string, role: Role) {
    if (role !== Role.SUPER_ADMIN) {
      throw new ForbiddenException('Only Super Admin can end an agreement');
    }

    const existing = await this.getOrThrow(id);
    if (
      existing.status !== MonthlyAgreementStatus.ACTIVE &&
      existing.status !== MonthlyAgreementStatus.DRAFT
    ) {
      throw new BadRequestException('Agreement is already ended or cancelled');
    }

    const ended = await this.prisma.$transaction(async (tx) => {
      const activeAssignments = await tx.monthlyTenancy.findMany({
        where: {
          agreementId: id,
          tenancyStatus: MonthlyTenancyStatus.ACTIVE,
        },
      });

      for (const assignment of activeAssignments) {
        await tx.monthlyTenancy.update({
          where: { id: assignment.id },
          data: {
            tenancyStatus: MonthlyTenancyStatus.ENDED,
            endedAt: new Date(),
          },
        });
        await tx.unit.update({
          where: { id: assignment.unitId },
          data: { status: UnitStatus.CLEANING_REQUIRED },
        });
      }

      return tx.monthlyAgreement.update({
        where: { id },
        data: {
          status: MonthlyAgreementStatus.ENDED,
          endedAt: new Date(),
        },
        include: agreementInclude,
      });
    });

    return mapAgreementForRole(ended, role);
  }

  /**
   * Renew an agreement: mark the current one as ENDED and create a brand-new
   * ACTIVE agreement for the same tenant. All historical data (bills, payments,
   * assignments) stays on the old agreement — nothing is deleted or overwritten.
   *
   * SUPER_ADMIN only.
   */
  async renew(
    id: string,
    dto: RenewMonthlyAgreementDto,
    role: Role,
    userId: string,
  ) {
    if (role !== Role.SUPER_ADMIN) {
      throw new ForbiddenException('Only Super Admin can renew an agreement');
    }

    const existing = await this.prisma.monthlyAgreement.findUnique({
      where: { id },
      include: {
        assignments: {
          where: { tenancyStatus: MonthlyTenancyStatus.ACTIVE },
          include: {
            unit: { include: { property: { select: { id: true, name: true } } } },
          },
        },
      },
    });
    if (!existing) {
      throw new NotFoundException(`Agreement with id "${id}" not found`);
    }
    if (
      existing.status !== MonthlyAgreementStatus.ACTIVE &&
      existing.status !== MonthlyAgreementStatus.ENDED
    ) {
      throw new BadRequestException(
        'Only ACTIVE or ENDED agreements can be renewed',
      );
    }

    this.assertDates(dto.agreementStart, dto.agreementEnd);

    const agreementNumber = await this.nextAgreementNumber(
      new Date(dto.agreementStart),
    );

    const newAgreement = await this.prisma.$transaction(async (tx) => {
      // Mark old agreement as ENDED (idempotent — skip if already ended)
      if (existing.status !== MonthlyAgreementStatus.ENDED) {
        await tx.monthlyAgreement.update({
          where: { id },
          data: {
            status: MonthlyAgreementStatus.ENDED,
            endedAt: new Date(),
          },
        });
      }

      // Create the new agreement
      const created = await tx.monthlyAgreement.create({
        data: {
          tenantId: existing.tenantId,
          agreementNumber,
          agreementStart: new Date(dto.agreementStart),
          agreementEnd: dto.agreementEnd
            ? new Date(dto.agreementEnd)
            : undefined,
          billingDay: dto.billingDay ?? existing.billingDay,
          securityDeposit:
            dto.securityDeposit !== undefined
              ? new Prisma.Decimal(dto.securityDeposit)
              : existing.securityDeposit,
          status: MonthlyAgreementStatus.ACTIVE,
          notes: dto.notes?.trim() || null,
        },
        include: agreementInclude,
      });

      // Re-assign all previously active unit assignments to the new agreement.
      // New MonthlyTenancy rows are created; old rows are ended so history is preserved.
      for (const assignment of existing.assignments) {
        await tx.monthlyTenancy.update({
          where: { id: assignment.id },
          data: {
            tenancyStatus: MonthlyTenancyStatus.ENDED,
            endedAt: new Date(),
          },
        });

        await tx.monthlyTenancy.create({
          data: {
            tenantId: existing.tenantId,
            agreementId: created.id,
            unitId: assignment.unitId,
            agreementStart: new Date(dto.agreementStart),
            agreementEnd: dto.agreementEnd
              ? new Date(dto.agreementEnd)
              : undefined,
            monthlyRent: assignment.monthlyRent,
            securityDeposit: new Prisma.Decimal(0),
            maintenanceCharges: assignment.maintenanceCharges,
            laundryCharges: assignment.laundryCharges,
            cleaningCharges: assignment.cleaningCharges,
            waterCharges: assignment.waterCharges,
            societyCharges: assignment.societyCharges,
            electricityCharges: assignment.electricityCharges,
            otherCharges: assignment.otherCharges,
            previousBalance: new Prisma.Decimal(0),
            totalPayable: assignment.monthlyRent,
            totalReceived: new Prisma.Decimal(0),
            remainingBalance: assignment.monthlyRent,
            occupancyState: assignment.occupancyState,
            hotelUseAllowed: assignment.hotelUseAllowed,
            tenancyStatus: MonthlyTenancyStatus.ACTIVE,
            notes: assignment.notes,
          },
        });
      }

      return created;
    });

    await this.auditLogs.write({
      module: 'MONTHLY_TENANTS',
      action: 'AGREEMENT_RENEWED',
      recordId: newAgreement.id,
      userId,
      role,
      oldData: {
        previousAgreementId: id,
        previousAgreementNumber: existing.agreementNumber,
        previousStatus: existing.status,
      },
      newData: {
        agreementNumber: newAgreement.agreementNumber,
        agreementStart: newAgreement.agreementStart.toISOString(),
        agreementEnd: newAgreement.agreementEnd?.toISOString() ?? null,
        assignmentsCarriedOver: existing.assignments.length,
      },
    });

    return mapAgreementForRole(newAgreement, role);
  }

  async ensureActive(id: string) {
    const agreement = await this.getOrThrow(id);
    if (agreement.status !== MonthlyAgreementStatus.ACTIVE) {
      throw new BadRequestException('Agreement must be ACTIVE');
    }
    return agreement;
  }

  private async getOrThrow(id: string) {
    const row = await this.prisma.monthlyAgreement.findUnique({
      where: { id },
    });
    if (!row) {
      throw new NotFoundException(`Agreement with id "${id}" not found`);
    }
    return row;
  }

  private async nextAgreementNumber(start: Date): Promise<string> {
    const stamp = start.toISOString().slice(0, 10).replace(/-/g, '');
    const prefix = `MAG-${stamp}-`;
    const latest = await this.prisma.monthlyAgreement.findFirst({
      where: { agreementNumber: { startsWith: prefix } },
      orderBy: { agreementNumber: 'desc' },
      select: { agreementNumber: true },
    });
    const next = latest
      ? Number(latest.agreementNumber.slice(prefix.length)) + 1
      : 1;
    return `${prefix}${String(Number.isFinite(next) ? next : 1).padStart(4, '0')}`;
  }

  private assertDates(start: string, end?: string | null) {
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

  private assertManage(role: Role) {
    if (role === Role.RECEPTIONIST) {
      throw new ForbiddenException('Insufficient permissions');
    }
  }
}
