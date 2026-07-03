"use client";

// ─── TemplateEditorModal ──────────────────────────────────
// Full-content editor for an agreement (plan) template: metadata + the shared
// AgreementContentEditor (services, visits, billing, benefits, terms, sections).
// This is what makes user-created templates real — not just name/description.

import { useState } from "react";
import { X, FileText, Check } from "lucide-react";
import UiSelect from "@/components/ui/Select";
import AgreementContentEditor, { type AgreementContent } from "@/components/agreements/AgreementContentEditor";
import { agrSlug, type PlanTemplate } from "@/lib/agreements/templates";

const INDUSTRIES = ["HVAC", "Roofing", "Plumbing", "Property Maintenance", "Consulting", "General"] as const;
const inputStyle: React.CSSProperties = { border: "1px solid var(--border)", backgroundColor: "var(--bg-surface)", color: "var(--text-primary)" };

export default function TemplateEditorModal({ template, isNew, onCancel, onSave }: {
  template: PlanTemplate;
  isNew: boolean;
  onCancel: () => void;
  onSave: (t: PlanTemplate) => void;
}) {
  const [draft, setDraft] = useState<PlanTemplate>(template);
  const set = <K extends keyof PlanTemplate>(key: K, val: PlanTemplate[K]) => setDraft(d => ({ ...d, [key]: val }));

  const content: AgreementContent = {
    services: draft.services, visits: draft.visits, billing: draft.billing,
    benefits: draft.benefits, terms: draft.terms, exclusions: draft.exclusions, sections: draft.sections,
  };

  // A template must be named and schedule at least one visit (visits drive the
  // whole maintenance lifecycle, so a visit-less template is meaningless).
  const hasName = draft.name.trim().length > 0;
  const hasVisit = draft.visits.length > 0;
  const canSave = hasName && hasVisit;

  function save() {
    if (!canSave) return;
    onSave({ ...draft, key: draft.key || agrSlug(draft.name) });
  }

  return (
    <div className="fixed inset-0 z-[60] bg-black/40 flex items-center justify-center p-4" onClick={onCancel}>
      <div className="w-full max-w-3xl max-h-[92vh] flex flex-col rounded-2xl overflow-hidden" onClick={e => e.stopPropagation()}
        style={{ backgroundColor: "var(--bg-surface)", boxShadow: "0 16px 48px rgba(0,0,0,0.24)" }}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 shrink-0" style={{ borderBottom: "1px solid var(--border)" }}>
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4" style={{ color: "#4f46e5" }} />
            <p className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>{isNew ? "New Template" : "Edit Template"}</p>
          </div>
          <button onClick={onCancel} style={{ color: "var(--text-muted)" }}><X className="w-4 h-4" /></button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto thin-scroll-y px-6 py-5 space-y-6">
          {/* Metadata */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Name *">
              <input value={draft.name} onChange={e => set("name", e.target.value)} placeholder="e.g. HVAC Residential Gold"
                className="w-full rounded-lg px-3 py-2 text-sm outline-none" style={inputStyle} />
            </Field>
            <Field label="Industry">
              <UiSelect value={draft.industry} onChange={v => set("industry", v as PlanTemplate["industry"])} options={INDUSTRIES.map(i => ({ value: i, label: i }))} />
            </Field>
            <div className="col-span-2">
              <Field label="Description">
                <input value={draft.description} onChange={e => set("description", e.target.value)} placeholder="Short summary shown when choosing this template"
                  className="w-full rounded-lg px-3 py-2 text-sm outline-none" style={inputStyle} />
              </Field>
            </div>
            <Field label="Status">
              <UiSelect value={draft.status} onChange={v => set("status", v as PlanTemplate["status"])}
                options={[{ value: "active", label: "Active" }, { value: "draft", label: "Draft" }, { value: "archived", label: "Archived" }]} />
            </Field>
          </div>

          <div className="h-px" style={{ backgroundColor: "var(--border-subtle)" }} />

          {/* Shared content editor */}
          <AgreementContentEditor value={content} onChange={patch => setDraft(d => ({ ...d, ...patch }))} />
        </div>

        {/* Footer */}
        <div className="px-6 py-4 flex items-center justify-between gap-3 shrink-0" style={{ borderTop: "1px solid var(--border)" }}>
          <p className="text-[11px]" style={{ color: hasVisit ? "var(--text-muted)" : "#dc2626" }}>
            {!hasName ? "Name your template to save." : !hasVisit ? "Add at least one visit to save this template." : "Ready to save."}
          </p>
          <div className="flex items-center gap-2">
            <button onClick={onCancel} className="px-3 py-2 rounded-lg text-sm" style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}>Cancel</button>
            <button onClick={save} disabled={!canSave}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-40 transition-colors" style={{ backgroundColor: "#4f46e5" }}>
              <Check className="w-4 h-4" /> {isNew ? "Add Template" : "Save Template"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>
        {label}{hint && <span className="ml-1 font-normal" style={{ color: "var(--text-muted)" }}>· {hint}</span>}
      </label>
      {children}
    </div>
  );
}
