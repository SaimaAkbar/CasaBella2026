import type { Amenity, Room } from '../types';

const shared: Amenity[] = [
  { id: 'wifi', name: 'Wi-Fi' },
  { id: 'ac', name: 'Air conditioning' },
  { id: 'tv', name: 'Smart TV' },
  { id: 'service', name: 'Room service' },
];

/** Mock rooms — replace via API / POS inventory later. Prices are placeholders. */
export const rooms: Room[] = [
  {
    id: 'room-deluxe',
    slug: 'deluxe-room',
    name: 'Deluxe Room',
    shortDescription: 'A composed guest room with soft light and quiet finishes.',
    description:
      'The Deluxe Room balances comfort and clarity — thoughtful lighting, restful bedding, and a layout suited to short stays and weekend escapes. Amenities and final rates will sync from Casa Bella operations once connected.',
    guests: 2,
    bedType: 'King or twin',
    sizeSqm: null,
    amenities: shared,
    startingPrice: {
      amount: null,
      currency: 'PKR',
      label: 'Rate on request',
    },
    images: [
      {
        id: 'rd1',
        src: 'https://images.unsplash.com/photo-1611892440504-42a792e24d32?auto=format&fit=crop&w=1600&q=80',
        alt: 'Deluxe hotel room with soft lighting',
      },
      {
        id: 'rd2',
        src: 'https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=1600&q=80',
        alt: 'Hotel bathroom detail',
      },
    ],
    featured: true,
    availableByDefault: true,
  },
  {
    id: 'room-executive',
    slug: 'executive-room',
    name: 'Executive Room',
    shortDescription: 'Extra space and a calm workspace for longer visits.',
    description:
      'Designed for travellers who need room to think — a generous sleep zone, seating, and a discreet desk area. Exact inventory and pricing remain configurable.',
    guests: 2,
    bedType: 'King',
    sizeSqm: null,
    amenities: [...shared, { id: 'desk', name: 'Workspace' }],
    startingPrice: {
      amount: null,
      currency: 'PKR',
      label: 'Rate on request',
    },
    images: [
      {
        id: 're1',
        src: 'https://images.unsplash.com/photo-1631049307264-da0ec9d70304?auto=format&fit=crop&w=1600&q=80',
        alt: 'Executive hotel room interior',
      },
    ],
    featured: true,
    availableByDefault: true,
  },
  {
    id: 'room-family',
    slug: 'family-room',
    name: 'Family Room',
    shortDescription: 'A flexible layout for families travelling together.',
    description:
      'A welcoming layout with space for rest and togetherness. Bed configuration and capacity are placeholders pending Casa Bella room standards.',
    guests: 4,
    bedType: 'King + sofa bed',
    sizeSqm: null,
    amenities: [...shared, { id: 'family', name: 'Family-friendly layout' }],
    startingPrice: {
      amount: null,
      currency: 'PKR',
      label: 'Rate on request',
    },
    images: [
      {
        id: 'rf1',
        src: 'https://images.unsplash.com/photo-1566665797739-1674de7a421a?auto=format&fit=crop&w=1600&q=80',
        alt: 'Spacious family hotel room',
      },
    ],
    featured: false,
    availableByDefault: true,
  },
];

export function getRoomBySlug(slug: string) {
  return rooms.find((room) => room.slug === slug) ?? null;
}

export function getRoomById(id: string) {
  return rooms.find((room) => room.id === id) ?? null;
}
