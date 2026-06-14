"use client";

import { useState } from "react";
import UiSelect from "@/components/ui/Select";
import { TERM_TYPE_LABELS, type TermType } from "@/lib/agreements/settings";
import type { UseAgreementDraft } from "./useAgreementDraft";
import { SectionHead, SummaryCard, Empty, Field, Mini, TextInput, ToggleRow, inputStyle } from "./ui";

const TYPE_OPTIONS = (Object.keys(TERM_TYPE_LABELS) as TermType[]).map(k => ({ value: k, label: TERM_TYPE_LABELS[k] }));

export default function TermsSection({ d }: { d: UseAgreementDraft }) {
  const [open, setOpen] = useState<string | null>(null);
  const available = d.termsLib.filter(lib => !d.terms.some(t => t.title === lib.title));

  return (
    <div>
      <SectionHead title="Terms" subtitle="Written legal / customer-facing rules — reusable blocks you can edit per agreement."
        action={
          <div className="w-56">
            <UiSelect size="sm" value="" placeholder="+ Add from library…" onChange={(id) => d.addTermFromLib(id)}
              options={available.map(t => ({ value: t.id, label: t.title }))} />
          </div>
        } />

      <button onClick={() => d.addBlankTerm()} className="text-xs font-medium mb-3" style={{ color: "#4f46e5" }}>+ Add a custom term</button>

      {d.terms.length === 0 ? (
        <Empty>No terms yet. Add reusable blocks like payment, cancellation, and warranty terms.</Empty>
      ) : (
        <div className="space-y-2.5 mb-5">
          {d.terms.map(t => (
            <SummaryCard key={t.id} title={t.title || "New term"}
              meta={t.body ? t.body.slice(0, 80) + (t.body.length > 80 ? "…" : "") : undefined}
              badges={[
                { label: TERM_TYPE_LABELS[(t.termType as TermType)] ?? "Custom", tone: "muted" },
                ...(t.required ? [{ label: "Required", tone: "warn" as const }] : []),
                ...(t.editable ? [] : [{ label: "Locked", tone: "muted" as const }]),
              ]}
              expanded={open === t.id} onToggle={() => setOpen(open === t.id ? null : t.id)} onRemove={() => { d.removeTerm(t.id); if (open === t.id) setOpen(null); }}>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Term Name"><TextInput value={t.title} onChange={e => d.setTerm(t.id, { title: e.target.value })} /></Field>
                  <Mini label="Term Type"><UiSelect size="sm" value={t.termType} onChange={k => d.setTerm(t.id, { termType: k })} options={TYPE_OPTIONS} /></Mini>
                </div>
                <Field label="Text">
                  <textarea value={t.body} onChange={e => d.setTerm(t.id, { body: e.target.value })} rows={4}
                    className="w-full rounded-lg px-3 py-2 text-sm outline-none resize-none thin-scroll-y" style={inputStyle} />
                </Field>
                <div className="grid grid-cols-2 gap-2">
                  <ToggleRow label="Required" on={t.required} onChange={val => d.setTerm(t.id, { required: val })} />
                  <ToggleRow label="Editable per agreement" on={t.editable} onChange={val => d.setTerm(t.id, { editable: val })} />
                </div>
              </div>
            </SummaryCard>
          ))}
        </div>
      )}

      <Field label="Exclusions" hint="shown on the agreement document">
        <textarea value={d.exclusions} onChange={e => d.setExclusions(e.target.value)} rows={3}
          className="w-full rounded-lg px-3 py-2 text-sm outline-none resize-none thin-scroll-y" style={inputStyle} />
      </Field>
    </div>
  );
}
