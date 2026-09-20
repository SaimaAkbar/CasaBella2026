import type { BookingQuote, StaySelection } from '../types';
import { siteConfig } from '../data/site';

export function nightsBetween(checkIn: string, checkOut: string): number {
  if (!checkIn || !checkOut) return 0;
  const start = new Date(`${checkIn}T12:00:00`);
  const end = new Date(`${checkOut}T12:00:00`);
  const diff = end.getTime() - start.getTime();
  if (Number.isNaN(diff) || diff <= 0) return 0;
  return Math.round(diff / (1000 * 60 * 60 * 24));
}

export function validateStayDates(checkIn: string, checkOut: string): string | null {
  if (!checkIn || !checkOut) return 'Select check-in and check-out dates.';
  const nights = nightsBetween(checkIn, checkOut);
  if (nights < 1) return 'Check-out must be after check-in.';
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const inDate = new Date(`${checkIn}T12:00:00`);
  if (inDate < today) return 'Check-in cannot be in the past.';
  return null;
}

/**
 * Mock quote. When POS is connected, replace with API pricing.
 * amount null => "Rate on request" UX.
 */
export function buildMockQuote(
  stay: StaySelection,
  pricePerNight: number | null,
  available: boolean,
): BookingQuote {
  const nights = nightsBetween(stay.checkIn, stay.checkOut);
  if (!available) {
    return {
      nights,
      pricePerNight,
      subtotal: null,
      taxes: null,
      total: null,
      currency: siteConfig.booking.currency,
      available: false,
      message: 'Selected dates are not available for this unit in the mock calendar.',
    };
  }
  if (pricePerNight == null) {
    return {
      nights,
      pricePerNight: null,
      subtotal: null,
      taxes: null,
      total: null,
      currency: siteConfig.booking.currency,
      available: true,
      message: 'Rate on request — final pricing will sync from Casa Bella operations.',
    };
  }
  const units = Math.max(1, stay.units);
  const subtotal = pricePerNight * nights * units;
  const taxes = Math.round(subtotal * siteConfig.booking.taxRate);
  return {
    nights,
    pricePerNight,
    subtotal,
    taxes,
    total: subtotal + taxes,
    currency: siteConfig.booking.currency,
    available: true,
  };
}

/** Simple deterministic mock availability — weekends slightly tighter. */
export function mockIsAvailable(checkIn: string, checkOut: string, seed: string): boolean {
  if (!checkIn || !checkOut) return false;
  const hash = [...`${seed}-${checkIn}-${checkOut}`].reduce(
    (acc, ch) => acc + ch.charCodeAt(0),
    0,
  );
  return hash % 7 !== 0;
}

export function formatMoney(amount: number | null, currency = 'PKR'): string {
  if (amount == null) return 'Rate on request';
  return `${currency} ${amount.toLocaleString('en-PK')}`;
}

export function createBookingReference(): string {
  const stamp = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `CB-${stamp}-${rand}`;
}
