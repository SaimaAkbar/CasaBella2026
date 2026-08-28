import {
  InventoryMovementType,
  Prisma,
  Role,
} from '../../generated/prisma/client';

type MovementRecord = {
  id: string;
  movementNumber: string;
  itemId: string;
  movementType: InventoryMovementType;
  quantity: Prisma.Decimal;
  unitCost: Prisma.Decimal;
  totalCost: Prisma.Decimal;
  movementDate: Date;
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
  approvedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  item?: { id: string; itemCode: string; name: string; unitOfMeasure: string } | null;
  sourceProperty?: { id: string; name: string } | null;
  sourceUnit?: { id: string; unitNumber: string } | null;
  destinationProperty?: { id: string; name: string } | null;
  destinationUnit?: { id: string; unitNumber: string } | null;
  expense?: { id: string; expenseNumber: string } | null;
  createdBy?: { id: string; fullName: string } | null;
  approvedBy?: { id: string; fullName: string } | null;
};

function money(value: Prisma.Decimal | null | undefined) {
  return value?.toString() ?? '0';
}

export function mapInventoryMovement(row: MovementRecord, role: Role) {
  const base = {
    id: row.id,
    movementNumber: row.movementNumber,
    itemId: row.itemId,
    movementType: row.movementType,
    quantity: money(row.quantity),
    movementDate: row.movementDate,
    sourcePropertyId: row.sourcePropertyId,
    sourceUnitId: row.sourceUnitId,
    destinationPropertyId: row.destinationPropertyId,
    destinationUnitId: row.destinationUnitId,
    bookingId: row.bookingId,
    monthlyTenancyId: row.monthlyTenancyId,
    employeeId: row.employeeId,
    expenseId: row.expenseId,
    referenceNumber: row.referenceNumber,
    reason: row.reason,
    notes: row.notes,
    createdByUserId: row.createdByUserId,
    approvedByUserId: row.approvedByUserId,
    approvedAt: row.approvedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    item: row.item ?? null,
    sourceProperty: row.sourceProperty ?? null,
    sourceUnit: row.sourceUnit ?? null,
    destinationProperty: row.destinationProperty ?? null,
    destinationUnit: row.destinationUnit ?? null,
    expense: row.expense ?? null,
    createdBy: row.createdBy
      ? { id: row.createdBy.id, fullName: row.createdBy.fullName }
      : null,
    approvedBy: row.approvedBy
      ? { id: row.approvedBy.id, fullName: row.approvedBy.fullName }
      : null,
  };

  if (role === Role.RECEPTIONIST) {
    return { ...base, unitCost: null, totalCost: null };
  }

  return {
    ...base,
    unitCost: money(row.unitCost),
    totalCost: money(row.totalCost),
  };
}
