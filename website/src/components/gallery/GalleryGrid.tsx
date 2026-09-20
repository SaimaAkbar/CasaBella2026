'use client';

import { useMemo, useState } from 'react';
import type { GalleryItem } from '@/types';
import { galleryCategories } from '@/data/gallery';

export function GalleryGrid({ items }: { items: GalleryItem[] }) {
  const [category, setCategory] = useState<(typeof galleryCategories)[number]>('All');
  const [active, setActive] = useState<GalleryItem | null>(null);

  const filtered = useMemo(() => {
    if (category === 'All') return items;
    return items.filter((item) => item.category === category);
  }, [category, items]);

  return (
    <div>
      <div className="gallery-filters">
        {galleryCategories.map((item) => (
          <button
            key={item}
            type="button"
            className={`gallery-filter${category === item ? ' is-active' : ''}`}
            onClick={() => setCategory(item)}
          >
            {item}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="empty-state">No images in this category yet.</div>
      ) : (
        <div className="gallery-grid">
          {filtered.map((item) => (
            <button
              key={item.id}
              type="button"
              className="gallery-item"
              onClick={() => setActive(item)}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={item.src} alt={item.alt} loading="lazy" />
              <span>{item.category}</span>
            </button>
          ))}
        </div>
      )}

      {active ? (
        <div className="lightbox" role="dialog" aria-modal="true" aria-label={active.alt}>
          <button type="button" className="lightbox__close" onClick={() => setActive(null)}>
            Close
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={active.src} alt={active.alt} />
        </div>
      ) : null}
    </div>
  );
}
