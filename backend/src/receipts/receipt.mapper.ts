import {
  PaymentForType,
  PaymentMethod,
  PaymentStatus,
  PaymentTransactionType,
  Prisma,
  Role,
} from '../../generated/prisma/client';
import { serializeMoney } from '../payments/payment-balance';

export type ReceiptSourceType = 'payment' | 'expense_payment' | 'owner_payment';

export type ReceiptType =
  | 'MONTHLY_RENT'
  | 'ELECTRICITY'
  | 'DAILY_GUEST'
  | 'HOURLY_GUEST'
  | 'OWNER_PAYMENT';

export type ReceiptPaymentStatusLabel =
  | 'FULLY PAID'
  | 'PARTIAL PAYMENT'
  | 'OUTSTANDING BALANCE';

export type ThermalReceiptDto = {
  sourceType: ReceiptSourceType;
  sourceId: string;
  receiptNumber: string;
  receiptType: ReceiptType;
  isReprint: boolean;
  copyLabel: 'REPRINT' | 'COPY' | null;
  businessName: string;
  businessSubtitle: string;
  paymentNumber: string;
  paymentDate: string;
  paymentTime: string;
  customerName: string;
  room: string;
  property: string;
  paymentTypeLabel: string;
  billingMonth: string | null;
  checkInDateTime: string | null;
  checkOutDateTime: string | null;
  bookingType: string | null;
  stayLabel: string | null;
  roomCharges: string | null;
  otherAmenities: string | null;
  electricityBill: string | null;
  lateFine: string | null;
  totalBill: string;
  previousOutstanding: string;
  currentPayment: string;
  totalPaid: string;
  remainingBalance: string;
  paymentStatusLabel: ReceiptPaymentStatusLabel;
  paymentMethod: string;
  receivedBy: string;
  footer: string;
  printCount: number;
  lastPrintedAt: string | null;
  notes: string | null;
  physicalPrint?: {
    attempted: boolean;
    success: boolean;
    printerName?: string;
    error?: string;
  };
};

function formatMethod(method: PaymentMethod | string | null | undefined) {
  return (method ?? 'CASH').replaceAll('_', ' ');
}

function formatBillingMonth(month?: number | null, year?: number | null) {
  if (!month || !year) return null;
  const date = new Date(Date.UTC(year, month - 1, 1));
  return date.toLocaleString('en-US', { month: 'long', year: 'numeric' });
}

function derivePaymentStatusLabel(
  remaining: Prisma.Decimal | string | null | undefined,
  totalPaid?: Prisma.Decimal | string | null,
): ReceiptPaymentStatusLabel {
  const remainingValue = new Prisma.Decimal(remaining ?? 0);
  if (remainingValue.lessThanOrEqualTo(0)) return 'FULLY PAID';
  const paidValue = new Prisma.Decimal(totalPaid ?? 0);
  if (paidValue.lessThanOrEqualTo(0)) return 'OUTSTANDING BALANCE';
  return 'PARTIAL PAYMENT';
}

function formatTime(date: Date) {
  return date.toLocaleTimeString('en-PK', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

function formatDate(date: Date) {
  return date.toLocaleDateString('en-GB');
}

type PaymentReceiptRecord = {
  id: string;
  paymentNumber: string;
  paymentForType: PaymentForType;
  transactionType: PaymentTransactionType;
  amount: Prisma.Decimal;
  paymentMethod: PaymentMethod;
  paymentDate: Date;
  notes: string | null;
  status: PaymentStatus;
  receiptNumber: string | null;
  printCount: number;
  lastPrintedAt: Date | null;
  booking?: {
    bookingNumber: string;
    bookingType: string;
    checkInDateTime: Date;
    checkOutDateTime: Date;
    numberOfHours: number | null;
    numberOfDays: number | null;
    roomCharges: Prisma.Decimal;
    otherCharges: Prisma.Decimal;
    otherChargesDescription: string | null;
    totalAmount: Prisma.Decimal;
    receivedAmount: Prisma.Decimal;
    remainingAmount: Prisma.Decimal;
    guest?: { fullName: string };
    unit?: { unitNumber: string; property?: { name: string } };
  } | null;
  monthlyTenancy?: {
    monthlyRent: Prisma.Decimal;
    totalPayable: Prisma.Decimal;
    totalReceived: Prisma.Decimal;
    remainingBalance: Prisma.Decimal;
    agreementStart: Date;
    tenant?: { fullName: string };
    unit?: { unitNumber: string; property?: { name: string } };
  } | null;
  ownerMonthlyStatement?: {
    statementMonth: number;
    statementYear: number;
    expectedAmount: Prisma.Decimal;
    totalPaid: Prisma.Decimal;
    remainingAmount: Prisma.Decimal;
    property?: { name: string };
    unit?: { unitNumber: string };
  } | null;
  owner?: { fullName: string } | null;
  createdBy?: { fullName: string } | null;
};

type ExpensePaymentReceiptRecord = {
  id: string;
  amount: Prisma.Decimal;
  paymentDate: Date;
  paymentMethod: PaymentMethod;
  notes: string | null;
  receiptNumber: string | null;
  printCount: number;
  lastPrintedAt: Date | null;
  createdBy?: { fullName: string } | null;
  expense: {
    expenseNumber: string;
    amount: Prisma.Decimal;
    paidAmount: Prisma.Decimal;
    remainingAmount: Prisma.Decimal;
    billingMonth?: number | null;
    billingYear?: number | null;
    monthlyTenancy?: {
      tenant?: { fullName: string };
      unit?: { unitNumber: string; property?: { name: string } };
    } | null;
    electricityReading?: {
      calculatedAmount: Prisma.Decimal;
      lateFineAmount?: Prisma.Decimal;
      lateFineApplied?: boolean;
      billingMonth: number;
      billingYear: number;
    } | null;
  };
};

export function buildThermalReceiptFromPayment(
  payment: PaymentReceiptRecord,
  options: {
    businessName: string;
    businessSubtitle: string;
    footer: string;
    isReprint: boolean;
    billingMonth?: string | null;
  },
): ThermalReceiptDto {
  const booking = payment.booking;
  const tenancy = payment.monthlyTenancy;
  const statement = payment.ownerMonthlyStatement;

  const previousReceived = (() => {
    if (booking) {
      return booking.receivedAmount.minus(
        payment.transactionType === PaymentTransactionType.PAYMENT
          ? payment.amount
          : 0,
      );
    }
    if (tenancy) {
      return tenancy.totalReceived.minus(
        payment.transactionType === PaymentTransactionType.PAYMENT
          ? payment.amount
          : 0,
      );
    }
    if (statement) {
      return statement.totalPaid.minus(payment.amount);
    }
    return new Prisma.Decimal(0);
  })();

  const customerName =
    booking?.guest?.fullName ??
    tenancy?.tenant?.fullName ??
    payment.owner?.fullName ??
    '—';
  const propertyName =
    booking?.unit?.property?.name ??
    tenancy?.unit?.property?.name ??
    statement?.property?.name ??
    '—';
  const unitNumber =
    booking?.unit?.unitNumber ??
    tenancy?.unit?.unitNumber ??
    statement?.unit?.unitNumber ??
    '—';

  let receiptType: ReceiptType = 'MONTHLY_RENT';
  let paymentTypeLabel = 'PAYMENT';
  let totalBill = payment.amount;
  let totalPaid = payment.amount;
  let remaining = new Prisma.Decimal(0);
  let billingMonth = options.billingMonth ?? null;
  let checkIn: string | null = null;
  let checkOut: string | null = null;
  let bookingType: string | null = null;
  let stayLabel: string | null = null;
  let roomCharges: string | null = null;
  let otherAmenities: string | null = null;

  if (payment.paymentForType === PaymentForType.BOOKING && booking) {
    receiptType =
      booking.bookingType === 'HOURLY' ? 'HOURLY_GUEST' : 'DAILY_GUEST';
    paymentTypeLabel =
      booking.bookingType === 'HOURLY' ? 'HOURLY GUEST' : 'DAILY GUEST';
    totalBill = booking.totalAmount;
    totalPaid = booking.receivedAmount;
    remaining = booking.remainingAmount;
    checkIn = booking.checkInDateTime.toISOString();
    checkOut = booking.checkOutDateTime.toISOString();
    bookingType = booking.bookingType;
    stayLabel =
      booking.bookingType === 'HOURLY'
        ? `${booking.numberOfHours ?? 0} Hour(s)`
        : `${booking.numberOfDays ?? 0} Night(s)`;
    roomCharges = serializeMoney(booking.roomCharges);
    otherAmenities = serializeMoney(booking.otherCharges);
  } else if (
    payment.paymentForType === PaymentForType.MONTHLY_TENANCY &&
    tenancy
  ) {
    receiptType = 'MONTHLY_RENT';
    paymentTypeLabel = 'MONTHLY RENT';
    totalBill = tenancy.totalPayable;
    totalPaid = tenancy.totalReceived;
    remaining = tenancy.remainingBalance;
    billingMonth =
      billingMonth ??
      formatBillingMonth(
        tenancy.agreementStart.getUTCMonth() + 1,
        tenancy.agreementStart.getUTCFullYear(),
      );
  } else if (payment.paymentForType === PaymentForType.OWNER && statement) {
    receiptType = 'OWNER_PAYMENT';
    paymentTypeLabel = 'OWNER PAYMENT';
    totalBill = statement.expectedAmount;
    totalPaid = statement.totalPaid;
    remaining = statement.remainingAmount;
    billingMonth = formatBillingMonth(
      statement.statementMonth,
      statement.statementYear,
    );
  }

  const receiptNumber =
    payment.receiptNumber ?? payment.paymentNumber ?? payment.id;

  return {
    sourceType: 'payment',
    sourceId: payment.id,
    receiptNumber,
    receiptType,
    isReprint: options.isReprint,
    copyLabel: options.isReprint ? 'REPRINT' : null,
    businessName: options.businessName,
    businessSubtitle: options.businessSubtitle,
    paymentNumber: payment.paymentNumber,
    paymentDate: formatDate(payment.paymentDate),
    paymentTime: formatTime(payment.paymentDate),
    customerName,
    room: unitNumber,
    property: propertyName,
    paymentTypeLabel,
    billingMonth,
    checkInDateTime: checkIn,
    checkOutDateTime: checkOut,
    bookingType,
    stayLabel,
    roomCharges,
    otherAmenities,
    electricityBill: null,
    lateFine: null,
    totalBill: serializeMoney(totalBill),
    previousOutstanding: serializeMoney(
      previousReceived.lessThan(0) ? new Prisma.Decimal(0) : previousReceived,
    ),
    currentPayment: serializeMoney(payment.amount),
    totalPaid: serializeMoney(totalPaid),
    remainingBalance: serializeMoney(remaining),
    paymentStatusLabel: derivePaymentStatusLabel(remaining, totalPaid),
    paymentMethod: formatMethod(payment.paymentMethod),
    receivedBy: payment.createdBy?.fullName ?? '—',
    footer: options.footer,
    printCount: payment.printCount,
    lastPrintedAt: payment.lastPrintedAt?.toISOString() ?? null,
    notes: payment.notes,
  };
}

export function buildThermalReceiptFromExpensePayment(
  row: ExpensePaymentReceiptRecord,
  options: {
    businessName: string;
    businessSubtitle: string;
    footer: string;
    isReprint: boolean;
  },
): ThermalReceiptDto {
  const expense = row.expense;
  const reading = expense.electricityReading;
  const tenantName = expense.monthlyTenancy?.tenant?.fullName ?? '—';
  const propertyName =
    expense.monthlyTenancy?.unit?.property?.name ?? '—';
  const unitNumber = expense.monthlyTenancy?.unit?.unitNumber ?? '—';
  const billingMonth =
    formatBillingMonth(
      reading?.billingMonth ?? expense.billingMonth,
      reading?.billingYear ?? expense.billingYear,
    ) ?? null;

  const previousPaid = expense.paidAmount.minus(row.amount);
  const electricityBill = reading?.calculatedAmount ?? expense.amount;
  const lateFine =
    reading?.lateFineApplied && reading.lateFineAmount
      ? reading.lateFineAmount
      : new Prisma.Decimal(0);

  const receiptNumber = row.receiptNumber ?? expense.expenseNumber;

  return {
    sourceType: 'expense_payment',
    sourceId: row.id,
    receiptNumber,
    receiptType: 'ELECTRICITY',
    isReprint: options.isReprint,
    copyLabel: options.isReprint ? 'REPRINT' : null,
    businessName: options.businessName,
    businessSubtitle: options.businessSubtitle,
    paymentNumber: expense.expenseNumber,
    paymentDate: formatDate(row.paymentDate),
    paymentTime: formatTime(row.paymentDate),
    customerName: tenantName,
    room: unitNumber,
    property: propertyName,
    paymentTypeLabel: 'ELECTRICITY PAYMENT',
    billingMonth,
    checkInDateTime: null,
    checkOutDateTime: null,
    bookingType: null,
    stayLabel: null,
    roomCharges: null,
    otherAmenities: null,
    electricityBill: serializeMoney(electricityBill),
    lateFine: lateFine.greaterThan(0) ? serializeMoney(lateFine) : null,
    totalBill: serializeMoney(expense.amount),
    previousOutstanding: serializeMoney(
      expense.remainingAmount.plus(row.amount),
    ),
    currentPayment: serializeMoney(row.amount),
    totalPaid: serializeMoney(expense.paidAmount),
    remainingBalance: serializeMoney(expense.remainingAmount),
    paymentStatusLabel: derivePaymentStatusLabel(
      expense.remainingAmount,
      expense.paidAmount,
    ),
    paymentMethod: formatMethod(row.paymentMethod),
    receivedBy: row.createdBy?.fullName ?? '—',
    footer: options.footer,
    printCount: row.printCount,
    lastPrintedAt: row.lastPrintedAt?.toISOString() ?? null,
    notes: row.notes,
  };
}

export function buildThermalReceiptFromBooking(
  booking: NonNullable<PaymentReceiptRecord['booking']> & {
    id: string;
    bookingNumber: string;
  },
  options: {
    businessName: string;
    businessSubtitle: string;
    footer: string;
  },
): ThermalReceiptDto {
  const remaining = booking.remainingAmount;
  const totalPaid = booking.receivedAmount;
  const receiptType: ReceiptType =
    booking.bookingType === 'HOURLY' ? 'HOURLY_GUEST' : 'DAILY_GUEST';
  const now = new Date();

  return {
    sourceType: 'payment',
    sourceId: booking.id,
    receiptNumber: booking.bookingNumber,
    receiptType,
    isReprint: false,
    copyLabel: null,
    businessName: options.businessName,
    businessSubtitle: options.businessSubtitle,
    paymentNumber: booking.bookingNumber,
    paymentDate: formatDate(now),
    paymentTime: formatTime(now),
    customerName: booking.guest?.fullName ?? '—',
    room: booking.unit?.unitNumber ?? '—',
    property: booking.unit?.property?.name ?? '—',
    paymentTypeLabel:
      booking.bookingType === 'HOURLY' ? 'HOURLY GUEST' : 'DAILY GUEST',
    billingMonth: null,
    checkInDateTime: booking.checkInDateTime.toISOString(),
    checkOutDateTime: booking.checkOutDateTime.toISOString(),
    bookingType: booking.bookingType,
    stayLabel:
      booking.bookingType === 'HOURLY'
        ? `${booking.numberOfHours ?? 0} Hour(s)`
        : `${booking.numberOfDays ?? 0} Night(s)`,
    roomCharges: serializeMoney(booking.roomCharges),
    otherAmenities: serializeMoney(booking.otherCharges),
    electricityBill: null,
    lateFine: null,
    totalBill: serializeMoney(booking.totalAmount),
    previousOutstanding: serializeMoney(new Prisma.Decimal(0)),
    currentPayment: serializeMoney(totalPaid),
    totalPaid: serializeMoney(totalPaid),
    remainingBalance: serializeMoney(remaining),
    paymentStatusLabel: derivePaymentStatusLabel(remaining, totalPaid),
    paymentMethod: totalPaid.greaterThan(0) ? 'PARTIAL' : 'PENDING',
    receivedBy: '—',
    footer: options.footer,
    printCount: 0,
    lastPrintedAt: null,
    notes: null,
  };
}

export function buildThermalReceiptFromTenancy(
  tenancy: NonNullable<PaymentReceiptRecord['monthlyTenancy']> & {
    id: string;
    agreement?: { agreementNumber?: string | null } | null;
  },
  options: {
    businessName: string;
    businessSubtitle: string;
    footer: string;
  },
): ThermalReceiptDto {
  const remaining = tenancy.remainingBalance;
  const totalPaid = tenancy.totalReceived;
  const billNumber =
    tenancy.agreement?.agreementNumber ??
    `RENT-${tenancy.unit?.unitNumber ?? tenancy.id.slice(0, 6).toUpperCase()}`;
  const now = new Date();

  return {
    sourceType: 'payment',
    sourceId: tenancy.id,
    receiptNumber: billNumber,
    receiptType: 'MONTHLY_RENT',
    isReprint: false,
    copyLabel: null,
    businessName: options.businessName,
    businessSubtitle: options.businessSubtitle,
    paymentNumber: billNumber,
    paymentDate: formatDate(now),
    paymentTime: formatTime(now),
    customerName: tenancy.tenant?.fullName ?? '—',
    room: tenancy.unit?.unitNumber ?? '—',
    property: tenancy.unit?.property?.name ?? '—',
    paymentTypeLabel: 'MONTHLY RENT',
    billingMonth: formatBillingMonth(
      tenancy.agreementStart.getUTCMonth() + 1,
      tenancy.agreementStart.getUTCFullYear(),
    ),
    checkInDateTime: null,
    checkOutDateTime: null,
    bookingType: null,
    stayLabel: null,
    roomCharges: null,
    otherAmenities: null,
    electricityBill: null,
    lateFine: null,
    totalBill: serializeMoney(tenancy.totalPayable),
    previousOutstanding: serializeMoney(new Prisma.Decimal(0)),
    currentPayment: serializeMoney(totalPaid),
    totalPaid: serializeMoney(totalPaid),
    remainingBalance: serializeMoney(remaining),
    paymentStatusLabel: derivePaymentStatusLabel(remaining, totalPaid),
    paymentMethod: totalPaid.greaterThan(0) ? 'PARTIAL' : 'PENDING',
    receivedBy: '—',
    footer: options.footer,
    printCount: 0,
    lastPrintedAt: null,
    notes: null,
  };
}

export function assertCanViewPaymentReceipt(
  paymentForType: PaymentForType,
  role: Role,
) {
  if (role === Role.SUPER_ADMIN || role === Role.ADMIN) return;
  if (
    role === Role.RECEPTIONIST &&
    (paymentForType === PaymentForType.BOOKING ||
      paymentForType === PaymentForType.MONTHLY_TENANCY)
  ) {
    return;
  }
  throw new Error('FORBIDDEN_RECEIPT');
}
