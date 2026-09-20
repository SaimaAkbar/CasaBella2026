import type { Metadata } from 'next';
import { ContactForm } from '@/components/contact/ContactForm';
import { PageHero } from '@/components/ui/PageHero';
import { siteConfig } from '@/data/site';
import { getBookingWhatsAppNumber } from '@/lib/whatsapp';

export const metadata: Metadata = {
  title: 'Contact',
  description: 'Contact Casa Bella Hotel & Residence — enquiries, stays, and assistance.',
};

export default function ContactPage() {
  const whatsapp = getBookingWhatsAppNumber();
  const embed = siteConfig.location.mapsEmbedUrl;

  return (
    <>
      <PageHero
        title="Contact"
        subtitle="Reach the team for stays, residences, and general enquiries."
        imageSrc="https://images.unsplash.com/photo-1423666639041-f56000c27a9a?auto=format&fit=crop&w=1800&q=80"
        imageAlt="Reception desk"
      />
      <section className="section">
        <div className="container split" style={{ alignItems: 'start' }}>
          <div>
            <p className="eyebrow">Details</p>
            <h2>Speak with Casa Bella</h2>
            <p>
              <a href={siteConfig.contact.phoneHref}>{siteConfig.contact.phoneLabel}</a>
            </p>
            <p>
              <a href={siteConfig.contact.emailHref}>{siteConfig.contact.emailLabel}</a>
            </p>
            {siteConfig.contact.addressLines.map((line) => (
              <p key={line} style={{ marginBottom: '0.2rem' }}>
                {line}
              </p>
            ))}
            <p style={{ marginTop: '1rem', display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
              {whatsapp ? (
                <a
                  className="btn btn--gold"
                  href={`https://wa.me/${whatsapp}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  WhatsApp
                </a>
              ) : null}
              {siteConfig.social.facebook ? (
                <a
                  className="btn btn--ghost"
                  href={siteConfig.social.facebook}
                  target="_blank"
                  rel="noreferrer"
                >
                  Facebook
                </a>
              ) : null}
              {siteConfig.social.instagram ? (
                <a
                  className="btn btn--ghost"
                  href={siteConfig.social.instagram}
                  target="_blank"
                  rel="noreferrer"
                >
                  Instagram
                </a>
              ) : null}
            </p>
            <div style={{ marginTop: '1.5rem' }}>
              {embed ? (
                <iframe
                  title="Casa Bella map"
                  src={embed}
                  style={{ width: '100%', minHeight: 280, border: 0 }}
                  loading="lazy"
                />
              ) : (
                <div className="empty-state">Map embed pending configuration.</div>
              )}
            </div>
          </div>
          <div className="booking-panel">
            <h3>Send a message</h3>
            <ContactForm />
          </div>
        </div>
      </section>
    </>
  );
}
