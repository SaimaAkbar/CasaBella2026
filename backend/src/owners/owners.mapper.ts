import {
  Owner,
  OwnerAccountDirection,
  OwnerAssignmentStatus,
  OwnerMonthlyStatement,
  OwnerUnitAssignment,
  Payment,
  Prisma,
  Role,
} from '../../generated/prisma/client';
import { paymentStatusTick, serializeMoney } from './owner-finance';

type OwnerWithCounts = Owner & {
  _count?: {
    unitAssignments?: number;
  };
  unitAssignments?: Array<
    OwnerUnitAssignment & {
      property?: { id: string; name: string };
      unit?: { id: string; unitNumber: string; floor: number | null };
    }
  >;
};

export function mapOwnerForRole(
  owner: OwnerWithCounts,
  role: Role,
  extras?: {
    propertyCount?: number;
    unitCount?: number;
    assignedUnitCount?: number;
    monthlyExpected?: string;
    paidThisMonth?: string;
    remaining?: string;
    currentMonthPaid?: string;
    currentMonthRemaining?: string;
  },
) {
  const showSensitive = role === Role.SUPER_ADMIN;
  const assignedUnitCount =
    extras?.assignedUnitCount ?? extras?.unitCount ?? null;
  const currentMonthPaid =
    extras?.currentMonthPaid ?? extras?.paidThisMonth ?? null;
  const currentMonthRemaining =
    extras?.currentMonthRemaining ?? extras?.remaining ?? null;

  return {
    id: owner.id,
    fullName: owner.fullName,
    fatherOrSpouseName: owner.fatherOrSpouseName,
    phone: owner.phone,
    alternatePhone: owner.alternatePhone,
    email: owner.email,
    cnic: showSensitive ? owner.cnic : null,
    address: owner.address,
    city: owner.city,
    bankName: showSensitive ? owner.bankName : null,
    accountTitle: showSensitive ? owner.accountTitle : null,
    accountNumberOrIban: showSensitive ? owner.accountNumberOrIban : null,
    branchName: showSensitive ? owner.branchName : null,
    notes: owner.notes,
    isActive: owner.isActive,
    createdAt: owner.createdAt.toISOString(),
    updatedAt: owner.updatedAt.toISOString(),
    propertyCount: extras?.propertyCount ?? null,
    unitCount: assignedUnitCount,
    assignedUnitCount,
    monthlyExpected: extras?.monthlyExpected ?? null,
    paidThisMonth: currentMonthPaid,
    remaining: currentMonthRemaining,
    currentMonthPaid,
    currentMonthRemaining,
  };
}

export function mapAssignment(
  assignment: OwnerUnitAssignment & {
    owner?: { id: string; fullName: string; phone: string };
    property?: { id: string; name: string };
    unit?: {
      id: string;
      unitNumber: string;
      floor: number | null;
      unitType: string;
    };
  },
) {
  return {
    id: assignment.id,
    ownerId: assignment.ownerId,
    propertyId: assignment.propertyId,
    unitId: assignment.unitId,
    accountDirection: assignment.accountDirection,
    ownershipPercentage: serializeMoney(assignment.ownershipPercentage),
    fixedMonthlyAmount: serializeMoney(assignment.fixedMonthlyAmount),
    agreementStart: assignment.agreementStart.toISOString(),
    agreementEnd: assignment.agreementEnd?.toISOString() ?? null,
    dueDay: assignment.dueDay,
    status: assignment.status,
    notes: assignment.notes,
    createdAt: assignment.createdAt.toISOString(),
    updatedAt: assignment.updatedAt.toISOString(),
    endedAt: assignment.endedAt?.toISOString() ?? null,
    owner: assignment.owner
      ? {
          id: assignment.owner.id,
          fullName: assignment.owner.fullName,
          phone: assignment.owner.phone,
        }
      : undefined,
    property: assignment.property
      ? { id: assignment.property.id, name: assignment.property.name }
      : undefined,
    unit: assignment.unit
      ? {
          id: assignment.unit.id,
          unitNumber: assignment.unit.unitNumber,
          floor: assignment.unit.floor,
          unitType: assignment.unit.unitType,
        }
      : undefined,
  };
}

export function mapStatement(
  statement: OwnerMonthlyStatement & {
    owner?: { id: string; fullName: string; phone: string };
    property?: { id: string; name: string };
    unit?: { id: string; unitNumber: string; floor: number | null };
    payments?: Array<{
      paymentMethod: string;
      bankName: string | null;
      paymentDate: Date;
      transactionReference: string | null;
      status: string;
      transactionType: string;
    }>;
  },
) {
  const latestPayment = statement.payments
    ?.filter((p) => p.status === 'COMPLETED' && p.transactionType === 'PAYMENT')
    .sort((a, b) => b.paymentDate.getTime() - a.paymentDate.getTime())[0];

  return {
    id: statement.id,
    ownerUnitAssignmentId: statement.ownerUnitAssignmentId,
    ownerId: statement.ownerId,
    propertyId: statement.propertyId,
    unitId: statement.unitId,
    statementMonth: statement.statementMonth,
    statementYear: statement.statementYear,
    accountDirection: statement.accountDirection,
    expectedAmount: serializeMoney(statement.expectedAmount),
    previousBalance: serializeMoney(statement.previousBalance),
    adjustmentAmount: serializeMoney(statement.adjustmentAmount),
    totalPayableOrReceivable: serializeMoney(statement.totalPayableOrReceivable),
    totalPaid: serializeMoney(statement.totalPaid),
    remainingAmount: serializeMoney(statement.remainingAmount),
    dueDate: statement.dueDate.toISOString(),
    paymentStatus: statement.paymentStatus,
    paymentStatusTick: paymentStatusTick(statement.paymentStatus),
    finalized: statement.finalized,
    notes: statement.notes,
    createdAt: statement.createdAt.toISOString(),
    updatedAt: statement.updatedAt.toISOString(),
    owner: statement.owner
      ? {
          id: statement.owner.id,
          fullName: statement.owner.fullName,
          phone: statement.owner.phone,
        }
      : undefined,
    property: statement.property
      ? { id: statement.property.id, name: statement.property.name }
      : undefined,
    unit: statement.unit
      ? {
          id: statement.unit.id,
          unitNumber: statement.unit.unitNumber,
          floor: statement.unit.floor,
        }
      : undefined,
    latestPaymentMethod: latestPayment?.paymentMethod ?? null,
    latestBankName: latestPayment?.bankName ?? null,
    latestPaymentDate: latestPayment?.paymentDate?.toISOString() ?? null,
    latestTransactionReference: latestPayment?.transactionReference ?? null,
  };
}

export function mapOwnerPayment(
  payment: Payment & {
    owner?: { id: string; fullName: string } | null;
    ownerMonthlyStatement?: {
      id: string;
      statementMonth: number;
      statementYear: number;
      propertyId: string;
      unitId: string;
      accountDirection: OwnerAccountDirection;
      property?: { id: string; name: string };
      unit?: { id: string; unitNumber: string };
    } | null;
    createdBy?: { id: string; fullName: string } | null;
    approvedBy?: { id: string; fullName: string } | null;
  },
) {
  return {
    id: payment.id,
    paymentNumber: payment.paymentNumber,
    paymentForType: payment.paymentForType,
    ownerMonthlyStatementId: payment.ownerMonthlyStatementId,
    ownerId: payment.ownerId,
    amount: serializeMoney(payment.amount),
    paymentMethod: payment.paymentMethod,
    bankName: payment.bankName,
    accountTitle: payment.accountTitle,
    transactionReference: payment.transactionReference,
    paymentDate: payment.paymentDate.toISOString(),
    transactionType: payment.transactionType,
    status: payment.status,
    notes: payment.notes,
    createdByUserId: payment.createdByUserId,
    approvedByUserId: payment.approvedByUserId,
    createdAt: payment.createdAt.toISOString(),
    owner: payment.owner
      ? { id: payment.owner.id, fullName: payment.owner.fullName }
      : null,
    statement: payment.ownerMonthlyStatement
      ? {
          id: payment.ownerMonthlyStatement.id,
          statementMonth: payment.ownerMonthlyStatement.statementMonth,
          statementYear: payment.ownerMonthlyStatement.statementYear,
          accountDirection: payment.ownerMonthlyStatement.accountDirection,
          property: payment.ownerMonthlyStatement.property,
          unit: payment.ownerMonthlyStatement.unit,
        }
      : null,
    createdBy: payment.createdBy,
    approvedBy: payment.approvedBy,
  };
}

export function accountDirectionLabel(direction: OwnerAccountDirection) {
  return direction === OwnerAccountDirection.RECEIVABLE_FROM_OWNER
    ? 'Receivable'
    : 'Payable';
}

export function assignmentStatusLabel(status: OwnerAssignmentStatus) {
  return status;
}

export type DecimalLike = Prisma.Decimal | number | string;
