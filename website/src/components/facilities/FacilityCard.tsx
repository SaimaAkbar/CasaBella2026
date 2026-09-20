import type { Facility } from '@/types';

export function FacilityCard({ facility }: { facility: Facility }) {
  return (
    <article className="card">
      <div className="card__media">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={facility.image.src}
          alt={facility.image.alt}
          loading="lazy"
        />
      </div>
      <div className="card__body">
        <h3>{facility.name}</h3>
        <p>{facility.description}</p>
      </div>
    </article>
  );
}
