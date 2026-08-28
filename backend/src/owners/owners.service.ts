import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ApprovalModuleName,
  OwnerAccountDirection,
  OwnerAssignmentStatus,
  OwnerStatementPaymentStatus,
  Prisma,
  Role,
} from '../../generated/prisma/client';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import {
  HISTORY_CANNOT_DELETE_MESSAGE,
  type RemovalPolicy,
} from '../common/constants/record-removal';
import type { AuthUser } from '../common/types/auth-user.type';
import type { AuditContext } from '../common/types/audit-context.type';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateOwnerDto,
  QueryOwnersDto,
  UpdateOwnerDto,
} from './dto/owner.dto';
import {
  QueryOwnerOverviewDto,
  QueryOwnersMonthlySummaryDto,
} from './dto/owner-statement.dto';
import {
  deriveOwnerOverallStatus,
  formatOwnerPeriodLabel,
  paymentStatusTick,
  serializeMoney,
} from './owner-finance';
import { mapOwnerForRole } from './owners.mapper';

@Injectable()
export class OwnersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogs: AuditLogsService,
  ) {}

  assertOwnerAccess(role: Role) {
    if (role !== Role.SUPER_ADMIN) {
      throw new ForbiddenException(
        'Only Super Admin can access owner financial data',
      );
    }
  }

  async create(
    dto: CreateOwnerDto,
    user: AuthUser,
    auditContext?: AuditContext,
  ) {
    this.assertOwnerAccess(user.role);

    try {
      const owner = await this.prisma.owner.create({
        data: {
          fullName: dto.fullName.trim(),
          fatherOrSpouseName: dto.fatherOrSpouseName?.trim(),
          phone: dto.phone.trim(),
          alternatePhone: dto.alternatePhone?.trim(),
          email: dto.email?.trim()?.toLowerCase(),
          cnic: dto.cnic?.trim() || null,
          address: dto.address?.trim(),
          city: dto.city?.trim(),
          bankName: dto.bankName?.trim(),
          accountTitle: dto.accountTitle?.trim(),
          accountNumberOrIban: dto.accountNumberOrIban?.trim(),
          branchName: dto.branchName?.trim(),
          notes: dto.notes?.trim(),
          isActive: true,
        },
      });

      await this.auditLogs.write({
        module: ApprovalModuleName.OWNERS,
        action: 'CREATE',
        recordId: owner.id,
        userId: user.id,
        role: user.role,
        newData: owner,
        context: auditContext,
      });

      return mapOwnerForRole(owner, user.role);
    } catch (error) {
      this.handlePrismaError(error);
    }
  }

  async findAll(query: QueryOwnersDto, role: Role) {
    this.assertOwnerAccess(role);

    const where: Prisma.OwnerWhereInput = {};
    if (query.isActive !== undefined) where.isActive = query.isActive;

    if (query.search?.trim()) {
      const term = query.search.trim();
      where.OR = [
        { fullName: { contains: term, mode: 'insensitive' } },
        { phone: { contains: term, mode: 'insensitive' } },
        { email: { contains: term, mode: 'insensitive' } },
        { cnic: { contains: term, mode: 'insensitive' } },
      ];
    }

    if (query.propertyId || query.unitId) {
      where.unitAssignments = {
        some: {
          status: OwnerAssignmentStatus.ACTIVE,
          ...(query.propertyId ? { propertyId: query.propertyId } : {}),
          ...(query.unitId ? { unitId: query.unitId } : {}),
        },
      };
    }

    const now = new Date();
    const month = now.getUTCMonth() + 1;
    const year = now.getUTCFullYear();

    const owners = await this.prisma.owner.findMany({
      where,
      include: {
        unitAssignments: {
          where: { status: OwnerAssignmentStatus.ACTIVE },
          select: {
            propertyId: true,
            unitId: true,
            fixedMonthlyAmount: true,
          },
        },
        monthlyStatements: {
          where: { statementMonth: month, statementYear: year },
          select: {
            totalPaid: true,
            remainingAmount: true,
            totalPayableOrReceivable: true,
          },
        },
      },
      orderBy: [{ isActive: 'desc' }, { fullName: 'asc' }],
    });

    const items = owners.map((owner) => {
      const propertyIds = new Set(
        owner.unitAssignments.map((a) => a.propertyId),
      );
      const unitIds = new Set(owner.unitAssignments.map((a) => a.unitId));
      const monthlyExpected = owner.unitAssignments.reduce(
        (sum, a) => sum.plus(a.fixedMonthlyAmount),
        new Prisma.Decimal(0),
      );
      const paidThisMonth = owner.monthlyStatements.reduce(
        (sum, s) => sum.plus(s.totalPaid),
        new Prisma.Decimal(0),
      );
      const remaining = owner.monthlyStatements.reduce(
        (sum, s) => sum.plus(s.remainingAmount),
        new Prisma.Decimal(0),
      );

      return mapOwnerForRole(
        {
          id: owner.id,
          fullName: owner.fullName,
          fatherOrSpouseName: owner.fatherOrSpouseName,
          phone: owner.phone,
          alternatePhone: owner.alternatePhone,
          email: owner.email,
          cnic: owner.cnic,
          address: owner.address,
          city: owner.city,
          bankName: owner.bankName,
          accountTitle: owner.accountTitle,
          accountNumberOrIban: owner.accountNumberOrIban,
          branchName: owner.branchName,
          notes: owner.notes,
          isActive: owner.isActive,
          createdAt: owner.createdAt,
          updatedAt: owner.updatedAt,
        },
        role,
        {
          propertyCount: propertyIds.size,
          assignedUnitCount: unitIds.size,
          unitCount: unitIds.size,
          monthlyExpected: serializeMoney(monthlyExpected),
          currentMonthPaid: serializeMoney(paidThisMonth),
          paidThisMonth: serializeMoney(paidThisMonth),
          currentMonthRemaining: serializeMoney(remaining),
          remaining: serializeMoney(remaining),
        },
      );
    });

    const assignedUnitIds = new Set<string>();
    let expectedSum = new Prisma.Decimal(0);
    let outstandingSum = new Prisma.Decimal(0);
    for (const owner of owners) {
      for (const a of owner.unitAssignments) {
        assignedUnitIds.add(a.unitId);
        expectedSum = expectedSum.plus(a.fixedMonthlyAmount);
      }
      for (const s of owner.monthlyStatements) {
        outstandingSum = outstandingSum.plus(s.remainingAmount);
      }
    }

    return {
      items,
      totals: {
        totalOwners: items.length,
        assignedApartments: assignedUnitIds.size,
        expectedThisMonth: serializeMoney(expectedSum),
        outstandingThisMonth: serializeMoney(outstandingSum),
      },
    };
  }

  /**
   * Period-scoped owner list for the first Owners page.
   * Official totals come only from this endpoint (not recomputed in React).
   */
  async getMonthlySummary(query: QueryOwnersMonthlySummaryDto, role: Role) {
    this.assertOwnerAccess(role);

    const month = query.month;
    const year = query.year;
    const label = formatOwnerPeriodLabel(month, year);

    const ownerWhere: Prisma.OwnerWhereInput = {
      isActive: true,
    };

    if (query.search?.trim()) {
      const term = query.search.trim();
      ownerWhere.OR = [
        { fullName: { contains: term, mode: 'insensitive' } },
        { phone: { contains: term, mode: 'insensitive' } },
        { email: { contains: term, mode: 'insensitive' } },
        { cnic: { contains: term, mode: 'insensitive' } },
      ];
    }

    if (query.propertyId) {
      ownerWhere.unitAssignments = {
        some: {
          status: OwnerAssignmentStatus.ACTIVE,
          propertyId: query.propertyId,
        },
      };
    }

    const owners = await this.prisma.owner.findMany({
      where: ownerWhere,
      include: {
        unitAssignments: {
          where: {
            status: OwnerAssignmentStatus.ACTIVE,
            ...(query.propertyId ? { propertyId: query.propertyId } : {}),
          },
          include: {
            property: { select: { id: true, name: true } },
            unit: {
              select: {
                id: true,
                unitNumber: true,
                unitType: true,
                floor: true,
              },
            },
            monthlyStatements: {
              where: { statementMonth: month, statementYear: year },
              take: 1,
            },
          },
          orderBy: [
            { property: { name: 'asc' } },
            { unit: { unitNumber: 'asc' } },
          ],
        },
      },
      orderBy: [{ fullName: 'asc' }],
    });

    let totalExpected = new Prisma.Decimal(0);
    let totalPaid = new Prisma.Decimal(0);
    let totalRemaining = new Prisma.Decimal(0);
    const assignedUnitIds = new Set<string>();

    const ownerRows = owners.map((owner) => {
      let ownerExpected = new Prisma.Decimal(0);
      let ownerPaid = new Prisma.Decimal(0);
      let ownerRemaining = new Prisma.Decimal(0);

      const units = owner.unitAssignments.map((a) => {
        assignedUnitIds.add(a.unitId);
        const statement = a.monthlyStatements[0];
        const agreed = a.fixedMonthlyAmount;
        const expected = statement
          ? statement.totalPayableOrReceivable
          : agreed;
        const paid = statement ? statement.totalPaid : new Prisma.Decimal(0);
        const remaining = statement
          ? statement.remainingAmount
          : expected;
        const paymentStatus = statement
          ? statement.paymentStatus
          : OwnerStatementPaymentStatus.UNPAID;
        const tick = paymentStatusTick(paymentStatus);

        ownerExpected = ownerExpected.plus(expected);
        ownerPaid = ownerPaid.plus(paid);
        ownerRemaining = ownerRemaining.plus(remaining);
        totalExpected = totalExpected.plus(expected);
        totalPaid = totalPaid.plus(paid);
        totalRemaining = totalRemaining.plus(remaining);

        return {
          agreementId: a.id,
          propertyId: a.propertyId,
          propertyName: a.property.name,
          unitId: a.unitId,
          unitNumber: a.unit.unitNumber,
          unitType: a.unit.unitType,
          floor: a.unit.floor,
          accountDirection: a.accountDirection,
          agreedMonthlyAmount: serializeMoney(agreed),
          statementId: statement?.id ?? null,
          expected: serializeMoney(expected),
          paid: serializeMoney(paid),
          remaining: serializeMoney(remaining),
          dueDate: statement?.dueDate.toISOString() ?? null,
          paymentStatus,
          paymentStatusTick: tick,
        };
      });

      const status =
        units.length === 0
          ? OwnerStatementPaymentStatus.UNPAID
          : deriveOwnerOverallStatus(units.map((u) => u.paymentStatus));

      return {
        ownerId: owner.id,
        fullName: owner.fullName,
        phone: owner.phone,
        email: owner.email,
        isActive: owner.isActive,
        unitCount: units.length,
        expected: serializeMoney(ownerExpected),
        paid: serializeMoney(ownerPaid),
        remaining: serializeMoney(ownerRemaining),
        status,
        statusTick: paymentStatusTick(status),
        units,
      };
    });

    return {
      period: { month, year, label },
      totals: {
        totalOwners: ownerRows.length,
        assignedUnits: assignedUnitIds.size,
        expected: serializeMoney(totalExpected),
        paid: serializeMoney(totalPaid),
        remaining: serializeMoney(totalRemaining),
      },
      owners: ownerRows,
    };
  }

  async findOne(id: string, role: Role) {
    this.assertOwnerAccess(role);
    const owner = await this.getOrThrow(id);
    const active = await this.prisma.ownerUnitAssignment.findMany({
      where: { ownerId: id, status: OwnerAssignmentStatus.ACTIVE },
      select: { propertyId: true, unitId: true, fixedMonthlyAmount: true },
    });
    const propertyIds = new Set(active.map((a) => a.propertyId));
    const unitIds = new Set(active.map((a) => a.unitId));
    const monthlyExpected = active.reduce(
      (sum, a) => sum.plus(a.fixedMonthlyAmount),
      new Prisma.Decimal(0),
    );

    return mapOwnerForRole(owner, role, {
      propertyCount: propertyIds.size,
      unitCount: unitIds.size,
      monthlyExpected: serializeMoney(monthlyExpected),
    });
  }

  async getOwnerSummary(id: string, role: Role) {
    this.assertOwnerAccess(role);
    await this.getOrThrow(id);

    const now = new Date();
    const month = now.getUTCMonth() + 1;
    const year = now.getUTCFullYear();

    const assignmentIds = (
      await this.prisma.ownerUnitAssignment.findMany({
        where: { ownerId: id },
        select: { id: true },
      })
    ).map((a) => a.id);

    const [assignments, statements, payments, revisions, auditEvents] =
      await Promise.all([
        this.prisma.ownerUnitAssignment.findMany({
          where: { ownerId: id },
          include: {
            property: { select: { id: true, name: true } },
            unit: {
              select: {
                id: true,
                unitNumber: true,
                floor: true,
                unitType: true,
              },
            },
          },
          orderBy: [{ status: 'asc' }, { agreementStart: 'desc' }],
        }),
        this.prisma.ownerMonthlyStatement.findMany({
          where: { ownerId: id },
          include: {
            property: { select: { id: true, name: true } },
            unit: { select: { id: true, unitNumber: true, floor: true } },
          },
          orderBy: [
            { statementYear: 'desc' },
            { statementMonth: 'desc' },
          ],
        }),
        this.prisma.payment.findMany({
          where: { ownerId: id, paymentForType: 'OWNER' },
          include: {
            ownerMonthlyStatement: {
              include: {
                property: { select: { id: true, name: true } },
                unit: { select: { id: true, unitNumber: true } },
              },
            },
          },
          orderBy: { paymentDate: 'desc' },
          take: 100,
        }),
        this.prisma.ownerAgreementRevision.findMany({
          where: { ownerUnitAssignment: { ownerId: id } },
          include: {
            ownerUnitAssignment: {
              select: {
                id: true,
                unit: { select: { unitNumber: true } },
                property: { select: { name: true } },
              },
            },
            createdBy: { select: { id: true, fullName: true } },
          },
          orderBy: { createdAt: 'desc' },
          take: 50,
        }),
        this.prisma.auditLog.findMany({
          where: {
            module: ApprovalModuleName.OWNERS,
            OR: [
              { recordId: id },
              ...(assignmentIds.length
                ? [{ recordId: { in: assignmentIds } }]
                : []),
            ],
          },
          orderBy: { createdAt: 'desc' },
          take: 50,
        }),
      ]);

    const thisMonth = statements.filter(
      (s) => s.statementMonth === month && s.statementYear === year,
    );

    const receivable = thisMonth.filter(
      (s) => s.accountDirection === OwnerAccountDirection.RECEIVABLE_FROM_OWNER,
    );
    const payable = thisMonth.filter(
      (s) => s.accountDirection === OwnerAccountDirection.PAYABLE_TO_OWNER,
    );

    return {
      owner: mapOwnerForRole(await this.getOrThrow(id), role),
      tabs: [
        'Profile',
        'Units & Agreements',
        'Monthly Statements',
        'Payments',
        'History',
      ],
      assignments: assignments.map((a) => {
        const current = statements.find(
          (s) =>
            s.ownerUnitAssignmentId === a.id &&
            s.statementMonth === month &&
            s.statementYear === year,
        );
        const tick = current
          ? paymentStatusTick(current.paymentStatus)
          : null;
        return {
          id: a.id,
          property: a.property,
          unit: a.unit,
          ownershipPercentage: serializeMoney(a.ownershipPercentage),
          fixedMonthlyAmount: serializeMoney(a.fixedMonthlyAmount),
          accountDirection: a.accountDirection,
          agreementStart: a.agreementStart.toISOString(),
          agreementEnd: a.agreementEnd?.toISOString() ?? null,
          status: a.status,
          thisMonthStatus: current?.paymentStatus ?? null,
          thisMonthStatusTick: tick,
          thisMonthPaid: current
            ? serializeMoney(current.totalPaid)
            : null,
          thisMonthRemaining: current
            ? serializeMoney(current.remainingAmount)
            : null,
        };
      }),
      statements: statements.slice(0, 36).map((s) => {
        const tick = paymentStatusTick(s.paymentStatus);
        return {
          id: s.id,
          statementMonth: s.statementMonth,
          statementYear: s.statementYear,
          property: s.property,
          unit: s.unit,
          expectedAmount: serializeMoney(s.expectedAmount),
          totalPaid: serializeMoney(s.totalPaid),
          remainingAmount: serializeMoney(s.remainingAmount),
          dueDate: s.dueDate.toISOString(),
          paymentStatus: s.paymentStatus,
          paymentStatusTick: tick,
          accountDirection: s.accountDirection,
        };
      }),
      payments: payments.map((p) => ({
        id: p.id,
        paymentNumber: p.paymentNumber,
        paymentDate: p.paymentDate.toISOString(),
        amount: serializeMoney(p.amount),
        paymentMethod: p.paymentMethod,
        bankName: p.bankName,
        transactionReference: p.transactionReference,
        status: p.status,
        transactionType: p.transactionType,
        property: p.ownerMonthlyStatement?.property ?? null,
        unit: p.ownerMonthlyStatement?.unit ?? null,
      })),
      revisions: revisions.map((r) => ({
        id: r.id,
        assignmentId: r.ownerUnitAssignmentId,
        propertyName: r.ownerUnitAssignment.property.name,
        unitNumber: r.ownerUnitAssignment.unit.unitNumber,
        previousFixedMonthlyAmount: r.previousFixedMonthlyAmount.toString(),
        newFixedMonthlyAmount: r.newFixedMonthlyAmount.toString(),
        previousOwnershipPercentage:
          r.previousOwnershipPercentage?.toString() ?? null,
        newOwnershipPercentage: r.newOwnershipPercentage?.toString() ?? null,
        effectiveFrom: r.effectiveFrom.toISOString(),
        reason: r.reason,
        createdBy: r.createdBy,
        createdAt: r.createdAt.toISOString(),
      })),
      history: auditEvents.map((e) => ({
        id: e.id,
        action: e.action,
        recordId: e.recordId,
        oldData: e.oldData,
        newData: e.newData,
        createdAt: e.createdAt.toISOString(),
        role: e.role,
      })),
      totals: {
        thisMonthReceivableExpected: serializeMoney(
          receivable.reduce(
            (s, r) => s.plus(r.totalPayableOrReceivable),
            new Prisma.Decimal(0),
          ),
        ),
        thisMonthReceivablePaid: serializeMoney(
          receivable.reduce(
            (s, r) => s.plus(r.totalPaid),
            new Prisma.Decimal(0),
          ),
        ),
        thisMonthReceivableRemaining: serializeMoney(
          receivable.reduce(
            (s, r) => s.plus(r.remainingAmount),
            new Prisma.Decimal(0),
          ),
        ),
        thisMonthPayableExpected: serializeMoney(
          payable.reduce(
            (s, r) => s.plus(r.totalPayableOrReceivable),
            new Prisma.Decimal(0),
          ),
        ),
        thisMonthPayablePaid: serializeMoney(
          payable.reduce((s, r) => s.plus(r.totalPaid), new Prisma.Decimal(0)),
        ),
        thisMonthPayableRemaining: serializeMoney(
          payable.reduce(
            (s, r) => s.plus(r.remainingAmount),
            new Prisma.Decimal(0),
          ),
        ),
      },
    };
  }

  async getYearView(id: string, year: number, role: Role) {
    this.assertOwnerAccess(role);
    await this.getOrThrow(id);
    if (!year || year < 2000 || year > 2100) {
      throw new BadRequestException('Invalid year');
    }

    const statements = await this.prisma.ownerMonthlyStatement.findMany({
      where: { ownerId: id, statementYear: year },
      include: {
        property: { select: { id: true, name: true } },
        unit: { select: { id: true, unitNumber: true } },
      },
      orderBy: [{ unitId: 'asc' }, { statementMonth: 'asc' }],
    });

    const byUnit = new Map<
      string,
      {
        unitId: string;
        unitNumber: string;
        propertyName: string;
        months: Array<{
          month: number;
          paymentStatus: string | null;
          paymentStatusTick: { icon: string; label: string } | null;
          expectedAmount: string | null;
          totalPaid: string | null;
          remainingAmount: string | null;
          statementId: string | null;
        }>;
      }
    >();

    for (const s of statements) {
      let row = byUnit.get(s.unitId);
      if (!row) {
        row = {
          unitId: s.unitId,
          unitNumber: s.unit.unitNumber,
          propertyName: s.property.name,
          months: Array.from({ length: 12 }, (_, i) => ({
            month: i + 1,
            paymentStatus: null,
            paymentStatusTick: null,
            expectedAmount: null,
            totalPaid: null,
            remainingAmount: null,
            statementId: null,
          })),
        };
        byUnit.set(s.unitId, row);
      }
      const tick = paymentStatusTick(s.paymentStatus);
      row.months[s.statementMonth - 1] = {
        month: s.statementMonth,
        paymentStatus: s.paymentStatus,
        paymentStatusTick: tick,
        expectedAmount: serializeMoney(s.expectedAmount),
        totalPaid: serializeMoney(s.totalPaid),
        remainingAmount: serializeMoney(s.remainingAmount),
        statementId: s.id,
      };
    }

    return {
      ownerId: id,
      year,
      units: Array.from(byUnit.values()),
    };
  }

  async update(
    id: string,
    dto: UpdateOwnerDto,
    user: AuthUser,
    auditContext?: AuditContext,
  ) {
    this.assertOwnerAccess(user.role);
    const existing = await this.getOrThrow(id);

    if (user.role === Role.ADMIN) {
      const sensitiveKeys = [
        'bankName',
        'accountTitle',
        'accountNumberOrIban',
        'cnic',
      ] as const;
      if (sensitiveKeys.some((key) => dto[key] !== undefined)) {
        // Admin may update via approval in a fuller flow; for now allow with audit.
      }
    }

    try {
      const owner = await this.prisma.owner.update({
        where: { id },
        data: {
          fullName: dto.fullName?.trim(),
          fatherOrSpouseName: dto.fatherOrSpouseName?.trim(),
          phone: dto.phone?.trim(),
          alternatePhone: dto.alternatePhone?.trim(),
          email: dto.email?.trim()?.toLowerCase(),
          cnic:
            dto.cnic === undefined
              ? undefined
              : dto.cnic.trim()
                ? dto.cnic.trim()
                : null,
          address: dto.address?.trim(),
          city: dto.city?.trim(),
          bankName: dto.bankName?.trim(),
          accountTitle: dto.accountTitle?.trim(),
          accountNumberOrIban: dto.accountNumberOrIban?.trim(),
          branchName: dto.branchName?.trim(),
          notes: dto.notes?.trim(),
          isActive: dto.isActive,
        },
      });

      await this.auditLogs.write({
        module: ApprovalModuleName.OWNERS,
        action: 'UPDATE',
        recordId: id,
        userId: user.id,
        role: user.role,
        oldData: existing,
        newData: owner,
        context: auditContext,
      });

      return mapOwnerForRole(owner, user.role);
    } catch (error) {
      this.handlePrismaError(error);
    }
  }

  async archive(
    id: string,
    user: AuthUser,
    auditContext?: AuditContext,
    reason?: string,
  ) {
    this.assertOwnerAccess(user.role);
    if (user.role !== Role.SUPER_ADMIN) {
      throw new ForbiddenException('Only Super Admin can archive owners');
    }

    const existing = await this.getOrThrow(id);
    if (!existing.isActive) {
      throw new BadRequestException('Owner is already archived');
    }

    const activeAssignments = await this.prisma.ownerUnitAssignment.count({
      where: { ownerId: id, status: OwnerAssignmentStatus.ACTIVE },
    });
    if (activeAssignments > 0) {
      throw new BadRequestException(
        'End all active unit assignments before archiving the owner',
      );
    }

    const owner = await this.prisma.owner.update({
      where: { id },
      data: { isActive: false },
    });

    await this.auditLogs.write({
      module: ApprovalModuleName.OWNERS,
      action: 'OWNER_ARCHIVED',
      recordId: id,
      userId: user.id,
      role: user.role,
      oldData: existing,
      newData: {
        isActive: false,
        reason: reason ?? null,
        performedBy: user.id,
        timestamp: new Date().toISOString(),
      },
      context: auditContext,
    });

    return mapOwnerForRole(owner, user.role);
  }

  async getRemovalPolicy(id: string): Promise<RemovalPolicy> {
    const owner = await this.prisma.owner.findUnique({
      where: { id },
      select: {
        fullName: true,
        _count: {
          select: {
            unitAssignments: true,
            monthlyStatements: true,
            payments: true,
          },
        },
      },
    });
    if (!owner) {
      throw new NotFoundException(`Owner with id "${id}" not found`);
    }

    if (
      owner._count.unitAssignments > 0 ||
      owner._count.monthlyStatements > 0 ||
      owner._count.payments > 0
    ) {
      return {
        action: 'ARCHIVE',
        message: HISTORY_CANNOT_DELETE_MESSAGE,
        confirmLabel: 'Archive owner',
        reasonRequired: true,
      };
    }

    return {
      action: 'PERMANENT_DELETE',
      message: `Permanently delete owner "${owner.fullName}"? This cannot be undone.`,
      confirmLabel: 'Delete owner',
      reasonRequired: false,
    };
  }

  async removePermanent(
    id: string,
    user: AuthUser,
    auditContext?: AuditContext,
  ) {
    this.assertOwnerAccess(user.role);
    if (user.role !== Role.SUPER_ADMIN) {
      throw new ForbiddenException('Only Super Admin can delete owners');
    }

    const policy = await this.getRemovalPolicy(id);
    if (policy.action !== 'PERMANENT_DELETE') {
      throw new BadRequestException(HISTORY_CANNOT_DELETE_MESSAGE);
    }

    const existing = await this.getOrThrow(id);
    await this.prisma.owner.delete({ where: { id } });

    await this.auditLogs.write({
      module: ApprovalModuleName.OWNERS,
      action: 'OWNER_DELETED',
      recordId: id,
      userId: user.id,
      role: user.role,
      oldData: existing,
      newData: { deleted: true },
      context: auditContext,
    });

    return { deleted: true };
  }

  async getOverview(query: QueryOwnerOverviewDto, role: Role) {
    this.assertOwnerAccess(role);

    const now = new Date();
    const month = query.month ?? now.getUTCMonth() + 1;
    const year = query.year ?? now.getUTCFullYear();

    const [activeOwners, activeAssignments, statements] = await Promise.all([
      this.prisma.owner.count({ where: { isActive: true } }),
      this.prisma.ownerUnitAssignment.findMany({
        where: {
          status: OwnerAssignmentStatus.ACTIVE,
          ...(query.propertyId ? { propertyId: query.propertyId } : {}),
          ...(query.unitId ? { unitId: query.unitId } : {}),
          ...(query.ownerId ? { ownerId: query.ownerId } : {}),
          ...(query.accountDirection
            ? { accountDirection: query.accountDirection }
            : {}),
        },
        select: { unitId: true },
      }),
      this.prisma.ownerMonthlyStatement.findMany({
        where: this.buildStatementWhere(query, month, year),
        include: {
          payments: {
            where: { status: 'COMPLETED' },
            select: {
              paymentMethod: true,
              bankName: true,
              paymentDate: true,
              amount: true,
              transactionType: true,
            },
          },
        },
      }),
    ]);

    const ownedUnits = new Set(activeAssignments.map((a) => a.unitId)).size;

    let receivableExpected = new Prisma.Decimal(0);
    let receivablePaid = new Prisma.Decimal(0);
    let receivableRemaining = new Prisma.Decimal(0);
    let payableExpected = new Prisma.Decimal(0);
    let payablePaid = new Prisma.Decimal(0);
    let payableRemaining = new Prisma.Decimal(0);

    for (const s of statements) {
      if (query.paymentMethod || query.bankName) {
        const match = s.payments.some((p) => {
          if (
            query.paymentMethod &&
            p.paymentMethod !== query.paymentMethod
          ) {
            return false;
          }
          if (
            query.bankName &&
            !(p.bankName ?? '')
              .toLowerCase()
              .includes(query.bankName.toLowerCase())
          ) {
            return false;
          }
          return true;
        });
        if (!match && (query.paymentMethod || query.bankName)) {
          // Keep statements with no matching payment out of payment-method filters
          // only when they have payments; unpaid still show for status filters.
          if (s.payments.length > 0) continue;
          if (query.paymentMethod || query.bankName) continue;
        }
      }

      if (s.accountDirection === OwnerAccountDirection.RECEIVABLE_FROM_OWNER) {
        receivableExpected = receivableExpected.plus(s.totalPayableOrReceivable);
        receivablePaid = receivablePaid.plus(s.totalPaid);
        receivableRemaining = receivableRemaining.plus(s.remainingAmount);
      } else {
        payableExpected = payableExpected.plus(s.totalPayableOrReceivable);
        payablePaid = payablePaid.plus(s.totalPaid);
        payableRemaining = payableRemaining.plus(s.remainingAmount);
      }
    }

    const collectionPct =
      receivableExpected.greaterThan(0)
        ? receivablePaid
            .div(receivableExpected)
            .mul(100)
            .toDecimalPlaces(2)
            .toNumber()
        : 0;

    return {
      totalActiveOwners: activeOwners,
      totalOwnedUnits: ownedUnits,
      month,
      year,
      thisMonthExpectedReceivable: serializeMoney(receivableExpected),
      thisMonthReceived: serializeMoney(receivablePaid),
      outstandingReceivable: serializeMoney(receivableRemaining),
      thisMonthPayableToOwners: serializeMoney(payableExpected),
      thisMonthPaidToOwners: serializeMoney(payablePaid),
      outstandingPayable: serializeMoney(payableRemaining),
      collectionPercentage: collectionPct,
    };
  }

  async getApartmentSummary(query: QueryOwnerOverviewDto, role: Role) {
    this.assertOwnerAccess(role);

    const now = new Date();
    const month = query.month ?? now.getUTCMonth() + 1;
    const year = query.year ?? now.getUTCFullYear();

    const assignments = await this.prisma.ownerUnitAssignment.findMany({
      where: {
        status: OwnerAssignmentStatus.ACTIVE,
        ...(query.propertyId ? { propertyId: query.propertyId } : {}),
        ...(query.unitId ? { unitId: query.unitId } : {}),
        ...(query.ownerId ? { ownerId: query.ownerId } : {}),
        ...(query.accountDirection
          ? { accountDirection: query.accountDirection }
          : {}),
      },
      include: {
        owner: { select: { id: true, fullName: true, phone: true } },
        property: { select: { id: true, name: true } },
        unit: {
          select: {
            id: true,
            unitNumber: true,
            floor: true,
            unitType: true,
          },
        },
        monthlyStatements: {
          where: { statementMonth: month, statementYear: year },
        },
      },
      orderBy: [{ propertyId: 'asc' }, { unitId: 'asc' }],
    });

    const byUnit = new Map<
      string,
      {
        propertyId: string;
        propertyName: string;
        unitId: string;
        unitNumber: string;
        floor: number | null;
        unitType: string;
        accountDirections: Set<string>;
        ownerCount: number;
        monthlyExpected: Prisma.Decimal;
        received: Prisma.Decimal;
        remaining: Prisma.Decimal;
        statuses: Set<string>;
        owners: Array<{
          assignmentId: string;
          ownerId: string;
          ownerName: string;
          ownershipPercentage: string;
          fixedMonthlyAmount: string;
          accountDirection: OwnerAccountDirection;
          expectedThisMonth: string;
          paid: string;
          remaining: string;
          dueDate: string | null;
          paymentStatus: string | null;
        }>;
      }
    >();

    for (const a of assignments) {
      if (query.search?.trim()) {
        const term = query.search.trim().toLowerCase();
        const hay = `${a.property.name} ${a.unit.unitNumber} ${a.owner.fullName}`.toLowerCase();
        if (!hay.includes(term)) continue;
      }

      let row = byUnit.get(a.unitId);
      if (!row) {
        row = {
          propertyId: a.propertyId,
          propertyName: a.property.name,
          unitId: a.unitId,
          unitNumber: a.unit.unitNumber,
          floor: a.unit.floor,
          unitType: a.unit.unitType,
          accountDirections: new Set(),
          ownerCount: 0,
          monthlyExpected: new Prisma.Decimal(0),
          received: new Prisma.Decimal(0),
          remaining: new Prisma.Decimal(0),
          statuses: new Set(),
          owners: [],
        };
        byUnit.set(a.unitId, row);
      }

      const statement = a.monthlyStatements[0];
      const expected = statement?.totalPayableOrReceivable ?? a.fixedMonthlyAmount;
      const paid = statement?.totalPaid ?? new Prisma.Decimal(0);
      const remaining = statement?.remainingAmount ?? expected;

      row.ownerCount += 1;
      row.accountDirections.add(a.accountDirection);
      row.monthlyExpected = row.monthlyExpected.plus(expected);
      row.received = row.received.plus(paid);
      row.remaining = row.remaining.plus(remaining);
      if (statement) row.statuses.add(statement.paymentStatus);

      row.owners.push({
        assignmentId: a.id,
        ownerId: a.ownerId,
        ownerName: a.owner.fullName,
        ownershipPercentage: serializeMoney(a.ownershipPercentage),
        fixedMonthlyAmount: serializeMoney(a.fixedMonthlyAmount),
        accountDirection: a.accountDirection,
        expectedThisMonth: serializeMoney(expected),
        paid: serializeMoney(paid),
        remaining: serializeMoney(remaining),
        dueDate: statement?.dueDate.toISOString() ?? null,
        paymentStatus: statement?.paymentStatus ?? null,
      });
    }

    return Array.from(byUnit.values()).map((row) => {
      let paymentStatus = 'UNPAID';
      if (row.remaining.lessThanOrEqualTo(0) && row.monthlyExpected.greaterThan(0)) {
        paymentStatus = 'PAID';
      } else if (row.received.greaterThan(0) && row.remaining.greaterThan(0)) {
        paymentStatus = 'PARTIAL';
      } else if (row.statuses.has(OwnerStatementPaymentStatus.OVERDUE)) {
        paymentStatus = 'OVERDUE';
      } else if (row.statuses.has(OwnerStatementPaymentStatus.OVERPAID)) {
        paymentStatus = 'OVERPAID';
      }

      const directions = Array.from(row.accountDirections);
      return {
        propertyId: row.propertyId,
        propertyName: row.propertyName,
        unitId: row.unitId,
        unitNumber: row.unitNumber,
        floor: row.floor,
        unitType: row.unitType,
        ownerCount: row.ownerCount,
        accountDirection:
          directions.length === 1 ? directions[0] : 'MIXED',
        monthlyExpected: serializeMoney(row.monthlyExpected),
        received: serializeMoney(row.received),
        remaining: serializeMoney(row.remaining),
        paymentStatus,
        paymentStatusTick: paymentStatusTick(paymentStatus),
        owners: row.owners,
        month,
        year,
      };
    });
  }

  private buildStatementWhere(
    query: QueryOwnerOverviewDto,
    month: number,
    year: number,
  ): Prisma.OwnerMonthlyStatementWhereInput {
    const where: Prisma.OwnerMonthlyStatementWhereInput = {
      statementMonth: month,
      statementYear: year,
    };
    if (query.propertyId) where.propertyId = query.propertyId;
    if (query.unitId) where.unitId = query.unitId;
    if (query.ownerId) where.ownerId = query.ownerId;
    if (query.accountDirection) where.accountDirection = query.accountDirection;
    if (query.paymentStatus) where.paymentStatus = query.paymentStatus;

    if (query.search?.trim()) {
      const term = query.search.trim();
      where.OR = [
        { owner: { fullName: { contains: term, mode: 'insensitive' } } },
        { property: { name: { contains: term, mode: 'insensitive' } } },
        { unit: { unitNumber: { contains: term, mode: 'insensitive' } } },
      ];
    }

    if (query.date) {
      const day = new Date(query.date);
      if (!Number.isNaN(day.getTime())) {
        const start = new Date(day);
        start.setUTCHours(0, 0, 0, 0);
        const end = new Date(day);
        end.setUTCHours(23, 59, 59, 999);
        where.dueDate = { gte: start, lte: end };
      }
    } else if (query.startDate || query.endDate) {
      where.dueDate = {};
      if (query.startDate) {
        where.dueDate.gte = new Date(query.startDate);
      }
      if (query.endDate) {
        where.dueDate.lte = new Date(query.endDate);
      }
    }

    return where;
  }

  async getOrThrow(id: string) {
    const owner = await this.prisma.owner.findUnique({ where: { id } });
    if (!owner) {
      throw new NotFoundException(`Owner "${id}" not found`);
    }
    return owner;
  }

  private handlePrismaError(error: unknown): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ConflictException('An owner with this CNIC already exists');
    }
    throw error;
  }
}
