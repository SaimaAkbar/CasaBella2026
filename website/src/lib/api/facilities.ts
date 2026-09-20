import type { Facility } from '@/types';
import { facilities as fallbackFacilities } from '@/data/facilities';
import { apiFetch, getApiBase, isMockMode } from './client';

type PublicFacility = {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string;
  imageAlt: string | null;
  sortOrder: number;
};

function resolveImageSrc(src: string): string {
  if (!src) return '';
  if (/^https?:\/\//i.test(src) || src.startsWith('data:')) return src;
  const base = getApiBase().replace(/\/$/, '');
  return src.startsWith('/') ? `${base}${src}` : `${base}/${src}`;
}

function mapPublicFacility(row: PublicFacility): Facility {
  return {
    id: row.id,
    name: row.name,
    description: row.description?.trim() || '',
    image: {
      id: `${row.id}-img`,
      src: resolveImageSrc(row.imageUrl),
      alt: row.imageAlt?.trim() || row.name,
    },
  };
}

/** Live POS facilities for the public site; falls back to static samples if API is down. */
export async function fetchFacilities(): Promise<Facility[]> {
  if (isMockMode()) {
    return fallbackFacilities;
  }
  try {
    const rows = await apiFetch<PublicFacility[]>('/public/facilities');
    if (!Array.isArray(rows) || rows.length === 0) {
      return [];
    }
    return rows.map(mapPublicFacility);
  } catch {
    return fallbackFacilities;
  }
}
