"use client";

// ─── VisitScheduleTemplateEditorModal ─────────────────────
// Editor for a reusable Visit Schedule Template ("when we go"): metadata plus an
// editable list of visits (appointments). Mirrors TemplateEditorModal's chrome.

import { useMemo, useState } from "react";
import { X, CalendarClock, Check, Plus, Trash2 } from "lucide-react";
import UiSelect from "@/components/ui/Select";
import { getVisitRules, VISIT_CADENCE_LABELS, agrId, agrSlug, type VisitCadence } from "@/lib/agreements/settings";
import { getJobTypes } from "@/lib/job-config/data";
import { getTemplates as getWorkOrderTemplates } from "@/lib/work-order-templates/data";
import { getBoardsForContext } from "@/lib/calendar/settings";
import type { TemplateVisit } from "@/lib/agreements/templates";
import { getVisitTemplates, visitTemplateToVisit, type VisitScheduleTemplate } from "@/lib/agreements/template-library";

const INDUSTRIES = ["HVAC", "Roofing", "Plumbing", "Property Maintenance", "Consulting", "General"] as const;
const inputStyle: React.CSSProperties = { border: "1px solid var(--border)", backgroundColor: "var(--bg-surface)", color: "var(--text-primary)" };
const cardStyle: React.CSSProperties = { backgroundColor: "var(--bg-surface-2)", border: "1px solid var(--border-subtle)" };

const FREQ_OPTIONS = (Object.keys(VISIT_CADENCE_LABELS) as VisitCadence[]).map(k => ({ value: k, label: VISIT_CADENCE_LABELS[k] }));

export default function VisitScheduleTemplateEditorModal({ template, isNew, onCancel, onSave }: {
  template: VisitScheduleTemplate;
  isNew: boolean;
  onCancel: () => void;
  onSave: (t: VisitScheduleTemplate) => void;
}) {
  const [draft, setDraft] = useState<VisitScheduleTemplate>(template);
  const set = <K extends keyof VisitScheduleTemplate>(key: K, val: VisitScheduleTemplate[K]) => setDraft(d => ({ ...d, [key]: val }));

  const visitRules = useMemo(() => getVisitRules().filter(r => r.active), []);
  const jobTypes = useMemo(() => getJobTypes(), []);
  const woOptions = useMemo(() => [{ value: "", label: "None" }, ...getWorkOrderTemplates().filter(t => t.active).map(t => ({ value: t.id, label: t.name }))], []);
  const boardOptions = useMemo(() => [{ value: "", label: "Any board" }, ...getBoardsForContext().map(b => ({ value: b.id, label: b.name }))], []);

  const visitTemplateOptions = useMemo(() => getVisitTemplates().filter(t => t.active).map(t => ({ value: t.id, label: t.name })), []);
  const setVisit = (id: string, patch: Partial<TemplateVisit>) => setDraft(d => ({ ...d, visits: d.visits.map(v => v.id === id ? { ...v, ...patch } : v) }));
  const addVisit = () => setDraft(d => ({ ...d, visits: [...d.visits, { id: agrId("tv"), name: "", frequencyKey: visitRules[0]?.key ?? "quarterly", preferredWindow: "", durationMin: 90, jobTypeKey: jobTypes[0]?.key ?? "", autoGenerate: true }] }));
  const addFromTemplate = (templateId: string) => {
    const vt = getVisitTemplates().find(t => t.id === templateId); if (!vt) return;
    setDraft(d => ({ ...d, visits: [...d.visits, visitTemplateToVisit(vt)] }));
  };
  const removeVisit = (id: string) => setDraft(d => ({ ...d, visits: d.visits.filter(v => v.id !== id) }));

  const hasName = draft.name.trim().length > 0;
  const hasVisit = draft.visits.some(v => v.name.trim());
  const canSave = hasName && (hasVisit || draft.frequencyType === "custom" || draft.frequencyType === "on_demand");

  function save() {
    if (!canSave) return;
    onSave({ ...draft, key: draft.key || agrSlug(draft.name) });
  }

  return (
    <div className="fixed inset-0 z-[60] bg-black/40 flex items-center justify-center p-4" onClick={onCancel}>
      <div className="w-full max-w-3xl max-h-[92vh] flex flex-col rounded-2xl overflow-hidden" onClick={e => e.stopPropagation()}
        style={{ backgroundColor: "var(--bg-surface)", boxShadow: "0 16px 48px rgba(0,0,0,0.24)" }}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 shrink-0" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
          <div className="flex items-center gap-2">
            <CalendarClock className="w-4 h-4" style={{ color: "#4f46e5" }} />
            <p className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>{isNew ? "New Visit Schedule" : "Edit Visit Schedule"}</p>
          </div>
          <button onClick={onCancel} style={{ color: "var(--text-muted)" }}><X className="w-4 h-4" /></button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto thin-scroll-y px-6 py-5 space-y-6">
          <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>Visit Schedule = <span style={{ fontWeight: 600 }}>when we go</span>. Define the recurring visits this schedule generates.</p>

          {/* Metadata */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Name *">
              <input value={draft.name} onChange={e => set("name", e.target.value)} placeholder="e.g. Semi-Annual HVAC Spring/Fall"
                className="w-full rounded-lg px-3 py-2 text-sm outline-none" style={inputStyle} />
            </Field>
            <Field label="Industry">
              <UiSelect value={draft.industry ?? "General"} onChange={v => set("industry", v as VisitScheduleTemplate["industry"])} options={INDUSTRIES.map(i => ({ value: i, label: i }))} />
            </Field>
            <div className="col-span-2">
              <Field label="Description">
                <input value={draft.description ?? ""} onChange={e => set("description", e.target.value)} placeholder="Short summary shown when choosing this schedule"
                  className="w-full rounded-lg px-3 py-2 text-sm outline-none" style={inputStyle} />
              </Field>
            </div>
            <Field label="Frequency Type">
              <UiSelect value={draft.frequencyType ?? "custom"} onChange={v => set("frequencyType", v as VisitCadence)} options={FREQ_OPTIONS} />
            </Field>
            <Field label="Status">
              <UiSelect value={draft.active ? "active" : "inactive"} onChange={v => set("active", v === "active")}
                options={[{ value: "active", label: "Active" }, { value: "inactive", label: "Inactive" }]} />
            </Field>
          </div>

          <div className="h-px" style={{ backgroundColor: "var(--border-subtle)" }} />

          {/* Visits */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>Visits</p>
              <div className="flex items-center gap-2">
                {visitTemplateOptions.length > 0 && (
                  <div className="w-48"><UiSelect size="sm" value="" placeholder="+ From Visit Template…" onChange={(id) => { if (id) addFromTemplate(id); }} options={visitTemplateOptions} /></div>
                )}
                <button onClick={addVisit} className="flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-lg cursor-pointer transition-colors hover:bg-[var(--bg-surface-2)]"
                  style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}><Plus className="w-3 h-3" /> Custom</button>
              </div>
            </div>
            {draft.visits.length === 0 && <p className="text-xs py-2" style={{ color: "var(--text-muted)" }}>No visits yet. Add the recurring appointments this schedule books.</p>}
            {draft.visits.map(v => (
              <div key={v.id} className="rounded-xl p-3 space-y-2" style={cardStyle}>
                <div className="flex items-center gap-2">
                  <input value={v.name} onChange={e => setVisit(v.id, { name: e.target.value })} placeholder="Visit name (e.g. Spring Cooling Tune-Up)"
                    className="flex-1 rounded-lg px-2.5 py-1.5 text-sm outline-none" style={inputStyle} />
                  <button onClick={() => removeVisit(v.id)} className="p-1.5 rounded-lg shrink-0" style={{ color: "var(--text-muted)" }}><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Mini label="Frequency"><UiSelect size="sm" value={v.frequencyKey} onChange={k => setVisit(v.id, { frequencyKey: k })} options={visitRules.map(r => ({ value: r.key, label: r.name }))} /></Mini>
                  <Mini label="Job Type Created"><UiSelect size="sm" value={v.jobTypeKey ?? ""} onChange={k => setVisit(v.id, { jobTypeKey: k })} placeholder="None" options={[{ value: "", label: "None" }, ...jobTypes.map(j => ({ value: j.key, label: j.name }))]} /></Mini>
                  <Mini label="Preferred / Due Window"><input value={v.preferredWindow ?? ""} onChange={e => setVisit(v.id, { preferredWindow: e.target.value })} placeholder="e.g. March–May"
                    className="w-full rounded-lg px-2.5 py-1.5 text-xs outline-none" style={inputStyle} /></Mini>
                  <Mini label="Est. Duration (min)"><input type="number" min={15} step={15} value={v.durationMin} onChange={e => setVisit(v.id, { durationMin: parseInt(e.target.value) || 90 })}
                    className="w-full rounded-lg px-2.5 py-1.5 text-xs outline-none" style={inputStyle} /></Mini>
                  <Mini label="Work Order Template"><UiSelect size="sm" value={v.workOrderTemplateId ?? ""} onChange={k => setVisit(v.id, { workOrderTemplateId: k })} options={woOptions} /></Mini>
                  <Mini label="Dispatch Board (optional)"><UiSelect size="sm" value={v.dispatchBoardId ?? ""} onChange={k => setVisit(v.id, { dispatchBoardId: k })} options={boardOptions} /></Mini>
                </div>
                <label className="flex items-center gap-2 text-xs cursor-pointer" style={{ color: "var(--text-secondary)" }}>
                  <input type="checkbox" checked={v.autoGenerate ?? true} onChange={e => setVisit(v.id, { autoGenerate: e.target.checked })} className="accent-indigo-600" />
                  Auto-generate planned visits (otherwise booked on demand)
                </label>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 flex items-center justify-between gap-3 shrink-0" style={{ borderTop: "1px solid var(--border-subtle)" }}>
          <p className="text-[11px]" style={{ color: canSave ? "var(--text-muted)" : "#dc2626" }}>
            {!hasName ? "Name your schedule to save." : !canSave ? "Add at least one named visit to save." : "Ready to save."}
          </p>
          <div className="flex items-center gap-2">
            <button onClick={onCancel} className="px-3 py-2 rounded-lg text-sm" style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}>Cancel</button>
            <button onClick={save} disabled={!canSave}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-40 transition-colors" style={{ backgroundColor: "#4f46e5" }}>
              <Check className="w-4 h-4" /> {isNew ? "Add Schedule" : "Save Schedule"}
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

function Mini({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[10px] font-medium mb-1" style={{ color: "var(--text-muted)" }}>{label}</label>
      {children}
    </div>
  );
}
