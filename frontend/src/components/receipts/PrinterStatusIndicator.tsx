import { useEffect, useState } from 'react';
import { usePrinter } from '../../context/PrinterContext';
import './receipt.css';

const QZ_DOWNLOAD_URL = 'https://qz.io/download/';

export function PrinterStatusIndicator() {
  const { status, statusMessage, connect } = usePrinter();
  const [helpOpen, setHelpOpen] = useState(false);
  const [retryError, setRetryError] = useState('');

  useEffect(() => {
    if (status !== 'ready') {
      setHelpOpen(true);
    }
  }, [status]);

  async function handleRetry() {
    setRetryError('');
    try {
      await connect();
      setHelpOpen(false);
    } catch (err) {
      setRetryError(
        err instanceof Error ? err.message : 'Unable to connect to QZ Tray.',
      );
      setHelpOpen(true);
    }
  }

  return (
    <div className="printer-status-wrap">
      <div className={`printer-status printer-status--${status}`}>
        <span className="printer-status__dot" aria-hidden="true" />
        <span>{statusMessage}</span>
        {status !== 'ready' ? (
          <>
            <a
              className="btn btn--ghost"
              style={{ padding: '0.1rem 0.45rem', fontSize: '0.72rem' }}
              href={QZ_DOWNLOAD_URL}
              target="_blank"
              rel="noreferrer"
            >
              Download QZ
            </a>
            <button
              type="button"
              className="btn btn--ghost"
              style={{ padding: '0.1rem 0.45rem', fontSize: '0.72rem' }}
              onClick={() => void handleRetry()}
            >
              Retry
            </button>
            <button
              type="button"
              className="btn btn--ghost"
              style={{ padding: '0.1rem 0.45rem', fontSize: '0.72rem' }}
              onClick={() => setHelpOpen((open) => !open)}
            >
              Help
            </button>
          </>
        ) : null}
      </div>

      {helpOpen && status !== 'ready' ? (
        <div className="printer-status-help" role="note">
          <p className="printer-status-help__lead">
            <strong>You can print receipts now</strong> using{' '}
            <strong>Print (Browser)</strong> after each payment. Select{' '}
            <strong>POS-80</strong> in the print dialog.
          </p>
          <p className="printer-status-help__lead">
            For automatic thermal printing, install QZ Tray once on this PC:
          </p>
          <ol>
            <li>
              Click <strong>Download QZ</strong> → install from{' '}
              <a href={QZ_DOWNLOAD_URL} target="_blank" rel="noreferrer">
                qz.io/download
              </a>
            </li>
            <li>Open <strong>QZ Tray</strong> from Start menu (tray icon near clock)</li>
            <li>
              Chrome/Edge: lock icon → Site settings → allow{' '}
              <strong>Local network access</strong>
            </li>
            <li>Refresh page → click <strong>Retry</strong></li>
            <li>
              Settings → Receipt Printer → save <strong>POS-80</strong> → Test
              Print
            </li>
          </ol>
          {retryError ? (
            <p className="printer-status-help__error">{retryError}</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
