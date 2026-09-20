import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { fetchPrinterConfig } from '../api/receipts';
import { useAuth } from './AuthContext';
import {
  receiptPrinter,
  type PrinterConnectionStatus,
} from '../services/receiptPrinter';
import type { PrinterConfig } from '../types/receipt';

type PrinterContextValue = {
  status: PrinterConnectionStatus;
  statusMessage: string;
  config: PrinterConfig | null;
  activePrinterName: string;
  refreshConfig: () => Promise<void>;
  connect: () => Promise<void>;
  listPrinters: () => Promise<string[]>;
};

const PrinterContext = createContext<PrinterContextValue | null>(null);

export function PrinterProvider({ children }: { children: ReactNode }) {
  const { token } = useAuth();
  const [status, setStatus] = useState<PrinterConnectionStatus>('disconnected');
  const [statusMessage, setStatusMessage] = useState(
    'QZ not installed · Browser print available',
  );
  const [config, setConfig] = useState<PrinterConfig | null>(null);
  const [activePrinterName, setActivePrinterName] = useState('');

  useEffect(() => {
    receiptPrinter.setTokenGetter(() => token);
  }, [token]);

  const refreshConfig = useCallback(async () => {
    if (!token) return;
    try {
      const next = await fetchPrinterConfig(token);
      setConfig(next);
      receiptPrinter.setPreferredPrinter(next.printerName);
    } catch {
      // Keep the last known config if the server is temporarily unavailable.
    }
  }, [token]);

  useEffect(() => {
    const unsubscribe = receiptPrinter.subscribe((nextStatus, message) => {
      setStatus(nextStatus);
      if (message) setStatusMessage(message);
      setActivePrinterName(receiptPrinter.getActivePrinterName());
    });
    return () => {
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!token) return;
    void refreshConfig();
  }, [token, refreshConfig]);

  const connect = useCallback(async () => {
    try {
      await receiptPrinter.connect();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Unable to connect to QZ Tray.';
      setStatus('disconnected');
      setStatusMessage('QZ not installed · Browser print available');
      throw new Error(message);
    }
  }, []);

  const listPrinters = useCallback(async () => {
    return receiptPrinter.listPrinters();
  }, []);

  const value = useMemo<PrinterContextValue>(
    () => ({
      status,
      statusMessage,
      config,
      activePrinterName,
      refreshConfig,
      connect,
      listPrinters,
    }),
    [status, statusMessage, config, activePrinterName, refreshConfig, connect, listPrinters],
  );

  return (
    <PrinterContext.Provider value={value}>{children}</PrinterContext.Provider>
  );
}

export function usePrinter() {
  const context = useContext(PrinterContext);
  if (!context) {
    throw new Error('usePrinter must be used within PrinterProvider');
  }
  return context;
}
