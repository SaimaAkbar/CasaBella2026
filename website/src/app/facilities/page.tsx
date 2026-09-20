import type { Metadata } from 'next';
import { FacilityCard } from '@/components/facilities/FacilityCard';
import { PageHero } from '@/components/ui/PageHero';
import { fetchFacilities } from '@/lib/api/facilities';

export const metadata: Metadata = {
  title: 'Facilities',
  description: 'Explore Casa Bella facilities and guest services.',
};

export default async function FacilitiesPage() {
  const facilities = await fetchFacilities();

  return (
    <>
      <PageHero
        title="Facilities"
        subtitle="Spaces and services that support a composed stay."
        imageSrc="https://images.unsplash.com/photo-1576013551627-0cc20b96c2a7?auto=format&fit=crop&w=1800&q=80"
        imageAlt="Hotel facilities"
      />
      <section className="section">
        <div className="container">
          {facilities.length === 0 ? (
            <p className="alert">
              Facilities will appear here once they are added in the admin panel.
            </p>
          ) : (
            <div className="grid-cards">
              {facilities.map((facility) => (
                <FacilityCard key={facility.id} facility={facility} />
              ))}
            </div>
          )}
        </div>
      </section>
    </>
  );
}
