const VIRTUAL_PRINTER_RE =
  /pdf|onenote|fax|xps|document writer|anydesk|remote|microsoft print|send to|snagit|cutepdf|adobe|bullzip|foxit|print to/i;

const THERMAL_PRINTER_RE =
  /pos|receipt|thermal|tm-|tsp|epson|star|bixolon|xprinter|gprinter|rp80|rp326|esc\/pos|80mm|58mm|rpt|zjiang|custom|gainscha|citizen|rongta|hprt|munbyn/i;

export const RECOMMENDED_RECEIPT_PRINTERS = [
  'POS-80',
  'POS80 Printer',
  'Speed X SP 200',
] as const;

export function normalizePrinterList(
  printers: string[] | string,
): string[] {
  const list = Array.isArray(printers) ? printers : [printers];
  return list.map((name) => String(name).trim()).filter(Boolean);
}

function scorePrinter(name: string): number {
  const lower = name.toLowerCase();
  if (VIRTUAL_PRINTER_RE.test(lower)) return -100;
  if (lower === 'pos-80') return 120;
  if (lower === 'pos80 printer') return 115;
  if (lower.includes('speed') && lower.includes('200')) return 118;
  if (THERMAL_PRINTER_RE.test(lower)) return 100;
  if (lower.includes('usb')) return 20;
  return 0;
}

export function pickBestReceiptPrinter(printers: string[]): string | null {
  if (printers.length === 0) return null;

  const ranked = [...printers].sort(
    (left, right) => scorePrinter(right) - scorePrinter(left),
  );

  const thermal = ranked.find((name) => scorePrinter(name) > 0);
  if (thermal) return thermal;

  const nonVirtual = ranked.find((name) => scorePrinter(name) >= 0);
  return nonVirtual ?? null;
}
