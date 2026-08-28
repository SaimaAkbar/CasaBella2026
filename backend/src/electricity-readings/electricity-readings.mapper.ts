import { Prisma } from '../../generated/prisma/client';
import { serializeMoney } from '../expenses/expense.finance';
import { computeFinalBill } from './electricity-bill.finance';

type ReadingRecord = {
  id: string;
  propertyId: string;
  unitId: string | null;
  previousUnits: Prisma.Decimal;
  currentUnits: Prisma.Decimal | null;
  consumedUnits: Prisma.Decimal | null;
  ratePerUnit: Prisma.Decimal;
  calculatedAmount: Prisma.Decimal;
  lateFineAmount?: Prisma.Decimal | null;
  lateFineApplied?: boolean;
  lateFinePercentage?: Prisma.Decimal | number | null;
  dueDate?: Date | null;
  billingMonth: number;
  billingYear: number;
  readingDate: Date;
  notes?: string | null;
  expenseId?: string | null;
  property?: { id: string; name: string } | null;
  unit?: { id: string; unitNumber: string; propertyId?: string } | null;
  expense?: {
    id: string;
    expenseNumber?: string;
    amount: Prisma.Decimal;
    paidAmount: Prisma.Decimal;
    remainingAmount: Prisma.Decimal;
    paymentStatus: string;
    isFinalized?: boolean;
    dueDate?: Date | null;
  } | null;
};

export function mapElectricityReading(reading: ReadingRecord) {
  const lateFineAmount = reading.lateFineAmount ?? new Prisma.Decimal(0);
  const finalBill = computeFinalBill(reading.calculatedAmount, lateFineAmount);
  return {
    id: reading.id,
    propertyId: reading.propertyId,
    unitId: reading.unitId,
    previousUnits: serializeMoney(reading.previousUnits),
    previousReading: serializeMoney(reading.previousUnits),
    currentUnits:
      reading.currentUnits == null ? null : serializeMoney(reading.currentUnits),
    currentReading:
      reading.currentUnits == null ? null : serializeMoney(reading.currentUnits),
    consumedUnits:
      reading.consumedUnits == null
        ? null
        : serializeMoney(reading.consumedUnits),
    ratePerUnit: serializeMoney(reading.ratePerUnit),
    calculatedAmount: serializeMoney(reading.calculatedAmount),
    lateFineAmount: serializeMoney(lateFineAmount),
    lateFineApplied: Boolean(reading.lateFineApplied),
    finalBill: serializeMoney(finalBill),
    paidAmount: serializeMoney(reading.expense?.paidAmount),
    remainingAmount: serializeMoney(reading.expense?.remainingAmount),
    paymentStatus: reading.expense?.paymentStatus ?? 'UNPAID',
    dueDate: reading.dueDate ?? reading.expense?.dueDate ?? null,
    billingMonth: reading.billingMonth,
    billingYear: reading.billingYear,
    readingDate: reading.readingDate,
    notes: reading.notes ?? null,
    expenseId: reading.expenseId ?? reading.expense?.id ?? null,
    lateFinePercentage:
      reading.lateFinePercentage == null
        ? undefined
        : String(reading.lateFinePercentage),
    readingRequired: reading.currentUnits == null,
    property: reading.property ?? null,
    unit: reading.unit ?? null,
    expense: reading.expense
      ? {
          id: reading.expense.id,
          expenseNumber: reading.expense.expenseNumber,
          amount: serializeMoney(reading.expense.amount),
          paidAmount: serializeMoney(reading.expense.paidAmount),
          remainingAmount: serializeMoney(reading.expense.remainingAmount),
          paymentStatus: reading.expense.paymentStatus,
          isFinalized: Boolean(reading.expense.isFinalized),
          dueDate: reading.expense.dueDate ?? null,
        }
      : null,
  };
}
