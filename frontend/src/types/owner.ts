export type OwnerAccountDirection =
  | 'RECEIVABLE_FROM_OWNER'
  | 'PAYABLE_TO_OWNER';

export type OwnerAssignmentStatus = 'DRAFT' | 'ACTIVE' | 'ENDED' | 'CANCELLED';

export type OwnerStatementPaymentStatus =
  | 'UNPAID'
  | 'PARTIAL'
  | 'PAID'
  | 'OVERDUE'
  | 'OVERPAID';

export type OwnerPaymentStatusTick = {
  icon: string;
  label: string;
};

export type Owner = {
  id: string;
  fullName: string;
  fatherOrSpouseName: string | null;
  phone: string;
  alternatePhone: string | null;
  email: string | null;
  cnic: string | null;
  address: string | null;
  city: string | null;
  bankName: string | null;
  accountTitle: string | null;
  accountNumberOrIban: string | null;
  branchName: string | null;
  notes: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  propertyCount?: number | null;
  unitCount?: number | null;
  assignedUnitCount?: number | null;
  monthlyExpected?: string | null;
  paidThisMonth?: string | null;
  remaining?: string | null;
  currentMonthPaid?: string | null;
  currentMonthRemaining?: string | null;
};

export type OwnerListTotals = {
  totalOwners: number;
  assignedApartments: number;
  expectedThisMonth: string;
  outstandingThisMonth: string;
};

export type OwnerListResponse = {
  items: Owner[];
  totals: OwnerListTotals;
};

export type OwnerInput = {
  fullName: string;
  fatherOrSpouseName?: string;
  phone: string;
  alternatePhone?: string;
  email?: string;
  cnic?: string;
  address?: string;
  city?: string;
  bankName?: string;
  accountTitle?: string;
  accountNumberOrIban?: string;
  branchName?: string;
  notes?: string;
};

export type OwnerUnitAssignment = {
  id: string;
  ownerId: string;
  propertyId: string;
  unitId: string;
  accountDirection: OwnerAccountDirection;
  ownershipPercentage: string;
  fixedMonthlyAmount: string;
  agreementStart: string;
  agreementEnd: string | null;
  dueDay: number;
  status: OwnerAssignmentStatus;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  endedAt: string | null;
  owner?: { id: string; fullName: string; phone: string };
  property?: { id: string; name: string };
  unit?: {
    id: string;
    unitNumber: string;
    floor: number | null;
    unitType: string;
  };
};

export type OwnerUnitAssignmentInput = {
  ownerId: string;
  propertyId: string;
  unitId: string;
  accountDirection: OwnerAccountDirection;
  ownershipPercentage: number;
  fixedMonthlyAmount: number;
  agreementStart: string;
  agreementEnd?: string;
  dueDay?: number;
  notes?: string;
};

export type OwnerMonthlyStatement = {
  id: string;
  ownerUnitAssignmentId: string;
  ownerId: string;
  propertyId: string;
  unitId: string;
  statementMonth: number;
  statementYear: number;
  accountDirection: OwnerAccountDirection;
  expectedAmount: string;
  previousBalance: string;
  adjustmentAmount: string;
  totalPayableOrReceivable: string;
  totalPaid: string;
  remainingAmount: string;
  dueDate: string;
  paymentStatus: OwnerStatementPaymentStatus;
  paymentStatusTick?: OwnerPaymentStatusTick;
  finalized: boolean;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  owner?: { id: string; fullName: string; phone: string };
  property?: { id: string; name: string };
  unit?: { id: string; unitNumber: string; floor: number | null };
  latestPaymentMethod?: string | null;
  latestBankName?: string | null;
  latestPaymentDate?: string | null;
  latestTransactionReference?: string | null;
};

export type OwnerPayment = {
  id: string;
  paymentNumber: string;
  ownerMonthlyStatementId: string | null;
  ownerId: string | null;
  amount: string;
  paymentMethod: string;
  bankName: string | null;
  accountTitle: string | null;
  transactionReference: string | null;
  paymentDate: string;
  transactionType: string;
  status: string;
  notes: string | null;
  owner?: { id: string; fullName: string } | null;
  statement?: {
    id: string;
    statementMonth: number;
    statementYear: number;
    accountDirection: OwnerAccountDirection;
    property?: { id: string; name: string };
    unit?: { id: string; unitNumber: string };
  } | null;
};

export type OwnerOverview = {
  totalActiveOwners: number;
  totalOwnedUnits: number;
  month: number;
  year: number;
  thisMonthExpectedReceivable: string;
  thisMonthReceived: string;
  outstandingReceivable: string;
  thisMonthPayableToOwners: string;
  thisMonthPaidToOwners: string;
  outstandingPayable: string;
  collectionPercentage: number;
};

export type ApartmentOwnerSummary = {
  propertyId: string;
  propertyName: string;
  unitId: string;
  unitNumber: string;
  floor: number | null;
  unitType: string;
  ownerCount: number;
  accountDirection: string;
  monthlyExpected: string;
  received: string;
  remaining: string;
  paymentStatus: string;
  paymentStatusTick?: OwnerPaymentStatusTick;
  month: number;
  year: number;
  owners: Array<{
    assignmentId: string;
    ownerId: string;
    ownerName: string;
    ownershipPercentage: string;
    fixedMonthlyAmount: string;
    accountDirection: OwnerAccountDirection;
    expectedThisMonth: string;
    paid: string;
    remaining: string;
    dueDate: string | null;
    paymentStatus: string | null;
  }>;
};

export type OwnerStatementTotals = {
  totalExpected: string;
  totalPaid: string;
  totalRemaining: string;
  totalReceivable: string;
  totalPayable: string;
  paidCount: number;
  partialCount: number;
  unpaidCount: number;
  overdueCount: number;
  statementCount: number;
};

export type OwnerPaymentInput = {
  ownerMonthlyStatementId: string;
  amount: number;
  paymentMethod: string;
  paymentDate: string;
  bankName?: string;
  accountTitle?: string;
  transactionReference?: string;
  notes?: string;
  overpayReason?: string;
};

export type OwnerAgreementRevisionRow = {
  id: string;
  assignmentId: string;
  propertyName: string;
  unitNumber: string;
  previousFixedMonthlyAmount: string;
  newFixedMonthlyAmount: string;
  previousOwnershipPercentage: string | null;
  newOwnershipPercentage: string | null;
  effectiveFrom: string;
  reason: string;
  createdBy: { id: string; fullName: string };
  createdAt: string;
};

export type OwnerDetailSummary = {
  owner: Owner;
  tabs: string[];
  assignments: Array<{
    id: string;
    property: { id: string; name: string };
    unit: {
      id: string;
      unitNumber: string;
      floor: number | null;
      unitType: string;
    };
    ownershipPercentage: string;
    fixedMonthlyAmount: string;
    accountDirection: OwnerAccountDirection;
    agreementStart: string;
    agreementEnd: string | null;
    status: OwnerAssignmentStatus;
    thisMonthStatus: OwnerStatementPaymentStatus | null;
    thisMonthStatusTick: OwnerPaymentStatusTick | null;
    thisMonthPaid: string | null;
    thisMonthRemaining: string | null;
  }>;
  statements: Array<{
    id: string;
    statementMonth: number;
    statementYear: number;
    property: { id: string; name: string };
    unit: { id: string; unitNumber: string; floor: number | null };
    expectedAmount: string;
    totalPaid: string;
    remainingAmount: string;
    dueDate: string;
    paymentStatus: OwnerStatementPaymentStatus;
    paymentStatusTick: OwnerPaymentStatusTick;
    accountDirection: OwnerAccountDirection;
  }>;
  payments: Array<{
    id: string;
    paymentNumber: string;
    paymentDate: string;
    amount: string;
    paymentMethod: string;
    bankName: string | null;
    transactionReference: string | null;
    status: string;
    transactionType: string;
    property: { id: string; name: string } | null;
    unit: { id: string; unitNumber: string } | null;
  }>;
  revisions: OwnerAgreementRevisionRow[];
  history: Array<{
    id: string;
    action: string;
    recordId: string;
    oldData: unknown;
    newData: unknown;
    createdAt: string;
    role: string;
  }>;
  totals: {
    thisMonthReceivableExpected: string;
    thisMonthReceivablePaid: string;
    thisMonthReceivableRemaining: string;
    thisMonthPayableExpected: string;
    thisMonthPayablePaid: string;
    thisMonthPayableRemaining: string;
  };
};

export type OwnerYearView = {
  ownerId: string;
  year: number;
  units: Array<{
    unitId: string;
    unitNumber: string;
    propertyName: string;
    months: Array<{
      month: number;
      paymentStatus: string | null;
      paymentStatusTick: OwnerPaymentStatusTick | null;
      expectedAmount: string | null;
      totalPaid: string | null;
      remainingAmount: string | null;
      statementId: string | null;
    }>;
  }>;
};

export type OwnerMonthlySummaryUnit = {
  agreementId: string;
  propertyId: string;
  propertyName: string;
  unitId: string;
  unitNumber: string;
  unitType: string;
  floor: number | null;
  accountDirection?: OwnerAccountDirection;
  agreedMonthlyAmount: string;
  statementId: string | null;
  expected: string;
  paid: string;
  remaining: string;
  dueDate: string | null;
  paymentStatus: OwnerStatementPaymentStatus;
  paymentStatusTick: OwnerPaymentStatusTick;
};

export type OwnerMonthlySummaryRow = {
  ownerId: string;
  fullName: string;
  phone: string;
  email: string | null;
  isActive: boolean;
  unitCount: number;
  expected: string;
  paid: string;
  remaining: string;
  status: OwnerStatementPaymentStatus;
  statusTick: OwnerPaymentStatusTick;
  units: OwnerMonthlySummaryUnit[];
};

export type OwnerMonthlySummary = {
  period: {
    month: number;
    year: number;
    label: string;
  };
  totals: {
    totalOwners: number;
    assignedUnits: number;
    expected: string;
    paid: string;
    remaining: string;
  };
  owners: OwnerMonthlySummaryRow[];
};
