import type { Metadata } from 'next';
import { FaqList } from '@/components/faq/FaqList';
import { PageHero } from '@/components/ui/PageHero';
import { faqs } from '@/data/faqs';

export const metadata: Metadata = {
  title: 'FAQ',
  description: 'Frequently asked questions about stays at Casa Bella.',
};

export default function FaqPage() {
  return (
    <>
      <PageHero
        title="FAQ"
        subtitle="Answers you can edit in configuration while official policies are finalized."
        imageSrc="https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?auto=format&fit=crop&w=1800&q=80"
        imageAlt="Hotel facade"
      />
      <section className="section">
        <div className="container" style={{ maxWidth: '860px' }}>
          <FaqList items={faqs} />
        </div>
      </section>
    </>
  );
}
