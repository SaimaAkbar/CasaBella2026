import type { Metadata } from 'next';
import { GalleryGrid } from '@/components/gallery/GalleryGrid';
import { PageHero } from '@/components/ui/PageHero';
import { galleryItems } from '@/data/gallery';

export const metadata: Metadata = {
  title: 'Gallery',
  description: 'Visual gallery of Casa Bella hotel, residences, and facilities.',
};

export default function GalleryPage() {
  return (
    <>
      <PageHero
        title="Gallery"
        subtitle="Photography placeholders until official Casa Bella imagery is supplied."
        imageSrc="https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?auto=format&fit=crop&w=1800&q=80"
        imageAlt="Hotel exterior"
      />
      <section className="section">
        <div className="container">
          <GalleryGrid items={galleryItems} />
        </div>
      </section>
    </>
  );
}
