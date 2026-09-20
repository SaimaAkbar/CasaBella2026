import Link from 'next/link';
import type { Room } from '@/types';
import { formatMoney } from '@/lib/booking';

type Props = {
  room: Room;
  checkIn?: string;
  checkOut?: string;
};

export function RoomCard({ room, checkIn, checkOut }: Props) {
  const image = room.images[0];
  const datesSelected = Boolean(checkIn && checkOut);
  const datesChecked = room.datesChecked === true || datesSelected;
  const isBookedForDates =
    datesChecked && room.bookingAvailability === 'BOOKED';
  const isUnavailable = room.bookingAvailability === 'UNAVAILABLE';
  const isAvailableForDates =
    datesChecked && room.bookingAvailability === 'AVAILABLE' && !isUnavailable;

  const bookingHref =
    checkIn && checkOut
      ? `/booking?type=room&id=${room.id}&checkIn=${checkIn}&checkOut=${checkOut}`
      : `/booking?type=room&id=${room.id}`;

  let statusText = 'SELECT DATES TO CHECK AVAILABILITY';
  if (isUnavailable) statusText = 'UNAVAILABLE';
  else if (isBookedForDates) statusText = 'NOT AVAILABLE FOR THESE DATES';
  else if (isAvailableForDates) statusText = 'AVAILABLE';

  return (
    <article className="card">
      <div className="card__media">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={image?.src} alt={image?.alt || room.name} loading="lazy" />
      </div>
      <div className="card__body">
        <h3>{room.name}</h3>
        {room.roomNumber ? (
          <p className="eyebrow" style={{ marginBottom: '0.35rem' }}>
            Room {room.roomNumber}
          </p>
        ) : null}
        <p>{room.shortDescription}</p>
        <div className="card__meta">
          <span>{room.guests} guests</span>
          <span>{room.bedType}</span>
          {room.amenities.slice(0, 4).map((item) => (
            <span key={item.id}>{item.name}</span>
          ))}
        </div>
        <p className="price">
          {formatMoney(room.startingPrice.amount)}
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
          <Link href={`/rooms/${room.slug}`} className="btn btn--ghost-dark">
            View Details
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
