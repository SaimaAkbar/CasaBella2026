import {
  PaymentMethod,
  Prisma,
  SalaryAdjustmentDirection,
  SalaryTransactionType,
} from '../../generated/prisma/client';
import { serializeMoney } from './salary.finance';

type TxRecord = {
  id: string;
  salaryRecordId: string;
  employeeId: string;
  transactionType: SalaryTransactionType;
  amount: Prisma.Decimal;
  adjustmentDirection: SalaryAdjustmentDirection | null;
  transactionDate: Date;
  reason: string | null;
  paymentMethod: PaymentMethod | null;
  transactionReference: string | null;
  notes: string | null;
  isReversed: boolean;
  reversedAt: Date | null;
  reversalReason: string | null;
  reversesTransactionId: string | null;
  expenseId: string | null;
  createdByUserId: string;
  approvedByUserId: string | null;
  approvedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  employee?: {
    id: string;
    employeeCode: string;
    fullName: string;
    position: string;
    department: string | null;
  } | null;
  salaryRecord?: {
    id: string;
    salaryMonth: number;
    salaryYear: number;
    paymentStatus: string;
    finalized: boolean;
  } | null;
  createdBy?: { id: string; fullName: string } | null;
  approvedBy?: { id: string; fullName: string } | null;
  expense?: { id: string; expenseNumber: string } | null;
};

export function mapSalaryTransaction(tx: TxRecord) {
  return {
    id: tx.id,
    salaryRecordId: tx.salaryRecordId,
    employeeId: tx.employeeId,
    transactionType: tx.transactionType,
    amount: serializeMoney(tx.amount),
    adjustmentDirection: tx.adjustmentDirection,
    transactionDate: tx.transactionDate,
    reason: tx.reason,
    paymentMethod: tx.paymentMethod,
    transactionReference: tx.transactionReference,
    notes: tx.notes,
    isReversed: tx.isReversed,
    reversedAt: tx.reversedAt,
    reversalReason: tx.reversalReason,
    reversesTransactionId: tx.reversesTransactionId,
    expenseId: tx.expenseId,
    createdByUserId: tx.createdByUserId,
    approvedByUserId: tx.approvedByUserId,
    approvedAt: tx.approvedAt,
    createdAt: tx.createdAt,
    updatedAt: tx.updatedAt,
    employee: tx.employee ?? null,
    salaryRecord: tx.salaryRecord ?? null,
    createdBy: tx.createdBy
      ? { id: tx.createdBy.id, fullName: tx.createdBy.fullName }
      : null,
    approvedBy: tx.approvedBy
      ? { id: tx.approvedBy.id, fullName: tx.approvedBy.fullName }
      : null,
    expense: tx.expense ?? null,
  };
}
