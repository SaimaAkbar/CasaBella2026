export type MoneyDisplay = {
  amount: number | null;
  currency: 'PKR';
  label: string;
};

export type Amenity = {
  id: string;
  name: string;
};

export type MediaImage = {
  id: string;
  src: string;
  alt: string;
  category?: string;
};

export type PublicUnit = {
  id: string;
  propertyId: string;
  propertyName: string;
  unitNumber: string;
  roomNumber?: string;
  unitType: 'ROOM' | 'APARTMENT';
  displayName: string;
  description: string | null;
  maxGuests: number | null;
  bedConfiguration: string | null;
  bedrooms: number | null;
  amenities: string[] | unknown;
  imageUrls: string[] | unknown;
  dailyRate: number | string | null;
  status: string;
  bookingAvailability?: 'AVAILABLE' | 'BOOKED' | 'UNAVAILABLE';
  canBook?: boolean;
  bookingLabel?: string;
  /** True when the API evaluated a specific check-in/out range. */
  datesChecked?: boolean;
  availableHint?: boolean;
};

/** Marketing catalog shapes (mock fallback). */
export type Room = {
  id: string;
  slug: string;
  name: string;
  roomNumber?: string;
  shortDescription: string;
  description: string;
  guests: number;
  bedType: string;
  sizeSqm: number | null;
  amenities: Amenity[];
  startingPrice: MoneyDisplay;
  images: MediaImage[];
  featured?: boolean;
  availableByDefault?: boolean;
  propertyId?: string;
  bookingAvailability?: 'AVAILABLE' | 'BOOKED' | 'UNAVAILABLE';
  canBook?: boolean;
  bookingLabel?: string;
  datesChecked?: boolean;
};

export type Residence = {
  id: string;
  slug: string;
  name: string;
  roomNumber?: string;
  type: string;
  shortDescription: string;
  description: string;
  bedrooms: number;
  bathrooms: number;
  guests: number;
  beds: string;
  sizeSqm: number | null;
  amenities: Amenity[];
  startingPrice: MoneyDisplay;
  images: MediaImage[];
  minStayNights: number | null;
  featured?: boolean;
  availableByDefault?: boolean;
  propertyId?: string;
  bookingAvailability?: 'AVAILABLE' | 'BOOKED' | 'UNAVAILABLE';
  canBook?: boolean;
  bookingLabel?: string;
  datesChecked?: boolean;
};

export type Offer = {
  id: string;
  slug: string;
  title: string;
  description: string;
  image: MediaImage;
  priceLabel: string;
  discountLabel: string | null;
  validFrom: string | null;
  validTo: string | null;
  benefits: string[];
  terms: string[];
};

export type Facility = {
  id: string;
  name: string;
  description: string;
  image: MediaImage;
};

export type GalleryItem = {
  id: string;
  src: string;
  alt: string;
  category: 'Hotel' | 'Rooms' | 'Residences' | 'Restaurant' | 'Facilities' | 'Exterior' | 'Events';
};

export type FaqItem = {
  id: string;
  question: string;
  answer: string;
};

export type Testimonial = {
  id: string;
  quote: string;
  guestName: string;
  stayType: string;
};

export type PolicySection = {
  id: string;
  title: string;
  body: string;
  isPlaceholder: boolean;
};

export type StaySelection = {
  propertyType: 'room' | 'residence';
  /** POS Unit.id when using live API */
  propertyId: string;
  propertySlug: string;
  propertyName: string;
  /** POS Property.id when known */
  posPropertyId?: string;
  checkIn: string;
  checkOut: string;
  adults: number;
  children: number;
  units: number;
};

/** Mirrors POS Guest / CreateGuestDto (+ stay notes). */
export type GuestDetails = {
  fullName: string;
  phone: string;
  alternatePhone: string;
  email: string;
  cnicOrPassport: string;
  address: string;
  nationality: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  vehicleNumber: string;
  notes: string;
};

export type OnlinePaymentSelection = 'ADVANCE_50' | 'FULL_100';

export type BookingQuote = {
  nights: number;
  pricePerNight: number | null;
  roomCharges?: number | null;
  subtotal: number | null;
  taxes: number | null;
  additionalCharges?: number | null;
  discount?: number | null;
  total: number | null;
  currency: 'PKR';
  available: boolean;
  message?: string;
  payNowAmount?: number | null;
  remainingAfterPayment?: number | null;
  paymentSelection?: OnlinePaymentSelection | null;
};

export type BookingConfirmation = {
  reference: string;
  bookingId?: string;
  checkoutUrl?: string;
  paymentStatus?: string;
  bookingStatus?: string;
  paymentSelection?: OnlinePaymentSelection;
  paymentTypeLabel?: string;
  payNowAmount?: number;
  remainingAfterPayment?: number;
  stay: StaySelection;
  guest: GuestDetails;
  quote: BookingQuote;
  createdAt: string;
  expiresAt?: string;
};

export type BookingStatusResponse = {
  bookingNumber: string;
  bookingStatus: string;
  paymentStatus: string;
  paymentState: string;
  paymentLabel?: string;
  totalAmount: number;
  receivedAmount?: number;
  remainingAmount?: number;
  paymentSelection?: OnlinePaymentSelection | null;
  paymentTypeLabel?: string;
  checkoutUrl?: string | null;
  paymentProvider?: string | null;
  paymentReference?: string | null;
  rejectionReason?: string | null;
  unitLabel: string;
  checkInDateTime: string;
  checkOutDateTime: string;
  guestName: string;
  message?: string;
};
