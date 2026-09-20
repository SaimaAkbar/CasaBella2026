import type { Metadata } from 'next';
import { PageHero } from '@/components/ui/PageHero';
import { ResidenceCard } from '@/components/residences/ResidenceCard';
import { RoomsDateFilter } from '@/components/rooms/RoomsDateFilter';
import { fetchResidences } from '@/lib/api/residences';
import type { Residence } from '@/types';

export const metadata: Metadata = {
  title: 'Residences & Apartments',
  description:
    'Casa Bella residences and apartments from live POS inventory.',
};

export const dynamic = 'force-dynamic';

type Props = {
  searchParams: Promise<{ checkIn?: string; checkOut?: string }>;
};

export default async function ResidencesPage({ searchParams }: Props) {
  const params = await searchParams;
  const checkIn = params.checkIn?.trim() || undefined;
  const checkOut = params.checkOut?.trim() || undefined;

  let residences: Residence[] = [];
  let error = '';
  try {
    residences = await fetchResidences({ checkIn, checkOut });
  } catch (err) {
    error =
      err instanceof Error
        ? err.message
        : 'Unable to load residences from POS.';
  }

  return (
    <>
      <PageHero
        title="Residences"
        subtitle="All apartments from Casa Bella POS inventory."
        imageSrc="https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=1800&q=80"
        imageAlt="Casa Bella residence living space"
      />
      <section className="section">
        <div className="container">
          <RoomsDateFilter
            checkIn={checkIn}
            checkOut={checkOut}
            basePath="/residences"
          />
          {error ? <div className="alert alert--error">{error}</div> : null}
          {!error && residences.length === 0 ? (
            <div className="empty-state">
              <h2>No apartments found</h2>
              <p>
                The POS database currently has no active apartments (
                <code>Unit</code> where <code>unitType = APARTMENT</code>).
              </p>
              <p>
                Add apartments in the admin panel under{' '}
                <strong>Rooms &amp; Apartments</strong>, then refresh this page.
              </p>
            </div>
          ) : null}
          {residences.length > 0 ? (
            <div className="grid-cards">
              {residences.map((item) => (
                <ResidenceCard
                  key={item.id}
                  residence={item}
                  checkIn={checkIn}
                  checkOut={checkOut}
                />
              ))}
            </div>
          ) : null}
        </div>
      </section>
    </>
  );
}
