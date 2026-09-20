import type { Metadata } from 'next';
import { PageHero } from '@/components/ui/PageHero';
import { RoomCard } from '@/components/rooms/RoomCard';
import { RoomsDateFilter } from '@/components/rooms/RoomsDateFilter';
import { fetchRooms } from '@/lib/api/rooms';
import type { Room } from '@/types';

export const metadata: Metadata = {
  title: 'Hotel Rooms',
  description: 'Explore Casa Bella hotel rooms from live inventory.',
};

export const dynamic = 'force-dynamic';

type Props = {
  searchParams: Promise<{ checkIn?: string; checkOut?: string }>;
};

export default async function RoomsPage({ searchParams }: Props) {
  const params = await searchParams;
  const checkIn = params.checkIn?.trim() || undefined;
  const checkOut = params.checkOut?.trim() || undefined;

  let rooms: Room[] = [];
  let allUnitCount = 0;
  let apartmentCount = 0;
  let error = '';
  try {
    const [{ fetchPublicUnits }] = await Promise.all([
      import('@/lib/api/units'),
    ]);
    const [roomList, allUnits, apartments] = await Promise.all([
      fetchRooms({ checkIn, checkOut }),
      fetchPublicUnits(undefined, { checkIn, checkOut }),
      fetchPublicUnits('APARTMENT', { checkIn, checkOut }),
    ]);
    rooms = roomList;
    allUnitCount = allUnits.length;
    apartmentCount = apartments.length;
  } catch (err) {
    error = err instanceof Error ? err.message : 'Unable to load rooms from POS.';
  }

  return (
    <>
      <PageHero
        title="Hotel Rooms"
        subtitle="All rooms from Casa Bella POS inventory. Availability updates with your dates."
        imageSrc="https://images.unsplash.com/photo-1611892440504-42a792e24d32?auto=format&fit=crop&w=1800&q=80"
        imageAlt="Casa Bella hotel room"
      />
      <section className="section">
        <div className="container">
          <RoomsDateFilter checkIn={checkIn} checkOut={checkOut} basePath="/rooms" />
          {error ? (
            <div className="alert alert--error">
              <strong>Could not load rooms from POS API.</strong>
              <p>{error}</p>
              <p>
                Check that the backend is running on{' '}
                <code>NEXT_PUBLIC_API_BASE_URL</code> and the database is reachable.
              </p>
            </div>
          ) : null}
          {!error && rooms.length === 0 ? (
            <div className="empty-state">
              <h2>No rooms found</h2>
              <p>
                POS API connected successfully. Live inventory count from table{' '}
                <code>Unit</code>:
              </p>
              <ul style={{ textAlign: 'left', display: 'inline-block' }}>
                <li>All units: {allUnitCount}</li>
                <li>Rooms (unitType = ROOM): {rooms.length}</li>
                <li>Apartments (unitType = APARTMENT): {apartmentCount}</li>
              </ul>
              {allUnitCount === 0 ? (
                <p>
                  The database has <strong>zero</strong> units. Rooms were cleared
                  (for example by a business-data wipe). Add them again in the admin
                  panel under <strong>Rooms &amp; Apartments</strong>, then refresh.
                </p>
              ) : apartmentCount > 0 ? (
                <p>
                  Units exist as apartments. Open{' '}
                  <a href="/residences">Residences</a>, or set unit type to{' '}
                  <code>ROOM</code> in the POS for hotel rooms.
                </p>
              ) : (
                <p>
                  Units exist but none are type <code>ROOM</code> and active.
                </p>
              )}
            </div>
          ) : null}
          {rooms.length > 0 ? (
            <div className="grid-cards">
              {rooms.map((room) => (
                <RoomCard
                  key={room.id}
                  room={room}
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
