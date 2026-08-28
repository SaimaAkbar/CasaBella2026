import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  MonthlyAgreementStatus,
  MonthlyTenancyStatus,
  Prisma,
  Role,
} from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  GenerateMonthlyBillDto,
  GenerateMonthlyBillsBatchDto,
  QueryMonthlyBillsDto,
} from './dto/monthly-bills.dto';
import {
  buildDueDate,
  calculateBillTotals,
  deriveBillPaymentStatus,
  serializeMoney,
} from './monthly-bill.finance';

const billInclude = {
  agreement: {
    include: {
      tenant: {
        select: { id: true, fullName: true, phone: true, cnic: true },
      },
    },
  },
} satisfies Prisma.MonthlyBillInclude;

@Injectable()
export class MonthlyBillsService {
  constructor(private readonly prisma: PrismaService) {}

  async generate(dto: GenerateMonthlyBillDto, role: Role) {
    this.assertManage(role);

    const agreement = await this.prisma.monthlyAgreement.findUnique({
      where: { id: dto.agreementId },
    });
    if (!agreement) {
      throw new NotFoundException(`Agreement "${dto.agreementId}" not found`);
    }
    if (agreement.status !== MonthlyAgreementStatus.ACTIVE) {
      throw new BadRequestException('Bills can only be generated for ACTIVE agreements');
    }

    const existing = await this.prisma.monthlyBill.findUnique({
      where: {
        agreementId_billingMonth_billingYear: {
          agreementId: dto.agreementId,
          billingMonth: dto.billingMonth,
          billingYear: dto.billingYear,
        },
      },
    });
    if (existing) {
      throw new ConflictException(
        `Bill for ${dto.billingMonth}/${dto.billingYear} already exists`,
      );
    }

    const baseRent = await this.sumActiveRents(dto.agreementId);
    const rentCredits = await this.sumRentCredits(
      dto.agreementId,
      dto.billingMonth,
      dto.billingYear,
    );
    const credits = new Prisma.Decimal(dto.credits ?? 0).plus(rentCredits);
    const dueDate = buildDueDate(
      dto.billingYear,
      dto.billingMonth,
      agreement.billingDay,
    );
    const totals = calculateBillTotals({
      baseRent,
      electricityCharges: dto.electricityCharges,
      maintenanceCharges: dto.maintenanceCharges,
      societyCharges: dto.societyCharges,
      cleaningCharges: dto.cleaningCharges,
      laundryCharges: dto.laundryCharges,
      waterCharges: dto.waterCharges,
      otherCharges: dto.otherCharges,
      previousBalance: dto.previousBalance,
      credits,
      totalReceived: 0,
    });

    const bill = await this.prisma.monthlyBill.create({
      data: {
        agreementId: dto.agreementId,
        billingMonth: dto.billingMonth,
        billingYear: dto.billingYear,
        ...totals,
        dueDate,
        paymentStatus: deriveBillPaymentStatus(
          totals.totalPayable,
          totals.totalReceived,
          dueDate,
        ),
      },
      include: billInclude,
    });

    return this.mapBill(bill, role);
  }

  async generateMonthly(dto: GenerateMonthlyBillsBatchDto, role: Role) {
    this.assertManage(role);

    const agreements = await this.prisma.monthlyAgreement.findMany({
      where: { status: MonthlyAgreementStatus.ACTIVE },
      select: { id: true },
    });

    const created: unknown[] = [];
    const skipped: string[] = [];

    for (const agreement of agreements) {
      const exists = await this.prisma.monthlyBill.findUnique({
        where: {
          agreementId_billingMonth_billingYear: {
            agreementId: agreement.id,
            billingMonth: dto.billingMonth,
            billingYear: dto.billingYear,
          },
        },
      });
      if (exists) {
        skipped.push(agreement.id);
        continue;
      }
      try {
        const bill = await this.generate(
          {
            agreementId: agreement.id,
            billingMonth: dto.billingMonth,
            billingYear: dto.billingYear,
          },
          role,
        );
        created.push(bill);
      } catch {
        skipped.push(agreement.id);
      }
    }

    return { createdCount: created.length, skippedCount: skipped.length, created };
  }

  async findAll(query: QueryMonthlyBillsDto, role: Role) {
    const where: Prisma.MonthlyBillWhereInput = {};
    if (query.agreementId) where.agreementId = query.agreementId;
    if (query.billingMonth) where.billingMonth = query.billingMonth;
    if (query.billingYear) where.billingYear = query.billingYear;
    if (query.tenantId) {
      where.agreement = { tenantId: query.tenantId };
    }

    const rows = await this.prisma.monthlyBill.findMany({
      where,
      include: billInclude,
      orderBy: [
        { billingYear: 'desc' },
        { billingMonth: 'desc' },
        { createdAt: 'desc' },
      ],
    });

    return rows.map((row) => this.mapBill(row, role));
  }

  async findOne(id: string, role: Role) {
    const bill = await this.prisma.monthlyBill.findUnique({
      where: { id },
      include: billInclude,
    });
    if (!bill) {
      throw new NotFoundException(`Bill "${id}" not found`);
    }
    return this.mapBill(bill, role);
  }

  async finalize(id: string, role: Role) {
    if (role !== Role.SUPER_ADMIN && role !== Role.ADMIN) {
      throw new ForbiddenException('Insufficient permissions');
    }
    const bill = await this.prisma.monthlyBill.findUnique({ where: { id } });
    if (!bill) {
      throw new NotFoundException(`Bill "${id}" not found`);
    }
    if (bill.finalized) {
      throw new BadRequestException('Bill is already finalized');
    }

    const updated = await this.prisma.monthlyBill.update({
      where: { id },
      data: { finalized: true },
      include: billInclude,
    });
    return this.mapBill(updated, role);
  }

  async recalculateBill(
    tx: Prisma.TransactionClient,
    monthlyBillId: string,
  ) {
    const bill = await tx.monthlyBill.findUniqueOrThrow({
      where: { id: monthlyBillId },
    });
    const payments = await tx.payment.findMany({
      where: { monthlyBillId },
      select: {
        amount: true,
        status: true,
        transactionType: true,
      },
    });

    let totalReceived = new Prisma.Decimal(0);
    for (const row of payments) {
      if (row.status !== 'COMPLETED') continue;
      if (
        row.transactionType === 'PAYMENT' ||
        row.transactionType === 'ADJUSTMENT'
      ) {
        totalReceived = totalReceived.plus(row.amount);
      } else if (
        row.transactionType === 'REFUND' ||
        row.transactionType === 'REVERSAL'
      ) {
        totalReceived = totalReceived.minus(row.amount);
      }
    }

    const remainingBalance = bill.totalPayable.minus(totalReceived);
    const paymentStatus = deriveBillPaymentStatus(
      bill.totalPayable,
      totalReceived,
      bill.dueDate,
    );

    await tx.monthlyBill.update({
      where: { id: monthlyBillId },
      data: { totalReceived, remainingBalance, paymentStatus },
    });
  }

  private async sumActiveRents(agreementId: string): Promise<Prisma.Decimal> {
    const rows = await this.prisma.monthlyTenancy.findMany({
      where: {
        agreementId,
        tenancyStatus: MonthlyTenancyStatus.ACTIVE,
      },
      select: { monthlyRent: true },
    });
    return rows.reduce(
      (sum, row) => sum.plus(row.monthlyRent),
      new Prisma.Decimal(0),
    );
  }

  private async sumRentCredits(
    agreementId: string,
    billingMonth: number,
    billingYear: number,
  ): Promise<Prisma.Decimal> {
    const credits = await this.prisma.rentCredit.findMany({
      where: {
        billingMonth,
        billingYear,
        monthlyTenancy: { agreementId },
      },
      select: { amount: true },
    });
    return credits.reduce(
      (sum, row) => sum.plus(row.amount),
      new Prisma.Decimal(0),
    );
  }

  private mapBill(
    bill: Prisma.MonthlyBillGetPayload<{ include: typeof billInclude }>,
    role: Role,
  ) {
    const base = {
      id: bill.id,
      agreementId: bill.agreementId,
      billingMonth: bill.billingMonth,
      billingYear: bill.billingYear,
      dueDate: bill.dueDate,
      paymentStatus: bill.paymentStatus,
      finalized: bill.finalized,
      notes: bill.notes,
      createdAt: bill.createdAt,
      updatedAt: bill.updatedAt,
      agreement: {
        id: bill.agreement.id,
        agreementNumber: bill.agreement.agreementNumber,
        status: bill.agreement.status,
        tenant: {
          id: bill.agreement.tenant.id,
          fullName: bill.agreement.tenant.fullName,
          phone: bill.agreement.tenant.phone,
          ...(role === Role.RECEPTIONIST
            ? {}
            : { cnic: bill.agreement.tenant.cnic }),
        },
      },
    };

    if (role === Role.RECEPTIONIST) {
      return base;
    }

    return {
      ...base,
      baseRent: serializeMoney(bill.baseRent),
      electricityCharges: serializeMoney(bill.electricityCharges),
      maintenanceCharges: serializeMoney(bill.maintenanceCharges),
      societyCharges: serializeMoney(bill.societyCharges),
      cleaningCharges: serializeMoney(bill.cleaningCharges),
      laundryCharges: serializeMoney(bill.laundryCharges),
      waterCharges: serializeMoney(bill.waterCharges),
      otherCharges: serializeMoney(bill.otherCharges),
      previousBalance: serializeMoney(bill.previousBalance),
      credits: serializeMoney(bill.credits),
      totalPayable: serializeMoney(bill.totalPayable),
      totalReceived: serializeMoney(bill.totalReceived),
      remainingBalance: serializeMoney(bill.remainingBalance),
    };
  }

  private assertManage(role: Role) {
    if (role === Role.RECEPTIONIST) {
      throw new ForbiddenException('Insufficient permissions');
    }
  }
}
