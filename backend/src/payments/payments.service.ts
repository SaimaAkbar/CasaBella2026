import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  PaymentForType,
  PaymentMethod,
  PaymentStatus,
  PaymentTransactionType,
  Prisma,
  Role,
} from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AdjustmentPaymentDto } from './dto/adjustment-payment.dto';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { QueryPaymentsDto } from './dto/query-payments.dto';
import { RefundPaymentDto } from './dto/refund-payment.dto';
import { ReversePaymentDto } from './dto/reverse-payment.dto';
import {
  buildAdjustmentNotes,
  deriveSourcePaymentState,
  serializeMoney,
  sumNetReceived,
} from './payment-balance';
import { buildReceipt, mapPaymentForRole } from './payments.mapper';

const paymentInclude = {
  booking: {
    include: {
      guest: { select: { id: true, fullName: true, phone: true } },
      unit: {
        select: {
          id: true,
          unitNumber: true,
          property: { select: { id: true, name: true } },
        },
      },
    },
  },
  monthlyTenancy: {
    include: {
      tenant: { select: { id: true, fullName: true, phone: true } },
      unit: {
        select: {
          id: true,
          unitNumber: true,
          property: { select: { id: true, name: true } },
        },
      },
    },
  },
  createdBy: { select: { id: true, fullName: true } },
  approvedBy: { select: { id: true, fullName: true } },
  originalPayment: {
    select: { id: true, paymentNumber: true, amount: true },
  },
} satisfies Prisma.PaymentInclude;

@Injectable()
export class PaymentsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreatePaymentDto, role: Role, userId: string) {
    this.assertCanRecord(role);
    this.assertSupportedType(dto.paymentForType);
    this.assertExclusiveSource(dto);

    const amount = new Prisma.Decimal(dto.amount);
    if (amount.lessThanOrEqualTo(0)) {
      throw new BadRequestException('Payment amount must be greater than zero');
    }

    const paymentDate = this.parseDate(dto.paymentDate);

    const result = await this.prisma.$transaction(async (tx) => {
      const source = await this.loadSourceForUpdate(tx, dto);
      const remaining = source.remaining;

      if (amount.greaterThan(remaining)) {
        if (role !== Role.SUPER_ADMIN || !dto.overpayReason?.trim()) {
          throw new BadRequestException(
            'Ordinary payment cannot exceed remaining balance. Super Admin overpayment requires overpayReason.',
          );
        }
      }

      const paymentNumber = await this.nextPaymentNumber(tx);
      const notes =
        amount.greaterThan(remaining) && dto.overpayReason
          ? `${dto.notes?.trim() ? `${dto.notes.trim()}; ` : ''}OVERPAY_REASON:${dto.overpayReason.trim()}`
          : dto.notes;

      const created = await tx.payment.create({
        data: {
          paymentNumber,
          paymentForType: dto.paymentForType,
          bookingId: dto.bookingId,
          monthlyTenancyId: dto.monthlyTenancyId,
          transactionType: PaymentTransactionType.PAYMENT,
          amount,
          paymentMethod: dto.paymentMethod,
          transactionReference: dto.transactionReference,
          paymentDate,
          notes,
          proofAttachmentUrl: dto.proofAttachmentUrl,
          status: PaymentStatus.COMPLETED,
          createdByUserId: userId,
          approvedByUserId: role === Role.SUPER_ADMIN ? userId : null,
          approvedAt: role === Role.SUPER_ADMIN ? new Date() : null,
        },
        include: paymentInclude,
      });

      await this.recalculateSource(tx, dto.paymentForType, {
        bookingId: dto.bookingId,
        monthlyTenancyId: dto.monthlyTenancyId,
      });

      return tx.payment.findUniqueOrThrow({
        where: { id: created.id },
        include: paymentInclude,
      });
    });

    return {
      ...mapPaymentForRole(result, role),
      receipt: buildReceipt(result),
    };
  }

  async findAll(query: QueryPaymentsDto, role: Role) {
    const where = this.buildWhere(query, role);
    const payments = await this.prisma.payment.findMany({
      where,
      include: paymentInclude,
      orderBy: { paymentDate: 'desc' },
    });
    return payments.map((payment) => mapPaymentForRole(payment, role));
  }

  async getSummary(query: QueryPaymentsDto, role: Role) {
    const where = this.buildWhere(query, role);
    const now = new Date();
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(now);
    endOfDay.setHours(23, 59, 59, 999);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(
      now.getFullYear(),
      now.getMonth() + 1,
      0,
      23,
      59,
      59,
      999,
    );

    const completedPayment = {
      status: PaymentStatus.COMPLETED,
      transactionType: PaymentTransactionType.PAYMENT,
    };

    const [
      todayAgg,
      monthAgg,
      bookingAgg,
      tenancyAgg,
      refundAgg,
      bookingOutstanding,
      tenancyOutstanding,
    ] = await Promise.all([
      this.prisma.payment.aggregate({
        where: {
          ...completedPayment,
          paymentDate: { gte: startOfDay, lte: endOfDay },
        },
        _sum: { amount: true },
      }),
      this.prisma.payment.aggregate({
        where: {
          ...completedPayment,
          paymentDate: { gte: startOfMonth, lte: endOfMonth },
        },
        _sum: { amount: true },
      }),
      this.prisma.payment.aggregate({
        where: {
          ...where,
          ...completedPayment,
          paymentForType: PaymentForType.BOOKING,
        },
        _sum: { amount: true },
      }),
      this.prisma.payment.aggregate({
        where: {
          ...where,
          ...completedPayment,
          paymentForType: PaymentForType.MONTHLY_TENANCY,
        },
        _sum: { amount: true },
      }),
      this.prisma.payment.aggregate({
        where: {
          ...where,
          status: PaymentStatus.COMPLETED,
          transactionType: PaymentTransactionType.REFUND,
        },
        _sum: { amount: true },
      }),
      this.prisma.booking.aggregate({
        where: { remainingAmount: { gt: 0 } },
        _sum: { remainingAmount: true },
      }),
      this.prisma.monthlyTenancy.aggregate({
        where: { remainingBalance: { gt: 0 } },
        _sum: { remainingBalance: true },
      }),
    ]);

    const outstanding = new Prisma.Decimal(
      bookingOutstanding._sum.remainingAmount?.toString() ?? '0',
    ).plus(tenancyOutstanding._sum.remainingBalance?.toString() ?? '0');

    const summary = {
      totalReceivedToday: serializeMoney(todayAgg._sum.amount),
      totalReceivedThisMonth: serializeMoney(monthAgg._sum.amount),
      bookingPayments: serializeMoney(bookingAgg._sum.amount),
      monthlyTenantPayments: serializeMoney(tenancyAgg._sum.amount),
      refunds: serializeMoney(refundAgg._sum.amount),
      outstandingBalance: serializeMoney(outstanding),
    };

    if (role === Role.RECEPTIONIST) {
      return {
        totalReceivedToday: summary.totalReceivedToday,
        outstandingBalance: summary.outstandingBalance,
        bookingPayments: summary.bookingPayments,
        monthlyTenantPayments: summary.monthlyTenantPayments,
      };
    }

    return summary;
  }

  async findOne(id: string, role: Role) {
    const payment = await this.getPaymentOrThrow(id);
    return {
      ...mapPaymentForRole(payment, role),
      receipt: buildReceipt(payment),
    };
  }

  async listForBooking(bookingId: string, role: Role) {
    const payments = await this.prisma.payment.findMany({
      where: { bookingId },
      include: paymentInclude,
      orderBy: { paymentDate: 'asc' },
    });
    return payments.map((payment) => mapPaymentForRole(payment, role));
  }

  async listForTenancy(monthlyTenancyId: string, role: Role) {
    const payments = await this.prisma.payment.findMany({
      where: { monthlyTenancyId },
      include: paymentInclude,
      orderBy: { paymentDate: 'asc' },
    });
    return payments.map((payment) => mapPaymentForRole(payment, role));
  }

  async listOutstandingSources(
    paymentForType: PaymentForType,
    role: Role,
    includeSettled = false,
  ) {
    if (
      paymentForType !== PaymentForType.BOOKING &&
      paymentForType !== PaymentForType.MONTHLY_TENANCY
    ) {
      throw new BadRequestException('Unsupported payment source type');
    }

    if (paymentForType === PaymentForType.BOOKING) {
      return this.prisma.booking.findMany({
        where: {
          bookingStatus: {
            notIn: ['CANCELLED', 'NO_SHOW'],
          },
          ...(includeSettled && role === Role.SUPER_ADMIN
            ? {}
            : { remainingAmount: { gt: 0 } }),
        },
        orderBy: { checkInDateTime: 'desc' },
        take: 200,
        select: {
          id: true,
          bookingNumber: true,
          totalAmount: true,
          receivedAmount: true,
          remainingAmount: true,
          paymentState: true,
          checkInDateTime: true,
          guest: { select: { id: true, fullName: true, phone: true } },
          unit: {
            select: {
              id: true,
              unitNumber: true,
              property: { select: { id: true, name: true } },
            },
          },
        },
      });
    }

    return this.prisma.monthlyTenancy.findMany({
      where: {
        tenancyStatus: { not: 'CANCELLED' },
        ...(includeSettled && role === Role.SUPER_ADMIN
          ? {}
          : { remainingBalance: { gt: 0 } }),
      },
      orderBy: { agreementStart: 'desc' },
      take: 200,
      select: {
        id: true,
        totalPayable: true,
        totalReceived: true,
        remainingBalance: true,
        agreementStart: true,
        tenant: { select: { id: true, fullName: true, phone: true } },
        unit: {
          select: {
            id: true,
            unitNumber: true,
            property: { select: { id: true, name: true } },
          },
        },
      },
    });
  }

  async refund(
    id: string,
    dto: RefundPaymentDto,
    role: Role,
    userId: string,
  ) {
    if (role !== Role.SUPER_ADMIN) {
      throw new ForbiddenException(
        role === Role.ADMIN
          ? 'Refund requires Super Admin or a future approval workflow'
          : 'Receptionist cannot refund payments',
      );
    }

    const amount = new Prisma.Decimal(dto.amount);
    if (amount.lessThanOrEqualTo(0)) {
      throw new BadRequestException('Refund amount must be greater than zero');
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const original = await tx.payment.findUnique({
        where: { id },
        include: paymentInclude,
      });

      if (!original) {
        throw new NotFoundException(`Payment with id "${id}" not found`);
      }

      if (original.status !== PaymentStatus.COMPLETED) {
        throw new ConflictException('Only COMPLETED payments can be refunded');
      }

      if (original.transactionType !== PaymentTransactionType.PAYMENT) {
        throw new BadRequestException('Only PAYMENT transactions can be refunded');
      }

      const priorRefunds = await tx.payment.aggregate({
        where: {
          originalPaymentId: id,
          transactionType: PaymentTransactionType.REFUND,
          status: PaymentStatus.COMPLETED,
        },
        _sum: { amount: true },
      });

      const alreadyRefunded = new Prisma.Decimal(
        priorRefunds._sum.amount?.toString() ?? '0',
      );
      const refundable = original.amount.minus(alreadyRefunded);

      if (amount.greaterThan(refundable)) {
        throw new BadRequestException(
          `Refund cannot exceed refundable amount (${refundable.toString()})`,
        );
      }

      const paymentNumber = await this.nextPaymentNumber(tx);
      const created = await tx.payment.create({
        data: {
          paymentNumber,
          paymentForType: original.paymentForType,
          bookingId: original.bookingId,
          monthlyTenancyId: original.monthlyTenancyId,
          transactionType: PaymentTransactionType.REFUND,
          amount,
          paymentMethod: original.paymentMethod,
          paymentDate: new Date(),
          notes: `REFUND_REASON:${dto.reason.trim()}`,
          status: PaymentStatus.COMPLETED,
          originalPaymentId: original.id,
          createdByUserId: userId,
          approvedByUserId: userId,
          approvedAt: new Date(),
        },
        include: paymentInclude,
      });

      const refundedFully = alreadyRefunded.plus(amount).greaterThanOrEqualTo(
        original.amount,
      );
      if (refundedFully) {
        await tx.payment.update({
          where: { id: original.id },
          data: { status: PaymentStatus.REFUNDED },
        });
      }

      await this.recalculateSource(tx, original.paymentForType, {
        bookingId: original.bookingId ?? undefined,
        monthlyTenancyId: original.monthlyTenancyId ?? undefined,
      });

      return tx.payment.findUniqueOrThrow({
        where: { id: created.id },
        include: paymentInclude,
      });
    });

    return {
      ...mapPaymentForRole(result, role),
      receipt: buildReceipt(result),
    };
  }

  async reverse(
    id: string,
    dto: ReversePaymentDto,
    role: Role,
    userId: string,
  ) {
    if (role !== Role.SUPER_ADMIN) {
      throw new ForbiddenException('Only Super Admin may reverse payments');
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const original = await tx.payment.findUnique({
        where: { id },
        include: paymentInclude,
      });

      if (!original) {
        throw new NotFoundException(`Payment with id "${id}" not found`);
      }

      if (original.status !== PaymentStatus.COMPLETED) {
        throw new ConflictException('Only COMPLETED payments can be reversed');
      }

      if (original.transactionType !== PaymentTransactionType.PAYMENT) {
        throw new BadRequestException(
          'Only PAYMENT transactions can be reversed',
        );
      }

      const existingReversal = await tx.payment.findFirst({
        where: {
          originalPaymentId: id,
          transactionType: PaymentTransactionType.REVERSAL,
          status: PaymentStatus.COMPLETED,
        },
      });

      if (existingReversal) {
        throw new ConflictException('This payment has already been reversed');
      }

      const paymentNumber = await this.nextPaymentNumber(tx);
      const created = await tx.payment.create({
        data: {
          paymentNumber,
          paymentForType: original.paymentForType,
          bookingId: original.bookingId,
          monthlyTenancyId: original.monthlyTenancyId,
          transactionType: PaymentTransactionType.REVERSAL,
          amount: original.amount,
          paymentMethod: original.paymentMethod,
          paymentDate: new Date(),
          notes: `REVERSAL_REASON:${dto.reason.trim()}`,
          status: PaymentStatus.COMPLETED,
          originalPaymentId: original.id,
          createdByUserId: userId,
          approvedByUserId: userId,
          approvedAt: new Date(),
        },
        include: paymentInclude,
      });

      await tx.payment.update({
        where: { id: original.id },
        data: { status: PaymentStatus.REVERSED },
      });

      await this.recalculateSource(tx, original.paymentForType, {
        bookingId: original.bookingId ?? undefined,
        monthlyTenancyId: original.monthlyTenancyId ?? undefined,
      });

      return tx.payment.findUniqueOrThrow({
        where: { id: created.id },
        include: paymentInclude,
      });
    });

    return {
      ...mapPaymentForRole(result, role),
      receipt: buildReceipt(result),
    };
  }

  async adjust(dto: AdjustmentPaymentDto, role: Role, userId: string) {
    if (role !== Role.SUPER_ADMIN) {
      throw new ForbiddenException('Only Super Admin may create adjustments');
    }

    this.assertSupportedType(dto.paymentForType);
    this.assertExclusiveSource(dto);

    const amount = new Prisma.Decimal(dto.amount);
    if (amount.lessThanOrEqualTo(0)) {
      throw new BadRequestException('Adjustment amount must be greater than zero');
    }

    const paymentDate = this.parseDate(dto.paymentDate);

    const result = await this.prisma.$transaction(async (tx) => {
      await this.loadSourceForUpdate(tx, dto);

      const paymentNumber = await this.nextPaymentNumber(tx);
      const created = await tx.payment.create({
        data: {
          paymentNumber,
          paymentForType: dto.paymentForType,
          bookingId: dto.bookingId,
          monthlyTenancyId: dto.monthlyTenancyId,
          transactionType: PaymentTransactionType.ADJUSTMENT,
          amount,
          paymentMethod: dto.paymentMethod ?? PaymentMethod.OTHER,
          paymentDate,
          notes: buildAdjustmentNotes(
            dto.adjustmentDirection,
            dto.reason,
            dto.notes,
          ),
          status: PaymentStatus.COMPLETED,
          createdByUserId: userId,
          approvedByUserId: userId,
          approvedAt: new Date(),
        },
        include: paymentInclude,
      });

      await this.recalculateSource(tx, dto.paymentForType, {
        bookingId: dto.bookingId,
        monthlyTenancyId: dto.monthlyTenancyId,
      });

      return tx.payment.findUniqueOrThrow({
        where: { id: created.id },
        include: paymentInclude,
      });
    });

    return {
      ...mapPaymentForRole(result, role),
      receipt: buildReceipt(result),
    };
  }

  /**
   * Creates an initial installment when booking/tenancy is created with received > 0.
   * Called from booking/tenancy services inside their own transaction when possible.
   */
  async createInitialInstallment(
    tx: Prisma.TransactionClient,
    input: {
      paymentForType: PaymentForType;
      bookingId?: string;
      monthlyTenancyId?: string;
      amount: Prisma.Decimal;
      userId: string;
      paymentMethod?: PaymentMethod;
      paymentDate?: Date;
      notes?: string;
    },
  ) {
    if (input.amount.lessThanOrEqualTo(0)) {
      return null;
    }

    const paymentNumber = await this.nextPaymentNumber(tx);
    return tx.payment.create({
      data: {
        paymentNumber,
        paymentForType: input.paymentForType,
        bookingId: input.bookingId,
        monthlyTenancyId: input.monthlyTenancyId,
        transactionType: PaymentTransactionType.PAYMENT,
        amount: input.amount,
        paymentMethod: input.paymentMethod ?? PaymentMethod.CASH,
        paymentDate: input.paymentDate ?? new Date(),
        notes: input.notes ?? 'Initial installment recorded with source creation',
        status: PaymentStatus.COMPLETED,
        createdByUserId: input.userId,
      },
    });
  }

  async recalculateSource(
    tx: Prisma.TransactionClient,
    paymentForType: PaymentForType,
    ids: { bookingId?: string; monthlyTenancyId?: string },
  ) {
    if (paymentForType === PaymentForType.BOOKING && ids.bookingId) {
      const booking = await tx.booking.findUniqueOrThrow({
        where: { id: ids.bookingId },
      });
      const rows = await tx.payment.findMany({
        where: { bookingId: ids.bookingId },
        select: {
          transactionType: true,
          amount: true,
          status: true,
          notes: true,
        },
      });

      const totalReceived = sumNetReceived(rows);
      const remainingAmount = booking.totalAmount.minus(totalReceived);
      const hasCompletedRefunds = rows.some(
        (row) =>
          row.status === PaymentStatus.COMPLETED &&
          row.transactionType === PaymentTransactionType.REFUND,
      );
      const hasCompletedReversals = rows.some(
        (row) =>
          row.status === PaymentStatus.COMPLETED &&
          row.transactionType === PaymentTransactionType.REVERSAL,
      );

      await tx.booking.update({
        where: { id: ids.bookingId },
        data: {
          receivedAmount: totalReceived,
          remainingAmount,
          paymentState: deriveSourcePaymentState({
            totalPayable: booking.totalAmount,
            totalReceived,
            startDate: booking.checkInDateTime,
            hasCompletedRefunds,
            hasCompletedReversals,
          }),
        },
      });
      return;
    }

    if (
      paymentForType === PaymentForType.MONTHLY_TENANCY &&
      ids.monthlyTenancyId
    ) {
      const tenancy = await tx.monthlyTenancy.findUniqueOrThrow({
        where: { id: ids.monthlyTenancyId },
      });
      const rows = await tx.payment.findMany({
        where: { monthlyTenancyId: ids.monthlyTenancyId },
        select: {
          transactionType: true,
          amount: true,
          status: true,
          notes: true,
        },
      });

      const totalReceived = sumNetReceived(rows);
      const remainingBalance = tenancy.totalPayable.minus(totalReceived);
      const hasCompletedRefunds = rows.some(
        (row) =>
          row.status === PaymentStatus.COMPLETED &&
          row.transactionType === PaymentTransactionType.REFUND,
      );
      const hasCompletedReversals = rows.some(
        (row) =>
          row.status === PaymentStatus.COMPLETED &&
          row.transactionType === PaymentTransactionType.REVERSAL,
      );

      await tx.monthlyTenancy.update({
        where: { id: ids.monthlyTenancyId },
        data: {
          totalReceived,
          remainingBalance,
        },
      });

      // paymentState for tenancy is derived in mapper; totals are summary fields.
      void hasCompletedRefunds;
      void hasCompletedReversals;
      void deriveSourcePaymentState({
        totalPayable: tenancy.totalPayable,
        totalReceived,
        startDate: tenancy.agreementStart,
        hasCompletedRefunds,
        hasCompletedReversals,
      });
    }
  }

  private async loadSourceForUpdate(
    tx: Prisma.TransactionClient,
    dto: {
      paymentForType: PaymentForType;
      bookingId?: string;
      monthlyTenancyId?: string;
    },
  ) {
    if (dto.paymentForType === PaymentForType.BOOKING) {
      if (!dto.bookingId) {
        throw new BadRequestException('bookingId is required');
      }
      const booking = await tx.booking.findUnique({
        where: { id: dto.bookingId },
      });
      if (!booking) {
        throw new NotFoundException('Booking not found');
      }
      return {
        remaining: booking.remainingAmount,
        total: booking.totalAmount,
      };
    }

    if (dto.paymentForType === PaymentForType.MONTHLY_TENANCY) {
      if (!dto.monthlyTenancyId) {
        throw new BadRequestException('monthlyTenancyId is required');
      }
      const tenancy = await tx.monthlyTenancy.findUnique({
        where: { id: dto.monthlyTenancyId },
      });
      if (!tenancy) {
        throw new NotFoundException('Monthly tenancy not found');
      }
      return {
        remaining: tenancy.remainingBalance,
        total: tenancy.totalPayable,
      };
    }

    throw new BadRequestException('Unsupported paymentForType for this module');
  }

  private async nextPaymentNumber(tx: Prisma.TransactionClient) {
    const now = new Date();
    const yyyy = now.getUTCFullYear();
    const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(now.getUTCDate()).padStart(2, '0');
    const dateKey = `${yyyy}${mm}${dd}`;
    const settingKey = `payment_seq_${dateKey}`;

    const rows = await tx.$queryRaw<Array<{ value: string }>>`
      INSERT INTO "SystemSetting" (key, value, "createdAt", "updatedAt")
      VALUES (${settingKey}, '1', NOW(), NOW())
      ON CONFLICT (key)
      DO UPDATE SET
        value = (CAST("SystemSetting".value AS INTEGER) + 1)::text,
        "updatedAt" = NOW()
      RETURNING value
    `;

    const seq = String(rows[0]?.value ?? '1').padStart(4, '0');
    return `PAY-${dateKey}-${seq}`;
  }

  private assertCanRecord(role: Role) {
    if (
      role !== Role.SUPER_ADMIN &&
      role !== Role.ADMIN &&
      role !== Role.RECEPTIONIST
    ) {
      throw new ForbiddenException('Insufficient permissions');
    }
  }

  private assertSupportedType(type: PaymentForType) {
    if (
      type !== PaymentForType.BOOKING &&
      type !== PaymentForType.MONTHLY_TENANCY
    ) {
      throw new BadRequestException(
        'Only BOOKING and MONTHLY_TENANCY payments are implemented in this module',
      );
    }
  }

  private assertExclusiveSource(dto: {
    bookingId?: string;
    monthlyTenancyId?: string;
    paymentForType: PaymentForType;
  }) {
    const hasBooking = Boolean(dto.bookingId);
    const hasTenancy = Boolean(dto.monthlyTenancyId);

    if (hasBooking && hasTenancy) {
      throw new BadRequestException(
        'Payment cannot reference both bookingId and monthlyTenancyId',
      );
    }

    if (dto.paymentForType === PaymentForType.BOOKING && !hasBooking) {
      throw new BadRequestException('bookingId is required for BOOKING payments');
    }

    if (dto.paymentForType === PaymentForType.MONTHLY_TENANCY && !hasTenancy) {
      throw new BadRequestException(
        'monthlyTenancyId is required for MONTHLY_TENANCY payments',
      );
    }

    if (!hasBooking && !hasTenancy) {
      throw new BadRequestException(
        'Payment must reference bookingId or monthlyTenancyId',
      );
    }
  }

  private parseDate(value: string) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException('Invalid paymentDate');
    }
    return date;
  }

  private async getPaymentOrThrow(id: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { id },
      include: paymentInclude,
    });

    if (!payment) {
      throw new NotFoundException(`Payment with id "${id}" not found`);
    }

    return payment;
  }

  private buildWhere(
    query: QueryPaymentsDto,
    role: Role,
  ): Prisma.PaymentWhereInput {
    const where: Prisma.PaymentWhereInput = {};

    if (query.paymentForType) where.paymentForType = query.paymentForType;
    if (query.bookingId) where.bookingId = query.bookingId;
    if (query.monthlyTenancyId) where.monthlyTenancyId = query.monthlyTenancyId;
    if (query.paymentMethod) where.paymentMethod = query.paymentMethod;
    if (query.transactionType) where.transactionType = query.transactionType;
    if (query.status) where.status = query.status;
    if (query.createdByUserId) where.createdByUserId = query.createdByUserId;

    if (role === Role.RECEPTIONIST) {
      // Operational history only — recent guest/tenant payment activity
      where.paymentForType = {
        in: [PaymentForType.BOOKING, PaymentForType.MONTHLY_TENANCY],
      };
      where.transactionType = {
        in: [PaymentTransactionType.PAYMENT, PaymentTransactionType.REFUND],
      };
    }

    if (query.today === 'true' || query.today === '1') {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const end = new Date();
      end.setHours(23, 59, 59, 999);
      where.paymentDate = { gte: start, lte: end };
    } else if (query.date) {
      where.paymentDate = {
        gte: new Date(`${query.date}T00:00:00.000Z`),
        lte: new Date(`${query.date}T23:59:59.999Z`),
      };
    } else if (query.startDate || query.endDate) {
      where.paymentDate = {};
      if (query.startDate) {
        where.paymentDate.gte = new Date(`${query.startDate}T00:00:00.000Z`);
      }
      if (query.endDate) {
        where.paymentDate.lte = new Date(`${query.endDate}T23:59:59.999Z`);
      }
    } else if (query.year !== undefined && query.month !== undefined) {
      const start = new Date(Date.UTC(query.year, query.month - 1, 1));
      const end = new Date(
        Date.UTC(query.year, query.month, 0, 23, 59, 59, 999),
      );
      where.paymentDate = { gte: start, lte: end };
    } else if (query.year !== undefined) {
      where.paymentDate = {
        gte: new Date(Date.UTC(query.year, 0, 1)),
        lte: new Date(Date.UTC(query.year, 11, 31, 23, 59, 59, 999)),
      };
    } else if (query.month !== undefined) {
      throw new BadRequestException('year is required when month is provided');
    }

    if (query.search?.trim()) {
      const term = query.search.trim();
      where.OR = [
        { paymentNumber: { contains: term, mode: 'insensitive' } },
        { transactionReference: { contains: term, mode: 'insensitive' } },
        {
          booking: {
            bookingNumber: { contains: term, mode: 'insensitive' },
          },
        },
        {
          booking: {
            guest: { fullName: { contains: term, mode: 'insensitive' } },
          },
        },
        {
          booking: {
            guest: { phone: { contains: term, mode: 'insensitive' } },
          },
        },
        {
          booking: {
            unit: { unitNumber: { contains: term, mode: 'insensitive' } },
          },
        },
        {
          monthlyTenancy: {
            tenant: { fullName: { contains: term, mode: 'insensitive' } },
          },
        },
        {
          monthlyTenancy: {
            tenant: { phone: { contains: term, mode: 'insensitive' } },
          },
        },
        {
          monthlyTenancy: {
            unit: { unitNumber: { contains: term, mode: 'insensitive' } },
          },
        },
      ];
    }

    return where;
  }
}
