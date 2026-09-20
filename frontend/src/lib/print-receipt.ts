import { logReceiptPrint } from '../api/receipts';
import { printReceiptInBrowser } from './browser-receipt-print';
import { isQzConnectionReady } from './qz-connect';
import { receiptPrinter } from '../services/receiptPrinter';
import type { ReceiptPrintTarget, ThermalReceipt } from '../types/receipt';

type PrintResult = {
  mode: 'thermal' | 'browser';
  printerName?: string;
  receipt: ThermalReceipt;
};

type PrintOptions = {
  token: string;
  target: ReceiptPrintTarget;
  printerName?: string;
  autoCut?: boolean;
  preferThermal?: boolean;
};

export async function printReceiptSmart({
  token,
  target,
  printerName = 'POS-80',
  autoCut = true,
  preferThermal = true,
}: PrintOptions): Promise<PrintResult> {
  const receipt = await logReceiptPrint(token, target, printerName);

  if (receipt.physicalPrint?.success) {
    return {
      mode: 'thermal',
      printerName: receipt.physicalPrint.printerName ?? printerName,
      receipt,
    };
  }

  if (receipt.physicalPrint?.attempted) {
    throw new Error(
      receipt.physicalPrint.error ??
        'Unable to print on Speed X SP 200 (POS-80). Check USB and power.',
    );
  }

  if (preferThermal && isQzConnectionReady()) {
    try {
      const printOptions = await receiptPrinter.getPrintOptions({
        printerName,
        autoCut,
      });
      const usedPrinter = await receiptPrinter.printReceipt(
        receipt,
        printOptions,
      );
      return { mode: 'thermal', printerName: usedPrinter, receipt };
    } catch {
      // Fall back to browser print when QZ is unavailable.
    }
  }

  printReceiptInBrowser(receipt);
  return { mode: 'browser', receipt };
}
