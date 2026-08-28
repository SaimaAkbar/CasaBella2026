export type AccountingView = 'ACCRUAL' | 'CASH';
export type ProfitLossResultType = 'PROFIT' | 'LOSS' | 'BREAK_EVEN';

export type ResolvedPeriod = {
  startDate: string;
  endDate: string;
  accountingView: AccountingView;
  label: string;
};

export type ProfitLossFilterInput = {
  date?: string;
  month?: number;
  year?: number;
  startDate?: string;
  endDate?: string;
  propertyId?: string;
  unitId?: string;
  accountingView?: AccountingView;
};

export type ProfitLossSummary = {
  period: ResolvedPeriod;
  metadata: {
    generalExpensesIncluded: boolean;
    generalExpensesPolicy: string;
    doubleCountPrevention: string[];
    /** CASH → Net Cash Flow; ACCRUAL → Net Profit (accrual). */
    netLabel: 'Net Cash Flow' | 'Net Profit';
    bookingTypeFilterNote: string;
  };
  income: {
    totalIncome: string;
    bookingIncome: string;
    monthlyTenancyIncome: string;
    monthlyBillIncome: string;
    otherIncome: string;
  };
  expenses: {
    totalExpenses: string;
    rent: string;
    electricity: string;
    maintenance: string;
    society: string;
    cleaning: string;
    laundry: string;
    salary: string;
    inventory: string;
    otherExpenses: string;
    paidExpenses: string;
    unpaidExpenses: string;
  };
  receivables: {
    outstandingReceivables: string;
    bookingOutstanding: string;
    monthlyBillOutstanding: string;
    monthlyTenancyOutstanding: string;
  };
  result: {
    netAmount: string;
    resultType: ProfitLossResultType;
  };
};

export type ProfitLossTrendRow = {
  month: number;
  income: string;
  expenses: string;
  netAmount: string;
  resultType: ProfitLossResultType;
};

export type ProfitLossByPropertyRow = {
  propertyId: string;
  propertyName: string;
  unitCount: number;
  income: string;
  expenses: string;
  netAmount: string;
  resultType: ProfitLossResultType;
};

export type ProfitLossByUnitRow = {
  unitId: string;
  unitNumber: string;
  unitType: string;
  propertyId: string;
  propertyName: string;
  income: string;
  expenses: string;
  netAmount: string;
  resultType: ProfitLossResultType;
};

export type IncomeBreakdownRow = {
  paymentId: string;
  paymentNumber: string;
  paymentDate: string;
  source: 'BOOKING' | 'MONTHLY_TENANCY' | 'MONTHLY_BILL' | 'OTHER';
  guestOrTenant: string | null;
  propertyName: string | null;
  unitNumber: string | null;
  amount: string;
  signedAmount: string;
  transactionType: string;
  status: string;
  /** True when payment notes mark a security deposit (excluded from operating income). */
  excludedAsSecurityDeposit?: boolean;
};

export type ExpenseBreakdownRow = {
  expenseId: string;
  expenseNumber: string;
  expenseDate: string;
  category: string;
  propertyName: string | null;
  unitNumber: string | null;
  vendorName: string | null;
  amount: string;
  paidAmount: string;
  countedAmount: string;
  paymentStatus: string;
};
