import type { Metadata } from 'next';
import { Suspense } from 'react';
import ConfirmationClient from './ConfirmationClient';

export const metadata: Metadata = {
  title: 'Booking Confirmation',
  description: 'Your Casa Bella booking confirmation details.',
};

export default function BookingConfirmationPage() {
  return (
    <Suspense fallback={<div className="section container">Loading confirmation…</div>}>
      <ConfirmationClient />
    </Suspense>
  );
}
