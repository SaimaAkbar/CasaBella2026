import Link from 'next/link';
import type { Metadata } from 'next';
import { BookingSearch } from '@/components/booking/BookingSearch';
import { FacilityCard } from '@/components/facilities/FacilityCard';
import { OfferCard } from '@/components/offers/OfferCard';
import { ResidenceCard } from '@/components/residences/ResidenceCard';
import { RoomCard } from '@/components/rooms/RoomCard';
import { galleryItems } from '@/data/gallery';
import { offers } from '@/data/offers';
import { fetchFacilities } from '@/lib/api/facilities';
import { fetchResidences } from '@/lib/api/residences';
import { fetchRooms } from '@/lib/api/rooms';
import { siteConfig } from '@/data/site';
import { testimonials } from '@/data/testimonials';

export const metadata: Metadata = {
  title: 'Casa Bella Hotel & Residence',
  description: siteConfig.seo.defaultDescription,
};

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const [rooms, residences, facilities] = await Promise.all([
    fetchRooms().catch(() => []),
    fetchResidences().catch(() => []),
    fetchFacilities().catch(() => []),
  ]);
  const featuredRooms = rooms.slice(0, 3);
  const featuredResidences = residences.slice(0, 3);
  const galleryPreview = galleryItems.slice(0, 6);

  return (
    <>
      <section className="home-hero">
        <div className="home-hero__media">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=2000&q=80"
            alt="Casa Bella Hotel & Residence atmosphere"
          />
        </div>
        <div className="home-hero__shade" />
        <div className="home-hero__content reveal">
          <p className="eyebrow" style={{ color: '#d8c39a' }}>
            Hotel & Residence
          </p>
          <h1 className="home-hero__brand">{siteConfig.brand.fullName}</h1>
          <p className="home-hero__tag">{siteConfig.brand.tagline}</p>
          <div className="home-hero__actions">
            <Link href="/booking" className="btn btn--gold">
              Book Your Stay
            </Link>
            <Link href="/residences" className="btn btn--ghost">
              Explore Apartments
            </Link>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container split">
          <div>
            <p className="eyebrow">Welcome</p>
            <h2>Hotel composure. Residential ease.</h2>
            <p className="lead">{siteConfig.brand.shortDescription}</p>
            <p>
              Whether you need a polished overnight stay or an apartment for weeks,
              Casa Bella is structured for both — with service that stays in the
              background until you need it.
            </p>
            <Link href="/about" className="btn btn--ghost-dark">
              Our story
            </Link>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=1400&q=80"
            alt="Elegant hotel corridor"
          />
        </div>
      </section>

      <section className="section--tight">
        <div className="container">
          <BookingSearch />
        </div>
      </section>

      <section className="section">
        <div className="container">
          <p className="eyebrow">Rooms</p>
          <h2>Featured hotel rooms</h2>
          <div className="grid-cards" style={{ marginTop: '1.5rem' }}>
            {featuredRooms.map((room) => (
              <RoomCard key={room.id} room={room} />
            ))}
          </div>
          <div style={{ marginTop: '1.5rem' }}>
            <Link href="/rooms" className="btn btn--ghost-dark">
              View all rooms
            </Link>
          </div>
        </div>
      </section>

      <section className="section" style={{ background: 'rgba(240, 232, 220, 0.45)' }}>
        <div className="container">
          <p className="eyebrow">Residences</p>
          <h2>Featured apartments</h2>
          <div className="grid-cards" style={{ marginTop: '1.5rem' }}>
            {featuredResidences.map((item) => (
              <ResidenceCard key={item.id} residence={item} />
            ))}
          </div>
          <div style={{ marginTop: '1.5rem' }}>
            <Link href="/residences" className="btn btn--ghost-dark">
              View all residences
            </Link>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <p className="eyebrow">Facilities</p>
          <h2>Hotel facilities</h2>
          {facilities.length === 0 ? (
            <p style={{ marginTop: '1.5rem' }}>
              Facilities will be listed soon.
            </p>
          ) : (
            <>
              <div className="grid-cards" style={{ marginTop: '1.5rem' }}>
                {facilities.slice(0, 3).map((facility) => (
                  <FacilityCard key={facility.id} facility={facility} />
                ))}
              </div>
              <div style={{ marginTop: '1.5rem' }}>
                <Link href="/facilities" className="btn btn--ghost-dark">
                  All facilities
                </Link>
              </div>
            </>
          )}
        </div>
      </section>

      <section className="section">
        <div className="container">
          <p className="eyebrow">Why Casa Bella</p>
          <h2>Why stay with us</h2>
          <div className="why-grid" style={{ marginTop: '1.5rem' }}>
            <div className="why-item">
              <h3>Dual living</h3>
              <p>Hotel rooms and apartments under one considered hospitality brand.</p>
            </div>
            <div className="why-item">
              <h3>Quiet luxury</h3>
              <p>Warm materials, soft light, and service that never crowds the moment.</p>
            </div>
            <div className="why-item">
              <h3>Stay your way</h3>
              <p>From overnight polish to residential rhythm for longer visits.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <p className="eyebrow">Offers</p>
          <h2>Special offers</h2>
          <div className="grid-cards" style={{ marginTop: '1.5rem' }}>
            {offers.slice(0, 2).map((offer) => (
              <OfferCard key={offer.id} offer={offer} />
            ))}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <p className="eyebrow">Gallery</p>
          <h2>A glimpse inside</h2>
          <div className="gallery-grid" style={{ marginTop: '1.25rem' }}>
            {galleryPreview.map((item) => (
              <div key={item.id} className="gallery-item" style={{ cursor: 'default' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={item.src} alt={item.alt} loading="lazy" />
                <span>{item.category}</span>
              </div>
            ))}
          </div>
          <div style={{ marginTop: '1.5rem' }}>
            <Link href="/gallery" className="btn btn--ghost-dark">
              Open gallery
            </Link>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <p className="eyebrow">Guests</p>
          <h2>Words from recent stays</h2>
          <div className="grid-cards" style={{ marginTop: '1.5rem' }}>
            {testimonials.map((item) => (
              <blockquote key={item.id} className="testimonial">
                <p>“{item.quote}”</p>
                <footer>
                  <strong>{item.guestName}</strong> · {item.stayType}
                </footer>
              </blockquote>
            ))}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container split">
          <div>
            <p className="eyebrow">Location</p>
            <h2>Find Casa Bella</h2>
            <p>{siteConfig.contact.addressLabel}</p>
            <p>
              Call{' '}
              <a href={siteConfig.contact.phoneHref}>{siteConfig.contact.phoneLabel}</a>
              {' '}for directions or booking help.
            </p>
            <Link href="/location" className="btn btn--ghost-dark">
              Location & directions
            </Link>
          </div>
          <div>
            {siteConfig.location.mapsEmbedUrl ? (
              <iframe
                title="Casa Bella map"
                src={siteConfig.location.mapsEmbedUrl}
                style={{ width: '100%', minHeight: 320, border: 0, borderRadius: 12 }}
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            ) : (
              <div className="empty-state">
                Google Maps embed placeholder — set NEXT_PUBLIC_GOOGLE_MAPS_EMBED_URL
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="section" style={{ background: 'var(--ink)', color: '#efe8dc' }}>
        <div className="container" style={{ textAlign: 'center' }}>
          <p className="eyebrow" style={{ color: '#d8c39a' }}>
            Reserve
          </p>
          <h2 style={{ color: '#fff' }}>Begin your Casa Bella stay</h2>
          <p style={{ color: '#d7cec0', marginInline: 'auto' }}>
            Check availability for rooms or residences, then complete a guided booking.
          </p>
          <div className="home-hero__actions" style={{ justifyContent: 'center' }}>
            <Link href="/booking" className="btn btn--gold">
              Book Now
            </Link>
            <Link href="/contact" className="btn btn--ghost">
              Contact
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
