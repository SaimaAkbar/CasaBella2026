import { PageHeader } from '../components/PageHeader';
import './PlaceholderPage.css';

type PlaceholderPageProps = {
  title: string;
  breadcrumb: string[];
};

export function PlaceholderPage({ title, breadcrumb }: PlaceholderPageProps) {
  return (
    <section className="placeholder-page">
      <PageHeader title={title} breadcrumb={breadcrumb} />
      <div className="placeholder-page__panel">
        <p>This module will be connected in a later step.</p>
      </div>
    </section>
  );
}
