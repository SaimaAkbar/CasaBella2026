-- CreateEnum
CREATE TYPE "BookingType" AS ENUM ('HOURLY', 'DAILY');

-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('PENDING', 'CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT', 'CANCELLED', 'NO_SHOW');

-- CreateEnum
CREATE TYPE "PaymentState" AS ENUM ('UNPAID', 'ADVANCE', 'PARTIAL', 'HALF_PAID', 'PAID');

-- CreateTable
CREATE TABLE "Guest" (
    "id" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "alternatePhone" TEXT,
    "email" TEXT,
    "cnicOrPassport" TEXT,
    "address" TEXT,
    "nationality" TEXT,
    "emergencyContactName" TEXT,
    "emergencyContactPhone" TEXT,
    "vehicleNumber" TEXT,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Guest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Booking" (
    "id" TEXT NOT NULL,
    "bookingNumber" TEXT NOT NULL,
    "guestId" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "bookingType" "BookingType" NOT NULL,
    "checkInDateTime" TIMESTAMP(3) NOT NULL,
    "checkOutDateTime" TIMESTAMP(3) NOT NULL,
    "hourlyRate" DECIMAL(12,2),
    "dailyRate" DECIMAL(12,2),
    "numberOfHours" INTEGER,
    "numberOfDays" INTEGER,
    "roomCharges" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "electricityCharges" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "cleaningCharges" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "laundryCharges" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "maintenanceCharges" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "otherCharges" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "discountAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "totalAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "receivedAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "remainingAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "paymentState" "PaymentState" NOT NULL DEFAULT 'UNPAID',
    "bookingStatus" "BookingStatus" NOT NULL DEFAULT 'PENDING',
    "numberOfGuests" INTEGER NOT NULL DEFAULT 1,
    "adults" INTEGER,
    "children" INTEGER,
    "bookingSource" TEXT,
    "notes" TEXT,
    "actualCheckInAt" TIMESTAMP(3),
    "actualCheckOutAt" TIMESTAMP(3),
    "cleaningCleared" BOOLEAN NOT NULL DEFAULT false,
    "accountsCleared" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "cancelledAt" TIMESTAMP(3),
    "createdByUserId" TEXT,
    "checkedOutByUserId" TEXT,

    CONSTRAINT "Booking_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Guest_phone_idx" ON "Guest"("phone");

-- CreateIndex
CREATE INDEX "Guest_cnicOrPassport_idx" ON "Guest"("cnicOrPassport");

-- CreateIndex
CREATE INDEX "Guest_isActive_idx" ON "Guest"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "Booking_bookingNumber_key" ON "Booking"("bookingNumber");

-- CreateIndex
CREATE INDEX "Booking_guestId_idx" ON "Booking"("guestId");

-- CreateIndex
CREATE INDEX "Booking_unitId_idx" ON "Booking"("unitId");

-- CreateIndex
CREATE INDEX "Booking_bookingType_idx" ON "Booking"("bookingType");

-- CreateIndex
CREATE INDEX "Booking_bookingStatus_idx" ON "Booking"("bookingStatus");

-- CreateIndex
CREATE INDEX "Booking_paymentState_idx" ON "Booking"("paymentState");

-- CreateIndex
CREATE INDEX "Booking_checkInDateTime_idx" ON "Booking"("checkInDateTime");

-- CreateIndex
CREATE INDEX "Booking_checkOutDateTime_idx" ON "Booking"("checkOutDateTime");

-- CreateIndex
CREATE INDEX "Booking_createdByUserId_idx" ON "Booking"("createdByUserId");

-- CreateIndex
CREATE INDEX "Booking_checkedOutByUserId_idx" ON "Booking"("checkedOutByUserId");

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "Guest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_checkedOutByUserId_fkey" FOREIGN KEY ("checkedOutByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
