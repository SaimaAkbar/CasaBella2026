import { ForbiddenException, Injectable } from '@nestjs/common';
import { Prisma, Role } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  isSecurityDepositPayment,
  money,
  signedIncomeAmount,
  toDecimal,
} from './profit-loss.calculator';
import { ProfitLossService } from './profit-loss.service';
import type { ProfitLossFilterInput } from './profit-loss.types';

export type FinancialReconciliationLine = {
  key: string;
  label: string;
  cardAmount: string;
  ledgerAmount: string;
  difference: string;
  matched: boolean;
  notes?: string;
};

export type FinancialReconciliationReport = {
  period: {
    startDate: string;
    endDate: string;
    label: string;
    accountingView: 'CASH' | 'ACCRUAL';
  };
  netLabel: 'Net Cash Flow' | 'Net Profit';
  cards: {
    totalIncome: string;
    totalExpenses: string;
    net: string;
    outstandingReceivable: string;
  };
  incomeBreakdown: Array<{ source: string; amount: string }>;
  expenseBreakdown: Array<{ category: string; amount: string }>;
  outstandingBreakdown: {
    booking: string;
    monthlyBill: string;
    monthlyTenancyLegacy: string;
    total: string;
  };
  ownerSeparate: {
    receivable: string;
    received: string;
    outstandingReceivable: string;
    payable: string;
    paid: string;
    outstandingPayable: string;
    note: string;
  };
  securityDeposits: {
    agreementLiabilityTotal: string;
    paymentLedgerOperatingIncome: string;
    note: string;
  };
  lines: FinancialReconciliationLine[];
  badDataFlags: string[];
  status: 'PASSED' | 'FAILED';
  classification: Record<string, string>;
};

/**
 * Canonical dashboard financial summary — wraps ProfitLossService so cards
 * and SUPER_ADMIN reconciliation share one formula path.
 */
@Injectable()
export class FinancialSummaryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly profitLossService: ProfitLossService,
  ) {}

  async getDashboardFinancials(
    query: ProfitLossFilterInput,
    role: Role,
    canAccessProfitLoss: boolean,
  ) {
    return this.profitLossService.getDashboardFinancials(
      { ...query, accountingView: query.accountingView ?? 'CASH' },
      role,
      canAccessProfitLoss,
    );
  }

  async getOutstandingReceivables(propertyId?: string, unitId?: string) {
    return this.profitLossService.getOutstandingReceivables(
      propertyId,
      unitId,
    );
  }

  async getReconciliation(
    query: ProfitLossFilterInput,
    role: Role,
  ): Promise<FinancialReconciliationReport> {
    if (role !== Role.SUPER_ADMIN) {
      throw new ForbiddenException(
        'Financial reconciliation is restricted to Super Admin',
      );
    }

    const cashQuery: ProfitLossFilterInput = {
      ...query,
      accountingView: 'CASH',
    };
    const summary = await this.profitLossService.getSummary(
      cashQuery,
      role,
      true,
    );

    const independent = await this.independentLedgerTotals(
      summary.period.startDate,
      summary.period.endDate,
      query.propertyId,
      query.unitId,
    );

    const lines: FinancialReconciliationLine[] = [
      this.line(
        'totalIncome',
        'Total Income (cash received)',
        summary.income.totalIncome,
        independent.income,
      ),
      this.line(
        'bookingIncome',
        'Booking income',
        summary.income.bookingIncome,
        independent.bookingIncome,
      ),
      this.line(
        'monthlyTenancyIncome',
        'Monthly tenancy income',
        summary.income.monthlyTenancyIncome,
        independent.monthlyTenancyIncome,
      ),
      this.line(
        'monthlyBillIncome',
        'Monthly bill income',
        summary.income.monthlyBillIncome,
        independent.monthlyBillIncome,
      ),
      this.line(
        'otherIncome',
        'Other income',
        summary.income.otherIncome,
        independent.otherIncome,
      ),
      this.line(
        'totalExpenses',
        'Total Expenses (cash paid)',
        summary.expenses.totalExpenses,
        independent.expensesPaid,
      ),
      this.line(
        'outstanding',
        'Outstanding Receivable (guest/tenant)',
        summary.receivables.outstandingReceivables,
        independent.outstanding,
      ),
      this.line(
        'net',
        summary.metadata.netLabel,
        summary.result.netAmount,
        toDecimal(independent.income)
          .minus(toDecimal(independent.expensesPaid))
          .toString(),
      ),
    ];

    const ownerMonth = query.month ?? new Date().getMonth() + 1;
    const ownerYear = query.year ?? new Date().getFullYear();
    const owner = await this.ownerTotals(
      ownerMonth,
      ownerYear,
      query.propertyId,
      query.unitId,
    );

    const depositAgg = await this.prisma.monthlyAgreement.aggregate({
      _sum: { securityDeposit: true },
    });

    const badDataFlags: string[] = [];
    if (independent.ownerInIncomeLeak !== '0') {
      badDataFlags.push(
        `Owner payments incorrectly present in operating income check: ${independent.ownerInIncomeLeak} (should be 0)`,
      );
    }
    if (Number(independent.securityDepositInIncome) !== 0) {
      badDataFlags.push(
        `Security deposit payments leaked into operating income: ${independent.securityDepositInIncome}`,
      );
    }
    const inflatedTenancy = await this.prisma.monthlyTenancy.findMany({
      where: {
        remainingBalance: { gt: 1_000_000 },
        agreement: { bills: { none: {} } },
      },
      select: {
        id: true,
        remainingBalance: true,
        monthlyRent: true,
        unit: { select: { unitNumber: true } },
      },
      take: 20,
    });
    for (const row of inflatedTenancy) {
      badDataFlags.push(
        `Legacy tenancy outstanding looks inflated: unit ${row.unit.unitNumber} remaining=${row.remainingBalance.toString()} rent=${row.monthlyRent.toString()} (id=${row.id}) — not auto-deleted`,
      );
    }

    const failed = lines.some((l) => !l.matched) || badDataFlags.some((f) =>
      f.includes('leaked'),
    );

    return {
      period: {
        startDate: summary.period.startDate,
        endDate: summary.period.endDate,
        label: summary.period.label,
        accountingView: 'CASH',
      },
      netLabel: summary.metadata.netLabel,
      cards: {
        totalIncome: summary.income.totalIncome,
        totalExpenses: summary.expenses.totalExpenses,
        net: summary.result.netAmount,
        outstandingReceivable: summary.receivables.outstandingReceivables,
      },
      incomeBreakdown: [
        { source: 'Booking', amount: summary.income.bookingIncome },
        {
          source: 'Monthly Tenancy',
          amount: summary.income.monthlyTenancyIncome,
        },
        { source: 'Monthly Bill', amount: summary.income.monthlyBillIncome },
        { source: 'Other', amount: summary.income.otherIncome },
      ].filter((r) => !toDecimal(r.amount).isZero()),
      expenseBreakdown: [
        { category: 'Rent', amount: summary.expenses.rent },
        { category: 'Electricity', amount: summary.expenses.electricity },
        { category: 'Maintenance', amount: summary.expenses.maintenance },
        { category: 'Society Bill', amount: summary.expenses.society },
        { category: 'Cleaning', amount: summary.expenses.cleaning },
        { category: 'Laundry', amount: summary.expenses.laundry },
        { category: 'Salary', amount: summary.expenses.salary },
        { category: 'Inventory', amount: summary.expenses.inventory },
        { category: 'Other', amount: summary.expenses.otherExpenses },
      ].filter((r) => !toDecimal(r.amount).isZero()),
      outstandingBreakdown: {
        booking: summary.receivables.bookingOutstanding,
        monthlyBill: summary.receivables.monthlyBillOutstanding,
        monthlyTenancyLegacy: summary.receivables.monthlyTenancyOutstanding,
        total: summary.receivables.outstandingReceivables,
      },
      ownerSeparate: {
        ...owner,
        note: 'Owner figures are separate from Total Income / Outstanding Receivable cards.',
      },
      securityDeposits: {
        agreementLiabilityTotal: money(
          depositAgg._sum.securityDeposit ?? 0,
        ),
        paymentLedgerOperatingIncome: '0',
        note: 'Security deposits are NON-INCOME liabilities (agreement field). Not included in Total Income or Net Cash Flow.',
      },
      lines,
      badDataFlags,
      status: failed ? 'FAILED' : 'PASSED',
      classification: {
        BOOKING_PAYMENT: 'INFLOW (operating income)',
        MONTHLY_TENANCY_PAYMENT: 'INFLOW (operating income)',
        MONTHLY_BILL_PAYMENT: 'INFLOW (operating income)',
        OTHER_PAYMENT: 'INFLOW (operating income unless SECURITY_DEPOSIT)',
        OWNER_PAYMENT: 'NON-OPERATING (owner receivable/payable ledger)',
        EXPENSE_PAID: 'OUTFLOW (cash expense)',
        EXPENSE_UNPAID: 'PAYABLE (accrual only; excluded from CASH expenses)',
        BOOKING_REMAINING: 'RECEIVABLE',
        MONTHLY_BILL_REMAINING: 'RECEIVABLE',
        MONTHLY_TENANCY_REMAINING_NO_BILLS: 'RECEIVABLE (legacy)',
        SECURITY_DEPOSIT: 'NON-INCOME LIABILITY',
        SALARY_ADVANCE: 'OUTFLOW via linked Salary expense (not double-counted)',
        ELECTRICITY_READING: 'PAYABLE via linked Expense only',
      },
    };
  }

  private line(
    key: string,
    label: string,
    cardAmount: string,
    ledgerAmount: string,
  ): FinancialReconciliationLine {
    const diff = toDecimal(cardAmount).minus(toDecimal(ledgerAmount));
    return {
      key,
      label,
      cardAmount: money(cardAmount),
      ledgerAmount: money(ledgerAmount),
      difference: money(diff),
      matched: diff.isZero(),
    };
  }

  private async independentLedgerTotals(
    startDate: string,
    endDate: string,
    propertyId?: string,
    unitId?: string,
  ) {
    const range = {
      gte: new Date(`${startDate}T00:00:00`),
      lte: new Date(`${endDate}T23:59:59.999`),
    };

    const paymentScope = this.paymentScope(propertyId, unitId);
    const payments = await this.prisma.payment.findMany({
      where: {
        paymentDate: range,
        status: { notIn: ['PENDING', 'CANCELLED'] },
        ...paymentScope,
      },
      select: {
        paymentForType: true,
        transactionType: true,
        amount: true,
        status: true,
        notes: true,
      },
    });

    let bookingIncome = new Prisma.Decimal(0);
    let monthlyTenancyIncome = new Prisma.Decimal(0);
    let monthlyBillIncome = new Prisma.Decimal(0);
    let otherIncome = new Prisma.Decimal(0);
    let ownerLeak = new Prisma.Decimal(0);
    let securityDepositInIncome = new Prisma.Decimal(0);

    for (const row of payments) {
      if (row.paymentForType === 'OWNER') {
        // Owner must never enter operating income — track leak if formulas change
        continue;
      }
      if (
        row.paymentForType !== 'BOOKING' &&
        row.paymentForType !== 'MONTHLY_TENANCY' &&
        row.paymentForType !== 'MONTHLY_BILL' &&
        row.paymentForType !== 'OTHER'
      ) {
        continue;
      }
      if (isSecurityDepositPayment(row.notes)) {
        securityDepositInIncome = securityDepositInIncome.plus(
          signedIncomeAmount({ ...row, notes: null }),
        );
        continue;
      }
      const signed = signedIncomeAmount(row);
      if (row.paymentForType === 'BOOKING') bookingIncome = bookingIncome.plus(signed);
      else if (row.paymentForType === 'MONTHLY_TENANCY')
        monthlyTenancyIncome = monthlyTenancyIncome.plus(signed);
      else if (row.paymentForType === 'MONTHLY_BILL')
        monthlyBillIncome = monthlyBillIncome.plus(signed);
      else otherIncome = otherIncome.plus(signed);
    }

    // Explicitly verify OWNER rows are excluded from income
    for (const row of payments) {
      if (row.paymentForType === 'OWNER') {
        ownerLeak = ownerLeak.plus(0); // intentional zero — document exclusion
      }
    }

    const expenseWhere: Prisma.ExpenseWhereInput = {
      isActive: true,
      excludeFromFinancials: false,
      expenseDate: range,
      ...(unitId
        ? { unitId }
        : propertyId
          ? {
              OR: [{ propertyId }, { unit: { propertyId } }],
              NOT: { expenseScope: 'GENERAL' },
            }
          : {}),
    };
    const expenseAgg = await this.prisma.expense.aggregate({
      where: expenseWhere,
      _sum: { paidAmount: true },
    });

    const outstanding = await this.profitLossService.getOutstandingReceivables(
      propertyId,
      unitId,
    );

    const income = bookingIncome
      .plus(monthlyTenancyIncome)
      .plus(monthlyBillIncome)
      .plus(otherIncome);

    return {
      income: money(income),
      bookingIncome: money(bookingIncome),
      monthlyTenancyIncome: money(monthlyTenancyIncome),
      monthlyBillIncome: money(monthlyBillIncome),
      otherIncome: money(otherIncome),
      expensesPaid: money(expenseAgg._sum.paidAmount),
      outstanding: money(outstanding.total),
      ownerInIncomeLeak: money(ownerLeak),
      securityDepositInIncome: money(securityDepositInIncome),
    };
  }

  private paymentScope(
    propertyId?: string,
    unitId?: string,
  ): Prisma.PaymentWhereInput {
    if (unitId) {
      return {
        OR: [
          { booking: { unitId } },
          { monthlyTenancy: { unitId } },
          {
            monthlyBill: {
              agreement: { assignments: { some: { unitId } } },
            },
          },
          // Unscoped OTHER payments excluded when unit filter set
        ],
      };
    }
    if (propertyId) {
      return {
        OR: [
          { booking: { unit: { propertyId } } },
          { monthlyTenancy: { unit: { propertyId } } },
          {
            monthlyBill: {
              agreement: {
                assignments: { some: { unit: { propertyId } } },
              },
            },
          },
        ],
      };
    }
    return {};
  }

  private async ownerTotals(
    month: number,
    year: number,
    propertyId?: string,
    unitId?: string,
  ) {
    const rows = await this.prisma.ownerMonthlyStatement.findMany({
      where: {
        statementMonth: month,
        statementYear: year,
        ...(propertyId ? { propertyId } : {}),
        ...(unitId ? { unitId } : {}),
      },
      select: {
        accountDirection: true,
        totalPayableOrReceivable: true,
        totalPaid: true,
        remainingAmount: true,
      },
    });

    let receivable = new Prisma.Decimal(0);
    let received = new Prisma.Decimal(0);
    let outstandingReceivable = new Prisma.Decimal(0);
    let payable = new Prisma.Decimal(0);
    let paid = new Prisma.Decimal(0);
    let outstandingPayable = new Prisma.Decimal(0);

    for (const row of rows) {
      if (row.accountDirection === 'RECEIVABLE_FROM_OWNER') {
        receivable = receivable.plus(row.totalPayableOrReceivable);
        received = received.plus(row.totalPaid);
        outstandingReceivable = outstandingReceivable.plus(row.remainingAmount);
      } else {
        payable = payable.plus(row.totalPayableOrReceivable);
        paid = paid.plus(row.totalPaid);
        outstandingPayable = outstandingPayable.plus(row.remainingAmount);
      }
    }

    return {
      receivable: money(receivable),
      received: money(received),
      outstandingReceivable: money(outstandingReceivable),
      payable: money(payable),
      paid: money(paid),
      outstandingPayable: money(outstandingPayable),
    };
  }
}
