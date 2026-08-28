-- Add dedupeKey, isResolved, resolvedAt, and updatedAt to Notification.
-- updatedAt backfills existing rows with createdAt so the NOT NULL constraint is satisfied.

-- AlterTable: add nullable columns first, backfill, then set NOT NULL for updatedAt
ALTER TABLE "Notification"
  ADD COLUMN "dedupeKey"  TEXT,
  ADD COLUMN "isResolved" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "resolvedAt" TIMESTAMP(3),
  ADD COLUMN "updatedAt"  TIMESTAMP(3);

-- Backfill updatedAt from createdAt for existing rows
UPDATE "Notification" SET "updatedAt" = "createdAt" WHERE "updatedAt" IS NULL;

-- Now enforce NOT NULL
ALTER TABLE "Notification" ALTER COLUMN "updatedAt" SET NOT NULL;

-- CreateIndex
CREATE INDEX "Notification_userId_dedupeKey_idx" ON "Notification"("userId", "dedupeKey");

-- CreateIndex
CREATE INDEX "Notification_dedupeKey_idx" ON "Notification"("dedupeKey");

-- CreateIndex
CREATE INDEX "Notification_isResolved_idx" ON "Notification"("isResolved");
