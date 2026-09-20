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
  searchParams: Promise<{
    checkIn?: string;
    checkOut?: string;
    availableOnly?: string;
  }>;
};

function isAvailable(item: Residence, hasDates: boolean) {
  if (!hasDates) return true;
  if (item.bookingAvailability === 'UNAVAILABLE') return false;
  return item.bookingAvailability === 'AVAILABLE' && item.canBook !== false;
}

export default async function ResidencesPage({ searchParams }: Props) {
  const params = await searchParams;
  const checkIn = params.checkIn?.trim() || undefined;
  const checkOut = params.checkOut?.trim() || undefined;
  const hasDates = Boolean(checkIn && checkOut);
  const dates = hasDates ? { checkIn: checkIn!, checkOut: checkOut! } : undefined;
  const availableOnly =
    !hasDates
      ? false
      : params.availableOnly !== '0' && params.availableOnly !== 'false';

  let residences: Residence[] = [];
  let error = '';
  try {
    residences = await fetchResidences(dates);
  } catch (err) {
    error =
      err instanceof Error
        ? err.message
        : 'Unable to load residences from POS.';
  }

  const availableCount = residences.filter((item) =>
    isAvailable(item, hasDates),
  ).length;

  const sorted = [...residences].sort((a, b) => {
    const aOk = isAvailable(a, hasDates) ? 0 : 1;
    const bOk = isAvailable(b, hasDates) ? 0 : 1;
    return aOk - bOk;
  });

  const visible = availableOnly
    ? sorted.filter((item) => isAvailable(item, hasDates))
    : sorted;

  return (
    <>
      <PageHero
        title="Residences"
        subtitle="Filter by check-in and check-out to see apartments free for your stay."
        imageSrc="https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=1800&q=80"
        imageAlt="Casa Bella residence living space"
      />
      <section className="section">
        <div className="container">
          <RoomsDateFilter
            checkIn={checkIn}
            checkOut={checkOut}
            availableOnly={hasDates ? availableOnly : true}
            basePath="/residences"
            availableCount={hasDates ? availableCount : undefined}
            totalCount={hasDates ? residences.length : undefined}
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
          {!error && residences.length > 0 && visible.length === 0 ? (
            <div className="empty-state">
              <h2>No residences available for these dates</h2>
              <p>
                All {residences.length} apartments are booked for {checkIn} →{' '}
                {checkOut}. Try different dates, or show all residences.
              </p>
            </div>
          ) : null}
          {visible.length > 0 ? (
            <div className="grid-cards">
              {visible.map((item) => (
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
