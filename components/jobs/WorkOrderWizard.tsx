"use client";

// ─── Work Order Wizard ────────────────────────────────────
// Creates a work order for a job by instantiating a Work Order Template:
// snapshots the template's checklist into the new work order. A job can hold
// MANY work orders (one per distinct scope) — this always ADDS one.

import { useMemo, useState } from "react";
import { X, ClipboardList, Check, Camera, Plus, Trash2 } from "lucide-react";
import UiSelect from "@/components/ui/Select";
import { getAllJobs, getWorkOrdersForJob, createWorkOrder } from "@/lib/jobs/data";

// Sentinel template id for the hand-built (no template) path.
const BLANK = "__blank__";
import {
  getTemplates, getChecklist, getPhotos, getInstructions, suggestTemplateForJobType, templatesForJobType,
} from "@/lib/work-order-templates/data";
import { jobTypeLabel } from "@/lib/job-config/data";

export interface WorkOrderWizardPreset { jobId?: string }

export default function WorkOrderWizard({ preset, onClose, onCreated }: {
  preset?: WorkOrderWizardPreset;
  onClose: () => void;
  onCreated: (jobId: string) => void;
}) {
  // Any job can take another work order (multi-WO model) — offer them all,
  // skipping only jobs that are closed out.
  const jobs = useMemo(
    () => getAllJobs().filter(j => preset?.jobId === j.id || (j.status !== "canceled" && j.status !== "closed")),
    [preset?.jobId],
  );
  const templates = useMemo(() => getTemplates().filter(t => t.active), []);

  const [jobId, setJobId] = useState(preset?.jobId ?? jobs[0]?.id ?? "");
  const job = jobs.find(j => j.id === jobId);

  // Default the template to the one suggested by the job's type.
  const suggested = job ? suggestTemplateForJobType(job.type) : undefined;
  const [templateId, setTemplateId] = useState(suggested?.id ?? templates[0]?.id ?? "");

  // Templates linked to the job's type lead; unrelated ones (a maintenance
  // template on a repair job) hide behind "Show other templates".
  const matching = job ? templatesForJobType(job.type) : [];
  const others = matching.length > 0 ? templates.filter(t => !matching.some(m => m.id === t.id)) : [];
  const [showAll, setShowAll] = useState(false);
  const visibleTemplates = matching.length === 0 || showAll ? templates : matching;

  // Keep the suggestion in sync when the job changes (unless the user picked one).
  const [touchedTemplate, setTouchedTemplate] = useState(false);
  const effectiveTemplateId = touchedTemplate ? templateId : (suggested?.id ?? templateId);
  const isBlank = effectiveTemplateId === BLANK;
  const template = isBlank ? undefined : templates.find(t => t.id === effectiveTemplateId);

  const checklist    = template ? getChecklist(template.id).filter(c => c.active) : [];
  const photos       = template ? getPhotos(template.id).filter(p => p.required) : [];
  const instructions = template ? getInstructions(template.id) : null;

  // Hand-built checklist (the Blank / Custom path).
  const [customItems, setCustomItems] = useState<{ label: string; required: boolean }[]>([]);
  const [newItem, setNewItem] = useState("");
  function addCustomItem() {
    const label = newItem.trim();
    if (!label) return;
    setCustomItems(items => [...items, { label, required: false }]);
    setNewItem("");
  }

  const lockedJob = Boolean(preset?.jobId);
  const existingWOs = jobId ? getWorkOrdersForJob(jobId).length : 0;
  const canCreate = Boolean(jobId) && (isBlank ? customItems.length > 0 : Boolean(template));

  function handleCreate() {
    if (!job) return;
    if (isBlank) {
      if (customItems.length === 0) return;
      createWorkOrder({ jobId: job.id, title: "Work Order", instructions: "", checklist: customItems });
    } else {
      if (!template) return;
      createWorkOrder({
        jobId: job.id,
        title: template.name,
        instructions: instructions?.customerFacing || instructions?.internal || template.description,
        templateId: template.id,
        checklist: checklist.map(c => ({ label: c.label, required: c.required, type: c.type, options: c.options, unit: c.unit })),
      });
    }
    onCreated(job.id);
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-lg max-h-[90vh] flex flex-col rounded-2xl overflow-hidden" onClick={e => e.stopPropagation()}
        style={{ backgroundColor: "var(--bg-surface)", boxShadow: "0 16px 48px rgba(0,0,0,0.24)" }}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 shrink-0" style={{ borderBottom: "1px solid var(--border)" }}>
          <div className="flex items-center gap-2">
            <ClipboardList className="w-4 h-4" style={{ color: "#4f46e5" }} />
            <p className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>New Work Order</p>
          </div>
          <button onClick={onClose} style={{ color: "var(--text-muted)" }}><X className="w-4 h-4" /></button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {jobs.length === 0 ? (
            <p className="text-sm py-8 text-center" style={{ color: "var(--text-muted)" }}>
              No open jobs to attach a work order to — create a job first.
            </p>
          ) : (
            <>
              {/* Job */}
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Job <span style={{ color: "#ef4444" }}>*</span></label>
                {lockedJob && job ? (
                  <div className="rounded-lg px-3 py-2 text-sm" style={{ backgroundColor: "var(--bg-surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }}>
                    {job.title} · <span style={{ color: "var(--text-muted)" }}>{job.customerName}</span>
                  </div>
                ) : (
                  <UiSelect value={jobId} onChange={setJobId}
                    options={jobs.map(j => ({ value: j.id, label: `${j.title} — ${j.customerName}` }))} />
                )}
              </div>

              {existingWOs > 0 && (
                <p className="text-xs px-3 py-2 rounded-lg" style={{ backgroundColor: "var(--bg-surface-2)", color: "var(--text-secondary)" }}>
                  This job already has {existingWOs} work order{existingWOs === 1 ? "" : "s"} — this adds another scope of work alongside {existingWOs === 1 ? "it" : "them"}.
                </p>
              )}

              {/* Template */}
              <div>
                <div className="flex items-baseline justify-between mb-2">
                  <label className="block text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
                    Template <span style={{ color: "#ef4444" }}>*</span>
                    {job && matching.length > 0 && <span className="ml-1.5 font-normal" style={{ color: "var(--text-muted)" }}>for {jobTypeLabel(job.type)} jobs</span>}
                  </label>
                  {others.length > 0 && (
                    <button onClick={() => setShowAll(s => !s)} className="text-[11px] font-medium hover:underline" style={{ color: "var(--accent-text)" }}>
                      {showAll ? "Show matching only" : `Show ${others.length} other template${others.length === 1 ? "" : "s"}`}
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {visibleTemplates.map(t => {
                    const active = effectiveTemplateId === t.id;
                    const isSuggested = suggested?.id === t.id;
                    return (
                      <button key={t.id} onClick={() => { setTemplateId(t.id); setTouchedTemplate(true); }}
                        className="text-left rounded-xl p-3 transition-all"
                        style={{ border: `2px solid ${active ? "#4f46e5" : "var(--border)"}`, backgroundColor: active ? "var(--accent-soft-bg)" : "var(--bg-surface-2)" }}>
                        <div className="flex items-center justify-between gap-1">
                          <p className="text-sm font-semibold truncate" style={{ color: "var(--text-primary)" }}>{t.name}</p>
                          {isSuggested && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0" style={{ backgroundColor: "var(--accent-soft-2-bg)", color: "var(--accent-text)" }}>SUGGESTED</span>}
                        </div>
                        <p className="text-[11px] mt-0.5 leading-snug" style={{ color: "var(--text-muted)" }}>{t.description}</p>
                      </button>
                    );
                  })}
                  {/* Blank / custom — for one-off jobs with no matching template */}
                  <button onClick={() => { setTemplateId(BLANK); setTouchedTemplate(true); }}
                    className="text-left rounded-xl p-3 transition-all"
                    style={{ border: `2px solid ${isBlank ? "#4f46e5" : "var(--border)"}`, backgroundColor: isBlank ? "var(--accent-soft-bg)" : "var(--bg-surface-2)" }}>
                    <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Blank / Custom</p>
                    <p className="text-[11px] mt-0.5 leading-snug" style={{ color: "var(--text-muted)" }}>Build a checklist by hand for a one-off or custom job.</p>
                  </button>
                </div>
              </div>

              {/* Preview */}
              {template && (
                <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
                  <div className="px-3 py-2 flex items-center justify-between" style={{ backgroundColor: "var(--bg-surface-2)", borderBottom: "1px solid var(--border)" }}>
                    <p className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>What this work order includes</p>
                    <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>{checklist.length} steps · {photos.length} required photos</span>
                  </div>
                  <div className="px-3 py-2 space-y-1 max-h-44 overflow-y-auto">
                    {checklist.length === 0 ? (
                      <p className="text-xs py-2" style={{ color: "var(--text-muted)" }}>This template has no checklist items.</p>
                    ) : checklist.map(c => (
                      <div key={c.id} className="flex items-center gap-2 text-xs" style={{ color: "var(--text-secondary)" }}>
                        <Check className="w-3 h-3 shrink-0" style={{ color: "var(--text-muted)" }} />
                        <span>{c.label}</span>
                        {c.required && <span className="text-[9px] font-semibold px-1 rounded" style={{ backgroundColor: "var(--bg-input)", color: "var(--text-muted)" }}>required</span>}
                      </div>
                    ))}
                    {photos.map(p => (
                      <div key={p.id} className="flex items-center gap-2 text-xs" style={{ color: "var(--text-secondary)" }}>
                        <Camera className="w-3 h-3 shrink-0" style={{ color: "var(--text-muted)" }} />
                        <span>Photo: {p.category}{p.minCount > 1 ? ` (×${p.minCount})` : ""}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Custom checklist editor (Blank path) */}
              {isBlank && (
                <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
                  <div className="px-3 py-2 flex items-center justify-between" style={{ backgroundColor: "var(--bg-surface-2)", borderBottom: "1px solid var(--border)" }}>
                    <p className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>Custom checklist</p>
                    <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>{customItems.length} steps</span>
                  </div>
                  <div className="px-3 py-2 space-y-1.5">
                    {customItems.map((it, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <Check className="w-3 h-3 shrink-0" style={{ color: "var(--text-muted)" }} />
                        <span className="text-xs flex-1 min-w-0 truncate" style={{ color: "var(--text-secondary)" }}>{it.label}</span>
                        <button onClick={() => setCustomItems(items => items.map((x, idx) => idx === i ? { ...x, required: !x.required } : x))}
                          className="text-[9px] font-semibold px-1.5 py-0.5 rounded shrink-0"
                          style={it.required ? { backgroundColor: "#fef3c7", color: "#92400e" } : { backgroundColor: "var(--bg-input)", color: "var(--text-muted)" }}>
                          {it.required ? "required" : "optional"}
                        </button>
                        <button onClick={() => setCustomItems(items => items.filter((_, idx) => idx !== i))} className="shrink-0" style={{ color: "var(--text-muted)" }}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                    {customItems.length === 0 && (
                      <p className="text-xs py-1" style={{ color: "var(--text-muted)" }}>No steps yet — add the work this job needs.</p>
                    )}
                    <div className="flex items-center gap-2 pt-1">
                      <input value={newItem} onChange={e => setNewItem(e.target.value)}
                        onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addCustomItem(); } }}
                        placeholder="Add a checklist step…" className="flex-1 rounded-lg px-2.5 py-1.5 text-xs outline-none"
                        style={{ border: "1px solid var(--border)", backgroundColor: "var(--bg-surface)", color: "var(--text-primary)" }} />
                      <button onClick={addCustomItem} disabled={!newItem.trim()}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-white disabled:opacity-40" style={{ backgroundColor: "#4f46e5" }}>
                        <Plus className="w-3.5 h-3.5" /> Add
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 flex justify-end gap-2 shrink-0" style={{ borderTop: "1px solid var(--border)" }}>
          <button onClick={onClose} className="px-3 py-2 rounded-lg text-sm" style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}>Cancel</button>
          <button onClick={handleCreate} disabled={!canCreate}
            className="px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-40" style={{ backgroundColor: "#4f46e5" }}>
            Create Work Order
          </button>
        </div>
      </div>
    </div>
  );
}
