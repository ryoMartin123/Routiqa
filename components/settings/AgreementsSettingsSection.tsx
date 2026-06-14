"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  Plus, Pencil, Copy, Trash2, FileText, Wrench, CalendarClock,
  DollarSign, Star, ScrollText, RefreshCw, Hash, Tag,
} from "lucide-react";
import UiSelect from "@/components/ui/Select";
import StatusTabs from "@/components/shared/StatusTabs";
import { useRegisterSaveAction } from "@/components/settings/SettingsActions";
import {
  getAgreementTypes, saveAgreementTypes,
  getAgreementServices, saveAgreementServices,
  getVisitRules, saveVisitRules,
  getBillingRules, saveBillingRules,
  getBenefits, saveBenefits,
  getTermsBlocks, saveTermsBlocks,
  getRenewalRules, saveRenewalRules,
  getNumbering, saveNumbering,
  BENEFIT_KIND_LABELS, SERVICE_SCOPE_LABELS, SERVICE_APPLIES_LABELS,
  VISIT_CADENCE_LABELS, TERM_TYPE_LABELS, RENEWAL_TYPE_LABELS,
  agrId, agrSlug,
  type AgreementType, type AgreementService, type VisitRule, type BillingRule,
  type Benefit, type TermsBlock, type RenewalRule, type BenefitKind,
  type ServiceScopeType, type ServiceApplies, type VisitCadence,
  type TermType, type RenewalType,
} from "@/lib/agreements/settings";
import { getTemplates as getWorkOrderTemplates } from "@/lib/work-order-templates/data";
import { getAllItems } from "@/lib/items/data";
import type { Industry } from "@/lib/agreements/data";
import {
  getPlanTemplates, savePlanTemplates, blankPlanTemplate, type PlanTemplate,
} from "@/lib/agreements/templates";
import TemplateEditorModal from "@/components/agreements/TemplateEditorModal";

// Lets each tab report its save handler + dirty/saved state up to the header.
type Saver = (save: () => void, dirty: boolean, saved: boolean) => void;

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!on)} role="switch" aria-checked={on}
      className="relative w-8 h-4 rounded-full transition-colors shrink-0"
      style={{ backgroundColor: on ? "#4f46e5" : "var(--bg-input)", border: "1px solid var(--border)" }}>
      <span className="absolute top-0.5 left-0.5 w-3 h-3 rounded-full bg-white shadow transition-transform"
        style={{ transform: on ? "translateX(16px)" : "translateX(0)" }} />
    </button>
  );
}

const inputStyle: React.CSSProperties = { border: "1px solid var(--border)", backgroundColor: "var(--bg-surface)", color: "var(--text-primary)" };

// ═══ Schema-driven CRUD for the simpler reusable-defaults tabs ═══
type FieldType = "text" | "number" | "textarea" | "toggle" | "select";
interface FieldDef<T> { key: keyof T; label: string; type: FieldType; options?: { value: string; label: string }[]; min?: number; full?: boolean; }

function SimpleCrud<T extends { id: string; active: boolean; order: number }>({
  title, get, save, fields, primaryKey, makeNew, subtitleKey, register,
}: {
  title: string;
  get: () => T[];
  save: (list: T[]) => void;
  fields: FieldDef<T>[];
  primaryKey: keyof T;
  subtitleKey?: keyof T;
  makeNew: () => T;
  register: Saver;
}) {
  const [items, setItems] = useState<T[]>([]);
  const [editing, setEditing] = useState<T | null>(null);
  const [adding, setAdding] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => { setItems(get()); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const mark = () => { setDirty(true); setSaved(false); };

  const draft = editing;
  function startAdd() { setEditing(makeNew()); setAdding(true); }
  function startEdit(it: T) { setEditing({ ...it }); setAdding(false); }
  function cancel() { setEditing(null); setAdding(false); }
  function commit() {
    if (!draft) return;
    if (adding) setItems(p => [...p, draft]);
    else setItems(p => p.map(x => x.id === draft.id ? draft : x));
    cancel(); mark();
  }
  function toggle(id: string) { setItems(p => p.map(x => x.id === id ? { ...x, active: !x.active } : x)); mark(); }
  function duplicate(it: T) { setItems(p => [...p, { ...it, id: agrId("d"), [primaryKey]: `${String(it[primaryKey])} (Copy)` } as T]); mark(); }
  function remove(id: string) { setItems(p => p.filter(x => x.id !== id)); mark(); }
  function doSave() { save(items); setItems(get()); setDirty(false); setSaved(true); setTimeout(() => setSaved(false), 2000); }

  useEffect(() => { register(doSave, dirty, saved); });

  function setField(key: keyof T, val: unknown) { setEditing(d => d ? { ...d, [key]: val } : d); }

  function Form() {
    if (!draft) return null;
    return (
      <div className="rounded-xl p-4 space-y-3" style={{ backgroundColor: "var(--bg-surface)", border: "2px solid #c7d2fe", boxShadow: "var(--shadow-card)" }}>
        <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#4f46e5" }}>{adding ? `New ${title}` : `Edit ${title}`}</p>
        <div className="grid grid-cols-2 gap-3">
          {fields.map(f => (
            <div key={String(f.key)} className={f.full || f.type === "textarea" ? "col-span-2" : ""}>
              <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>{f.label}</label>
              {f.type === "toggle" ? (
                <Toggle on={Boolean(draft[f.key])} onChange={v => setField(f.key, v)} />
              ) : f.type === "select" ? (
                <UiSelect value={String(draft[f.key] ?? "")} onChange={v => setField(f.key, v)} options={f.options ?? []} />
              ) : f.type === "textarea" ? (
                <textarea value={String(draft[f.key] ?? "")} onChange={e => setField(f.key, e.target.value)} rows={3}
                  className="w-full rounded-lg px-3 py-2 text-sm outline-none resize-none" style={inputStyle} />
              ) : (
                <input type={f.type === "number" ? "number" : "text"} min={f.min} value={String(draft[f.key] ?? "")}
                  onChange={e => setField(f.key, f.type === "number" ? (parseFloat(e.target.value) || 0) : e.target.value)}
                  className="w-full rounded-lg px-3 py-2 text-sm outline-none" style={inputStyle} />
              )}
            </div>
          ))}
        </div>
        <div className="flex items-center justify-end gap-2 pt-1">
          <button onClick={cancel} className="px-3 py-1.5 rounded-lg text-sm" style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}>Cancel</button>
          <button onClick={commit} className="px-4 py-1.5 rounded-lg text-sm font-medium text-white" style={{ backgroundColor: "#4f46e5" }}>{adding ? "Add" : "Update"}</button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {adding && Form()}
      <div className="rounded-xl overflow-hidden" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-subtle)", boxShadow: "var(--shadow-card)" }}>
        <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: "1px solid var(--border-subtle)", backgroundColor: "var(--bg-surface-2)" }}>
          <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{title}
            <span className="ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ backgroundColor: "var(--bg-input)", color: "var(--text-muted)" }}>{items.length}</span></p>
          {!adding && <button onClick={startAdd} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white" style={{ backgroundColor: "#4f46e5" }}><Plus className="w-3.5 h-3.5" /> Add</button>}
        </div>
        {items.length === 0 ? (
          <div className="py-10 text-center"><p className="text-sm" style={{ color: "var(--text-muted)" }}>Nothing here yet.</p></div>
        ) : items.map((it, i) => editing && !adding && editing.id === it.id ? (
          <div key={it.id} className="p-4" style={{ borderBottom: i < items.length - 1 ? "1px solid var(--border-subtle)" : "none" }}>{Form()}</div>
        ) : (
          <div key={it.id} className="flex items-center gap-3 px-4 py-3 hover:bg-[var(--bg-surface-2)] transition-colors"
            style={{ borderBottom: i < items.length - 1 ? "1px solid var(--border-subtle)" : "none", opacity: it.active ? 1 : 0.5 }}>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>{String(it[primaryKey])}</p>
              {subtitleKey && <p className="text-[11px] truncate" style={{ color: "var(--text-muted)" }}>{String(it[subtitleKey] ?? "")}</p>}
            </div>
            <Toggle on={it.active} onChange={() => toggle(it.id)} />
            <button onClick={() => startEdit(it)} className="p-1.5 rounded-lg hover:bg-[var(--bg-input)]" style={{ color: "var(--text-muted)" }}><Pencil className="w-3.5 h-3.5" /></button>
            <button onClick={() => duplicate(it)} className="p-1.5 rounded-lg hover:bg-[var(--bg-input)]" style={{ color: "var(--text-muted)" }}><Copy className="w-3.5 h-3.5" /></button>
            <button onClick={() => remove(it.id)} className="p-1.5 rounded-lg hover:bg-red-50" style={{ color: "#d1d5db" }}
              onMouseEnter={e => (e.currentTarget.style.color = "#ef4444")} onMouseLeave={e => (e.currentTarget.style.color = "#d1d5db")}><Trash2 className="w-3.5 h-3.5" /></button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ═══ Templates tab (plan templates + numbering) ═══════════
const TMPL_STATUS: Record<string, { bg: string; color: string }> = {
  active:   { bg: "#d1fae5", color: "#065f46" },
  draft:    { bg: "#e0e7ff", color: "#3730a3" },
  archived: { bg: "var(--bg-input)", color: "var(--text-muted)" },
};

function TemplatesTab({ register }: { register: Saver }) {
  const [items, setItems] = useState<PlanTemplate[]>([]);
  const [editing, setEditing] = useState<PlanTemplate | null>(null);
  const [adding, setAdding] = useState(false);
  const [numbering, setNumbering] = useState(getNumbering());
  const [dirty, setDirty] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => { setItems(getPlanTemplates()); setNumbering(getNumbering()); }, []);
  const mark = () => { setDirty(true); setSaved(false); };

  function startAdd() { setEditing(blankPlanTemplate()); setAdding(true); }
  function startEdit(t: PlanTemplate) { setEditing({ ...t }); setAdding(false); }
  function cancel() { setEditing(null); setAdding(false); }
  function handleSaved(t: PlanTemplate) {
    if (adding) setItems(p => [...p, t]); else setItems(p => p.map(x => x.id === t.id ? t : x));
    cancel(); mark();
  }
  function toggle(id: string) { setItems(p => p.map(t => t.id === id ? { ...t, active: !t.active } : t)); mark(); }
  function duplicate(t: PlanTemplate) { setItems(p => [...p, { ...t, id: agrId("pt"), name: `${t.name} (Copy)`, key: agrSlug(`${t.key}_copy`), status: "draft" }]); mark(); }
  function remove(id: string) { setItems(p => p.filter(t => t.id !== id)); mark(); }
  function doSave() { savePlanTemplates(items); saveNumbering(numbering); setItems(getPlanTemplates()); setDirty(false); setSaved(true); setTimeout(() => setSaved(false), 2000); }

  useEffect(() => { register(doSave, dirty, saved); });

  return (
    <div className="space-y-4">
      {editing && <TemplateEditorModal template={editing} isNew={adding} onCancel={cancel} onSave={handleSaved} />}
      <div className="rounded-xl overflow-hidden" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-subtle)", boxShadow: "var(--shadow-card)" }}>
        <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: "1px solid var(--border-subtle)", backgroundColor: "var(--bg-surface-2)" }}>
          <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Agreement Templates
            <span className="ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ backgroundColor: "var(--bg-input)", color: "var(--text-muted)" }}>{items.length}</span></p>
          <button onClick={startAdd} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white" style={{ backgroundColor: "#4f46e5" }}><Plus className="w-3.5 h-3.5" /> Add Template</button>
        </div>
        <div className="grid px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider"
          style={{ gridTemplateColumns: "2.2fr 1fr 0.8fr 0.8fr 0.7fr auto", gap: "0.75rem", color: "var(--text-muted)", borderBottom: "1px solid var(--border-subtle)" }}>
          <span>Template</span><span>Industry</span><span>Services</span><span>Visits</span><span>Status</span><span />
        </div>
        {items.map((t, i) => (
          <div key={t.id} className="grid px-4 py-3 items-center hover:bg-[var(--bg-surface-2)] transition-colors"
            style={{ gridTemplateColumns: "2.2fr 1fr 0.8fr 0.8fr 0.7fr auto", gap: "0.75rem", borderBottom: i < items.length - 1 ? "1px solid var(--border-subtle)" : "none", opacity: t.active ? 1 : 0.5 }}>
            <div className="min-w-0"><p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>{t.name}</p><p className="text-[11px] truncate" style={{ color: "var(--text-muted)" }}>{t.description}</p></div>
            <span className="text-xs" style={{ color: "var(--text-secondary)" }}>{t.industry}</span>
            <span className="text-xs" style={{ color: "var(--text-secondary)" }}>{t.services.length}</span>
            <span className="text-xs" style={{ color: "var(--text-secondary)" }}>{t.visits.length}</span>
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full inline-block w-fit" style={TMPL_STATUS[t.status]}>{t.status}</span>
            <div className="flex items-center gap-1 justify-end">
              <button onClick={() => startEdit(t)} className="p-1.5 rounded-lg hover:bg-[var(--bg-input)]" style={{ color: "var(--text-muted)" }}><Pencil className="w-3.5 h-3.5" /></button>
              <button onClick={() => duplicate(t)} className="p-1.5 rounded-lg hover:bg-[var(--bg-input)]" style={{ color: "var(--text-muted)" }}><Copy className="w-3.5 h-3.5" /></button>
              <button onClick={() => remove(t.id)} className="p-1.5 rounded-lg hover:bg-red-50" style={{ color: "#d1d5db" }}
                onMouseEnter={e => (e.currentTarget.style.color = "#ef4444")} onMouseLeave={e => (e.currentTarget.style.color = "#d1d5db")}><Trash2 className="w-3.5 h-3.5" /></button>
            </div>
          </div>
        ))}
      </div>

      {/* Numbering */}
      <div className="rounded-xl p-4" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-subtle)", boxShadow: "var(--shadow-card)" }}>
        <div className="flex items-center gap-2 mb-3"><Hash className="w-3.5 h-3.5" style={{ color: "#4f46e5" }} /><p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Agreement Numbering</p></div>
        <div className="grid grid-cols-3 gap-3">
          <div><label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Prefix</label>
            <input value={numbering.prefix} onChange={e => { setNumbering(n => ({ ...n, prefix: e.target.value })); mark(); }} className="w-full rounded-lg px-3 py-2 text-sm outline-none" style={inputStyle} /></div>
          <div><label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Next Number</label>
            <input type="number" value={numbering.nextSeq} onChange={e => { setNumbering(n => ({ ...n, nextSeq: parseInt(e.target.value) || 0 })); mark(); }} className="w-full rounded-lg px-3 py-2 text-sm outline-none" style={inputStyle} /></div>
          <div><label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Zero Padding</label>
            <input type="number" min={1} value={numbering.padding} onChange={e => { setNumbering(n => ({ ...n, padding: parseInt(e.target.value) || 1 })); mark(); }} className="w-full rounded-lg px-3 py-2 text-sm outline-none" style={inputStyle} /></div>
        </div>
        <p className="text-[11px] mt-2" style={{ color: "var(--text-muted)" }}>Next agreement: <span className="font-mono" style={{ color: "var(--text-secondary)" }}>{numbering.prefix}-{String(numbering.nextSeq).padStart(numbering.padding, "0")}</span></p>
      </div>
    </div>
  );
}

// ═══ Main section ═════════════════════════════════════════
const TABS = [
  { key: "templates", label: "Templates",    icon: FileText },
  { key: "types",     label: "Types",        icon: Tag },
  { key: "services",  label: "Service Templates", icon: Wrench },
  { key: "visits",    label: "Visit Rules",  icon: CalendarClock },
  { key: "billing",   label: "Billing Rules",icon: DollarSign },
  { key: "benefits",  label: "Benefits",     icon: Star },
  { key: "terms",     label: "Terms",        icon: ScrollText },
  { key: "renewals",  label: "Renewals",     icon: RefreshCw },
] as const;
type TabKey = typeof TABS[number]["key"];

// Option lists shared by the Service Templates form (linked item / work order).
const INDUSTRY_OPTIONS: { value: Industry; label: string }[] = [
  { value: "HVAC", label: "HVAC" }, { value: "Roofing", label: "Roofing" },
  { value: "Plumbing", label: "Plumbing" }, { value: "Property Maintenance", label: "Property Maintenance" },
  { value: "Consulting", label: "Consulting" }, { value: "General", label: "General" },
];
const SCOPE_OPTIONS = (Object.keys(SERVICE_SCOPE_LABELS) as ServiceScopeType[]).map(k => ({ value: k, label: SERVICE_SCOPE_LABELS[k] }));
const APPLIES_OPTIONS = (Object.keys(SERVICE_APPLIES_LABELS) as ServiceApplies[]).map(k => ({ value: k, label: SERVICE_APPLIES_LABELS[k] }));
const CADENCE_OPTIONS = (Object.keys(VISIT_CADENCE_LABELS) as VisitCadence[]).map(k => ({ value: k, label: VISIT_CADENCE_LABELS[k] }));
const TERM_TYPE_OPTIONS = (Object.keys(TERM_TYPE_LABELS) as TermType[]).map(k => ({ value: k, label: TERM_TYPE_LABELS[k] }));
const RENEWAL_TYPE_OPTIONS = (Object.keys(RENEWAL_TYPE_LABELS) as RenewalType[]).map(k => ({ value: k, label: RENEWAL_TYPE_LABELS[k] }));
const PRICE_INC_OPTIONS = [{ value: "pct", label: "Percentage" }, { value: "flat", label: "Flat amount" }];

export default function AgreementsSettingsSection() {
  const [tab, setTab] = useState<TabKey>("templates");
  // Linked-item / work-order-template option lists for the Service Templates tab.
  const woOptions = useMemo(() => [{ value: "", label: "None" }, ...getWorkOrderTemplates().filter(t => t.active).map(t => ({ value: t.id, label: t.name }))], []);
  const itemOptions = useMemo(() => [{ value: "", label: "None" }, ...getAllItems().map(i => ({ value: i.id, label: i.name }))], []);

  const saverRef = useRef<() => void>(() => {});
  const [hdr, setHdr] = useState<{ dirty: boolean; saved: boolean }>({ dirty: false, saved: false });
  const register = useCallback<Saver>((save, dirty, saved) => {
    saverRef.current = save;
    setHdr(prev => (prev.dirty === dirty && prev.saved === saved) ? prev : { dirty, saved });
  }, []);
  function switchTab(next: TabKey) { setTab(next); setHdr({ dirty: false, saved: false }); }

  // Publish Save to the shared top-right settings slot (same as Pipelines /
  // Calendar-Dispatch) instead of a local button inside the section.
  useRegisterSaveAction({ dirty: hdr.dirty, saved: hdr.saved, onSave: () => saverRef.current() });

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>Agreements</h2>
        <p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>
          Reusable defaults for service plans — templates, types, visit &amp; billing rules, benefits, terms, and renewals.
        </p>
      </div>

      <div className="overflow-x-auto">
        <StatusTabs active={tab} onChange={k => switchTab(k as TabKey)}
          tabs={TABS.map(t => ({ key: t.key, label: t.label, icon: t.icon }))} />
      </div>

      {tab === "templates" && <TemplatesTab register={register} />}
      {tab === "types" && (
        <SimpleCrud<AgreementType> title="Agreement Type" get={getAgreementTypes} save={saveAgreementTypes} register={register}
          primaryKey="name" subtitleKey="description"
          fields={[
            { key: "name", label: "Name", type: "text" },
            { key: "industry", label: "Industry", type: "select", options: INDUSTRY_OPTIONS },
            { key: "description", label: "Description", type: "text", full: true },
            { key: "active", label: "Active", type: "toggle" },
          ]}
          makeNew={() => ({ id: agrId("at"), name: "", key: "", industry: "General", description: "", active: true, order: 999 })} />
      )}
      {tab === "services" && (
        <SimpleCrud<AgreementService> title="Service Template" get={getAgreementServices} save={saveAgreementServices} register={register}
          primaryKey="name" subtitleKey="description"
          fields={[
            { key: "name", label: "Name", type: "text" },
            { key: "description", label: "Description", type: "text", full: true },
            { key: "scopeType", label: "Service Type", type: "select", options: SCOPE_OPTIONS },
            { key: "applies", label: "Applies", type: "select", options: APPLIES_OPTIONS },
            { key: "defaultQuantity", label: "Default Qty / Limit", type: "number", min: 0 },
            { key: "limit", label: "Usage Limit", type: "number", min: 0 },
            { key: "itemId", label: "Linked Item", type: "select", options: itemOptions },
            { key: "workOrderTemplateId", label: "Linked Work Order", type: "select", options: woOptions },
            { key: "active", label: "Active", type: "toggle" },
          ]}
          makeNew={() => ({ id: agrId("as"), name: "", description: "", scopeType: "included", applies: "per_visit", active: true, order: 999 })} />
      )}
      {tab === "visits" && (
        <SimpleCrud<VisitRule> title="Visit Rule" get={getVisitRules} save={saveVisitRules} register={register}
          primaryKey="name" subtitleKey="key"
          fields={[
            { key: "name", label: "Name", type: "text" },
            { key: "cadenceKind", label: "Cadence", type: "select", options: CADENCE_OPTIONS },
            { key: "visitsPerYear", label: "Visits / Year", type: "number", min: 0 },
            { key: "defaultDurationMin", label: "Default Duration (min)", type: "number", min: 0 },
            { key: "active", label: "Active", type: "toggle" },
          ]}
          makeNew={() => ({ id: agrId("vr"), name: "", key: "", cadenceKind: "custom", visitsPerYear: 1, defaultDurationMin: 90, active: true, order: 999 })} />
      )}
      {tab === "billing" && (
        <SimpleCrud<BillingRule> title="Billing Rule" get={getBillingRules} save={saveBillingRules} register={register}
          primaryKey="name" subtitleKey="key"
          fields={[
            { key: "name", label: "Name", type: "text" },
            { key: "periodsPerYear", label: "Periods / Year", type: "number", min: 0 },
            { key: "active", label: "Active", type: "toggle" },
          ]}
          makeNew={() => ({ id: agrId("br"), name: "", key: "", periodsPerYear: 1, active: true, order: 999 })} />
      )}
      {tab === "benefits" && (
        <SimpleCrud<Benefit> title="Benefit" get={getBenefits} save={saveBenefits} register={register}
          primaryKey="label" subtitleKey="value"
          fields={[
            { key: "label", label: "Label", type: "text" },
            { key: "kind", label: "Benefit Type", type: "select", options: (Object.keys(BENEFIT_KIND_LABELS) as BenefitKind[]).map(k => ({ value: k, label: BENEFIT_KIND_LABELS[k] })) },
            { key: "description", label: "Description", type: "text", full: true },
            { key: "value", label: "Value / Discount", type: "text" },
            { key: "appliesTo", label: "Applies To", type: "text" },
            { key: "limit", label: "Limit", type: "text" },
            { key: "active", label: "Active", type: "toggle" },
          ]}
          makeNew={() => ({ id: agrId("bn"), label: "", kind: "custom", description: "", value: "", appliesTo: "", limit: "", active: true, order: 999 })} />
      )}
      {tab === "terms" && (
        <SimpleCrud<TermsBlock> title="Terms Block" get={getTermsBlocks} save={saveTermsBlocks} register={register}
          primaryKey="title" subtitleKey="body"
          fields={[
            { key: "title", label: "Term Name", type: "text" },
            { key: "termType", label: "Term Type", type: "select", options: TERM_TYPE_OPTIONS },
            { key: "body", label: "Default Text", type: "textarea" },
            { key: "required", label: "Required", type: "toggle" },
            { key: "editable", label: "Editable", type: "toggle" },
            { key: "active", label: "Active", type: "toggle" },
          ]}
          makeNew={() => ({ id: agrId("tb"), title: "", body: "", termType: "custom", required: false, editable: true, active: true, order: 999 })} />
      )}
      {tab === "renewals" && (
        <SimpleCrud<RenewalRule> title="Renewal Rule" get={getRenewalRules} save={saveRenewalRules} register={register}
          primaryKey="name"
          fields={[
            { key: "name", label: "Name", type: "text" },
            { key: "renewalType", label: "Renewal Type", type: "select", options: RENEWAL_TYPE_OPTIONS },
            { key: "termMonths", label: "Term Length (months)", type: "number", min: 1 },
            { key: "reminderDays", label: "Reminder (days before)", type: "number", min: 0 },
            { key: "noticeDays", label: "Notice (days)", type: "number", min: 0 },
            { key: "priceIncreaseType", label: "Price Increase Rule", type: "select", options: PRICE_INC_OPTIONS },
            { key: "priceIncreasePct", label: "Price Increase Amount", type: "number", min: 0 },
            { key: "approvalRequired", label: "Approval Required", type: "toggle" },
            { key: "generateTask", label: "Generate Renewal Task", type: "toggle" },
            { key: "generateQuote", label: "Generate Renewal Quote", type: "toggle" },
            { key: "autoRenew", label: "Auto-renew", type: "toggle" },
            { key: "active", label: "Active", type: "toggle" },
          ]}
          makeNew={() => ({ id: agrId("rr"), name: "", renewalType: "auto_same", autoRenew: true, termMonths: 12, noticeDays: 30, reminderDays: 45, priceIncreasePct: 0, priceIncreaseType: "pct", approvalRequired: false, generateTask: true, generateQuote: false, active: true, order: 999 })} />
      )}
    </div>
  );
}
