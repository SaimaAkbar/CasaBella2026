import type { Metadata } from 'next';
import { Suspense } from 'react';
import MockPayClient from './MockPayClient';

export const metadata: Metadata = {
  title: 'Test payment',
  robots: { index: false, follow: false },
};

export default function MockPayPage() {
  return (
    <Suspense fallback={<div className="container section">Processing…</div>}>
      <MockPayClient />
    </Suspense>
  );
}
