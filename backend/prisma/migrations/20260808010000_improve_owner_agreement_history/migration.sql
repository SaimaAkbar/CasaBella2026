-- AlterEnum
ALTER TYPE "OwnerAssignmentStatus" ADD VALUE 'DRAFT';

-- CreateTable
CREATE TABLE "OwnerAgreementRevision" (
    "id" TEXT NOT NULL,
    "ownerUnitAssignmentId" TEXT NOT NULL,
    "previousFixedMonthlyAmount" DECIMAL(12,2) NOT NULL,
    "newFixedMonthlyAmount" DECIMAL(12,2) NOT NULL,
    "previousOwnershipPercentage" DECIMAL(5,2),
    "newOwnershipPercentage" DECIMAL(5,2),
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "reason" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OwnerAgreementRevision_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "OwnerAgreementRevision_ownerUnitAssignmentId_idx" ON "OwnerAgreementRevision"("ownerUnitAssignmentId");
CREATE INDEX "OwnerAgreementRevision_effectiveFrom_idx" ON "OwnerAgreementRevision"("effectiveFrom");
CREATE INDEX "OwnerAgreementRevision_createdByUserId_idx" ON "OwnerAgreementRevision"("createdByUserId");
CREATE INDEX "OwnerAgreementRevision_createdAt_idx" ON "OwnerAgreementRevision"("createdAt");

ALTER TABLE "OwnerAgreementRevision" ADD CONSTRAINT "OwnerAgreementRevision_ownerUnitAssignmentId_fkey" FOREIGN KEY ("ownerUnitAssignmentId") REFERENCES "OwnerUnitAssignment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OwnerAgreementRevision" ADD CONSTRAINT "OwnerAgreementRevision_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
