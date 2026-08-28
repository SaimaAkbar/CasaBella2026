-- Repair Monthly Tenant workflow: Agreement + Bill + link assignments
-- Preserves MonthlyTenant, MonthlyTenancy rows, Payments, HotelUse, RentCredit.

-- Enums
CREATE TYPE "MonthlyAgreementStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ENDED', 'CANCELLED');
CREATE TYPE "MonthlyBillPaymentStatus" AS ENUM ('UNPAID', 'ADVANCE', 'PARTIAL', 'HALF_PAID', 'PAID', 'OVERDUE', 'OVERPAID');
ALTER TYPE "PaymentForType" ADD VALUE 'MONTHLY_BILL';

-- Agreements
CREATE TABLE "MonthlyAgreement" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "agreementNumber" TEXT NOT NULL,
    "agreementStart" TIMESTAMP(3) NOT NULL,
    "agreementEnd" TIMESTAMP(3),
    "billingDay" INTEGER NOT NULL DEFAULT 1,
    "securityDeposit" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "status" "MonthlyAgreementStatus" NOT NULL DEFAULT 'DRAFT',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3),
    CONSTRAINT "MonthlyAgreement_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MonthlyAgreement_agreementNumber_key" ON "MonthlyAgreement"("agreementNumber");
CREATE INDEX "MonthlyAgreement_tenantId_idx" ON "MonthlyAgreement"("tenantId");
CREATE INDEX "MonthlyAgreement_status_idx" ON "MonthlyAgreement"("status");
CREATE INDEX "MonthlyAgreement_agreementStart_idx" ON "MonthlyAgreement"("agreementStart");
CREATE INDEX "MonthlyAgreement_billingDay_idx" ON "MonthlyAgreement"("billingDay");

ALTER TABLE "MonthlyAgreement"
  ADD CONSTRAINT "MonthlyAgreement_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "MonthlyTenant"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- Bills
CREATE TABLE "MonthlyBill" (
    "id" TEXT NOT NULL,
    "agreementId" TEXT NOT NULL,
    "billingMonth" INTEGER NOT NULL,
    "billingYear" INTEGER NOT NULL,
    "baseRent" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "electricityCharges" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "maintenanceCharges" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "societyCharges" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "cleaningCharges" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "laundryCharges" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "waterCharges" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "otherCharges" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "previousBalance" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "credits" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "totalPayable" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "totalReceived" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "remainingBalance" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "paymentStatus" "MonthlyBillPaymentStatus" NOT NULL DEFAULT 'UNPAID',
    "finalized" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MonthlyBill_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MonthlyBill_agreementId_billingMonth_billingYear_key"
  ON "MonthlyBill"("agreementId", "billingMonth", "billingYear");
CREATE INDEX "MonthlyBill_agreementId_idx" ON "MonthlyBill"("agreementId");
CREATE INDEX "MonthlyBill_billingMonth_billingYear_idx" ON "MonthlyBill"("billingMonth", "billingYear");
CREATE INDEX "MonthlyBill_paymentStatus_idx" ON "MonthlyBill"("paymentStatus");
CREATE INDEX "MonthlyBill_dueDate_idx" ON "MonthlyBill"("dueDate");
CREATE INDEX "MonthlyBill_finalized_idx" ON "MonthlyBill"("finalized");

ALTER TABLE "MonthlyBill"
  ADD CONSTRAINT "MonthlyBill_agreementId_fkey"
  FOREIGN KEY ("agreementId") REFERENCES "MonthlyAgreement"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- Link assignments to agreements (nullable during backfill)
ALTER TABLE "MonthlyTenancy" ADD COLUMN "agreementId" TEXT;

-- Backfill: one agreement per existing tenancy (preserves history 1:1)
INSERT INTO "MonthlyAgreement" (
  "id",
  "tenantId",
  "agreementNumber",
  "agreementStart",
  "agreementEnd",
  "billingDay",
  "securityDeposit",
  "status",
  "notes",
  "createdAt",
  "updatedAt",
  "endedAt"
)
SELECT
  gen_random_uuid()::text,
  t."tenantId",
  'MAG-' || to_char(t."agreementStart" AT TIME ZONE 'UTC', 'YYYYMMDD') || '-' || substr(replace(t."id", '-', ''), 1, 8),
  t."agreementStart",
  t."agreementEnd",
  1,
  t."securityDeposit",
  CASE t."tenancyStatus"
    WHEN 'ACTIVE' THEN 'ACTIVE'::"MonthlyAgreementStatus"
    WHEN 'ENDED' THEN 'ENDED'::"MonthlyAgreementStatus"
    ELSE 'CANCELLED'::"MonthlyAgreementStatus"
  END,
  t."notes",
  t."createdAt",
  t."updatedAt",
  t."endedAt"
FROM "MonthlyTenancy" t;

UPDATE "MonthlyTenancy" mt
SET "agreementId" = a."id"
FROM "MonthlyAgreement" a
WHERE a."agreementNumber" = 'MAG-' || to_char(mt."agreementStart" AT TIME ZONE 'UTC', 'YYYYMMDD') || '-' || substr(replace(mt."id", '-', ''), 1, 8);

-- Safety: any row still missing an agreement gets a synthetic one
INSERT INTO "MonthlyAgreement" (
  "id", "tenantId", "agreementNumber", "agreementStart", "agreementEnd",
  "billingDay", "securityDeposit", "status", "notes", "createdAt", "updatedAt", "endedAt"
)
SELECT
  gen_random_uuid()::text,
  mt."tenantId",
  'MAG-ORPHAN-' || substr(replace(mt."id", '-', ''), 1, 12),
  mt."agreementStart",
  mt."agreementEnd",
  1,
  mt."securityDeposit",
  CASE mt."tenancyStatus"
    WHEN 'ACTIVE' THEN 'ACTIVE'::"MonthlyAgreementStatus"
    WHEN 'ENDED' THEN 'ENDED'::"MonthlyAgreementStatus"
    ELSE 'CANCELLED'::"MonthlyAgreementStatus"
  END,
  mt."notes",
  mt."createdAt",
  mt."updatedAt",
  mt."endedAt"
FROM "MonthlyTenancy" mt
WHERE mt."agreementId" IS NULL;

UPDATE "MonthlyTenancy" mt
SET "agreementId" = a."id"
FROM "MonthlyAgreement" a
WHERE mt."agreementId" IS NULL
  AND a."agreementNumber" = 'MAG-ORPHAN-' || substr(replace(mt."id", '-', ''), 1, 12);

ALTER TABLE "MonthlyTenancy" ALTER COLUMN "agreementId" SET NOT NULL;

CREATE INDEX "MonthlyTenancy_agreementId_idx" ON "MonthlyTenancy"("agreementId");

ALTER TABLE "MonthlyTenancy"
  ADD CONSTRAINT "MonthlyTenancy_agreementId_fkey"
  FOREIGN KEY ("agreementId") REFERENCES "MonthlyAgreement"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- Seed current-month bill for each ACTIVE agreement from assignment rollups
INSERT INTO "MonthlyBill" (
  "id",
  "agreementId",
  "billingMonth",
  "billingYear",
  "baseRent",
  "electricityCharges",
  "maintenanceCharges",
  "societyCharges",
  "cleaningCharges",
  "laundryCharges",
  "waterCharges",
  "otherCharges",
  "previousBalance",
  "credits",
  "totalPayable",
  "totalReceived",
  "remainingBalance",
  "dueDate",
  "paymentStatus",
  "finalized",
  "createdAt",
  "updatedAt"
)
SELECT
  gen_random_uuid()::text,
  a."id",
  EXTRACT(MONTH FROM CURRENT_DATE)::int,
  EXTRACT(YEAR FROM CURRENT_DATE)::int,
  COALESCE((
    SELECT SUM(mt."monthlyRent")
    FROM "MonthlyTenancy" mt
    WHERE mt."agreementId" = a."id" AND mt."tenancyStatus" = 'ACTIVE'
  ), 0),
  COALESCE((
    SELECT SUM(mt."electricityCharges")
    FROM "MonthlyTenancy" mt
    WHERE mt."agreementId" = a."id" AND mt."tenancyStatus" = 'ACTIVE'
  ), 0),
  COALESCE((
    SELECT SUM(mt."maintenanceCharges")
    FROM "MonthlyTenancy" mt
    WHERE mt."agreementId" = a."id" AND mt."tenancyStatus" = 'ACTIVE'
  ), 0),
  COALESCE((
    SELECT SUM(mt."societyCharges")
    FROM "MonthlyTenancy" mt
    WHERE mt."agreementId" = a."id" AND mt."tenancyStatus" = 'ACTIVE'
  ), 0),
  COALESCE((
    SELECT SUM(mt."cleaningCharges")
    FROM "MonthlyTenancy" mt
    WHERE mt."agreementId" = a."id" AND mt."tenancyStatus" = 'ACTIVE'
  ), 0),
  COALESCE((
    SELECT SUM(mt."laundryCharges")
    FROM "MonthlyTenancy" mt
    WHERE mt."agreementId" = a."id" AND mt."tenancyStatus" = 'ACTIVE'
  ), 0),
  COALESCE((
    SELECT SUM(mt."waterCharges")
    FROM "MonthlyTenancy" mt
    WHERE mt."agreementId" = a."id" AND mt."tenancyStatus" = 'ACTIVE'
  ), 0),
  COALESCE((
    SELECT SUM(mt."otherCharges")
    FROM "MonthlyTenancy" mt
    WHERE mt."agreementId" = a."id" AND mt."tenancyStatus" = 'ACTIVE'
  ), 0),
  COALESCE((
    SELECT SUM(mt."previousBalance")
    FROM "MonthlyTenancy" mt
    WHERE mt."agreementId" = a."id" AND mt."tenancyStatus" = 'ACTIVE'
  ), 0),
  0,
  COALESCE((
    SELECT SUM(mt."totalPayable")
    FROM "MonthlyTenancy" mt
    WHERE mt."agreementId" = a."id" AND mt."tenancyStatus" = 'ACTIVE'
  ), 0),
  COALESCE((
    SELECT SUM(mt."totalReceived")
    FROM "MonthlyTenancy" mt
    WHERE mt."agreementId" = a."id" AND mt."tenancyStatus" = 'ACTIVE'
  ), 0),
  COALESCE((
    SELECT SUM(mt."remainingBalance")
    FROM "MonthlyTenancy" mt
    WHERE mt."agreementId" = a."id" AND mt."tenancyStatus" = 'ACTIVE'
  ), 0),
  make_timestamptz(
    EXTRACT(YEAR FROM CURRENT_DATE)::int,
    EXTRACT(MONTH FROM CURRENT_DATE)::int,
    LEAST(a."billingDay", 28),
    0, 0, 0,
    'UTC'
  ),
  'UNPAID'::"MonthlyBillPaymentStatus",
  false,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "MonthlyAgreement" a
WHERE a."status" = 'ACTIVE';

-- Payment → bill link
ALTER TABLE "Payment" ADD COLUMN "monthlyBillId" TEXT;

CREATE INDEX "Payment_monthlyBillId_idx" ON "Payment"("monthlyBillId");

ALTER TABLE "Payment"
  ADD CONSTRAINT "Payment_monthlyBillId_fkey"
  FOREIGN KEY ("monthlyBillId") REFERENCES "MonthlyBill"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Attach legacy tenancy payments to the current-month bill of that assignment's agreement
-- Keep paymentForType as MONTHLY_TENANCY (enum value MONTHLY_BILL may not be usable in same txn).
UPDATE "Payment" p
SET "monthlyBillId" = b."id"
FROM "MonthlyTenancy" mt
JOIN "MonthlyBill" b ON b."agreementId" = mt."agreementId"
WHERE p."monthlyTenancyId" = mt."id"
  AND p."monthlyBillId" IS NULL
  AND b."billingMonth" = EXTRACT(MONTH FROM CURRENT_DATE)::int
  AND b."billingYear" = EXTRACT(YEAR FROM CURRENT_DATE)::int;
