"use client";

// Proposal Defaults (Settings → Salesbook Library → Defaults).
// The reusable defaults applied when new quotes are created — default Quote Design
// per quote type, expiration, terms, financing, approval language, and pricing
// display toggles. Migrated from the retired Proposal Builder → Defaults tab.
// Backed by getProposalDefaults/saveProposalDefaults (one source of truth).

import { useEffect, useMemo, useState } from "react";
import { Sliders } from "lucide-react";
import { pingSaved } from "@/components/shared/SavedPill";
import UiSelect from "@/components/ui/Select";
import {
  getProposalDefaults, saveProposalDefaults, getProposalTerms,
  type ProposalDefaults, type ProposalTermsBlock,
} from "@/lib/proposals/data";
import { getDesignsForMode } from "@/lib/quotes/quoteDesigns";

const inputStyle: React.CSSProperties = { border: "1px solid var(--border)", backgroundColor: "var(--bg-surface)", color: "var(--text-primary)" };

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!on)} role="switch" aria-checked={on}
      className="relative w-9 h-5 rounded-full transition-colors shrink-0"
      style={{ backgroundColor: on ? "var(--accent-text)" : "var(--bg-input)", border: "1px solid var(--border)" }}>
      <span className="absolute top-0.5 left-0.5 w-3.5 h-3.5 rounded-full bg-white shadow transition-transform"
        style={{ transform: on ? "translateX(16px)" : "translateX(0)" }} />
    </button>
  );
}
function Labeled({ label, hint, children, full }: { label: string; hint?: string; children: React.ReactNode; full?: boolean }) {
  return (
    <div className={full ? "sm:col-span-2" : ""}>
      <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>
        {label}{hint && <span style={{ color: "var(--text-muted)" }}> ({hint})</span>}
      </label>
      {children}
    </div>
  );
}
function ToggleRow({ label, desc, on, onChange }: { label: string; desc: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3" style={{ borderTop: "1px solid var(--border)" }}>
      <div><p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{label}</p><p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{desc}</p></div>
      <Toggle on={on} onChange={onChange} />
    </div>
  );
}

export default function ProposalDefaultsSection() {
  const [d, setD] = useState<ProposalDefaults>(() => getProposalDefaults());
  const [terms, setTerms] = useState<ProposalTermsBlock[]>([]);
  const [dirty, setDirty] = useState(false);

  useEffect(() => { setD(getProposalDefaults()); setTerms(getProposalTerms().filter(t => t.active)); }, []);
  function set<K extends keyof ProposalDefaults>(k: K, v: ProposalDefaults[K]) { setD(p => ({ ...p, [k]: v })); setDirty(true); }
  useEffect(() => {
    if (!dirty) return;
    const t = setTimeout(() => { saveProposalDefaults(d); setDirty(false); pingSaved(); }, 500);
    return () => clearTimeout(t);
  }, [dirty, d]);

  // Each per-type default only offers designs that support that quote situation.
  const quickDesigns     = useMemo(() => getDesignsForMode("quick_quote"), []);
  const salesbookDesigns = useMemo(() => getDesignsForMode("salesbook"), []);
  const customDesigns    = useMemo(() => getDesignsForMode("custom"), []);
  const designOpts = (list: ReturnType<typeof getDesignsForMode>) => list.map(x => ({ value: x.id, label: x.name }));

  return (
    <div className="space-y-4">
      <div className="rounded-xl p-3.5 flex items-start gap-2.5" style={{ backgroundColor: "var(--bg-surface-2)", border: "1px solid var(--border)" }}>
        <Sliders className="w-4 h-4 shrink-0 mt-0.5" style={{ color: "var(--accent-text)" }} />
        <p className="text-xs leading-relaxed" style={{ color: "var(--text-secondary)" }}>
          Applied automatically when a new quote is created. Each quote type starts from its default Quote Design; reps can still override per quote.
        </p>
      </div>

      {/* Default designs by quote type */}
      <div className="rounded-xl p-5" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" }}>
        <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: "var(--text-muted)" }}>Default Quote Design by Type</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Labeled label="Quick Quote">
            <UiSelect value={d.defaultQuickQuoteDesignId} onChange={v => set("defaultQuickQuoteDesignId", v)} options={designOpts(quickDesigns)} />
          </Labeled>
          <Labeled label="Salesbook Proposal">
            <UiSelect value={d.defaultSalesbookDesignId} onChange={v => set("defaultSalesbookDesignId", v)} options={designOpts(salesbookDesigns)} />
          </Labeled>
          <Labeled label="Custom Proposal">
            <UiSelect value={d.defaultCustomDesignId} onChange={v => set("defaultCustomDesignId", v)} options={designOpts(customDesigns)} />
          </Labeled>
        </div>
      </div>

      {/* Document defaults */}
      <div className="rounded-xl p-5" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" }}>
        <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: "var(--text-muted)" }}>Document Defaults</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Labeled label="Default Expiration" hint="days"><input type="number" min={1} value={d.defaultExpirationDays} onChange={e => set("defaultExpirationDays", parseInt(e.target.value) || 0)} className="w-full rounded-lg px-3 py-2 text-sm outline-none" style={inputStyle} /></Labeled>
          <Labeled label="Default Terms Block">
            <UiSelect value={d.defaultTermsBlockId} onChange={v => set("defaultTermsBlockId", v)} placeholder="None"
              options={[{ value: "", label: "None" }, ...terms.map(t => ({ value: t.id, label: t.title }))]} />
          </Labeled>
          <Labeled label="Default Financing Note" full><textarea value={d.financingNote} onChange={e => set("financingNote", e.target.value)} rows={2} className="w-full rounded-lg px-3 py-2 text-sm outline-none resize-none" style={inputStyle} /></Labeled>
          <Labeled label="Default Approval Language" full><textarea value={d.approvalLanguage} onChange={e => set("approvalLanguage", e.target.value)} rows={2} className="w-full rounded-lg px-3 py-2 text-sm outline-none resize-none" style={inputStyle} /></Labeled>
        </div>
      </div>

      {/* Pricing display */}
      <div className="rounded-xl p-5" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" }}>
        <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>Pricing &amp; Tax Display</p>
        <ToggleRow label="Show Tax Line" desc="Display tax as a separate line on customer-facing quotes." on={d.showTax} onChange={v => set("showTax", v)} />
        <ToggleRow label="Show Monthly Payment" desc="Show estimated monthly financed payment where available." on={d.showMonthlyPayment} onChange={v => set("showMonthlyPayment", v)} />
        <ToggleRow label="Show Pricing Breakdown" desc="Show itemized pricing instead of a single total." on={d.showPricingBreakdown} onChange={v => set("showPricingBreakdown", v)} />
        <ToggleRow label="Show Optional Add-ons" desc="Display optional upgrade lines on proposals." on={d.showOptionalAddons} onChange={v => set("showOptionalAddons", v)} />
      </div>
    </div>
  );
}
