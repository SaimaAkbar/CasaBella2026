-- Add thermal receipt metadata to payment ledgers (no data reset).
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "receiptNumber" TEXT;
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "lastPrintedAt" TIMESTAMP(3);
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "printCount" INTEGER NOT NULL DEFAULT 0;

CREATE UNIQUE INDEX IF NOT EXISTS "Payment_receiptNumber_key" ON "Payment"("receiptNumber");

ALTER TABLE "ExpensePayment" ADD COLUMN IF NOT EXISTS "receiptNumber" TEXT;
ALTER TABLE "ExpensePayment" ADD COLUMN IF NOT EXISTS "lastPrintedAt" TIMESTAMP(3);
ALTER TABLE "ExpensePayment" ADD COLUMN IF NOT EXISTS "printCount" INTEGER NOT NULL DEFAULT 0;

CREATE UNIQUE INDEX IF NOT EXISTS "ExpensePayment_receiptNumber_key" ON "ExpensePayment"("receiptNumber");
