-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "OnlinePaymentSelection" AS ENUM ('ADVANCE_50', 'FULL_100');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- AlterTable OnlinePayment
ALTER TABLE "OnlinePayment"
  ADD COLUMN IF NOT EXISTS "paymentSelection" "OnlinePaymentSelection" NOT NULL DEFAULT 'FULL_100';

ALTER TABLE "OnlinePayment"
  ADD COLUMN IF NOT EXISTS "bookingTotalAmount" DECIMAL(12,2);

-- Backfill booking totals from linked Booking rows, then require NOT NULL
UPDATE "OnlinePayment" AS op
SET "bookingTotalAmount" = b."totalAmount"
FROM "Booking" b
WHERE op."bookingId" = b."id"
  AND op."bookingTotalAmount" IS NULL;

UPDATE "OnlinePayment"
SET "bookingTotalAmount" = "amount"
WHERE "bookingTotalAmount" IS NULL;

ALTER TABLE "OnlinePayment"
  ALTER COLUMN "bookingTotalAmount" SET NOT NULL;

CREATE INDEX IF NOT EXISTS "OnlinePayment_paymentSelection_idx"
  ON "OnlinePayment"("paymentSelection");
