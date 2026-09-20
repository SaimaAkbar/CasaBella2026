import { Injectable, Logger } from '@nestjs/common';
import { execFile } from 'node:child_process';
import { unlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import {
  buildEscPosPayload,
  buildTestEscPosPayload,
} from './escpos-receipt.builder';
import type { ThermalReceiptDto } from './receipt.mapper';

const execFileAsync = promisify(execFile);

/** Windows spooler names seen for Speed X SP 200 and similar 80mm printers. */
export const RECEIPT_PRINTER_CANDIDATES = [
  'POS-80',
  'POS80 Printer',
  'Speed X SP 200',
  'Speed-X SP 200',
  'SP200',
] as const;

@Injectable()
export class LocalPrinterService {
  private readonly logger = new Logger(LocalPrinterService.name);

  isSupported() {
    return process.platform === 'win32';
  }

  async listWindowsPrinters(): Promise<string[]> {
    if (!this.isSupported()) return [];

    const { stdout } = await execFileAsync(
      'powershell',
      [
        '-NoProfile',
        '-ExecutionPolicy',
        'Bypass',
        '-Command',
        "Get-Printer | Select-Object -ExpandProperty Name",
      ],
      { windowsHide: true },
    );

    return stdout
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
  }

  async resolvePrinterName(configured?: string | null): Promise<string> {
    const preferred = configured?.trim();
    const installed = await this.listWindowsPrinters();

    if (preferred && installed.includes(preferred)) {
      return preferred;
    }

    for (const candidate of RECEIPT_PRINTER_CANDIDATES) {
      if (installed.includes(candidate)) return candidate;
    }

    const scored = installed
      .map((name) => ({ name, score: this.scorePrinter(name) }))
      .filter((item) => item.score > 0)
      .sort((left, right) => right.score - left.score);

    if (scored[0]) return scored[0].name;

    return preferred || 'POS-80';
  }

  private scorePrinter(name: string) {
    const lower = name.toLowerCase();
    if (/pdf|xps|onenote|fax|anydesk|adobe|microsoft print/i.test(lower)) {
      return -100;
    }
    if (lower === 'pos-80') return 120;
    if (lower.includes('speed') && lower.includes('200')) return 115;
    if (lower.includes('pos80') || lower.includes('pos-80')) return 110;
    if (/pos|thermal|receipt|sp.?200|80mm/i.test(lower)) return 100;
    return 0;
  }

  async printReceipt(
    receipt: ThermalReceiptDto,
    options?: { printerName?: string; autoCut?: boolean },
  ): Promise<{ printerName: string }> {
    const payload = buildEscPosPayload(receipt, options?.autoCut !== false);
    const printerName = await this.resolvePrinterName(options?.printerName);
    await this.sendRaw(printerName, payload);
    return { printerName };
  }

  async printTest(options?: {
    printerName?: string;
    businessName?: string;
    autoCut?: boolean;
  }) {
    const payload = buildTestEscPosPayload(
      options?.businessName ?? 'CASA BELLA',
      options?.autoCut !== false,
    );
    const printerName = await this.resolvePrinterName(options?.printerName);
    await this.sendRaw(printerName, payload);
    return { printerName };
  }

  private async sendRaw(printerName: string, data: Buffer) {
    if (!this.isSupported()) {
      throw new Error('Direct thermal printing requires Windows on this server PC.');
    }

    const tempFile = join(
      tmpdir(),
      `casa-bella-receipt-${Date.now()}-${Math.random().toString(36).slice(2)}.bin`,
    );

    await writeFile(tempFile, data);

    const escapedPrinter = printerName.replace(/'/g, "''");
    const escapedFile = tempFile.replace(/'/g, "''");

    const script = `
$ErrorActionPreference = 'Stop'
$printer = '${escapedPrinter}'
$file = '${escapedFile}'
$bytes = [System.IO.File]::ReadAllBytes($file)
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public class RawPrinterHelper {
  [StructLayout(LayoutKind.Sequential, CharSet=CharSet.Unicode)]
  public struct DOCINFOW {
    [MarshalAs(UnmanagedType.LPWStr)] public string pDocName;
    [MarshalAs(UnmanagedType.LPWStr)] public string pOutputFile;
    [MarshalAs(UnmanagedType.LPWStr)] public string pDataType;
  }
  [DllImport("winspool.drv", CharSet=CharSet.Unicode, SetLastError=true)]
  public static extern bool OpenPrinter(string pPrinterName, out IntPtr phPrinter, IntPtr pDefault);
  [DllImport("winspool.drv", SetLastError=true)]
  public static extern bool ClosePrinter(IntPtr hPrinter);
  [DllImport("winspool.drv", CharSet=CharSet.Unicode, SetLastError=true)]
  public static extern bool StartDocPrinter(IntPtr hPrinter, int Level, ref DOCINFOW pDocInfo);
  [DllImport("winspool.drv", SetLastError=true)]
  public static extern bool EndDocPrinter(IntPtr hPrinter);
  [DllImport("winspool.drv", SetLastError=true)]
  public static extern bool StartPagePrinter(IntPtr hPrinter);
  [DllImport("winspool.drv", SetLastError=true)]
  public static extern bool EndPagePrinter(IntPtr hPrinter);
  [DllImport("winspool.drv", SetLastError=true)]
  public static extern bool WritePrinter(IntPtr hPrinter, IntPtr pBytes, int dwCount, out int dwWritten);
  public static bool SendBytesToPrinter(string printerName, byte[] bytes) {
    IntPtr hPrinter;
    if (!OpenPrinter(printerName, out hPrinter, IntPtr.Zero)) return false;
    DOCINFOW di = new DOCINFOW();
    di.pDocName = "Casa Bella Receipt";
    di.pDataType = "RAW";
    if (!StartDocPrinter(hPrinter, 1, ref di)) { ClosePrinter(hPrinter); return false; }
    StartPagePrinter(hPrinter);
    IntPtr pUnmanagedBytes = Marshal.AllocCoTaskMem(bytes.Length);
    Marshal.Copy(bytes, 0, pUnmanagedBytes, bytes.Length);
    int dwWritten;
    WritePrinter(hPrinter, pUnmanagedBytes, bytes.Length, out dwWritten);
    Marshal.FreeCoTaskMem(pUnmanagedBytes);
    EndPagePrinter(hPrinter);
    EndDocPrinter(hPrinter);
    ClosePrinter(hPrinter);
    return true;
  }
}
"@
$ok = [RawPrinterHelper]::SendBytesToPrinter($printer, $bytes)
if (-not $ok) { throw "Unable to send receipt to printer '$printer'." }
`;

    try {
      await execFileAsync(
        'powershell',
        ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', script],
        { windowsHide: true, maxBuffer: 10 * 1024 * 1024 },
      );
    } catch (error) {
      this.logger.error(
        `Failed to print on ${printerName}`,
        error instanceof Error ? error.stack : String(error),
      );
      throw new Error(
        `Unable to print on ${printerName}. Check USB cable and that Speed X SP 200 is powered on.`,
      );
    } finally {
      await unlink(tempFile).catch(() => undefined);
    }
  }
}
