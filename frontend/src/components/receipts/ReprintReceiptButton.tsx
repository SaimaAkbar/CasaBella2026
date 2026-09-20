import { useState } from 'react';
import { printReceiptSmart } from '../../lib/print-receipt';
import { usePrinter } from '../../context/PrinterContext';
import type { ReceiptPrintTarget } from '../../types/receipt';

type Props = {
  token: string;
  target: ReceiptPrintTarget;
  label?: string;
  onError?: (message: string) => void;
};

export function ReprintReceiptButton({
  token,
  target,
  label = 'Reprint',
  onError,
}: Props) {
  const { config } = usePrinter();
  const [busy, setBusy] = useState(false);

  async function handleReprint() {
    setBusy(true);
    try {
      await printReceiptSmart({
        token,
        target,
        printerName: config?.printerName || 'POS-80',
        autoCut: config?.autoCut !== false,
      });
    } catch (err) {
      onError?.(
        err instanceof Error ? err.message : 'Unable to print receipt.',
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      className="btn btn--ghost"
      style={{ padding: '0.15rem 0.45rem', fontSize: '0.78rem' }}
      disabled={busy}
      onClick={() => void handleReprint()}
    >
      {busy ? 'Printing…' : label}
    </button>
  );
}
