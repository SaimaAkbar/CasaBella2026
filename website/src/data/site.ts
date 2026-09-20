/**
 * Site-wide configurable content for Casa Bella Hotel & Residence.
 */
export const siteConfig = {
  brand: {
    name: 'Casa Bella',
    fullName: 'Casa Bella Hotel & Residence',
    tagline: 'Refined stays. Residential calm. Hospitality with presence.',
    shortDescription:
      'A premium hotel and residence destination crafted for guests who value composure, space, and considered service.',
  },
  contact: {
    phoneLabel: '0345 6789147',
    phone: '03456789147',
    phoneHref: 'tel:+923456789147',
    emailLabel: 'thecasabellamedia@gmail.com',
    email: 'thecasabellamedia@gmail.com',
    emailHref: 'mailto:thecasabellamedia@gmail.com',
    addressLabel:
      'Plot 23-B, Plaza, Shaheen Heights, Northern Strip, FECHS E-11/2, E-11, Islamabad 44000',
    addressLines: [
      'Casa Bella Hotel & Residence',
      'Plot 23-B, Plaza, Shaheen Heights',
      'Northern Strip, FECHS E-11/2, E-11',
      'Islamabad 44000, Pakistan',
    ],
    whatsapp:
      process.env.NEXT_PUBLIC_BOOKING_WHATSAPP_NUMBER ||
      process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ||
      '923456789147',
  },
  location: {
    latitude: null as number | null,
    longitude: null as number | null,
    mapsEmbedUrl:
      process.env.NEXT_PUBLIC_GOOGLE_MAPS_EMBED_URL ||
      'https://maps.google.com/maps?q=Plot%2023-B%20Shaheen%20Heights%20Northern%20Strip%20FECHS%20E-11%2F2%20Islamabad%2044000&z=16&output=embed',
    airportDistanceLabel: 'Near Islamabad — E-11 / FECHS Northern Strip',
    nearby: [
      { name: 'E-11 Markaz', note: 'Local shopping & dining' },
      { name: 'FECHS Northern Strip', note: 'On the strip' },
      { name: 'Islamabad International Airport', note: 'About 20–30 min by car (traffic dependent)' },
    ],
    directions:
      'Located at Plot 23-B, Plaza, Shaheen Heights on the Northern Strip, FECHS E-11/2, E-11, Islamabad. Use rideshare or navigation apps and search for Shaheen Heights, E-11.',
  },
  social: {
    instagram: 'https://www.instagram.com/casabellaresidency/',
    facebook: 'https://www.facebook.com/profile.php?id=61593661722374',
    tripadvisor: '',
  },
  booking: {
    taxRate: 0.05,
    currency: 'PKR' as const,
    defaultAdults: 2,
    defaultChildren: 0,
  },
  seo: {
    defaultTitle: 'Casa Bella Hotel & Residence',
    defaultDescription:
      'Discover Casa Bella Hotel & Residence in E-11 Islamabad — elegant hotel rooms and premium apartments with refined hospitality.',
  },
};

export const navLinks = [
  { href: '/', label: 'Home' },
  { href: '/rooms', label: 'Rooms' },
  { href: '/residences', label: 'Residences' },
  { href: '/facilities', label: 'Facilities' },
  { href: '/offers', label: 'Offers' },
  { href: '/gallery', label: 'Gallery' },
  { href: '/about', label: 'About' },
  { href: '/contact', label: 'Contact' },
] as const;
