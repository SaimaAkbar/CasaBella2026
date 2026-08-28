import { Prisma, Role } from '../../generated/prisma/client';

type ItemRecord = {
  id: string;
  itemCode: string;
  categoryId: string;
  name: string;
  description: string | null;
  unitOfMeasure: string;
  currentQuantity: Prisma.Decimal;
  averageUnitCost: Prisma.Decimal;
  reorderLevel: Prisma.Decimal;
  supplierName: string | null;
  isConsumable: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  category?: { id: string; name: string } | null;
};

function money(value: Prisma.Decimal | null | undefined) {
  return value?.toString() ?? '0';
}

export function mapInventoryItem(item: ItemRecord, role: Role) {
  const base = {
    id: item.id,
    itemCode: item.itemCode,
    categoryId: item.categoryId,
    name: item.name,
    description: item.description,
    unitOfMeasure: item.unitOfMeasure,
    currentQuantity: money(item.currentQuantity),
    reorderLevel: money(item.reorderLevel),
    isConsumable: item.isConsumable,
    isActive: item.isActive,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    category: item.category ?? null,
    isLowStock: item.currentQuantity.lessThanOrEqualTo(item.reorderLevel),
  };

  if (role === Role.RECEPTIONIST) {
    return {
      ...base,
      averageUnitCost: null,
      supplierName: null,
    };
  }

  return {
    ...base,
    averageUnitCost: money(item.averageUnitCost),
    supplierName: item.supplierName,
  };
}
