import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHero } from '@/components/ui/PageHero';
import { siteConfig } from '@/data/site';

export const metadata: Metadata = {
  title: 'Location',
  description: 'Find Casa Bella Hotel & Residence — address, map, and directions.',
};

export default function LocationPage() {
  const embed = siteConfig.location.mapsEmbedUrl;

  return (
    <>
      <PageHero
        title="Location"
        subtitle="Plot 23-B, Shaheen Heights — Northern Strip, FECHS E-11/2, Islamabad."
        imageSrc="https://images.unsplash.com/photo-1449824913935-59a10b8d2000?auto=format&fit=crop&w=1800&q=80"
        imageAlt="City skyline"
      />
      <section className="section">
        <div className="container split">
          <div>
            <p className="eyebrow">Address</p>
            <h2>{siteConfig.brand.fullName}</h2>
            {siteConfig.contact.addressLines.map((line) => (
              <p key={line} style={{ marginBottom: '0.25rem' }}>
                {line}
              </p>
            ))}
            <p style={{ marginTop: '1rem' }}>{siteConfig.location.directions}</p>
            <p>{siteConfig.location.airportDistanceLabel}</p>
            <h3 style={{ marginTop: '1.5rem' }}>Nearby</h3>
            <ul>
              {siteConfig.location.nearby.map((item) => (
                <li key={item.name}>
                  {item.name} — {item.note}
                </li>
              ))}
            </ul>
            <Link href="/contact" className="btn btn--ghost-dark">
              Contact us
            </Link>
          </div>
          <div>
            {embed ? (
              <iframe
                title="Casa Bella map"
                src={embed}
                style={{ width: '100%', minHeight: 420, border: 0 }}
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            ) : (
              <div className="empty-state">
                Map placeholder. Set <code>NEXT_PUBLIC_GOOGLE_MAPS_EMBED_URL</code> when ready.
              </div>
            )}
          </div>
        </div>
      </section>
    </>
  );
}
