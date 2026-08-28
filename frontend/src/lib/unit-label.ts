type UnitLabelInput = {
  unitNumber: string;
  unitType?: string | null;
  floor?: number | null;
  property?: { name?: string | null } | null;
  propertyName?: string | null;
};

function unitTypeLabel(unitType?: string | null): string {
  if (unitType === 'APARTMENT') return 'Apartment';
  if (unitType === 'ROOM') return 'Room';
  return unitType?.trim() || 'Unit';
}

/** Display: `Casa Bella — Apartment 1A — Floor 1` */
export function formatUnitOptionLabel(unit: UnitLabelInput): string {
  const propertyName =
    unit.property?.name?.trim() || unit.propertyName?.trim() || 'Property';
  const typeLabel = unitTypeLabel(unit.unitType);
  const parts = [`${propertyName} — ${typeLabel} ${unit.unitNumber}`];
  if (unit.floor != null && unit.floor !== undefined) {
    parts.push(`Floor ${unit.floor}`);
  }
  return parts.join(' — ');
}

export const NO_ELIGIBLE_UNITS_MESSAGE =
  'No eligible rooms or apartments are available in this property.';
