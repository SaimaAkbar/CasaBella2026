export type EmployeeStatus =
  | 'ACTIVE'
  | 'INACTIVE'
  | 'RESIGNED'
  | 'TERMINATED';

export type SalaryPaymentStatus = 'UNPAID' | 'PARTIAL' | 'PAID';

export type SalaryTransactionType =
  | 'SALARY_PAYMENT'
  | 'ADVANCE'
  | 'DEDUCTION'
  | 'BONUS'
  | 'ADJUSTMENT'
  | 'REVERSAL';

export type SalaryAdjustmentDirection = 'INCREASE' | 'DECREASE';

export type PaymentMethod =
  | 'CASH'
  | 'BANK_TRANSFER'
  | 'CARD'
  | 'EASYPAISA'
  | 'JAZZCASH'
  | 'OTHER';

export type Employee = {
  id: string;
  employeeCode: string;
  fullName: string;
  fatherOrSpouseName?: string | null;
  fatherName?: string | null;
  phone: string;
  alternatePhone?: string | null;
  email?: string | null;
  cnic?: string | null;
  address?: string | null;
  city?: string | null;
  position: string;
  department?: string | null;
  joiningDate: string;
  monthlySalary?: string | null;
  bankName?: string | null;
  accountTitle?: string | null;
  accountNumberOrIban?: string | null;
  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;
  status: EmployeeStatus;
  notes?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  /** Populated on list when current-month record exists */
  currentMonthStatus?: SalaryPaymentStatus | 'NONE';
  currentMonthHasAdvance?: boolean;
};

export type EmployeeSummary = {
  month?: number;
  year?: number;
  totalEmployees: number;
  activeEmployees: number;
  inactiveEmployees: number;
  totalSalary?: string;
  monthlySalaryPayable?: string;
  salaryPaid?: string;
  salaryOutstanding?: string;
  totalAdvances?: string;
};

export type EmployeeInput = {
  fullName: string;
  fatherOrSpouseName: string;
  phone: string;
  alternatePhone?: string;
  email?: string;
  cnic?: string;
  address?: string;
  city?: string;
  position: string;
  department?: string;
  joiningDate: string;
  monthlySalary?: number;
  bankName?: string;
  accountTitle?: string;
  accountNumberOrIban?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  status?: EmployeeStatus;
  notes?: string;
  salaryEffectiveMonth?: number;
  salaryEffectiveYear?: number;
  salaryChangeReason?: string;
};

export type EmployeeQuery = {
  status?: EmployeeStatus | '';
  department?: string;
  position?: string;
  isActive?: boolean | '';
  search?: string;
};

export type YearlyMonthStatus = {
  month: number;
  year: number;
  status: SalaryPaymentStatus | 'NONE';
  salaryRecordId: string | null;
  hasAdvance: boolean;
};

export type SalaryRecord = {
  id: string;
  employeeId: string;
  salaryMonth: number;
  salaryYear: number;
  baseSalary: string;
  totalAdvance: string;
  totalDeductions: string;
  totalBonus: string;
  totalPaid: string;
  netPayable: string;
  remainingBalance: string;
  paymentStatus: SalaryPaymentStatus;
  hasAdvance?: boolean;
  finalized: boolean;
  finalizedAt: string | null;
  dueDate?: string | null;
  employee?: {
    id: string;
    employeeCode: string;
    fullName: string;
    position: string;
    department: string | null;
    phone: string;
  } | null;
  createdBy?: { id: string; fullName: string } | null;
  approvedBy?: { id: string; fullName: string } | null;
  transactions?: SalaryTransaction[];
};

export type SalaryTransaction = {
  id: string;
  salaryRecordId: string;
  employeeId: string;
  transactionType: SalaryTransactionType;
  amount: string;
  adjustmentDirection?: SalaryAdjustmentDirection | null;
  transactionDate: string;
  reason: string | null;
  paymentMethod: PaymentMethod | null;
  transactionReference: string | null;
  notes: string | null;
  isReversed: boolean;
  reversedAt?: string | null;
  reversalReason?: string | null;
  reversesTransactionId?: string | null;
  expenseId: string | null;
  employee?: {
    id: string;
    employeeCode: string;
    fullName: string;
  } | null;
  salaryRecord?: {
    id: string;
    salaryMonth: number;
    salaryYear: number;
  } | null;
  createdBy?: { id: string; fullName: string } | null;
  expense?: { id: string; expenseNumber: string } | null;
};

export type CreateSalaryTransactionInput = {
  salaryRecordId?: string;
  employeeId: string;
  salaryMonth?: number;
  salaryYear?: number;
  transactionType: SalaryTransactionType;
  amount: number;
  adjustmentDirection?: SalaryAdjustmentDirection;
  transactionDate: string;
  reason?: string;
  paymentMethod?: PaymentMethod;
  transactionReference?: string;
  notes?: string;
};
