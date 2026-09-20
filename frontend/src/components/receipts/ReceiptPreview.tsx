import { formatPkr } from '../../lib/format';
import { buildReceiptLines } from '../../lib/escpos-receipt';
import type { ThermalReceipt } from '../../types/receipt';
import './receipt.css';

type Props = {
  receipt: ThermalReceipt;
};

export function ReceiptPreview({ receipt }: Props) {
  const lines = buildReceiptLines(receipt);

  return (
    <article className="receipt-preview" aria-label="Receipt preview">
      {receipt.isReprint && receipt.copyLabel ? (
        <p className="receipt-preview__reprint">*** {receipt.copyLabel} ***</p>
      ) : null}
      {lines.map((line, index) => {
        if (!line) return <div key={index} style={{ height: '0.35rem' }} />;
        if (line === receipt.businessName) {
          return (
            <p key={index} className="receipt-preview__center receipt-preview__title">
              {line}
            </p>
          );
        }
        if (line === receipt.businessSubtitle || line === 'PAYMENT RECEIPT' || line === 'BILL / RECEIPT') {
          return (
            <p key={index} className="receipt-preview__center">
              {line}
            </p>
          );
        }
        if (line.startsWith('-')) {
          return <div key={index} className="receipt-preview__separator" />;
        }
        if (line.includes('FULLY PAID') || line.includes('PARTIAL PAYMENT')) {
          return (
            <p
              key={index}
              className={[
                'receipt-preview__status',
                line.includes('FULLY PAID')
                  ? 'receipt-preview__status--paid'
                  : 'receipt-preview__status--partial',
              ].join(' ')}
            >
              {line.replace('✓ ', '')}
            </p>
          );
        }
        if (line.includes(':') && (line.includes('Rs.') || line.includes('Remaining'))) {
          const [label, ...rest] = line.split(':');
          return (
            <div key={index} className="receipt-preview__row">
              <span>{label}:</span>
              <strong>{rest.join(':').trim()}</strong>
            </div>
          );
        }
        if (line.includes('Rs.')) {
          return (
            <div key={index} className="receipt-preview__row">
              <span>{line.split(':')[0]}:</span>
              <strong>{formatPkr(line.split(':').slice(1).join(':').trim())}</strong>
            </div>
          );
        }
        return <p key={index}>{line}</p>;
      })}
    </article>
  );
}
