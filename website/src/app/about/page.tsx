import type { Metadata } from 'next';
import { PageHero } from '@/components/ui/PageHero';
import { siteConfig } from '@/data/site';

export const metadata: Metadata = {
  title: 'About Casa Bella',
  description: 'The story of Casa Bella Hotel & Residence — hospitality with composure.',
};

export default function AboutPage() {
  return (
    <>
      <PageHero
        title="About Casa Bella"
        subtitle="A hotel and residence crafted for guests who prefer quiet confidence."
        imageSrc="https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1800&q=80"
        imageAlt="Casa Bella lobby"
      />
      <section className="section">
        <div className="container split">
          <div>
            <p className="eyebrow">Story</p>
            <h2>Where hotel polish meets residential calm</h2>
            <p className="lead">{siteConfig.brand.shortDescription}</p>
            <p>
              Casa Bella exists for travellers who want more than a night — and residents
              who still want hospitality. The brand language is warm, composed, and
              precise. Final founding details will replace this narrative when provided.
            </p>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1400&q=80"
            alt="Residence interior"
          />
        </div>
      </section>
      <section className="section" style={{ background: 'rgba(240,232,220,0.4)' }}>
        <div className="container why-grid">
          <div className="why-item">
            <h3>Mission</h3>
            <p>To offer elevated stays that feel personal without being theatrical.</p>
          </div>
          <div className="why-item">
            <h3>Hospitality philosophy</h3>
            <p>Service that anticipates, then steps back — privacy first, presence when needed.</p>
          </div>
          <div className="why-item">
            <h3>Why guests choose us</h3>
            <p>Choice of room or residence, thoughtful design, and a calm operational rhythm.</p>
          </div>
        </div>
      </section>
    </>
  );
}
