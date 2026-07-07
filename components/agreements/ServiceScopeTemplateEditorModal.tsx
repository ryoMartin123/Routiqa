"use client";

// ─── ServiceScopeTemplateEditorModal ──────────────────────
// Editor for a reusable Service Scope Template ("what we do"): metadata plus an
// editable list of services (tasks). Mirrors TemplateEditorModal's chrome.

import { useMemo, useState } from "react";
import { X, Wrench, Check, Plus, Trash2 } from "lucide-react";
import UiSelect from "@/components/ui/Select";
import {
  SERVICE_SCOPE_LABELS, SERVICE_APPLIES_LABELS, agrId, agrSlug,
  type ServiceScopeType, type ServiceApplies,
} from "@/lib/agreements/settings";
import { getAllItems } from "@/lib/items/data";
import { getTemplates as getWorkOrderTemplates } from "@/lib/work-order-templates/data";
import type { TemplateService } from "@/lib/agreements/templates";
import { getServiceItems, serviceItemToService, type ServiceScopeTemplate } from "@/lib/agreements/template-library";

const INDUSTRIES = ["HVAC", "Roofing", "Plumbing", "Property Maintenance", "Consulting", "General"] as const;
const inputStyle: React.CSSProperties = { border: "1px solid var(--border)", backgroundColor: "var(--bg-surface)", color: "var(--text-primary)" };
const cardStyle: React.CSSProperties = { backgroundColor: "var(--bg-surface-2)", border: "1px solid var(--border)" };

const SCOPE_OPTIONS = (Object.keys(SERVICE_SCOPE_LABELS) as ServiceScopeType[]).map(k => ({ value: k, label: SERVICE_SCOPE_LABELS[k] }));
const APPLIES_OPTIONS = (Object.keys(SERVICE_APPLIES_LABELS) as ServiceApplies[]).map(k => ({ value: k, label: SERVICE_APPLIES_LABELS[k] }));

export default function ServiceScopeTemplateEditorModal({ template, isNew, onCancel, onSave }: {
  template: ServiceScopeTemplate;
  isNew: boolean;
  onCancel: () => void;
  onSave: (t: ServiceScopeTemplate) => void;
}) {
  const [draft, setDraft] = useState<ServiceScopeTemplate>(template);
  const set = <K extends keyof ServiceScopeTemplate>(key: K, val: ServiceScopeTemplate[K]) => setDraft(d => ({ ...d, [key]: val }));

  const woOptions = useMemo(() => [{ value: "", label: "None" }, ...getWorkOrderTemplates().filter(t => t.active).map(t => ({ value: t.id, label: t.name }))], []);
  const itemOptions = useMemo(() => [{ value: "", label: "None" }, ...getAllItems().map(i => ({ value: i.id, label: i.name }))], []);

  const serviceOptions = useMemo(() => getServiceItems().filter(s => s.active).map(s => ({ value: s.id, label: s.name })), []);
  const setService = (id: string, patch: Partial<TemplateService>) => setDraft(d => ({ ...d, services: d.services.map(s => s.id === id ? { ...s, ...patch } : s) }));
  const addService = () => setDraft(d => ({ ...d, services: [...d.services, { id: agrId("ts"), name: "", description: "", quantity: 1, included: true, scopeType: "included", applies: "per_visit" }] }));
  const addFromLibrary = (itemId: string) => {
    const si = getServiceItems().find(s => s.id === itemId); if (!si) return;
    setDraft(d => ({ ...d, services: [...d.services, serviceItemToService(si)] }));
  };
  const removeService = (id: string) => setDraft(d => ({ ...d, services: d.services.filter(s => s.id !== id) }));

  const hasName = draft.name.trim().length > 0;
  const hasService = draft.services.some(s => s.name.trim());
  const canSave = hasName && hasService;

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
            <Wrench className="w-4 h-4" style={{ color: "#0f8578" }} />
            <p className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>{isNew ? "New Service Scope" : "Edit Service Scope"}</p>
          </div>
          <button onClick={onCancel} style={{ color: "var(--text-muted)" }}><X className="w-4 h-4" /></button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto thin-scroll-y px-6 py-5 space-y-6">
          <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>Service Scope = <span style={{ fontWeight: 600 }}>what we do</span>. Group the services performed during visits.</p>

          {/* Metadata */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Name *">
              <input value={draft.name} onChange={e => set("name", e.target.value)} placeholder="e.g. HVAC Cooling Tune-Up Services"
                className="w-full rounded-lg px-3 py-2 text-sm outline-none" style={inputStyle} />
            </Field>
            <Field label="Industry">
              <UiSelect value={draft.industry ?? "General"} onChange={v => set("industry", v as ServiceScopeTemplate["industry"])} options={INDUSTRIES.map(i => ({ value: i, label: i }))} />
            </Field>
            <div className="col-span-2">
              <Field label="Description">
                <input value={draft.description ?? ""} onChange={e => set("description", e.target.value)} placeholder="Short summary shown when choosing this scope"
                  className="w-full rounded-lg px-3 py-2 text-sm outline-none" style={inputStyle} />
              </Field>
            </div>
            <Field label="Status">
              <UiSelect value={draft.active ? "active" : "inactive"} onChange={v => set("active", v === "active")}
                options={[{ value: "active", label: "Active" }, { value: "inactive", label: "Inactive" }]} />
            </Field>
          </div>

          <div className="h-px" style={{ backgroundColor: "var(--border-subtle)" }} />

          {/* Services */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>Services</p>
              <div className="flex items-center gap-2">
                {serviceOptions.length > 0 && (
                  <div className="w-48"><UiSelect size="sm" value="" placeholder="+ From Services library…" onChange={(id) => { if (id) addFromLibrary(id); }} options={serviceOptions} /></div>
                )}
                <button onClick={addService} className="flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-lg cursor-pointer transition-colors hover:bg-[var(--bg-surface-2)]"
                  style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}><Plus className="w-3 h-3" /> Custom</button>
              </div>
            </div>
            {draft.services.length === 0 && <p className="text-xs py-2" style={{ color: "var(--text-muted)" }}>No services yet. Add the tasks performed during visits.</p>}
            {draft.services.map(s => (
              <div key={s.id} className="rounded-xl p-3 space-y-2" style={cardStyle}>
                <div className="flex items-center gap-2">
                  <input value={s.name} onChange={e => setService(s.id, { name: e.target.value })} placeholder="Service name (e.g. Inspect outdoor coil)"
                    className="flex-1 rounded-lg px-2.5 py-1.5 text-sm outline-none" style={inputStyle} />
                  <button onClick={() => removeService(s.id)} className="p-1.5 rounded-lg shrink-0" style={{ color: "var(--text-muted)" }}><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
                <input value={s.description ?? ""} onChange={e => setService(s.id, { description: e.target.value })} placeholder="Description (optional)"
                  className="w-full rounded-lg px-2.5 py-1.5 text-xs outline-none" style={inputStyle} />
                <div className="grid grid-cols-2 gap-2">
                  <Mini label="Service Type"><UiSelect size="sm" value={s.scopeType ?? "included"} onChange={k => setService(s.id, { scopeType: k as ServiceScopeType, included: k === "included" || k === "covered_item" })} options={SCOPE_OPTIONS} /></Mini>
                  <Mini label="Applies"><UiSelect size="sm" value={s.applies ?? "per_visit"} onChange={k => setService(s.id, { applies: k as ServiceApplies })} options={APPLIES_OPTIONS} /></Mini>
                  <Mini label="Quantity"><input type="number" min={0} value={s.quantity} onChange={e => setService(s.id, { quantity: parseInt(e.target.value) || 1 })}
                    className="w-full rounded-lg px-2.5 py-1.5 text-xs outline-none" style={inputStyle} /></Mini>
                  <Mini label="Limit (optional)"><input type="number" min={0} value={s.limit ?? ""} onChange={e => setService(s.id, { limit: e.target.value ? parseInt(e.target.value) : undefined })} placeholder="No limit"
                    className="w-full rounded-lg px-2.5 py-1.5 text-xs outline-none" style={inputStyle} /></Mini>
                  <Mini label="Linked Item (optional)"><UiSelect size="sm" value={s.itemId ?? ""} onChange={k => setService(s.id, { itemId: k })} options={itemOptions} /></Mini>
                  <Mini label="Linked Work Order (optional)"><UiSelect size="sm" value={s.workOrderTemplateId ?? ""} onChange={k => setService(s.id, { workOrderTemplateId: k })} options={woOptions} /></Mini>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 flex items-center justify-between gap-3 shrink-0" style={{ borderTop: "1px solid var(--border)" }}>
          <p className="text-[11px]" style={{ color: canSave ? "var(--text-muted)" : "#dc2626" }}>
            {!hasName ? "Name your scope to save." : !hasService ? "Add at least one named service to save." : "Ready to save."}
          </p>
          <div className="flex items-center gap-2">
            <button onClick={onCancel} className="px-3 py-2 rounded-lg text-sm" style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}>Cancel</button>
            <button onClick={save} disabled={!canSave}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-40 transition-colors" style={{ backgroundColor: "#0f8578" }}>
              <Check className="w-4 h-4" /> {isNew ? "Add Scope" : "Save Scope"}
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
