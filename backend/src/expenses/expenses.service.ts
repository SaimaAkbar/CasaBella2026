import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ExpensePaymentStatus,
  ExpenseScope,
  Prisma,
  Role,
} from '../../generated/prisma/client';
import type { AuthUser } from '../common/types/auth-user.type';
import { ExpenseCategoriesService } from '../expense-categories/expense-categories.service';
import { PrismaService } from '../prisma/prisma.service';
import { ReceiptNumberService } from '../receipts/receipt-number.service';
import { CreateExpenseDto } from './dto/create-expense.dto';
import {
  PropertyMonthViewQueryDto,
  type UnitMonthStatus,
} from './dto/property-month-view.dto';
import { QueryExpensesDto } from './dto/query-expenses.dto';
import {
  BulkCreateExpensesDto,
  MonthlySummaryQueryDto,
  RecordExpensePaymentDto,
} from './dto/record-payment.dto';
import { UpdateExpenseDto } from './dto/update-expense.dto';
import {
  EXPENSE_TAB_CATEGORIES,
  RECEPTIONIST_ALLOWED_CATEGORIES,
  calculateExpenseTotals,
  deriveExpensePaymentStatus,
  monthPeriodLabel,
  serializeMoney,
} from './expense.finance';
import { mapExpenseForRole } from './expenses.mapper';

const expenseInclude = {
  category: { select: { id: true, name: true, isSystem: true } },
  property: { select: { id: true, name: true } },
  unit: { select: { id: true, unitNumber: true, propertyId: true } },
  booking: {
    select: {
      id: true,
      bookingNumber: true,
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
    select: {
      id: true,
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
  electricityReading: true,
} satisfies Prisma.ExpenseInclude;

@Injectable()
export class ExpensesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly categoriesService: ExpenseCategoriesService,
    private readonly receiptNumbers: ReceiptNumberService,
  ) {}

  async create(dto: CreateExpenseDto, role: Role, userId: string) {
    this.assertCanCreate(role);
    if (!dto.categoryId) {
      throw new BadRequestException('categoryId is required');
    }
    const category = await this.categoriesService.ensureActive(dto.categoryId);

    if (role === Role.RECEPTIONIST) {
      if (!RECEPTIONIST_ALLOWED_CATEGORIES.has(category.name)) {
        throw new ForbiddenException(
          'Receptionist may only create Cleaning or Laundry operational expenses',
        );
      }
    }

    if (
      dto.expenseScope === ExpenseScope.EMPLOYEE ||
      dto.expenseScope === ExpenseScope.OWNER
    ) {
      throw new BadRequestException(
        'EMPLOYEE and OWNER expense scopes are not implemented yet',
      );
    }

    const refs = await this.resolveScopeRefs(dto);
    const threshold = await this.getApprovalThreshold();
    const needsApproval =
      role !== Role.SUPER_ADMIN &&
      new Prisma.Decimal(dto.amount).greaterThan(threshold);

    const totals = calculateExpenseTotals(dto.amount, dto.paidAmount, {
      allowOverpay: role === Role.SUPER_ADMIN,
    });

    const metadata = this.buildMetadata(dto);

    const expense = await this.prisma.$transaction(async (tx) => {
      const expenseNumber = await this.nextExpenseNumber(tx);
      return tx.expense.create({
        data: {
          expenseNumber,
          categoryId: category.id,
          expenseScope: dto.expenseScope,
          propertyId: refs.propertyId,
          unitId: refs.unitId,
          bookingId: refs.bookingId,
          monthlyTenancyId: refs.monthlyTenancyId,
          expenseDate: new Date(dto.expenseDate),
          ...totals,
          paymentMethod: dto.paymentMethod,
          vendorName: dto.vendorName?.trim(),
          referenceNumber: dto.referenceNumber?.trim(),
          description: dto.description?.trim(),
          receiptUrl: dto.receiptUrl?.trim(),
          metadata: metadata ?? undefined,
          createdByUserId: userId,
          approvedByUserId: needsApproval ? null : userId,
          approvedAt: needsApproval ? null : new Date(),
          isFinalized: false,
          isActive: true,
        },
        include: expenseInclude,
      });
    });

    return mapExpenseForRole(expense, role);
  }

  async findAll(query: QueryExpensesDto, role: Role) {
    const where = this.buildWhere(query, role);
    const expenses = await this.prisma.expense.findMany({
      where,
      include: expenseInclude,
      orderBy: { expenseDate: 'desc' },
    });
    return expenses.map((expense) => mapExpenseForRole(expense, role));
  }

  async getSummary(query: QueryExpensesDto, role: Role) {
    if (role === Role.RECEPTIONIST) {
      return {
        totalExpensesToday: '0',
        totalExpensesThisMonth: '0',
        unpaidExpenses: '0',
        paidExpenses: '0',
      };
    }

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

    const activeWhere: Prisma.ExpenseWhereInput = {
      ...where,
      isActive: true,
    };

    const [
      todayAgg,
      monthAgg,
      rentAgg,
      electricityAgg,
      maintenanceAgg,
      cleaningAgg,
      laundryAgg,
      unpaidAgg,
      paidAgg,
    ] = await Promise.all([
      this.prisma.expense.aggregate({
        where: {
          isActive: true,
          expenseDate: { gte: startOfDay, lte: endOfDay },
        },
        _sum: { amount: true },
      }),
      this.prisma.expense.aggregate({
        where: {
          isActive: true,
          expenseDate: { gte: startOfMonth, lte: endOfMonth },
        },
        _sum: { amount: true },
      }),
      this.sumByCategoryName(activeWhere, 'Rent'),
      this.sumByCategoryName(activeWhere, 'Electricity'),
      this.sumByCategoryName(activeWhere, 'Maintenance'),
      this.sumByCategoryName(activeWhere, 'Cleaning'),
      this.sumByCategoryName(activeWhere, 'Laundry'),
      this.prisma.expense.aggregate({
        where: {
          ...activeWhere,
          paymentStatus: {
            in: [ExpensePaymentStatus.UNPAID, ExpensePaymentStatus.PARTIAL],
          },
        },
        _sum: { remainingAmount: true },
      }),
      this.prisma.expense.aggregate({
        where: {
          ...activeWhere,
          paymentStatus: ExpensePaymentStatus.PAID,
        },
        _sum: { amount: true },
      }),
    ]);

    const cleaningLaundry = new Prisma.Decimal(cleaningAgg)
      .plus(laundryAgg)
      .toString();

    return {
      totalExpensesToday: serializeMoney(todayAgg._sum.amount),
      totalExpensesThisMonth: serializeMoney(monthAgg._sum.amount),
      rent: rentAgg,
      electricity: electricityAgg,
      maintenance: maintenanceAgg,
      cleaningAndLaundry: cleaningLaundry,
      unpaidExpenses: serializeMoney(unpaidAgg._sum.remainingAmount),
      paidExpenses: serializeMoney(paidAgg._sum.amount),
    };
  }

  async findOne(id: string, role: Role) {
    const expense = await this.getOrThrow(id);
    if (role === Role.RECEPTIONIST) {
      const name = expense.category?.name;
      if (!name || !RECEPTIONIST_ALLOWED_CATEGORIES.has(name)) {
        throw new ForbiddenException(
          'Receptionist can only view cleaning/laundry operational expenses',
        );
      }
    }
    return mapExpenseForRole(expense, role);
  }

  async update(
    id: string,
    dto: UpdateExpenseDto,
    userOrRole: AuthUser | Role,
    _opts?: unknown,
  ) {
    const role =
      typeof userOrRole === 'object' && userOrRole
        ? userOrRole.role
        : userOrRole;
    if (role === Role.RECEPTIONIST) {
      throw new ForbiddenException('Receptionist cannot edit expenses');
    }

    const existing = await this.getOrThrow(id);

    if (!existing.isActive) {
      throw new BadRequestException('Cannot edit an archived expense');
    }

    if (existing.isFinalized && role !== Role.SUPER_ADMIN) {
      throw new ForbiddenException(
        'Finalized expense edits require Super Admin or a future approval workflow',
      );
    }

    if (dto.categoryId) {
      await this.categoriesService.ensureActive(dto.categoryId);
    }

    const scope = dto.expenseScope ?? existing.expenseScope;
    const refs = await this.resolveScopeRefs({
      expenseScope: scope,
      propertyId: dto.propertyId ?? existing.propertyId ?? undefined,
      unitId: dto.unitId ?? existing.unitId ?? undefined,
      bookingId: dto.bookingId ?? existing.bookingId ?? undefined,
      monthlyTenancyId:
        dto.monthlyTenancyId ?? existing.monthlyTenancyId ?? undefined,
    });

    const totals = calculateExpenseTotals(
      dto.amount ?? Number(existing.amount.toString()),
      dto.paidAmount ?? Number(existing.paidAmount.toString()),
      { allowOverpay: role === Role.SUPER_ADMIN },
    );

    const metadata =
      dto.metadata || dto.billingMonth || dto.billingYear
        ? this.buildMetadata({
            ...dto,
            metadata: {
              ...((existing.metadata as Record<string, unknown>) ?? {}),
              ...(dto.metadata ?? {}),
            },
          })
        : undefined;

    const expense = await this.prisma.expense.update({
      where: { id },
      data: {
        categoryId: dto.categoryId,
        expenseScope: scope,
        propertyId: refs.propertyId,
        unitId: refs.unitId,
        bookingId: refs.bookingId,
        monthlyTenancyId: refs.monthlyTenancyId,
        expenseDate: dto.expenseDate
          ? new Date(dto.expenseDate)
          : undefined,
        ...totals,
        paymentMethod: dto.paymentMethod,
        vendorName: dto.vendorName?.trim(),
        referenceNumber: dto.referenceNumber?.trim(),
        description: dto.description?.trim(),
        receiptUrl: dto.receiptUrl?.trim(),
        metadata:
          metadata === undefined
            ? undefined
            : metadata === null
              ? Prisma.DbNull
              : metadata,
      },
      include: expenseInclude,
    });

    return mapExpenseForRole(expense, role);
  }

  async archive(
    id: string,
    userOrRole: AuthUser | Role,
    _opts?: unknown,
  ) {
    const role =
      typeof userOrRole === 'object' && userOrRole
        ? userOrRole.role
        : userOrRole;
    if (role !== Role.SUPER_ADMIN) {
      throw new ForbiddenException('Only Super Admin can archive expenses');
    }

    const existing = await this.getOrThrow(id);
    if (!existing.isActive) {
      throw new BadRequestException('Expense is already archived');
    }

    const expense = await this.prisma.expense.update({
      where: { id },
      data: { isActive: false },
      include: expenseInclude,
    });

    return mapExpenseForRole(expense, role);
  }

  async finalize(id: string, role: Role, userId: string) {
    if (role !== Role.SUPER_ADMIN && role !== Role.ADMIN) {
      throw new ForbiddenException('Insufficient permissions to finalize');
    }

    const existing = await this.getOrThrow(id);
    if (!existing.isActive) {
      throw new BadRequestException('Cannot finalize an archived expense');
    }
    if (existing.isFinalized) {
      throw new BadRequestException('Expense is already finalized');
    }

    const expense = await this.prisma.expense.update({
      where: { id },
      data: {
        isFinalized: true,
        approvedByUserId: userId,
        approvedAt: new Date(),
      },
      include: expenseInclude,
    });

    return mapExpenseForRole(expense, role);
  }

  async markPaid(id: string, role: Role) {
    if (role === Role.RECEPTIONIST) {
      throw new ForbiddenException('Receptionist cannot mark expenses paid');
    }

    const existing = await this.getOrThrow(id);
    if (!existing.isActive) {
      throw new BadRequestException('Cannot update an archived expense');
    }
    if (existing.isFinalized && role !== Role.SUPER_ADMIN) {
      throw new ForbiddenException(
        'Finalized expense payment changes require Super Admin or a future approval workflow',
      );
    }

    const expense = await this.prisma.expense.update({
      where: { id },
      data: {
        paidAmount: existing.amount,
        remainingAmount: new Prisma.Decimal(0),
        paymentStatus: ExpensePaymentStatus.PAID,
      },
      include: expenseInclude,
    });

    return mapExpenseForRole(expense, role);
  }

  /** Used by electricity module inside a transaction */
  async createLinkedElectricityExpense(
    tx: Prisma.TransactionClient,
    input: {
      amount: Prisma.Decimal;
      propertyId: string;
      unitId?: string | null;
      expenseDate: Date;
      userId: string;
      description: string;
      billingMonth?: number;
      billingYear?: number;
      dueDate?: Date | null;
      metadata?: Prisma.InputJsonValue;
    },
  ) {
    const electricity = await tx.expenseCategory.findUnique({
      where: { name: 'Electricity' },
    });
    if (!electricity) {
      throw new NotFoundException('Electricity expense category is not seeded');
    }

    const expenseNumber = await this.nextExpenseNumber(tx);
    return tx.expense.create({
      data: {
        expenseNumber,
        categoryId: electricity.id,
        expenseScope: input.unitId
          ? ExpenseScope.UNIT
          : ExpenseScope.PROPERTY,
        propertyId: input.propertyId,
        unitId: input.unitId ?? undefined,
        expenseDate: input.expenseDate,
        amount: input.amount,
        paidAmount: new Prisma.Decimal(0),
        remainingAmount: input.amount,
        paymentStatus: ExpensePaymentStatus.UNPAID,
        description: input.description,
        metadata: input.metadata,
        createdByUserId: input.userId,
        approvedByUserId: input.userId,
        approvedAt: new Date(),
      },
    });
  }

  async recordPayment(
    id: string,
    dto: RecordExpensePaymentDto,
    user: AuthUser,
  ) {
    if (user.role === Role.RECEPTIONIST) {
      throw new ForbiddenException('Receptionist cannot record expense payments');
    }
    const existing = await this.getOrThrow(id);
    if (!existing.isActive) {
      throw new BadRequestException('Cannot pay an archived expense');
    }
    const amountPaid = new Prisma.Decimal(dto.amountPaid);
    if (amountPaid.lessThanOrEqualTo(0)) {
      throw new BadRequestException('amountPaid must be greater than zero');
    }
    if (
      amountPaid.greaterThan(existing.remainingAmount) &&
      user.role !== Role.SUPER_ADMIN
    ) {
      throw new BadRequestException('Payment exceeds remaining amount');
    }
    const newPaid = existing.paidAmount.plus(amountPaid);
    const cappedPaid = newPaid.greaterThan(existing.amount)
      ? existing.amount
      : newPaid;
    const remainingAmount = existing.amount.minus(cappedPaid);
    const paymentStatus = deriveExpensePaymentStatus(
      existing.amount,
      cappedPaid,
      existing.dueDate,
    );
    const expense = await this.prisma.$transaction(async (tx) => {
      const receiptNumber = await this.receiptNumbers.nextReceiptNumber(tx);
      const expensePayment = await tx.expensePayment.create({
        data: {
          expenseId: id,
          amount: amountPaid,
          paymentDate: new Date(dto.paymentDate),
          paymentMethod: dto.paymentMethod,
          bankName: dto.bankName?.trim(),
          transactionReference: dto.transactionReference?.trim(),
          notes: dto.notes?.trim(),
          receiptNumber,
          createdByUserId: user.id,
        },
      });
      const updated = await tx.expense.update({
        where: { id },
        data: {
          paidAmount: cappedPaid,
          remainingAmount,
          paymentStatus,
          paymentMethod: dto.paymentMethod,
          paymentDate: new Date(dto.paymentDate),
        },
        include: expenseInclude,
      });
      return { expense: updated, expensePaymentId: expensePayment.id };
    });
    return {
      ...mapExpenseForRole(expense.expense, user.role),
      expensePaymentId: expense.expensePaymentId,
    };
  }

  async bulkCreate(dto: BulkCreateExpensesDto, user: AuthUser) {
    this.assertCanCreate(user.role);
    const created: unknown[] = [];
    for (const unitId of dto.unitIds) {
      created.push(
        await this.create(
          {
            ...dto,
            unitId,
            expenseScope: ExpenseScope.UNIT,
          } as CreateExpenseDto,
          user.role,
          user.id,
        ),
      );
    }
    return created;
  }

  async getMonthlySummary(query: MonthlySummaryQueryDto, role: Role) {
    if (role === Role.RECEPTIONIST) {
      throw new ForbiddenException(
        'Receptionist cannot view expense monthly summary',
      );
    }

    if (query.propertyId) {
      const view = await this.getPropertyMonthView(
        {
          propertyId: query.propertyId,
          month: query.month,
          year: query.year,
        },
        role,
      );
      const categories = {
        electricity: '0.00',
        maintenance: '0.00',
        society: '0.00',
        water: '0.00',
        internet: '0.00',
        cleaning: '0.00',
        liftBill: '0.00',
        liftMaintenance: '0.00',
        other: '0.00',
      };
      for (const unit of view.units) {
        (Object.keys(categories) as Array<keyof typeof categories>).forEach(
          (key) => {
            categories[key] = (
              Number(categories[key]) + Number(unit.expenses[key] || 0)
            ).toFixed(2);
          },
        );
      }
      return {
        period: view.period,
        totals: {
          totalExpenses: view.summary.totalExpenses,
          paidAmount: view.summary.paid,
          outstanding: view.summary.remaining,
          overdueAmount: view.summary.overdue,
          totalUnits: view.summary.totalUnits,
        },
        categories,
      };
    }

    await this.refreshOverdueForPeriod(query.month, query.year);

    const [totalUnits, expenses] = await Promise.all([
      this.prisma.unit.count({ where: { isActive: true } }),
      this.prisma.expense.findMany({
        where: this.periodExpenseWhere(query.month, query.year),
        select: {
          amount: true,
          paidAmount: true,
          remainingAmount: true,
          paymentStatus: true,
          dueDate: true,
          category: { select: { name: true } },
        },
      }),
    ]);

    let total = new Prisma.Decimal(0);
    let paid = new Prisma.Decimal(0);
    let remaining = new Prisma.Decimal(0);
    let overdue = new Prisma.Decimal(0);
    const cats = {
      electricity: new Prisma.Decimal(0),
      maintenance: new Prisma.Decimal(0),
      society: new Prisma.Decimal(0),
      water: new Prisma.Decimal(0),
      internet: new Prisma.Decimal(0),
      cleaning: new Prisma.Decimal(0),
      liftBill: new Prisma.Decimal(0),
      liftMaintenance: new Prisma.Decimal(0),
      other: new Prisma.Decimal(0),
    };
    const now = new Date();
    for (const expense of expenses) {
      total = total.plus(expense.amount);
      paid = paid.plus(expense.paidAmount);
      remaining = remaining.plus(expense.remainingAmount);
      const isOverdue =
        expense.paymentStatus === ExpensePaymentStatus.OVERDUE ||
        (expense.remainingAmount.greaterThan(0) &&
          expense.dueDate != null &&
          expense.dueDate < now);
      if (isOverdue) overdue = overdue.plus(expense.remainingAmount);
      const key = this.categorySummaryKey(expense.category.name);
      cats[key] = cats[key].plus(expense.amount);
    }

    return {
      period: {
        month: query.month,
        year: query.year,
        label: monthPeriodLabel(query.month, query.year),
      },
      totals: {
        totalExpenses: serializeMoney(total),
        paidAmount: serializeMoney(paid),
        outstanding: serializeMoney(remaining),
        overdueAmount: serializeMoney(overdue),
        totalUnits,
      },
      categories: {
        electricity: serializeMoney(cats.electricity),
        maintenance: serializeMoney(cats.maintenance),
        society: serializeMoney(cats.society),
        water: serializeMoney(cats.water),
        internet: serializeMoney(cats.internet),
        cleaning: serializeMoney(cats.cleaning),
        liftBill: serializeMoney(cats.liftBill),
        liftMaintenance: serializeMoney(cats.liftMaintenance),
        other: serializeMoney(cats.other),
      },
    };
  }

  /**
   * Property → active Units (master) LEFT-aggregated with period expenses.
   * Units with no expenses still appear (NO_CHARGE / Reading Required).
   */
  async getPropertyMonthView(query: PropertyMonthViewQueryDto, role: Role) {
    if (role === Role.RECEPTIONIST) {
      throw new ForbiddenException(
        'Receptionist cannot view property expense month view',
      );
    }

    const property = await this.prisma.property.findUnique({
      where: { id: query.propertyId },
      select: { id: true, name: true, isActive: true },
    });
    if (!property) {
      throw new NotFoundException('Property not found');
    }

    await this.refreshOverdueForPeriod(
      query.month,
      query.year,
      query.propertyId,
    );

    const units = await this.prisma.unit.findMany({
      where: { propertyId: query.propertyId, isActive: true },
      select: {
        id: true,
        unitNumber: true,
        unitType: true,
        floor: true,
      },
    });
    units.sort((a, b) =>
      a.unitNumber.localeCompare(b.unitNumber, undefined, { numeric: true }),
    );

    const [expenses, readings] = await Promise.all([
      this.prisma.expense.findMany({
        where: this.periodExpenseWhere(
          query.month,
          query.year,
          query.propertyId,
        ),
        select: {
          id: true,
          unitId: true,
          amount: true,
          paidAmount: true,
          remainingAmount: true,
          paymentStatus: true,
          dueDate: true,
          expenseName: true,
          description: true,
          category: { select: { name: true } },
        },
      }),
      this.prisma.electricityReading.findMany({
        where: {
          propertyId: query.propertyId,
          billingMonth: query.month,
          billingYear: query.year,
          unitId: { not: null },
        },
        select: {
          id: true,
          unitId: true,
          currentUnits: true,
          expenseId: true,
        },
      }),
    ]);

    type CatKey = keyof typeof EXPENSE_TAB_CATEGORIES;
    const emptyCats = (): Record<CatKey, Prisma.Decimal> => ({
      electricity: new Prisma.Decimal(0),
      maintenance: new Prisma.Decimal(0),
      society: new Prisma.Decimal(0),
      water: new Prisma.Decimal(0),
      internet: new Prisma.Decimal(0),
      cleaning: new Prisma.Decimal(0),
      liftBill: new Prisma.Decimal(0),
      liftMaintenance: new Prisma.Decimal(0),
      other: new Prisma.Decimal(0),
    });

    const byUnit = new Map<
      string,
      {
        cats: Record<CatKey, Prisma.Decimal>;
        paid: Prisma.Decimal;
        remaining: Prisma.Decimal;
        hasOverdue: boolean;
        expenseNames: string[];
      }
    >();

    for (const unit of units) {
      byUnit.set(unit.id, {
        cats: emptyCats(),
        paid: new Prisma.Decimal(0),
        remaining: new Prisma.Decimal(0),
        hasOverdue: false,
        expenseNames: [],
      });
    }

    let propertyTotal = new Prisma.Decimal(0);
    let propertyPaid = new Prisma.Decimal(0);
    let propertyRemaining = new Prisma.Decimal(0);
    let propertyOverdue = new Prisma.Decimal(0);

    const now = new Date();
    for (const expense of expenses) {
      propertyTotal = propertyTotal.plus(expense.amount);
      propertyPaid = propertyPaid.plus(expense.paidAmount);
      propertyRemaining = propertyRemaining.plus(expense.remainingAmount);
      const isOverdue =
        expense.paymentStatus === ExpensePaymentStatus.OVERDUE ||
        (expense.remainingAmount.greaterThan(0) &&
          expense.dueDate != null &&
          expense.dueDate < now);
      if (isOverdue) {
        propertyOverdue = propertyOverdue.plus(expense.remainingAmount);
      }

      if (!expense.unitId) continue;
      const bucket = byUnit.get(expense.unitId);
      if (!bucket) continue;

      const key = this.categorySummaryKey(expense.category.name);
      bucket.cats[key] = bucket.cats[key].plus(expense.amount);
      bucket.paid = bucket.paid.plus(expense.paidAmount);
      bucket.remaining = bucket.remaining.plus(expense.remainingAmount);
      if (isOverdue) bucket.hasOverdue = true;
      if (expense.expenseName) bucket.expenseNames.push(expense.expenseName);
      if (expense.description) bucket.expenseNames.push(expense.description);
      bucket.expenseNames.push(expense.category.name);
    }

    const readingByUnit = new Map<
      string,
      { id: string; currentUnits: Prisma.Decimal | null; expenseId: string | null }
    >();
    for (const reading of readings) {
      if (!reading.unitId) continue;
      readingByUnit.set(reading.unitId, {
        id: reading.id,
        currentUnits: reading.currentUnits,
        expenseId: reading.expenseId,
      });
    }

    const search = query.search?.trim().toLowerCase() ?? '';
    const statusFilter = query.status;

    const unitRows = units
      .map((unit) => {
        const bucket = byUnit.get(unit.id)!;
        const totalExpense = Object.values(bucket.cats).reduce(
          (sum, value) => sum.plus(value),
          new Prisma.Decimal(0),
        );
        const reading = readingByUnit.get(unit.id);
        const electricityReadingRequired =
          !reading || reading.currentUnits == null;

        const status = this.deriveUnitMonthStatus(
          totalExpense,
          bucket.paid,
          bucket.remaining,
          bucket.hasOverdue,
        );

        return {
          unitId: unit.id,
          unitNumber: unit.unitNumber,
          unitType: unit.unitType,
          floor: unit.floor != null ? String(unit.floor) : null,
          expenses: {
            electricity: serializeMoney(bucket.cats.electricity),
            maintenance: serializeMoney(bucket.cats.maintenance),
            society: serializeMoney(bucket.cats.society),
            water: serializeMoney(bucket.cats.water),
            internet: serializeMoney(bucket.cats.internet),
            cleaning: serializeMoney(bucket.cats.cleaning),
            liftBill: serializeMoney(bucket.cats.liftBill),
            liftMaintenance: serializeMoney(bucket.cats.liftMaintenance),
            other: serializeMoney(bucket.cats.other),
          },
          totalExpense: serializeMoney(totalExpense),
          paid: serializeMoney(bucket.paid),
          remaining: serializeMoney(bucket.remaining),
          status,
          electricityReadingRequired,
          electricityReadingId: reading?.id ?? null,
          _searchHaystack: [
            unit.unitNumber,
            unit.floor != null ? String(unit.floor) : '',
            ...bucket.expenseNames,
          ]
            .join(' ')
            .toLowerCase(),
        };
      })
      .filter((row) => {
        if (statusFilter && row.status !== statusFilter) return false;
        if (search && !row._searchHaystack.includes(search)) return false;
        return true;
      })
      .map(({ _searchHaystack: _, ...row }) => row);

    return {
      property: { id: property.id, name: property.name },
      period: {
        month: query.month,
        year: query.year,
        label: monthPeriodLabel(query.month, query.year),
      },
      summary: {
        totalUnits: units.length,
        totalExpenses: serializeMoney(propertyTotal),
        paid: serializeMoney(propertyPaid),
        remaining: serializeMoney(propertyRemaining),
        overdue: serializeMoney(propertyOverdue),
      },
      units: unitRows,
    };
  }

  /** Used by inventory module inside a transaction */
  async createLinkedInventoryExpense(
    tx: Prisma.TransactionClient,
    input: {
      amount: Prisma.Decimal;
      expenseDate: Date;
      userId: string;
      description: string;
      categoryName?: 'Inventory' | 'Repair';
      propertyId?: string | null;
      unitId?: string | null;
      bookingId?: string | null;
      monthlyTenancyId?: string | null;
      employeeId?: string | null;
      vendorName?: string;
      referenceNumber?: string;
      metadata?: Prisma.InputJsonValue;
      markPaid?: boolean;
    },
  ) {
    const categoryName = input.categoryName ?? 'Inventory';
    const category = await tx.expenseCategory.findUnique({
      where: { name: categoryName },
    });
    if (!category) {
      throw new NotFoundException(
        `${categoryName} expense category is not seeded`,
      );
    }

    let expenseScope: ExpenseScope = ExpenseScope.GENERAL;
    if (input.unitId && input.propertyId) expenseScope = ExpenseScope.UNIT;
    else if (input.propertyId) expenseScope = ExpenseScope.PROPERTY;
    else if (input.bookingId) expenseScope = ExpenseScope.BOOKING;
    else if (input.monthlyTenancyId) expenseScope = ExpenseScope.MONTHLY_TENANCY;
    else if (input.employeeId) expenseScope = ExpenseScope.EMPLOYEE;

    const expenseNumber = await this.nextExpenseNumber(tx);
    const paidAmount = input.markPaid
      ? input.amount
      : new Prisma.Decimal(0);

    return tx.expense.create({
      data: {
        expenseNumber,
        categoryId: category.id,
        expenseScope,
        propertyId: input.propertyId ?? undefined,
        unitId: input.unitId ?? undefined,
        bookingId: input.bookingId ?? undefined,
        monthlyTenancyId: input.monthlyTenancyId ?? undefined,
        employeeId: input.employeeId ?? undefined,
        expenseDate: input.expenseDate,
        amount: input.amount,
        paidAmount,
        remainingAmount: input.amount.minus(paidAmount),
        paymentStatus: input.markPaid
          ? ExpensePaymentStatus.PAID
          : ExpensePaymentStatus.UNPAID,
        vendorName: input.vendorName,
        referenceNumber: input.referenceNumber,
        description: input.description,
        metadata: input.metadata,
        createdByUserId: input.userId,
        approvedByUserId: input.userId,
        approvedAt: new Date(),
      },
    });
  }

  /** Used by salary module inside a transaction */
  async createLinkedSalaryExpense(
    tx: Prisma.TransactionClient,
    input: {
      amount: Prisma.Decimal;
      employeeId: string;
      expenseDate: Date;
      userId: string;
      description: string;
      vendorName?: string;
      paymentMethod?: Prisma.ExpenseCreateInput['paymentMethod'];
      referenceNumber?: string;
      metadata?: Prisma.InputJsonValue;
      markPaid?: boolean;
    },
  ) {
    const salary = await tx.expenseCategory.findUnique({
      where: { name: 'Salary' },
    });
    if (!salary) {
      throw new NotFoundException('Salary expense category is not seeded');
    }

    const expenseNumber = await this.nextExpenseNumber(tx);
    const paidAmount = input.markPaid
      ? input.amount
      : new Prisma.Decimal(0);
    const remainingAmount = input.amount.minus(paidAmount);

    return tx.expense.create({
      data: {
        expenseNumber,
        categoryId: salary.id,
        expenseScope: ExpenseScope.EMPLOYEE,
        employeeId: input.employeeId,
        expenseDate: input.expenseDate,
        amount: input.amount,
        paidAmount,
        remainingAmount,
        paymentStatus: input.markPaid
          ? ExpensePaymentStatus.PAID
          : ExpensePaymentStatus.UNPAID,
        paymentMethod: input.paymentMethod,
        vendorName: input.vendorName,
        referenceNumber: input.referenceNumber,
        description: input.description,
        metadata: input.metadata,
        createdByUserId: input.userId,
        approvedByUserId: input.userId,
        approvedAt: new Date(),
      },
    });
  }

  private async sumByCategoryName(
    where: Prisma.ExpenseWhereInput,
    name: string,
  ) {
    const agg = await this.prisma.expense.aggregate({
      where: {
        ...where,
        category: { name },
      },
      _sum: { amount: true },
    });
    return serializeMoney(agg._sum.amount);
  }

  private async resolveScopeRefs(dto: {
    expenseScope: ExpenseScope;
    propertyId?: string | null;
    unitId?: string | null;
    bookingId?: string | null;
    monthlyTenancyId?: string | null;
  }) {
    switch (dto.expenseScope) {
      case ExpenseScope.GENERAL:
        return {
          propertyId: null as string | null,
          unitId: null as string | null,
          bookingId: null as string | null,
          monthlyTenancyId: null as string | null,
        };

      case ExpenseScope.PROPERTY: {
        if (!dto.propertyId) {
          throw new BadRequestException('propertyId is required for PROPERTY scope');
        }
        const property = await this.prisma.property.findUnique({
          where: { id: dto.propertyId },
        });
        if (!property || !property.isActive) {
          throw new NotFoundException('Property not found');
        }
        return {
          propertyId: property.id,
          unitId: null,
          bookingId: null,
          monthlyTenancyId: null,
        };
      }

      case ExpenseScope.UNIT: {
        if (!dto.propertyId || !dto.unitId) {
          throw new BadRequestException(
            'propertyId and unitId are required for UNIT scope',
          );
        }
        const unit = await this.prisma.unit.findUnique({
          where: { id: dto.unitId },
          include: { property: true },
        });
        if (!unit || !unit.isActive || !unit.property.isActive) {
          throw new NotFoundException('Unit not found');
        }
        if (unit.propertyId !== dto.propertyId) {
          throw new BadRequestException('Unit does not belong to the selected property');
        }
        return {
          propertyId: unit.propertyId,
          unitId: unit.id,
          bookingId: null,
          monthlyTenancyId: null,
        };
      }

      case ExpenseScope.BOOKING: {
        if (!dto.bookingId) {
          throw new BadRequestException('bookingId is required for BOOKING scope');
        }
        const booking = await this.prisma.booking.findUnique({
          where: { id: dto.bookingId },
          include: { unit: true },
        });
        if (!booking) {
          throw new NotFoundException('Booking not found');
        }
        return {
          propertyId: booking.unit.propertyId,
          unitId: booking.unitId,
          bookingId: booking.id,
          monthlyTenancyId: null,
        };
      }

      case ExpenseScope.MONTHLY_TENANCY: {
        if (!dto.monthlyTenancyId) {
          throw new BadRequestException(
            'monthlyTenancyId is required for MONTHLY_TENANCY scope',
          );
        }
        const tenancy = await this.prisma.monthlyTenancy.findUnique({
          where: { id: dto.monthlyTenancyId },
          include: { unit: true },
        });
        if (!tenancy) {
          throw new NotFoundException('Monthly tenancy not found');
        }
        return {
          propertyId: tenancy.unit.propertyId,
          unitId: tenancy.unitId,
          bookingId: null,
          monthlyTenancyId: tenancy.id,
        };
      }

      default:
        throw new BadRequestException('Unsupported expense scope');
    }
  }

  private buildMetadata(dto: {
    metadata?: CreateExpenseDto['metadata'];
    billingMonth?: number;
    billingYear?: number;
  }): Prisma.InputJsonValue | null {
    const meta = {
      ...(dto.metadata ?? {}),
      ...(dto.billingMonth !== undefined
        ? { billingMonth: dto.billingMonth }
        : {}),
      ...(dto.billingYear !== undefined
        ? { billingYear: dto.billingYear }
        : {}),
    };
    return Object.keys(meta).length ? meta : null;
  }

  private async nextExpenseNumber(tx: Prisma.TransactionClient) {
    const now = new Date();
    const yyyy = now.getUTCFullYear();
    const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(now.getUTCDate()).padStart(2, '0');
    const dateKey = `${yyyy}${mm}${dd}`;
    const settingKey = `expense_seq_${dateKey}`;

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
    return `EXP-${dateKey}-${seq}`;
  }

  private async getApprovalThreshold() {
    const setting = await this.prisma.systemSetting.findUnique({
      where: { key: 'expense_approval_threshold' },
    });
    return new Prisma.Decimal(setting?.value ?? '50000');
  }

  private periodExpenseWhere(
    month: number,
    year: number,
    propertyId?: string,
  ): Prisma.ExpenseWhereInput {
    return {
      isActive: true,
      excludeFromFinancials: false,
      ...(propertyId ? { propertyId } : {}),
      OR: [
        { billingMonth: month, billingYear: year },
        {
          billingMonth: null,
          expenseDate: {
            gte: new Date(Date.UTC(year, month - 1, 1)),
            lte: new Date(Date.UTC(year, month, 0, 23, 59, 59, 999)),
          },
        },
        {
          electricityReading: {
            billingMonth: month,
            billingYear: year,
          },
        },
      ],
    };
  }

  private async refreshOverdueForPeriod(
    month: number,
    year: number,
    propertyId?: string,
  ) {
    const now = new Date();
    await this.prisma.expense.updateMany({
      where: {
        isActive: true,
        remainingAmount: { gt: 0 },
        dueDate: { lt: now },
        paymentStatus: {
          in: [ExpensePaymentStatus.UNPAID, ExpensePaymentStatus.PARTIAL],
        },
        ...(propertyId ? { propertyId } : {}),
        OR: [
          { billingMonth: month, billingYear: year },
          {
            billingMonth: null,
            expenseDate: {
              gte: new Date(Date.UTC(year, month - 1, 1)),
              lte: new Date(Date.UTC(year, month, 0, 23, 59, 59, 999)),
            },
          },
        ],
      },
      data: { paymentStatus: ExpensePaymentStatus.OVERDUE },
    });
  }

  private deriveUnitMonthStatus(
    totalExpense: Prisma.Decimal,
    paid: Prisma.Decimal,
    remaining: Prisma.Decimal,
    hasOverdue: boolean,
  ): UnitMonthStatus {
    if (totalExpense.equals(0)) return 'NO_CHARGE';
    if (hasOverdue && remaining.greaterThan(0)) return 'OVERDUE';
    if (remaining.equals(0) && totalExpense.greaterThan(0)) return 'PAID';
    if (paid.greaterThan(0) && remaining.greaterThan(0)) return 'PARTIAL';
    return 'UNPAID';
  }

  private categorySummaryKey(
    name: string,
  ): keyof typeof EXPENSE_TAB_CATEGORIES {
    const map: Record<string, keyof typeof EXPENSE_TAB_CATEGORIES> = {
      Electricity: 'electricity',
      Maintenance: 'maintenance',
      'Society Bill': 'society',
      Water: 'water',
      Internet: 'internet',
      Cleaning: 'cleaning',
      'Lift Bill': 'liftBill',
      'Lift Maintenance': 'liftMaintenance',
    };
    return map[name] ?? 'other';
  }

  private assertCanCreate(role: Role) {
    if (
      role !== Role.SUPER_ADMIN &&
      role !== Role.ADMIN &&
      role !== Role.RECEPTIONIST
    ) {
      throw new ForbiddenException('Insufficient permissions');
    }
  }

  private async getOrThrow(id: string) {
    const expense = await this.prisma.expense.findUnique({
      where: { id },
      include: expenseInclude,
    });
    if (!expense) {
      throw new NotFoundException(`Expense with id "${id}" not found`);
    }
    return expense;
  }

  private buildWhere(
    query: QueryExpensesDto,
    role: Role,
  ): Prisma.ExpenseWhereInput {
    const where: Prisma.ExpenseWhereInput = {
      isActive: true,
    };

    if (query.categoryId) where.categoryId = query.categoryId;
    if (query.categoryName) {
      where.category = { name: { equals: query.categoryName, mode: 'insensitive' } };
    }
    if (query.expenseScope) where.expenseScope = query.expenseScope;
    if (query.propertyId) where.propertyId = query.propertyId;
    if (query.unitId) where.unitId = query.unitId;
    if (query.bookingId) where.bookingId = query.bookingId;
    if (query.monthlyTenancyId) where.monthlyTenancyId = query.monthlyTenancyId;
    if (query.paymentStatus) where.paymentStatus = query.paymentStatus;
    if (query.isFinalized !== undefined) where.isFinalized = query.isFinalized;

    if (role === Role.RECEPTIONIST) {
      where.category = {
        name: { in: Array.from(RECEPTIONIST_ALLOWED_CATEGORIES) },
      };
    }

    if (query.today === 'true' || query.today === '1') {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const end = new Date();
      end.setHours(23, 59, 59, 999);
      where.expenseDate = { gte: start, lte: end };
    } else if (query.date) {
      where.expenseDate = {
        gte: new Date(`${query.date}T00:00:00.000Z`),
        lte: new Date(`${query.date}T23:59:59.999Z`),
      };
    } else if (query.startDate || query.endDate) {
      where.expenseDate = {};
      if (query.startDate) {
        where.expenseDate.gte = new Date(`${query.startDate}T00:00:00.000Z`);
      }
      if (query.endDate) {
        where.expenseDate.lte = new Date(`${query.endDate}T23:59:59.999Z`);
      }
    } else if (query.year !== undefined && query.month !== undefined) {
      const start = new Date(Date.UTC(query.year, query.month - 1, 1));
      const end = new Date(
        Date.UTC(query.year, query.month, 0, 23, 59, 59, 999),
      );
      where.expenseDate = { gte: start, lte: end };
    } else if (query.year !== undefined) {
      where.expenseDate = {
        gte: new Date(Date.UTC(query.year, 0, 1)),
        lte: new Date(Date.UTC(query.year, 11, 31, 23, 59, 59, 999)),
      };
    } else if (query.month !== undefined) {
      throw new BadRequestException('year is required when month is provided');
    }

    if (query.search?.trim()) {
      const term = query.search.trim();
      where.OR = [
        { expenseNumber: { contains: term, mode: 'insensitive' } },
        { vendorName: { contains: term, mode: 'insensitive' } },
        { description: { contains: term, mode: 'insensitive' } },
        { category: { name: { contains: term, mode: 'insensitive' } } },
        { property: { name: { contains: term, mode: 'insensitive' } } },
        { unit: { unitNumber: { contains: term, mode: 'insensitive' } } },
      ];
    }

    return where;
  }
}
