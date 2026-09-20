import type { Metadata } from 'next';
import { Suspense } from 'react';
import { BookingWizard } from '@/components/booking/BookingWizard';
import { PageHero } from '@/components/ui/PageHero';

export const metadata: Metadata = {
  title: 'Book Your Stay',
  description: 'Reserve a Casa Bella hotel room or residence in a guided booking flow.',
};

export default function BookingPage() {
  return (
    <>
      <PageHero
        title="Book your stay"
        subtitle="Select a room or residence, share guest details, then review and confirm."
        imageSrc="https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?auto=format&fit=crop&w=1800&q=80"
        imageAlt="Hotel exterior"
      />
      <section className="section">
        <div className="container" style={{ maxWidth: '920px' }}>
          <Suspense fallback={<div className="empty-state">Loading booking…</div>}>
            <BookingWizard />
          </Suspense>
        </div>
      </section>
    </>
  );
}
