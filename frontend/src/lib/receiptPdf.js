/**
 * Real PDF receipt generator using jsPDF + jspdf-autotable.
 *
 * Replaces the previous "open a printable HTML window and ask the user to
 * Save as PDF" flow. We now produce an actual `.pdf` file that downloads
 * directly — single click, no browser print dialog, no double receipts.
 *
 * Layout philosophy:
 *   - A4, portrait, 20mm side margins so it prints cleanly anywhere.
 *   - Brand block + receipt meta on top (two columns).
 *   - "From" / "Billed to" parties in two columns.
 *   - One auto-table line item describing the plan + period + amount.
 *   - A small totals block bottom-right (Subtotal / Tax / Total paid).
 *   - Footer note (sandbox warning when applicable).
 *
 * Public API:
 *   - downloadReceiptPdf({ receipt, buyer, seller })
 *       → triggers a download named `receipt-<orderId>.pdf`.
 *   - fetchAndDownloadReceipt(apiBase, token, historyId)
 *       → convenience: GETs /api/payments/receipt/:historyId then downloads.
 */

import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

// ---------- Formatting helpers (mirrors the old receipt.js helpers) ----------

const fmtDate = (d) => {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString(); } catch { return '—'; }
};

const fmtMoney = (amount, currency) => {
  if (amount == null) return '—';
  const num = Number(amount);
  if (!Number.isFinite(num)) return '—';
  return `${currency || 'USD'} ${num.toFixed(2)}`;
};

// ---------- PDF builder ----------

/**
 * Build the PDF document in memory and return the jsPDF instance so
 * callers can either save it (`doc.save(...)`) or get a Blob.
 */
const buildReceiptPdf = ({ receipt, buyer, seller }) => {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  const contentWidth = pageWidth - margin * 2;

  // ----- Brand Header -----
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(26);
  doc.setTextColor(17, 17, 17);
  doc.text('TRAVIO', margin, 25);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(102, 102, 102);
  doc.text('RECEIPT', margin, 32);

  // Right-aligned receipt meta block
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(60, 60, 60);
  const metaX = pageWidth - margin;
  const metaLines = [
    [`Receipt #`, String(receipt.orderId || '—')],
    [`Issued`, fmtDate(receipt.issuedAt)],
    [`Status`, `${(receipt.status || 'paid').toUpperCase()}${receipt.provider === 'mock' ? ' · SANDBOX' : ''}`]
  ];
  let metaY = 22;
  metaLines.forEach(([label, value]) => {
    doc.setFont('helvetica', 'bold');
    doc.text(label, metaX - doc.getTextWidth(value) - 4, metaY, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    doc.text(value, metaX, metaY, { align: 'right' });
    metaY += 5;
  });

  // Divider under header
  doc.setDrawColor(17, 17, 17);
  doc.setLineWidth(0.6);
  doc.line(margin, 40, pageWidth - margin, 40);

  // ----- Parties: From / Billed to -----
  let y = 50;
  const colWidth = contentWidth / 2;

  const drawParty = (x, title, lines) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(136, 136, 136);
    doc.text(title.toUpperCase(), x, y);

    doc.setTextColor(17, 17, 17);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(lines[0] || '—', x, y + 6);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(60, 60, 60);
    let ly = y + 12;
    lines.slice(1).forEach((line) => {
      if (!line) return;
      doc.text(String(line), x, ly);
      ly += 5;
    });
  };

  drawParty(margin, 'From', [
    seller.name,
    seller.legal,
    seller.address,
    seller.contact
  ]);
  drawParty(margin + colWidth, 'Billed to', [
    buyer.name,
    buyer.email,
    `User ID: ${buyer.id}`
  ]);

  // ----- Line item table -----
  const tableTopY = y + 32;
  const features = (receipt.plan?.features || []).map(
    (f) => receipt.featureLabels?.[f] || f
  );
  const featureLines = features.length
    ? '\nIncludes: ' + features.join(', ')
    : '';
  const planDesc = `${receipt.plan.name} plan` +
    (receipt.plan.description ? `\n${receipt.plan.description}` : '') +
    featureLines;
  const period = `${fmtDate(receipt.periodStart)}\nto ${fmtDate(receipt.periodEnd)}`;

  autoTable(doc, {
    startY: tableTopY,
    margin: { left: margin, right: margin },
    head: [['Description', 'Period', 'Amount']],
    body: [[planDesc, period, fmtMoney(receipt.amount, receipt.currency)]],
    headStyles: {
      fillColor: [250, 250, 250],
      textColor: [102, 102, 102],
      fontStyle: 'bold',
      fontSize: 8.5,
      lineColor: [220, 220, 220],
      lineWidth: 0.2
    },
    bodyStyles: {
      fontSize: 9.5,
      textColor: [40, 40, 40],
      lineColor: [235, 235, 235],
      lineWidth: 0.1,
      valign: 'top'
    },
    columnStyles: {
      0: { cellWidth: contentWidth * 0.55 },
      1: { cellWidth: contentWidth * 0.25 },
      2: { cellWidth: contentWidth * 0.20, halign: 'right' }
    },
    theme: 'plain'
  });

  // ----- Totals block (right aligned) -----
  const afterTableY = doc.lastAutoTable.finalY + 8;
  const totalsX = pageWidth - margin;
  const totalsLabelX = totalsX - 60;
  doc.setFontSize(10);
  doc.setTextColor(60, 60, 60);
  doc.setFont('helvetica', 'normal');
  doc.text('Subtotal', totalsLabelX, afterTableY);
  doc.text(fmtMoney(receipt.amount, receipt.currency), totalsX, afterTableY, { align: 'right' });

  doc.text('Tax', totalsLabelX, afterTableY + 6);
  doc.text(fmtMoney(0, receipt.currency), totalsX, afterTableY + 6, { align: 'right' });

  // Grand total — bold + ruled top line
  doc.setDrawColor(17, 17, 17);
  doc.setLineWidth(0.6);
  doc.line(totalsLabelX - 2, afterTableY + 9, totalsX, afterTableY + 9);

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(17, 17, 17);
  doc.setFontSize(11);
  doc.text('Total paid', totalsLabelX, afterTableY + 14);
  doc.text(fmtMoney(receipt.amount, receipt.currency), totalsX, afterTableY + 14, { align: 'right' });

  // ----- Footer -----
  const footerY = afterTableY + 30;
  doc.setDrawColor(220, 220, 220);
  doc.setLineDashPattern([1, 1], 0);
  doc.line(margin, footerY, pageWidth - margin, footerY);
  doc.setLineDashPattern([], 0);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(110, 110, 110);
  const footerLines = [];
  if (receipt.provider === 'mock') {
    footerLines.push('This is a sandbox / developer receipt. No real payment was processed.');
    footerLines.push('Generated automatically for testing the Travio subscription flow.');
  } else {
    footerLines.push('Thank you for subscribing to Travio.');
  }
  if (receipt.note) footerLines.push(receipt.note);

  let fy = footerY + 5;
  footerLines.forEach((line) => {
    const wrapped = doc.splitTextToSize(line, contentWidth);
    wrapped.forEach((w) => {
      doc.text(w, margin, fy);
      fy += 4.5;
    });
  });

  return doc;
};

/**
 * Trigger the browser to download the PDF for the given receipt payload.
 * Returns the filename used so the caller can show it in a toast.
 */
export const downloadReceiptPdf = ({ receipt, buyer, seller }) => {
  const doc = buildReceiptPdf({ receipt, buyer, seller });
  const filename = `receipt-${receipt.orderId || Date.now()}.pdf`;
  doc.save(filename);
  return filename;
};

/**
 * One-shot helper used both by the success modal and by the "Receipt"
 * button in the billing history table. Fetches the receipt payload from
 * the API and immediately downloads it as a PDF.
 */
export const fetchAndDownloadReceipt = async (apiBase, token, historyId) => {
  if (!historyId) return;
  const res = await fetch(`${apiBase}/api/payments/receipt/${historyId}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) throw new Error(`Receipt ${res.status}`);
  const data = await res.json();
  return downloadReceiptPdf(data);
};
