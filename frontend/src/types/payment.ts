export type PaymentForType = 'BOOKING' | 'MONTHLY_TENANCY' | 'OWNER' | 'SALARY' | 'EXPENSE' | 'OTHER';
export type PaymentMethod =
  | 'CASH'
  | 'BANK_TRANSFER'
  | 'CARD'
  | 'EASYPAISA'
  | 'JAZZCASH'
  | 'OTHER';
export type PaymentTransactionType =
  | 'PAYMENT'
  | 'REFUND'
  | 'REVERSAL'
  | 'ADJUSTMENT';
export type PaymentRecordStatus =
  | 'PENDING'
  | 'COMPLETED'
  | 'REVERSED'
  | 'REFUNDED'
  | 'CANCELLED';

export type Payment = {
  id: string;
  paymentNumber: string;
  paymentForType: PaymentForType;
  bookingId?: string | null;
  monthlyTenancyId?: string | null;
  transactionType: PaymentTransactionType;
  amount: string;
  paymentMethod: PaymentMethod;
  transactionReference?: string | null;
  paymentDate: string;
  notes?: string | null;
  proofAttachmentUrl?: string | null;
  status: PaymentRecordStatus;
  originalPaymentId?: string | null;
  createdByUserId: string;
  approvedByUserId?: string | null;
  approvedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy?: { id: string; fullName: string } | null;
  approvedBy?: { id: string; fullName: string } | null;
  originalPayment?: {
    id: string;
    paymentNumber: string;
    amount: string;
  } | null;
  booking?: {
    id: string;
    bookingNumber: string;
    totalAmount: string;
    receivedAmount: string;
    remainingAmount: string;
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
    totalPayable: string;
    totalReceived: string;
    remainingBalance: string;
    tenant?: { id: string; fullName: string; phone: string };
    unit?: {
      id: string;
      unitNumber: string;
      property?: { id: string; name: string };
    };
  } | null;
  receipt?: PaymentReceipt;
};

export type PaymentReceipt = {
  receiptNumber?: string;
  hotelOrPropertyName: string;
  paymentNumber: string;
  paymentDateTime: string;
  payerName: string;
  guestOrTenant: string;
  property: string;
  unit: string;
  paymentType: string;
  transactionType: string;
  amount: string;
  paymentMethod: string;
  transactionReference: string | null;
  totalPayable: string;
  previousReceived: string;
  currentPayment: string;
  totalReceived: string;
  remainingBalance: string;
  receivedBy: string;
  notes: string | null;
  status: string;
};

export type PaymentSummary = {
  totalReceivedToday?: string;
  totalReceivedThisMonth?: string;
  bookingPayments?: string;
  monthlyTenantPayments?: string;
  refunds?: string;
  outstandingBalance?: string;
};

export type PaymentQuery = {
  paymentForType?: PaymentForType | '';
  bookingId?: string;
  monthlyTenancyId?: string;
  paymentMethod?: PaymentMethod | '';
  transactionType?: PaymentTransactionType | '';
  status?: PaymentRecordStatus | '';
  today?: boolean;
  month?: number | '';
  year?: number | '';
  startDate?: string;
  endDate?: string;
  search?: string;
};

export type CreatePaymentInput = {
  paymentForType: 'BOOKING' | 'MONTHLY_TENANCY';
  bookingId?: string;
  monthlyTenancyId?: string;
  amount: number;
  paymentMethod: PaymentMethod;
  transactionReference?: string;
  paymentDate: string;
  notes?: string;
  proofAttachmentUrl?: string;
  overpayReason?: string;
};

export type OutstandingBookingSource = {
  id: string;
  bookingNumber: string;
  totalAmount: string;
  receivedAmount: string;
  remainingAmount: string;
  paymentState: string;
  checkInDateTime: string;
  guest?: { id: string; fullName: string; phone: string };
  unit?: {
    id: string;
    unitNumber: string;
    property?: { id: string; name: string };
  };
};

export type OutstandingTenancySource = {
  id: string;
  totalPayable: string;
  totalReceived: string;
  remainingBalance: string;
  agreementStart: string;
  tenant?: { id: string; fullName: string; phone: string };
  unit?: {
    id: string;
    unitNumber: string;
    property?: { id: string; name: string };
  };
};
