-- AlterTable
ALTER TABLE "Expense" ADD COLUMN     "excludeFromFinancials" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "expenseName" TEXT,
ADD COLUMN     "parentExpenseId" TEXT;

-- CreateIndex
CREATE INDEX "Expense_parentExpenseId_idx" ON "Expense"("parentExpenseId");

-- CreateIndex
CREATE INDEX "Expense_excludeFromFinancials_idx" ON "Expense"("excludeFromFinancials");

-- CreateIndex
CREATE INDEX "Expense_expenseName_idx" ON "Expense"("expenseName");

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_parentExpenseId_fkey" FOREIGN KEY ("parentExpenseId") REFERENCES "Expense"("id") ON DELETE SET NULL ON UPDATE CASCADE;
