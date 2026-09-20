import Link from 'next/link';
import type { Offer } from '@/types';

export function OfferCard({ offer }: { offer: Offer }) {
  return (
    <article className="card">
      <div className="card__media">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={offer.image.src} alt={offer.image.alt} loading="lazy" />
      </div>
      <div className="card__body">
        <h3>{offer.title}</h3>
        <p>{offer.description}</p>
        <p className="price">{offer.priceLabel}</p>
        {offer.discountLabel ? <p className="badge">{offer.discountLabel}</p> : null}
        <ul style={{ margin: '0.75rem 0 1rem', paddingLeft: '1.1rem', color: 'var(--ink-soft)' }}>
          {offer.benefits.slice(0, 3).map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <Link href={`/booking?offer=${offer.slug}`} className="btn btn--primary">
          Book Now
        </Link>
      </div>
    </article>
  );
}
