"use client";

// Coverage: what the agreement covers — account, property, equipment/systems,
// exclusions, and the contacts. Industry-agnostic; shows whatever the snapshot
// carries and falls back gracefully where there's no field yet.

import { User, MapPin, Building2, ShieldCheck, ShieldOff, KeyRound, Receipt } from "lucide-react";
import { type CustomerAgreement } from "@/lib/agreements/data";
import { Card, SectionLabel, InfoRow } from "./shared";

function Chips({ items }: { items: string[] }) {
  if (!items.length) return <p className="text-sm" style={{ color: "var(--text-muted)" }}>None specified.</p>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((c, i) => (
        <span key={i} className="text-xs font-medium px-2.5 py-1 rounded-full"
          style={{ backgroundColor: "var(--accent-soft-bg)", color: "var(--accent-text-strong)" }}>{c}</span>
      ))}
    </div>
  );
}

export default function CoverageTab({ agreement }: { agreement: CustomerAgreement }) {
  const coverage = agreement.coverage ?? [];
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* What's covered */}
      <Card className="p-4 lg:col-span-2 space-y-5">
        <div>
          <div className="flex items-center gap-2 mb-2"><ShieldCheck className="w-3.5 h-3.5" style={{ color: "#10b981" }} /><SectionLabel>Covered Equipment / Systems / Assets</SectionLabel></div>
          <Chips items={coverage} />
        </div>
        <div className="h-px" style={{ backgroundColor: "var(--border-subtle)" }} />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
          <InfoRow icon={User}      label="Covered Account" value={agreement.customer} />
          <InfoRow icon={MapPin}    label="Covered Property" value={agreement.propertyLabel ?? agreement.location} />
        </div>
        <div className="h-px" style={{ backgroundColor: "var(--border-subtle)" }} />
        <div>
          <div className="flex items-center gap-2 mb-1.5"><ShieldOff className="w-3.5 h-3.5" style={{ color: "#ef4444" }} /><SectionLabel>Exclusions</SectionLabel></div>
          <p className="text-sm leading-relaxed" style={{ color: agreement.exclusions ? "var(--text-secondary)" : "var(--text-muted)" }}>
            {agreement.exclusions || "No excluded locations or equipment noted."}
          </p>
        </div>
        <div>
          <div className="flex items-center gap-2 mb-1.5"><KeyRound className="w-3.5 h-3.5" style={{ color: "var(--text-muted)" }} /><SectionLabel>Access Notes</SectionLabel></div>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>—</p>
        </div>
      </Card>

      {/* Contacts */}
      <Card className="p-4">
        <SectionLabel>Contacts</SectionLabel>
        <div className="space-y-3 mt-3">
          <InfoRow icon={User}   label="Primary Contact" value={agreement.contactName ?? "—"} />
          <InfoRow icon={Receipt}label="Billing Contact" value={agreement.contactName ?? "—"} />
          <InfoRow icon={Building2} label="Location" value={agreement.location} />
        </div>
      </Card>
    </div>
  );
}
