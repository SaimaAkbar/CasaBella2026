import type { GalleryItem } from '../types';

export const galleryItems: GalleryItem[] = [
  {
    id: 'g1',
    src: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1400&q=80',
    alt: 'Hotel lobby',
    category: 'Hotel',
  },
  {
    id: 'g2',
    src: 'https://images.unsplash.com/photo-1611892440504-42a792e24d32?auto=format&fit=crop&w=1400&q=80',
    alt: 'Guest room',
    category: 'Rooms',
  },
  {
    id: 'g3',
    src: 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=1400&q=80',
    alt: 'Residence living room',
    category: 'Residences',
  },
  {
    id: 'g4',
    src: 'https://images.unsplash.com/photo-1414235077428-338816a76e26?auto=format&fit=crop&w=1400&q=80',
    alt: 'Restaurant table',
    category: 'Restaurant',
  },
  {
    id: 'g5',
    src: 'https://images.unsplash.com/photo-1576013551627-0cc20b96c2a7?auto=format&fit=crop&w=1400&q=80',
    alt: 'Pool deck',
    category: 'Facilities',
  },
  {
    id: 'g6',
    src: 'https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?auto=format&fit=crop&w=1400&q=80',
    alt: 'Building exterior',
    category: 'Exterior',
  },
  {
    id: 'g7',
    src: 'https://images.unsplash.com/photo-1511795409834-ef04bbd61622?auto=format&fit=crop&w=1400&q=80',
    alt: 'Event lounge',
    category: 'Events',
  },
  {
    id: 'g8',
    src: 'https://images.unsplash.com/photo-1631049307264-da0ec9d70304?auto=format&fit=crop&w=1400&q=80',
    alt: 'Executive room',
    category: 'Rooms',
  },
];

export const galleryCategories = [
  'All',
  'Hotel',
  'Rooms',
  'Residences',
  'Restaurant',
  'Facilities',
  'Exterior',
  'Events',
] as const;
