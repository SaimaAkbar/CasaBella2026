import qz from 'qz-tray';
import type { ThermalReceipt } from '../types/receipt';
import { buildEscPosPayload, buildTestReceiptPayload } from '../lib/escpos-receipt';
import {
  normalizePrinterList,
  pickBestReceiptPrinter,
} from '../lib/qz-printer-select';
import { initializeQzSecurity } from '../lib/qz-setup';
import { connectQzTray, formatQzConnectionHelp, withQzConnection } from '../lib/qz-connect';

export type PrinterConnectionStatus =
  | 'ready'
  | 'disconnected'
  | 'error';

type StatusListener = (status: PrinterConnectionStatus, message?: string) => void;

class ReceiptPrinterService {
  private status: PrinterConnectionStatus = 'disconnected';
  private statusMessage = 'QZ not installed · Browser print available';
  private listeners = new Set<StatusListener>();
  private preferredPrinter = '';
  private sessionFallbackPrinter = '';
  private activePrinterName = '';
  private securityInitialized = false;
  private tokenGetter: (() => string | null) | null = null;
  private operationChain: Promise<unknown> = Promise.resolve();

  private runExclusive<T>(task: () => Promise<T>): Promise<T> {
    const next = this.operationChain.then(task, task);
    this.operationChain = next.then(
      () => undefined,
      () => undefined,
    );
    return next;
  }

  setTokenGetter(getter: () => string | null) {
    this.tokenGetter = getter;
  }

  private authToken() {
    return this.tokenGetter?.() ?? null;
  }

  subscribe(listener: StatusListener) {
    this.listeners.add(listener);
    listener(this.status, this.statusMessage);
    return () => {
      this.listeners.delete(listener);
    };
  }

  getStatus() {
    return { status: this.status, message: this.statusMessage };
  }

  getActivePrinterName() {
    return (
      this.activePrinterName ||
      this.configuredPrinterName() ||
      this.sessionFallbackPrinter
    );
  }

  setPreferredPrinter(name: string) {
    this.preferredPrinter = name;
    if (name.trim()) {
      this.activePrinterName = name.trim();
    }
  }

  getPreferredPrinter() {
    return this.preferredPrinter;
  }

  private setStatus(status: PrinterConnectionStatus, message?: string) {
    this.status = status;
    if (message) this.statusMessage = message;
    this.listeners.forEach((listener) =>
      listener(this.status, this.statusMessage),
    );
  }

  private readyMessage(printerName: string) {
    return `Printer Ready (${printerName})`;
  }

  async ensureSecurity() {
    if (this.securityInitialized) return;
    this.securityInitialized = true;
    await initializeQzSecurity(() => this.authToken());
  }

  isConnected() {
    return qz.websocket.isActive();
  }

  async connect(): Promise<void> {
    return this.runExclusive(async () => {
      await this.ensureSecurity();

      try {
        await connectQzTray();
        const name = this.getActivePrinterName();
        this.setStatus(
          'ready',
          name ? this.readyMessage(name) : 'Printer Ready',
        );
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : formatQzConnectionHelp('QZ Tray Not Connected');
        this.setStatus('disconnected', 'QZ not installed · Browser print available');
        throw new Error(message);
      }
    });
  }

  async disconnect(): Promise<void> {
    return this.runExclusive(async () => {
      if (!qz.websocket.isActive()) return;
      try {
        await qz.websocket.disconnect();
      } finally {
        this.setStatus('disconnected', 'QZ not installed · Browser print available');
      }
    });
  }

  private async fetchPrinterList(): Promise<string[]> {
    await this.ensureSecurity();
    return withQzConnection(async () => {
      const printers = await qz.printers.find();
      return normalizePrinterList(printers);
    });
  }

  async listPrinters(): Promise<string[]> {
    return this.runExclusive(() => this.fetchPrinterList());
  }

  private configuredPrinterName(explicit?: string) {
    return explicit?.trim() || this.preferredPrinter.trim();
  }

  async resolvePrinterName(explicit?: string): Promise<string> {
    const configured = this.configuredPrinterName(explicit);
    if (configured) {
      this.activePrinterName = configured;
      return configured;
    }
    if (this.sessionFallbackPrinter) {
      this.activePrinterName = this.sessionFallbackPrinter;
      return this.sessionFallbackPrinter;
    }

    await this.ensureSecurity();
    await connectQzTray();
    const printers = await this.fetchPrinterList();
    const best = pickBestReceiptPrinter(printers);

    if (!best) {
      throw new Error(
        'No suitable receipt printer found. In Settings → Receipt Printer, detect printers and select your thermal POS printer (not Microsoft Print to PDF).',
      );
    }

    this.sessionFallbackPrinter = best;
    this.activePrinterName = best;
    this.setStatus('ready', this.readyMessage(best));
    return best;
  }

  async warmUpFallbackPrinter() {
    if (this.configuredPrinterName()) return this.preferredPrinter;
    return this.resolvePrinterName();
  }

  async getPrintOptions(options?: { printerName?: string; autoCut?: boolean }) {
    const printerName = await this.resolvePrinterName(options?.printerName);
    return {
      printerName,
      autoCut: options?.autoCut !== false,
    };
  }

  private async printRaw(data: string[], printerName: string) {
    return withQzConnection(async () => {
      const config = qz.configs.create(printerName, {
        encoding: 'UTF-8',
      });

      try {
        await qz.print(config, [
          {
            type: 'raw',
            format: 'command',
            flavor: 'plain',
            data: data.join(''),
          },
        ]);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Unable to send print job.';
        if (/sendData is not a function|not been established/i.test(message)) {
          throw new Error(
            'QZ Tray lost its printer connection. Refresh the page, wait for Printer Ready, then try again.',
          );
        }
        if (/denied|blocked|unsigned|certificate|sign/i.test(message)) {
          throw new Error(
            `${message} Click Allow on the QZ Tray security popup, then try again.`,
          );
        }
        throw err instanceof Error ? err : new Error(message);
      }

      this.activePrinterName = printerName;
      this.setStatus('ready', this.readyMessage(printerName));
    });
  }

  async printReceipt(
    receipt: ThermalReceipt,
    options?: { printerName?: string; autoCut?: boolean },
  ) {
    return this.runExclusive(async () => {
      const { printerName, autoCut } = await this.getPrintOptions(options);
      try {
        const payload = buildEscPosPayload(receipt, autoCut);
        await this.printRaw(payload, printerName);
        return printerName;
      } catch (err) {
        this.setStatus(
          'error',
          err instanceof Error ? err.message : 'Printer Error',
        );
        throw err;
      }
    });
  }

  async printTest(
    options?: { printerName?: string; businessName?: string; autoCut?: boolean },
  ) {
    return this.runExclusive(async () => {
      const { printerName, autoCut } = await this.getPrintOptions(options);
      try {
        const payload = buildTestReceiptPayload(
          options?.businessName ?? 'CASA BELLA',
          autoCut,
        );
        await this.printRaw(payload, printerName);
        return printerName;
      } catch (err) {
        this.setStatus(
          'error',
          err instanceof Error ? err.message : 'Printer Error',
        );
        throw err;
      }
    });
  }
}

export const receiptPrinter = new ReceiptPrinterService();
