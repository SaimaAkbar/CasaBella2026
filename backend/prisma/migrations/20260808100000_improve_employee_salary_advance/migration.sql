-- AlterEnum
ALTER TYPE "SalaryTransactionType" ADD VALUE 'REVERSAL';

-- AlterTable Employee
ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "city" TEXT;

-- AlterTable SalaryRecord
ALTER TABLE "SalaryRecord" ADD COLUMN IF NOT EXISTS "dueDate" TIMESTAMP(3);

-- AlterTable SalaryTransaction
ALTER TABLE "SalaryTransaction" ADD COLUMN IF NOT EXISTS "reversesTransactionId" TEXT;

-- CreateTable
CREATE TABLE IF NOT EXISTS "SalaryRevision" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "oldSalary" DECIMAL(12,2) NOT NULL,
    "newSalary" DECIMAL(12,2) NOT NULL,
    "effectiveMonth" INTEGER NOT NULL,
    "effectiveYear" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "changedByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SalaryRevision_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "SalaryRevision_employeeId_idx" ON "SalaryRevision"("employeeId");
CREATE INDEX IF NOT EXISTS "SalaryRevision_employeeId_effectiveYear_effectiveMonth_idx" ON "SalaryRevision"("employeeId", "effectiveYear", "effectiveMonth");
CREATE INDEX IF NOT EXISTS "SalaryRevision_changedByUserId_idx" ON "SalaryRevision"("changedByUserId");
CREATE INDEX IF NOT EXISTS "SalaryTransaction_reversesTransactionId_idx" ON "SalaryTransaction"("reversesTransactionId");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "SalaryRevision" ADD CONSTRAINT "SalaryRevision_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "SalaryRevision" ADD CONSTRAINT "SalaryRevision_changedByUserId_fkey" FOREIGN KEY ("changedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "SalaryTransaction" ADD CONSTRAINT "SalaryTransaction_reversesTransactionId_fkey" FOREIGN KEY ("reversesTransactionId") REFERENCES "SalaryTransaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
