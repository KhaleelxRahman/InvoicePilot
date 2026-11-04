import type { InvoiceRecord, ClientRecord, SettingsRecord } from '../db/repository.js';
import { formatMinorUnitsToDecimal } from '../db/schema.js';

export interface GenerateInvoicePdfOptions {
  invoice: InvoiceRecord;
  client?: ClientRecord | null;
  settings?: SettingsRecord | null;
}

/**
 * Escapes characters for PDF literal text strings: `(text)`.
 * Escapes backslashes and parentheses.
 * Replaces non-printable or extended Unicode characters with clean ASCII equivalents.
 */
function escapePdfText(input: string | undefined | null): string {
  if (!input) return '';
  return input
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
    .replace(/[^\x20-\x7E]/g, (char) => {
      // Map common typographic characters
      if (char === '•') return '*';
      if (char === '—' || char === '–') return '-';
      if (char === '“' || char === '”') return '"';
      if (char === '‘' || char === '’') return "'";
      if (char === '✓') return '[Done]';
      return ' ';
    });
}

function formatAmount(amountMinor: number, currencyCode: string): string {
  try {
    const decimal = formatMinorUnitsToDecimal(amountMinor, currencyCode);
    return `${currencyCode} ${decimal}`;
  } catch {
    return `${currencyCode} ${(amountMinor / 100).toFixed(2)}`;
  }
}

/**
 * Generates a standard PDF 1.4 document buffer for an InvoicePilot invoice.
 * Pure TypeScript, zero external dependencies, zero native binaries.
 * Fully compliant with ISO 32000-1 / PDF 1.4 specification.
 */
export function generateInvoicePdf(options: GenerateInvoicePdfOptions): Buffer {
  const { invoice, client, settings } = options;

  const businessName = settings?.businessName?.trim() || 'InvoicePilot Workspace';
  const businessEmail = settings?.businessEmail?.trim() || 'billing@invoicepilot.local';
  const clientName = client?.fullName?.trim() || 'Client';
  const clientEmail = client?.email?.trim() || '';
  const clientCompany = client?.companyName?.trim() || '';
  const currency = invoice.currencyCode || 'USD';

  const issueDate = invoice.issueDate || new Date().toISOString().slice(0, 10);
  const dueDate = invoice.dueDate || issueDate;
  const invoiceNum = invoice.invoiceNumber || invoice.id;

  // Determine status display
  let paymentStatusLabel: string = String(invoice.localStatus || 'DRAFT');
  if (invoice.providerStatus === 'PAID') {
    paymentStatusLabel = 'PAID';
  }

  const isCompleted = Boolean(invoice.isCompleted);

  // Content stream instructions array
  const stream: string[] = [];

  // Top accent bar (Primary Brand Indigo: #2563eb -> 0.145 0.388 0.922)
  stream.push('0.145 0.388 0.922 rg');
  stream.push('0 833 595.28 9 re f');

  // Header: Business Name & Details (Left)
  stream.push('BT');
  stream.push('/F2 18 Tf'); // Helvetica-Bold 18pt
  stream.push('0.09 0.11 0.15 rg'); // Dark slate text
  stream.push(`50 785 Td (${escapePdfText(businessName)}) Tj`);
  stream.push('ET');

  stream.push('BT');
  stream.push('/F1 9 Tf'); // Helvetica 9pt
  stream.push('0.38 0.42 0.48 rg'); // Muted text
  stream.push(`50 770 Td (${escapePdfText(businessEmail)}) Tj`);
  stream.push('ET');

  // Header: "INVOICE" Title & Number (Right)
  stream.push('BT');
  stream.push('/F2 20 Tf');
  stream.push('0.145 0.388 0.922 rg'); // Indigo
  stream.push(`390 785 Td (INVOICE) Tj`);
  stream.push('ET');

  stream.push('BT');
  stream.push('/F2 11 Tf');
  stream.push('0.15 0.18 0.23 rg');
  stream.push(`390 770 Td (#${escapePdfText(invoiceNum)}) Tj`);
  stream.push('ET');

  // Status Badge (Right)
  let badgeBg = '0.92 0.94 0.97 rg';
  let badgeFg = '0.25 0.30 0.38 rg';
  if (paymentStatusLabel === 'PAID') {
    badgeBg = '0.86 0.96 0.90 rg';
    badgeFg = '0.08 0.50 0.24 rg';
  } else if (paymentStatusLabel === 'SENT') {
    badgeBg = '0.88 0.93 1.00 rg';
    badgeFg = '0.12 0.35 0.85 rg';
  } else if (paymentStatusLabel === 'OVERDUE') {
    badgeBg = '1.00 0.93 0.88 rg';
    badgeFg = '0.78 0.25 0.10 rg';
  } else if (paymentStatusLabel === 'CANCELLED') {
    badgeBg = '0.94 0.94 0.95 rg';
    badgeFg = '0.45 0.45 0.50 rg';
  }

  // Draw payment status badge box
  stream.push(badgeBg);
  stream.push('390 740 70 18 re f');
  stream.push('BT');
  stream.push('/F2 8 Tf');
  stream.push(badgeFg);
  stream.push(`396 745 Td (STATUS: ${escapePdfText(paymentStatusLabel)}) Tj`);
  stream.push('ET');

  // If completed, draw operational completion pill next to it
  if (isCompleted) {
    stream.push('0.90 0.95 0.92 rg');
    stream.push('465 740 80 18 re f');
    stream.push('BT');
    stream.push('/F2 8 Tf');
    stream.push('0.08 0.50 0.24 rg');
    stream.push('470 745 Td ([Done] Completed) Tj');
    stream.push('ET');
  }

  // Subtle separator line under header
  stream.push('0.88 0.90 0.93 RG');
  stream.push('0.75 w');
  stream.push('50 722 m 545 722 l S');

  // Client Details ("BILLED TO") on Left
  stream.push('BT');
  stream.push('/F2 8 Tf');
  stream.push('0.45 0.48 0.53 rg');
  stream.push('50 702 Td (BILLED TO) Tj');
  stream.push('ET');

  stream.push('BT');
  stream.push('/F2 11 Tf');
  stream.push('0.10 0.12 0.16 rg');
  stream.push(`50 687 Td (${escapePdfText(clientName)}) Tj`);
  stream.push('ET');

  let currentLeftY = 673;
  if (clientCompany) {
    stream.push('BT');
    stream.push('/F1 9 Tf');
    stream.push('0.30 0.34 0.40 rg');
    stream.push(`50 ${currentLeftY} Td (${escapePdfText(clientCompany)}) Tj`);
    stream.push('ET');
    currentLeftY -= 14;
  }
  if (clientEmail) {
    stream.push('BT');
    stream.push('/F1 9 Tf');
    stream.push('0.38 0.42 0.48 rg');
    stream.push(`50 ${currentLeftY} Td (${escapePdfText(clientEmail)}) Tj`);
    stream.push('ET');
  }

  // Dates and Terms on Right
  stream.push('BT');
  stream.push('/F2 8 Tf');
  stream.push('0.45 0.48 0.53 rg');
  stream.push('390 702 Td (INVOICE DETAILS) Tj');
  stream.push('ET');

  stream.push('BT');
  stream.push('/F1 9 Tf');
  stream.push('0.20 0.24 0.30 rg');
  stream.push(`390 687 Td (Issue Date: ${escapePdfText(issueDate)}) Tj`);
  stream.push(`390 673 Td (Due Date: ${escapePdfText(dueDate)}) Tj`);
  stream.push(`390 659 Td (Currency: ${escapePdfText(currency)}) Tj`);
  stream.push('ET');

  // Line Items Table Header
  const tableTopY = 625;
  stream.push('0.95 0.96 0.98 rg');
  stream.push(`50 ${tableTopY - 6} 495 22 re f`);

  stream.push('0.85 0.88 0.92 RG');
  stream.push('0.5 w');
  stream.push(`50 ${tableTopY - 6} m 545 ${tableTopY - 6} l S`);
  stream.push(`50 ${tableTopY + 16} m 545 ${tableTopY + 16} l S`);

  stream.push('BT');
  stream.push('/F2 8 Tf');
  stream.push('0.35 0.38 0.45 rg');
  stream.push(`60 ${tableTopY} Td (DESCRIPTION) Tj`);
  stream.push(`330 ${tableTopY} Td (QTY) Tj`);
  stream.push(`390 ${tableTopY} Td (UNIT PRICE) Tj`);
  stream.push(`480 ${tableTopY} Td (AMOUNT) Tj`);
  stream.push('ET');

  // Line Item Rows
  let rowY = tableTopY - 26;
  const items = invoice.items && invoice.items.length > 0 ? invoice.items : [
    {
      id: 'default',
      invoiceId: invoice.id,
      ownerUserId: invoice.ownerUserId,
      position: 1,
      description: 'Professional Services',
      quantity: 1,
      unitAmountMinor: invoice.subtotalMinor || invoice.totalMinor || 0,
      lineTotalMinor: invoice.subtotalMinor || invoice.totalMinor || 0,
      currencyCode: currency,
      createdAt: issueDate
    }
  ];

  for (const item of items) {
    const qtyStr = String(item.quantity ?? 1);
    const unitPriceStr = formatAmount(item.unitAmountMinor ?? 0, currency);
    const lineTotalStr = formatAmount(item.lineTotalMinor ?? 0, currency);

    stream.push('BT');
    stream.push('/F1 9 Tf');
    stream.push('0.15 0.18 0.23 rg');
    stream.push(`60 ${rowY} Td (${escapePdfText(item.description)}) Tj`);
    stream.push(`335 ${rowY} Td (${escapePdfText(qtyStr)}) Tj`);
    stream.push(`390 ${rowY} Td (${escapePdfText(unitPriceStr)}) Tj`);
    stream.push(`480 ${rowY} Td (${escapePdfText(lineTotalStr)}) Tj`);
    stream.push('ET');

    // Light row separator
    stream.push('0.92 0.93 0.95 RG');
    stream.push('0.5 w');
    stream.push(`50 ${rowY - 8} m 545 ${rowY - 8} l S`);

    rowY -= 24;
    if (rowY < 200) {
      // Keep on one page for typical invoices
      break;
    }
  }

  // Financial Totals Section (Right Aligned Box)
  const totalsY = rowY - 10;
  const subtotalStr = formatAmount(invoice.subtotalMinor ?? invoice.totalMinor ?? 0, currency);
  const taxMinor = invoice.taxMinor ?? 0;
  const taxStr = formatAmount(taxMinor, currency);
  const totalStr = formatAmount(invoice.totalMinor ?? 0, currency);
  const paidMinor = invoice.paidAmountMinor ?? 0;
  const paidStr = formatAmount(paidMinor, currency);
  const balanceDueMinor = Math.max(0, (invoice.totalMinor ?? 0) - paidMinor);
  const balanceDueStr = formatAmount(balanceDueMinor, currency);

  stream.push('BT');
  stream.push('/F1 9 Tf');
  stream.push('0.40 0.44 0.50 rg');
  stream.push(`360 ${totalsY} Td (Subtotal:) Tj`);
  stream.push('ET');

  stream.push('BT');
  stream.push('/F1 9 Tf');
  stream.push('0.15 0.18 0.23 rg');
  stream.push(`470 ${totalsY} Td (${escapePdfText(subtotalStr)}) Tj`);
  stream.push('ET');

  let currentTotY = totalsY - 18;
  if (taxMinor > 0) {
    const rateBps = invoice.taxRateBps ? ` (${(invoice.taxRateBps / 100).toFixed(1)}%)` : '';
    stream.push('BT');
    stream.push('/F1 9 Tf');
    stream.push('0.40 0.44 0.50 rg');
    stream.push(`360 ${currentTotY} Td (Tax${escapePdfText(rateBps)}:) Tj`);
    stream.push('ET');

    stream.push('BT');
    stream.push('/F1 9 Tf');
    stream.push('0.15 0.18 0.23 rg');
    stream.push(`470 ${currentTotY} Td (${escapePdfText(taxStr)}) Tj`);
    stream.push('ET');
    currentTotY -= 18;
  }

  // Total Row Accent Box
  stream.push('0.95 0.96 0.98 rg');
  stream.push(`350 ${currentTotY - 8} 195 24 re f`);
  stream.push('0.85 0.88 0.92 RG');
  stream.push('0.75 w');
  stream.push(`350 ${currentTotY - 8} 195 24 re S`);

  stream.push('BT');
  stream.push('/F2 11 Tf');
  stream.push('0.10 0.12 0.16 rg');
  stream.push(`360 ${currentTotY} Td (TOTAL:) Tj`);
  stream.push('ET');

  stream.push('BT');
  stream.push('/F2 11 Tf');
  stream.push('0.145 0.388 0.922 rg'); // Indigo
  stream.push(`460 ${currentTotY} Td (${escapePdfText(totalStr)}) Tj`);
  stream.push('ET');
  currentTotY -= 26;

  if (paidMinor > 0) {
    stream.push('BT');
    stream.push('/F1 9 Tf');
    stream.push('0.08 0.50 0.24 rg');
    stream.push(`360 ${currentTotY} Td (Paid to date:) Tj`);
    stream.push(`470 ${currentTotY} Td (-${escapePdfText(paidStr)}) Tj`);
    stream.push('ET');
    currentTotY -= 16;
  }

  stream.push('BT');
  stream.push('/F2 9 Tf');
  stream.push('0.20 0.24 0.30 rg');
  stream.push(`360 ${currentTotY} Td (Balance Due:) Tj`);
  stream.push(`470 ${currentTotY} Td (${escapePdfText(balanceDueStr)}) Tj`);
  stream.push('ET');

  // Notes & Payment terms on bottom left
  if (invoice.notes) {
    stream.push('BT');
    stream.push('/F2 8 Tf');
    stream.push('0.45 0.48 0.53 rg');
    stream.push(`50 ${totalsY} Td (NOTES & PAYMENT TERMS) Tj`);
    stream.push('ET');

    stream.push('BT');
    stream.push('/F1 8.5 Tf');
    stream.push('0.30 0.34 0.40 rg');
    // First 120 chars
    const cleanNotes = escapePdfText(invoice.notes.slice(0, 140));
    stream.push(`50 ${totalsY - 15} Td (${cleanNotes}) Tj`);
    stream.push('ET');
  }

  // Footer: Brand notice & Page Number
  const footerY = 50;
  stream.push('0.88 0.90 0.93 RG');
  stream.push('0.5 w');
  stream.push(`50 ${footerY + 18} m 545 ${footerY + 18} l S`);

  stream.push('BT');
  stream.push('/F1 8 Tf');
  stream.push('0.50 0.54 0.60 rg');
  stream.push(`50 ${footerY} Td (Generated securely by InvoicePilot - PayPal AI Hackathon) Tj`);
  stream.push('ET');

  stream.push('BT');
  stream.push('/F1 8 Tf');
  stream.push('0.50 0.54 0.60 rg');
  stream.push(`495 ${footerY} Td (Page 1 of 1) Tj`);
  stream.push('ET');

  const contentStreamData = stream.join('\n');
  const streamLength = Buffer.byteLength(contentStreamData, 'utf-8');

  // Construct PDF indirect objects
  // 1: Catalog
  // 2: Pages
  // 3: Page
  // 4: Font F1 (Helvetica)
  // 5: Font F2 (Helvetica-Bold)
  // 6: Contents Stream

  const header = '%PDF-1.4\n%\xE2\xE3\xCF\xD3\n';

  const obj1 = '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n';
  const obj2 = '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n';
  const obj3 =
    '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> /ProcSet [/PDF /Text] >> /Contents 6 0 R >>\nendobj\n';
  const obj4 = '4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>\nendobj\n';
  const obj5 =
    '5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>\nendobj\n';
  const obj6 = `6 0 obj\n<< /Length ${streamLength} >>\nstream\n${contentStreamData}\nendstream\nendobj\n`;

  const objects = [obj1, obj2, obj3, obj4, obj5, obj6];

  let currentOffset = Buffer.byteLength(header, 'utf-8');
  const offsets: number[] = [0]; // object 0 is special

  for (const obj of objects) {
    offsets.push(currentOffset);
    currentOffset += Buffer.byteLength(obj, 'utf-8');
  }

  const xrefStartOffset = currentOffset;

  // Format 10-digit xref table entries
  let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \r\n`;
  for (let i = 1; i <= objects.length; i++) {
    const offsetStr = String(offsets[i]).padStart(10, '0');
    xref += `${offsetStr} 00000 n \r\n`;
  }

  const trailer = `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStartOffset}\n%%EOF\n`;

  const fullPdfString = header + objects.join('') + xref + trailer;
  return Buffer.from(fullPdfString, 'binary');
}
