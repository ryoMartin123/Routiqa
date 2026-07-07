// Section-aware proposal PDF. Renders the full proposal document — branding,
// every visible section, line items, totals, add-ons, terms, approval — as a
// clean, selectable-text PDF that mirrors <ProposalDocument />.

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { fmt } from "./data";
import { SECTION_LABELS, type SectionKey } from "@/lib/proposals/data";
import { DEFAULT_DESIGN, type ProposalDesign } from "@/lib/proposals/designs";
import type { ProposalDocData } from "./proposalDoc";

type RGB = [number, number, number];
const INK: RGB = [17, 24, 39];
const SUB: RGB = [55, 65, 81];
const MUTED: RGB = [107, 114, 128];
const FAINT: RGB = [156, 163, 175];
const LINE: RGB = [229, 231, 235];
const WHITE: RGB = [255, 255, 255];

function hexToRgb(hex: string): RGB {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex.trim());
  return m ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)] : [15, 133, 120];
}

export function downloadProposalPdf(data: ProposalDocData, design: ProposalDesign = DEFAULT_DESIGN): void {
  const ds = design.style;
  // jsPDF ships helvetica + times — map the design's font family onto them.
  const FONT = ds.fontFamily.includes("Georgia") ? "times" : "helvetica";

  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const M = 48;
  const contentW = pageW - M * 2;
  const accent = hexToRgb(data.branding.accentColor || "#0f8578");
  const bottom = pageH - 54;
  let y = 56;

  const ensure = (space: number) => { if (y + space > bottom) { doc.addPage(); y = 56; } };
  const para = (text: string, size: number, color: RGB, lh = 1.5, x = M, width = contentW) => {
    doc.setFont(FONT, "normal"); doc.setFontSize(size); doc.setTextColor(...color);
    const lines = doc.splitTextToSize(text, width) as string[];
    for (const ln of lines) { ensure(size * lh); doc.text(ln, x, y); y += size * lh; }
  };
  const sectionLabel = (label: string) => {
    ensure(18); doc.setFont(FONT, "bold"); doc.setFontSize(8.5); doc.setTextColor(...accent);
    doc.text(label.toUpperCase(), M, y); y += 14;
  };

  // ── Letterhead — varies by design ──
  const company = data.branding.companyName || "Company";
  const info = [data.branding.companyInfo, data.branding.contactInfo].filter(Boolean);
  const metaRight = (color: RGB, dim: RGB, topY: number) => {
    doc.setFont(FONT, "bold"); doc.setFontSize(13); doc.setTextColor(...color);
    doc.text("PROPOSAL", pageW - M, topY, { align: "right" });
    doc.setFont(FONT, "normal"); doc.setFontSize(9); doc.setTextColor(...dim);
    let ry = topY + 15;
    doc.text(data.quoteNumber, pageW - M, ry, { align: "right" }); ry += 12;
    if (data.createdAt) { doc.text(`Date: ${data.createdAt}`, pageW - M, ry, { align: "right" }); ry += 12; }
    if (data.expiresAt) { doc.text(`Valid until: ${data.expiresAt}`, pageW - M, ry, { align: "right" }); ry += 12; }
    return ry;
  };

  if (ds.header === "bold") {
    // Full-width accent block with reversed white type.
    const blockH = 40 + info.length * 12 + 14;
    doc.setFillColor(...accent); doc.rect(0, 0, pageW, blockH, "F");
    doc.setFont(FONT, "bold"); doc.setFontSize(18); doc.setTextColor(...WHITE);
    doc.text(company, M, 44);
    doc.setFont(FONT, "normal"); doc.setFontSize(9); doc.setTextColor(...WHITE);
    let ly = 60; for (const ln of info) { doc.text(ln, M, ly); ly += 12; }
    if (data.branding.licenseNumber) { doc.text(`Lic. ${data.branding.licenseNumber}`, M, ly); }
    metaRight(WHITE, WHITE, 36);
    y = blockH + 22;
  } else if (ds.header === "centered") {
    doc.setFont(FONT, "bold"); doc.setFontSize(18); doc.setTextColor(...accent);
    doc.text(company, pageW / 2, y, { align: "center" }); y += 15;
    doc.setFont(FONT, "normal"); doc.setFontSize(9); doc.setTextColor(...MUTED);
    const sub = [...info, data.branding.licenseNumber ? `Lic. ${data.branding.licenseNumber}` : ""].filter(Boolean).join("  ·  ");
    if (sub) { doc.text(sub, pageW / 2, y, { align: "center" }); y += 16; }
    doc.setDrawColor(...accent); doc.setLineWidth(2); doc.line(pageW / 2 - 28, y, pageW / 2 + 28, y); y += 16;
    doc.setFont(FONT, "bold"); doc.setFontSize(12); doc.setTextColor(...INK);
    doc.text("PROPOSAL", pageW / 2, y, { align: "center" }); y += 13;
    doc.setFont(FONT, "normal"); doc.setFontSize(9); doc.setTextColor(...MUTED);
    doc.text(`${data.quoteNumber}${data.expiresAt ? `  ·  Valid until ${data.expiresAt}` : ""}`, pageW / 2, y, { align: "center" }); y += 22;
  } else {
    // band / serif / minimal — left company, right meta, then a rule.
    doc.setFont(FONT, "bold"); doc.setFontSize(18); doc.setTextColor(...accent);
    doc.text(company, M, y);
    doc.setFont(FONT, "normal"); doc.setFontSize(9); doc.setTextColor(...MUTED);
    let ly = y + 15;
    for (const ln of info) { doc.text(ln, M, ly); ly += 12; }
    if (data.branding.licenseNumber) { doc.setTextColor(...FAINT); doc.text(`Lic. ${data.branding.licenseNumber}`, M, ly); ly += 12; }
    const ry = metaRight(INK, MUTED, y);
    y = Math.max(ly, ry) + 8;
    if (ds.header === "serif") {
      doc.setDrawColor(...accent); doc.setLineWidth(1); doc.line(M, y, pageW - M, y); doc.line(M, y + 3, pageW - M, y + 3); y += 24;
    } else if (ds.header === "minimal") {
      doc.setDrawColor(...LINE); doc.setLineWidth(0.75); doc.line(M, y, pageW - M, y); y += 22;
    } else {
      doc.setDrawColor(...accent); doc.setLineWidth(1.5); doc.line(M, y, pageW - M, y); y += 22;
    }
  }

  // ── Sections ──
  for (const s of data.sections.filter(x => x.visible)) {
    const label = SECTION_LABELS[s.key as SectionKey] ?? s.label;

    if (s.key === "cover_header") {
      ensure(28); doc.setFont("helvetica", "bold"); doc.setFontSize(18); doc.setTextColor(...INK);
      doc.text(data.title || "Proposal", M, y); y += 22;
      if (s.body) para(s.body, 10.5, SUB, 1.5);
      para(`Prepared for ${data.customerName}`, 9.5, MUTED, 1.5);
      y += 10; continue;
    }
    if (s.key === "customer_info") {
      sectionLabel(label);
      doc.setFont(FONT, "bold"); doc.setFontSize(11); doc.setTextColor(...INK); ensure(14); doc.text(data.customerName, M, y); y += 14;
      if (data.locationName) para(data.locationName, 9.5, MUTED, 1.4);
      if (data.assignedTo) para(`Salesperson: ${data.assignedTo}`, 9.5, MUTED, 1.4);
      y += 8; continue;
    }
    if (s.key === "property_info") {
      sectionLabel(label); para(data.propertyLabel ?? "—", 10, data.propertyLabel ? INK : MUTED, 1.4); y += 8; continue;
    }
    if (s.key === "line_items") {
      sectionLabel(label);
      const base = data.lineItems.filter(li => !li.optional);
      if (base.length) {
        autoTable(doc, {
          startY: y, margin: { left: M, right: M },
          head: [["Description", "Qty", "Unit", "Amount"]],
          body: base.map(li => [
            li.name && li.description && li.name !== li.description ? `${li.name}\n${li.description}` : (li.name || li.description),
            String(li.quantity), fmt(li.unitPrice), fmt(li.total),
          ]),
          styles: { font: FONT, fontSize: 9, cellPadding: 6, textColor: INK, lineColor: LINE, lineWidth: 0.5 },
          headStyles: { fillColor: [249, 250, 251], textColor: MUTED, fontStyle: "bold", fontSize: 8 },
          columnStyles: { 0: { cellWidth: "auto" }, 1: { halign: "right", cellWidth: 50 }, 2: { halign: "right", cellWidth: 80 }, 3: { halign: "right", cellWidth: 90 } },
          theme: "grid",
        });
        y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 16;
      } else { para("No line items.", 10, MUTED); }

      // Totals (right-aligned) — varies by design
      ensure(64);
      const tw = 200, lx = pageW - M - tw, vx = pageW - M;
      const drawRows = (ty: number) => {
        doc.setFont(FONT, "normal"); doc.setFontSize(9);
        doc.setTextColor(...MUTED); doc.text("Subtotal", lx, ty); doc.setTextColor(...INK); doc.text(fmt(data.subtotal), vx, ty, { align: "right" });
        doc.setTextColor(...MUTED); doc.text(`Tax (${data.taxRatePct}%)`, lx, ty + 15); doc.setTextColor(...INK); doc.text(fmt(data.tax), vx, ty + 15, { align: "right" });
      };
      if (ds.totals === "accentbar") {
        drawRows(y);
        const barY = y + 30;
        doc.setFillColor(...accent); doc.roundedRect(lx - 10, barY - 13, tw + 10, 24, 4, 4, "F");
        doc.setFont(FONT, "bold"); doc.setFontSize(12); doc.setTextColor(...WHITE);
        doc.text("Total", lx, barY + 3); doc.text(fmt(data.total), vx, barY + 3, { align: "right" });
        y = barY + 24;
      } else if (ds.totals === "box") {
        doc.setDrawColor(...LINE); doc.setLineWidth(1); doc.roundedRect(lx - 12, y - 14, tw + 12, 66, 5, 5, "S");
        drawRows(y);
        doc.setDrawColor(...accent); doc.setLineWidth(1.5); doc.line(lx, y + 24, vx, y + 24);
        doc.setFont(FONT, "bold"); doc.setFontSize(12);
        doc.setTextColor(...INK); doc.text("Total", lx, y + 40); doc.setTextColor(...accent); doc.text(fmt(data.total), vx, y + 40, { align: "right" });
        y += 64;
      } else {
        drawRows(y);
        doc.setDrawColor(...accent); doc.setLineWidth(1); doc.line(lx, y + 24, vx, y + 24);
        doc.setFont(FONT, "bold"); doc.setFontSize(12);
        doc.setTextColor(...INK); doc.text("Total", lx, y + 40); doc.setTextColor(...accent); doc.text(fmt(data.total), vx, y + 40, { align: "right" });
        y += 60;
      }

      const optional = data.lineItems.filter(li => li.optional);
      if (optional.length) {
        sectionLabel("Optional add-ons");
        for (const li of optional) {
          ensure(14); doc.setFont(FONT, "normal"); doc.setFontSize(9.5); doc.setTextColor(...SUB);
          doc.text(`${li.name || li.description}  ×${li.quantity}`, M, y);
          doc.text(fmt(li.total), pageW - M, y, { align: "right" }); y += 14;
        }
        para("Add-ons are not included in the total above.", 8, FAINT); y += 6;
      }
      if (data.customerNotes) { para(data.customerNotes, 9.5, SUB, 1.5); }
      y += 8; continue;
    }
    if (s.key === "approval") {
      sectionLabel(label);
      if (s.body) para(s.body, 9.5, SUB, 1.5);
      ensure(50); y += 18;
      const colW = (contentW - 40) / 2;
      doc.setDrawColor(...INK); doc.setLineWidth(0.75);
      doc.line(M, y, M + colW, y); doc.line(M + colW + 40, y, pageW - M, y);
      doc.setFont(FONT, "normal"); doc.setFontSize(8); doc.setTextColor(...MUTED);
      doc.text("Customer Signature", M, y + 12); doc.text("Date", M + colW + 40, y + 12);
      y += 28; continue;
    }
    // Generic narrative
    sectionLabel(label);
    if (s.body) para(s.body, 10.5, SUB, 1.55); else para("—", 10, FAINT);
    y += 8;
  }

  // ── Footer on every page ──
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    if (data.branding.footer) {
      doc.setFont("helvetica", "normal"); doc.setFontSize(7.5); doc.setTextColor(...FAINT);
      doc.text(data.branding.footer, pageW / 2, pageH - 30, { align: "center", maxWidth: contentW });
    }
    doc.setFontSize(7.5); doc.setTextColor(...FAINT);
    doc.text(`${p} / ${pages}`, pageW - M, pageH - 30, { align: "right" });
  }

  // ── Stamp (last, on page 1) ──
  if (data.stamp) {
    doc.setPage(1);
    const cx = pageW / 2, cy = pageH / 2;
    const A = (18 * Math.PI) / 180, cos = Math.cos(A), sin = Math.sin(A);
    const rot = (dx: number, dy: number): [number, number] => [cx + dx * cos + dy * sin, cy - dx * sin + dy * cos];
    doc.saveGraphicsState();
    try {
      const GState = (doc as unknown as { GState: new (o: { opacity: number }) => unknown }).GState;
      (doc as unknown as { setGState: (g: unknown) => void }).setGState(new GState({ opacity: 0.82 }));
    } catch { /* solid is fine */ }
    doc.setTextColor(5, 150, 105); doc.setDrawColor(5, 150, 105); doc.setFont("helvetica", "bold");
    const F = 50; doc.setFontSize(F);
    const tw = doc.getTextWidth(data.stamp); const hw = tw / 2 + 22, hh = F * 0.72;
    const c = [rot(-hw, -hh), rot(hw, -hh), rot(hw, hh), rot(-hw, hh)];
    doc.setLineWidth(4);
    for (let i = 0; i < 4; i++) { const a = c[i], b = c[(i + 1) % 4]; doc.line(a[0], a[1], b[0], b[1]); }
    const start = rot(-tw / 2, F * 0.33);
    doc.text(data.stamp, start[0], start[1], { angle: 18 });
    doc.restoreGraphicsState();
  }

  const safe = (data.quoteNumber || "Proposal").replace(/[^\w.-]+/g, "-");
  doc.save(`${safe}.pdf`);
}
