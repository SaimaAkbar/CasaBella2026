import type { Amenity, Residence } from '../types';

const base: Amenity[] = [
  { id: 'wifi', name: 'Wi-Fi' },
  { id: 'ac', name: 'Air conditioning' },
  { id: 'kitchen', name: 'Kitchen' },
  { id: 'fridge', name: 'Refrigerator' },
  { id: 'tv', name: 'TV' },
  { id: 'dining', name: 'Dining area' },
];

/** Mock residences — categories are structural examples, not a claim of inventory. */
export const residences: Residence[] = [
  {
    id: 'res-studio',
    slug: 'studio-residence',
    name: 'Studio Residence',
    type: 'Studio',
    shortDescription: 'An open-plan apartment for solo travellers and couples.',
    description:
      'A refined studio with a combined living-sleep space, compact kitchen, and calm finishes. Ideal for short stays with residential ease. Final sizes and rates will come from Casa Bella operations.',
    bedrooms: 0,
    bathrooms: 1,
    guests: 2,
    beds: 'Queen',
    sizeSqm: null,
    amenities: base,
    startingPrice: { amount: null, currency: 'PKR', label: 'Rate on request' },
    images: [
      {
        id: 'rs1',
        src: 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=1600&q=80',
        alt: 'Studio apartment living space',
        category: 'Living room',
      },
      {
        id: 'rs2',
        src: 'https://images.unsplash.com/photo-1556912173-3bb406ef7e77?auto=format&fit=crop&w=1600&q=80',
        alt: 'Apartment kitchen',
        category: 'Kitchen',
      },
    ],
    minStayNights: null,
    featured: true,
    availableByDefault: true,
  },
  {
    id: 'res-1br',
    slug: 'one-bedroom-apartment',
    name: 'One Bedroom Apartment',
    type: '1 Bedroom Apartment',
    shortDescription: 'Separate living and sleeping zones with a full kitchen.',
    description:
      'A true apartment rhythm — private bedroom, living area, and kitchen for longer stays. Photography and amenities shown are illustrative placeholders.',
    bedrooms: 1,
    bathrooms: 1,
    guests: 3,
    beds: 'King + sofa',
    sizeSqm: null,
    amenities: [
      ...base,
      { id: 'washer', name: 'Washing machine' },
      { id: 'desk', name: 'Workspace' },
    ],
    startingPrice: { amount: null, currency: 'PKR', label: 'Rate on request' },
    images: [
      {
        id: 'r11',
        src: 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&w=1600&q=80',
        alt: 'One bedroom apartment living room',
        category: 'Living room',
      },
      {
        id: 'r12',
        src: 'https://images.unsplash.com/photo-1616594039964-ae9021a400a0?auto=format&fit=crop&w=1600&q=80',
        alt: 'Apartment bedroom',
        category: 'Bedroom',
      },
      {
        id: 'r13',
        src: 'https://images.unsplash.com/photo-1552321554-5fefe8c9ef14?auto=format&fit=crop&w=1600&q=80',
        alt: 'Apartment bathroom',
        category: 'Bathroom',
      },
    ],
    minStayNights: null,
    featured: true,
    availableByDefault: true,
  },
  {
    id: 'res-2br',
    slug: 'two-bedroom-apartment',
    name: 'Two Bedroom Apartment',
    type: '2 Bedroom Apartment',
    shortDescription: 'Space for families and shared stays with residential privacy.',
    description:
      'Two bedrooms, shared living, and a kitchen that supports real days — not just overnight visits. Category exists in the site structure so inventory can be added or removed later.',
    bedrooms: 2,
    bathrooms: 2,
    guests: 5,
    beds: 'King + twin',
    sizeSqm: null,
    amenities: [
      ...base,
      { id: 'washer', name: 'Washing machine' },
      { id: 'parking', name: 'Parking' },
    ],
    startingPrice: { amount: null, currency: 'PKR', label: 'Rate on request' },
    images: [
      {
        id: 'r21',
        src: 'https://images.unsplash.com/photo-1493809842364-78817add7ffb?auto=format&fit=crop&w=1600&q=80',
        alt: 'Two bedroom apartment interior',
        category: 'Living room',
      },
      {
        id: 'r22',
        src: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1600&q=80',
        alt: 'Residence dining area',
        category: 'Dining area',
      },
    ],
    minStayNights: null,
    featured: true,
    availableByDefault: true,
  },
  {
    id: 'res-premium',
    slug: 'premium-residence',
    name: 'Premium Residence',
    type: 'Premium Residence',
    shortDescription: 'An elevated apartment stay with generous living space.',
    description:
      'A statement residence for guests seeking quiet luxury and apartment living under hotel-grade care. Details remain configurable until confirmed by Casa Bella.',
    bedrooms: 2,
    bathrooms: 2,
    guests: 4,
    beds: 'King + queen',
    sizeSqm: null,
    amenities: [
      ...base,
      { id: 'washer', name: 'Washing machine' },
      { id: 'desk', name: 'Workspace' },
      { id: 'parking', name: 'Parking' },
      { id: 'service', name: 'Room service' },
    ],
    startingPrice: { amount: null, currency: 'PKR', label: 'Rate on request' },
    images: [
      {
        id: 'rp1',
        src: 'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1600&q=80',
        alt: 'Premium residence living room',
        category: 'Living room',
      },
      {
        id: 'rp2',
        src: 'https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?auto=format&fit=crop&w=1600&q=80',
        alt: 'Residence balcony view placeholder',
        category: 'Balcony/view',
      },
    ],
    minStayNights: null,
    featured: false,
    availableByDefault: true,
  },
];

export function getResidenceBySlug(slug: string) {
  return residences.find((item) => item.slug === slug) ?? null;
}

export function getResidenceById(id: string) {
  return residences.find((item) => item.id === id) ?? null;
}
