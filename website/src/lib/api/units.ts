import type { PublicUnit, Residence, Room } from '@/types';
import { apiFetch, getApiBase } from './client';

const PLACEHOLDER_IMAGE =
  'https://images.unsplash.com/photo-1611892440504-42a792e24d32?auto=format&fit=crop&w=1200&q=80';

function asStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((v): v is string => typeof v === 'string');
  }
  return [];
}

function rateAmount(dailyRate: string | number | null | undefined): number | null {
  if (dailyRate == null || dailyRate === '') return null;
  const n = Number(dailyRate);
  return Number.isFinite(n) ? n : null;
}

/** Resolve relative upload paths (e.g. /uploads/…) against the POS API host. */
function resolveImageSrc(src: string): string {
  if (!src) return PLACEHOLDER_IMAGE;
  if (/^https?:\/\//i.test(src) || src.startsWith('data:')) return src;
  const base = getApiBase().replace(/\/$/, '');
  return src.startsWith('/') ? `${base}${src}` : `${base}/${src}`;
}

function unitImages(unit: PublicUnit, alt: string) {
  const urls = asStringArray(unit.imageUrls);
  const sources = urls.length > 0 ? urls : [PLACEHOLDER_IMAGE];
  return sources.map((src, index) => ({
    id: `${unit.id}-img-${index}`,
    src: resolveImageSrc(src),
    alt: `${alt} photo ${index + 1}`,
  }));
}

function unitAmenities(unit: PublicUnit) {
  return asStringArray(unit.amenities).map((name, index) => ({
    id: `${unit.id}-amenity-${index}`,
    name,
  }));
}

function availabilityFields(unit: PublicUnit) {
  const bookingAvailability = unit.bookingAvailability ?? 'AVAILABLE';
  const canBook = unit.canBook ?? bookingAvailability === 'AVAILABLE';
  const bookingLabel =
    unit.bookingLabel ??
    (canBook
      ? 'BOOK NOW'
      : bookingAvailability === 'BOOKED'
        ? 'ALREADY BOOKED'
        : 'UNAVAILABLE');
  return { bookingAvailability, canBook, bookingLabel };
}

export function mapUnitToRoom(unit: PublicUnit): Room {
  const name = unit.displayName || unit.unitNumber;
  const rate = rateAmount(unit.dailyRate);
  const availability = availabilityFields(unit);
  const desc =
    unit.description?.trim() ||
    `${unit.propertyName} · Room ${unit.unitNumber}`;
  return {
    id: unit.id,
    slug: unit.id,
    name,
    roomNumber: unit.roomNumber || unit.unitNumber,
    shortDescription: desc.slice(0, 160),
    description: desc,
    guests: unit.maxGuests ?? 2,
    bedType: unit.bedConfiguration || 'Standard bedding',
    sizeSqm: null,
    amenities: unitAmenities(unit),
    startingPrice: {
      amount: rate,
      currency: 'PKR',
      label: rate != null ? `PKR ${rate.toLocaleString()}` : 'Rate on request',
    },
    images: unitImages(unit, name),
    propertyId: unit.propertyId,
    availableByDefault: availability.canBook,
    ...availability,
  };
}

export function mapUnitToResidence(unit: PublicUnit): Residence {
  const name = unit.displayName || unit.unitNumber;
  const rate = rateAmount(unit.dailyRate);
  const bedrooms = unit.bedrooms ?? 1;
  const availability = availabilityFields(unit);
  const desc =
    unit.description?.trim() ||
    `${unit.propertyName} · Apartment ${unit.unitNumber}`;
  return {
    id: unit.id,
    slug: unit.id,
    name,
    roomNumber: unit.roomNumber || unit.unitNumber,
    type: bedrooms <= 0 ? 'Studio' : `${bedrooms} Bedroom Apartment`,
    shortDescription: desc.slice(0, 160),
    description: desc,
    bedrooms,
    bathrooms: 1,
    guests: unit.maxGuests ?? Math.max(2, bedrooms * 2),
    beds: unit.bedConfiguration || 'Standard bedding',
    sizeSqm: null,
    amenities: unitAmenities(unit),
    startingPrice: {
      amount: rate,
      currency: 'PKR',
      label: rate != null ? `PKR ${rate.toLocaleString()}` : 'Rate on request',
    },
    images: unitImages(unit, name),
    minStayNights: null,
    propertyId: unit.propertyId,
    availableByDefault: availability.canBook,
    ...availability,
  };
}

export async function fetchPublicUnits(
  unitType?: 'ROOM' | 'APARTMENT',
  dates?: { checkIn?: string; checkOut?: string },
): Promise<PublicUnit[]> {
  const params = new URLSearchParams();
  if (unitType) params.set('unitType', unitType);
  if (dates?.checkIn) params.set('checkInDateTime', `${dates.checkIn}T14:00:00.000Z`);
  if (dates?.checkOut) {
    params.set('checkOutDateTime', `${dates.checkOut}T12:00:00.000Z`);
  }
  const q = params.toString() ? `?${params.toString()}` : '';
  return apiFetch<PublicUnit[]>(`/public/units${q}`);
}

export async function fetchPublicUnit(
  id: string,
  dates?: { checkIn?: string; checkOut?: string },
): Promise<PublicUnit | null> {
  try {
    const params = new URLSearchParams();
    if (dates?.checkIn) {
      params.set('checkInDateTime', `${dates.checkIn}T14:00:00.000Z`);
    }
    if (dates?.checkOut) {
      params.set('checkOutDateTime', `${dates.checkOut}T12:00:00.000Z`);
    }
    const q = params.toString() ? `?${params.toString()}` : '';
    return await apiFetch<PublicUnit>(`/public/units/${id}${q}`);
  } catch {
    return null;
  }
}
