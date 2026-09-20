import type { Metadata } from 'next';
import { Suspense } from 'react';
import PendingPaymentClient from './PendingPaymentClient';

export const metadata: Metadata = {
  title: 'Complete payment',
  description: 'Complete online payment to confirm your Casa Bella booking.',
};

export default function PendingPaymentPage() {
  return (
    <Suspense fallback={<section className="section"><div className="container">Loading…</div></section>}>
      <PendingPaymentClient />
    </Suspense>
  );
}
