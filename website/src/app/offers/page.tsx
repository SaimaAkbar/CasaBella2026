import type { Metadata } from 'next';
import { OfferCard } from '@/components/offers/OfferCard';
import { PageHero } from '@/components/ui/PageHero';
import { offers } from '@/data/offers';

export const metadata: Metadata = {
  title: 'Offers & Packages',
  description: 'Seasonal and stay packages at Casa Bella Hotel & Residence.',
};

export default function OffersPage() {
  return (
    <>
      <PageHero
        title="Offers"
        subtitle="Configurable packages for weekends, long stays, and corporate travel."
        imageSrc="https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=1800&q=80"
        imageAlt="Apartment living space"
      />
      <section className="section">
        <div className="container">
          <div className="grid-cards">
            {offers.map((offer) => (
              <OfferCard key={offer.id} offer={offer} />
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
