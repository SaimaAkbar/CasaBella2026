import type { Residence } from '@/types';
import {
  fetchPublicUnit,
  fetchPublicUnits,
  mapUnitToResidence,
} from './units';

export async function fetchResidences(dates?: {
  checkIn?: string;
  checkOut?: string;
}): Promise<Residence[]> {
  const units = await fetchPublicUnits('APARTMENT', dates);
  return units.map(mapUnitToResidence);
}

export async function fetchResidenceBySlug(
  slugOrId: string,
  dates?: { checkIn?: string; checkOut?: string },
): Promise<Residence | null> {
  const unit = await fetchPublicUnit(slugOrId, dates);
  if (!unit || unit.unitType !== 'APARTMENT') {
    const all = await fetchPublicUnits('APARTMENT', dates);
    const match = all.find(
      (u) => u.id === slugOrId || u.unitNumber === slugOrId,
    );
    return match ? mapUnitToResidence(match) : null;
  }
  return mapUnitToResidence(unit);
}

export async function fetchResidenceById(
  id: string,
  dates?: { checkIn?: string; checkOut?: string },
): Promise<Residence | null> {
  return fetchResidenceBySlug(id, dates);
}
