import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ApprovalModuleName,
  PaymentForType,
  PaymentMethod,
  PaymentStatus,
  PaymentTransactionType,
  Prisma,
  Role,
} from '../../generated/prisma/client';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import type { AuditContext } from '../common/types/audit-context.type';
import type { AuthUser } from '../common/types/auth-user.type';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import {
  AdjustOwnerPaymentDto,
  CreateOwnerPaymentDto,
  MarkOwnerPaidDto,
  QueryOwnerPaymentsDto,
  ReverseOwnerPaymentDto,
} from './dto/owner-payment.dto';
import { OwnerMonthlyStatementsService } from './owner-monthly-statements.service';
import { mapOwnerPayment } from './owners.mapper';
import { OwnersService } from './owners.service';

const MARK_PAID_NOTE = 'Marked paid by Super Admin';

const paymentInclude = {
  owner: { select: { id: true, fullName: true } },
  ownerMonthlyStatement: {
    include: {
      property: { select: { id: true, name: true } },
      unit: { select: { id: true, unitNumber: true } },
    },
  },
  createdBy: { select: { id: true, fullName: true } },
  approvedBy: { select: { id: true, fullName: true } },
} satisfies Prisma.PaymentInclude;

@Injectable()
export class OwnerPaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settingsService: SettingsService,
    private readonly auditLogs: AuditLogsService,
    private readonly ownersService: OwnersService,
    private readonly statementsService: OwnerMonthlyStatementsService,
  ) {}

  async create(
    dto: CreateOwnerPaymentDto,
    user: AuthUser,
    auditContext?: AuditContext,
  ) {
    this.ownersService.assertOwnerAccess(user.role);

    const amount = new Prisma.Decimal(dto.amount);
    if (amount.lessThanOrEqualTo(0)) {
      throw new BadRequestException('Payment amount must be greater than zero');
    }

    const paymentDate = this.parseDate(dto.paymentDate);

    const result = await this.prisma.$transaction(async (tx) => {
      const statement = await tx.ownerMonthlyStatement.findUnique({
        where: { id: dto.ownerMonthlyStatementId },
      });
      if (!statement) {
        throw new NotFoundException('Owner monthly statement not found');
      }

      if (amount.greaterThan(statement.remainingAmount)) {
        if (user.role !== Role.SUPER_ADMIN || !dto.overpayReason?.trim()) {
          throw new BadRequestException(
            'Ordinary payment cannot exceed remaining balance. Super Admin overpayment requires overpayReason.',
          );
        }
      }

      const paymentNumber = await this.nextPaymentNumber(tx);
      const notes =
        amount.greaterThan(statement.remainingAmount) && dto.overpayReason
          ? `${dto.notes?.trim() ? `${dto.notes.trim()}; ` : ''}OVERPAY_REASON:${dto.overpayReason.trim()}`
          : dto.notes?.trim();

      const created = await tx.payment.create({
        data: {
          paymentNumber,
          paymentForType: PaymentForType.OWNER,
          ownerMonthlyStatementId: statement.id,
          ownerId: statement.ownerId,
          transactionType: PaymentTransactionType.PAYMENT,
          amount,
          paymentMethod: dto.paymentMethod,
          bankName: dto.bankName?.trim(),
          accountTitle: dto.accountTitle?.trim(),
          transactionReference: dto.transactionReference?.trim(),
          paymentDate,
          notes,
          status: PaymentStatus.COMPLETED,
          createdByUserId: user.id,
          approvedByUserId: user.role === Role.SUPER_ADMIN ? user.id : null,
          approvedAt: user.role === Role.SUPER_ADMIN ? new Date() : null,
        },
        include: paymentInclude,
      });

      await this.statementsService.recalculateFromPayments(tx, statement.id);
      return created;
    });

    await this.auditLogs.write({
      module: ApprovalModuleName.OWNERS,
      action: 'OWNER_PAYMENT',
      recordId: result.id,
      userId: user.id,
      role: user.role,
      newData: result,
      context: auditContext,
    });

    const fresh = await this.prisma.payment.findUniqueOrThrow({
      where: { id: result.id },
      include: paymentInclude,
    });
    return mapOwnerPayment(fresh);
  }

  /**
   * Posts a completed payment for the full remaining balance so status becomes PAID.
   * Does not overwrite the statement — uses the payment ledger like Record Payment.
   */
  async markPaid(
    dto: MarkOwnerPaidDto,
    user: AuthUser,
    auditContext?: AuditContext,
  ) {
    this.ownersService.assertOwnerAccess(user.role);

    const statement = await this.prisma.ownerMonthlyStatement.findUnique({
      where: { id: dto.ownerMonthlyStatementId },
    });
    if (!statement) {
      throw new NotFoundException('Owner monthly statement not found');
    }

    if (statement.remainingAmount.lessThanOrEqualTo(0)) {
      throw new BadRequestException(
        'Statement has no remaining balance to mark paid',
      );
    }

    const paymentDate =
      dto.paymentDate ?? new Date().toISOString().slice(0, 10);

    return this.create(
      {
        ownerMonthlyStatementId: statement.id,
        amount: Number(statement.remainingAmount.toString()),
        paymentMethod: dto.paymentMethod ?? PaymentMethod.CASH,
        paymentDate,
        notes: MARK_PAID_NOTE,
      },
      user,
      auditContext,
    );
  }

  async findAll(query: QueryOwnerPaymentsDto, role: Role) {
    this.ownersService.assertOwnerAccess(role);

    const where: Prisma.PaymentWhereInput = {
      paymentForType: PaymentForType.OWNER,
    };
    if (query.ownerId) where.ownerId = query.ownerId;
    if (query.ownerMonthlyStatementId) {
      where.ownerMonthlyStatementId = query.ownerMonthlyStatementId;
    }
    if (query.paymentMethod) where.paymentMethod = query.paymentMethod;
    if (query.bankName) {
      where.bankName = { contains: query.bankName, mode: 'insensitive' };
    }
    if (query.propertyId || query.unitId) {
      where.ownerMonthlyStatement = {
        ...(query.propertyId ? { propertyId: query.propertyId } : {}),
        ...(query.unitId ? { unitId: query.unitId } : {}),
      };
    }
    if (query.startDate || query.endDate) {
      where.paymentDate = {};
      if (query.startDate) where.paymentDate.gte = new Date(query.startDate);
      if (query.endDate) where.paymentDate.lte = new Date(query.endDate);
    }
    if (query.search?.trim()) {
      const term = query.search.trim();
      where.OR = [
        { paymentNumber: { contains: term, mode: 'insensitive' } },
        { transactionReference: { contains: term, mode: 'insensitive' } },
        { owner: { fullName: { contains: term, mode: 'insensitive' } } },
      ];
    }

    const rows = await this.prisma.payment.findMany({
      where,
      include: paymentInclude,
      orderBy: { paymentDate: 'desc' },
    });

    return rows.map((row) => mapOwnerPayment(row));
  }

  async findOne(id: string, role: Role) {
    this.ownersService.assertOwnerAccess(role);
    const payment = await this.prisma.payment.findFirst({
      where: { id, paymentForType: PaymentForType.OWNER },
      include: paymentInclude,
    });
    if (!payment) {
      throw new NotFoundException(`Owner payment "${id}" not found`);
    }
    return mapOwnerPayment(payment);
  }

  async reverse(
    id: string,
    dto: ReverseOwnerPaymentDto,
    user: AuthUser,
    auditContext?: AuditContext,
  ) {
    this.ownersService.assertOwnerAccess(user.role);
    if (user.role !== Role.SUPER_ADMIN) {
      throw new ForbiddenException(
        'Only Super Admin can reverse owner payments',
      );
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const original = await tx.payment.findFirst({
        where: { id, paymentForType: PaymentForType.OWNER },
      });
      if (!original) {
        throw new NotFoundException('Owner payment not found');
      }
      if (original.status !== PaymentStatus.COMPLETED) {
        throw new BadRequestException('Only completed payments can be reversed');
      }
      if (original.transactionType !== PaymentTransactionType.PAYMENT) {
        throw new BadRequestException('Only PAYMENT rows can be reversed');
      }
      if (!original.ownerMonthlyStatementId) {
        throw new BadRequestException('Payment is not linked to a statement');
      }

      const paymentNumber = await this.nextPaymentNumber(tx);
      const reversal = await tx.payment.create({
        data: {
          paymentNumber,
          paymentForType: PaymentForType.OWNER,
          ownerMonthlyStatementId: original.ownerMonthlyStatementId,
          ownerId: original.ownerId,
          transactionType: PaymentTransactionType.REVERSAL,
          amount: original.amount,
          paymentMethod: original.paymentMethod,
          bankName: original.bankName,
          accountTitle: original.accountTitle,
          transactionReference: original.transactionReference,
          paymentDate: new Date(),
          notes: `REVERSAL_REASON:${dto.reason.trim()}`,
          status: PaymentStatus.COMPLETED,
          originalPaymentId: original.id,
          createdByUserId: user.id,
          approvedByUserId: user.id,
          approvedAt: new Date(),
        },
        include: paymentInclude,
      });

      await tx.payment.update({
        where: { id: original.id },
        data: { status: PaymentStatus.REVERSED },
      });

      await this.statementsService.recalculateFromPayments(
        tx,
        original.ownerMonthlyStatementId,
      );

      return reversal;
    });

    await this.auditLogs.write({
      module: ApprovalModuleName.OWNERS,
      action: 'OWNER_PAYMENT_REVERSAL',
      recordId: result.id,
      userId: user.id,
      role: user.role,
      newData: result,
      context: auditContext,
    });

    return mapOwnerPayment(result);
  }

  async adjust(
    dto: AdjustOwnerPaymentDto,
    user: AuthUser,
    auditContext?: AuditContext,
  ) {
    this.ownersService.assertOwnerAccess(user.role);
    if (user.role !== Role.SUPER_ADMIN) {
      throw new ForbiddenException(
        'Only Super Admin can create owner payment adjustments',
      );
    }
    if (!dto.reason.trim()) {
      throw new BadRequestException('Adjustment reason is required');
    }

    const amount = new Prisma.Decimal(dto.amount);
    if (amount.equals(0)) {
      throw new BadRequestException('Adjustment amount cannot be zero');
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const statement = await tx.ownerMonthlyStatement.findUnique({
        where: { id: dto.ownerMonthlyStatementId },
      });
      if (!statement) {
        throw new NotFoundException('Owner monthly statement not found');
      }

      // Apply adjustment to statement.adjustmentAmount and create ledger row
      await tx.ownerMonthlyStatement.update({
        where: { id: statement.id },
        data: {
          adjustmentAmount: statement.adjustmentAmount.plus(amount),
          notes: `${statement.notes ? `${statement.notes}; ` : ''}ADJUSTMENT_REASON:${dto.reason.trim()}`,
        },
      });

      const paymentNumber = await this.nextPaymentNumber(tx);
      const created = await tx.payment.create({
        data: {
          paymentNumber,
          paymentForType: PaymentForType.OWNER,
          ownerMonthlyStatementId: statement.id,
          ownerId: statement.ownerId,
          transactionType: PaymentTransactionType.ADJUSTMENT,
          amount: amount.abs(),
          paymentMethod: dto.paymentMethod ?? PaymentMethod.OTHER,
          paymentDate: dto.paymentDate
            ? this.parseDate(dto.paymentDate)
            : new Date(),
          notes: `ADJUSTMENT_REASON:${dto.reason.trim()}${
            dto.notes?.trim() ? `; ${dto.notes.trim()}` : ''
          }; DIRECTION:${amount.isNegative() ? 'DECREASE' : 'INCREASE'}`,
          status: PaymentStatus.COMPLETED,
          createdByUserId: user.id,
          approvedByUserId: user.id,
          approvedAt: new Date(),
        },
        include: paymentInclude,
      });

      // Recalc remaining from payments; adjustmentAmount already updated above
      // but recalculateFromPayments uses statement.adjustmentAmount (updated)
      // and payment PAYMENT/REFUND/REVERSAL only for totalPaid.
      await this.statementsService.recalculateFromPayments(tx, statement.id);

      // Re-read after recalc and fix totals with new adjustmentAmount
      const refreshed = await tx.ownerMonthlyStatement.findUniqueOrThrow({
        where: { id: statement.id },
      });
      const totalPayableOrReceivable = refreshed.expectedAmount
        .plus(refreshed.previousBalance)
        .plus(refreshed.adjustmentAmount);
      const remainingAmount = totalPayableOrReceivable.minus(refreshed.totalPaid);
      await tx.ownerMonthlyStatement.update({
        where: { id: statement.id },
        data: {
          totalPayableOrReceivable,
          remainingAmount,
        },
      });

      return created;
    });

    await this.auditLogs.write({
      module: ApprovalModuleName.OWNERS,
      action: 'OWNER_PAYMENT_ADJUSTMENT',
      recordId: result.id,
      userId: user.id,
      role: user.role,
      newData: result,
      context: auditContext,
    });

    return mapOwnerPayment(result);
  }

  private async nextPaymentNumber(tx: Prisma.TransactionClient) {
    const now = new Date();
    const yyyy = now.getUTCFullYear();
    const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(now.getUTCDate()).padStart(2, '0');
    const dateKey = `${yyyy}${mm}${dd}`;
    const settingKey = `payment_seq_${dateKey}`;

    const numbering = await this.settingsService.getValue<{
      prefix?: string;
      separator?: string;
      sequenceLength?: number;
    }>('numbering.payment');
    const prefix = numbering?.prefix || 'PAY';
    const separator = numbering?.separator ?? '-';
    const seqLen = Number(numbering?.sequenceLength) || 4;

    const rows = await tx.$queryRaw<Array<{ value: string }>>`
      INSERT INTO "SystemSetting" (key, value, "createdAt", "updatedAt")
      VALUES (${settingKey}, '1', NOW(), NOW())
      ON CONFLICT (key)
      DO UPDATE SET
        value = (CAST("SystemSetting".value AS INTEGER) + 1)::text,
        "updatedAt" = NOW()
      RETURNING value
    `;

    const seq = String(rows[0]?.value ?? '1').padStart(seqLen, '0');
    return `${prefix}${separator}${dateKey}${separator}${seq}`;
  }

  private parseDate(value: string) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException('Invalid paymentDate');
    }
    return date;
  }
}
