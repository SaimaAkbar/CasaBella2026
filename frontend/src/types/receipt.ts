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

export type ThermalReceipt = {
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

export type PrinterConfig = {
  printerName: string;
  paperWidthMm: number;
  printWidthMm: number;
  autoCut: boolean;
  businessName: string;
  receiptFooter: string;
};

export type ReceiptPrintTarget =
  | { sourceType: 'payment'; sourceId: string; billingMonth?: string }
  | { sourceType: 'expense_payment'; sourceId: string }
  | { sourceType: 'owner_payment'; sourceId: string }
  | { sourceType: 'booking_bill'; sourceId: string }
  | { sourceType: 'tenancy_bill'; sourceId: string };
