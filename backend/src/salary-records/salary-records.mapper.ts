import {
  Prisma,
  SalaryPaymentStatus,
} from '../../generated/prisma/client';
import { serializeMoney } from '../salary-transactions/salary.finance';
import { mapSalaryTransaction } from '../salary-transactions/salary-transactions.mapper';

type RecordRow = {
  id: string;
  employeeId: string;
  salaryMonth: number;
  salaryYear: number;
  baseSalary: Prisma.Decimal;
  totalAdvance: Prisma.Decimal;
  totalDeductions: Prisma.Decimal;
  totalBonus: Prisma.Decimal;
  totalPaid: Prisma.Decimal;
  netPayable: Prisma.Decimal;
  remainingBalance: Prisma.Decimal;
  paymentStatus: SalaryPaymentStatus;
  finalized: boolean;
  finalizedAt: Date | null;
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
    phone: string;
  } | null;
  createdBy?: { id: string; fullName: string } | null;
  approvedBy?: { id: string; fullName: string } | null;
  transactions?: Parameters<typeof mapSalaryTransaction>[0][];
};

export function mapSalaryRecord(record: RecordRow) {
  return {
    id: record.id,
    employeeId: record.employeeId,
    salaryMonth: record.salaryMonth,
    salaryYear: record.salaryYear,
    baseSalary: serializeMoney(record.baseSalary),
    totalAdvance: serializeMoney(record.totalAdvance),
    totalDeductions: serializeMoney(record.totalDeductions),
    totalBonus: serializeMoney(record.totalBonus),
    totalPaid: serializeMoney(record.totalPaid),
    netPayable: serializeMoney(record.netPayable),
    remainingBalance: serializeMoney(record.remainingBalance),
    paymentStatus: record.paymentStatus,
    finalized: record.finalized,
    finalizedAt: record.finalizedAt,
    createdByUserId: record.createdByUserId,
    approvedByUserId: record.approvedByUserId,
    approvedAt: record.approvedAt,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    employee: record.employee ?? null,
    createdBy: record.createdBy
      ? { id: record.createdBy.id, fullName: record.createdBy.fullName }
      : null,
    approvedBy: record.approvedBy
      ? { id: record.approvedBy.id, fullName: record.approvedBy.fullName }
      : null,
    transactions: record.transactions?.map(mapSalaryTransaction),
  };
}
