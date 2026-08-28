import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ExpensePaymentStatus,
  ExpenseScope,
  PaymentForType,
  Prisma,
  Role,
} from '../../generated/prisma/client';
import { canAccessProfitLossData } from '../common/utils/profit-loss-access';
import { canAccessSalaryData } from '../common/utils/salary-access';
import { PrismaService } from '../prisma/prisma.service';
import {
  bucketExpenseCategory,
  buildResult,
  emptyCategoryBuckets,
  money,
  signedIncomeAmount,
  sumSignedIncome,
  toDecimal,
} from './profit-loss.calculator';
import { resolveReportingPeriod } from './profit-loss.period';
import type {
  AccountingView,
  ExpenseBreakdownRow,
  IncomeBreakdownRow,
  ProfitLossByPropertyRow,
  ProfitLossByUnitRow,
  ProfitLossFilterInput,
  ProfitLossSummary,
  ProfitLossTrendRow,
} from './profit-loss.types';

@Injectable()
export class ProfitLossService {
  constructor(private readonly prisma: PrismaService) {}

  assertAccess(role: Role, canAccessProfitLoss: boolean) {
    if (role === Role.RECEPTIONIST) {
      throw new ForbiddenException('Profit and Loss access is not permitted');
    }
    if (!canAccessProfitLossData(role, canAccessProfitLoss)) {
      throw new ForbiddenException(
        'Profit and Loss access requires Super Admin grant',
      );
    }
  }

  private async assertPropertyUnit(
    propertyId?: string,
    unitId?: string,
  ): Promise<void> {
    if (propertyId) {
      const property = await this.prisma.property.findUnique({
        where: { id: propertyId },
        select: { id: true },
      });
      if (!property) throw new NotFoundException('Property not found');
    }
    if (unitId) {
      const unit = await this.prisma.unit.findUnique({
        where: { id: unitId },
        select: { id: true, propertyId: true },
      });
      if (!unit) throw new NotFoundException('Unit not found');
      if (propertyId && unit.propertyId !== propertyId) {
        throw new BadRequestException(
          'Unit does not belong to the selected property',
        );
      }
    }
  }

  private paymentScopeWhere(
    propertyId?: string,
    unitId?: string,
  ): Prisma.PaymentWhereInput {
    if (unitId) {
      return {
        OR: [
          { booking: { unitId } },
          { monthlyTenancy: { unitId } },
        ],
      };
    }
    if (propertyId) {
      return {
        OR: [
          { booking: { unit: { propertyId } } },
          { monthlyTenancy: { unit: { propertyId } } },
        ],
      };
    }
    return {};
  }

  /**
   * Expense scope policy:
   * - Whole business: include GENERAL + property/unit scoped
   * - Property filter: property-level + unit-level for that property; exclude GENERAL
   * - Unit filter: only unit-linked expenses for that unit
   */
  private expenseScopeWhere(
    propertyId?: string,
    unitId?: string,
  ): Prisma.ExpenseWhereInput {
    if (unitId) {
      return { unitId };
    }
    if (propertyId) {
      return {
        OR: [{ propertyId }, { unit: { propertyId } }],
        NOT: { expenseScope: ExpenseScope.GENERAL },
      };
    }
    return {};
  }

  private async loadIncomeRows(
    range: { gte: Date; lte: Date },
    propertyId?: string,
    unitId?: string,
  ) {
    return this.prisma.payment.findMany({
      where: {
        paymentDate: range,
        paymentForType: {
          in: [
            PaymentForType.BOOKING,
            PaymentForType.MONTHLY_TENANCY,
            PaymentForType.OTHER,
          ],
        },
        status: {
          notIn: ['PENDING', 'CANCELLED'],
        },
        ...this.paymentScopeWhere(propertyId, unitId),
      },
      select: {
        id: true,
        paymentNumber: true,
        paymentForType: true,
        transactionType: true,
        amount: true,
        status: true,
        notes: true,
        paymentDate: true,
        booking: {
          select: {
            guest: { select: { fullName: true } },
            unit: {
              select: {
                unitNumber: true,
                property: { select: { name: true } },
              },
            },
          },
        },
        monthlyTenancy: {
          select: {
            tenant: { select: { fullName: true } },
            unit: {
              select: {
                unitNumber: true,
                property: { select: { name: true } },
              },
            },
          },
        },
      },
    });
  }

  private async loadExpenseRows(
    range: { gte: Date; lte: Date },
    propertyId?: string,
    unitId?: string,
  ) {
    return this.prisma.expense.findMany({
      where: {
        isActive: true,
        expenseDate: range,
        ...this.expenseScopeWhere(propertyId, unitId),
      },
      select: {
        id: true,
        expenseNumber: true,
        expenseDate: true,
        amount: true,
        paidAmount: true,
        remainingAmount: true,
        paymentStatus: true,
        vendorName: true,
        expenseScope: true,
        category: { select: { id: true, name: true } },
        property: { select: { id: true, name: true } },
        unit: {
          select: {
            id: true,
            unitNumber: true,
            propertyId: true,
            property: { select: { name: true } },
          },
        },
        employee: { select: { id: true, fullName: true } },
      },
    });
  }

  async getOutstandingReceivables(propertyId?: string, unitId?: string) {
    return this.loadOutstandingReceivables(propertyId, unitId);
  }

  private async loadOutstandingReceivables(
    propertyId?: string,
    unitId?: string,
  ) {
    const bookingWhere: Prisma.BookingWhereInput = {
      remainingAmount: { gt: 0 },
      bookingStatus: {
        in: ['CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT'],
      },
      ...(unitId
        ? { unitId }
        : propertyId
          ? { unit: { propertyId } }
          : {}),
    };

    const billWhere: Prisma.MonthlyBillWhereInput = {
      remainingBalance: { gt: 0 },
      ...(unitId
        ? { agreement: { assignments: { some: { unitId } } } }
        : propertyId
          ? {
              agreement: {
                assignments: { some: { unit: { propertyId } } },
              },
            }
          : {}),
    };

    const tenancyWhere: Prisma.MonthlyTenancyWhereInput = {
      remainingBalance: { gt: 0 },
      agreement: { bills: { none: {} } },
      ...(unitId
        ? { unitId }
        : propertyId
          ? { unit: { propertyId } }
          : {}),
    };

    const [bookingOutstanding, billOutstanding, tenancyOutstanding] =
      await Promise.all([
        this.prisma.booking.aggregate({
          where: bookingWhere,
          _sum: { remainingAmount: true },
        }),
        this.prisma.monthlyBill.aggregate({
          where: billWhere,
          _sum: { remainingBalance: true },
        }),
        this.prisma.monthlyTenancy.aggregate({
          where: tenancyWhere,
          _sum: { remainingBalance: true },
        }),
      ]);

    const booking = toDecimal(bookingOutstanding._sum.remainingAmount);
    const monthlyBill = toDecimal(billOutstanding._sum.remainingBalance);
    const monthlyTenancy = toDecimal(
      tenancyOutstanding._sum.remainingBalance,
    );

    return {
      booking,
      monthlyBill,
      monthlyTenancy,
      total: booking.plus(monthlyBill).plus(monthlyTenancy),
    };
  }

  private countedExpenseAmount(
    row: { amount: Prisma.Decimal; paidAmount: Prisma.Decimal },
    view: AccountingView,
  ) {
    return view === 'CASH' ? toDecimal(row.paidAmount) : toDecimal(row.amount);
  }

  private splitIncome(rows: Awaited<ReturnType<typeof this.loadIncomeRows>>) {
    let booking = new Prisma.Decimal(0);
    let monthly = new Prisma.Decimal(0);
    let monthlyBill = new Prisma.Decimal(0);
    let other = new Prisma.Decimal(0);

    for (const row of rows) {
      const signed = signedIncomeAmount(row);
      if (row.paymentForType === PaymentForType.BOOKING) {
        booking = booking.plus(signed);
      } else if (row.paymentForType === PaymentForType.MONTHLY_TENANCY) {
        monthly = monthly.plus(signed);
      } else if (row.paymentForType === PaymentForType.MONTHLY_BILL) {
        monthlyBill = monthlyBill.plus(signed);
      } else {
        other = other.plus(signed);
      }
    }

    return {
      bookingIncome: booking,
      monthlyTenancyIncome: monthly,
      monthlyBillIncome: monthlyBill,
      otherIncome: other,
      totalIncome: booking.plus(monthly).plus(monthlyBill).plus(other),
    };
  }

  private splitExpenses(
    rows: Awaited<ReturnType<typeof this.loadExpenseRows>>,
    view: AccountingView,
  ) {
    const buckets = emptyCategoryBuckets();
    let total = new Prisma.Decimal(0);
    let paid = new Prisma.Decimal(0);
    let unpaid = new Prisma.Decimal(0);

    for (const row of rows) {
      const counted = this.countedExpenseAmount(row, view);
      total = total.plus(counted);
      paid = paid.plus(toDecimal(row.paidAmount));
      unpaid = unpaid.plus(toDecimal(row.remainingAmount));
      const key = bucketExpenseCategory(row.category.name);
      buckets[key] = buckets[key].plus(counted);
    }

    return { buckets, total, paid, unpaid };
  }

  async getSummary(
    query: ProfitLossFilterInput,
    role: Role,
    canAccessProfitLoss: boolean,
  ): Promise<ProfitLossSummary> {
    this.assertAccess(role, canAccessProfitLoss);
    await this.assertPropertyUnit(query.propertyId, query.unitId);

    const { period, range } = resolveReportingPeriod(query);
    const scoped = Boolean(query.propertyId || query.unitId);

    const [incomeRows, expenseRows, outstanding] = await Promise.all([
      this.loadIncomeRows(range, query.propertyId, query.unitId),
      this.loadExpenseRows(range, query.propertyId, query.unitId),
      this.loadOutstandingReceivables(query.propertyId, query.unitId),
    ]);

    const income = this.splitIncome(incomeRows);
    const expenses = this.splitExpenses(expenseRows, period.accountingView);
    const result = buildResult(income.totalIncome, expenses.total);

    return {
      period,
      metadata: {
        generalExpensesIncluded: !scoped,
        generalExpensesPolicy:
          'General expenses appear only in whole-business Profit/Loss and are not allocated to properties or units.',
        doubleCountPrevention: [
          'Income uses Payment ledger only (BOOKING + MONTHLY_TENANCY + MONTHLY_BILL + OTHER). OWNER / SALARY / EXPENSE payment types excluded.',
          'Security deposits (notes SECURITY_DEPOSIT) excluded from operating income.',
          'Expenses use Expense ledger only (linked Salary / Electricity / Inventory counted via Expense, not again from SalaryTransaction or ElectricityReading).',
          'Allocation parents (excludeFromFinancials) excluded — child unit allocations counted once.',
          'Outstanding: bill remaining when agreement has bills; else tenancy remaining — never both.',
          `Accounting view: ${period.accountingView} (${period.accountingView === 'CASH' ? 'expense paidAmount' : 'expense amount'}).`,
        ],
        netLabel:
          period.accountingView === 'CASH' ? 'Net Cash Flow' : 'Net Profit',
        bookingTypeFilterNote:
          'Dashboard bookingType (HOURLY/DAILY/MONTHLY) filters the unit grid only; financial cards are not filtered by booking type.',
      },
      income: {
        totalIncome: money(income.totalIncome),
        bookingIncome: money(income.bookingIncome),
        monthlyTenancyIncome: money(income.monthlyTenancyIncome),
        monthlyBillIncome: money(income.monthlyBillIncome),
        otherIncome: money(income.otherIncome),
      },
      expenses: {
        totalExpenses: money(expenses.total),
        rent: money(expenses.buckets.rent),
        electricity: money(expenses.buckets.electricity),
        maintenance: money(expenses.buckets.maintenance),
        society: money(expenses.buckets.society),
        cleaning: money(expenses.buckets.cleaning),
        laundry: money(expenses.buckets.laundry),
        salary: money(expenses.buckets.salary),
        inventory: money(expenses.buckets.inventory),
        otherExpenses: money(expenses.buckets.otherExpenses),
        paidExpenses: money(expenses.paid),
        unpaidExpenses: money(expenses.unpaid),
      },
      receivables: {
        outstandingReceivables: money(outstanding.total),
        bookingOutstanding: money(outstanding.booking),
        monthlyBillOutstanding: money(outstanding.monthlyBill),
        monthlyTenancyOutstanding: money(outstanding.monthlyTenancy),
      },
      result,
    };
  }

  async getTrend(
    query: { year?: number; propertyId?: string; unitId?: string; accountingView?: AccountingView },
    role: Role,
    canAccessProfitLoss: boolean,
  ): Promise<ProfitLossTrendRow[]> {
    this.assertAccess(role, canAccessProfitLoss);
    await this.assertPropertyUnit(query.propertyId, query.unitId);

    const year = query.year ?? new Date().getFullYear();
    if (!Number.isInteger(year) || year < 2000 || year > 2100) {
      throw new BadRequestException('year must be a valid 4-digit year');
    }

    const months = await Promise.all(
      Array.from({ length: 12 }, (_, index) => {
        const month = index + 1;
        return this.getSummary(
          {
            month,
            year,
            propertyId: query.propertyId,
            unitId: query.unitId,
            accountingView: query.accountingView,
          },
          role,
          canAccessProfitLoss,
        ).then((summary) => ({
          month,
          income: summary.income.totalIncome,
          expenses: summary.expenses.totalExpenses,
          netAmount: summary.result.netAmount,
          resultType: summary.result.resultType,
        }));
      }),
    );

    return months;
  }

  async getByProperty(
    query: {
      startDate?: string;
      endDate?: string;
      month?: number;
      year?: number;
      date?: string;
      accountingView?: AccountingView;
    },
    role: Role,
    canAccessProfitLoss: boolean,
  ): Promise<ProfitLossByPropertyRow[]> {
    this.assertAccess(role, canAccessProfitLoss);
    const properties = await this.prisma.property.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        _count: { select: { units: { where: { isActive: true } } } },
      },
    });

    const rows = await Promise.all(
      properties.map(async (property) => {
        const summary = await this.getSummary(
          { ...query, propertyId: property.id },
          role,
          canAccessProfitLoss,
        );
        return {
          propertyId: property.id,
          propertyName: property.name,
          unitCount: property._count.units,
          income: summary.income.totalIncome,
          expenses: summary.expenses.totalExpenses,
          netAmount: summary.result.netAmount,
          resultType: summary.result.resultType,
        };
      }),
    );

    return rows;
  }

  async getByUnit(
    query: ProfitLossFilterInput & { propertyId: string },
    role: Role,
    canAccessProfitLoss: boolean,
  ): Promise<ProfitLossByUnitRow[]> {
    this.assertAccess(role, canAccessProfitLoss);
    if (!query.propertyId) {
      throw new BadRequestException('propertyId is required');
    }
    await this.assertPropertyUnit(query.propertyId);

    const units = await this.prisma.unit.findMany({
      where: { propertyId: query.propertyId, isActive: true },
      orderBy: { unitNumber: 'asc' },
      select: {
        id: true,
        unitNumber: true,
        unitType: true,
        propertyId: true,
        property: { select: { name: true } },
      },
    });

    return Promise.all(
      units.map(async (unit) => {
        const summary = await this.getSummary(
          {
            ...query,
            propertyId: query.propertyId,
            unitId: unit.id,
          },
          role,
          canAccessProfitLoss,
        );
        return {
          unitId: unit.id,
          unitNumber: unit.unitNumber,
          unitType: unit.unitType,
          propertyId: unit.propertyId,
          propertyName: unit.property.name,
          income: summary.income.totalIncome,
          expenses: summary.expenses.totalExpenses,
          netAmount: summary.result.netAmount,
          resultType: summary.result.resultType,
        };
      }),
    );
  }

  async getIncomeBreakdown(
    query: ProfitLossFilterInput,
    role: Role,
    canAccessProfitLoss: boolean,
  ): Promise<IncomeBreakdownRow[]> {
    this.assertAccess(role, canAccessProfitLoss);
    await this.assertPropertyUnit(query.propertyId, query.unitId);
    const { range } = resolveReportingPeriod(query);
    const rows = await this.loadIncomeRows(
      range,
      query.propertyId,
      query.unitId,
    );

    return rows
      .map((row) => {
        const signed = signedIncomeAmount(row);
        if (signed.isZero() && row.status === 'PENDING') return null;
        const guestOrTenant =
          row.booking?.guest.fullName ??
          row.monthlyTenancy?.tenant.fullName ??
          null;
        const unit =
          row.booking?.unit ?? row.monthlyTenancy?.unit ?? null;
        return {
          paymentId: row.id,
          paymentNumber: row.paymentNumber,
          paymentDate: row.paymentDate.toISOString(),
          source: row.paymentForType as IncomeBreakdownRow['source'],
          guestOrTenant,
          propertyName: unit?.property.name ?? null,
          unitNumber: unit?.unitNumber ?? null,
          amount: money(row.amount),
          signedAmount: money(signed),
          transactionType: row.transactionType,
          status: row.status,
        };
      })
      .filter((row): row is NonNullable<typeof row> => row !== null)
      .sort(
        (a, b) =>
          new Date(b.paymentDate).getTime() - new Date(a.paymentDate).getTime(),
      );
  }

  async getExpenseBreakdown(
    query: ProfitLossFilterInput,
    role: Role,
    canAccessProfitLoss: boolean,
    canAccessSalary = false,
  ): Promise<ExpenseBreakdownRow[]> {
    this.assertAccess(role, canAccessProfitLoss);
    await this.assertPropertyUnit(query.propertyId, query.unitId);
    const { period, range } = resolveReportingPeriod(query);
    const rows = await this.loadExpenseRows(
      range,
      query.propertyId,
      query.unitId,
    );
    const hideSalaryDetails =
      role !== Role.SUPER_ADMIN &&
      !canAccessSalaryData(role, canAccessSalary);

    return rows
      .map((row) => {
        const counted = this.countedExpenseAmount(row, period.accountingView);
        const isSalary = row.category.name === 'Salary';
        return {
          expenseId: row.id,
          expenseNumber: row.expenseNumber,
          expenseDate: row.expenseDate.toISOString(),
          category: row.category.name,
          propertyName:
            row.property?.name ?? row.unit?.property.name ?? null,
          unitNumber: row.unit?.unitNumber ?? null,
          vendorName:
            isSalary && hideSalaryDetails
              ? null
              : row.vendorName ??
                (isSalary ? row.employee?.fullName ?? null : null),
          amount: money(row.amount),
          paidAmount: money(row.paidAmount),
          countedAmount: money(counted),
          paymentStatus: row.paymentStatus,
        };
      })
      .sort(
        (a, b) =>
          new Date(b.expenseDate).getTime() - new Date(a.expenseDate).getTime(),
      );
  }

  async getExpenseCategoryBreakdown(
    query: ProfitLossFilterInput,
    role: Role,
    canAccessProfitLoss: boolean,
  ) {
    const summary = await this.getSummary(query, role, canAccessProfitLoss);
    return [
      { category: 'Rent', amount: summary.expenses.rent },
      { category: 'Electricity', amount: summary.expenses.electricity },
      { category: 'Maintenance', amount: summary.expenses.maintenance },
      { category: 'Society Bill', amount: summary.expenses.society },
      { category: 'Cleaning', amount: summary.expenses.cleaning },
      { category: 'Laundry', amount: summary.expenses.laundry },
      { category: 'Salary', amount: summary.expenses.salary },
      { category: 'Inventory', amount: summary.expenses.inventory },
      { category: 'Other', amount: summary.expenses.otherExpenses },
    ].filter((row) => !toDecimal(row.amount).isZero());
  }

  async getIncomeSourceBreakdown(
    query: ProfitLossFilterInput,
    role: Role,
    canAccessProfitLoss: boolean,
  ) {
    const summary = await this.getSummary(query, role, canAccessProfitLoss);
    return [
      { source: 'Booking', amount: summary.income.bookingIncome },
      { source: 'Monthly Tenancy', amount: summary.income.monthlyTenancyIncome },
      { source: 'Monthly Bill', amount: summary.income.monthlyBillIncome },
      { source: 'Other', amount: summary.income.otherIncome },
    ].filter((row) => !toDecimal(row.amount).isZero());
  }

  /** Shared dashboard adapter — same income/expense/profit math. */
  async getDashboardFinancials(
    query: ProfitLossFilterInput,
    role: Role,
    canAccessProfitLoss: boolean,
  ): Promise<{
    income: number;
    expenses: number;
    unpaidExpenses: number;
    profit: number;
    outstanding: number;
    expenseBreakdown: Array<{ category: string; amount: number }>;
    incomeBreakdown?: Array<{ source: string; amount: number }>;
    netLabel?: 'Net Cash Flow' | 'Net Profit';
    accountingView?: AccountingView;
  } | null> {
    if (!canAccessProfitLossData(role, canAccessProfitLoss)) {
      return null;
    }

    const summary = await this.getSummary(query, role, canAccessProfitLoss);
    const breakdown = await this.getExpenseCategoryBreakdown(
      query,
      role,
      canAccessProfitLoss,
    );

    return {
      income: Number(summary.income.totalIncome),
      expenses: Number(summary.expenses.totalExpenses),
      unpaidExpenses: Number(summary.expenses.unpaidExpenses),
      profit: Number(summary.result.netAmount),
      outstanding: Number(summary.receivables.outstandingReceivables),
      expenseBreakdown: breakdown.map((row) => ({
        category: row.category,
        amount: Number(row.amount),
      })),
      incomeBreakdown: [
        { source: 'Booking', amount: Number(summary.income.bookingIncome) },
        {
          source: 'Monthly Tenancy',
          amount: Number(summary.income.monthlyTenancyIncome),
        },
        {
          source: 'Monthly Bill',
          amount: Number(summary.income.monthlyBillIncome),
        },
        { source: 'Other', amount: Number(summary.income.otherIncome) },
      ].filter((row) => row.amount !== 0),
      netLabel: summary.metadata.netLabel,
      accountingView: summary.period.accountingView,
    };
  }
}
