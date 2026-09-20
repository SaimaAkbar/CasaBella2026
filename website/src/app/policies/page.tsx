import type { Metadata } from 'next';
import { PageHero } from '@/components/ui/PageHero';
import { policies } from '@/data/policies';

export const metadata: Metadata = {
  title: 'Policies',
  description: 'Booking, cancellation, privacy, and residence policies for Casa Bella.',
};

export default function PoliciesPage() {
  return (
    <>
      <PageHero
        title="Policies"
        subtitle="Placeholder legal and stay policies — replace with official Casa Bella text."
        imageSrc="https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&w=1800&q=80"
        imageAlt="Documents on desk"
      />
      <section className="section">
        <div className="container" style={{ maxWidth: '860px' }}>
          {policies.map((section) => (
            <article key={section.id} className="booking-panel" style={{ marginBottom: '1rem' }}>
              <h2>{section.title}</h2>
              {section.isPlaceholder ? (
                <p className="badge">Placeholder — not official policy</p>
              ) : null}
              <p style={{ marginTop: '0.85rem' }}>{section.body}</p>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}
