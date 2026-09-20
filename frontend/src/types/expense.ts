export type ExpenseScope =
  | 'GENERAL'
  | 'PROPERTY'
  | 'UNIT'
  | 'BOOKING'
  | 'MONTHLY_TENANCY'
  | 'EMPLOYEE'
  | 'OWNER';

export type ExpensePaymentStatus = 'UNPAID' | 'PARTIAL' | 'PAID' | 'OVERDUE';

export type PaymentMethod =
  | 'CASH'
  | 'BANK_TRANSFER'
  | 'CARD'
  | 'EASYPAISA'
  | 'JAZZCASH'
  | 'OTHER';

export type ExpenseCategory = {
  id: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ExpenseMetadata = {
  billingMonth?: number;
  billingYear?: number;
  dueDate?: string;
  paidDate?: string;
  payeeName?: string;
  notes?: string;
};

export type ExpensePayment = {
  id: string;
  amount: string;
  paymentDate: string;
  paymentMethod: PaymentMethod;
  bankName: string | null;
  transactionReference: string | null;
  notes: string | null;
  createdBy?: { id: string; fullName: string } | null;
};

export type Expense = {
  id: string;
  expenseNumber: string;
  categoryId: string;
  expenseName?: string | null;
  expenseScope: ExpenseScope;
  propertyId: string | null;
  unitId: string | null;
  bookingId: string | null;
  monthlyTenancyId: string | null;
  parentExpenseId?: string | null;
  excludeFromFinancials?: boolean;
  expenseDate: string;
  amount: string;
  paidAmount: string;
  remainingAmount: string;
  paymentStatus: ExpensePaymentStatus;
  paymentMethod: PaymentMethod | null;
  vendorName: string | null;
  referenceNumber: string | null;
  description: string | null;
  receiptUrl: string | null;
  metadata: ExpenseMetadata | null;
  billingMonth?: number | null;
  billingYear?: number | null;
  dueDate?: string | null;
  paymentDate?: string | null;
  bankName?: string | null;
  notes?: string | null;
  createdByUserId: string;
  approvedByUserId: string | null;
  approvedAt: string | null;
  isFinalized: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  category?: { id: string; name: string; isSystem: boolean };
  property?: { id: string; name: string } | null;
  unit?: { id: string; unitNumber: string; propertyId: string } | null;
  booking?: {
    id: string;
    bookingNumber: string;
    guest?: { id: string; fullName: string; phone: string };
    unit?: {
      id: string;
      unitNumber: string;
      property?: { id: string; name: string };
    };
  } | null;
  monthlyTenancy?: {
    id: string;
    tenant?: { id: string; fullName: string; phone: string };
    unit?: {
      id: string;
      unitNumber: string;
      property?: { id: string; name: string };
    };
  } | null;
  createdBy?: { id: string; fullName: string } | null;
  approvedBy?: { id: string; fullName: string } | null;
  payments?: ExpensePayment[];
  electricityReading?: {
    id: string;
    previousUnits: string;
    currentUnits: string | null;
    consumedUnits: string | null;
    ratePerUnit: string;
    calculatedAmount: string;
    lateFineAmount?: string;
    lateFineApplied?: boolean;
    dueDate?: string | null;
    billingMonth: number;
    billingYear: number;
    readingDate: string;
  } | null;
};

export type ExpenseSummary = {
  totalExpensesToday: string;
  totalExpensesThisMonth: string;
  rent?: string;
  electricity?: string;
  maintenance?: string;
  cleaningAndLaundry?: string;
  unpaidExpenses: string;
  paidExpenses: string;
};

export type ExpenseMonthlySummary = {
  period: { month: number; year: number; label: string };
  totals: {
    totalExpenses: string;
    paidAmount: string;
    outstanding: string;
    overdueAmount: string;
    totalUnits: number;
  };
  categories: {
    electricity: string;
    maintenance: string;
    society: string;
    water: string;
    internet: string;
    cleaning: string;
    liftBill: string;
    liftMaintenance: string;
    other: string;
  };
};

export type ExpenseQuery = {
  categoryId?: string;
  categoryName?: string;
  expenseScope?: ExpenseScope | '';
  propertyId?: string;
  unitId?: string;
  bookingId?: string;
  monthlyTenancyId?: string;
  paymentStatus?: ExpensePaymentStatus | '';
  paymentMethod?: PaymentMethod | '';
  isFinalized?: boolean | '';
  date?: string;
  month?: number | '';
  year?: number | '';
  startDate?: string;
  endDate?: string;
  today?: boolean;
  search?: string;
};

export type CreateExpenseInput = {
  categoryId?: string;
  expenseScope: ExpenseScope;
  propertyId?: string;
  unitId?: string;
  bookingId?: string;
  monthlyTenancyId?: string;
  expenseDate: string;
  amount: number;
  paidAmount?: number;
  paymentMethod?: PaymentMethod;
  vendorName?: string;
  referenceNumber?: string;
  description?: string;
  receiptUrl?: string;
  metadata?: ExpenseMetadata;
  billingMonth?: number;
  billingYear?: number;
  dueDate?: string;
  expenseName?: string;
  saveExpenseName?: boolean;
  allocateToUnits?: {
    mode: 'equal' | 'custom';
    unitIds?: string[];
    amounts?: Record<string, number>;
  };
};

export type BulkCreateExpensesInput = {
  categoryId: string;
  propertyId: string;
  unitIds: string[];
  amount: number;
  splitTotal?: boolean;
  billingMonth: number;
  billingYear: number;
  dueDate?: string;
  expenseDate?: string;
  description?: string;
  vendorName?: string;
  notes?: string;
  paymentMethod?: PaymentMethod;
};

export type RecordExpensePaymentInput = {
  amountPaid: number;
  paymentDate: string;
  paymentMethod: PaymentMethod;
  bankName?: string;
  transactionReference?: string;
  notes?: string;
};

export type ElectricityReading = {
  id: string;
  propertyId: string;
  unitId: string | null;
  previousReading?: string;
  currentReading?: string | null;
  previousUnits: string;
  currentUnits: string | null;
  unitsConsumed?: string | null;
  consumedUnits: string | null;
  ratePerUnit: string;
  baseBill?: string;
  calculatedAmount: string;
  dueDate?: string | null;
  lateFinePercentage?: string;
  lateFineAmount?: string;
  lateFineApplied?: boolean;
  finalBill?: string;
  paidAmount?: string;
  remainingAmount?: string;
  paymentStatus?: string;
  paymentMethod?: string | null;
  paymentDate?: string | null;
  bankName?: string | null;
  readingDate: string;
  billingMonth: number;
  billingYear: number;
  notes: string | null;
  expenseId: string | null;
  expensePaymentId?: string;
  property?: { id: string; name: string } | null;
  unit?: { id: string; unitNumber: string; propertyId: string } | null;
  expense?: {
    id: string;
    expenseNumber: string;
    amount: string;
    paidAmount?: string;
    remainingAmount?: string;
    paymentStatus: string;
    isFinalized: boolean;
    payments?: ExpensePayment[];
  } | null;
  createdBy?: { id: string; fullName: string } | null;
};

export type ElectricityRateHistory = {
  id: string;
  ratePerUnit: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  reason: string | null;
  changedByUserId: string;
  changedBy?: { id: string; fullName: string } | null;
  createdAt: string;
};

export type CreateElectricityReadingInput = {
  propertyId: string;
  unitId: string;
  previousUnits?: number;
  currentUnits?: number;
  previousReading?: number;
  currentReading?: number;
  ratePerUnit?: number;
  billingMonth: number;
  billingYear: number;
  readingDate?: string;
  dueDate?: string;
  notes?: string;
  overrideReason?: string;
};

export type InitializeElectricityBillInput = {
  propertyId: string;
  unitId: string;
  previousReading: number;
  currentReading: number;
  ratePerUnit?: number;
  billingMonth: number;
  billingYear: number;
  dueDate?: string;
  readingDate?: string;
  notes?: string;
};

export type GenerateElectricityMonthInput = {
  propertyId: string;
  billingMonth: number;
  billingYear: number;
  dueDate?: string;
  ratePerUnit?: number;
};

export type EnterCurrentReadingInput = {
  currentReading: number;
  readingDate?: string;
  dueDate?: string;
  notes?: string;
};

export type ExpenseTabKey =
  | 'overview'
  | 'electricity'
  | 'maintenance'
  | 'society'
  | 'water'
  | 'internet'
  | 'cleaning'
  | 'liftBill'
  | 'liftMaintenance'
  | 'other';

export type UnitMonthExpenseStatus =
  | 'NO_CHARGE'
  | 'PAID'
  | 'PARTIAL'
  | 'UNPAID'
  | 'OVERDUE';

export type PropertyMonthViewUnit = {
  unitId: string;
  unitNumber: string;
  unitType: string;
  floor: string | null;
  expenses: {
    electricity: string;
    maintenance: string;
    society: string;
    water: string;
    internet: string;
    cleaning: string;
    liftBill: string;
    liftMaintenance: string;
    other: string;
  };
  totalExpense: string;
  paid: string;
  remaining: string;
  status: UnitMonthExpenseStatus;
  electricityReadingRequired: boolean;
  electricityReadingId: string | null;
};

export type PropertyMonthView = {
  property: { id: string; name: string };
  period: { month: number; year: number; label: string };
  summary: {
    totalUnits: number;
    totalExpenses: string;
    paid: string;
    remaining: string;
    overdue: string;
  };
  units: PropertyMonthViewUnit[];
};
