"use client";

import { fmt } from "@/lib/quotes/data";
import { SECTION_LABELS, INTERNAL_SECTION_KEYS, type SectionKey } from "@/lib/proposals/data";
import { DEFAULT_DESIGN, type ProposalDesign, type ProposalDesignStyle } from "@/lib/proposals/designs";
import type { ProposalDocData } from "@/lib/quotes/proposalDoc";

// Professional, paper-styled proposal document (template path). Always renders on
// a white sheet with dark text (independent of app theme) so it looks like a real
// PDF in the preview, the print view, and exported PDF. Shared by all three.
//
// The DESIGN (lib/proposals/designs) themes the letterhead layout, fonts, section
// labels, and totals. Brand accent color comes from Proposal Branding.
// Palette is intentionally hard-coded (not theme vars) — a proposal is "paper".
const INK = "#111827";
const SUB = "#374151";
const MUTED = "#6b7280";
const FAINT = "#9ca3af";
const LINE = "#e5e7eb";
const SOFT = "#f9fafb";

export default function ProposalDocument({ data, shadow = true, design = DEFAULT_DESIGN }: { data: ProposalDocData; shadow?: boolean; design?: ProposalDesign }) {
  const accent = data.branding.accentColor || "#0f8578";
  const ds = design.style;
  const showStrip = ds.header === "band";
  // Internal-only sections (e.g. the pricing worksheet) never appear on the
  // customer-facing document — they're filtered out of preview / print / PDF.
  const visible = data.sections.filter(s => s.visible && !INTERNAL_SECTION_KEYS.includes(s.key as SectionKey));

  return (
    <div
      className="proposal-sheet mx-auto relative"
      style={{
        width: "100%", maxWidth: "816px", backgroundColor: "#ffffff", color: INK, fontFamily: ds.fontFamily,
        boxShadow: shadow ? "0 8px 32px rgba(0,0,0,0.16)" : "none",
        borderRadius: shadow ? "8px" : "0",
      }}
    >
      {showStrip && <div style={{ height: "6px", backgroundColor: accent, borderTopLeftRadius: shadow ? "8px" : 0, borderTopRightRadius: shadow ? "8px" : 0 }} />}

      <div style={{ padding: "44px 56px 56px" }}>
        <DocHeader data={data} accent={accent} ds={ds} shadow={shadow} />

        {/* ── Sections ── */}
        {visible.map((s, i) => (
          <div key={s.id ?? `${s.key}-${i}`} className="proposal-block" style={{ marginBottom: i === visible.length - 1 ? 0 : "24px" }}>
            <SectionContent data={data} sectionKey={s.key} label={s.label || SECTION_LABELS[s.key as SectionKey] || "Section"} body={s.body} accent={accent} ds={ds} />
          </div>
        ))}

        {/* ── Footer ── */}
        {data.branding.footer && (
          <p style={{ fontSize: "10px", color: FAINT, textAlign: "center", marginTop: "40px", paddingTop: "16px", borderTop: `1px solid ${LINE}` }}>
            {data.branding.footer}
          </p>
        )}
      </div>

      {/* ── Status stamp ── */}
      {data.stamp && (
        <div aria-hidden className="proposal-stamp" style={{
          position: "absolute", top: "44%", left: "50%", transform: "translate(-50%,-50%) rotate(-18deg)",
          border: "4px solid #059669", color: "#059669", opacity: 0.85,
          fontSize: "44px", fontWeight: 800, letterSpacing: "0.05em", padding: "4px 22px", borderRadius: "8px",
          pointerEvents: "none",
        }}>{data.stamp}</div>
      )}
    </div>
  );
}

// ─── Letterhead — varies by design ────────────────────────
function DocHeader({ data, accent, ds, shadow }: { data: ProposalDocData; accent: string; ds: ProposalDesignStyle; shadow: boolean }) {
  const hf = ds.headingFamily;
  const logo = data.branding.logoUrl;
  const company = data.branding.companyName;
  const license = data.branding.licenseNumber;
  const meta = (color: string, dim: string) => (
    <>
      <p style={{ fontSize: "13px", fontWeight: 700, letterSpacing: "0.08em", color }}>PROPOSAL</p>
      <p style={{ fontSize: "11px", color: dim, marginTop: "2px" }}>{data.quoteNumber}</p>
      {data.createdAt && <p style={{ fontSize: "11px", color: dim }}>Date: {data.createdAt}</p>}
      {data.expiresAt && <p style={{ fontSize: "11px", color: dim }}>Valid until: {data.expiresAt}</p>}
    </>
  );

  if (ds.header === "bold") {
    return (
      <div style={{ background: accent, color: "#fff", margin: "-44px -56px 28px", padding: "34px 56px 30px", borderTopLeftRadius: shadow ? "8px" : 0, borderTopRightRadius: shadow ? "8px" : 0 }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "16px" }}>
          <div>
            {logo
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={logo} alt={company} style={{ maxHeight: "44px", marginBottom: "6px", filter: "brightness(0) invert(1)" }} />
              : <p style={{ fontSize: "22px", fontWeight: 800, color: "#fff", lineHeight: 1.1, fontFamily: hf }}>{company}</p>}
            <p style={{ fontSize: "11px", color: "rgba(255,255,255,0.85)", marginTop: "6px" }}>{data.branding.companyInfo}</p>
            <p style={{ fontSize: "11px", color: "rgba(255,255,255,0.85)" }}>{data.branding.contactInfo}</p>
            {license && <p style={{ fontSize: "10px", color: "rgba(255,255,255,0.7)", marginTop: "2px" }}>Lic. {license}</p>}
          </div>
          <div style={{ textAlign: "right" }}>{meta("#fff", "rgba(255,255,255,0.85)")}</div>
        </div>
      </div>
    );
  }

  if (ds.header === "centered") {
    return (
      <div style={{ textAlign: "center", marginBottom: "26px" }}>
        {logo
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={logo} alt={company} style={{ maxHeight: "48px", marginBottom: "8px" }} />
          : <p style={{ fontSize: "22px", fontWeight: 800, color: accent, lineHeight: 1.1, fontFamily: hf }}>{company}</p>}
        <p style={{ fontSize: "11px", color: MUTED, marginTop: "4px" }}>{data.branding.companyInfo} · {data.branding.contactInfo}{license ? ` · Lic. ${license}` : ""}</p>
        <div style={{ width: "56px", height: "3px", backgroundColor: accent, borderRadius: "2px", margin: "16px auto" }} />
        <p style={{ fontSize: "13px", fontWeight: 700, letterSpacing: "0.18em", color: INK }}>PROPOSAL</p>
        <p style={{ fontSize: "11px", color: MUTED, marginTop: "2px" }}>
          {data.quoteNumber}{data.expiresAt ? ` · Valid until ${data.expiresAt}` : ""}
        </p>
      </div>
    );
  }

  if (ds.header === "serif") {
    return (
      <div style={{ marginBottom: "24px" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "16px" }}>
          <div>
            {logo
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={logo} alt={company} style={{ maxHeight: "46px", marginBottom: "6px" }} />
              : <p style={{ fontSize: "24px", fontWeight: 700, color: INK, lineHeight: 1.1, fontFamily: hf }}>{company}</p>}
            <p style={{ fontSize: "11px", color: MUTED, marginTop: "4px", fontFamily: hf }}>{data.branding.companyInfo}</p>
            <p style={{ fontSize: "11px", color: MUTED, fontFamily: hf }}>{data.branding.contactInfo}</p>
            {license && <p style={{ fontSize: "10px", color: FAINT, marginTop: "2px", fontFamily: hf }}>Lic. {license}</p>}
          </div>
          <div style={{ textAlign: "right", fontFamily: hf }}>{meta(INK, MUTED)}</div>
        </div>
        <div style={{ borderTop: `1px solid ${accent}`, marginTop: "18px" }} />
        <div style={{ borderTop: `1px solid ${accent}`, marginTop: "3px", opacity: 0.5 }} />
      </div>
    );
  }

  if (ds.header === "minimal") {
    return (
      <div style={{ marginBottom: "30px" }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: "16px" }}>
          {logo
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={logo} alt={company} style={{ maxHeight: "32px" }} />
            : <p style={{ fontSize: "12px", fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: INK, fontFamily: hf }}>{company}</p>}
          <p style={{ fontSize: "10px", letterSpacing: "0.16em", textTransform: "uppercase", color: FAINT }}>Proposal · {data.quoteNumber}</p>
        </div>
        <div style={{ borderTop: `1px solid ${LINE}`, marginTop: "12px" }} />
        <p style={{ fontSize: "11px", color: MUTED, marginTop: "10px" }}>
          {data.branding.companyInfo}{data.expiresAt ? ` · Valid until ${data.expiresAt}` : ""}
        </p>
      </div>
    );
  }

  // BAND (default)
  return (
    <div>
      <div className="flex items-start justify-between" style={{ marginBottom: "28px" }}>
        <div>
          {logo
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={logo} alt={company} style={{ maxHeight: "44px", marginBottom: "6px" }} />
            : <p style={{ fontSize: "20px", fontWeight: 800, color: accent, lineHeight: 1.1, fontFamily: hf }}>{company}</p>}
          <p style={{ fontSize: "11px", color: MUTED, marginTop: "4px" }}>{data.branding.companyInfo}</p>
          <p style={{ fontSize: "11px", color: MUTED }}>{data.branding.contactInfo}</p>
          {license && <p style={{ fontSize: "10px", color: FAINT, marginTop: "2px" }}>Lic. {license}</p>}
        </div>
        <div style={{ textAlign: "right" }}>{meta(INK, MUTED)}</div>
      </div>
      <div style={{ height: "2px", backgroundColor: accent, opacity: 0.85, marginBottom: "26px" }} />
    </div>
  );
}

// ─── Section label — varies by design ─────────────────────
function Label({ children, accent, ds }: { children: React.ReactNode; accent: string; ds: ProposalDesignStyle }) {
  if (ds.label === "bar") {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
        <span style={{ width: "3px", height: "15px", backgroundColor: accent, borderRadius: "2px" }} />
        <span style={{ fontSize: "12.5px", fontWeight: 700, color: INK, fontFamily: ds.headingFamily }}>{children}</span>
      </div>
    );
  }
  if (ds.label === "rule") {
    return <p style={{ display: "inline-block", fontSize: "12.5px", fontWeight: 700, color: INK, marginBottom: "8px", paddingBottom: "2px", borderBottom: `2px solid ${accent}`, fontFamily: ds.headingFamily }}>{children}</p>;
  }
  return <p style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: accent, marginBottom: "8px" }}>{children}</p>;
}

function SectionContent({ data, sectionKey, label, body, accent, ds }: {
  data: ProposalDocData; sectionKey: string; label: string; body: string; accent: string; ds: ProposalDesignStyle;
}) {
  // Cover / header — large title block
  if (sectionKey === "cover_header") {
    return (
      <div>
        <p style={{ fontSize: "24px", fontWeight: 800, color: INK, lineHeight: 1.15, fontFamily: ds.headingFamily }}>{data.title || "Proposal"}</p>
        {body && <p style={{ fontSize: "13px", color: SUB, marginTop: "8px", lineHeight: 1.6 }}>{body}</p>}
        <p style={{ fontSize: "11px", color: MUTED, marginTop: "10px" }}>Prepared for <span style={{ fontWeight: 600, color: INK }}>{data.customerName}</span></p>
      </div>
    );
  }
  if (sectionKey === "customer_info") {
    return (<div><Label accent={accent} ds={ds}>{label}</Label>
      <p style={{ fontSize: "14px", fontWeight: 600, color: INK }}>{data.customerName}</p>
      {data.locationName && <p style={{ fontSize: "12px", color: MUTED }}>{data.locationName}</p>}
      {data.assignedTo && <p style={{ fontSize: "12px", color: MUTED }}>Salesperson: {data.assignedTo}</p>}
    </div>);
  }
  if (sectionKey === "property_info") {
    return (<div><Label accent={accent} ds={ds}>{label}</Label>
      <p style={{ fontSize: "13px", color: data.propertyLabel ? INK : MUTED }}>{data.propertyLabel ?? "—"}</p>
    </div>);
  }
  if (sectionKey === "gbb_options") {
    const opts = data.options ?? [];
    if (opts.length === 0) return (<div><Label accent={accent} ds={ds}>{label}</Label><p style={{ fontSize: "12.5px", color: FAINT, fontStyle: "italic" }}>—</p></div>);
    return (
      <div>
        <Label accent={accent} ds={ds}>{label}</Label>
        {body && <p style={{ fontSize: "12.5px", color: SUB, marginBottom: "12px", lineHeight: 1.6 }}>{body}</p>}
        <div style={{ display: "flex", gap: "12px" }}>
          {opts.map(o => {
            const on = o.selected;
            return (
              <div key={o.id} style={{ flex: 1, border: `1.5px solid ${on ? accent : LINE}`, borderRadius: "8px", padding: "14px", backgroundColor: on ? `${accent}0d` : "#ffffff", breakInside: "avoid", overflow: "hidden" }}>
                {o.image && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={o.image} alt={o.name} style={{ width: "100%", height: "108px", objectFit: "cover", borderRadius: "6px", marginBottom: "10px", display: "block" }} />
                )}
                {o.tier && <p style={{ fontSize: "9px", fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: accent, marginBottom: "4px" }}>{o.tier}{on ? " · Selected" : ""}</p>}
                <p style={{ fontSize: "13.5px", fontWeight: 700, color: INK, lineHeight: 1.25, fontFamily: ds.headingFamily }}>{o.name}</p>
                {(o.brand || o.model) && <p style={{ fontSize: "10.5px", color: MUTED, marginTop: "2px" }}>{[o.brand, o.model].filter(Boolean).join(" · ")}</p>}
                <p style={{ fontSize: "20px", fontWeight: 800, color: INK, marginTop: "8px" }}>${o.price.toLocaleString()}</p>
                {o.monthlyPrice ? <p style={{ fontSize: "11px", fontWeight: 600, color: accent }}>${o.monthlyPrice}/mo financed</p> : null}
                {(o.efficiency || o.warranty) && <p style={{ fontSize: "10.5px", color: MUTED, marginTop: "6px" }}>{[o.efficiency, o.warranty].filter(Boolean).join(" · ")}</p>}
                {o.includes && o.includes.length > 0 && (
                  <ul style={{ listStyle: "none", padding: 0, margin: "8px 0 0" }}>
                    {o.includes.map((inc, i) => (
                      <li key={i} style={{ fontSize: "11px", color: SUB, padding: "2px 0", paddingLeft: "12px", position: "relative", lineHeight: 1.4 }}>
                        <span style={{ position: "absolute", left: 0, color: accent, fontWeight: 700 }}>✓</span>{inc}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }
  if (sectionKey === "optional_addons") {
    const addons = (data.options ?? []).filter(o => !o.tier);
    return (
      <div>
        <Label accent={accent} ds={ds}>{label}</Label>
        {body && <p style={{ fontSize: "12.5px", color: SUB, marginBottom: "10px", lineHeight: 1.6 }}>{body}</p>}
        {addons.length === 0 ? <p style={{ fontSize: "12.5px", color: FAINT, fontStyle: "italic" }}>—</p> : addons.map(o => (
          <div key={o.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", fontSize: "12.5px", padding: "5px 0", borderBottom: `1px solid ${LINE}` }}>
            <span style={{ color: INK }}><span style={{ fontWeight: 600 }}>{o.name}</span>{o.description ? <span style={{ color: MUTED }}> — {o.description}</span> : null}</span>
            <span style={{ color: INK, fontWeight: 600, whiteSpace: "nowrap", paddingLeft: "12px" }}>${o.price.toLocaleString()}{o.monthlyPrice ? ` · $${o.monthlyPrice}/mo` : ""}</span>
          </div>
        ))}
      </div>
    );
  }
  if (sectionKey === "line_items") {
    const base = data.lineItems.filter(li => !li.optional);
    const optional = data.lineItems.filter(li => li.optional);
    return (
      <div>
        <Label accent={accent} ds={ds}>{label}</Label>
        {base.length === 0 ? <p style={{ fontSize: "13px", color: MUTED }}>No line items.</p> : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12.5px" }}>
            <thead>
              <tr style={{ backgroundColor: SOFT }}>
                <th style={{ textAlign: "left", padding: "8px 10px", color: MUTED, fontSize: "10px", fontWeight: 700, letterSpacing: "0.06em", borderBottom: `1px solid ${LINE}` }}>DESCRIPTION</th>
                <th style={{ textAlign: "right", padding: "8px 10px", color: MUTED, fontSize: "10px", fontWeight: 700, width: "48px", borderBottom: `1px solid ${LINE}` }}>QTY</th>
                <th style={{ textAlign: "right", padding: "8px 10px", color: MUTED, fontSize: "10px", fontWeight: 700, width: "84px", borderBottom: `1px solid ${LINE}` }}>UNIT</th>
                <th style={{ textAlign: "right", padding: "8px 10px", color: MUTED, fontSize: "10px", fontWeight: 700, width: "92px", borderBottom: `1px solid ${LINE}` }}>AMOUNT</th>
              </tr>
            </thead>
            <tbody>
              {base.map(li => (
                <tr key={li.id} style={{ breakInside: "avoid" }}>
                  <td style={{ padding: "8px 10px", color: INK, borderBottom: `1px solid ${LINE}` }}>
                    <span style={{ fontWeight: 600 }}>{li.name ?? li.description}</span>
                    {li.name && li.description && li.name !== li.description && <span style={{ display: "block", color: MUTED, fontSize: "11.5px" }}>{li.description}</span>}
                  </td>
                  <td style={{ padding: "8px 10px", textAlign: "right", color: SUB, borderBottom: `1px solid ${LINE}` }}>{li.quantity}</td>
                  <td style={{ padding: "8px 10px", textAlign: "right", color: SUB, borderBottom: `1px solid ${LINE}` }}>{fmt(li.unitPrice)}</td>
                  <td style={{ padding: "8px 10px", textAlign: "right", color: INK, fontWeight: 600, borderBottom: `1px solid ${LINE}` }}>{fmt(li.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <Totals data={data} accent={accent} ds={ds} />

        {/* Optional add-ons */}
        {optional.length > 0 && (
          <div style={{ marginTop: "16px" }}>
            <p style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.08em", color: MUTED, marginBottom: "6px" }}>OPTIONAL ADD-ONS</p>
            {optional.map(li => (
              <div key={li.id} style={{ display: "flex", justifyContent: "space-between", fontSize: "12.5px", padding: "3px 0", color: SUB }}>
                <span>{li.name ?? li.description} <span style={{ color: FAINT }}>×{li.quantity}</span></span>
                <span>{fmt(li.total)}</span>
              </div>
            ))}
            <p style={{ fontSize: "10px", color: FAINT, marginTop: "4px" }}>Add-ons are not included in the total above.</p>
          </div>
        )}

        {data.customerNotes && <p style={{ fontSize: "12px", color: SUB, marginTop: "14px", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{data.customerNotes}</p>}
      </div>
    );
  }
  if (sectionKey === "approval") {
    return (
      <div>
        <Label accent={accent} ds={ds}>{label}</Label>
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
  // Generic narrative section
  return (
    <div>
      <Label accent={accent} ds={ds}>{label}</Label>
      {body
        ? <p style={{ fontSize: "13px", color: SUB, lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{body}</p>
        : <p style={{ fontSize: "12.5px", color: FAINT, fontStyle: "italic" }}>—</p>}
    </div>
  );
}

// ─── Totals — varies by design ────────────────────────────
function Totals({ data, accent, ds }: { data: ProposalDocData; accent: string; ds: ProposalDesignStyle }) {
  const small = (label: string, value: string) => (
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12.5px", padding: "3px 0" }}>
      <span style={{ color: MUTED }}>{label}</span><span style={{ color: SUB }}>{value}</span>
    </div>
  );

  if (ds.totals === "accentbar") {
    return (
      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "12px" }}>
        <div style={{ width: "260px" }}>
          {small("Subtotal", fmt(data.subtotal))}
          {small(`Tax (${data.taxRatePct}%)`, fmt(data.tax))}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "8px", padding: "10px 14px", borderRadius: "8px", backgroundColor: accent }}>
            <span style={{ fontSize: "13px", fontWeight: 700, color: "#fff" }}>Total</span>
            <span style={{ fontSize: "18px", fontWeight: 800, color: "#fff" }}>{fmt(data.total)}</span>
          </div>
        </div>
      </div>
    );
  }
  if (ds.totals === "box") {
    return (
      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "12px" }}>
        <div style={{ width: "260px", border: `1px solid ${LINE}`, borderRadius: "8px", padding: "12px 14px", backgroundColor: SOFT }}>
          {small("Subtotal", fmt(data.subtotal))}
          {small(`Tax (${data.taxRatePct}%)`, fmt(data.tax))}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "6px", paddingTop: "8px", borderTop: `2px solid ${accent}` }}>
            <span style={{ fontSize: "13px", fontWeight: 700, color: INK }}>Total</span>
            <span style={{ fontSize: "18px", fontWeight: 800, color: accent }}>{fmt(data.total)}</span>
          </div>
        </div>
      </div>
    );
  }
  return (
    <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "12px" }}>
      <div style={{ width: "240px" }}>
        {small("Subtotal", fmt(data.subtotal))}
        {small(`Tax (${data.taxRatePct}%)`, fmt(data.tax))}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "6px", paddingTop: "8px", borderTop: `1px solid ${LINE}` }}>
          <span style={{ fontSize: "13px", fontWeight: 700, color: INK }}>Total</span>
          <span style={{ fontSize: "18px", fontWeight: 800, color: accent }}>{fmt(data.total)}</span>
        </div>
      </div>
    </div>
  );
}
