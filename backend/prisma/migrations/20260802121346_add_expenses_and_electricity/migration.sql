-- CreateEnum
CREATE TYPE "ExpenseScope" AS ENUM ('GENERAL', 'PROPERTY', 'UNIT', 'BOOKING', 'MONTHLY_TENANCY', 'EMPLOYEE', 'OWNER');

-- CreateEnum
CREATE TYPE "ExpensePaymentStatus" AS ENUM ('UNPAID', 'PARTIAL', 'PAID');

-- CreateTable
CREATE TABLE "ExpenseCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExpenseCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Expense" (
    "id" TEXT NOT NULL,
    "expenseNumber" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "expenseScope" "ExpenseScope" NOT NULL,
    "propertyId" TEXT,
    "unitId" TEXT,
    "bookingId" TEXT,
    "monthlyTenancyId" TEXT,
    "expenseDate" TIMESTAMP(3) NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "paidAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "remainingAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "paymentStatus" "ExpensePaymentStatus" NOT NULL DEFAULT 'UNPAID',
    "paymentMethod" "PaymentMethod",
    "vendorName" TEXT,
    "referenceNumber" TEXT,
    "description" TEXT,
    "receiptUrl" TEXT,
    "metadata" JSONB,
    "createdByUserId" TEXT NOT NULL,
    "approvedByUserId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "isFinalized" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Expense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ElectricityReading" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "unitId" TEXT,
    "previousUnits" DECIMAL(12,3) NOT NULL,
    "currentUnits" DECIMAL(12,3) NOT NULL,
    "consumedUnits" DECIMAL(12,3) NOT NULL,
    "ratePerUnit" DECIMAL(12,2) NOT NULL,
    "calculatedAmount" DECIMAL(12,2) NOT NULL,
    "readingDate" TIMESTAMP(3) NOT NULL,
    "billingMonth" INTEGER NOT NULL,
    "billingYear" INTEGER NOT NULL,
    "notes" TEXT,
    "expenseId" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ElectricityReading_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ExpenseCategory_name_key" ON "ExpenseCategory"("name");

-- CreateIndex
CREATE INDEX "ExpenseCategory_isActive_idx" ON "ExpenseCategory"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "Expense_expenseNumber_key" ON "Expense"("expenseNumber");

-- CreateIndex
CREATE INDEX "Expense_categoryId_idx" ON "Expense"("categoryId");

-- CreateIndex
CREATE INDEX "Expense_expenseScope_idx" ON "Expense"("expenseScope");

-- CreateIndex
CREATE INDEX "Expense_propertyId_idx" ON "Expense"("propertyId");

-- CreateIndex
CREATE INDEX "Expense_unitId_idx" ON "Expense"("unitId");

-- CreateIndex
CREATE INDEX "Expense_bookingId_idx" ON "Expense"("bookingId");

-- CreateIndex
CREATE INDEX "Expense_monthlyTenancyId_idx" ON "Expense"("monthlyTenancyId");

-- CreateIndex
CREATE INDEX "Expense_paymentStatus_idx" ON "Expense"("paymentStatus");

-- CreateIndex
CREATE INDEX "Expense_expenseDate_idx" ON "Expense"("expenseDate");

-- CreateIndex
CREATE INDEX "Expense_isFinalized_idx" ON "Expense"("isFinalized");

-- CreateIndex
CREATE INDEX "Expense_isActive_idx" ON "Expense"("isActive");

-- CreateIndex
CREATE INDEX "Expense_createdByUserId_idx" ON "Expense"("createdByUserId");

-- CreateIndex
CREATE INDEX "Expense_approvedByUserId_idx" ON "Expense"("approvedByUserId");

-- CreateIndex
CREATE UNIQUE INDEX "ElectricityReading_expenseId_key" ON "ElectricityReading"("expenseId");

-- CreateIndex
CREATE INDEX "ElectricityReading_propertyId_idx" ON "ElectricityReading"("propertyId");

-- CreateIndex
CREATE INDEX "ElectricityReading_unitId_idx" ON "ElectricityReading"("unitId");

-- CreateIndex
CREATE INDEX "ElectricityReading_billingMonth_billingYear_idx" ON "ElectricityReading"("billingMonth", "billingYear");

-- CreateIndex
CREATE INDEX "ElectricityReading_readingDate_idx" ON "ElectricityReading"("readingDate");

-- CreateIndex
CREATE INDEX "ElectricityReading_createdByUserId_idx" ON "ElectricityReading"("createdByUserId");

-- CreateIndex
CREATE UNIQUE INDEX "ElectricityReading_unitId_billingMonth_billingYear_key" ON "ElectricityReading"("unitId", "billingMonth", "billingYear");

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ExpenseCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_monthlyTenancyId_fkey" FOREIGN KEY ("monthlyTenancyId") REFERENCES "MonthlyTenancy"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ElectricityReading" ADD CONSTRAINT "ElectricityReading_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ElectricityReading" ADD CONSTRAINT "ElectricityReading_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ElectricityReading" ADD CONSTRAINT "ElectricityReading_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES "Expense"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ElectricityReading" ADD CONSTRAINT "ElectricityReading_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
