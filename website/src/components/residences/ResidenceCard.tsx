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
  const datesSelected = Boolean(checkIn && checkOut);
  const datesChecked = residence.datesChecked === true || datesSelected;
  const isBookedForDates =
    datesChecked && residence.bookingAvailability === 'BOOKED';
  const isUnavailable = residence.bookingAvailability === 'UNAVAILABLE';
  const isAvailableForDates =
    datesChecked &&
    residence.bookingAvailability === 'AVAILABLE' &&
    !isUnavailable;

  const bookingHref =
    checkIn && checkOut
      ? `/booking?type=residence&id=${residence.id}&checkIn=${checkIn}&checkOut=${checkOut}`
      : `/booking?type=residence&id=${residence.id}`;

  let statusText = 'SELECT DATES TO CHECK AVAILABILITY';
  if (isUnavailable) statusText = 'UNAVAILABLE';
  else if (isBookedForDates) statusText = 'NOT AVAILABLE FOR THESE DATES';
  else if (isAvailableForDates) statusText = 'AVAILABLE';

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
        <p
          className={`availability-pill${
            isBookedForDates || isUnavailable
              ? ' is-booked'
              : isAvailableForDates
                ? ' is-open'
                : ''
          }`}
        >
          {statusText}
        </p>
        <div className="card__actions">
          <Link
            href={`/residences/${residence.slug}`}
            className="btn btn--ghost-dark"
          >
            View Residence
          </Link>
          {isUnavailable || isBookedForDates ? (
            <button type="button" className="btn btn--primary" disabled>
              {isBookedForDates ? 'ALREADY BOOKED' : 'UNAVAILABLE'}
            </button>
          ) : isAvailableForDates ? (
            <Link href={bookingHref} className="btn btn--primary">
              BOOK NOW
            </Link>
          ) : (
            <Link href={bookingHref} className="btn btn--primary">
              CHECK AVAILABILITY
            </Link>
          )}
        </div>
      </div>
    </article>
  );
}
