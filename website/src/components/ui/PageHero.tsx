type Props = {
  title: string;
  subtitle?: string;
  imageSrc: string;
  imageAlt: string;
};

export function PageHero({ title, subtitle, imageSrc, imageAlt }: Props) {
  return (
    <section className="page-hero">
      <div className="page-hero__media">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={imageSrc} alt={imageAlt} />
      </div>
      <div className="page-hero__shade" />
      <div className="page-hero__content reveal">
        <p className="eyebrow" style={{ color: '#d8c39a' }}>
          Casa Bella
        </p>
        <h1 style={{ color: '#fff', fontSize: 'clamp(2.2rem, 5vw, 3.4rem)' }}>{title}</h1>
        {subtitle ? <p style={{ color: '#e8dfd2', maxWidth: '36rem' }}>{subtitle}</p> : null}
      </div>
    </section>
  );
}
