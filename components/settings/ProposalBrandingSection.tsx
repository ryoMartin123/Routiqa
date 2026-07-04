"use client";

// Proposal Branding (Settings → Salesbook Library → Proposal Branding).
// The single place to control the logo, brand color, company info, and footer that
// carry across every Quote Design. Migrated from the retired Proposal Builder →
// Branding tab; backed by the same getProposalBranding/saveProposalBranding store
// so live quotes, previews, and PDFs all read one source of truth.

import { useEffect, useState } from "react";
import { Palette } from "lucide-react";
import { getProposalBranding, saveProposalBranding, type ProposalBranding } from "@/lib/proposals/data";
import { pingSaved } from "@/components/shared/SavedPill";

const inputStyle: React.CSSProperties = { border: "1px solid var(--border)", backgroundColor: "var(--bg-surface)", color: "var(--text-primary)" };

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

export default function ProposalBrandingSection() {
  const [b, setB] = useState<ProposalBranding>(() => getProposalBranding());
  const [dirty, setDirty] = useState(false);

  useEffect(() => { setB(getProposalBranding()); }, []);
  function set<K extends keyof ProposalBranding>(k: K, v: ProposalBranding[K]) { setB(p => ({ ...p, [k]: v })); setDirty(true); }
  useEffect(() => {
    if (!dirty) return;
    const t = setTimeout(() => { saveProposalBranding(b); setDirty(false); pingSaved(); }, 500);
    return () => clearTimeout(t);
  }, [dirty, b]);

  return (
    <div className="space-y-4">
      <div className="rounded-xl p-3.5 flex items-start gap-2.5" style={{ backgroundColor: "var(--bg-surface-2)", border: "1px solid var(--border)" }}>
        <Palette className="w-4 h-4 shrink-0 mt-0.5" style={{ color: "var(--accent-text)" }} />
        <p className="text-xs leading-relaxed" style={{ color: "var(--text-secondary)" }}>
          Your logo, brand color, company info, and footer carry through every Quote Design — quotes, previews, and PDFs. Set them once here.
        </p>
      </div>

      <div className="rounded-xl p-5" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" }}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Labeled label="Logo URL" hint="placeholder"><input value={b.logoUrl} onChange={e => set("logoUrl", e.target.value)} placeholder="https://…" className="w-full rounded-lg px-3 py-2 text-sm outline-none" style={inputStyle} /></Labeled>
          <Labeled label="Brand / Accent Color">
            <div className="flex items-center gap-2">
              <input type="color" value={b.accentColor} onChange={e => set("accentColor", e.target.value)} className="w-10 h-9 rounded-lg cursor-pointer" style={{ border: "1px solid var(--border)", background: "none" }} />
              <input value={b.accentColor} onChange={e => set("accentColor", e.target.value)} className="flex-1 rounded-lg px-3 py-2 text-sm font-mono outline-none" style={inputStyle} />
            </div>
          </Labeled>
          <Labeled label="Company Name"><input value={b.companyName} onChange={e => set("companyName", e.target.value)} className="w-full rounded-lg px-3 py-2 text-sm outline-none" style={inputStyle} /></Labeled>
          <Labeled label="License Number"><input value={b.licenseNumber} onChange={e => set("licenseNumber", e.target.value)} className="w-full rounded-lg px-3 py-2 text-sm outline-none" style={inputStyle} /></Labeled>
          <Labeled label="Company Info"><input value={b.companyInfo} onChange={e => set("companyInfo", e.target.value)} className="w-full rounded-lg px-3 py-2 text-sm outline-none" style={inputStyle} /></Labeled>
          <Labeled label="Contact Info"><input value={b.contactInfo} onChange={e => set("contactInfo", e.target.value)} className="w-full rounded-lg px-3 py-2 text-sm outline-none" style={inputStyle} /></Labeled>
          <Labeled label="Footer" full><input value={b.footer} onChange={e => set("footer", e.target.value)} className="w-full rounded-lg px-3 py-2 text-sm outline-none" style={inputStyle} /></Labeled>
        </div>
      </div>
    </div>
  );
}
