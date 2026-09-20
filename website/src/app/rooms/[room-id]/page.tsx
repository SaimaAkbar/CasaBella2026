import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { BookingSearch } from '@/components/booking/BookingSearch';
import { RoomCard } from '@/components/rooms/RoomCard';
import { fetchRoomBySlug, fetchRooms } from '@/lib/api/rooms';
import { formatMoney } from '@/lib/booking';

type Props = { params: Promise<{ 'room-id': string }> };

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { 'room-id': id } = await params;
  const room = await fetchRoomBySlug(id);
  if (!room) return { title: 'Room' };
  return {
    title: room.name,
    description: room.shortDescription,
  };
}

export default async function RoomDetailPage({ params }: Props) {
  const { 'room-id': id } = await params;
  const room = await fetchRoomBySlug(id);
  if (!room) notFound();

  const all = await fetchRooms().catch(() => []);
  const related = all.filter((item) => item.id !== room.id).slice(0, 2);

  return (
    <section className="section">
      <div className="container">
        <div className="detail-gallery">
          <div className="detail-gallery__main">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={room.images[0]?.src} alt={room.images[0]?.alt || room.name} />
          </div>
          <div className="detail-gallery__side">
            {room.images.slice(1, 3).map((image) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={image.id} src={image.src} alt={image.alt} />
            ))}
          </div>
        </div>

        <div className="split" style={{ marginTop: '2rem', alignItems: 'start' }}>
          <div>
            <p className="eyebrow">Room</p>
            <h1>{room.name}</h1>
            <p className="lead">{room.description}</p>
            <div className="card__meta">
              <span>{room.guests} guests</span>
              <span>{room.bedType}</span>
            </div>
            <p className="price">{formatMoney(room.startingPrice.amount)}</p>
            {room.amenities.length > 0 ? (
              <>
                <h3>Amenities</h3>
                <ul className="amenity-list">
                  {room.amenities.map((item) => (
                    <li key={item.id}>{item.name}</li>
                  ))}
                </ul>
              </>
            ) : null}
            <div style={{ marginTop: '1.25rem' }}>
              <Link href={`/booking?type=room&id=${room.id}`} className="btn btn--primary">
                Book this room
              </Link>
            </div>
          </div>
          <div>
            <BookingSearch compact defaultType="room" propertyId={room.id} />
          </div>
        </div>

        {related.length > 0 ? (
          <div style={{ marginTop: '3rem' }}>
            <h2>Related rooms</h2>
            <div className="grid-cards" style={{ marginTop: '1rem' }}>
              {related.map((item) => (
                <RoomCard key={item.id} room={item} />
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
