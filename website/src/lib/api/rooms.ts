import type { Room } from '@/types';
import { fetchPublicUnit, fetchPublicUnits, mapUnitToRoom } from './units';

export async function fetchRooms(dates?: {
  checkIn?: string;
  checkOut?: string;
}): Promise<Room[]> {
  const units = await fetchPublicUnits('ROOM', dates);
  return units.map(mapUnitToRoom);
}

export async function fetchRoomBySlug(
  slugOrId: string,
  dates?: { checkIn?: string; checkOut?: string },
): Promise<Room | null> {
  const unit = await fetchPublicUnit(slugOrId, dates);
  if (!unit || unit.unitType !== 'ROOM') {
    const all = await fetchPublicUnits('ROOM', dates);
    const match = all.find(
      (u) => u.id === slugOrId || u.unitNumber === slugOrId,
    );
    return match ? mapUnitToRoom(match) : null;
  }
  return mapUnitToRoom(unit);
}

export async function fetchRoomById(
  id: string,
  dates?: { checkIn?: string; checkOut?: string },
): Promise<Room | null> {
  return fetchRoomBySlug(id, dates);
}
