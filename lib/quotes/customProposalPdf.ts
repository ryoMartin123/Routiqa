// Block-aware PDF for Custom Proposals — renders quote.blocks the same way the
// Custom Proposal Builder does (CustomProposalDocument), as a real downloadable,
// selectable-text PDF (no print dialog). Mirrors the letterhead/totals treatment
// of lib/quotes/proposalPdf so all proposals feel consistent.

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { fmt } from "./data";
import { DEFAULT_DESIGN, type ProposalDesign } from "@/lib/proposals/designs";
import { RICH_BLOCK_TYPES, type QuoteBlock } from "./blocks";
import type { CustomDocData } from "@/components/quotes/custom/CustomProposalDocument";

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

// RTE HTML → plain lines, bullets prefixed with "• ".
function htmlToLines(html: string): string[] {
  const norm = html
    .replace(/<\s*li[^>]*>/gi, "\n• ")
    .replace(/<\s*(br|\/p|\/h[1-6]|\/li|\/div)\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/&lt;/gi, "<").replace(/&gt;/gi, ">").replace(/&#39;|&apos;/gi, "'").replace(/&quot;/gi, '"');
  return norm.split("\n").map(s => s.trim()).filter(Boolean);
}

// Load an image (data-URL or CORS-enabled remote) → dataURL + natural size.
// Resolves null on any failure/timeout so generation never hangs or throws.
function loadImage(src: string): Promise<{ data: string; w: number; h: number } | null> {
  return new Promise(resolve => {
    if (!src) return resolve(null);
    if (src.startsWith("data:")) {
      const img = new Image();
      img.onload = () => resolve({ data: src, w: img.naturalWidth || 1, h: img.naturalHeight || 1 });
      img.onerror = () => resolve(null);
      img.src = src;
      return;
    }
    const img = new Image();
    img.crossOrigin = "anonymous";
    const timer = setTimeout(() => resolve(null), 5000);
    img.onload = () => {
      clearTimeout(timer);
      try {
        const c = document.createElement("canvas");
        c.width = img.naturalWidth; c.height = img.naturalHeight;
        const ctx = c.getContext("2d");
        if (!ctx) return resolve(null);
        ctx.drawImage(img, 0, 0);
        resolve({ data: c.toDataURL("image/jpeg", 0.85), w: img.naturalWidth, h: img.naturalHeight });
      } catch { resolve(null); }
    };
    img.onerror = () => { clearTimeout(timer); resolve(null); };
    img.src = src;
  });
}

export async function downloadCustomProposalPdf(data: CustomDocData, design: ProposalDesign = DEFAULT_DESIGN): Promise<void> {
  const ds = design.style;
  const FONT = ds.fontFamily.includes("Georgia") ? "times" : "helvetica";
  const HEAD = ds.headingFamily.includes("Georgia") ? "times" : "helvetica";

  // Preload every image up front so the page-flow rendering stays synchronous.
  const blocks = data.blocks.filter(b => b.visible);
  const imgCache = new Map<string, { data: string; w: number; h: number } | null>();
  const srcs = new Set<string>();
  if (data.branding.logoUrl) srcs.add(data.branding.logoUrl);
  for (const b of blocks) {
    (b.images ?? []).forEach(im => im.src && srcs.add(im.src));
    if (b.type === "option_cards") data.options.forEach(o => o.image && srcs.add(o.image));
  }
  await Promise.all([...srcs].map(async s => imgCache.set(s, await loadImage(s))));

  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const M = 48;
  const contentW = pageW - M * 2;
  const accent = hexToRgb(data.branding.accentColor || "#0f8578");
  const bottom = pageH - 54;
  let y = 56;

  const ensure = (space: number) => { if (y + space > bottom) { doc.addPage(); y = 56; } };
  const para = (text: string, size: number, color: RGB, lh = 1.5, x = M, width = contentW, font = FONT) => {
    doc.setFont(font, "normal"); doc.setFontSize(size); doc.setTextColor(...color);
    for (const ln of doc.splitTextToSize(text, width) as string[]) { ensure(size * lh); doc.text(ln, x, y); y += size * lh; }
  };
  const label = (text: string) => {
    ensure(20);
    if (ds.label === "rule") {
      doc.setFont(HEAD, "bold"); doc.setFontSize(11); doc.setTextColor(...INK);
      doc.text(text, M, y);
      const w = doc.getTextWidth(text);
      doc.setDrawColor(...accent); doc.setLineWidth(1.5); doc.line(M, y + 3, M + w, y + 3);
      y += 16;
    } else if (ds.label === "bar") {
      doc.setFillColor(...accent); doc.rect(M, y - 9, 3, 13, "F");
      doc.setFont(HEAD, "bold"); doc.setFontSize(11); doc.setTextColor(...INK);
      doc.text(text, M + 8, y); y += 16;
    } else {
      doc.setFont(FONT, "bold"); doc.setFontSize(8.5); doc.setTextColor(...accent);
      doc.text(text.toUpperCase(), M, y); y += 14;
    }
  };
  const addImage = (src: string, maxW: number, maxH = 230) => {
    const im = imgCache.get(src);
    if (!im) { para("[ image ]", 9, FAINT); return; }
    let w = maxW; let h = (im.h / im.w) * w;
    if (h > maxH) { h = maxH; w = (im.w / im.h) * h; }
    ensure(h + 6);
    try { doc.addImage(im.data, "JPEG", M, y, w, h); } catch { /* skip */ }
    y += h + 6;
  };

  // ── Letterhead (matches lib/quotes/proposalPdf) ──
  const company = data.branding.companyName || "Company";
  const info = [data.branding.companyInfo, data.branding.contactInfo].filter(Boolean);
  const metaRight = (color: RGB, dim: RGB, topY: number) => {
    doc.setFont(HEAD, "bold"); doc.setFontSize(13); doc.setTextColor(...color);
    doc.text("PROPOSAL", pageW - M, topY, { align: "right" });
    doc.setFont(FONT, "normal"); doc.setFontSize(9); doc.setTextColor(...dim);
    let ry = topY + 15;
    doc.text(data.quoteNumber, pageW - M, ry, { align: "right" }); ry += 12;
    doc.text(`Prepared for ${data.customerName}`, pageW - M, ry, { align: "right" }); ry += 12;
    if (data.expiresAt) { doc.text(`Valid until: ${data.expiresAt}`, pageW - M, ry, { align: "right" }); ry += 12; }
    return ry;
  };
  const logo = data.branding.logoUrl ? imgCache.get(data.branding.logoUrl) : null;
  const drawLogo = (x: number, topY: number, maxH: number): number => {
    if (logo) { const w = (logo.w / logo.h) * maxH; try { doc.addImage(logo.data, "JPEG", x, topY, w, maxH); } catch { /* */ } return topY + maxH + 4; }
    return topY;
  };

  if (ds.header === "bold") {
    const blockH = 40 + info.length * 12 + 14;
    doc.setFillColor(...accent); doc.rect(0, 0, pageW, blockH, "F");
    let ly = 44;
    if (!logo) { doc.setFont(HEAD, "bold"); doc.setFontSize(18); doc.setTextColor(...WHITE); doc.text(company, M, ly); }
    else { drawLogo(M, 18, 26); }
    doc.setFont(FONT, "normal"); doc.setFontSize(9); doc.setTextColor(...WHITE);
    ly = 60; for (const ln of info) { doc.text(ln, M, ly); ly += 12; }
    metaRight(WHITE, WHITE, 36);
    y = blockH + 22;
  } else if (ds.header === "centered") {
    if (logo) { const w = (logo.w / logo.h) * 30; try { doc.addImage(logo.data, "JPEG", pageW / 2 - w / 2, y - 6, w, 30); } catch { /* */ } y += 28; }
    else { doc.setFont(HEAD, "bold"); doc.setFontSize(18); doc.setTextColor(...accent); doc.text(company, pageW / 2, y, { align: "center" }); y += 15; }
    doc.setFont(FONT, "normal"); doc.setFontSize(9); doc.setTextColor(...MUTED);
    const sub = info.join("  ·  ");
    if (sub) { doc.text(sub, pageW / 2, y, { align: "center" }); y += 16; }
    doc.setDrawColor(...accent); doc.setLineWidth(2); doc.line(pageW / 2 - 28, y, pageW / 2 + 28, y); y += 16;
    doc.setFont(HEAD, "bold"); doc.setFontSize(12); doc.setTextColor(...INK); doc.text("PROPOSAL", pageW / 2, y, { align: "center" }); y += 13;
    doc.setFont(FONT, "normal"); doc.setFontSize(9); doc.setTextColor(...MUTED);
    doc.text(`${data.quoteNumber} · Prepared for ${data.customerName}${data.expiresAt ? ` · Valid until ${data.expiresAt}` : ""}`, pageW / 2, y, { align: "center" }); y += 22;
  } else {
    let ly = y;
    if (logo) { ly = drawLogo(M, y - 6, 26) + 4; }
    else { doc.setFont(HEAD, "bold"); doc.setFontSize(18); doc.setTextColor(ds.header === "serif" ? INK[0] : accent[0], ds.header === "serif" ? INK[1] : accent[1], ds.header === "serif" ? INK[2] : accent[2]); doc.text(company, M, y); ly = y + 15; }
    doc.setFont(FONT, "normal"); doc.setFontSize(9); doc.setTextColor(...MUTED);
    for (const ln of info) { doc.text(ln, M, ly); ly += 12; }
    const ry = metaRight(INK, MUTED, y);
    y = Math.max(ly, ry) + 8;
    if (ds.header === "serif") { doc.setDrawColor(...accent); doc.setLineWidth(1); doc.line(M, y, pageW - M, y); doc.line(M, y + 3, pageW - M, y + 3); y += 24; }
    else if (ds.header === "minimal") { doc.setDrawColor(...LINE); doc.setLineWidth(0.75); doc.line(M, y, pageW - M, y); y += 22; }
    else { doc.setDrawColor(...accent); doc.setLineWidth(1.5); doc.line(M, y, pageW - M, y); y += 22; }
  }

  // ── Totals (by design) ──
  const totals = () => {
    ensure(70);
    const tw = 220, lx = pageW - M - tw, vx = pageW - M;
    const rows = (ty: number) => {
      doc.setFont(FONT, "normal"); doc.setFontSize(9);
      doc.setTextColor(...MUTED); doc.text("Subtotal", lx, ty); doc.setTextColor(...INK); doc.text(fmt(data.subtotal), vx, ty, { align: "right" });
      doc.setTextColor(...MUTED); doc.text(`Tax (${data.taxRatePct}%)`, lx, ty + 15); doc.setTextColor(...INK); doc.text(fmt(data.tax), vx, ty + 15, { align: "right" });
    };
    if (ds.totals === "accentbar") {
      rows(y); const barY = y + 30;
      doc.setFillColor(...accent); doc.roundedRect(lx - 10, barY - 13, tw + 10, 24, 4, 4, "F");
      doc.setFont(FONT, "bold"); doc.setFontSize(12); doc.setTextColor(...WHITE);
      doc.text("Total", lx, barY + 3); doc.text(fmt(data.total), vx, barY + 3, { align: "right" });
      y = barY + 24;
    } else if (ds.totals === "box") {
      doc.setDrawColor(...LINE); doc.setLineWidth(1); doc.roundedRect(lx - 12, y - 14, tw + 12, 66, 5, 5, "S");
      rows(y);
      doc.setDrawColor(...accent); doc.setLineWidth(1.5); doc.line(lx, y + 24, vx, y + 24);
      doc.setFont(FONT, "bold"); doc.setFontSize(12); doc.setTextColor(...INK); doc.text("Total", lx, y + 40); doc.setTextColor(...accent); doc.text(fmt(data.total), vx, y + 40, { align: "right" });
      y += 64;
    } else {
      rows(y);
      doc.setDrawColor(...accent); doc.setLineWidth(1); doc.line(lx, y + 24, vx, y + 24);
      doc.setFont(FONT, "bold"); doc.setFontSize(12); doc.setTextColor(...INK); doc.text("Total", lx, y + 40); doc.setTextColor(...accent); doc.text(fmt(data.total), vx, y + 40, { align: "right" });
      y += 60;
    }
  };

  const richBody = (html: string) => {
    const lines = htmlToLines(html);
    if (!lines.length) { para("—", 9.5, FAINT); return; }
    for (const ln of lines) {
      const bullet = ln.startsWith("• ");
      para(bullet ? ln : ln, 10.5, SUB, 1.5, bullet ? M + 8 : M, bullet ? contentW - 8 : contentW);
    }
  };

  // ── Blocks ──
  for (const b of blocks) {
    if (b.type === "page_break") { doc.addPage(); y = 56; continue; }
    if (b.type === "divider") { ensure(14); doc.setDrawColor(...LINE); doc.setLineWidth(1); doc.line(M, y, pageW - M, y); y += 14; continue; }

    if (b.type === "heading") {
      const lvl = b.settings?.level ?? 2; const size = lvl === 1 ? 20 : lvl === 2 ? 15 : 12.5;
      ensure(size * 1.4); doc.setFont(HEAD, "bold"); doc.setFontSize(size); doc.setTextColor(...INK);
      const align = b.settings?.align ?? "left";
      const x = align === "center" ? pageW / 2 : align === "right" ? pageW - M : M;
      doc.text(b.content || b.title, x, y, { align }); y += size * 1.4 + 4; continue;
    }

    if (RICH_BLOCK_TYPES.includes(b.type)) { if (b.title) label(b.title); richBody(b.content); y += 8; continue; }

    if (b.type === "image") { if (b.images?.[0]?.src) { addImage(b.images[0].src, contentW * ((b.settings?.width ?? 100) / 100)); if (b.images[0].caption) para(b.images[0].caption, 9, MUTED); } y += 6; continue; }

    if (b.type === "image_gallery") {
      if (b.title) label(b.title);
      const imgs = (b.images ?? []).filter(im => im.src);
      const colW = (contentW - 10) / 2;
      for (let i = 0; i < imgs.length; i += 2) {
        const im0 = imgCache.get(imgs[i].src); const im1 = imgs[i + 1] ? imgCache.get(imgs[i + 1].src) : null;
        const h = 110; ensure(h + 8);
        if (im0) { try { doc.addImage(im0.data, "JPEG", M, y, colW, h); } catch { /* */ } }
        if (im1) { try { doc.addImage(im1.data, "JPEG", M + colW + 10, y, colW, h); } catch { /* */ } }
        y += h + 8;
      }
      y += 4; continue;
    }

    if (b.type === "equipment_card") {
      const s = b.settings ?? {};
      ensure(40); doc.setFont(HEAD, "bold"); doc.setFontSize(13); doc.setTextColor(...INK); doc.text(b.title, M, y); y += 16;
      if (s.brand || s.model) para([s.brand, s.model].filter(Boolean).join(" · "), 10, MUTED, 1.4);
      if (s.specs) para(s.specs, 11, SUB, 1.5);
      if (typeof s.price === "number" && s.price > 0) { doc.setFont(FONT, "bold"); doc.setFontSize(14); doc.setTextColor(...INK); ensure(18); doc.text(fmt(s.price), M, y); y += 18; }
      y += 6; continue;
    }

    if (b.type === "option_cards") {
      if (b.title) label(b.title);
      if (data.options.length === 0) { para("—", 9.5, FAINT); y += 6; continue; }
      for (const o of data.options) {
        ensure(28);
        if (o.tier) { doc.setFont(FONT, "bold"); doc.setFontSize(8); doc.setTextColor(...accent); doc.text(`${o.tier.toUpperCase()}${o.selected ? " · SELECTED" : ""}`, M, y); y += 12; }
        doc.setFont(HEAD, "bold"); doc.setFontSize(13); doc.setTextColor(...INK);
        doc.text(o.name, M, y);
        doc.setFont(FONT, "bold"); doc.setFontSize(13); doc.setTextColor(...INK);
        doc.text(`$${o.price.toLocaleString()}`, pageW - M, y, { align: "right" }); y += 14;
        const meta = [o.brand, o.model].filter(Boolean).join(" · ");
        if (meta) para(meta, 10, MUTED, 1.4);
        if (o.monthlyPrice) { doc.setFont(FONT, "bold"); doc.setFontSize(10); doc.setTextColor(...accent); ensure(13); doc.text(`$${o.monthlyPrice}/mo`, pageW - M, y, { align: "right" }); y += 13; }
        (o.includes ?? []).forEach(inc => para(`• ${inc}`, 10, SUB, 1.4, M + 8, contentW - 8));
        y += 6;
        doc.setDrawColor(...LINE); doc.setLineWidth(0.5); ensure(6); doc.line(M, y, pageW - M, y); y += 8;
      }
      continue;
    }

    if (b.type === "line_items") {
      if (b.title) label(b.title);
      const base = data.lineItems.filter(li => !li.optional);
      if (base.length) {
        autoTable(doc, {
          startY: y, margin: { left: M, right: M },
          head: [["Description", "Qty", "Unit", "Amount"]],
          body: base.map(li => [li.name && li.description && li.name !== li.description ? `${li.name}\n${li.description}` : (li.name || li.description), String(li.quantity), fmt(li.unitPrice), fmt(li.total)]),
          styles: { font: FONT, fontSize: 9, cellPadding: 6, textColor: INK, lineColor: LINE, lineWidth: 0.5 },
          headStyles: { fillColor: [249, 250, 251], textColor: MUTED, fontStyle: "bold", fontSize: 8 },
          columnStyles: { 0: { cellWidth: "auto" }, 1: { halign: "right", cellWidth: 50 }, 2: { halign: "right", cellWidth: 80 }, 3: { halign: "right", cellWidth: 90 } },
          theme: "grid",
        });
        y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 14;
      } else para("No line items.", 10, MUTED);
      totals();
      const optional = data.lineItems.filter(li => li.optional);
      if (optional.length) {
        ensure(16); doc.setFont(FONT, "bold"); doc.setFontSize(8.5); doc.setTextColor(...MUTED); doc.text("OPTIONAL ADD-ONS", M, y); y += 12;
        optional.forEach(li => { ensure(13); doc.setFont(FONT, "normal"); doc.setFontSize(9.5); doc.setTextColor(...SUB); doc.text(`${li.name ?? li.description} ×${li.quantity}`, M, y); doc.text(fmt(li.total), pageW - M, y, { align: "right" }); y += 13; });
      }
      y += 8; continue;
    }

    if (b.type === "price_summary") {
      if (b.title) label(b.title);
      const base = data.lineItems.filter(li => !li.optional);
      if ((b.settings?.itemized ?? true) && base.length) {
        base.forEach(li => { ensure(15); doc.setFont(FONT, "normal"); doc.setFontSize(10); doc.setTextColor(...INK); doc.text(li.name ?? li.description ?? "", M, y); doc.setFont(FONT, "bold"); doc.text(fmt(li.total), pageW - M, y, { align: "right" }); doc.setDrawColor(...LINE); doc.setLineWidth(0.5); doc.line(M, y + 4, pageW - M, y + 4); y += 15; });
        y += 4;
      }
      totals();
      if (b.settings?.showMonthly && data.monthly) { doc.setFont(FONT, "bold"); doc.setFontSize(10); doc.setTextColor(...accent); ensure(14); doc.text(`or about ${fmt(data.monthly)}/mo with financing`, pageW - M, y, { align: "right" }); y += 14; }
      y += 8; continue;
    }

    if (b.type === "approval_signature") {
      if (b.title) label(b.title);
      if (b.content) para(b.content, 10, SUB, 1.5);
      ensure(50); y += 18;
      const colW = (contentW - 40) / 2;
      doc.setDrawColor(...INK); doc.setLineWidth(0.75); doc.line(M, y, M + colW, y); doc.line(M + colW + 40, y, pageW - M, y);
      doc.setFont(FONT, "normal"); doc.setFontSize(8); doc.setTextColor(...MUTED);
      doc.text("Customer Signature", M, y + 12); doc.text("Date", M + colW + 40, y + 12); y += 28; continue;
    }
  }

  if (data.customerNotes) { y += 4; para(data.customerNotes, 9.5, SUB, 1.5); }

  // ── Footer + page numbers ──
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    if (data.branding.footer) { doc.setFont(FONT, "normal"); doc.setFontSize(7.5); doc.setTextColor(...FAINT); doc.text(data.branding.footer, pageW / 2, pageH - 30, { align: "center", maxWidth: contentW }); }
    doc.setFontSize(7.5); doc.setTextColor(...FAINT); doc.text(`${p} / ${pages}`, pageW - M, pageH - 30, { align: "right" });
  }

  // ── Stamp (page 1) ──
  if (data.stamp) {
    doc.setPage(1);
    const cx = pageW / 2, cy = pageH / 2;
    doc.setTextColor(5, 150, 105); doc.setDrawColor(5, 150, 105); doc.setFont("helvetica", "bold");
    const F = 50; doc.setFontSize(F);
    const tw = doc.getTextWidth(data.stamp);
    doc.text(data.stamp, cx - tw / 2, cy, { angle: 18 });
  }

  doc.save(`${(data.quoteNumber || "Proposal").replace(/[^\w.-]+/g, "-")}.pdf`);
}
