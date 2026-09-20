-- AlterEnum
ALTER TYPE "PaymentMethod" ADD VALUE IF NOT EXISTS 'SAFEPAY';

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "OnlinePaymentStatus" AS ENUM (
    'PENDING',
    'AUTHORIZED',
    'PAID',
    'FAILED',
    'CANCELLED',
    'REFUNDED',
    'PARTIALLY_REFUNDED',
    'EXPIRED'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- AlterTable Unit (website marketing)
ALTER TABLE "Unit" ADD COLUMN IF NOT EXISTS "displayName" TEXT;
ALTER TABLE "Unit" ADD COLUMN IF NOT EXISTS "description" TEXT;
ALTER TABLE "Unit" ADD COLUMN IF NOT EXISTS "maxGuests" INTEGER;
ALTER TABLE "Unit" ADD COLUMN IF NOT EXISTS "bedConfiguration" TEXT;
ALTER TABLE "Unit" ADD COLUMN IF NOT EXISTS "amenities" JSONB;
ALTER TABLE "Unit" ADD COLUMN IF NOT EXISTS "imageUrls" JSONB;
ALTER TABLE "Unit" ADD COLUMN IF NOT EXISTS "publicListed" BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS "Unit_publicListed_idx" ON "Unit"("publicListed");

-- AlterTable Booking
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "paymentHoldExpiresAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "Booking_bookingSource_idx" ON "Booking"("bookingSource");
CREATE INDEX IF NOT EXISTS "Booking_paymentHoldExpiresAt_idx" ON "Booking"("paymentHoldExpiresAt");

-- CreateTable OnlinePayment
CREATE TABLE IF NOT EXISTS "OnlinePayment" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "guestId" TEXT NOT NULL,
    "gateway" TEXT NOT NULL DEFAULT 'SAFEPAY',
    "tracker" TEXT,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'PKR',
    "status" "OnlinePaymentStatus" NOT NULL DEFAULT 'PENDING',
    "gatewayReference" TEXT,
    "paymentResponse" JSONB,
    "webhookEventId" TEXT,
    "webhookReceivedAt" TIMESTAMP(3),
    "idempotencyKey" TEXT NOT NULL,
    "checkoutUrl" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "paymentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OnlinePayment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "OnlinePayment_bookingId_key" ON "OnlinePayment"("bookingId");
CREATE UNIQUE INDEX IF NOT EXISTS "OnlinePayment_tracker_key" ON "OnlinePayment"("tracker");
CREATE UNIQUE INDEX IF NOT EXISTS "OnlinePayment_webhookEventId_key" ON "OnlinePayment"("webhookEventId");
CREATE UNIQUE INDEX IF NOT EXISTS "OnlinePayment_idempotencyKey_key" ON "OnlinePayment"("idempotencyKey");
CREATE UNIQUE INDEX IF NOT EXISTS "OnlinePayment_paymentId_key" ON "OnlinePayment"("paymentId");
CREATE INDEX IF NOT EXISTS "OnlinePayment_guestId_idx" ON "OnlinePayment"("guestId");
CREATE INDEX IF NOT EXISTS "OnlinePayment_status_idx" ON "OnlinePayment"("status");
CREATE INDEX IF NOT EXISTS "OnlinePayment_gateway_idx" ON "OnlinePayment"("gateway");
CREATE INDEX IF NOT EXISTS "OnlinePayment_expiresAt_idx" ON "OnlinePayment"("expiresAt");
CREATE INDEX IF NOT EXISTS "OnlinePayment_createdAt_idx" ON "OnlinePayment"("createdAt");

DO $$ BEGIN
  ALTER TABLE "OnlinePayment" ADD CONSTRAINT "OnlinePayment_bookingId_fkey"
    FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "OnlinePayment" ADD CONSTRAINT "OnlinePayment_paymentId_fkey"
    FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
