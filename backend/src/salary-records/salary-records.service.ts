import {
  BadRequestException,
  ConflictException,
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
import { PrismaService } from '../prisma/prisma.service';
import { SalaryTransactionsService } from '../salary-transactions/salary-transactions.service';
import { GenerateMonthlySalaryDto } from './dto/generate-monthly.dto';
import { MarkSalaryPaidDto } from './dto/mark-paid.dto';
import { QuerySalaryRecordsDto } from './dto/query-salary-records.dto';
import { resolveEffectiveSalary } from './salary-effective';
import { mapSalaryRecord } from './salary-records.mapper';

const recordInclude = {
  employee: {
    select: {
      id: true,
      employeeCode: true,
      fullName: true,
      position: true,
      department: true,
      phone: true,
    },
  },
  createdBy: { select: { id: true, fullName: true } },
  approvedBy: { select: { id: true, fullName: true } },
} satisfies Prisma.SalaryRecordInclude;

/** List payload: non-reversed ADVANCE txs only (date/reason for banners). */
const listInclude = {
  ...recordInclude,
  transactions: {
    where: {
      transactionType: SalaryTransactionType.ADVANCE,
      isReversed: false,
    },
    orderBy: { transactionDate: 'asc' as const },
    include: {
      salaryRecord: {
        select: {
          id: true,
          salaryMonth: true,
          salaryYear: true,
          paymentStatus: true,
          finalized: true,
        },
      },
    },
  },
} satisfies Prisma.SalaryRecordInclude;

const detailInclude = {
  ...recordInclude,
  transactions: {
    orderBy: { transactionDate: 'asc' as const },
    include: {
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
    },
  },
};

@Injectable()
export class SalaryRecordsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly salaryTransactionsService: SalaryTransactionsService,
  ) {}

  async generateMonthly(
    dto: GenerateMonthlySalaryDto,
    role: Role,
    canAccessSalary: boolean,
    userId: string,
  ) {
    assertSuperAdminSalaryAccess(role);
    void canAccessSalary;

    const where: Prisma.EmployeeWhereInput = {
      isActive: true,
      status: EmployeeStatus.ACTIVE,
    };
    if (dto.employeeId) where.id = dto.employeeId;
    if (dto.department) {
      where.department = { equals: dto.department, mode: 'insensitive' };
    }

    const employees = await this.prisma.employee.findMany({
      where,
      include: { salaryRevisions: true },
    });
    const details: Array<{
      employeeId: string;
      employeeCode: string;
      fullName: string;
      status: 'created' | 'skipped' | 'failed';
      message?: string;
    }> = [];

    let created = 0;
    let skipped = 0;
    let failed = 0;

    for (const employee of employees) {
      try {
        const existing = await this.prisma.salaryRecord.findUnique({
          where: {
            employeeId_salaryMonth_salaryYear: {
              employeeId: employee.id,
              salaryMonth: dto.month,
              salaryYear: dto.year,
            },
          },
        });

        if (existing) {
          skipped += 1;
          details.push({
            employeeId: employee.id,
            employeeCode: employee.employeeCode,
            fullName: employee.fullName,
            status: 'skipped',
            message: 'Salary record already exists for this month/year',
          });
          continue;
        }

        const baseSalary = resolveEffectiveSalary(
          employee.monthlySalary,
          employee.salaryRevisions,
          dto.month,
          dto.year,
        );

        await this.prisma.salaryRecord.create({
          data: {
            employeeId: employee.id,
            salaryMonth: dto.month,
            salaryYear: dto.year,
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
        });

        created += 1;
        details.push({
          employeeId: employee.id,
          employeeCode: employee.employeeCode,
          fullName: employee.fullName,
          status: 'created',
        });
      } catch (error) {
        failed += 1;
        details.push({
          employeeId: employee.id,
          employeeCode: employee.employeeCode,
          fullName: employee.fullName,
          status: 'failed',
          message:
            error instanceof Error ? error.message : 'Unable to create record',
        });
      }
    }

    return { created, skipped, failed, details };
  }

  async findAll(
    query: QuerySalaryRecordsDto,
    role: Role,
    canAccessSalary?: boolean,
  ) {
    assertSuperAdminSalaryAccess(role);
    void canAccessSalary;

    const where: Prisma.SalaryRecordWhereInput = {};
    if (query.employeeId) where.employeeId = query.employeeId;
    if (query.salaryMonth !== undefined) where.salaryMonth = query.salaryMonth;
    if (query.salaryYear !== undefined) where.salaryYear = query.salaryYear;
    if (query.paymentStatus) where.paymentStatus = query.paymentStatus;
    if (query.finalized !== undefined) where.finalized = query.finalized;

    if (query.department) {
      where.employee = {
        department: { equals: query.department, mode: 'insensitive' },
      };
    }

    if (query.startDate || query.endDate) {
      where.createdAt = {};
      if (query.startDate) {
        where.createdAt.gte = new Date(`${query.startDate}T00:00:00.000Z`);
      }
      if (query.endDate) {
        where.createdAt.lte = new Date(`${query.endDate}T23:59:59.999Z`);
      }
    }

    if (query.search?.trim()) {
      const term = query.search.trim();
      where.OR = [
        { employee: { fullName: { contains: term, mode: 'insensitive' } } },
        {
          employee: { employeeCode: { contains: term, mode: 'insensitive' } },
        },
      ];
    }

    const rows = await this.prisma.salaryRecord.findMany({
      where,
      include: listInclude,
      orderBy: [
        { salaryYear: 'desc' },
        { salaryMonth: 'desc' },
        { createdAt: 'desc' },
      ],
    });

    return rows.map((row) => ({
      ...mapSalaryRecord(row),
      hasAdvance: row.totalAdvance.greaterThan(0),
    }));
  }

  async findOne(id: string, role: Role, canAccessSalary?: boolean) {
    assertSuperAdminSalaryAccess(role);
    void canAccessSalary;
    const record = await this.prisma.salaryRecord.findUnique({
      where: { id },
      include: detailInclude,
    });
    if (!record) {
      throw new NotFoundException('Salary record not found');
    }
    return {
      ...mapSalaryRecord(record),
      hasAdvance: record.totalAdvance.greaterThan(0),
    };
  }

  async finalize(id: string, role: Role, canAccessSalary?: boolean) {
    assertSuperAdminSalaryAccess(role);
    void canAccessSalary;

    const record = await this.prisma.salaryRecord.findUnique({
      where: { id },
    });
    if (!record) {
      throw new NotFoundException('Salary record not found');
    }
    if (record.finalized) {
      throw new ConflictException('Salary record is already finalized');
    }

    const updated = await this.prisma.salaryRecord.update({
      where: { id },
      data: { finalized: true, finalizedAt: new Date() },
      include: detailInclude,
    });

    return mapSalaryRecord(updated);
  }

  async approve(
    id: string,
    role: Role,
    canAccessSalary: boolean,
    userId: string,
  ) {
    assertSuperAdminSalaryAccess(role);
    void canAccessSalary;

    const record = await this.prisma.salaryRecord.findUnique({
      where: { id },
    });
    if (!record) {
      throw new NotFoundException('Salary record not found');
    }
    if (!record.finalized) {
      throw new BadRequestException('Finalize the salary record before approval');
    }
    if (record.approvedByUserId) {
      throw new ConflictException('Salary record is already approved');
    }

    const updated = await this.prisma.salaryRecord.update({
      where: { id },
      data: {
        approvedByUserId: userId,
        approvedAt: new Date(),
      },
      include: detailInclude,
    });

    return mapSalaryRecord(updated);
  }

  async markPaid(
    id: string,
    dto: MarkSalaryPaidDto,
    role: Role,
    canAccessSalary: boolean,
    userId: string,
  ) {
    assertSuperAdminSalaryAccess(role);
    void canAccessSalary;
    await this.salaryTransactionsService.createPaymentForRemaining(
      id,
      role,
      userId,
      dto.paymentMethod,
    );
    return this.findOne(id, role);
  }
}
