-- CreateTable
CREATE TABLE "RentRevision" (
    "id" TEXT NOT NULL,
    "tenancyId" TEXT NOT NULL,
    "oldRent" DECIMAL(12,2) NOT NULL,
    "newRent" DECIMAL(12,2) NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "reason" TEXT,
    "changedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RentRevision_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RentRevision_tenancyId_idx" ON "RentRevision"("tenancyId");

-- CreateIndex
CREATE INDEX "RentRevision_effectiveFrom_idx" ON "RentRevision"("effectiveFrom");

-- CreateIndex
CREATE INDEX "RentRevision_changedByUserId_idx" ON "RentRevision"("changedByUserId");

-- AddForeignKey
ALTER TABLE "RentRevision" ADD CONSTRAINT "RentRevision_tenancyId_fkey" FOREIGN KEY ("tenancyId") REFERENCES "MonthlyTenancy"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RentRevision" ADD CONSTRAINT "RentRevision_changedByUserId_fkey" FOREIGN KEY ("changedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
