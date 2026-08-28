-- AlterEnum
ALTER TYPE "ExpensePaymentStatus" ADD VALUE 'OVERDUE';

-- AlterTable
ALTER TABLE "ElectricityReading" ADD COLUMN     "dueDate" TIMESTAMP(3),
ADD COLUMN     "lateFineAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "lateFineApplied" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "lateFinePercentage" DECIMAL(5,2) NOT NULL DEFAULT 5,
ALTER COLUMN "currentUnits" DROP NOT NULL,
ALTER COLUMN "consumedUnits" DROP NOT NULL,
ALTER COLUMN "calculatedAmount" SET DEFAULT 0;

-- AlterTable
ALTER TABLE "Expense" ADD COLUMN     "bankName" TEXT,
ADD COLUMN     "billingMonth" INTEGER,
ADD COLUMN     "billingYear" INTEGER,
ADD COLUMN     "dueDate" TIMESTAMP(3),
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "paymentDate" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "ExpensePayment" (
    "id" TEXT NOT NULL,
    "expenseId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "paymentDate" TIMESTAMP(3) NOT NULL,
    "paymentMethod" "PaymentMethod" NOT NULL,
    "bankName" TEXT,
    "transactionReference" TEXT,
    "notes" TEXT,
    "isReversed" BOOLEAN NOT NULL DEFAULT false,
    "reversedAt" TIMESTAMP(3),
    "reversalReason" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExpensePayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ElectricityRateHistory" (
    "id" TEXT NOT NULL,
    "ratePerUnit" DECIMAL(12,2) NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effectiveTo" TIMESTAMP(3),
    "reason" TEXT,
    "changedByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ElectricityRateHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ExpensePayment_expenseId_idx" ON "ExpensePayment"("expenseId");

-- CreateIndex
CREATE INDEX "ExpensePayment_paymentDate_idx" ON "ExpensePayment"("paymentDate");

-- CreateIndex
CREATE INDEX "ExpensePayment_createdByUserId_idx" ON "ExpensePayment"("createdByUserId");

-- CreateIndex
CREATE INDEX "ExpensePayment_isReversed_idx" ON "ExpensePayment"("isReversed");

-- CreateIndex
CREATE INDEX "ElectricityRateHistory_effectiveFrom_idx" ON "ElectricityRateHistory"("effectiveFrom");

-- CreateIndex
CREATE INDEX "ElectricityRateHistory_changedByUserId_idx" ON "ElectricityRateHistory"("changedByUserId");

-- CreateIndex
CREATE INDEX "ElectricityReading_dueDate_idx" ON "ElectricityReading"("dueDate");

-- CreateIndex
CREATE INDEX "Expense_billingMonth_billingYear_idx" ON "Expense"("billingMonth", "billingYear");

-- CreateIndex
CREATE INDEX "Expense_dueDate_idx" ON "Expense"("dueDate");

-- AddForeignKey
ALTER TABLE "ExpensePayment" ADD CONSTRAINT "ExpensePayment_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES "Expense"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpensePayment" ADD CONSTRAINT "ExpensePayment_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ElectricityRateHistory" ADD CONSTRAINT "ElectricityRateHistory_changedByUserId_fkey" FOREIGN KEY ("changedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
