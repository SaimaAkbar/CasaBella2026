-- Improve owner monthly collections
-- Creates Owner / OwnerUnitAssignment / OwnerMonthlyStatement and links Payment

CREATE TYPE "OwnerAccountDirection" AS ENUM ('RECEIVABLE_FROM_OWNER', 'PAYABLE_TO_OWNER');
CREATE TYPE "OwnerAssignmentStatus" AS ENUM ('ACTIVE', 'ENDED', 'CANCELLED');
CREATE TYPE "OwnerStatementPaymentStatus" AS ENUM ('UNPAID', 'PARTIAL', 'PAID', 'OVERDUE', 'OVERPAID');

CREATE TABLE "Owner" (
    "id" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "fatherOrSpouseName" TEXT,
    "phone" TEXT NOT NULL,
    "alternatePhone" TEXT,
    "email" TEXT,
    "cnic" TEXT,
    "address" TEXT,
    "city" TEXT,
    "bankName" TEXT,
    "accountTitle" TEXT,
    "accountNumberOrIban" TEXT,
    "branchName" TEXT,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Owner_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Owner_cnic_key" ON "Owner"("cnic");
CREATE INDEX "Owner_phone_idx" ON "Owner"("phone");
CREATE INDEX "Owner_isActive_idx" ON "Owner"("isActive");
CREATE INDEX "Owner_fullName_idx" ON "Owner"("fullName");

CREATE TABLE "OwnerUnitAssignment" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "accountDirection" "OwnerAccountDirection" NOT NULL,
    "ownershipPercentage" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "fixedMonthlyAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "agreementStart" TIMESTAMP(3) NOT NULL,
    "agreementEnd" TIMESTAMP(3),
    "dueDay" INTEGER NOT NULL DEFAULT 15,
    "status" "OwnerAssignmentStatus" NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3),

    CONSTRAINT "OwnerUnitAssignment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "OwnerUnitAssignment_ownerId_idx" ON "OwnerUnitAssignment"("ownerId");
CREATE INDEX "OwnerUnitAssignment_propertyId_idx" ON "OwnerUnitAssignment"("propertyId");
CREATE INDEX "OwnerUnitAssignment_unitId_idx" ON "OwnerUnitAssignment"("unitId");
CREATE INDEX "OwnerUnitAssignment_accountDirection_idx" ON "OwnerUnitAssignment"("accountDirection");
CREATE INDEX "OwnerUnitAssignment_status_idx" ON "OwnerUnitAssignment"("status");
CREATE INDEX "OwnerUnitAssignment_agreementStart_idx" ON "OwnerUnitAssignment"("agreementStart");
CREATE INDEX "OwnerUnitAssignment_ownerId_status_idx" ON "OwnerUnitAssignment"("ownerId", "status");
CREATE INDEX "OwnerUnitAssignment_unitId_status_idx" ON "OwnerUnitAssignment"("unitId", "status");

CREATE TABLE "OwnerMonthlyStatement" (
    "id" TEXT NOT NULL,
    "ownerUnitAssignmentId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "statementMonth" INTEGER NOT NULL,
    "statementYear" INTEGER NOT NULL,
    "accountDirection" "OwnerAccountDirection" NOT NULL,
    "expectedAmount" DECIMAL(12,2) NOT NULL,
    "previousBalance" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "adjustmentAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "totalPayableOrReceivable" DECIMAL(12,2) NOT NULL,
    "totalPaid" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "remainingAmount" DECIMAL(12,2) NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "paymentStatus" "OwnerStatementPaymentStatus" NOT NULL DEFAULT 'UNPAID',
    "finalized" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OwnerMonthlyStatement_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OwnerMonthlyStatement_ownerUnitAssignmentId_statementMonth_statementYear_key" ON "OwnerMonthlyStatement"("ownerUnitAssignmentId", "statementMonth", "statementYear");
CREATE INDEX "OwnerMonthlyStatement_ownerId_idx" ON "OwnerMonthlyStatement"("ownerId");
CREATE INDEX "OwnerMonthlyStatement_propertyId_idx" ON "OwnerMonthlyStatement"("propertyId");
CREATE INDEX "OwnerMonthlyStatement_unitId_idx" ON "OwnerMonthlyStatement"("unitId");
CREATE INDEX "OwnerMonthlyStatement_statementMonth_statementYear_idx" ON "OwnerMonthlyStatement"("statementMonth", "statementYear");
CREATE INDEX "OwnerMonthlyStatement_accountDirection_idx" ON "OwnerMonthlyStatement"("accountDirection");
CREATE INDEX "OwnerMonthlyStatement_paymentStatus_idx" ON "OwnerMonthlyStatement"("paymentStatus");
CREATE INDEX "OwnerMonthlyStatement_dueDate_idx" ON "OwnerMonthlyStatement"("dueDate");
CREATE INDEX "OwnerMonthlyStatement_finalized_idx" ON "OwnerMonthlyStatement"("finalized");

ALTER TABLE "Payment" ADD COLUMN "ownerMonthlyStatementId" TEXT;
ALTER TABLE "Payment" ADD COLUMN "ownerId" TEXT;
ALTER TABLE "Payment" ADD COLUMN "bankName" TEXT;
ALTER TABLE "Payment" ADD COLUMN "accountTitle" TEXT;

CREATE INDEX "Payment_ownerMonthlyStatementId_idx" ON "Payment"("ownerMonthlyStatementId");
CREATE INDEX "Payment_ownerId_idx" ON "Payment"("ownerId");

ALTER TABLE "OwnerUnitAssignment" ADD CONSTRAINT "OwnerUnitAssignment_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "Owner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OwnerUnitAssignment" ADD CONSTRAINT "OwnerUnitAssignment_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OwnerUnitAssignment" ADD CONSTRAINT "OwnerUnitAssignment_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "OwnerMonthlyStatement" ADD CONSTRAINT "OwnerMonthlyStatement_ownerUnitAssignmentId_fkey" FOREIGN KEY ("ownerUnitAssignmentId") REFERENCES "OwnerUnitAssignment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OwnerMonthlyStatement" ADD CONSTRAINT "OwnerMonthlyStatement_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "Owner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OwnerMonthlyStatement" ADD CONSTRAINT "OwnerMonthlyStatement_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OwnerMonthlyStatement" ADD CONSTRAINT "OwnerMonthlyStatement_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Payment" ADD CONSTRAINT "Payment_ownerMonthlyStatementId_fkey" FOREIGN KEY ("ownerMonthlyStatementId") REFERENCES "OwnerMonthlyStatement"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "Owner"("id") ON DELETE SET NULL ON UPDATE CASCADE;
