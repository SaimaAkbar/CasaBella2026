import { siteConfig } from '@/data/site';
import { formatMoney } from '@/lib/booking';

export type WhatsAppBookingDetails = {
  roomId?: string;
  roomName?: string;
  propertyType?: 'room' | 'residence';
  checkIn?: string;
  checkOut?: string;
  adults?: number;
  children?: number;
  totalAmount?: number | null;
  currency?: string;
};

/** Digits-only international number from site config (no +, spaces, or dashes). */
export function getBookingWhatsAppNumber(): string {
  const raw = siteConfig.contact.whatsapp || '';
  return raw.replace(/\D/g, '');
}

function formatStayDate(iso: string): string {
  if (!iso) return '';
  const d = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function guestLine(adults?: number, children?: number): string | null {
  const a = adults ?? 0;
  const c = children ?? 0;
  if (a <= 0 && c <= 0) return null;
  const parts: string[] = [];
  if (a > 0) parts.push(`${a} adult${a === 1 ? '' : 's'}`);
  if (c > 0) parts.push(`${c} child${c === 1 ? '' : 'ren'}`);
  return parts.join(', ');
}

/**
 * Prefill body for wa.me. Includes only fields the guest has selected so far.
 */
export function buildWhatsAppBookingMessage(
  details: WhatsAppBookingDetails,
): string {
  const lines: string[] = [];
  const roomLabel = details.roomName?.trim();
  if (roomLabel) {
    lines.push(`Hello, I would like to book the ${roomLabel}.`);
  } else {
    lines.push('Hello, I would like to book a room.');
  }

  const missing: string[] = [];

  if (details.checkIn) {
    lines.push(`Check-in: ${formatStayDate(details.checkIn)}`);
  } else {
    missing.push('check-in date');
  }

  if (details.checkOut) {
    lines.push(`Check-out: ${formatStayDate(details.checkOut)}`);
  } else {
    missing.push('check-out date');
  }

  const guests = guestLine(details.adults, details.children);
  if (guests) {
    lines.push(`Guests: ${guests}`);
  } else {
    missing.push('number of guests');
  }

  if (details.totalAmount != null && Number.isFinite(details.totalAmount)) {
    lines.push(
      `Total: ${formatMoney(details.totalAmount, details.currency || 'PKR')}`,
    );
  }

  lines.push('');
  if (missing.length > 0) {
    lines.push(
      `I still need to confirm: ${missing.join(', ')}. Please help me with the missing details.`,
    );
  }
  lines.push(
    'Please confirm availability and guide me regarding the booking/payment process.',
  );

  return lines.join('\n');
}

/** Standard click-to-chat URL with URL-encoded prefilled text. */
export function buildWhatsAppBookingUrl(
  details: WhatsAppBookingDetails,
): string | null {
  const number = getBookingWhatsAppNumber();
  if (!number) return null;
  const text = buildWhatsAppBookingMessage(details);
  return `https://wa.me/${number}?text=${encodeURIComponent(text)}`;
}

/** Fire-and-forget tracking when a library (e.g. dataLayer) already exists. */
export function trackWhatsAppBookingClicked(
  details: WhatsAppBookingDetails,
): void {
  if (typeof window === 'undefined') return;
  const guestCount = (details.adults ?? 0) + (details.children ?? 0);
  const payload = {
    event: 'whatsapp_booking_clicked',
    room_id: details.roomId || undefined,
    room_name: details.roomName || undefined,
    check_in: details.checkIn || undefined,
    check_out: details.checkOut || undefined,
    guest_count: guestCount > 0 ? guestCount : undefined,
    total_amount:
      details.totalAmount != null ? details.totalAmount : undefined,
  };
  const w = window as Window & {
    dataLayer?: Array<Record<string, unknown>>;
    gtag?: (...args: unknown[]) => void;
  };
  if (Array.isArray(w.dataLayer)) {
    w.dataLayer.push(payload);
  }
  if (typeof w.gtag === 'function') {
    w.gtag('event', 'whatsapp_booking_clicked', payload);
  }
}
