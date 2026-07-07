// Instant client-side quote PDF (no print dialog). Generates a clean, branded,
// selectable-text document with jsPDF + autotable and saves it as
// "<quote-number>.pdf". Mirrors the on-screen QuotePreview layout.

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { fmt, type LineItem } from "./data";

export interface QuotePdfData {
  quoteNumber?: string;
  title: string;
  customerName: string;
  propertyLabel?: string;
  locationName?: string;
  expiresAt?: string;
  assignedTo?: string;
  createdAt?: string;
  lineItems: LineItem[];
  subtotal: number;
  tax: number;
  total: number;
  customerNotes?: string;
  stamp?: string;          // e.g. "APPROVED" — diagonal green stamp across the page
}

const INDIGO: [number, number, number] = [15, 133, 120];
const GRAY:   [number, number, number] = [107, 114, 128];
const MUTED:  [number, number, number] = [156, 163, 175];
const DARK:   [number, number, number] = [17, 24, 39];

export function downloadQuotePdf(data: QuotePdfData): void {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const M = 48;
  let y = 58;

  // ── Letterhead ──
  doc.setFont("helvetica", "bold"); doc.setFontSize(16); doc.setTextColor(...INDIGO);
  doc.text("Northstar Services", M, y);
  doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(...GRAY);
  doc.text(data.locationName ?? "Augusta Branch", M, y + 15);

  doc.setFont("helvetica", "bold"); doc.setFontSize(12); doc.setTextColor(...DARK);
  doc.text("QUOTE", pageW - M, y, { align: "right" });
  if (data.quoteNumber) {
    doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(...GRAY);
    doc.text(data.quoteNumber, pageW - M, y + 15, { align: "right" });
  }

  // Accent rule
  y += 28;
  doc.setDrawColor(...INDIGO); doc.setLineWidth(1.5); doc.line(M, y, pageW - M, y);
  y += 24;

  // ── Meta ──
  doc.setFont("helvetica", "bold"); doc.setFontSize(8); doc.setTextColor(...MUTED);
  doc.text("PREPARED FOR", M, y);
  doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.setTextColor(...DARK);
  doc.text(data.customerName, M, y + 16);
  if (data.propertyLabel) {
    doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(...GRAY);
    doc.text(data.propertyLabel, M, y + 30);
  }

  const metaLines: string[] = [];
  if (data.assignedTo) metaLines.push(`Salesperson: ${data.assignedTo}`);
  if (data.createdAt)  metaLines.push(`Date: ${data.createdAt}`);
  if (data.expiresAt)  metaLines.push(`Valid until: ${data.expiresAt}`);
  doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(...GRAY);
  metaLines.forEach((line, i) => doc.text(line, pageW - M, y + i * 14, { align: "right" }));

  y += 52;

  // ── Title ──
  doc.setFont("helvetica", "bold"); doc.setFontSize(12); doc.setTextColor(...DARK);
  doc.text(data.title || "Untitled Quote", M, y);
  y += 8;

  // ── Line items ──
  const base = data.lineItems.filter(li => !li.optional);
  autoTable(doc, {
    startY: y + 6,
    margin: { left: M, right: M },
    head: [["Description", "Qty", "Unit", "Amount"]],
    body: base.map(li => [
      li.name && li.description && li.name !== li.description ? `${li.name}\n${li.description}` : (li.name || li.description),
      String(li.quantity), fmt(li.unitPrice), fmt(li.total),
    ]),
    styles: { font: "helvetica", fontSize: 9, cellPadding: 6, textColor: DARK, lineColor: [243, 244, 246], lineWidth: 0.5 },
    headStyles: { fillColor: [249, 250, 251], textColor: GRAY, fontStyle: "bold", fontSize: 8 },
    columnStyles: { 0: { cellWidth: "auto" }, 1: { halign: "right", cellWidth: 50 }, 2: { halign: "right", cellWidth: 80 }, 3: { halign: "right", cellWidth: 90 } },
    theme: "grid",
  });

  // autotable records its end on the doc; cast to read it.
  let cy = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 18;

  // ── Totals ──
  const labelX = pageW - M - 200;
  const valX = pageW - M;
  doc.setFont("helvetica", "normal"); doc.setFontSize(9);
  doc.setTextColor(...GRAY); doc.text("Subtotal", labelX, cy);
  doc.setTextColor(...DARK); doc.text(fmt(data.subtotal), valX, cy, { align: "right" });
  doc.setTextColor(...GRAY); doc.text("Tax", labelX, cy + 15);
  doc.setTextColor(...DARK); doc.text(fmt(data.tax), valX, cy + 15, { align: "right" });
  doc.setDrawColor(229, 231, 235); doc.setLineWidth(0.75); doc.line(labelX, cy + 23, valX, cy + 23);
  doc.setFont("helvetica", "bold"); doc.setFontSize(11);
  doc.setTextColor(...DARK); doc.text("Total", labelX, cy + 39);
  doc.setTextColor(...INDIGO); doc.text(fmt(data.total), valX, cy + 39, { align: "right" });
  cy += 62;

  // ── Optional add-ons ──
  const optional = data.lineItems.filter(li => li.optional);
  if (optional.length) {
    doc.setFont("helvetica", "bold"); doc.setFontSize(8); doc.setTextColor(...MUTED);
    doc.text("OPTIONAL ADD-ONS", M, cy); cy += 4;
    autoTable(doc, {
      startY: cy,
      margin: { left: M, right: M },
      body: optional.map(li => [li.name || li.description, fmt(li.total)]),
      styles: { font: "helvetica", fontSize: 9, cellPadding: 5, textColor: DARK },
      columnStyles: { 1: { halign: "right", cellWidth: 90 } },
      theme: "plain",
    });
    cy = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
    doc.setFont("helvetica", "normal"); doc.setFontSize(7.5); doc.setTextColor(...MUTED);
    doc.text("Add-ons are not included in the total above.", M, cy); cy += 18;
  }

  // ── Notes ──
  if (data.customerNotes) {
    doc.setFont("helvetica", "bold"); doc.setFontSize(8); doc.setTextColor(...MUTED);
    doc.text("NOTES", M, cy); cy += 13;
    doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(55, 65, 81);
    const lines = doc.splitTextToSize(data.customerNotes, pageW - M * 2) as string[];
    doc.text(lines, M, cy);
  }

  // ── Footer ──
  doc.setFont("helvetica", "normal"); doc.setFontSize(7.5); doc.setTextColor(...MUTED);
  doc.text(
    "Thank you for the opportunity. This quote is an estimate and may be subject to change after on-site assessment.",
    pageW / 2, pageH - 36, { align: "center", maxWidth: pageW - M * 2 },
  );

  // ── Status stamp (drawn last so it sits on top) ──
  if (data.stamp) {
    const cx = pageW / 2, cy = pageH / 2;
    const A = (20 * Math.PI) / 180;            // tilt up to the right
    const cos = Math.cos(A), sin = Math.sin(A);
    // Visual counter-clockwise rotation in PDF (y-down) space — matches the
    // jsPDF text `angle` below so the border and label stay aligned.
    const rot = (dx: number, dy: number): [number, number] => [cx + dx * cos + dy * sin, cy - dx * sin + dy * cos];

    doc.saveGraphicsState();
    try {
      const GState = (doc as unknown as { GState: new (o: { opacity: number }) => unknown }).GState;
      (doc as unknown as { setGState: (g: unknown) => void }).setGState(new GState({ opacity: 0.82 }));
    } catch { /* opacity not supported — solid stamp is fine */ }

    doc.setTextColor(5, 150, 105);   // emerald-600
    doc.setDrawColor(5, 150, 105);
    doc.setFont("helvetica", "bold");
    const F = 52;
    doc.setFontSize(F);

    // Box sized to the measured text; padding keeps the label clear of the border.
    const tw = doc.getTextWidth(data.stamp);
    const hw = tw / 2 + 24;   // half width
    const hh = F * 0.72;      // half height (comfortably taller than the caps)
    const c = [rot(-hw, -hh), rot(hw, -hh), rot(hw, hh), rot(-hw, hh)];
    doc.setLineWidth(4);
    for (let i = 0; i < 4; i++) { const a = c[i], b = c[(i + 1) % 4]; doc.line(a[0], a[1], b[0], b[1]); }

    // Draw from the rotated baseline-left anchor (no align/baseline opts, which
    // don't compose with `angle`). Local baseline sits below center so the caps
    // are vertically centered in the box.
    const start = rot(-tw / 2, F * 0.33);
    doc.text(data.stamp, start[0], start[1], { angle: 20 });

    doc.restoreGraphicsState();
  }

  const safeName = (data.quoteNumber || "Quote").replace(/[^\w.-]+/g, "-");
  doc.save(`${safeName}.pdf`);
}

// ─── Invoice PDF ──────────────────────────────────────────
export interface InvoicePdfData {
  invoiceNumber?: string;
  title: string;
  customerName: string;
  propertyLabel?: string;
  locationName?: string;
  dueDate?: string;
  createdAt?: string;
  lineItems: LineItem[];
  subtotal: number;
  tax: number;
  total: number;
  balanceDue: number;
  paidAt?: string;
  customerNotes?: string;
  stamp?: string;          // e.g. "PAID"
}

function drawStamp(doc: jsPDF, label: string, pageW: number, pageH: number) {
  const cx = pageW / 2, cy = pageH / 2;
  const A = (20 * Math.PI) / 180;
  const cos = Math.cos(A), sin = Math.sin(A);
  const rot = (dx: number, dy: number): [number, number] => [cx + dx * cos + dy * sin, cy - dx * sin + dy * cos];
  doc.saveGraphicsState();
  try {
    const GState = (doc as unknown as { GState: new (o: { opacity: number }) => unknown }).GState;
    (doc as unknown as { setGState: (g: unknown) => void }).setGState(new GState({ opacity: 0.82 }));
  } catch { /* opacity unsupported */ }
  doc.setTextColor(5, 150, 105); doc.setDrawColor(5, 150, 105);
  doc.setFont("helvetica", "bold");
  const F = 52; doc.setFontSize(F);
  const tw = doc.getTextWidth(label);
  const hw = tw / 2 + 24, hh = F * 0.72;
  const c = [rot(-hw, -hh), rot(hw, -hh), rot(hw, hh), rot(-hw, hh)];
  doc.setLineWidth(4);
  for (let i = 0; i < 4; i++) { const a = c[i], b = c[(i + 1) % 4]; doc.line(a[0], a[1], b[0], b[1]); }
  const start = rot(-tw / 2, F * 0.33);
  doc.text(label, start[0], start[1], { angle: 20 });
  doc.restoreGraphicsState();
}

export function downloadInvoicePdf(data: InvoicePdfData): void {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const M = 48;
  let y = 58;

  doc.setFont("helvetica", "bold"); doc.setFontSize(16); doc.setTextColor(...INDIGO);
  doc.text("Northstar Services", M, y);
  doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(...GRAY);
  doc.text(data.locationName ?? "Augusta Branch", M, y + 15);
  doc.setFont("helvetica", "bold"); doc.setFontSize(12); doc.setTextColor(...DARK);
  doc.text("INVOICE", pageW - M, y, { align: "right" });
  if (data.invoiceNumber) {
    doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(...GRAY);
    doc.text(data.invoiceNumber, pageW - M, y + 15, { align: "right" });
  }

  y += 28;
  doc.setDrawColor(...INDIGO); doc.setLineWidth(1.5); doc.line(M, y, pageW - M, y);
  y += 24;

  doc.setFont("helvetica", "bold"); doc.setFontSize(8); doc.setTextColor(...MUTED);
  doc.text("BILL TO", M, y);
  doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.setTextColor(...DARK);
  doc.text(data.customerName, M, y + 16);
  if (data.propertyLabel) {
    doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(...GRAY);
    doc.text(data.propertyLabel, M, y + 30);
  }
  const metaLines: string[] = [];
  if (data.createdAt) metaLines.push(`Issued: ${data.createdAt}`);
  if (data.dueDate)   metaLines.push(`Due: ${data.dueDate}`);
  doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(...GRAY);
  metaLines.forEach((line, i) => doc.text(line, pageW - M, y + i * 14, { align: "right" }));

  y += 52;
  doc.setFont("helvetica", "bold"); doc.setFontSize(12); doc.setTextColor(...DARK);
  doc.text(data.title || "Invoice", M, y);
  y += 8;

  const items = data.lineItems.filter(li => !li.optional);
  autoTable(doc, {
    startY: y + 6,
    margin: { left: M, right: M },
    head: [["Description", "Qty", "Unit", "Amount"]],
    body: items.map(li => [
      li.name && li.description && li.name !== li.description ? `${li.name}\n${li.description}` : (li.name || li.description),
      String(li.quantity), fmt(li.unitPrice), fmt(li.total),
    ]),
    styles: { font: "helvetica", fontSize: 9, cellPadding: 6, textColor: DARK, lineColor: [243, 244, 246], lineWidth: 0.5 },
    headStyles: { fillColor: [249, 250, 251], textColor: GRAY, fontStyle: "bold", fontSize: 8 },
    columnStyles: { 0: { cellWidth: "auto" }, 1: { halign: "right", cellWidth: 50 }, 2: { halign: "right", cellWidth: 80 }, 3: { halign: "right", cellWidth: 90 } },
    theme: "grid",
  });

  let cy = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 18;
  const labelX = pageW - M - 200;
  const valX = pageW - M;
  doc.setFont("helvetica", "normal"); doc.setFontSize(9);
  doc.setTextColor(...GRAY); doc.text("Subtotal", labelX, cy);
  doc.setTextColor(...DARK); doc.text(fmt(data.subtotal), valX, cy, { align: "right" });
  doc.setTextColor(...GRAY); doc.text("Tax", labelX, cy + 15);
  doc.setTextColor(...DARK); doc.text(fmt(data.tax), valX, cy + 15, { align: "right" });
  doc.setTextColor(...GRAY); doc.text("Total", labelX, cy + 30);
  doc.setTextColor(...DARK); doc.text(fmt(data.total), valX, cy + 30, { align: "right" });
  doc.setDrawColor(...INDIGO); doc.setLineWidth(1); doc.line(labelX, cy + 38, valX, cy + 38);
  doc.setFont("helvetica", "bold"); doc.setFontSize(11);
  doc.setTextColor(...DARK); doc.text("Balance Due", labelX, cy + 54);
  doc.setTextColor(...INDIGO); doc.text(data.balanceDue > 0 ? fmt(data.balanceDue) : "Paid in Full", valX, cy + 54, { align: "right" });
  cy += 76;

  if (data.customerNotes) {
    doc.setFont("helvetica", "bold"); doc.setFontSize(8); doc.setTextColor(...MUTED);
    doc.text("NOTES", M, cy); cy += 13;
    doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(55, 65, 81);
    const lines = doc.splitTextToSize(data.customerNotes, pageW - M * 2) as string[];
    doc.text(lines, M, cy);
  }

  doc.setFont("helvetica", "normal"); doc.setFontSize(7.5); doc.setTextColor(...MUTED);
  doc.text("Thank you for your business. Please remit payment by the due date above.", pageW / 2, pageH - 36, { align: "center", maxWidth: pageW - M * 2 });

  if (data.stamp) drawStamp(doc, data.stamp, pageW, pageH);

  const safeName = (data.invoiceNumber || "Invoice").replace(/[^\w.-]+/g, "-");
  doc.save(`${safeName}.pdf`);
}
