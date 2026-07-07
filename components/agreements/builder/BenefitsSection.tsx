"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import UiSelect from "@/components/ui/Select";
import { BENEFIT_KIND_LABELS, type BenefitKind } from "@/lib/agreements/settings";
import type { UseAgreementDraft } from "./useAgreementDraft";
import { SectionHead, SummaryCard, Empty, Field, Mini, TextInput } from "./ui";

const KIND_OPTIONS = (Object.keys(BENEFIT_KIND_LABELS) as BenefitKind[]).map(k => ({ value: k, label: BENEFIT_KIND_LABELS[k] }));

export default function BenefitsSection({ d }: { d: UseAgreementDraft }) {
  const [open, setOpen] = useState<string | null>(null);
  const [custom, setCustom] = useState("");
  const available = d.benefitLib.filter(lib => !d.benefits.some(b => b.label === lib.label));

  return (
    <div>
      <SectionHead title="Benefits" subtitle="Extra value and perks included with the agreement."
        action={
          <div className="w-56">
            <UiSelect size="sm" value="" placeholder="+ Add from library…" onChange={(id) => d.addBenefitFromLib(id)}
              options={available.map(b => ({ value: b.id, label: b.label }))} />
          </div>
        } />

      <div className="flex items-center gap-2 mb-3">
        <TextInput value={custom} onChange={e => setCustom(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); d.addCustomBenefit(custom); setCustom(""); } }}
          placeholder="Add a custom benefit…" className="flex-1" />
        <button onClick={() => { d.addCustomBenefit(custom); setCustom(""); }} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-white shrink-0" style={{ backgroundColor: "#0f8578" }}>
          <Plus className="w-4 h-4" /> Add
        </button>
      </div>

      {d.benefits.length === 0 ? (
        <Empty>No benefits yet. Add perks like priority scheduling, discounts, or included reports.</Empty>
      ) : (
        <div className="space-y-2.5">
          {d.benefits.map(b => (
            <SummaryCard key={b.id} title={b.label || "New benefit"}
              meta={[b.value, b.appliesTo, b.limit].filter(Boolean).join(" · ") || undefined}
              badges={[{ label: BENEFIT_KIND_LABELS[b.kind], tone: "accent" }]}
              expanded={open === b.id} onToggle={() => setOpen(open === b.id ? null : b.id)} onRemove={() => { d.removeBenefit(b.id); if (open === b.id) setOpen(null); }}>
              <div className="space-y-3">
                <Field label="Benefit Name"><TextInput value={b.label} onChange={e => d.setBenefit(b.id, { label: e.target.value })} /></Field>
                <Field label="Description" hint="optional"><TextInput value={b.description} onChange={e => d.setBenefit(b.id, { description: e.target.value })} /></Field>
                <div className="grid grid-cols-2 gap-3">
                  <Mini label="Benefit Type"><UiSelect size="sm" value={b.kind} onChange={k => d.setBenefit(b.id, { kind: k as BenefitKind })} options={KIND_OPTIONS} /></Mini>
                  <Mini label="Value / Discount"><TextInput value={b.value} onChange={e => d.setBenefit(b.id, { value: e.target.value })} placeholder="e.g. 15%" /></Mini>
                  <Mini label="Applies To"><TextInput value={b.appliesTo} onChange={e => d.setBenefit(b.id, { appliesTo: e.target.value })} placeholder="e.g. Repairs" /></Mini>
                  <Mini label="Limit"><TextInput value={b.limit} onChange={e => d.setBenefit(b.id, { limit: e.target.value })} placeholder="e.g. 2 per year" /></Mini>
                </div>
              </div>
            </SummaryCard>
          ))}
        </div>
      )}
    </div>
  );
}
