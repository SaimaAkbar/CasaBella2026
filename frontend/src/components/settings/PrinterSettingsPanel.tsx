import { useEffect, useState } from 'react';
import { fetchInstalledPrinters, testReceiptPrint } from '../../api/receipts';
import { bulkUpdateSettings } from '../../api/settings';
import {
  pickBestReceiptPrinter,
  RECOMMENDED_RECEIPT_PRINTERS,
} from '../../lib/qz-printer-select';
import { usePrinter } from '../../context/PrinterContext';
import '../receipts/receipt.css';

type Props = {
  token: string;
  onToast: (message: string, tone: 'success' | 'error') => void;
};

export function PrinterSettingsPanel({ token, onToast }: Props) {
  const { config, refreshConfig } = usePrinter();
  const [printerName, setPrinterName] = useState('POS-80');
  const [printers, setPrinters] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [detectBusy, setDetectBusy] = useState(false);

  async function detectPrinters(silent = false) {
    setDetectBusy(true);
    try {
      const result = await fetchInstalledPrinters(token);
      setPrinters(result.printers);
      if (result.resolvedPrinterName) {
        setPrinterName((current) => current || result.resolvedPrinterName);
      } else if (result.printers.length > 0) {
        setPrinterName(
          (current) =>
            current || pickBestReceiptPrinter(result.printers) || result.printers[0],
        );
      }
      if (!silent) {
        if (result.printers.length === 0) {
          onToast('No Windows printers found on this PC.', 'error');
        } else {
          onToast(
            `${result.printers.length} printer(s) found. Using ${result.resolvedPrinterName || printerName}.`,
            'success',
          );
        }
      }
    } catch (err) {
      if (!silent) {
        onToast(
          err instanceof Error
            ? err.message
            : 'Unable to list Windows printers on this PC.',
          'error',
        );
      }
    } finally {
      setDetectBusy(false);
    }
  }

  useEffect(() => {
    setPrinterName(config?.printerName || 'POS-80');
  }, [config?.printerName]);

  useEffect(() => {
    void detectPrinters(true);
  }, [token]);

  async function saveSettings() {
    if (!printerName.trim()) {
      onToast('Enter your thermal printer name (e.g. POS-80).', 'error');
      return;
    }

    setBusy(true);
    try {
      await bulkUpdateSettings(
        token,
        [
          { key: 'hardware.receiptPrinterName', value: printerName.trim() },
          { key: 'hardware.receiptPaperWidthMm', value: 80 },
          { key: 'hardware.receiptPrintWidthMm', value: 72 },
          { key: 'hardware.receiptAutoCut', value: true },
        ],
        'Receipt printer configuration updated',
      );
      await refreshConfig();
      onToast('Printer settings saved.', 'success');
    } catch (err) {
      onToast(
        err instanceof Error ? err.message : 'Unable to save printer settings.',
        'error',
      );
    } finally {
      setBusy(false);
    }
  }

  async function testPrint() {
    if (!printerName.trim()) {
      onToast('Save printer name first (recommended: POS-80).', 'error');
      return;
    }

    setBusy(true);
    try {
      const result = await testReceiptPrint(token, {
        printerName: printerName.trim(),
      });
      onToast(`Test receipt sent to ${result.printerName}.`, 'success');
    } catch (err) {
      onToast(
        err instanceof Error
          ? err.message
          : 'Unable to print test receipt on Speed X SP 200.',
        'error',
      );
    } finally {
      setBusy(false);
    }
  }

  const printerOptions = Array.from(
    new Set([...printers, ...RECOMMENDED_RECEIPT_PRINTERS, printerName].filter(Boolean)),
  );

  return (
    <section className="printer-settings">
      <p className="form-hint">
        Thermal printer: <strong>Speed X SP 200</strong> (Windows name{' '}
        <strong>POS-80</strong>, USB). Paper: 80mm · Printable width: 72mm ·
        Partial auto cut enabled. Receipts print directly from this PC — no browser
        dialog.
      </p>

      <label className="form-field">
        <span>Receipt Printer Name</span>
        <input
          list="receipt-printer-options"
          value={printerName}
          onChange={(event) => setPrinterName(event.target.value)}
          placeholder="POS-80"
        />
        <datalist id="receipt-printer-options">
          {printerOptions.map((name) => (
            <option key={name} value={name} />
          ))}
        </datalist>
      </label>

      {printers.length > 0 ? (
        <label className="form-field">
          <span>Installed Printers (Windows)</span>
          <select
            value={printerName}
            onChange={(event) => setPrinterName(event.target.value)}
          >
            {printerOptions.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      <div className="form-grid">
        <label className="form-field">
          <span>Paper Size</span>
          <input value="80mm" readOnly />
        </label>
        <label className="form-field">
          <span>Print Width</span>
          <input value="72mm" readOnly />
        </label>
        <label className="form-field">
          <span>Auto Cut</span>
          <input value="Enabled" readOnly />
        </label>
      </div>

      <div className="printer-settings__actions">
        <button
          type="button"
          className="btn btn--ghost"
          disabled={detectBusy}
          onClick={() => void detectPrinters()}
        >
          {detectBusy ? 'Detecting…' : 'Detect Printers'}
        </button>
        <button
          type="button"
          className="btn btn--ghost"
          disabled={busy || !printerName.trim()}
          onClick={() => void testPrint()}
        >
          Test Print
        </button>
        <button
          type="button"
          className="btn btn--primary"
          disabled={busy}
          onClick={() => void saveSettings()}
        >
          {busy ? 'Saving…' : 'Save Printer'}
        </button>
      </div>
    </section>
  );
}
