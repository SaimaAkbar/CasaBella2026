-- CreateTable
CREATE TABLE "WebsiteFacility" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "imageUrl" TEXT NOT NULL,
    "imageAlt" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WebsiteFacility_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WebsiteFacility_isActive_sortOrder_idx" ON "WebsiteFacility"("isActive", "sortOrder");

-- CreateIndex
CREATE INDEX "WebsiteFacility_sortOrder_idx" ON "WebsiteFacility"("sortOrder");
