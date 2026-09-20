import Link from 'next/link';
import type { Residence } from '@/types';
import { formatMoney } from '@/lib/booking';

type Props = {
  residence: Residence;
  checkIn?: string;
  checkOut?: string;
};

export function ResidenceCard({ residence, checkIn, checkOut }: Props) {
  const image = residence.images[0];
  const canBook = residence.canBook !== false;
  const bookingLabel =
    residence.bookingLabel || (canBook ? 'BOOK NOW' : 'ALREADY BOOKED');
  const bookingHref =
    checkIn && checkOut
      ? `/booking?type=residence&id=${residence.id}&checkIn=${checkIn}&checkOut=${checkOut}`
      : `/booking?type=residence&id=${residence.id}`;

  return (
    <article className="card">
      <div className="card__media">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={image?.src}
          alt={image?.alt || residence.name}
          loading="lazy"
        />
      </div>
      <div className="card__body">
        <span className="badge">{residence.type}</span>
        <h3 style={{ marginTop: '0.7rem' }}>{residence.name}</h3>
        {residence.roomNumber ? (
          <p className="eyebrow" style={{ marginBottom: '0.35rem' }}>
            Unit {residence.roomNumber}
          </p>
        ) : null}
        <p>{residence.shortDescription}</p>
        <div className="card__meta">
          <span>
            {residence.bedrooms === 0 ? 'Studio' : `${residence.bedrooms} bed`}
          </span>
          <span>{residence.guests} guests</span>
          {residence.amenities.slice(0, 4).map((item) => (
            <span key={item.id}>{item.name}</span>
          ))}
        </div>
        <p className="price">
          {formatMoney(residence.startingPrice.amount)}
          <span style={{ fontSize: '0.85rem', color: 'var(--muted)' }}> / night</span>
        </p>
        <div className="card__actions">
          <Link
            href={`/residences/${residence.slug}`}
            className="btn btn--ghost-dark"
          >
            View Residence
          </Link>
          {canBook ? (
            <Link href={bookingHref} className="btn btn--primary">
              {bookingLabel}
            </Link>
          ) : (
            <button type="button" className="btn btn--primary" disabled>
              {bookingLabel}
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
