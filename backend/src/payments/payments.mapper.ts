import {
  PaymentForType,
  PaymentMethod,
  PaymentStatus,
  PaymentTransactionType,
  Prisma,
  Role,
} from '../../generated/prisma/client';
import { serializeMoney } from './payment-balance';

type PaymentRecord = {
  id: string;
  paymentNumber: string;
  paymentForType: PaymentForType;
  bookingId: string | null;
  monthlyTenancyId: string | null;
  transactionType: PaymentTransactionType;
  amount: Prisma.Decimal;
  paymentMethod: PaymentMethod;
  transactionReference: string | null;
  paymentDate: Date;
  notes: string | null;
  proofAttachmentUrl: string | null;
  status: PaymentStatus;
  originalPaymentId: string | null;
  createdByUserId: string;
  approvedByUserId: string | null;
  approvedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  booking?: {
    id: string;
    bookingNumber: string;
    totalAmount: Prisma.Decimal;
    receivedAmount: Prisma.Decimal;
    remainingAmount: Prisma.Decimal;
    paymentState: string;
    guest?: { id: string; fullName: string; phone: string };
    unit?: {
      id: string;
      unitNumber: string;
      property?: { id: string; name: string };
    };
  } | null;
  monthlyTenancy?: {
    id: string;
    totalPayable: Prisma.Decimal;
    totalReceived: Prisma.Decimal;
    remainingBalance: Prisma.Decimal;
    tenant?: { id: string; fullName: string; phone: string };
    unit?: {
      id: string;
      unitNumber: string;
      property?: { id: string; name: string };
    };
  } | null;
  createdBy?: { id: string; fullName: string } | null;
  approvedBy?: { id: string; fullName: string } | null;
  originalPayment?: {
    id: string;
    paymentNumber: string;
    amount: Prisma.Decimal;
  } | null;
};

export function mapPaymentForRole(payment: PaymentRecord, role: Role) {
  const base = {
    id: payment.id,
    paymentNumber: payment.paymentNumber,
    paymentForType: payment.paymentForType,
    bookingId: payment.bookingId,
    monthlyTenancyId: payment.monthlyTenancyId,
    transactionType: payment.transactionType,
    amount: serializeMoney(payment.amount),
    paymentMethod: payment.paymentMethod,
    transactionReference: payment.transactionReference,
    paymentDate: payment.paymentDate,
    notes: payment.notes,
    status: payment.status,
    originalPaymentId: payment.originalPaymentId,
    createdByUserId: payment.createdByUserId,
    approvedByUserId: payment.approvedByUserId,
    approvedAt: payment.approvedAt,
    createdAt: payment.createdAt,
    updatedAt: payment.updatedAt,
    createdBy: payment.createdBy
      ? { id: payment.createdBy.id, fullName: payment.createdBy.fullName }
      : null,
    approvedBy: payment.approvedBy
      ? { id: payment.approvedBy.id, fullName: payment.approvedBy.fullName }
      : null,
    originalPayment: payment.originalPayment
      ? {
          id: payment.originalPayment.id,
          paymentNumber: payment.originalPayment.paymentNumber,
          amount: serializeMoney(payment.originalPayment.amount),
        }
      : null,
    booking: payment.booking
      ? {
          id: payment.booking.id,
          bookingNumber: payment.booking.bookingNumber,
          totalAmount: serializeMoney(payment.booking.totalAmount),
          receivedAmount: serializeMoney(payment.booking.receivedAmount),
          remainingAmount: serializeMoney(payment.booking.remainingAmount),
          paymentState: payment.booking.paymentState,
          guest: payment.booking.guest,
          unit: payment.booking.unit,
        }
      : null,
    monthlyTenancy: payment.monthlyTenancy
      ? {
          id: payment.monthlyTenancy.id,
          totalPayable: serializeMoney(payment.monthlyTenancy.totalPayable),
          totalReceived: serializeMoney(payment.monthlyTenancy.totalReceived),
          remainingBalance: serializeMoney(
            payment.monthlyTenancy.remainingBalance,
          ),
          tenant: payment.monthlyTenancy.tenant,
          unit: payment.monthlyTenancy.unit,
        }
      : null,
  };

  if (role === Role.RECEPTIONIST) {
    return {
      ...base,
      proofAttachmentUrl: null,
    };
  }

  return {
    ...base,
    proofAttachmentUrl: payment.proofAttachmentUrl,
  };
}

export function buildReceipt(payment: PaymentRecord) {
  const booking = payment.booking;
  const tenancy = payment.monthlyTenancy;
  const payerName =
    booking?.guest?.fullName ?? tenancy?.tenant?.fullName ?? '—';
  const propertyName =
    booking?.unit?.property?.name ?? tenancy?.unit?.property?.name ?? '—';
  const unitNumber =
    booking?.unit?.unitNumber ?? tenancy?.unit?.unitNumber ?? '—';
  const totalPayable = booking?.totalAmount ?? tenancy?.totalPayable;
  const totalReceived = booking?.receivedAmount ?? tenancy?.totalReceived;
  const remaining = booking?.remainingAmount ?? tenancy?.remainingBalance;
  const previousReceived = totalReceived
    ? totalReceived.minus(
        payment.transactionType === 'PAYMENT' ||
          (payment.transactionType === 'ADJUSTMENT' &&
            !/ADJUSTMENT_DIRECTION:DEBIT/i.test(payment.notes ?? ''))
          ? payment.amount
          : new Prisma.Decimal(0),
      )
    : new Prisma.Decimal(0);

  return {
    hotelOrPropertyName: propertyName,
    paymentNumber: payment.paymentNumber,
    paymentDateTime: payment.paymentDate,
    payerName,
    guestOrTenant: payerName,
    property: propertyName,
    unit: unitNumber,
    paymentType: payment.paymentForType,
    transactionType: payment.transactionType,
    amount: serializeMoney(payment.amount),
    paymentMethod: payment.paymentMethod,
    transactionReference: payment.transactionReference,
    totalPayable: serializeMoney(totalPayable),
    previousReceived: serializeMoney(
      previousReceived.lessThan(0) ? new Prisma.Decimal(0) : previousReceived,
    ),
    currentPayment: serializeMoney(payment.amount),
    totalReceived: serializeMoney(totalReceived),
    remainingBalance: serializeMoney(remaining),
    receivedBy: payment.createdBy?.fullName ?? '—',
    notes: payment.notes,
    status: payment.status,
  };
}
