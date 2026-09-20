-- Manual bank transfer verification fields on OnlinePayment
ALTER TABLE "OnlinePayment" ADD COLUMN IF NOT EXISTS "submittedAmount" DECIMAL(12,2);
ALTER TABLE "OnlinePayment" ADD COLUMN IF NOT EXISTS "transactionReference" TEXT;
ALTER TABLE "OnlinePayment" ADD COLUMN IF NOT EXISTS "transferDate" TIMESTAMP(3);
ALTER TABLE "OnlinePayment" ADD COLUMN IF NOT EXISTS "senderName" TEXT;
ALTER TABLE "OnlinePayment" ADD COLUMN IF NOT EXISTS "senderBank" TEXT;
ALTER TABLE "OnlinePayment" ADD COLUMN IF NOT EXISTS "receiptPath" TEXT;
ALTER TABLE "OnlinePayment" ADD COLUMN IF NOT EXISTS "verifiedByUserId" TEXT;
ALTER TABLE "OnlinePayment" ADD COLUMN IF NOT EXISTS "verifiedAt" TIMESTAMP(3);
ALTER TABLE "OnlinePayment" ADD COLUMN IF NOT EXISTS "rejectionReason" TEXT;
ALTER TABLE "OnlinePayment" ADD COLUMN IF NOT EXISTS "staffNotes" TEXT;

-- Default gateway for new rows (existing rows keep their value)
ALTER TABLE "OnlinePayment" ALTER COLUMN "gateway" SET DEFAULT 'BANK_TRANSFER';

CREATE INDEX IF NOT EXISTS "OnlinePayment_transactionReference_idx" ON "OnlinePayment"("transactionReference");
CREATE INDEX IF NOT EXISTS "OnlinePayment_verifiedByUserId_idx" ON "OnlinePayment"("verifiedByUserId");

DO $$ BEGIN
  ALTER TABLE "OnlinePayment"
    ADD CONSTRAINT "OnlinePayment_verifiedByUserId_fkey"
    FOREIGN KEY ("verifiedByUserId") REFERENCES "User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
