import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ApprovalModuleName,
  OwnerAssignmentStatus,
  Prisma,
  Role,
} from '../../generated/prisma/client';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import type { AuditContext } from '../common/types/audit-context.type';
import type { AuthUser } from '../common/types/auth-user.type';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateOwnerUnitAssignmentDto,
  EndOwnerUnitAssignmentDto,
  QueryOwnerUnitAssignmentsDto,
  ReviseOwnerUnitAssignmentDto,
  UpdateOwnerUnitAssignmentDto,
} from './dto/owner-unit-assignment.dto';
import { mapAssignment } from './owners.mapper';
import { OwnersService } from './owners.service';

const assignmentInclude = {
  owner: { select: { id: true, fullName: true, phone: true } },
  property: { select: { id: true, name: true } },
  unit: {
    select: {
      id: true,
      unitNumber: true,
      floor: true,
      unitType: true,
      propertyId: true,
    },
  },
} satisfies Prisma.OwnerUnitAssignmentInclude;

@Injectable()
export class OwnerUnitAssignmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogs: AuditLogsService,
    private readonly ownersService: OwnersService,
  ) {}

  async create(
    dto: CreateOwnerUnitAssignmentDto,
    user: AuthUser,
    auditContext?: AuditContext,
  ) {
    this.ownersService.assertOwnerAccess(user.role);
    await this.assertPropertyUnit(dto.propertyId, dto.unitId);
    await this.ownersService.getOrThrow(dto.ownerId);

    const start = new Date(dto.agreementStart);
    const end = dto.agreementEnd ? new Date(dto.agreementEnd) : null;
    if (Number.isNaN(start.getTime())) {
      throw new BadRequestException('Invalid agreementStart');
    }
    if (end && end <= start) {
      throw new BadRequestException('agreementEnd must be after agreementStart');
    }

    const ownershipPercentage = new Prisma.Decimal(dto.ownershipPercentage);
    const fixedMonthlyAmount = new Prisma.Decimal(dto.fixedMonthlyAmount);
    if (fixedMonthlyAmount.isNegative()) {
      throw new BadRequestException('fixedMonthlyAmount cannot be negative');
    }

    await this.assertOwnershipCap(
      dto.unitId,
      ownershipPercentage,
      undefined,
    );

    const assignment = await this.prisma.ownerUnitAssignment.create({
      data: {
        ownerId: dto.ownerId,
        propertyId: dto.propertyId,
        unitId: dto.unitId,
        accountDirection: dto.accountDirection,
        ownershipPercentage,
        fixedMonthlyAmount,
        agreementStart: start,
        agreementEnd: end,
        dueDay: dto.dueDay ?? 15,
        status: OwnerAssignmentStatus.ACTIVE,
        notes: dto.notes?.trim(),
      },
      include: assignmentInclude,
    });

    await this.auditLogs.write({
      module: ApprovalModuleName.OWNERS,
      action: 'CREATE_ASSIGNMENT',
      recordId: assignment.id,
      userId: user.id,
      role: user.role,
      newData: assignment,
      context: auditContext,
    });

    return mapAssignment(assignment);
  }

  async findAll(query: QueryOwnerUnitAssignmentsDto, role: Role) {
    this.ownersService.assertOwnerAccess(role);

    const where: Prisma.OwnerUnitAssignmentWhereInput = {};
    if (query.ownerId) where.ownerId = query.ownerId;
    if (query.propertyId) where.propertyId = query.propertyId;
    if (query.unitId) where.unitId = query.unitId;
    if (query.accountDirection) where.accountDirection = query.accountDirection;
    if (query.status) where.status = query.status;

    if (query.search?.trim()) {
      const term = query.search.trim();
      where.OR = [
        { owner: { fullName: { contains: term, mode: 'insensitive' } } },
        { property: { name: { contains: term, mode: 'insensitive' } } },
        { unit: { unitNumber: { contains: term, mode: 'insensitive' } } },
      ];
    }

    const rows = await this.prisma.ownerUnitAssignment.findMany({
      where,
      include: assignmentInclude,
      orderBy: [{ status: 'asc' }, { agreementStart: 'desc' }],
    });

    return rows.map((row) => mapAssignment(row));
  }

  async findOne(id: string, role: Role) {
    this.ownersService.assertOwnerAccess(role);
    const row = await this.getOrThrow(id);
    return mapAssignment(row);
  }

  async update(
    id: string,
    dto: UpdateOwnerUnitAssignmentDto,
    user: AuthUser,
    auditContext?: AuditContext,
  ) {
    this.ownersService.assertOwnerAccess(user.role);
    const existing = await this.getOrThrow(id);

    if (existing.status !== OwnerAssignmentStatus.ACTIVE) {
      throw new BadRequestException('Only ACTIVE assignments can be edited');
    }

    // Amount / percentage changes require revise() so history is preserved.
    if (
      dto.fixedMonthlyAmount !== undefined ||
      dto.ownershipPercentage !== undefined
    ) {
      throw new ForbiddenException(
        'Use POST /owner-unit-assignments/:id/revise to change monthly amount or ownership percentage',
      );
    }

    // Unit change: end old + create new (never overwrite unitId)
    if (dto.newUnitId || dto.newPropertyId) {
      const newPropertyId = dto.newPropertyId ?? existing.propertyId;
      const newUnitId = dto.newUnitId ?? existing.unitId;
      if (newUnitId === existing.unitId && newPropertyId === existing.propertyId) {
        throw new BadRequestException('New unit is the same as the current unit');
      }
      await this.assertPropertyUnit(newPropertyId, newUnitId);

      const result = await this.prisma.$transaction(async (tx) => {
        const ended = await tx.ownerUnitAssignment.update({
          where: { id },
          data: {
            status: OwnerAssignmentStatus.ENDED,
            endedAt: new Date(),
            agreementEnd: new Date(),
          },
        });

        const created = await tx.ownerUnitAssignment.create({
          data: {
            ownerId: existing.ownerId,
            propertyId: newPropertyId,
            unitId: newUnitId,
            accountDirection: dto.accountDirection ?? existing.accountDirection,
            ownershipPercentage: existing.ownershipPercentage,
            fixedMonthlyAmount: existing.fixedMonthlyAmount,
            agreementStart: dto.agreementStart
              ? new Date(dto.agreementStart)
              : new Date(),
            agreementEnd: dto.agreementEnd
              ? new Date(dto.agreementEnd)
              : null,
            dueDay: dto.dueDay ?? existing.dueDay,
            status: OwnerAssignmentStatus.ACTIVE,
            notes: dto.notes?.trim() ?? existing.notes,
          },
          include: assignmentInclude,
        });

        return { ended, created };
      });

      await this.auditLogs.write({
        module: ApprovalModuleName.OWNERS,
        action: 'TRANSFER_ASSIGNMENT',
        recordId: result.created.id,
        userId: user.id,
        role: user.role,
        oldData: result.ended,
        newData: result.created,
        context: auditContext,
      });

      return mapAssignment(result.created);
    }

    if (
      dto.agreementStart &&
      dto.agreementEnd &&
      new Date(dto.agreementEnd) <= new Date(dto.agreementStart)
    ) {
      throw new BadRequestException('agreementEnd must be after agreementStart');
    }

    const updated = await this.prisma.ownerUnitAssignment.update({
      where: { id },
      data: {
        accountDirection: dto.accountDirection,
        agreementStart: dto.agreementStart
          ? new Date(dto.agreementStart)
          : undefined,
        agreementEnd:
          dto.agreementEnd === undefined
            ? undefined
            : dto.agreementEnd === null
              ? null
              : new Date(dto.agreementEnd),
        dueDay: dto.dueDay,
        notes: dto.notes?.trim(),
      },
      include: assignmentInclude,
    });

    await this.auditLogs.write({
      module: ApprovalModuleName.OWNERS,
      action: 'UPDATE_ASSIGNMENT',
      recordId: id,
      userId: user.id,
      role: user.role,
      oldData: existing,
      newData: updated,
      context: auditContext,
    });

    return mapAssignment(updated);
  }

  /**
   * Super Admin only. Creates an OwnerAgreementRevision and updates the
   * current fixedMonthlyAmount. Existing monthly statements are never rewritten.
   */
  async revise(
    id: string,
    dto: ReviseOwnerUnitAssignmentDto,
    user: AuthUser,
    auditContext?: AuditContext,
  ) {
    this.ownersService.assertOwnerAccess(user.role);
    if (user.role !== Role.SUPER_ADMIN) {
      throw new ForbiddenException(
        'Only Super Admin can revise agreement amounts. Admin must request approval separately.',
      );
    }

    const existing = await this.getOrThrow(id);
    if (existing.status !== OwnerAssignmentStatus.ACTIVE) {
      throw new BadRequestException('Only ACTIVE agreements can be revised');
    }

    const effectiveFrom = new Date(dto.effectiveFrom);
    if (Number.isNaN(effectiveFrom.getTime())) {
      throw new BadRequestException('Invalid effectiveFrom');
    }
    if (!dto.reason.trim()) {
      throw new BadRequestException('Revision reason is required');
    }

    const newAmount = new Prisma.Decimal(dto.newFixedMonthlyAmount);
    if (newAmount.isNegative()) {
      throw new BadRequestException('newFixedMonthlyAmount cannot be negative');
    }

    const newPercentage =
      dto.newOwnershipPercentage === undefined
        ? undefined
        : new Prisma.Decimal(dto.newOwnershipPercentage);

    if (newPercentage) {
      await this.assertOwnershipCap(existing.unitId, newPercentage, existing.id);
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const revision = await tx.ownerAgreementRevision.create({
        data: {
          ownerUnitAssignmentId: id,
          previousFixedMonthlyAmount: existing.fixedMonthlyAmount,
          newFixedMonthlyAmount: newAmount,
          previousOwnershipPercentage: existing.ownershipPercentage,
          newOwnershipPercentage: newPercentage ?? existing.ownershipPercentage,
          effectiveFrom,
          reason: dto.reason.trim(),
          createdByUserId: user.id,
        },
      });

      const updated = await tx.ownerUnitAssignment.update({
        where: { id },
        data: {
          fixedMonthlyAmount: newAmount,
          ownershipPercentage: newPercentage ?? undefined,
        },
        include: assignmentInclude,
      });

      return { revision, updated };
    });

    await this.auditLogs.write({
      module: ApprovalModuleName.OWNERS,
      action: 'REVISE_AGREEMENT',
      recordId: id,
      userId: user.id,
      role: user.role,
      oldData: {
        fixedMonthlyAmount: existing.fixedMonthlyAmount.toString(),
        ownershipPercentage: existing.ownershipPercentage.toString(),
      },
      newData: {
        fixedMonthlyAmount: newAmount.toString(),
        ownershipPercentage: (
          newPercentage ?? existing.ownershipPercentage
        ).toString(),
        effectiveFrom: effectiveFrom.toISOString(),
        reason: dto.reason.trim(),
        revisionId: result.revision.id,
      },
      context: auditContext,
    });

    return {
      assignment: mapAssignment(result.updated),
      revision: {
        id: result.revision.id,
        previousFixedMonthlyAmount:
          result.revision.previousFixedMonthlyAmount.toString(),
        newFixedMonthlyAmount: result.revision.newFixedMonthlyAmount.toString(),
        previousOwnershipPercentage:
          result.revision.previousOwnershipPercentage?.toString() ?? null,
        newOwnershipPercentage:
          result.revision.newOwnershipPercentage?.toString() ?? null,
        effectiveFrom: result.revision.effectiveFrom.toISOString(),
        reason: result.revision.reason,
        createdAt: result.revision.createdAt.toISOString(),
      },
    };
  }

  async end(
    id: string,
    dto: EndOwnerUnitAssignmentDto,
    user: AuthUser,
    auditContext?: AuditContext,
  ) {
    this.ownersService.assertOwnerAccess(user.role);
    const existing = await this.getOrThrow(id);
    if (existing.status !== OwnerAssignmentStatus.ACTIVE) {
      throw new BadRequestException('Assignment is not ACTIVE');
    }

    const endedAt = dto.endedAt ? new Date(dto.endedAt) : new Date();
    const updated = await this.prisma.ownerUnitAssignment.update({
      where: { id },
      data: {
        status: OwnerAssignmentStatus.ENDED,
        endedAt,
        agreementEnd: endedAt,
        notes: dto.reason
          ? `${existing.notes ? `${existing.notes}; ` : ''}ENDED: ${dto.reason}`
          : existing.notes,
      },
      include: assignmentInclude,
    });

    await this.auditLogs.write({
      module: ApprovalModuleName.OWNERS,
      action: 'END_ASSIGNMENT',
      recordId: id,
      userId: user.id,
      role: user.role,
      oldData: existing,
      newData: updated,
      context: auditContext,
    });

    return mapAssignment(updated);
  }

  async archive(id: string, user: AuthUser, auditContext?: AuditContext) {
    this.ownersService.assertOwnerAccess(user.role);
    if (user.role !== Role.SUPER_ADMIN) {
      throw new ForbiddenException(
        'Only Super Admin can archive/delete assignments',
      );
    }

    const existing = await this.getOrThrow(id);
    const statementCount = await this.prisma.ownerMonthlyStatement.count({
      where: { ownerUnitAssignmentId: id },
    });
    if (statementCount > 0) {
      throw new BadRequestException(
        'Cannot hard-delete assignment with statements; end/archive instead',
      );
    }

    const updated = await this.prisma.ownerUnitAssignment.update({
      where: { id },
      data: {
        status: OwnerAssignmentStatus.CANCELLED,
        endedAt: new Date(),
      },
      include: assignmentInclude,
    });

    await this.auditLogs.write({
      module: ApprovalModuleName.OWNERS,
      action: 'ARCHIVE_ASSIGNMENT',
      recordId: id,
      userId: user.id,
      role: user.role,
      oldData: existing,
      newData: updated,
      context: auditContext,
    });

    return mapAssignment(updated);
  }

  async assertPropertyUnit(propertyId: string, unitId: string) {
    const property = await this.prisma.property.findUnique({
      where: { id: propertyId },
    });
    if (!property) {
      throw new NotFoundException(`Property "${propertyId}" not found`);
    }

    const unit = await this.prisma.unit.findUnique({ where: { id: unitId } });
    if (!unit) {
      throw new NotFoundException(`Unit "${unitId}" not found`);
    }
    if (unit.propertyId !== propertyId) {
      throw new BadRequestException(
        'Selected unit does not belong to the selected property.',
      );
    }
    return { property, unit };
  }

  private async assertOwnershipCap(
    unitId: string,
    nextPercentage: Prisma.Decimal,
    excludeAssignmentId?: string,
  ) {
    if (nextPercentage.lessThan(0) || nextPercentage.greaterThan(100)) {
      throw new BadRequestException(
        'ownershipPercentage must be between 0 and 100',
      );
    }

    // Percentage-based = ownershipPercentage > 0
    if (nextPercentage.equals(0)) {
      return;
    }

    const others = await this.prisma.ownerUnitAssignment.findMany({
      where: {
        unitId,
        status: OwnerAssignmentStatus.ACTIVE,
        ownershipPercentage: { gt: 0 },
        ...(excludeAssignmentId ? { id: { not: excludeAssignmentId } } : {}),
      },
      select: { ownershipPercentage: true },
    });

    const sum = others.reduce(
      (acc, row) => acc.plus(row.ownershipPercentage),
      nextPercentage,
    );

    if (sum.greaterThan(100)) {
      throw new ConflictException(
        `Active ownership percentages for this unit would exceed 100% (would be ${sum.toString()}%)`,
      );
    }
  }

  private async getOrThrow(id: string) {
    const row = await this.prisma.ownerUnitAssignment.findUnique({
      where: { id },
      include: assignmentInclude,
    });
    if (!row) {
      throw new NotFoundException(`Owner unit assignment "${id}" not found`);
    }
    return row;
  }
}
