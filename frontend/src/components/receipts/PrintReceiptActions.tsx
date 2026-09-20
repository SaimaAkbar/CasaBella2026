import { useState } from 'react';
import { printReceiptSmart } from '../../lib/print-receipt';
import { usePrinter } from '../../context/PrinterContext';
import type { ReceiptPrintTarget, ThermalReceipt } from '../../types/receipt';
import { ReceiptPreviewModal } from './ReceiptPreviewModal';
import { fetchReceiptForPrint } from '../../api/receipts';
import { printReceiptInBrowser } from '../../lib/browser-receipt-print';
import './receipt.css';

type Props = {
  token: string;
  target: ReceiptPrintTarget | null;
  enabled?: boolean;
  onPrinted?: () => void;
  onError?: (message: string) => void;
};

export function PrintReceiptActions({
  token,
  target,
  enabled = true,
  onPrinted,
  onError,
}: Props) {
  const { config } = usePrinter();
  const [receipt, setReceipt] = useState<ThermalReceipt | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [printError, setPrintError] = useState('');
  const [printSuccess, setPrintSuccess] = useState('');

  if (!target || !enabled) return null;

  async function handlePrint() {
    setBusy(true);
    setPrintError('');
    setPrintSuccess('');
    try {
      const result = await printReceiptSmart({
        token,
        target: target!,
        printerName: config?.printerName || 'POS-80',
        autoCut: config?.autoCut !== false,
      });
      setReceipt(result.receipt);
      setPrintSuccess(
        result.mode === 'thermal'
          ? `Receipt sent to ${result.printerName}.`
          : 'Print dialog opened (remote server). Select POS-80 and click Print.',
      );
      onPrinted?.();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Unable to print receipt.';
      setPrintError(message);
      onError?.(message);
    } finally {
      setBusy(false);
    }
  }

  async function handlePreview() {
    setBusy(true);
    setPrintError('');
    try {
      const data = await fetchReceiptForPrint(token, target!);
      setReceipt(data);
      setPreviewOpen(true);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Unable to load receipt data.';
      setPrintError(message);
      onError?.(message);
    } finally {
      setBusy(false);
    }
  }

  async function handlePrintFromPreview() {
    if (!receipt) return;
    setBusy(true);
    setPrintError('');
    try {
      printReceiptInBrowser(receipt);
      setPreviewOpen(false);
      setPrintSuccess('Print dialog opened. Select POS-80 and click Print.');
      onPrinted?.();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Unable to open print dialog.';
      setPrintError(message);
      onError?.(message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="print-receipt-actions">
        <button
          type="button"
          className="btn btn--primary"
          disabled={busy}
          onClick={() => void handlePrint()}
        >
          {busy ? 'Printing…' : 'Print Receipt'}
        </button>
        <button
          type="button"
          className="btn btn--ghost"
          disabled={busy}
          onClick={() => void handlePreview()}
        >
          Preview Receipt
        </button>
        {printError ? (
          <p className="print-receipt-actions__error" role="alert">
            {printError}
          </p>
        ) : printSuccess ? (
          <p className="print-receipt-actions__message" role="status">
            {printSuccess}
          </p>
        ) : (
          <p className="print-receipt-actions__message">
            Prints bill with paid + remaining (half payment OK).
          </p>
        )}
      </div>

      <ReceiptPreviewModal
        open={previewOpen}
        receipt={receipt}
        busy={busy}
        onClose={() => setPreviewOpen(false)}
        onPrint={() => void handlePrintFromPreview()}
      />
    </>
  );
}
