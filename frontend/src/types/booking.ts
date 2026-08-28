import type { Guest } from './guest';

export type BookingType = 'HOURLY' | 'DAILY';
export type BookingStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'CHECKED_IN'
  | 'CHECKED_OUT'
  | 'CANCELLED'
  | 'NO_SHOW';
export type PaymentState =
  | 'UNPAID'
  | 'ADVANCE'
  | 'PARTIAL'
  | 'HALF_PAID'
  | 'PAID';

export type Booking = {
  id: string;
  bookingNumber: string;
  guestId: string;
  unitId: string;
  bookingType: BookingType;
  checkInDateTime: string;
  checkOutDateTime: string;
  hourlyRate?: string | null;
  dailyRate?: string | null;
  numberOfHours?: number | null;
  numberOfDays?: number | null;
  roomCharges: string;
  electricityCharges: string;
  cleaningCharges: string;
  laundryCharges: string;
  maintenanceCharges: string;
  otherCharges: string;
  otherChargesDescription?: string | null;
  discountAmount: string;
  totalAmount: string;
  receivedAmount: string;
  remainingAmount: string;
  paymentState: PaymentState;
  bookingStatus: BookingStatus;
  numberOfGuests: number;
  adults?: number | null;
  children?: number | null;
  bookingSource?: string | null;
  notes?: string | null;
  actualCheckInAt?: string | null;
  actualCheckOutAt?: string | null;
  cleaningCleared: boolean;
  accountsCleared: boolean;
  createdAt: string;
  updatedAt: string;
  cancelledAt?: string | null;
  createdByUserId?: string | null;
  checkedOutByUserId?: string | null;
  createdBy?: { id: string; fullName: string } | null;
  checkedOutBy?: { id: string; fullName: string } | null;
  guest?: Guest;
  unit?: {
    id: string;
    unitNumber: string;
    status: string;
    property?: { id: string; name: string };
  };
};

export type BookingSummary = {
  todayCheckIns: number;
  todayCheckOuts: number;
  currentlyCheckedIn: number;
  upcomingBookings: number;
  unpaidOutstanding: string;
  roomsRequiringCleaning: number;
};

export type BookingEligibleUnit = {
  id: string;
  unitNumber: string;
  unitType: string;
  status: string;
  dailyRate: string | null;
  hourlyRate: string | null;
  propertyId: string;
  property: { id: string; name: string };
};

export type BookingQuery = {
  propertyId?: string;
  unitId?: string;
  guestId?: string;
  bookingType?: BookingType | '';
  bookingStatus?: BookingStatus | '';
  paymentState?: PaymentState | '';
  checkInDate?: string;
  checkOutDate?: string;
  month?: number | '';
  year?: number | '';
  startDate?: string;
  endDate?: string;
  today?: boolean;
  search?: string;
};

export type BookingInput = {
  guestId?: string;
  guest?: {
    fullName: string;
    phone: string;
    alternatePhone?: string;
    email?: string;
    cnicOrPassport?: string;
    address?: string;
    nationality?: string;
    emergencyContactName?: string;
    emergencyContactPhone?: string;
    vehicleNumber?: string;
    notes?: string;
  };
  propertyId: string;
  unitId: string;
  bookingType: BookingType;
  checkInDateTime: string;
  checkOutDateTime: string;
  hourlyRate?: number;
  dailyRate?: number;
  numberOfHours?: number;
  numberOfDays?: number;
  numberOfGuests?: number;
  adults?: number;
  children?: number;
  bookingSource?: string;
  electricityCharges?: number;
  cleaningCharges?: number;
  laundryCharges?: number;
  maintenanceCharges?: number;
  otherCharges?: number;
  otherChargesDescription?: string;
  discountAmount?: number;
  receivedAmount?: number;
  allowAdvance?: boolean;
  notes?: string;
};

export type BookingFormValues = {
  guestMode: 'existing' | 'new';
  guestId: string;
  fullName: string;
  phone: string;
  alternatePhone: string;
  email: string;
  cnicOrPassport: string;
  propertyId: string;
  unitId: string;
  bookingType: BookingType | '';
  checkInDateTime: string;
  checkOutDateTime: string;
  hourlyRate: string;
  dailyRate: string;
  numberOfHours: string;
  numberOfDays: string;
  numberOfGuests: string;
  adults: string;
  children: string;
  bookingSource: string;
  electricityCharges: string;
  cleaningCharges: string;
  laundryCharges: string;
  maintenanceCharges: string;
  otherCharges: string;
  discountAmount: string;
  receivedAmount: string;
  allowAdvance: boolean;
  notes: string;
  otherChargesDescription: string;
  address: string;
};
