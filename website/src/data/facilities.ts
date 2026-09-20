import type { Facility } from '../types';

/** Facility list is illustrative — confirm which exist at Casa Bella before launch. */
export const facilities: Facility[] = [
  {
    id: 'fac-dining',
    name: 'Dining',
    description: 'Thoughtful dining moments — menu and hours to be published.',
    image: {
      id: 'fd1',
      src: 'https://images.unsplash.com/photo-1414235077428-338816a76e26?auto=format&fit=crop&w=1200&q=80',
      alt: 'Restaurant dining table setting',
    },
  },
  {
    id: 'fac-pool',
    name: 'Pool',
    description: 'A calm pool setting if offered on property — confirm availability.',
    image: {
      id: 'fp1',
      src: 'https://images.unsplash.com/photo-1576013551627-0cc20b96c2a7?auto=format&fit=crop&w=1200&q=80',
      alt: 'Hotel pool area',
    },
  },
  {
    id: 'fac-gym',
    name: 'Fitness',
    description: 'Fitness access for guests — equipment list pending confirmation.',
    image: {
      id: 'fg1',
      src: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&w=1200&q=80',
      alt: 'Hotel fitness space',
    },
  },
  {
    id: 'fac-parking',
    name: 'Parking',
    description: 'On-site or assisted parking — policy to be confirmed.',
    image: {
      id: 'fpa1',
      src: 'https://images.unsplash.com/photo-1506521781263-d8422e82f27a?auto=format&fit=crop&w=1200&q=80',
      alt: 'Parking area',
    },
  },
  {
    id: 'fac-wifi',
    name: 'High-speed Wi-Fi',
    description: 'Complimentary connectivity across rooms and residences (confirm coverage).',
    image: {
      id: 'fw1',
      src: 'https://images.unsplash.com/photo-1486312338219-ce68d2c6f44d?auto=format&fit=crop&w=1200&q=80',
      alt: 'Guest using laptop in lounge',
    },
  },
  {
    id: 'fac-service',
    name: 'Housekeeping & service',
    description: 'Daily or scheduled care matched to hotel rooms and residences.',
    image: {
      id: 'fs1',
      src: 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=1200&q=80',
      alt: 'Hotel corridor with soft light',
    },
  },
];
