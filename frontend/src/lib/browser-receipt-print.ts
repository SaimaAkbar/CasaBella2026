import { buildReceiptLines } from './escpos-receipt';
import type { ThermalReceipt } from '../types/receipt';

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function lineToHtml(receipt: ThermalReceipt, line: string) {
  if (!line) return '<br />';
  if (line.startsWith('-')) return '<div class="sep"></div>';

  const safe = escapeHtml(line);
  if (line === receipt.businessName) {
    return `<p class="center title">${safe}</p>`;
  }
  if (line === receipt.businessSubtitle || line === 'PAYMENT RECEIPT' || line === 'BILL / RECEIPT') {
    return `<p class="center">${safe}</p>`;
  }
  if (line.includes('FULLY PAID') || line.includes('PARTIAL PAYMENT') || line.includes('OUTSTANDING')) {
    return `<p class="status">${safe}</p>`;
  }
  if (line.includes(':') && line.includes('Rs.')) {
    const index = line.indexOf(':');
    const label = escapeHtml(line.slice(0, index + 1));
    const value = escapeHtml(line.slice(index + 1).trim());
    return `<div class="row"><span>${label}</span><strong>${value}</strong></div>`;
  }
  return `<p>${safe}</p>`;
}

export function buildBrowserReceiptHtml(receipt: ThermalReceipt) {
  const body = buildReceiptLines(receipt)
    .map((line) => lineToHtml(receipt, line))
    .join('\n');

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Receipt ${escapeHtml(receipt.receiptNumber)}</title>
    <style>
      @page { size: 80mm auto; margin: 4mm; }
      body {
        font-family: "Courier New", Courier, monospace;
        font-size: 12px;
        line-height: 1.35;
        width: 72mm;
        margin: 0 auto;
        color: #111;
      }
      .center { text-align: center; }
      .title { font-weight: 700; font-size: 14px; }
      .sep { border-top: 1px dashed #111; margin: 6px 0; }
      .row { display: flex; justify-content: space-between; gap: 8px; }
      .status { text-align: center; font-weight: 700; margin: 8px 0; }
      p { margin: 0 0 4px; }
    </style>
  </head>
  <body>${body}</body>
</html>`;
}

function printHtml(html: string) {
  const frame = document.createElement('iframe');
  frame.style.position = 'fixed';
  frame.style.right = '0';
  frame.style.bottom = '0';
  frame.style.width = '0';
  frame.style.height = '0';
  frame.style.border = '0';
  document.body.appendChild(frame);

  const doc = frame.contentDocument;
  const win = frame.contentWindow;
  if (!doc || !win) {
    frame.remove();
    throw new Error('Unable to open print dialog.');
  }

  doc.open();
  doc.write(html);
  doc.close();

  const cleanup = () => {
    window.setTimeout(() => frame.remove(), 500);
  };

  win.focus();
  win.print();
  win.onafterprint = cleanup;
  window.setTimeout(cleanup, 3000);
}

export function printReceiptInBrowser(receipt: ThermalReceipt) {
  const html = buildBrowserReceiptHtml(receipt);

  const popup = window.open('', '_blank', 'width=420,height=720');
  if (popup) {
    popup.document.open();
    popup.document.write(html);
    popup.document.close();
    popup.onload = () => {
      popup.focus();
      popup.print();
    };
    return;
  }

  printHtml(html);
}
