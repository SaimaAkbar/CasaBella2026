export type InventoryMovementType =
  | 'PURCHASE'
  | 'ISSUE'
  | 'RETURN'
  | 'TRANSFER'
  | 'ADJUSTMENT'
  | 'DAMAGE'
  | 'LOSS';

export type RoomAssetCondition =
  | 'GOOD'
  | 'FAIR'
  | 'DAMAGED'
  | 'UNDER_REPAIR'
  | 'REPLACED'
  | 'MISSING';

export type InventoryCategory = {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  _count?: { items: number };
};

export type InventoryItem = {
  id: string;
  itemCode: string;
  categoryId: string;
  name: string;
  description: string | null;
  unitOfMeasure: string;
  currentQuantity: string;
  averageUnitCost: string | null;
  reorderLevel: string;
  supplierName: string | null;
  isConsumable: boolean;
  isActive: boolean;
  isLowStock: boolean;
  createdAt: string;
  updatedAt: string;
  category: { id: string; name: string } | null;
};

export type InventoryItemInput = {
  name: string;
  categoryId: string;
  description?: string;
  unitOfMeasure: string;
  openingQuantity?: number;
  openingUnitCost?: number;
  reorderLevel?: number;
  supplierName?: string;
  isConsumable?: boolean;
};

export type InventoryItemQuery = {
  categoryId?: string;
  isConsumable?: boolean | '';
  isActive?: boolean | '';
  lowStock?: boolean | '';
  search?: string;
};

export type InventorySummary = {
  totalInventoryItems: number;
  activeInventoryItems: number;
  totalStockQuantity: string;
  lowStockItems: number;
  stockPurchasedThisMonth: string;
  stockIssuedThisMonth: string;
  inventoryExpenseThisMonth?: string;
  roomAssets: number;
  damagedAssets: number;
};

export type InventoryMovement = {
  id: string;
  movementNumber: string;
  itemId: string;
  movementType: InventoryMovementType;
  quantity: string;
  unitCost: string | null;
  totalCost: string | null;
  movementDate: string;
  sourcePropertyId: string | null;
  sourceUnitId: string | null;
  destinationPropertyId: string | null;
  destinationUnitId: string | null;
  bookingId: string | null;
  monthlyTenancyId: string | null;
  employeeId: string | null;
  expenseId: string | null;
  referenceNumber: string | null;
  reason: string | null;
  notes: string | null;
  createdByUserId: string;
  approvedByUserId: string | null;
  approvedAt: string | null;
  createdAt: string;
  updatedAt: string;
  item: {
    id: string;
    itemCode: string;
    name: string;
    unitOfMeasure: string;
  } | null;
  sourceProperty: { id: string; name: string } | null;
  sourceUnit: { id: string; unitNumber: string } | null;
  destinationProperty: { id: string; name: string } | null;
  destinationUnit: { id: string; unitNumber: string } | null;
  expense: { id: string; expenseNumber: string } | null;
  createdBy: { id: string; fullName: string } | null;
  approvedBy: { id: string; fullName: string } | null;
};

export type InventoryMovementQuery = {
  itemId?: string;
  movementType?: InventoryMovementType | '';
  propertyId?: string;
  unitId?: string;
  bookingId?: string;
  monthlyTenancyId?: string;
  employeeId?: string;
  date?: string;
  month?: number | '';
  year?: number | '';
  startDate?: string;
  endDate?: string;
  search?: string;
};

export type PurchaseMovementInput = {
  itemId: string;
  quantity: number;
  unitCost: number;
  movementDate: string;
  supplierName?: string;
  referenceNumber?: string;
  propertyId?: string;
  notes?: string;
};

export type IssueMovementInput = {
  itemId: string;
  quantity: number;
  movementDate: string;
  destinationPropertyId?: string;
  destinationUnitId?: string;
  bookingId?: string;
  monthlyTenancyId?: string;
  employeeId?: string;
  reason?: string;
  notes?: string;
};

export type ReturnMovementInput = {
  itemId: string;
  quantity: number;
  movementDate: string;
  sourcePropertyId?: string;
  sourceUnitId?: string;
  referenceNumber?: string;
  reason: string;
  notes?: string;
};

export type TransferMovementInput = {
  itemId: string;
  quantity: number;
  movementDate: string;
  sourcePropertyId: string;
  sourceUnitId?: string;
  destinationPropertyId: string;
  destinationUnitId?: string;
  reason: string;
  notes?: string;
};

export type AdjustMovementInput = {
  itemId: string;
  quantity: number;
  movementDate: string;
  reason: string;
  notes?: string;
};

export type DamageOrLossMovementInput = {
  itemId: string;
  quantity: number;
  movementDate: string;
  propertyId?: string;
  unitId?: string;
  reason: string;
  replacementCost?: number;
  notes?: string;
};

export type RoomAsset = {
  id: string;
  assetCode: string;
  propertyId: string;
  unitId: string;
  itemName: string;
  category: string | null;
  quantity: string;
  purchaseCost: string | null;
  assignedDate: string;
  condition: RoomAssetCondition;
  serialNumber: string | null;
  brand: string | null;
  model: string | null;
  notes: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  property: { id: string; name: string } | null;
  unit: { id: string; unitNumber: string } | null;
};

export type RoomAssetInput = {
  propertyId: string;
  unitId: string;
  itemName: string;
  category?: string;
  quantity: number;
  purchaseCost?: number;
  assignedDate: string;
  condition?: RoomAssetCondition;
  serialNumber?: string;
  brand?: string;
  model?: string;
  notes?: string;
};

export type RoomAssetQuery = {
  propertyId?: string;
  unitId?: string;
  condition?: RoomAssetCondition | '';
  isActive?: boolean | '';
  search?: string;
};

export type ChangeRoomAssetConditionInput = {
  newCondition: RoomAssetCondition;
  quantityAffected?: number;
  actionDate: string;
  repairCost?: number;
  replacementCost?: number;
  reason: string;
  notes?: string;
};

export type RoomAssetHistory = {
  id: string;
  previousCondition: RoomAssetCondition | null;
  newCondition: RoomAssetCondition;
  quantityAffected: string;
  actionDate: string;
  repairCost: string | null;
  replacementCost: string | null;
  reason: string | null;
  notes: string | null;
  expense: { id: string; expenseNumber: string } | null;
  createdBy: { id: string; fullName: string } | null;
  createdAt: string;
};
