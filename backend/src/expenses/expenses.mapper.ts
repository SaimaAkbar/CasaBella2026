import {
  ExpensePaymentStatus,
  ExpenseScope,
  PaymentMethod,
  Prisma,
  Role,
} from '../../generated/prisma/client';
import { serializeMoney } from './expense.finance';

type ExpenseRecord = {
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
  expenseDate: Date;
  amount: Prisma.Decimal;
  paidAmount: Prisma.Decimal;
  remainingAmount: Prisma.Decimal;
  paymentStatus: ExpensePaymentStatus;
  paymentMethod: PaymentMethod | null;
  vendorName: string | null;
  referenceNumber: string | null;
  description: string | null;
  receiptUrl: string | null;
  metadata: Prisma.JsonValue | null;
  createdByUserId: string;
  approvedByUserId: string | null;
  approvedAt: Date | null;
  isFinalized: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
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
  electricityReading?: {
    id: string;
    previousUnits: Prisma.Decimal;
    currentUnits: Prisma.Decimal | null;
    consumedUnits: Prisma.Decimal | null;
    ratePerUnit: Prisma.Decimal;
    calculatedAmount: Prisma.Decimal;
    lateFineAmount?: Prisma.Decimal;
    lateFineApplied?: boolean;
    dueDate?: Date | null;
    billingMonth: number;
    billingYear: number;
    readingDate: Date;
  } | null;
  billingMonth?: number | null;
  billingYear?: number | null;
  dueDate?: Date | null;
  paymentDate?: Date | null;
  bankName?: string | null;
  notes?: string | null;
  payments?: Array<{
    id: string;
    amount: Prisma.Decimal;
    paymentDate: Date;
    paymentMethod: PaymentMethod;
    bankName: string | null;
    transactionReference: string | null;
    notes: string | null;
    createdBy?: { id: string; fullName: string } | null;
  }>;
};

export function mapExpenseForRole(expense: ExpenseRecord, role: Role) {
  const base = {
    id: expense.id,
    expenseNumber: expense.expenseNumber,
    categoryId: expense.categoryId,
    expenseName: expense.expenseName ?? expense.category?.name ?? null,
    expenseScope: expense.expenseScope,
    propertyId: expense.propertyId,
    unitId: expense.unitId,
    bookingId: expense.bookingId,
    monthlyTenancyId: expense.monthlyTenancyId,
    parentExpenseId: expense.parentExpenseId ?? null,
    excludeFromFinancials: Boolean(expense.excludeFromFinancials),
    expenseDate: expense.expenseDate,
    amount: serializeMoney(expense.amount),
    paidAmount: serializeMoney(expense.paidAmount),
    remainingAmount: serializeMoney(expense.remainingAmount),
    paymentStatus: expense.paymentStatus,
    paymentMethod: expense.paymentMethod,
    vendorName: expense.vendorName,
    referenceNumber: expense.referenceNumber,
    description: expense.description,
    receiptUrl: expense.receiptUrl,
    metadata: expense.metadata,
    billingMonth: expense.billingMonth ?? null,
    billingYear: expense.billingYear ?? null,
    dueDate: expense.dueDate ?? null,
    paymentDate: expense.paymentDate ?? null,
    bankName: expense.bankName ?? null,
    notes: expense.notes ?? null,
    createdByUserId: expense.createdByUserId,
    approvedByUserId: expense.approvedByUserId,
    approvedAt: expense.approvedAt,
    isFinalized: expense.isFinalized,
    isActive: expense.isActive,
    createdAt: expense.createdAt,
    updatedAt: expense.updatedAt,
    category: expense.category,
    property: expense.property,
    unit: expense.unit,
    booking: expense.booking,
    monthlyTenancy: expense.monthlyTenancy,
    createdBy: expense.createdBy
      ? { id: expense.createdBy.id, fullName: expense.createdBy.fullName }
      : null,
    approvedBy: expense.approvedBy
      ? { id: expense.approvedBy.id, fullName: expense.approvedBy.fullName }
      : null,
    payments: (expense.payments ?? []).map((p) => ({
      id: p.id,
      amount: serializeMoney(p.amount),
      paymentDate: p.paymentDate,
      paymentMethod: p.paymentMethod,
      bankName: p.bankName,
      transactionReference: p.transactionReference,
      notes: p.notes,
      createdBy: p.createdBy ?? null,
    })),
    electricityReading: expense.electricityReading
      ? {
          id: expense.electricityReading.id,
          previousUnits: serializeMoney(expense.electricityReading.previousUnits),
          currentUnits:
            expense.electricityReading.currentUnits == null
              ? null
              : serializeMoney(expense.electricityReading.currentUnits),
          consumedUnits:
            expense.electricityReading.consumedUnits == null
              ? null
              : serializeMoney(expense.electricityReading.consumedUnits),
          ratePerUnit: serializeMoney(expense.electricityReading.ratePerUnit),
          calculatedAmount: serializeMoney(
            expense.electricityReading.calculatedAmount,
          ),
          lateFineAmount: serializeMoney(
            expense.electricityReading.lateFineAmount,
          ),
          lateFineApplied: Boolean(expense.electricityReading.lateFineApplied),
          dueDate: expense.electricityReading.dueDate ?? null,
          billingMonth: expense.electricityReading.billingMonth,
          billingYear: expense.electricityReading.billingYear,
          readingDate: expense.electricityReading.readingDate,
        }
      : null,
  };

  if (role === Role.RECEPTIONIST) {
    // Operational view only — hide broad financial metadata noise
    return {
      ...base,
      receiptUrl: null,
      approvedBy: null,
      approvedAt: null,
    };
  }

  return base;
}
