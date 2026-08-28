-- CreateEnum
CREATE TYPE "MonthlyOccupancyState" AS ENUM ('OCCUPIED', 'EMPTY');

-- CreateEnum
CREATE TYPE "MonthlyTenancyStatus" AS ENUM ('ACTIVE', 'ENDED', 'CANCELLED');

-- CreateTable
CREATE TABLE "MonthlyTenant" (
    "id" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "alternatePhone" TEXT,
    "email" TEXT,
    "cnic" TEXT,
    "address" TEXT,
    "emergencyContactName" TEXT,
    "emergencyContactPhone" TEXT,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MonthlyTenant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MonthlyTenancy" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "agreementStart" TIMESTAMP(3) NOT NULL,
    "agreementEnd" TIMESTAMP(3),
    "securityDeposit" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "monthlyRent" DECIMAL(12,2) NOT NULL,
    "maintenanceCharges" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "laundryCharges" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "cleaningCharges" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "waterCharges" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "societyCharges" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "electricityCharges" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "otherCharges" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "previousBalance" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "totalPayable" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "totalReceived" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "remainingBalance" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "occupancyState" "MonthlyOccupancyState" NOT NULL,
    "tenancyStatus" "MonthlyTenancyStatus" NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3),

    CONSTRAINT "MonthlyTenancy_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MonthlyTenant_cnic_key" ON "MonthlyTenant"("cnic");

-- CreateIndex
CREATE INDEX "MonthlyTenant_phone_idx" ON "MonthlyTenant"("phone");

-- CreateIndex
CREATE INDEX "MonthlyTenant_isActive_idx" ON "MonthlyTenant"("isActive");

-- CreateIndex
CREATE INDEX "MonthlyTenancy_tenantId_idx" ON "MonthlyTenancy"("tenantId");

-- CreateIndex
CREATE INDEX "MonthlyTenancy_unitId_idx" ON "MonthlyTenancy"("unitId");

-- CreateIndex
CREATE INDEX "MonthlyTenancy_tenancyStatus_idx" ON "MonthlyTenancy"("tenancyStatus");

-- CreateIndex
CREATE INDEX "MonthlyTenancy_occupancyState_idx" ON "MonthlyTenancy"("occupancyState");

-- CreateIndex
CREATE INDEX "MonthlyTenancy_agreementStart_idx" ON "MonthlyTenancy"("agreementStart");

-- AddForeignKey
ALTER TABLE "MonthlyTenancy" ADD CONSTRAINT "MonthlyTenancy_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "MonthlyTenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MonthlyTenancy" ADD CONSTRAINT "MonthlyTenancy_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
