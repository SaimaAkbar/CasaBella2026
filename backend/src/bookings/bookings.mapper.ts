import {
  BookingStatus,
  BookingType,
  PaymentState,
  Prisma,
  Role,
} from '../../generated/prisma/client';
import { serializeMoney } from './booking.finance';

type BookingRecord = {
  id: string;
  bookingNumber: string;
  guestId: string;
  unitId: string;
  bookingType: BookingType;
  checkInDateTime: Date;
  checkOutDateTime: Date;
  hourlyRate: Prisma.Decimal | null;
  dailyRate: Prisma.Decimal | null;
  numberOfHours: number | null;
  numberOfDays: number | null;
  roomCharges: Prisma.Decimal;
  electricityCharges: Prisma.Decimal;
  cleaningCharges: Prisma.Decimal;
  laundryCharges: Prisma.Decimal;
  maintenanceCharges: Prisma.Decimal;
  otherCharges: Prisma.Decimal;
  otherChargesDescription: string | null;
  discountAmount: Prisma.Decimal;
  totalAmount: Prisma.Decimal;
  receivedAmount: Prisma.Decimal;
  remainingAmount: Prisma.Decimal;
  paymentState: PaymentState;
  bookingStatus: BookingStatus;
  numberOfGuests: number;
  adults: number | null;
  children: number | null;
  bookingSource: string | null;
  notes: string | null;
  actualCheckInAt: Date | null;
  actualCheckOutAt: Date | null;
  cleaningCleared: boolean;
  accountsCleared: boolean;
  createdAt: Date;
  updatedAt: Date;
  cancelledAt: Date | null;
  createdByUserId: string | null;
  checkedOutByUserId: string | null;
  guest?: {
    id: string;
    fullName: string;
    phone: string;
    alternatePhone?: string | null;
    email?: string | null;
    cnicOrPassport?: string | null;
    address?: string | null;
    nationality?: string | null;
    emergencyContactName?: string | null;
    emergencyContactPhone?: string | null;
    vehicleNumber?: string | null;
    notes?: string | null;
    isActive?: boolean;
  };
  unit?: {
    id: string;
    unitNumber: string;
    status: string;
    property?: {
      id: string;
      name: string;
    };
  };
  createdBy?: { id: string; fullName: string } | null;
  checkedOutBy?: { id: string; fullName: string } | null;
};

export function mapBookingForRole(booking: BookingRecord, _role: Role) {
  // Receptionist may view operational booking amounts needed for check-in/out.
  return {
    id: booking.id,
    bookingNumber: booking.bookingNumber,
    guestId: booking.guestId,
    unitId: booking.unitId,
    bookingType: booking.bookingType,
    checkInDateTime: booking.checkInDateTime,
    checkOutDateTime: booking.checkOutDateTime,
    hourlyRate: booking.hourlyRate
      ? serializeMoney(booking.hourlyRate)
      : null,
    dailyRate: booking.dailyRate ? serializeMoney(booking.dailyRate) : null,
    numberOfHours: booking.numberOfHours,
    numberOfDays: booking.numberOfDays,
    roomCharges: serializeMoney(booking.roomCharges),
    electricityCharges: serializeMoney(booking.electricityCharges),
    cleaningCharges: serializeMoney(booking.cleaningCharges),
    laundryCharges: serializeMoney(booking.laundryCharges),
    maintenanceCharges: serializeMoney(booking.maintenanceCharges),
    otherCharges: serializeMoney(booking.otherCharges),
    otherChargesDescription: booking.otherChargesDescription,
    discountAmount: serializeMoney(booking.discountAmount),
    totalAmount: serializeMoney(booking.totalAmount),
    receivedAmount: serializeMoney(booking.receivedAmount),
    remainingAmount: serializeMoney(booking.remainingAmount),
    paymentState: booking.paymentState,
    bookingStatus: booking.bookingStatus,
    numberOfGuests: booking.numberOfGuests,
    adults: booking.adults,
    children: booking.children,
    bookingSource: booking.bookingSource,
    notes: booking.notes,
    actualCheckInAt: booking.actualCheckInAt,
    actualCheckOutAt: booking.actualCheckOutAt,
    cleaningCleared: booking.cleaningCleared,
    accountsCleared: booking.accountsCleared,
    createdAt: booking.createdAt,
    updatedAt: booking.updatedAt,
    cancelledAt: booking.cancelledAt,
    createdByUserId: booking.createdByUserId,
    checkedOutByUserId: booking.checkedOutByUserId,
    createdBy: booking.createdBy
      ? { id: booking.createdBy.id, fullName: booking.createdBy.fullName }
      : null,
    checkedOutBy: booking.checkedOutBy
      ? {
          id: booking.checkedOutBy.id,
          fullName: booking.checkedOutBy.fullName,
        }
      : null,
    guest: booking.guest
      ? {
          id: booking.guest.id,
          fullName: booking.guest.fullName,
          phone: booking.guest.phone,
          alternatePhone: booking.guest.alternatePhone ?? null,
          email: booking.guest.email ?? null,
          cnicOrPassport: booking.guest.cnicOrPassport ?? null,
          address: booking.guest.address ?? null,
          nationality: booking.guest.nationality ?? null,
          emergencyContactName: booking.guest.emergencyContactName ?? null,
          emergencyContactPhone: booking.guest.emergencyContactPhone ?? null,
          vehicleNumber: booking.guest.vehicleNumber ?? null,
          notes: booking.guest.notes ?? null,
          isActive: booking.guest.isActive ?? true,
        }
      : undefined,
    unit: booking.unit
      ? {
          id: booking.unit.id,
          unitNumber: booking.unit.unitNumber,
          status: booking.unit.status,
          property: booking.unit.property,
        }
      : undefined,
  };
}
