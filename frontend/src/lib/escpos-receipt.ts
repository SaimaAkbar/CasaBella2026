import type { ThermalReceipt } from '../types/receipt';
import { formatPkr } from './format';

const LINE_WIDTH = 42;
const SEPARATOR = '-'.repeat(LINE_WIDTH);

const ESC = '\x1B';
const GS = '\x1D';

function initPrinter() {
  return `${ESC}@`;
}

function align(mode: 'left' | 'center' | 'right') {
  const n = mode === 'center' ? 1 : mode === 'right' ? 2 : 0;
  return `${ESC}a${String.fromCharCode(n)}`;
}

function bold(on: boolean) {
  return `${ESC}E${on ? '\x01' : '\x00'}`;
}

function feed(lines: number) {
  return `${ESC}d${String.fromCharCode(lines)}`;
}

function partialCut() {
  return `${GS}V\x01`;
}

function padLine(label: string, value: string) {
  const gap = LINE_WIDTH - label.length - value.length;
  if (gap >= 1) return `${label}${' '.repeat(gap)}${value}`;
  return `${label} ${value}`;
}

function money(value: string) {
  return `Rs. ${formatPkr(value).replace(/^PKR\s?/i, '').trim()}`;
}

function formatStayDate(value: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function statusBanner(receipt: ThermalReceipt) {
  if (receipt.paymentStatusLabel === 'FULLY PAID') {
    return `${bold(true)}FULLY PAID${bold(false)}`;
  }
  return `${bold(true)}${receipt.paymentStatusLabel}${bold(false)}`;
}

export function buildReceiptLines(receipt: ThermalReceipt): string[] {
  const lines: string[] = [];

  if (receipt.isReprint && receipt.copyLabel) {
    lines.push(`*** ${receipt.copyLabel} ***`);
  }

  lines.push(receipt.businessName);
  lines.push(receipt.businessSubtitle);
  lines.push('');
  lines.push(
    receipt.paymentStatusLabel === 'FULLY PAID'
      ? 'PAYMENT RECEIPT'
      : 'BILL / RECEIPT',
  );
  lines.push('');
  lines.push(`Receipt No: ${receipt.receiptNumber}`);
  lines.push(`Date: ${receipt.paymentDate}`);
  lines.push(`Time: ${receipt.paymentTime}`);
  lines.push(SEPARATOR);
  lines.push(`Customer: ${receipt.customerName}`);
  lines.push(`Room: ${receipt.room}`);
  lines.push(`Property: ${receipt.property}`);
  lines.push(SEPARATOR);
  lines.push(`Payment Type: ${receipt.paymentTypeLabel}`);

  if (receipt.billingMonth) {
    lines.push(`Billing Month: ${receipt.billingMonth}`);
  }

  if (receipt.receiptType === 'DAILY_GUEST' || receipt.receiptType === 'HOURLY_GUEST') {
    lines.push(`Check-In: ${formatStayDate(receipt.checkInDateTime)}`);
    lines.push(`Check-Out: ${formatStayDate(receipt.checkOutDateTime)}`);
    lines.push(`Booking Type: ${receipt.bookingType ?? '—'}`);
    if (receipt.stayLabel) lines.push(`Stay: ${receipt.stayLabel}`);
    if (receipt.roomCharges) {
      lines.push(padLine('Room Charges:', money(receipt.roomCharges)));
    }
    if (receipt.otherAmenities && Number(receipt.otherAmenities) > 0) {
      lines.push(padLine('Other Amenities:', money(receipt.otherAmenities)));
    }
  }

  if (receipt.receiptType === 'MONTHLY_RENT') {
    lines.push(padLine('Monthly Rent:', money(receipt.totalBill)));
    lines.push(
      padLine('Previous Outstanding:', money(receipt.previousOutstanding)),
    );
    lines.push(padLine('Current Payment:', money(receipt.currentPayment)));
  }

  if (receipt.receiptType === 'ELECTRICITY') {
    if (receipt.electricityBill) {
      lines.push(padLine('Electricity Bill:', money(receipt.electricityBill)));
    }
    if (receipt.lateFine) {
      lines.push(padLine('Late Fine:', money(receipt.lateFine)));
    }
    lines.push(padLine('Total Payable:', money(receipt.totalBill)));
    lines.push(padLine('Current Payment:', money(receipt.currentPayment)));
  }

  if (
    receipt.receiptType !== 'MONTHLY_RENT' &&
    receipt.receiptType !== 'ELECTRICITY'
  ) {
    lines.push(padLine('Total Bill:', money(receipt.totalBill)));
    lines.push(padLine('Current Payment:', money(receipt.currentPayment)));
  }

  lines.push(SEPARATOR);
  lines.push(padLine('Total Paid:', money(receipt.totalPaid)));
  lines.push(padLine('Remaining:', money(receipt.remainingBalance)));
  lines.push(statusBanner(receipt));
  lines.push(SEPARATOR);
  lines.push(`Payment Method: ${receipt.paymentMethod}`);
  lines.push(`Received By: ${receipt.receivedBy}`);
  lines.push('');
  lines.push(receipt.footer || 'Thank You');

  return lines;
}

export function buildEscPosPayload(
  receipt: ThermalReceipt,
  autoCut = true,
): string[] {
  const chunks: string[] = [initPrinter(), align('center'), bold(true)];

  for (const line of buildReceiptLines(receipt)) {
    if (line.startsWith('***') || line === receipt.businessName) {
      chunks.push(align('center'), bold(true), line, '\n', bold(false));
      continue;
    }
    if (line === receipt.businessSubtitle) {
      chunks.push(align('center'), bold(true), line, '\n', bold(false));
      continue;
    }
    if (line === 'PAYMENT RECEIPT' || line === 'BILL / RECEIPT') {
      chunks.push(align('center'), bold(true), line, '\n', bold(false));
      continue;
    }
    if (
      line.includes('FULLY PAID') ||
      line.includes('PARTIAL PAYMENT') ||
      line.includes('OUTSTANDING')
    ) {
      chunks.push(align('center'), bold(true), line, '\n', bold(false), align('left'));
      continue;
    }
    if (line === SEPARATOR) {
      chunks.push(align('left'), line, '\n');
      continue;
    }
    chunks.push(align('left'), line, '\n');
  }

  chunks.push(align('center'), feed(4));
  if (autoCut) chunks.push(partialCut());
  return chunks;
}

export function buildTestReceiptPayload(businessName: string, autoCut = true) {
  const now = new Date();
  const receipt: ThermalReceipt = {
    sourceType: 'payment',
    sourceId: 'test',
    receiptNumber: 'TEST',
    receiptType: 'MONTHLY_RENT',
    isReprint: false,
    copyLabel: null,
    businessName: 'CASA BELLA',
    businessSubtitle: 'HOTEL & RESIDENCES',
    paymentNumber: 'TEST',
    paymentDate: now.toLocaleDateString('en-GB'),
    paymentTime: now.toLocaleTimeString('en-GB'),
    customerName: '—',
    room: '—',
    property: '—',
    paymentTypeLabel: 'PRINTER TEST',
    billingMonth: null,
    checkInDateTime: null,
    checkOutDateTime: null,
    bookingType: null,
    stayLabel: null,
    roomCharges: null,
    otherAmenities: null,
    electricityBill: null,
    lateFine: null,
    totalBill: '0',
    previousOutstanding: '0',
    currentPayment: '0',
    totalPaid: '0',
    remainingBalance: '0',
    paymentStatusLabel: 'FULLY PAID',
    paymentMethod: '—',
    receivedBy: '—',
    footer: 'Printer Test Successful',
    printCount: 0,
    lastPrintedAt: null,
    notes: null,
  };

  const lines = [
    initPrinter(),
    align('center'),
    bold(true),
    receipt.businessName,
    '\n',
    bold(false),
    'Printer Test Successful',
    '\n',
    now.toLocaleString('en-GB'),
    '\n',
    feed(4),
  ];
  if (autoCut) lines.push(partialCut());
  return lines;
}
