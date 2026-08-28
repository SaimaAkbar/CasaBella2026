import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  EmployeeStatus,
  Prisma,
  Role,
  SalaryPaymentStatus,
  SalaryTransactionType,
} from '../../generated/prisma/client';
import { assertSuperAdminSalaryAccess } from '../common/utils/salary-access';
import { ExpensesService } from '../expenses/expenses.service';
import { PrismaService } from '../prisma/prisma.service';
import { resolveEffectiveSalary } from '../salary-records/salary-effective';
import { CreateSalaryTransactionDto } from './dto/create-salary-transaction.dto';
import { QuerySalaryTransactionsDto } from './dto/query-salary-transactions.dto';
import { ReverseSalaryTransactionDto } from './dto/reverse-salary-transaction.dto';
import {
  recalculateSalaryTotals,
  toPositiveMoney,
} from './salary.finance';
import { mapSalaryTransaction } from './salary-transactions.mapper';

const txInclude = {
  employee: {
    select: {
      id: true,
      employeeCode: true,
      fullName: true,
      position: true,
      department: true,
    },
  },
  salaryRecord: {
    select: {
      id: true,
      salaryMonth: true,
      salaryYear: true,
      paymentStatus: true,
      finalized: true,
    },
  },
  createdBy: { select: { id: true, fullName: true } },
  approvedBy: { select: { id: true, fullName: true } },
  expense: { select: { id: true, expenseNumber: true } },
} satisfies Prisma.SalaryTransactionInclude;

@Injectable()
export class SalaryTransactionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly expensesService: ExpensesService,
  ) {}

  async create(
    dto: CreateSalaryTransactionDto,
    role: Role,
    userId: string,
  ) {
    assertSuperAdminSalaryAccess(role);

    if (dto.transactionType === SalaryTransactionType.REVERSAL) {
      throw new BadRequestException(
        'Use the reverse endpoint to create reversals',
      );
    }

    if (
      dto.transactionType === SalaryTransactionType.ADJUSTMENT &&
      !dto.adjustmentDirection
    ) {
      throw new BadRequestException(
        'adjustmentDirection is required for ADJUSTMENT',
      );
    }

    if (
      (dto.transactionType === SalaryTransactionType.SALARY_PAYMENT ||
        dto.transactionType === SalaryTransactionType.ADVANCE) &&
      !dto.paymentMethod
    ) {
      throw new BadRequestException(
        'paymentMethod is required for salary payments and advances',
      );
    }

    if (!dto.salaryRecordId && (!dto.salaryMonth || !dto.salaryYear)) {
      throw new BadRequestException(
        'Provide salaryRecordId or salaryMonth and salaryYear',
      );
    }

    const amount = toPositiveMoney(dto.amount);

    const result = await this.prisma.$transaction(async (tx) => {
      const record = await this.resolveRecord(tx, dto, userId);

      if (record.employeeId !== dto.employeeId) {
        throw new BadRequestException(
          'employeeId does not match the salary record',
        );
      }

      const pendingRows = [
        ...record.transactions.map((row) => ({
          transactionType: row.transactionType,
          amount: row.amount,
          adjustmentDirection: row.adjustmentDirection,
          isReversed: row.isReversed,
        })),
        {
          transactionType: dto.transactionType,
          amount,
          adjustmentDirection: dto.adjustmentDirection ?? null,
          isReversed: false,
        },
      ];

      const totals = recalculateSalaryTotals(record.baseSalary, pendingRows);

      let expenseId: string | undefined;
      if (
        dto.transactionType === SalaryTransactionType.SALARY_PAYMENT ||
        dto.transactionType === SalaryTransactionType.ADVANCE
      ) {
        const expense = await this.expensesService.createLinkedSalaryExpense(
          tx,
          {
            amount,
            employeeId: record.employeeId,
            expenseDate: new Date(dto.transactionDate),
            userId,
            description: `${dto.transactionType} — ${record.employee.fullName} (${record.salaryMonth}/${record.salaryYear})`,
            vendorName: record.employee.fullName,
            paymentMethod: dto.paymentMethod,
            referenceNumber: dto.transactionReference?.trim(),
            metadata: {
              billingMonth: record.salaryMonth,
              billingYear: record.salaryYear,
              payeeName: record.employee.fullName,
              salaryRecordId: record.id,
              transactionType: dto.transactionType,
            },
            markPaid: true,
          },
        );
        expenseId = expense.id;
      }

      const created = await tx.salaryTransaction.create({
        data: {
          salaryRecordId: record.id,
          employeeId: record.employeeId,
          transactionType: dto.transactionType,
          amount,
          adjustmentDirection: dto.adjustmentDirection,
          transactionDate: new Date(dto.transactionDate),
          reason: dto.reason?.trim(),
          paymentMethod: dto.paymentMethod,
          transactionReference: dto.transactionReference?.trim(),
          notes: dto.notes?.trim(),
          expenseId,
          createdByUserId: userId,
          approvedByUserId: userId,
          approvedAt: new Date(),
        },
        include: txInclude,
      });

      await tx.salaryRecord.update({
        where: { id: record.id },
        data: totals,
      });

      return created;
    });

    return mapSalaryTransaction(result);
  }

  async findAll(query: QuerySalaryTransactionsDto, role: Role) {
    assertSuperAdminSalaryAccess(role);

    const where: Prisma.SalaryTransactionWhereInput = {};
    if (query.employeeId) where.employeeId = query.employeeId;
    if (query.salaryRecordId) where.salaryRecordId = query.salaryRecordId;
    if (query.transactionType) where.transactionType = query.transactionType;
    if (query.paymentMethod) where.paymentMethod = query.paymentMethod;

    if (query.date) {
      where.transactionDate = {
        gte: new Date(`${query.date}T00:00:00.000Z`),
        lte: new Date(`${query.date}T23:59:59.999Z`),
      };
    } else if (query.startDate || query.endDate) {
      where.transactionDate = {};
      if (query.startDate) {
        where.transactionDate.gte = new Date(
          `${query.startDate}T00:00:00.000Z`,
        );
      }
      if (query.endDate) {
        where.transactionDate.lte = new Date(`${query.endDate}T23:59:59.999Z`);
      }
    } else if (query.year !== undefined && query.month !== undefined) {
      where.salaryRecord = {
        salaryMonth: query.month,
        salaryYear: query.year,
      };
    } else if (query.year !== undefined) {
      where.salaryRecord = { salaryYear: query.year };
    } else if (query.month !== undefined) {
      throw new BadRequestException('year is required when month is provided');
    }

    if (query.search?.trim()) {
      const term = query.search.trim();
      where.OR = [
        { transactionReference: { contains: term, mode: 'insensitive' } },
        { employee: { fullName: { contains: term, mode: 'insensitive' } } },
        {
          employee: { employeeCode: { contains: term, mode: 'insensitive' } },
        },
        { reason: { contains: term, mode: 'insensitive' } },
      ];
    }

    const rows = await this.prisma.salaryTransaction.findMany({
      where,
      include: txInclude,
      orderBy: { transactionDate: 'desc' },
    });

    return rows.map(mapSalaryTransaction);
  }

  async findOne(id: string, role: Role) {
    assertSuperAdminSalaryAccess(role);
    const row = await this.prisma.salaryTransaction.findUnique({
      where: { id },
      include: txInclude,
    });
    if (!row) {
      throw new NotFoundException('Salary transaction not found');
    }
    return mapSalaryTransaction(row);
  }

  async reverse(
    id: string,
    dto: ReverseSalaryTransactionDto,
    role: Role,
    userId: string,
  ) {
    assertSuperAdminSalaryAccess(role);

    const result = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.salaryTransaction.findUnique({
        where: { id },
        include: {
          salaryRecord: { include: { transactions: true } },
          employee: true,
        },
      });
      if (!existing) {
        throw new NotFoundException('Salary transaction not found');
      }
      if (existing.isReversed) {
        throw new BadRequestException('Transaction is already reversed');
      }
      if (existing.transactionType === SalaryTransactionType.REVERSAL) {
        throw new BadRequestException('Cannot reverse a reversal entry');
      }

      await tx.salaryTransaction.update({
        where: { id },
        data: {
          isReversed: true,
          reversedAt: new Date(),
          reversalReason: dto.reason.trim(),
        },
      });

      const reversal = await tx.salaryTransaction.create({
        data: {
          salaryRecordId: existing.salaryRecordId,
          employeeId: existing.employeeId,
          transactionType: SalaryTransactionType.REVERSAL,
          amount: existing.amount,
          transactionDate: new Date(),
          reason: dto.reason.trim(),
          notes: `Reversal of ${existing.transactionType} ${existing.id}`,
          reversesTransactionId: existing.id,
          createdByUserId: userId,
          approvedByUserId: userId,
          approvedAt: new Date(),
        },
        include: txInclude,
      });

      const refreshed = await tx.salaryTransaction.findMany({
        where: { salaryRecordId: existing.salaryRecordId },
      });

      const totals = recalculateSalaryTotals(
        existing.salaryRecord.baseSalary,
        refreshed,
      );

      await tx.salaryRecord.update({
        where: { id: existing.salaryRecordId },
        data: totals,
      });

      if (existing.expenseId) {
        await tx.expense.update({
          where: { id: existing.expenseId },
          data: {
            isActive: false,
            description: `REVERSED: ${dto.reason.trim()}`,
          },
        });
      }

      return reversal;
    });

    return mapSalaryTransaction(result);
  }

  async createPaymentForRemaining(
    salaryRecordId: string,
    role: Role,
    userId: string,
    paymentMethod: CreateSalaryTransactionDto['paymentMethod'],
  ) {
    assertSuperAdminSalaryAccess(role);
    const record = await this.prisma.salaryRecord.findUnique({
      where: { id: salaryRecordId },
    });
    if (!record) {
      throw new NotFoundException('Salary record not found');
    }
    if (record.remainingBalance.lessThanOrEqualTo(0)) {
      throw new BadRequestException('Salary record has no remaining balance');
    }

    return this.create(
      {
        salaryRecordId,
        employeeId: record.employeeId,
        transactionType: SalaryTransactionType.SALARY_PAYMENT,
        amount: Number(record.remainingBalance.toString()),
        transactionDate: new Date().toISOString(),
        paymentMethod: paymentMethod ?? 'CASH',
        notes: 'Marked paid in full',
      },
      role,
      userId,
    );
  }

  private async resolveRecord(
    tx: Prisma.TransactionClient,
    dto: CreateSalaryTransactionDto,
    userId: string,
  ) {
    if (dto.salaryRecordId) {
      const record = await tx.salaryRecord.findUnique({
        where: { id: dto.salaryRecordId },
        include: { employee: true, transactions: true },
      });
      if (!record) {
        throw new NotFoundException('Salary record not found');
      }
      return record;
    }

    const salaryMonth = dto.salaryMonth as number;
    const salaryYear = dto.salaryYear as number;

    const existing = await tx.salaryRecord.findUnique({
      where: {
        employeeId_salaryMonth_salaryYear: {
          employeeId: dto.employeeId,
          salaryMonth,
          salaryYear,
        },
      },
      include: { employee: true, transactions: true },
    });
    if (existing) return existing;

    const employee = await tx.employee.findUnique({
      where: { id: dto.employeeId },
      include: { salaryRevisions: true },
    });
    if (!employee) {
      throw new NotFoundException('Employee not found');
    }
    if (!employee.isActive || employee.status !== EmployeeStatus.ACTIVE) {
      throw new BadRequestException('Employee is not active');
    }

    const baseSalary = resolveEffectiveSalary(
      employee.monthlySalary,
      employee.salaryRevisions,
      salaryMonth,
      salaryYear,
    );

    return tx.salaryRecord.create({
      data: {
        employeeId: employee.id,
        salaryMonth,
        salaryYear,
        baseSalary,
        totalAdvance: 0,
        totalDeductions: 0,
        totalBonus: 0,
        totalPaid: 0,
        netPayable: baseSalary,
        remainingBalance: baseSalary,
        paymentStatus: SalaryPaymentStatus.UNPAID,
        finalized: false,
        createdByUserId: userId,
      },
      include: { employee: true, transactions: true },
    });
  }
}
