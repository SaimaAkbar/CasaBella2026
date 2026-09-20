import type { Offer } from '../types';

export const offers: Offer[] = [
  {
    id: 'offer-weekend',
    slug: 'weekend-stay',
    title: 'Weekend Stay',
    description:
      'A restorative two-night escape framed around late check-out preferences and breakfast inclusions — final package details pending confirmation.',
    image: {
      id: 'ow1',
      src: 'https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?auto=format&fit=crop&w=1400&q=80',
      alt: 'Hotel exterior at dusk',
    },
    priceLabel: 'Package rate — to be confirmed',
    discountLabel: null,
    validFrom: null,
    validTo: null,
    benefits: ['Flexible weekend arrival', 'Residence or room option', 'Concierge assistance'],
    terms: [
      'Placeholder terms — replace with official Casa Bella offer rules.',
      'Subject to availability.',
    ],
  },
  {
    id: 'offer-longstay',
    slug: 'long-stay',
    title: 'Long Stay',
    description:
      'Preferred conditions for multi-week residence stays — kitchen living, housekeeping cadence, and rate structure to be confirmed.',
    image: {
      id: 'ol1',
      src: 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=1400&q=80',
      alt: 'Bright apartment living space',
    },
    priceLabel: 'Weekly / monthly — to be confirmed',
    discountLabel: null,
    validFrom: null,
    validTo: null,
    benefits: ['Residence focus', 'Housekeeping schedule', 'Priority support'],
    terms: ['Placeholder terms — replace before publishing.'],
  },
  {
    id: 'offer-corporate',
    slug: 'corporate-stay',
    title: 'Corporate Stay',
    description:
      'Structured stays for business travellers needing quiet rooms, workspace, and reliable service windows.',
    image: {
      id: 'oc1',
      src: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1400&q=80',
      alt: 'Hotel lobby lounge',
    },
    priceLabel: 'Corporate rate — to be confirmed',
    discountLabel: null,
    validFrom: null,
    validTo: null,
    benefits: ['Workspace-ready rooms', 'Flexible billing discussion', 'Late arrivals support'],
    terms: ['Placeholder corporate terms.'],
  },
];
