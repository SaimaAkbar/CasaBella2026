import { BadRequestException } from '@nestjs/common';
import {
  Prisma,
  SalaryAdjustmentDirection,
  SalaryPaymentStatus,
  SalaryTransactionType,
} from '../../generated/prisma/client';

export function toPositiveMoney(value: number) {
  if (value < 0) {
    throw new BadRequestException('Monetary values cannot be negative');
  }
  return new Prisma.Decimal(value);
}

type TxRow = {
  transactionType: SalaryTransactionType;
  amount: Prisma.Decimal;
  adjustmentDirection: SalaryAdjustmentDirection | null;
  isReversed: boolean;
};

export function recalculateSalaryTotals(
  baseSalary: Prisma.Decimal,
  transactions: TxRow[],
) {
  let totalAdvance = new Prisma.Decimal(0);
  let totalDeductions = new Prisma.Decimal(0);
  let totalBonus = new Prisma.Decimal(0);
  let totalPaid = new Prisma.Decimal(0);
  let adjustmentNet = new Prisma.Decimal(0);

  for (const tx of transactions) {
    if (tx.isReversed) continue;
    const amount = new Prisma.Decimal(tx.amount);

    switch (tx.transactionType) {
      case SalaryTransactionType.ADVANCE:
        totalAdvance = totalAdvance.plus(amount);
        break;
      case SalaryTransactionType.DEDUCTION:
        totalDeductions = totalDeductions.plus(amount);
        break;
      case SalaryTransactionType.BONUS:
        totalBonus = totalBonus.plus(amount);
        break;
      case SalaryTransactionType.SALARY_PAYMENT:
        totalPaid = totalPaid.plus(amount);
        break;
      case SalaryTransactionType.ADJUSTMENT:
        if (tx.adjustmentDirection === SalaryAdjustmentDirection.INCREASE) {
          adjustmentNet = adjustmentNet.plus(amount);
        } else if (
          tx.adjustmentDirection === SalaryAdjustmentDirection.DECREASE
        ) {
          adjustmentNet = adjustmentNet.minus(amount);
        }
        break;
      case SalaryTransactionType.REVERSAL:
        // Audit-only; original row is marked isReversed and skipped above.
        break;
      default:
        break;
    }
  }

  const netPayable = baseSalary
    .plus(totalBonus)
    .minus(totalAdvance)
    .minus(totalDeductions)
    .plus(adjustmentNet);

  if (netPayable.lessThan(0)) {
    throw new BadRequestException(
      'Net payable cannot be negative after this transaction',
    );
  }

  const remainingBalance = netPayable.minus(totalPaid);
  if (remainingBalance.lessThan(0)) {
    throw new BadRequestException(
      'Salary payment would exceed remaining balance',
    );
  }

  return {
    totalAdvance,
    totalDeductions,
    totalBonus,
    totalPaid,
    netPayable,
    remainingBalance,
    paymentStatus: deriveSalaryPaymentStatus(remainingBalance, totalPaid),
  };
}

export function deriveSalaryPaymentStatus(
  remainingBalance: Prisma.Decimal,
  totalPaid: Prisma.Decimal,
): SalaryPaymentStatus {
  if (remainingBalance.lessThanOrEqualTo(0)) {
    return SalaryPaymentStatus.PAID;
  }
  if (totalPaid.greaterThan(0)) {
    return SalaryPaymentStatus.PARTIAL;
  }
  return SalaryPaymentStatus.UNPAID;
}

export function serializeMoney(value: Prisma.Decimal | null | undefined) {
  return value?.toString() ?? '0';
}
