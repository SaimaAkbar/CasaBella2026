-- CreateEnum
CREATE TYPE "SettlementType" AS ENUM ('FIXED_AMOUNT', 'PERCENTAGE', 'NO_TENANT_SHARE', 'RENT_CREDIT', 'CUSTOM');

-- CreateEnum
CREATE TYPE "SettlementStatus" AS ENUM ('DRAFT', 'APPROVED', 'SETTLED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "OccupancySource" AS ENUM ('NORMAL_HOTEL_UNIT', 'HOTEL_GUEST_ON_TENANT_UNIT');

-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "occupancySource" "OccupancySource" NOT NULL DEFAULT 'NORMAL_HOTEL_UNIT';

-- AlterTable
ALTER TABLE "MonthlyTenancy" ADD COLUMN     "hotelUseAllowed" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "TenantUnitHotelUse" (
    "id" TEXT NOT NULL,
    "monthlyTenancyId" TEXT NOT NULL,
    "bookingId" TEXT,
    "settlementType" "SettlementType" NOT NULL,
    "totalGuestCharge" DECIMAL(12,2) NOT NULL,
    "tenantShare" DECIMAL(12,2) NOT NULL,
    "organizationShare" DECIMAL(12,2) NOT NULL,
    "tenantSharePercentage" DECIMAL(5,2),
    "organizationSharePercentage" DECIMAL(5,2),
    "rentCreditAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "status" "SettlementStatus" NOT NULL DEFAULT 'DRAFT',
    "reason" TEXT,
    "billingMonth" INTEGER,
    "billingYear" INTEGER,
    "createdByUserId" TEXT NOT NULL,
    "approvedByUserId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "settledAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TenantUnitHotelUse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RentCredit" (
    "id" TEXT NOT NULL,
    "monthlyTenancyId" TEXT NOT NULL,
    "hotelUseId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "billingMonth" INTEGER NOT NULL,
    "billingYear" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "creditDate" TIMESTAMP(3) NOT NULL,
    "paymentId" TEXT,
    "approvedByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RentCredit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TenantUnitHotelUse_bookingId_key" ON "TenantUnitHotelUse"("bookingId");

-- CreateIndex
CREATE INDEX "TenantUnitHotelUse_monthlyTenancyId_idx" ON "TenantUnitHotelUse"("monthlyTenancyId");

-- CreateIndex
CREATE INDEX "TenantUnitHotelUse_status_idx" ON "TenantUnitHotelUse"("status");

-- CreateIndex
CREATE INDEX "TenantUnitHotelUse_settlementType_idx" ON "TenantUnitHotelUse"("settlementType");

-- CreateIndex
CREATE INDEX "TenantUnitHotelUse_createdByUserId_idx" ON "TenantUnitHotelUse"("createdByUserId");

-- CreateIndex
CREATE INDEX "TenantUnitHotelUse_approvedByUserId_idx" ON "TenantUnitHotelUse"("approvedByUserId");

-- CreateIndex
CREATE INDEX "TenantUnitHotelUse_createdAt_idx" ON "TenantUnitHotelUse"("createdAt");

-- CreateIndex
CREATE INDEX "TenantUnitHotelUse_billingMonth_billingYear_idx" ON "TenantUnitHotelUse"("billingMonth", "billingYear");

-- CreateIndex
CREATE UNIQUE INDEX "RentCredit_paymentId_key" ON "RentCredit"("paymentId");

-- CreateIndex
CREATE INDEX "RentCredit_monthlyTenancyId_idx" ON "RentCredit"("monthlyTenancyId");

-- CreateIndex
CREATE INDEX "RentCredit_hotelUseId_idx" ON "RentCredit"("hotelUseId");

-- CreateIndex
CREATE INDEX "RentCredit_billingMonth_billingYear_idx" ON "RentCredit"("billingMonth", "billingYear");

-- CreateIndex
CREATE INDEX "RentCredit_creditDate_idx" ON "RentCredit"("creditDate");

-- CreateIndex
CREATE INDEX "RentCredit_approvedByUserId_idx" ON "RentCredit"("approvedByUserId");

-- CreateIndex
CREATE INDEX "Booking_occupancySource_idx" ON "Booking"("occupancySource");

-- CreateIndex
CREATE INDEX "MonthlyTenancy_hotelUseAllowed_idx" ON "MonthlyTenancy"("hotelUseAllowed");

-- AddForeignKey
ALTER TABLE "TenantUnitHotelUse" ADD CONSTRAINT "TenantUnitHotelUse_monthlyTenancyId_fkey" FOREIGN KEY ("monthlyTenancyId") REFERENCES "MonthlyTenancy"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantUnitHotelUse" ADD CONSTRAINT "TenantUnitHotelUse_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantUnitHotelUse" ADD CONSTRAINT "TenantUnitHotelUse_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantUnitHotelUse" ADD CONSTRAINT "TenantUnitHotelUse_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RentCredit" ADD CONSTRAINT "RentCredit_monthlyTenancyId_fkey" FOREIGN KEY ("monthlyTenancyId") REFERENCES "MonthlyTenancy"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RentCredit" ADD CONSTRAINT "RentCredit_hotelUseId_fkey" FOREIGN KEY ("hotelUseId") REFERENCES "TenantUnitHotelUse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RentCredit" ADD CONSTRAINT "RentCredit_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RentCredit" ADD CONSTRAINT "RentCredit_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
