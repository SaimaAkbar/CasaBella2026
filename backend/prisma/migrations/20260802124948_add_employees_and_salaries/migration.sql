-- CreateEnum
CREATE TYPE "EmployeeStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'RESIGNED', 'TERMINATED');

-- CreateEnum
CREATE TYPE "SalaryPaymentStatus" AS ENUM ('UNPAID', 'PARTIAL', 'PAID');

-- CreateEnum
CREATE TYPE "SalaryTransactionType" AS ENUM ('SALARY_PAYMENT', 'ADVANCE', 'DEDUCTION', 'BONUS', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "SalaryAdjustmentDirection" AS ENUM ('INCREASE', 'DECREASE');

-- AlterTable
ALTER TABLE "Expense" ADD COLUMN     "employeeId" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "canAccessSalary" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "Employee" (
    "id" TEXT NOT NULL,
    "employeeCode" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "fatherOrSpouseName" TEXT,
    "phone" TEXT NOT NULL,
    "alternatePhone" TEXT,
    "email" TEXT,
    "cnic" TEXT,
    "address" TEXT,
    "position" TEXT NOT NULL,
    "department" TEXT,
    "joiningDate" TIMESTAMP(3) NOT NULL,
    "monthlySalary" DECIMAL(12,2) NOT NULL,
    "bankName" TEXT,
    "accountTitle" TEXT,
    "accountNumberOrIban" TEXT,
    "emergencyContactName" TEXT,
    "emergencyContactPhone" TEXT,
    "status" "EmployeeStatus" NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Employee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalaryRecord" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "salaryMonth" INTEGER NOT NULL,
    "salaryYear" INTEGER NOT NULL,
    "baseSalary" DECIMAL(12,2) NOT NULL,
    "totalAdvance" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "totalDeductions" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "totalBonus" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "totalPaid" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "netPayable" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "remainingBalance" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "paymentStatus" "SalaryPaymentStatus" NOT NULL DEFAULT 'UNPAID',
    "finalized" BOOLEAN NOT NULL DEFAULT false,
    "finalizedAt" TIMESTAMP(3),
    "createdByUserId" TEXT NOT NULL,
    "approvedByUserId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SalaryRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalaryTransaction" (
    "id" TEXT NOT NULL,
    "salaryRecordId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "transactionType" "SalaryTransactionType" NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "adjustmentDirection" "SalaryAdjustmentDirection",
    "transactionDate" TIMESTAMP(3) NOT NULL,
    "reason" TEXT,
    "paymentMethod" "PaymentMethod",
    "transactionReference" TEXT,
    "notes" TEXT,
    "isReversed" BOOLEAN NOT NULL DEFAULT false,
    "reversedAt" TIMESTAMP(3),
    "reversalReason" TEXT,
    "expenseId" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "approvedByUserId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SalaryTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Employee_employeeCode_key" ON "Employee"("employeeCode");

-- CreateIndex
CREATE UNIQUE INDEX "Employee_cnic_key" ON "Employee"("cnic");

-- CreateIndex
CREATE INDEX "Employee_status_idx" ON "Employee"("status");

-- CreateIndex
CREATE INDEX "Employee_department_idx" ON "Employee"("department");

-- CreateIndex
CREATE INDEX "Employee_position_idx" ON "Employee"("position");

-- CreateIndex
CREATE INDEX "Employee_isActive_idx" ON "Employee"("isActive");

-- CreateIndex
CREATE INDEX "Employee_fullName_idx" ON "Employee"("fullName");

-- CreateIndex
CREATE INDEX "Employee_phone_idx" ON "Employee"("phone");

-- CreateIndex
CREATE INDEX "SalaryRecord_salaryMonth_salaryYear_idx" ON "SalaryRecord"("salaryMonth", "salaryYear");

-- CreateIndex
CREATE INDEX "SalaryRecord_paymentStatus_idx" ON "SalaryRecord"("paymentStatus");

-- CreateIndex
CREATE INDEX "SalaryRecord_finalized_idx" ON "SalaryRecord"("finalized");

-- CreateIndex
CREATE INDEX "SalaryRecord_createdByUserId_idx" ON "SalaryRecord"("createdByUserId");

-- CreateIndex
CREATE INDEX "SalaryRecord_approvedByUserId_idx" ON "SalaryRecord"("approvedByUserId");

-- CreateIndex
CREATE UNIQUE INDEX "SalaryRecord_employeeId_salaryMonth_salaryYear_key" ON "SalaryRecord"("employeeId", "salaryMonth", "salaryYear");

-- CreateIndex
CREATE UNIQUE INDEX "SalaryTransaction_expenseId_key" ON "SalaryTransaction"("expenseId");

-- CreateIndex
CREATE INDEX "SalaryTransaction_salaryRecordId_idx" ON "SalaryTransaction"("salaryRecordId");

-- CreateIndex
CREATE INDEX "SalaryTransaction_employeeId_idx" ON "SalaryTransaction"("employeeId");

-- CreateIndex
CREATE INDEX "SalaryTransaction_transactionType_idx" ON "SalaryTransaction"("transactionType");

-- CreateIndex
CREATE INDEX "SalaryTransaction_transactionDate_idx" ON "SalaryTransaction"("transactionDate");

-- CreateIndex
CREATE INDEX "SalaryTransaction_isReversed_idx" ON "SalaryTransaction"("isReversed");

-- CreateIndex
CREATE INDEX "SalaryTransaction_createdByUserId_idx" ON "SalaryTransaction"("createdByUserId");

-- CreateIndex
CREATE INDEX "SalaryTransaction_approvedByUserId_idx" ON "SalaryTransaction"("approvedByUserId");

-- CreateIndex
CREATE INDEX "Expense_employeeId_idx" ON "Expense"("employeeId");

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalaryRecord" ADD CONSTRAINT "SalaryRecord_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalaryRecord" ADD CONSTRAINT "SalaryRecord_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalaryRecord" ADD CONSTRAINT "SalaryRecord_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalaryTransaction" ADD CONSTRAINT "SalaryTransaction_salaryRecordId_fkey" FOREIGN KEY ("salaryRecordId") REFERENCES "SalaryRecord"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalaryTransaction" ADD CONSTRAINT "SalaryTransaction_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalaryTransaction" ADD CONSTRAINT "SalaryTransaction_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES "Expense"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalaryTransaction" ADD CONSTRAINT "SalaryTransaction_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalaryTransaction" ADD CONSTRAINT "SalaryTransaction_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
