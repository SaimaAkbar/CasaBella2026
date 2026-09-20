import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { UnitStayAvailabilityPanel } from '@/components/booking/UnitStayAvailabilityPanel';
import { ResidenceCard } from '@/components/residences/ResidenceCard';
import {
  fetchResidenceBySlug,
  fetchResidences,
} from '@/lib/api/residences';
import { formatMoney } from '@/lib/booking';

type Props = {
  params: Promise<{ 'residence-id': string }>;
  searchParams: Promise<{ checkIn?: string; checkOut?: string }>;
};

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { 'residence-id': id } = await params;
  const residence = await fetchResidenceBySlug(id);
  if (!residence) return { title: 'Residence' };
  return {
    title: residence.name,
    description: residence.shortDescription,
  };
}

export default async function ResidenceDetailPage({
  params,
  searchParams,
}: Props) {
  const { 'residence-id': id } = await params;
  const query = await searchParams;
  const checkIn = query.checkIn?.trim() || undefined;
  const checkOut = query.checkOut?.trim() || undefined;
  const dates =
    checkIn && checkOut ? { checkIn, checkOut } : undefined;

  const residence = await fetchResidenceBySlug(id, dates);
  if (!residence) notFound();

  const all = await fetchResidences().catch(() => []);
  const related = all.filter((item) => item.id !== residence.id).slice(0, 2);

  return (
    <section className="section">
      <div className="container">
        <div className="detail-gallery">
          <div className="detail-gallery__main">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={residence.images[0]?.src}
              alt={residence.images[0]?.alt || residence.name}
            />
          </div>
          <div className="detail-gallery__side">
            {residence.images.slice(1, 3).map((image) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={image.id} src={image.src} alt={image.alt} />
            ))}
          </div>
        </div>

        <div className="split" style={{ marginTop: '2rem', alignItems: 'start' }}>
          <div>
            <span className="badge">{residence.type}</span>
            <h1 style={{ marginTop: '0.75rem' }}>{residence.name}</h1>
            {residence.roomNumber ? (
              <p className="eyebrow">Unit {residence.roomNumber}</p>
            ) : null}
            <p className="lead">{residence.description}</p>
            <div className="card__meta">
              <span>
                {residence.bedrooms === 0
                  ? 'Studio'
                  : `${residence.bedrooms} bedrooms`}
              </span>
              <span>{residence.beds}</span>
              <span>{residence.guests} guests</span>
            </div>
            <p className="price">
              {formatMoney(residence.startingPrice.amount)}{' '}
              <span style={{ fontSize: '0.9rem', color: 'var(--muted)' }}>/ night</span>
            </p>
            {residence.amenities.length > 0 ? (
              <>
                <h3>Facilities</h3>
                <ul className="amenity-list">
                  {residence.amenities.map((item) => (
                    <li key={item.id}>{item.name}</li>
                  ))}
                </ul>
              </>
            ) : null}
          </div>
          <div>
            <UnitStayAvailabilityPanel
              unitId={residence.id}
              unitName={residence.name}
              propertyType="residence"
              nightlyRate={residence.startingPrice.amount}
              maxGuests={residence.guests}
              detailPath={`/residences/${residence.slug}`}
            />
          </div>
        </div>

        {related.length > 0 ? (
          <div style={{ marginTop: '3rem' }}>
            <h2>Related residences</h2>
            <div className="grid-cards" style={{ marginTop: '1rem' }}>
              {related.map((item) => (
                <ResidenceCard key={item.id} residence={item} />
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
