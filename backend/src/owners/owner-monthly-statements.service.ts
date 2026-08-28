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
  PaymentStatus,
  Prisma,
  Role,
} from '../../generated/prisma/client';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import type { AuditContext } from '../common/types/audit-context.type';
import type { AuthUser } from '../common/types/auth-user.type';
import { sumNetReceived } from '../payments/payment-balance';
import { PrismaService } from '../prisma/prisma.service';
import {
  GenerateOwnerStatementsDto,
  QueryOwnerMonthlyStatementsDto,
  UpdateOwnerMonthlyStatementDto,
} from './dto/owner-statement.dto';
import {
  assignmentValidForMonth,
  buildOwnerDueDate,
  calculateOwnerStatementTotals,
  deriveOwnerStatementPaymentStatus,
  resolveEffectiveMonthlyAmount,
  serializeMoney,
} from './owner-finance';
import { mapStatement } from './owners.mapper';
import { OwnersService } from './owners.service';

const statementInclude = {
  owner: { select: { id: true, fullName: true, phone: true } },
  property: { select: { id: true, name: true } },
  unit: { select: { id: true, unitNumber: true, floor: true } },
  payments: {
    where: { status: PaymentStatus.COMPLETED },
    select: {
      paymentMethod: true,
      bankName: true,
      paymentDate: true,
      transactionReference: true,
      status: true,
      transactionType: true,
    },
    orderBy: { paymentDate: 'desc' as const },
  },
} satisfies Prisma.OwnerMonthlyStatementInclude;

@Injectable()
export class OwnerMonthlyStatementsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogs: AuditLogsService,
    private readonly ownersService: OwnersService,
  ) {}

  async generate(dto: GenerateOwnerStatementsDto, user: AuthUser) {
    this.ownersService.assertOwnerAccess(user.role);

    const assignments = await this.prisma.ownerUnitAssignment.findMany({
      where: {
        status: OwnerAssignmentStatus.ACTIVE,
        ...(dto.propertyId ? { propertyId: dto.propertyId } : {}),
        ...(dto.ownerId ? { ownerId: dto.ownerId } : {}),
        ...(dto.unitId ? { unitId: dto.unitId } : {}),
      },
      include: {
        revisions: {
          select: {
            effectiveFrom: true,
            newFixedMonthlyAmount: true,
            previousFixedMonthlyAmount: true,
          },
          orderBy: { effectiveFrom: 'desc' },
        },
      },
    });

    let created = 0;
    let skipped = 0;
    let failed = 0;
    const details: Array<{
      assignmentId: string;
      ownerId: string;
      unitId: string;
      status: 'CREATED' | 'SKIPPED' | 'FAILED';
      message?: string;
      statementId?: string;
    }> = [];

    for (const assignment of assignments) {
      if (
        !assignmentValidForMonth(
          assignment.agreementStart,
          assignment.agreementEnd,
          dto.year,
          dto.month,
        )
      ) {
        skipped += 1;
        details.push({
          assignmentId: assignment.id,
          ownerId: assignment.ownerId,
          unitId: assignment.unitId,
          status: 'SKIPPED',
          message: 'Assignment not valid for this month',
        });
        continue;
      }

      try {
        const existing = await this.prisma.ownerMonthlyStatement.findUnique({
          where: {
            ownerUnitAssignmentId_statementMonth_statementYear: {
              ownerUnitAssignmentId: assignment.id,
              statementMonth: dto.month,
              statementYear: dto.year,
            },
          },
        });
        if (existing) {
          skipped += 1;
          details.push({
            assignmentId: assignment.id,
            ownerId: assignment.ownerId,
            unitId: assignment.unitId,
            status: 'SKIPPED',
            message: 'Statement already exists',
            statementId: existing.id,
          });
          continue;
        }

        const previous = await this.findPreviousRemaining(
          assignment.id,
          dto.month,
          dto.year,
        );

        const dueDate = buildOwnerDueDate(
          dto.year,
          dto.month,
          assignment.dueDay,
        );
        const expectedAmount = resolveEffectiveMonthlyAmount({
          currentFixedMonthlyAmount: assignment.fixedMonthlyAmount,
          agreementStart: assignment.agreementStart,
          revisions: assignment.revisions,
          year: dto.year,
          month: dto.month,
        });
        const totals = calculateOwnerStatementTotals({
          expectedAmount,
          previousBalance: previous,
          adjustmentAmount: 0,
          totalPaid: 0,
        });

        const statement = await this.prisma.ownerMonthlyStatement.create({
          data: {
            ownerUnitAssignmentId: assignment.id,
            ownerId: assignment.ownerId,
            propertyId: assignment.propertyId,
            unitId: assignment.unitId,
            statementMonth: dto.month,
            statementYear: dto.year,
            accountDirection: assignment.accountDirection,
            ...totals,
            dueDate,
            paymentStatus: deriveOwnerStatementPaymentStatus(
              totals.totalPayableOrReceivable,
              totals.totalPaid,
              dueDate,
            ),
            finalized: false,
          },
        });

        created += 1;
        details.push({
          assignmentId: assignment.id,
          ownerId: assignment.ownerId,
          unitId: assignment.unitId,
          status: 'CREATED',
          statementId: statement.id,
        });
      } catch (error) {
        failed += 1;
        details.push({
          assignmentId: assignment.id,
          ownerId: assignment.ownerId,
          unitId: assignment.unitId,
          status: 'FAILED',
          message:
            error instanceof Error ? error.message : 'Failed to create statement',
        });
      }
    }

    await this.auditLogs.write({
      module: ApprovalModuleName.OWNERS,
      action: 'GENERATE_STATEMENTS',
      recordId: null,
      userId: user.id,
      role: user.role,
      newData: { month: dto.month, year: dto.year, created, skipped, failed },
    });

    return { created, skipped, failed, details };
  }

  async findAll(query: QueryOwnerMonthlyStatementsDto, role: Role) {
    this.ownersService.assertOwnerAccess(role);

    const where = this.buildWhere(query);
    const rows = await this.prisma.ownerMonthlyStatement.findMany({
      where,
      include: statementInclude,
      orderBy: [
        { statementYear: 'desc' },
        { statementMonth: 'desc' },
        { propertyId: 'asc' },
        { unitId: 'asc' },
      ],
    });

    let filtered = rows;
    if (query.paymentMethod || query.bankName) {
      filtered = rows.filter((row) =>
        row.payments.some((p) => {
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
        }),
      );
    }

    return filtered.map((row) => mapStatement(row));
  }

  async getTotals(query: QueryOwnerMonthlyStatementsDto, role: Role) {
    this.ownersService.assertOwnerAccess(role);
    const statements = await this.findAll(query, role);

    let totalExpected = new Prisma.Decimal(0);
    let totalPaid = new Prisma.Decimal(0);
    let totalRemaining = new Prisma.Decimal(0);
    let totalReceivable = new Prisma.Decimal(0);
    let totalPayable = new Prisma.Decimal(0);
    let paidCount = 0;
    let partialCount = 0;
    let unpaidCount = 0;
    let overdueCount = 0;

    for (const s of statements) {
      const expected = new Prisma.Decimal(s.totalPayableOrReceivable);
      const paid = new Prisma.Decimal(s.totalPaid);
      const remaining = new Prisma.Decimal(s.remainingAmount);
      totalExpected = totalExpected.plus(expected);
      totalPaid = totalPaid.plus(paid);
      totalRemaining = totalRemaining.plus(remaining);

      if (s.accountDirection === 'RECEIVABLE_FROM_OWNER') {
        totalReceivable = totalReceivable.plus(remaining);
      } else {
        totalPayable = totalPayable.plus(remaining);
      }

      switch (s.paymentStatus) {
        case 'PAID':
        case 'OVERPAID':
          paidCount += 1;
          break;
        case 'PARTIAL':
          partialCount += 1;
          break;
        case 'OVERDUE':
          overdueCount += 1;
          break;
        default:
          unpaidCount += 1;
          break;
      }
    }

    return {
      totalExpected: serializeMoney(totalExpected),
      totalPaid: serializeMoney(totalPaid),
      totalRemaining: serializeMoney(totalRemaining),
      totalReceivable: serializeMoney(totalReceivable),
      totalPayable: serializeMoney(totalPayable),
      paidCount,
      partialCount,
      unpaidCount,
      overdueCount,
      statementCount: statements.length,
    };
  }

  async findOne(id: string, role: Role) {
    this.ownersService.assertOwnerAccess(role);
    const row = await this.getOrThrow(id);
    return mapStatement(row);
  }

  async finalize(id: string, user: AuthUser, auditContext?: AuditContext) {
    this.ownersService.assertOwnerAccess(user.role);
    const existing = await this.getOrThrow(id);
    if (existing.finalized) {
      throw new BadRequestException('Statement is already finalized');
    }

    const updated = await this.prisma.ownerMonthlyStatement.update({
      where: { id },
      data: { finalized: true },
      include: statementInclude,
    });

    await this.auditLogs.write({
      module: ApprovalModuleName.OWNERS,
      action: 'FINALIZE_STATEMENT',
      recordId: id,
      userId: user.id,
      role: user.role,
      oldData: { finalized: false },
      newData: { finalized: true },
      context: auditContext,
    });

    return mapStatement(updated);
  }

  async update(
    id: string,
    dto: UpdateOwnerMonthlyStatementDto,
    user: AuthUser,
    auditContext?: AuditContext,
  ) {
    this.ownersService.assertOwnerAccess(user.role);
    const existing = await this.getOrThrow(id);

    if (existing.finalized && user.role !== Role.SUPER_ADMIN) {
      throw new ForbiddenException(
        'Only Super Admin can edit finalized statements',
      );
    }

    if (
      dto.adjustmentAmount !== undefined &&
      user.role === Role.SUPER_ADMIN &&
      !dto.adjustmentReason?.trim()
    ) {
      throw new BadRequestException(
        'Super Admin adjustment requires a mandatory reason',
      );
    }

    if (dto.adjustmentAmount !== undefined && user.role !== Role.SUPER_ADMIN) {
      throw new ForbiddenException('Only Super Admin can apply adjustments');
    }

    const totals = calculateOwnerStatementTotals({
      expectedAmount:
        dto.expectedAmount !== undefined
          ? dto.expectedAmount
          : existing.expectedAmount,
      previousBalance:
        dto.previousBalance !== undefined
          ? dto.previousBalance
          : existing.previousBalance,
      adjustmentAmount:
        dto.adjustmentAmount !== undefined
          ? dto.adjustmentAmount
          : existing.adjustmentAmount,
      totalPaid: existing.totalPaid,
    });

    const notes =
      dto.adjustmentReason?.trim()
        ? `${dto.notes?.trim() ?? existing.notes ?? ''}${
            dto.notes || existing.notes ? '; ' : ''
          }ADJUSTMENT_REASON:${dto.adjustmentReason.trim()}`.trim()
        : dto.notes?.trim();

    const updated = await this.prisma.ownerMonthlyStatement.update({
      where: { id },
      data: {
        ...totals,
        paymentStatus: deriveOwnerStatementPaymentStatus(
          totals.totalPayableOrReceivable,
          totals.totalPaid,
          existing.dueDate,
        ),
        notes,
      },
      include: statementInclude,
    });

    await this.auditLogs.write({
      module: ApprovalModuleName.OWNERS,
      action: 'UPDATE_STATEMENT',
      recordId: id,
      userId: user.id,
      role: user.role,
      oldData: existing,
      newData: updated,
      context: auditContext,
    });

    return mapStatement(updated);
  }

  /**
   * Recalculate statement totals from completed Payment ledger rows.
   */
  async recalculateFromPayments(
    tx: Prisma.TransactionClient,
    statementId: string,
  ) {
    const statement = await tx.ownerMonthlyStatement.findUniqueOrThrow({
      where: { id: statementId },
    });

    const rows = await tx.payment.findMany({
      where: {
        ownerMonthlyStatementId: statementId,
        paymentForType: 'OWNER',
      },
      select: {
        transactionType: true,
        amount: true,
        status: true,
        notes: true,
      },
    });

    // Same ledger rules as booking/tenancy payments (includes REVERSAL offsets).
    const totalPaid = sumNetReceived(rows);

    const storedTotals = calculateOwnerStatementTotals({
      expectedAmount: statement.expectedAmount,
      previousBalance: statement.previousBalance,
      adjustmentAmount: statement.adjustmentAmount,
      totalPaid,
    });

    return tx.ownerMonthlyStatement.update({
      where: { id: statementId },
      data: {
        totalPaid: storedTotals.totalPaid,
        totalPayableOrReceivable: storedTotals.totalPayableOrReceivable,
        remainingAmount: storedTotals.remainingAmount,
        paymentStatus: deriveOwnerStatementPaymentStatus(
          storedTotals.totalPayableOrReceivable,
          storedTotals.totalPaid,
          statement.dueDate,
        ),
      },
    });
  }

  private async findPreviousRemaining(
    assignmentId: string,
    month: number,
    year: number,
  ) {
    let prevMonth = month - 1;
    let prevYear = year;
    if (prevMonth < 1) {
      prevMonth = 12;
      prevYear -= 1;
    }

    const previous = await this.prisma.ownerMonthlyStatement.findUnique({
      where: {
        ownerUnitAssignmentId_statementMonth_statementYear: {
          ownerUnitAssignmentId: assignmentId,
          statementMonth: prevMonth,
          statementYear: prevYear,
        },
      },
    });

    if (!previous) return new Prisma.Decimal(0);
    return previous.remainingAmount.greaterThan(0)
      ? previous.remainingAmount
      : new Prisma.Decimal(0);
  }

  private buildWhere(
    query: QueryOwnerMonthlyStatementsDto,
  ): Prisma.OwnerMonthlyStatementWhereInput {
    const where: Prisma.OwnerMonthlyStatementWhereInput = {};
    if (query.month) where.statementMonth = query.month;
    if (query.year) where.statementYear = query.year;
    if (query.propertyId) where.propertyId = query.propertyId;
    if (query.unitId) where.unitId = query.unitId;
    if (query.ownerId) where.ownerId = query.ownerId;
    if (query.ownerUnitAssignmentId) {
      where.ownerUnitAssignmentId = query.ownerUnitAssignmentId;
    }
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
      if (query.startDate) where.dueDate.gte = new Date(query.startDate);
      if (query.endDate) where.dueDate.lte = new Date(query.endDate);
    }

    return where;
  }

  async getOrThrow(id: string) {
    const row = await this.prisma.ownerMonthlyStatement.findUnique({
      where: { id },
      include: statementInclude,
    });
    if (!row) {
      throw new NotFoundException(`Owner monthly statement "${id}" not found`);
    }
    return row;
  }

  assertDuplicateSafe() {
    // helper for tests / callers
    throw new ConflictException('Duplicate monthly statement');
  }
}
