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
  const canBook = room.canBook !== false;
  const bookingLabel = room.bookingLabel || (canBook ? 'BOOK NOW' : 'ALREADY BOOKED');
  const bookingHref =
    checkIn && checkOut
      ? `/booking?type=room&id=${room.id}&checkIn=${checkIn}&checkOut=${checkOut}`
      : `/booking?type=room&id=${room.id}`;

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
        <div className="card__actions">
          <Link href={`/rooms/${room.slug}`} className="btn btn--ghost-dark">
            View Details
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
