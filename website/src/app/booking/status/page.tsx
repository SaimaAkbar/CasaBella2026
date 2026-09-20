import type { Metadata } from 'next';
import { Suspense } from 'react';
import { PageHero } from '@/components/ui/PageHero';
import BookingStatusClient from './BookingStatusClient';

export const metadata: Metadata = {
  title: 'Booking Status',
  description: 'Check the status of your Casa Bella online booking.',
};

export default function BookingStatusPage() {
  return (
    <>
      <PageHero
        title="Booking status"
        subtitle="Look up your online reservation by booking number."
        imageSrc="https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1800&q=80"
        imageAlt="Hotel lobby"
      />
      <Suspense fallback={<div className="container section">Loading…</div>}>
        <BookingStatusClient />
      </Suspense>
    </>
  );
}
