import type { Metadata } from 'next';
import { Suspense } from 'react';
import PaymentClient from './PaymentClient';

export const metadata: Metadata = {
  title: 'Payment',
  description:
    'Complete your Casa Bella hotel booking with a manual bank transfer.',
};

export default function BookingPaymentPage() {
  return (
    <Suspense
      fallback={<div className="section container">Loading payment…</div>}
    >
      <PaymentClient />
    </Suspense>
  );
}
