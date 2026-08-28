-- AlterTable
ALTER TABLE "User" ADD COLUMN     "canAccessProfitLoss" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "Expense_expenseDate_isActive_idx" ON "Expense"("expenseDate", "isActive");

-- CreateIndex
CREATE INDEX "Payment_paymentDate_status_idx" ON "Payment"("paymentDate", "status");
