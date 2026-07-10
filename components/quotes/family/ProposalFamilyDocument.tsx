"use client";

// Family-based proposal renderer — the new layout engine.
//
// Unlike the legacy ProposalDocument (one structure, cosmetic skins), this renders
// genuinely different LAYOUTS per Template Family, composed from a shared library
// of reusable blocks (Header, Customer Info, Narrative, Comparison, Line Items,
// Pricing Summary, Financing, Warranty, Terms, Signature, Gallery). A Style
// Variant (skin) themes fonts / accent intensity / dividers without changing the
// structure.
//
// Phase 1 implements two structurally-opposite families:
//   • classic     — one-column document, letterhead, line-item table, inline total
//   • comparison  — presentation layout, hero header, 3 side-by-side option cards,
//                   summary-band total
//
// Driven by the same ProposalDocData the legacy renderer uses, so it can later
// take over the live quote/PDF path. Paper palette is hard-coded (a proposal is
// "paper", independent of app theme).

import { fmt } from "@/lib/quotes/data";
import { INTERNAL_SECTION_KEYS, type SectionKey } from "@/lib/proposals/data";
import { DEFAULT_FAMILY, VARIANTS, type TemplateFamily, type VariantSkin } from "@/lib/proposals/families";
import type { ProposalDocData } from "@/lib/quotes/proposalDoc";
import type { QuoteOption } from "@/lib/quotes/data";

const INK = "#111827";
const SUB = "#374151";
const MUTED = "#6b7280";
const FAINT = "#9ca3af";
const LINE = "#e5e7eb";
const SOFT = "#f9fafb";

interface Ctx {
  data: ProposalDocData;
  accent: string;
  skin: VariantSkin;
  family: TemplateFamily;
  visible: Set<SectionKey>;
  body: (key: SectionKey) => string;
  label: (key: SectionKey, fallback: string) => string;
}

export default function ProposalFamilyDocument({
  data, family = DEFAULT_FAMILY, variant, shadow = true,
}: { data: ProposalDocData; family?: TemplateFamily; variant?: VariantSkin; shadow?: boolean }) {
  const accent = data.branding.accentColor || "#0f8578";
  const skin = variant ?? VARIANTS[family.defaultVariant];

  const visibleSections = data.sections.filter(s => s.visible && !INTERNAL_SECTION_KEYS.includes(s.key as SectionKey));
  const visible = new Set<SectionKey>(visibleSections.map(s => s.key as SectionKey));
  const bodyMap = new Map<SectionKey, string>(visibleSections.map(s => [s.key as SectionKey, s.body]));
  const labelMap = new Map<SectionKey, string>(visibleSections.map(s => [s.key as SectionKey, s.label]));

  const ctx: Ctx = {
    data, accent, skin, family, visible,
    body: k => bodyMap.get(k) ?? "",
    label: (k, fb) => labelMap.get(k) || fb,
  };

  return (
    <div className="proposal-sheet mx-auto relative"
      style={{
        width: "100%", maxWidth: "816px", backgroundColor: "#ffffff", color: INK, fontFamily: skin.fontFamily,
        boxShadow: shadow ? "0 8px 32px rgba(0,0,0,0.16)" : "none",
        borderRadius: shadow ? "10px" : "0", overflow: "hidden",
      }}>
      {/* Layout is chosen by the family's STRUCTURE, not its id: any family whose
          options read as side-by-side comparison cards (comparison, offer/financing)
          uses the presentation layout; everything else is the one-column document
          (classic, package-stack, visual, technical, scope, minimal). */}
      {family.optionTreatment === "comparison-cards" ? <ComparisonLayout ctx={ctx} /> : <ClassicLayout ctx={ctx} />}

      {data.stamp && (
        <div aria-hidden style={{
          position: "absolute", top: "44%", left: "50%", transform: "translate(-50%,-50%) rotate(-18deg)",
          border: "4px solid #059669", color: "#059669", opacity: 0.85,
          fontSize: "44px", fontWeight: 800, letterSpacing: "0.05em", padding: "4px 22px", borderRadius: "8px", pointerEvents: "none",
        }}>{data.stamp}</div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════
//  CLASSIC — one-column document
// ══════════════════════════════════════════════════════════
// Body sections that flow in the ORDER of the document's section list. The
// header, cover, customer/property grid, and signature stay pinned — everything
// between them renders top-to-bottom exactly as the template orders it.
const CLASSIC_FLOW: SectionKey[] = [
  "problem_need", "inspection_findings", "recommended_solution", "scope_of_work",
  "custom_text", "optional_addons", "gbb_options", "line_items",
  "financing_note", "warranty", "terms",
];

function ClassicLayout({ ctx }: { ctx: Ctx }) {
  const { data, skin, visible } = ctx;
  const pad = "44px 56px 52px";
  // Auto-hide rules: a free-text section with no wording is dropped; option/line
  // sections are dropped when there's nothing to show.
  const showSection = (k: SectionKey) => visible.has(k) && shows(ctx, k);
  const flow = data.sections.filter(s => s.visible).map(s => s.key as SectionKey).filter(k => CLASSIC_FLOW.includes(k));
  return (
    <div>
      <LetterheadHeader ctx={ctx} />
      <div style={{ padding: pad, paddingTop: skin.accentFill ? "32px" : pad }}>
        {visible.has("cover_header") && <CoverTitle ctx={ctx} />}

        <div style={{ display: "grid", gridTemplateColumns: visible.has("property_info") ? "1fr 1fr" : "1fr", gap: "20px", marginBottom: "8px" }}>
          {visible.has("customer_info") && <CustomerInfo ctx={ctx} />}
          {visible.has("property_info") && <PropertyInfo ctx={ctx} />}
        </div>

        {flow.map((k, i) => {
          if (!showSection(k)) return null;
          if (k === "gbb_options") return <StackedOptions key={`${k}-${i}`} ctx={ctx} />;
          if (k === "line_items") return <LineItemsTable key={`${k}-${i}`} ctx={ctx} withTotals />;
          return <Narrative key={`${k}-${i}`} ctx={ctx} sectionKey={k} small={k === "terms"} />;
        })}

        {visible.has("approval") && <Signature ctx={ctx} />}

        {data.branding.footer && (
          <p style={{ fontSize: "10px", color: FAINT, textAlign: "center", marginTop: "40px", paddingTop: "16px", borderTop: `1px solid ${LINE}` }}>{data.branding.footer}</p>
        )}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════
//  COMPARISON — presentation layout
// ══════════════════════════════════════════════════════════
// Narrative sections flow in the template's order here too; the presentation
// scaffolding (hero, customer strip, summary band, financing, warranty/terms,
// signature) keeps its fixed positions.
const COMPARISON_FLOW: SectionKey[] = [
  "problem_need", "inspection_findings", "recommended_solution", "scope_of_work",
  "custom_text", "optional_addons", "gbb_options",
];

function ComparisonLayout({ ctx }: { ctx: Ctx }) {
  const { data, visible } = ctx;
  const hasOptions = (data.options?.length ?? 0) > 0;
  const showSection = (k: SectionKey) => visible.has(k) && shows(ctx, k);
  const showWarranty = showSection("warranty");
  const showTerms = showSection("terms");
  const flow = data.sections.filter(s => s.visible).map(s => s.key as SectionKey).filter(k => COMPARISON_FLOW.includes(k));
  return (
    <div>
      <HeroHeader ctx={ctx} />
      <div style={{ padding: "26px 48px 48px" }}>
        {visible.has("customer_info") && <CustomerStrip ctx={ctx} />}

        {flow.map((k, i) => {
          if (k === "gbb_options") return hasOptions ? <ComparisonCards key={`${k}-${i}`} ctx={ctx} /> : null;
          return showSection(k) ? <Narrative key={`${k}-${i}`} ctx={ctx} sectionKey={k} /> : null;
        })}

        {/* Options with no gbb section in the list still get their centerpiece */}
        {hasOptions && !flow.includes("gbb_options") && <ComparisonCards ctx={ctx} />}

        {visible.has("line_items") && <SummaryBand ctx={ctx} />}

        {showSection("financing_note") && <FinancingCallout ctx={ctx} />}

        <div style={{ display: "grid", gridTemplateColumns: showWarranty && showTerms ? "1fr 1fr" : "1fr", gap: "20px", marginTop: "6px" }}>
          {showWarranty && <Narrative ctx={ctx} sectionKey="warranty" small />}
          {showTerms && <Narrative ctx={ctx} sectionKey="terms" small />}
        </div>

        {visible.has("approval") && <Signature ctx={ctx} />}

        {data.branding.footer && (
          <p style={{ fontSize: "10px", color: FAINT, textAlign: "center", marginTop: "36px", paddingTop: "16px", borderTop: `1px solid ${LINE}` }}>{data.branding.footer}</p>
        )}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════
//  REUSABLE BLOCKS
// ══════════════════════════════════════════════════════════

// ── Headers ──
function LetterheadHeader({ ctx }: { ctx: Ctx }) {
  const { data, accent, skin } = ctx;
  const b = data.branding;
  const hf = skin.headingFamily;
  // Bold/accentFill skins get a filled letterhead band; others a clean rule.
  if (skin.accentFill) {
    return (
      <div style={{ background: accent, color: "#fff", padding: "30px 56px 26px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "16px" }}>
          <div>
            {b.logoUrl
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={b.logoUrl} alt={b.companyName} style={{ maxHeight: "42px", marginBottom: "6px", filter: "brightness(0) invert(1)" }} />
              : <p style={{ fontSize: "22px", fontWeight: 800, fontFamily: hf, lineHeight: 1.1 }}>{b.companyName}</p>}
            <p style={{ fontSize: "11px", color: "rgba(255,255,255,0.85)", marginTop: "5px" }}>{b.companyInfo}</p>
            <p style={{ fontSize: "11px", color: "rgba(255,255,255,0.85)" }}>{b.contactInfo}</p>
          </div>
          <div style={{ textAlign: "right" }}>
            <p style={{ fontSize: "13px", fontWeight: 700, letterSpacing: "0.08em" }}>PROPOSAL</p>
            <p style={{ fontSize: "11px", color: "rgba(255,255,255,0.85)", marginTop: "2px" }}>{data.quoteNumber}</p>
            {data.expiresAt && <p style={{ fontSize: "11px", color: "rgba(255,255,255,0.85)" }}>Valid until {data.expiresAt}</p>}
          </div>
        </div>
      </div>
    );
  }
  const serif = skin.headingFamily === VARIANTS.executive.headingFamily;
  return (
    <div style={{ padding: "40px 56px 0" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "16px" }}>
        <div>
          {b.logoUrl
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={b.logoUrl} alt={b.companyName} style={{ maxHeight: "44px", marginBottom: "6px" }} />
            : <p style={{ fontSize: serif ? "24px" : "20px", fontWeight: serif ? 700 : 800, color: serif ? INK : accent, fontFamily: hf, lineHeight: 1.1 }}>{b.companyName}</p>}
          <p style={{ fontSize: "11px", color: MUTED, marginTop: "4px" }}>{b.companyInfo}</p>
          <p style={{ fontSize: "11px", color: MUTED }}>{b.contactInfo}</p>
          {b.licenseNumber && <p style={{ fontSize: "10px", color: FAINT, marginTop: "2px" }}>Lic. {b.licenseNumber}</p>}
        </div>
        <div style={{ textAlign: "right", fontFamily: hf }}>
          <p style={{ fontSize: "13px", fontWeight: 700, letterSpacing: "0.08em", color: INK }}>PROPOSAL</p>
          <p style={{ fontSize: "11px", color: MUTED, marginTop: "2px" }}>{data.quoteNumber}</p>
          {data.createdAt && <p style={{ fontSize: "11px", color: MUTED }}>Date: {data.createdAt}</p>}
          {data.expiresAt && <p style={{ fontSize: "11px", color: MUTED }}>Valid until: {data.expiresAt}</p>}
        </div>
      </div>
      {serif
        ? <><div style={{ borderTop: `1px solid ${accent}`, marginTop: "16px" }} /><div style={{ borderTop: `1px solid ${accent}`, marginTop: "3px", opacity: 0.5 }} /></>
        : <div style={{ height: "2px", backgroundColor: accent, opacity: 0.85, marginTop: "16px" }} />}
    </div>
  );
}

function HeroHeader({ ctx }: { ctx: Ctx }) {
  const { data, accent, skin } = ctx;
  const b = data.branding;
  const hf = skin.headingFamily;
  // Warm skin softens to a tinted gradient; others use a full accent band.
  const bg = skin.tone === "warm"
    ? `linear-gradient(135deg, ${accent}1f, ${accent}0a)`
    : `linear-gradient(120deg, ${accent}, ${shade(accent)})`;
  const onAccent = skin.tone !== "warm";
  const fg = onAccent ? "#fff" : INK;
  const dim = onAccent ? "rgba(255,255,255,0.85)" : MUTED;
  return (
    <div style={{ background: bg, color: fg, padding: "34px 48px 30px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "16px" }}>
        {b.logoUrl
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={b.logoUrl} alt={b.companyName} style={{ maxHeight: "40px", filter: onAccent ? "brightness(0) invert(1)" : "none" }} />
          : <p style={{ fontSize: "17px", fontWeight: 800, fontFamily: hf }}>{b.companyName}</p>}
        <div style={{ textAlign: "right" }}>
          <p style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: dim }}>Proposal</p>
          <p style={{ fontSize: "11px", color: dim }}>{data.quoteNumber}</p>
        </div>
      </div>
      <p style={{ fontSize: "30px", fontWeight: 800, fontFamily: hf, lineHeight: 1.12, marginTop: "20px", maxWidth: "78%" }}>{data.title || "Your Options"}</p>
      <p style={{ fontSize: "13px", color: dim, marginTop: "8px" }}>
        Prepared for <span style={{ fontWeight: 700, color: fg }}>{data.customerName}</span>
        {data.expiresAt ? `  ·  Valid until ${data.expiresAt}` : ""}
      </p>
    </div>
  );
}

// ── Cover / customer / property ──
function CoverTitle({ ctx }: { ctx: Ctx }) {
  const { data, skin } = ctx;
  const body = ctx.body("cover_header");
  return (
    <div style={{ marginBottom: "24px" }}>
      <p style={{ fontSize: "25px", fontWeight: 800, color: INK, lineHeight: 1.15, fontFamily: skin.headingFamily }}>{data.title || "Proposal"}</p>
      {body && <p style={{ fontSize: "13px", color: SUB, marginTop: "8px", lineHeight: 1.6 }}>{body}</p>}
      <p style={{ fontSize: "11px", color: MUTED, marginTop: "10px" }}>Prepared for <span style={{ fontWeight: 600, color: INK }}>{data.customerName}</span></p>
    </div>
  );
}

function CustomerInfo({ ctx }: { ctx: Ctx }) {
  const { data } = ctx;
  return (
    <div style={{ marginBottom: "20px" }}>
      <Label ctx={ctx} sectionKey="customer_info" fallback="Customer" />
      <p style={{ fontSize: "14px", fontWeight: 600, color: INK }}>{data.customerName}</p>
      {data.assignedTo && <p style={{ fontSize: "12px", color: MUTED }}>Salesperson: {data.assignedTo}</p>}
    </div>
  );
}

function PropertyInfo({ ctx }: { ctx: Ctx }) {
  const { data } = ctx;
  return (
    <div style={{ marginBottom: "20px" }}>
      <Label ctx={ctx} sectionKey="property_info" fallback="Property" />
      <p style={{ fontSize: "13px", color: data.propertyLabel ? INK : MUTED }}>{data.propertyLabel ?? "—"}</p>
    </div>
  );
}

function CustomerStrip({ ctx }: { ctx: Ctx }) {
  const { data, accent } = ctx;
  const cell = (k: string, v?: string) => v ? (
    <div><p style={{ fontSize: "9px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: MUTED }}>{k}</p><p style={{ fontSize: "12.5px", fontWeight: 600, color: INK, marginTop: "1px" }}>{v}</p></div>
  ) : null;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "28px", padding: "12px 16px", borderRadius: `${ctx.skin.radius}px`, backgroundColor: SOFT, border: `1px solid ${LINE}`, borderLeft: `3px solid ${accent}`, marginBottom: "22px" }}>
      {cell("Prepared for", data.customerName)}
      {cell("Property", data.propertyLabel)}
      {cell("Salesperson", data.assignedTo)}
      {cell("Valid until", data.expiresAt)}
    </div>
  );
}

// ── Narrative ──
function Narrative({ ctx, sectionKey, small }: { ctx: Ctx; sectionKey: SectionKey; small?: boolean }) {
  const body = ctx.body(sectionKey);
  const label = ctx.label(sectionKey, sectionKey);
  return (
    <div style={{ marginBottom: "22px" }}>
      <Label ctx={ctx} sectionKey={sectionKey} fallback={label} />
      {body
        ? <p style={{ fontSize: small ? "11.5px" : "13px", color: SUB, lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{body}</p>
        : <p style={{ fontSize: "12.5px", color: FAINT, fontStyle: "italic" }}>—</p>}
    </div>
  );
}

// ── Options: stacked (classic) ──
function StackedOptions({ ctx }: { ctx: Ctx }) {
  const opts = ctx.data.options ?? [];
  if (opts.length === 0) return null;
  const { accent, skin } = ctx;
  return (
    <div style={{ marginBottom: "22px" }}>
      <Label ctx={ctx} sectionKey="gbb_options" fallback="Options" />
      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        {opts.map(o => (
          <div key={o.id} style={{ display: "flex", gap: "14px", alignItems: "center", border: `1px solid ${o.featured ? accent : LINE}`, borderRadius: `${skin.radius}px`, padding: "12px 14px", backgroundColor: o.featured ? `${accent}08` : "#fff" }}>
            {o.image && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={o.image} alt={o.name} style={{ width: "72px", height: "56px", objectFit: "cover", borderRadius: "6px", flexShrink: 0 }} />
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              {o.tier && <span style={{ fontSize: "9px", fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: accent }}>{o.tier}{o.featured ? " · Recommended" : ""}</span>}
              <p style={{ fontSize: "13.5px", fontWeight: 700, color: INK, fontFamily: skin.headingFamily }}>{o.name}</p>
              {o.description && <p style={{ fontSize: "11.5px", color: MUTED, marginTop: "1px" }}>{o.description}</p>}
            </div>
            <div style={{ textAlign: "right", flexShrink: 0 }}>
              <p style={{ fontSize: "18px", fontWeight: 800, color: INK }}>${o.price.toLocaleString()}</p>
              {o.monthlyPrice ? <p style={{ fontSize: "11px", fontWeight: 600, color: accent }}>${o.monthlyPrice}/mo</p> : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Options: comparison cards (comparison family centerpiece) ──
function ComparisonCards({ ctx }: { ctx: Ctx }) {
  const opts = ctx.data.options ?? [];
  const { accent, skin } = ctx;
  if (opts.length === 0) {
    return (<div style={{ marginBottom: "24px" }}><Label ctx={ctx} sectionKey="gbb_options" fallback="Your Options" /><p style={{ fontSize: "12.5px", color: FAINT, fontStyle: "italic" }}>—</p></div>);
  }
  const body = ctx.body("gbb_options");
  return (
    <div style={{ marginBottom: "26px" }}>
      <Label ctx={ctx} sectionKey="gbb_options" fallback="Choose Your Option" />
      {body && <p style={{ fontSize: "12.5px", color: SUB, marginBottom: "14px", lineHeight: 1.6 }}>{body}</p>}
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min(opts.length, 3)}, 1fr)`, gap: "12px", alignItems: "stretch" }}>
        {opts.slice(0, 3).map(o => <ComparisonCard key={o.id} o={o} accent={accent} skin={skin} />)}
      </div>
    </div>
  );
}

function ComparisonCard({ o, accent, skin }: { o: QuoteOption; accent: string; skin: VariantSkin }) {
  const featured = !!o.featured;
  return (
    <div style={{
      position: "relative", display: "flex", flexDirection: "column",
      border: `1.5px solid ${featured ? accent : LINE}`, borderRadius: `${skin.radius + 2}px`,
      overflow: "hidden", backgroundColor: "#fff",
      boxShadow: featured ? `0 10px 28px ${accent}26` : "0 1px 3px rgba(0,0,0,0.05)",
      transform: featured ? "translateY(-4px)" : "none",
    }}>
      {featured && <div style={{ backgroundColor: accent, color: "#fff", fontSize: "9px", fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", textAlign: "center", padding: "4px 0" }}>Recommended</div>}
      {o.image && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={o.image} alt={o.name} style={{ width: "100%", height: "120px", objectFit: "cover", display: "block" }} />
      )}
      <div style={{ padding: "13px 14px", display: "flex", flexDirection: "column", flex: 1 }}>
        {o.tier && <p style={{ fontSize: "9.5px", fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: accent }}>{o.tier}</p>}
        <p style={{ fontSize: "14px", fontWeight: 700, color: INK, lineHeight: 1.2, marginTop: "2px", fontFamily: skin.headingFamily }}>{o.name}</p>
        {(o.brand || o.model) && <p style={{ fontSize: "10.5px", color: MUTED, marginTop: "2px" }}>{[o.brand, o.model].filter(Boolean).join(" · ")}</p>}
        <div style={{ marginTop: "10px", paddingTop: "10px", borderTop: `1px solid ${LINE}` }}>
          <p style={{ fontSize: "23px", fontWeight: 800, color: INK, lineHeight: 1 }}>${o.price.toLocaleString()}</p>
          {o.monthlyPrice ? <p style={{ fontSize: "11.5px", fontWeight: 700, color: accent, marginTop: "3px" }}>${o.monthlyPrice}/mo financed</p> : null}
        </div>
        {(o.efficiency || o.warranty) && <p style={{ fontSize: "10.5px", color: MUTED, marginTop: "8px" }}>{[o.efficiency, o.warranty].filter(Boolean).join(" · ")}</p>}
        {o.includes && o.includes.length > 0 && (
          <ul style={{ listStyle: "none", padding: 0, margin: "10px 0 0" }}>
            {o.includes.map((inc, i) => (
              <li key={i} style={{ fontSize: "11px", color: SUB, padding: "3px 0 3px 16px", position: "relative", lineHeight: 1.35 }}>
                <span style={{ position: "absolute", left: 0, color: accent, fontWeight: 800 }}>✓</span>{inc}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

// ── Line items + inline totals (classic) ──
function LineItemsTable({ ctx, withTotals }: { ctx: Ctx; withTotals?: boolean }) {
  const { data } = ctx;
  const base = data.lineItems.filter(li => !li.optional);
  return (
    <div style={{ marginBottom: "22px" }}>
      <Label ctx={ctx} sectionKey="line_items" fallback="Investment" />
      {base.length === 0 ? <p style={{ fontSize: "13px", color: MUTED }}>No line items.</p> : (
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12.5px" }}>
          <thead>
            <tr style={{ backgroundColor: SOFT }}>
              <th style={thStyle("left")}>DESCRIPTION</th>
              <th style={{ ...thStyle("right"), width: "48px" }}>QTY</th>
              <th style={{ ...thStyle("right"), width: "84px" }}>UNIT</th>
              <th style={{ ...thStyle("right"), width: "92px" }}>AMOUNT</th>
            </tr>
          </thead>
          <tbody>
            {base.map(li => (
              <tr key={li.id}>
                <td style={tdStyle()}>
                  <span style={{ fontWeight: 600 }}>{li.name ?? li.description}</span>
                  {li.name && li.description && li.name !== li.description && <span style={{ display: "block", color: MUTED, fontSize: "11.5px" }}>{li.description}</span>}
                </td>
                <td style={{ ...tdStyle(), textAlign: "right", color: SUB }}>{li.quantity}</td>
                <td style={{ ...tdStyle(), textAlign: "right", color: SUB }}>{fmt(li.unitPrice)}</td>
                <td style={{ ...tdStyle(), textAlign: "right", fontWeight: 600 }}>{fmt(li.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {withTotals && <InlineTotals ctx={ctx} />}
    </div>
  );
}

function InlineTotals({ ctx }: { ctx: Ctx }) {
  const { data, accent, skin } = ctx;
  const boxed = skin.id === "executive" || skin.id === "warm";
  const row = (l: string, v: string) => (
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12.5px", padding: "3px 0" }}>
      <span style={{ color: MUTED }}>{l}</span><span style={{ color: SUB }}>{v}</span>
    </div>
  );
  return (
    <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "12px" }}>
      <div style={boxed
        ? { width: "262px", border: `1px solid ${LINE}`, borderRadius: `${skin.radius}px`, padding: "12px 14px", backgroundColor: SOFT }
        : { width: "248px" }}>
        {row("Subtotal", fmt(data.subtotal))}
        {row(`Tax (${data.taxRatePct}%)`, fmt(data.tax))}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "6px", paddingTop: "8px", borderTop: `2px solid ${accent}` }}>
          <span style={{ fontSize: "13px", fontWeight: 700, color: INK }}>Total</span>
          <span style={{ fontSize: "19px", fontWeight: 800, color: accent }}>{fmt(data.total)}</span>
        </div>
      </div>
    </div>
  );
}

// ── Summary band totals (comparison) ──
function SummaryBand({ ctx }: { ctx: Ctx }) {
  const { data, accent, skin } = ctx;
  return (
    <div style={{ marginTop: "8px", marginBottom: "22px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "16px", flexWrap: "wrap", padding: "16px 20px", borderRadius: `${skin.radius + 2}px`, background: skin.accentFill ? accent : `linear-gradient(120deg, ${accent}14, ${accent}06)`, border: skin.accentFill ? "none" : `1px solid ${accent}33` }}>
      <div>
        <p style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: skin.accentFill ? "rgba(255,255,255,0.85)" : MUTED }}>Your investment</p>
        <p style={{ fontSize: "12px", color: skin.accentFill ? "rgba(255,255,255,0.85)" : SUB, marginTop: "2px" }}>Subtotal {fmt(data.subtotal)} · Tax {fmt(data.tax)}</p>
      </div>
      <div style={{ textAlign: "right" }}>
        <p style={{ fontSize: "28px", fontWeight: 800, lineHeight: 1, color: skin.accentFill ? "#fff" : accent }}>{fmt(data.total)}</p>
      </div>
    </div>
  );
}

// ── Financing callout (comparison) ──
function FinancingCallout({ ctx }: { ctx: Ctx }) {
  const { accent, skin } = ctx;
  const body = ctx.body("financing_note");
  return (
    <div style={{ marginBottom: "20px", padding: "14px 16px", borderRadius: `${skin.radius}px`, backgroundColor: `${accent}0d`, border: `1px solid ${accent}2e`, display: "flex", gap: "12px", alignItems: "flex-start" }}>
      <div style={{ width: "30px", height: "30px", borderRadius: "8px", backgroundColor: accent, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, flexShrink: 0 }}>$</div>
      <div>
        <p style={{ fontSize: "12.5px", fontWeight: 700, color: INK }}>{ctx.label("financing_note", "Financing available")}</p>
        {body && <p style={{ fontSize: "12px", color: SUB, marginTop: "2px", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{body}</p>}
      </div>
    </div>
  );
}

// ── Signature ──
function Signature({ ctx }: { ctx: Ctx }) {
  const body = ctx.body("approval");
  return (
    <div style={{ marginTop: "26px" }}>
      <Label ctx={ctx} sectionKey="approval" fallback="Approval" />
      {body && <p style={{ fontSize: "12.5px", color: SUB, marginBottom: "16px", lineHeight: 1.6 }}>{body}</p>}
      <div style={{ display: "flex", gap: "40px", marginTop: "8px" }}>
        {["Customer Signature", "Date"].map(l => (
          <div key={l} style={{ flex: 1 }}>
            <div style={{ borderBottom: `1px solid ${INK}`, height: "32px" }} />
            <p style={{ fontSize: "10px", color: MUTED, marginTop: "4px" }}>{l}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Section label (skin-aware) ──
function Label({ ctx, sectionKey, fallback }: { ctx: Ctx; sectionKey: SectionKey; fallback: string }) {
  const { accent, skin } = ctx;
  const text = ctx.label(sectionKey, fallback);
  if (skin.labelCaps) {
    return <p style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: accent, marginBottom: "8px" }}>{text}</p>;
  }
  return (
    <p style={{ display: "inline-block", fontSize: "13px", fontWeight: 700, color: INK, marginBottom: "8px", paddingBottom: "2px", fontFamily: skin.headingFamily, borderBottom: skin.divider === "rule" ? `2px solid ${accent}` : skin.divider === "soft" ? `2px solid ${accent}55` : "none" }}>{text}</p>
  );
}

// ── helpers ──
// Does a section have anything to render? Free-text sections need wording; option
// sections need options; everything else is structural (always shows when visible).
function shows(ctx: Ctx, k: SectionKey): boolean {
  if (k === "gbb_options") return (ctx.data.options?.length ?? 0) > 0;
  if (k === "photos") return false; // no photo content wired into the doc yet
  const TEXT: SectionKey[] = ["problem_need", "inspection_findings", "recommended_solution", "scope_of_work", "financing_note", "warranty", "terms", "custom_text", "optional_addons"];
  if (TEXT.includes(k)) return Boolean(ctx.body(k).trim());
  return true;
}

const thStyle = (align: "left" | "right"): React.CSSProperties => ({
  textAlign: align, padding: "8px 10px", color: MUTED, fontSize: "10px", fontWeight: 700, letterSpacing: "0.06em", borderBottom: `1px solid ${LINE}`,
});
const tdStyle = (): React.CSSProperties => ({ padding: "8px 10px", color: INK, borderBottom: `1px solid ${LINE}` });

// Darken a hex accent ~14% for gradient ends.
function shade(hex: string): string {
  const m = hex.replace("#", "");
  if (m.length !== 6) return hex;
  const n = parseInt(m, 16);
  const r = Math.max(0, ((n >> 16) & 255) - 28);
  const g = Math.max(0, ((n >> 8) & 255) - 28);
  const b = Math.max(0, (n & 255) - 28);
  return `rgb(${r},${g},${b})`;
}
