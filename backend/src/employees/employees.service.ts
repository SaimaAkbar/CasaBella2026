import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Role } from '../../generated/prisma/client';
import { assertSuperAdminSalaryAccess } from '../common/utils/salary-access';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { QueryEmployeesDto } from './dto/query-employees.dto';
import { QuerySalarySummaryDto } from './dto/query-salary-summary.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { mapEmployee } from './employees.mapper';

@Injectable()
export class EmployeesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateEmployeeDto, role: Role) {
    assertSuperAdminSalaryAccess(role);

    try {
      const employee = await this.prisma.$transaction(async (tx) => {
        const employeeCode = await this.nextEmployeeCode(tx);
        return tx.employee.create({
          data: {
            employeeCode,
            fullName: dto.fullName.trim(),
            fatherOrSpouseName: dto.fatherOrSpouseName.trim(),
            phone: dto.phone.trim(),
            alternatePhone: dto.alternatePhone?.trim(),
            email: dto.email?.trim()?.toLowerCase(),
            cnic: dto.cnic?.trim() || null,
            address: dto.address?.trim(),
            city: dto.city?.trim(),
            position: dto.position.trim(),
            department: dto.department?.trim(),
            joiningDate: new Date(dto.joiningDate),
            monthlySalary: new Prisma.Decimal(dto.monthlySalary),
            bankName: dto.bankName?.trim(),
            accountTitle: dto.accountTitle?.trim(),
            accountNumberOrIban: dto.accountNumberOrIban?.trim(),
            emergencyContactName: dto.emergencyContactName?.trim(),
            emergencyContactPhone: dto.emergencyContactPhone?.trim(),
            status: dto.status,
            notes: dto.notes?.trim(),
            isActive: true,
          },
        });
      });

      return mapEmployee(employee);
    } catch (error) {
      this.handlePrismaError(error);
    }
  }

  async findAll(query: QueryEmployeesDto, role: Role) {
    assertSuperAdminSalaryAccess(role);

    const where: Prisma.EmployeeWhereInput = {};

    if (query.status) where.status = query.status;
    if (query.department) {
      where.department = { equals: query.department, mode: 'insensitive' };
    }
    if (query.position) {
      where.position = { equals: query.position, mode: 'insensitive' };
    }
    if (query.isActive !== undefined) where.isActive = query.isActive;

    if (query.search?.trim()) {
      const term = query.search.trim();
      where.OR = [
        { fullName: { contains: term, mode: 'insensitive' } },
        { phone: { contains: term, mode: 'insensitive' } },
        { email: { contains: term, mode: 'insensitive' } },
        { cnic: { contains: term, mode: 'insensitive' } },
        { employeeCode: { contains: term, mode: 'insensitive' } },
        { fatherOrSpouseName: { contains: term, mode: 'insensitive' } },
      ];
    }

    const employees = await this.prisma.employee.findMany({
      where,
      orderBy: [{ isActive: 'desc' }, { fullName: 'asc' }],
    });

    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();
    const currentRecords = await this.prisma.salaryRecord.findMany({
      where: {
        employeeId: { in: employees.map((row) => row.id) },
        salaryMonth: month,
        salaryYear: year,
      },
      select: {
        employeeId: true,
        paymentStatus: true,
        totalAdvance: true,
      },
    });
    const byEmployee = new Map(
      currentRecords.map((row) => [row.employeeId, row]),
    );

    return employees.map((employee) => {
      const current = byEmployee.get(employee.id);
      return {
        ...mapEmployee(employee),
        currentMonthStatus: current?.paymentStatus ?? 'NONE',
        currentMonthHasAdvance: current
          ? current.totalAdvance.greaterThan(0)
          : false,
      };
    });
  }

  async findOne(id: string, role: Role) {
    assertSuperAdminSalaryAccess(role);
    const employee = await this.getOrThrow(id);
    return mapEmployee(employee);
  }

  async update(
    id: string,
    dto: UpdateEmployeeDto,
    role: Role,
    userId: string,
  ) {
    assertSuperAdminSalaryAccess(role);

    const existing = await this.getOrThrow(id);

    const salaryChanging =
      dto.monthlySalary !== undefined &&
      !new Prisma.Decimal(dto.monthlySalary).equals(existing.monthlySalary);

    if (salaryChanging) {
      if (
        dto.salaryEffectiveMonth === undefined ||
        dto.salaryEffectiveYear === undefined ||
        !dto.salaryChangeReason?.trim()
      ) {
        throw new BadRequestException(
          'Salary change requires effective month, year, and reason',
        );
      }
    }

    try {
      const employee = await this.prisma.$transaction(async (tx) => {
        if (salaryChanging) {
          await tx.salaryRevision.create({
            data: {
              employeeId: id,
              oldSalary: existing.monthlySalary,
              newSalary: new Prisma.Decimal(dto.monthlySalary as number),
              effectiveMonth: dto.salaryEffectiveMonth as number,
              effectiveYear: dto.salaryEffectiveYear as number,
              reason: (dto.salaryChangeReason as string).trim(),
              changedByUserId: userId,
            },
          });
        }

        return tx.employee.update({
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
            position: dto.position?.trim(),
            department: dto.department?.trim(),
            joiningDate: dto.joiningDate
              ? new Date(dto.joiningDate)
              : undefined,
            monthlySalary:
              dto.monthlySalary === undefined
                ? undefined
                : new Prisma.Decimal(dto.monthlySalary),
            bankName: dto.bankName?.trim(),
            accountTitle: dto.accountTitle?.trim(),
            accountNumberOrIban: dto.accountNumberOrIban?.trim(),
            emergencyContactName: dto.emergencyContactName?.trim(),
            emergencyContactPhone: dto.emergencyContactPhone?.trim(),
            status: dto.status,
            notes: dto.notes?.trim(),
          },
        });
      });

      return mapEmployee(employee);
    } catch (error) {
      this.handlePrismaError(error);
    }
  }

  async archive(id: string, role: Role) {
    assertSuperAdminSalaryAccess(role);

    const existing = await this.getOrThrow(id);
    if (!existing.isActive) {
      throw new BadRequestException('Employee is already archived');
    }

    const employee = await this.prisma.employee.update({
      where: { id },
      data: { isActive: false, status: 'INACTIVE' },
    });

    return mapEmployee(employee);
  }

  async getSummary(role: Role, query: QuerySalarySummaryDto) {
    assertSuperAdminSalaryAccess(role);

    const month = query.month ?? new Date().getMonth() + 1;
    const year = query.year ?? new Date().getFullYear();

    const [total, active, inactive, payable, paid, advances] =
      await Promise.all([
        this.prisma.employee.count(),
        this.prisma.employee.count({
          where: { isActive: true, status: 'ACTIVE' },
        }),
        this.prisma.employee.count({
          where: { OR: [{ isActive: false }, { status: 'INACTIVE' }] },
        }),
        this.prisma.salaryRecord.aggregate({
          where: { salaryMonth: month, salaryYear: year },
          _sum: { remainingBalance: true, netPayable: true, baseSalary: true },
        }),
        this.prisma.salaryRecord.aggregate({
          where: { salaryMonth: month, salaryYear: year },
          _sum: { totalPaid: true },
        }),
        this.prisma.salaryRecord.aggregate({
          where: { salaryMonth: month, salaryYear: year },
          _sum: { totalAdvance: true },
        }),
      ]);

    return {
      month,
      year,
      totalEmployees: total,
      activeEmployees: active,
      inactiveEmployees: inactive,
      totalSalary: (
        payable._sum.baseSalary ?? new Prisma.Decimal(0)
      ).toString(),
      monthlySalaryPayable: (
        payable._sum.netPayable ?? new Prisma.Decimal(0)
      ).toString(),
      salaryPaid: (paid._sum.totalPaid ?? new Prisma.Decimal(0)).toString(),
      salaryOutstanding: (
        payable._sum.remainingBalance ?? new Prisma.Decimal(0)
      ).toString(),
      totalAdvances: (
        advances._sum.totalAdvance ?? new Prisma.Decimal(0)
      ).toString(),
    };
  }

  async getYearlyStatus(employeeId: string, year: number, role: Role) {
    assertSuperAdminSalaryAccess(role);
    await this.getOrThrow(employeeId);

    const records = await this.prisma.salaryRecord.findMany({
      where: { employeeId, salaryYear: year },
      select: {
        id: true,
        salaryMonth: true,
        paymentStatus: true,
        totalAdvance: true,
        remainingBalance: true,
        totalPaid: true,
      },
    });

    const byMonth = new Map(records.map((row) => [row.salaryMonth, row]));

    return Array.from({ length: 12 }, (_, index) => {
      const month = index + 1;
      const row = byMonth.get(month);
      if (!row) {
        return {
          month,
          year,
          status: 'NONE' as const,
          salaryRecordId: null,
          hasAdvance: false,
        };
      }
      return {
        month,
        year,
        status: row.paymentStatus,
        salaryRecordId: row.id,
        hasAdvance: row.totalAdvance.greaterThan(0),
      };
    });
  }

  private async nextEmployeeCode(tx: Prisma.TransactionClient) {
    const rows = await tx.$queryRaw<Array<{ value: string }>>`
      INSERT INTO "SystemSetting" (key, value, "createdAt", "updatedAt")
      VALUES ('employee_seq', '1', NOW(), NOW())
      ON CONFLICT (key)
      DO UPDATE SET
        value = (CAST("SystemSetting".value AS INTEGER) + 1)::text,
        "updatedAt" = NOW()
      RETURNING value
    `;
    const seq = String(rows[0]?.value ?? '1').padStart(4, '0');
    return `EMP-${seq}`;
  }

  private async getOrThrow(id: string) {
    const employee = await this.prisma.employee.findUnique({ where: { id } });
    if (!employee) {
      throw new NotFoundException('Employee not found');
    }
    return employee;
  }

  private handlePrismaError(error: unknown): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      const target = Array.isArray(error.meta?.target)
        ? error.meta.target.join(',')
        : String(error.meta?.target ?? '');
      if (target.includes('cnic')) {
        throw new ConflictException('An employee with this CNIC already exists');
      }
      if (target.includes('employeeCode')) {
        throw new ConflictException('Employee code conflict. Please retry.');
      }
      throw new ConflictException('Employee conflicts with an existing record');
    }
    throw error;
  }
}
