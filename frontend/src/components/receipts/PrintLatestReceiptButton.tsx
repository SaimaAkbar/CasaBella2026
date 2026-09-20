import { useState } from 'react';
import {
  fetchPaymentsByBooking,
  fetchPaymentsByTenancy,
} from '../../api/payments';
import { printReceiptSmart } from '../../lib/print-receipt';
import { usePrinter } from '../../context/PrinterContext';
import type { PaymentRecordStatus } from '../../types/payment';
import type { ReceiptPrintTarget } from '../../types/receipt';

const PRINTABLE_STATUSES: PaymentRecordStatus[] = ['COMPLETED', 'PENDING'];

type Props = {
  token: string;
  bookingId?: string;
  monthlyTenancyId?: string;
  label?: string;
  className?: string;
  onError?: (message: string) => void;
  onPrinted?: () => void;
};

export function PrintLatestReceiptButton({
  token,
  bookingId,
  monthlyTenancyId,
  label = 'Print Bill',
  className = 'data-table__action data-table__action--primary',
  onError,
  onPrinted,
}: Props) {
  const { config } = usePrinter();
  const [busy, setBusy] = useState(false);

  async function handlePrint() {
    if (!bookingId && !monthlyTenancyId) return;

    setBusy(true);
    try {
      const payments = bookingId
        ? await fetchPaymentsByBooking(token, bookingId)
        : await fetchPaymentsByTenancy(token, monthlyTenancyId!);

      const printable = payments.filter((payment) =>
        PRINTABLE_STATUSES.includes(payment.status),
      );
      const latest = printable[printable.length - 1];

      const target: ReceiptPrintTarget = latest
        ? { sourceType: 'payment', sourceId: latest.id }
        : bookingId
          ? { sourceType: 'booking_bill', sourceId: bookingId }
          : { sourceType: 'tenancy_bill', sourceId: monthlyTenancyId! };

      await printReceiptSmart({
        token,
        target,
        printerName: config?.printerName || 'POS-80',
        autoCut: config?.autoCut !== false,
      });
      onPrinted?.();
    } catch (err) {
      onError?.(
        err instanceof Error ? err.message : 'Unable to print bill.',
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      className={className}
      disabled={busy}
      title="Print bill even if half paid or remaining is pending"
      onClick={() => void handlePrint()}
    >
      {busy ? 'Printing…' : label}
    </button>
  );
}
