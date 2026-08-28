-- CreateEnum
CREATE TYPE "InventoryMovementType" AS ENUM ('PURCHASE', 'ISSUE', 'RETURN', 'TRANSFER', 'ADJUSTMENT', 'DAMAGE', 'LOSS');

-- CreateEnum
CREATE TYPE "RoomAssetCondition" AS ENUM ('GOOD', 'FAIR', 'DAMAGED', 'UNDER_REPAIR', 'REPLACED', 'MISSING');

-- CreateTable
CREATE TABLE "InventoryCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventoryCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryItem" (
    "id" TEXT NOT NULL,
    "itemCode" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "unitOfMeasure" TEXT NOT NULL,
    "currentQuantity" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "averageUnitCost" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "reorderLevel" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "supplierName" TEXT,
    "isConsumable" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventoryItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryMovement" (
    "id" TEXT NOT NULL,
    "movementNumber" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "movementType" "InventoryMovementType" NOT NULL,
    "quantity" DECIMAL(12,3) NOT NULL,
    "unitCost" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "totalCost" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "movementDate" TIMESTAMP(3) NOT NULL,
    "sourcePropertyId" TEXT,
    "sourceUnitId" TEXT,
    "destinationPropertyId" TEXT,
    "destinationUnitId" TEXT,
    "bookingId" TEXT,
    "monthlyTenancyId" TEXT,
    "employeeId" TEXT,
    "expenseId" TEXT,
    "referenceNumber" TEXT,
    "reason" TEXT,
    "notes" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "approvedByUserId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventoryMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoomAsset" (
    "id" TEXT NOT NULL,
    "assetCode" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "itemName" TEXT NOT NULL,
    "category" TEXT,
    "quantity" DECIMAL(12,3) NOT NULL DEFAULT 1,
    "purchaseCost" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "assignedDate" TIMESTAMP(3) NOT NULL,
    "condition" "RoomAssetCondition" NOT NULL DEFAULT 'GOOD',
    "serialNumber" TEXT,
    "brand" TEXT,
    "model" TEXT,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RoomAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoomAssetHistory" (
    "id" TEXT NOT NULL,
    "roomAssetId" TEXT NOT NULL,
    "previousCondition" "RoomAssetCondition",
    "newCondition" "RoomAssetCondition" NOT NULL,
    "quantityAffected" DECIMAL(12,3) NOT NULL DEFAULT 1,
    "actionDate" TIMESTAMP(3) NOT NULL,
    "repairCost" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "replacementCost" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "reason" TEXT,
    "notes" TEXT,
    "expenseId" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RoomAssetHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "InventoryCategory_name_key" ON "InventoryCategory"("name");

-- CreateIndex
CREATE INDEX "InventoryCategory_isActive_idx" ON "InventoryCategory"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryItem_itemCode_key" ON "InventoryItem"("itemCode");

-- CreateIndex
CREATE INDEX "InventoryItem_categoryId_idx" ON "InventoryItem"("categoryId");

-- CreateIndex
CREATE INDEX "InventoryItem_name_idx" ON "InventoryItem"("name");

-- CreateIndex
CREATE INDEX "InventoryItem_isConsumable_idx" ON "InventoryItem"("isConsumable");

-- CreateIndex
CREATE INDEX "InventoryItem_isActive_idx" ON "InventoryItem"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryMovement_movementNumber_key" ON "InventoryMovement"("movementNumber");

-- CreateIndex
CREATE INDEX "InventoryMovement_itemId_idx" ON "InventoryMovement"("itemId");

-- CreateIndex
CREATE INDEX "InventoryMovement_movementType_idx" ON "InventoryMovement"("movementType");

-- CreateIndex
CREATE INDEX "InventoryMovement_movementDate_idx" ON "InventoryMovement"("movementDate");

-- CreateIndex
CREATE INDEX "InventoryMovement_sourcePropertyId_idx" ON "InventoryMovement"("sourcePropertyId");

-- CreateIndex
CREATE INDEX "InventoryMovement_sourceUnitId_idx" ON "InventoryMovement"("sourceUnitId");

-- CreateIndex
CREATE INDEX "InventoryMovement_destinationPropertyId_idx" ON "InventoryMovement"("destinationPropertyId");

-- CreateIndex
CREATE INDEX "InventoryMovement_destinationUnitId_idx" ON "InventoryMovement"("destinationUnitId");

-- CreateIndex
CREATE INDEX "InventoryMovement_bookingId_idx" ON "InventoryMovement"("bookingId");

-- CreateIndex
CREATE INDEX "InventoryMovement_monthlyTenancyId_idx" ON "InventoryMovement"("monthlyTenancyId");

-- CreateIndex
CREATE INDEX "InventoryMovement_employeeId_idx" ON "InventoryMovement"("employeeId");

-- CreateIndex
CREATE INDEX "InventoryMovement_expenseId_idx" ON "InventoryMovement"("expenseId");

-- CreateIndex
CREATE INDEX "InventoryMovement_createdByUserId_idx" ON "InventoryMovement"("createdByUserId");

-- CreateIndex
CREATE INDEX "InventoryMovement_approvedByUserId_idx" ON "InventoryMovement"("approvedByUserId");

-- CreateIndex
CREATE UNIQUE INDEX "RoomAsset_assetCode_key" ON "RoomAsset"("assetCode");

-- CreateIndex
CREATE INDEX "RoomAsset_propertyId_idx" ON "RoomAsset"("propertyId");

-- CreateIndex
CREATE INDEX "RoomAsset_unitId_idx" ON "RoomAsset"("unitId");

-- CreateIndex
CREATE INDEX "RoomAsset_condition_idx" ON "RoomAsset"("condition");

-- CreateIndex
CREATE INDEX "RoomAsset_isActive_idx" ON "RoomAsset"("isActive");

-- CreateIndex
CREATE INDEX "RoomAsset_itemName_idx" ON "RoomAsset"("itemName");

-- CreateIndex
CREATE INDEX "RoomAsset_serialNumber_idx" ON "RoomAsset"("serialNumber");

-- CreateIndex
CREATE INDEX "RoomAssetHistory_roomAssetId_idx" ON "RoomAssetHistory"("roomAssetId");

-- CreateIndex
CREATE INDEX "RoomAssetHistory_newCondition_idx" ON "RoomAssetHistory"("newCondition");

-- CreateIndex
CREATE INDEX "RoomAssetHistory_actionDate_idx" ON "RoomAssetHistory"("actionDate");

-- CreateIndex
CREATE INDEX "RoomAssetHistory_expenseId_idx" ON "RoomAssetHistory"("expenseId");

-- CreateIndex
CREATE INDEX "RoomAssetHistory_createdByUserId_idx" ON "RoomAssetHistory"("createdByUserId");

-- AddForeignKey
ALTER TABLE "InventoryItem" ADD CONSTRAINT "InventoryItem_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "InventoryCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "InventoryItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_sourcePropertyId_fkey" FOREIGN KEY ("sourcePropertyId") REFERENCES "Property"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_sourceUnitId_fkey" FOREIGN KEY ("sourceUnitId") REFERENCES "Unit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_destinationPropertyId_fkey" FOREIGN KEY ("destinationPropertyId") REFERENCES "Property"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_destinationUnitId_fkey" FOREIGN KEY ("destinationUnitId") REFERENCES "Unit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_monthlyTenancyId_fkey" FOREIGN KEY ("monthlyTenancyId") REFERENCES "MonthlyTenancy"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES "Expense"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoomAsset" ADD CONSTRAINT "RoomAsset_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoomAsset" ADD CONSTRAINT "RoomAsset_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoomAssetHistory" ADD CONSTRAINT "RoomAssetHistory_roomAssetId_fkey" FOREIGN KEY ("roomAssetId") REFERENCES "RoomAsset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoomAssetHistory" ADD CONSTRAINT "RoomAssetHistory_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES "Expense"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoomAssetHistory" ADD CONSTRAINT "RoomAssetHistory_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
