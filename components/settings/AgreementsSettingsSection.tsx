"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  Plus, Pencil, Copy, Trash2, FileText, Wrench, CalendarClock,
  DollarSign, Star, ScrollText, RefreshCw, Hash, Tag, Search, ChevronRight,
} from "lucide-react";
import UiSelect from "@/components/ui/Select";
import { useRegisterSaveAction } from "@/components/settings/SettingsActions";
import {
  getAgreementTypes, saveAgreementTypes,
  getVisitRules,
  getBillingRules, saveBillingRules,
  getBenefits, saveBenefits,
  getTermsBlocks, saveTermsBlocks,
  getRenewalRules, saveRenewalRules,
  getNumbering, saveNumbering,
  BENEFIT_KIND_LABELS, TERM_TYPE_LABELS, RENEWAL_TYPE_LABELS,
  SERVICE_SCOPE_LABELS, SERVICE_APPLIES_LABELS,
  agrId, agrSlug,
  type AgreementType, type BillingRule,
  type Benefit, type TermsBlock, type RenewalRule, type BenefitKind,
  type TermType, type RenewalType, type ServiceScopeType, type ServiceApplies,
} from "@/lib/agreements/settings";
import type { Industry } from "@/lib/agreements/data";
import {
  getPlanTemplates, savePlanTemplates, blankPlanTemplate, type PlanTemplate,
} from "@/lib/agreements/templates";
import {
  getVisitScheduleTemplates, saveVisitScheduleTemplates, blankVisitSchedule, type VisitScheduleTemplate,
  getServiceScopeTemplates, saveServiceScopeTemplates, blankServiceScope, type ServiceScopeTemplate,
  getVisitTemplates, saveVisitTemplates, type VisitTemplate,
  getServiceItems, saveServiceItems, type ServiceItem,
} from "@/lib/agreements/template-library";
import { getJobTypes } from "@/lib/job-config/data";
import { getTemplates as getWorkOrderTemplates } from "@/lib/work-order-templates/data";
import { getAllItems } from "@/lib/items/data";
import { getBoardsForContext } from "@/lib/calendar/settings";
import TemplateEditorModal from "@/components/agreements/TemplateEditorModal";
import VisitScheduleTemplateEditorModal from "@/components/agreements/VisitScheduleTemplateEditorModal";
import ServiceScopeTemplateEditorModal from "@/components/agreements/ServiceScopeTemplateEditorModal";

// Each list reports its save handler + dirty/saved up to the section, keyed by a
// stable id so a page can host more than one independent list (stacked pages).
type Saver = (id: string, save: () => void, dirty: boolean, saved: boolean) => void;

const inputStyle: React.CSSProperties = { border: "1px solid var(--border)", backgroundColor: "var(--bg-surface)", color: "var(--text-primary)" };

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!on)} role="switch" aria-checked={on}
      className="relative w-8 h-4 rounded-full transition-colors shrink-0"
      style={{ backgroundColor: on ? "#0f8578" : "var(--bg-input)", border: "1px solid var(--border)" }}>
      <span className="absolute top-0.5 left-0.5 w-3 h-3 rounded-full bg-white shadow transition-transform"
        style={{ transform: on ? "translateX(16px)" : "translateX(0)" }} />
    </button>
  );
}

function SearchInput({ value, onChange, placeholder = "Search…" }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div className="relative">
      <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }} />
      <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        className="w-44 rounded-lg pl-8 pr-3 py-1.5 text-xs outline-none" style={inputStyle} />
    </div>
  );
}

const match = (hay: unknown, q: string) => String(hay ?? "").toLowerCase().includes(q.trim().toLowerCase());

// ═══ Schema-driven CRUD for the simpler reusable-defaults lists ═══
type FieldType = "text" | "number" | "textarea" | "toggle" | "select";
interface FieldDef<T> { key: keyof T; label: string; type: FieldType; options?: { value: string; label: string }[]; min?: number; full?: boolean; }

function SimpleCrud<T extends { id: string; active: boolean; order: number }>({
  title, get, save, fields, primaryKey, makeNew, subtitleKey, register, saveId, rowToggle = true,
}: {
  title: string;
  get: () => T[];
  save: (list: T[]) => void;
  fields: FieldDef<T>[];
  primaryKey: keyof T;
  subtitleKey?: keyof T;
  makeNew: () => T;
  register: Saver;
  saveId: string;
  rowToggle?: boolean;   // show the active toggle in each row (off → manage active via Edit)
}) {
  const [items, setItems] = useState<T[]>([]);
  const [editing, setEditing] = useState<T | null>(null);
  const [adding, setAdding] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [saved, setSaved] = useState(false);
  const [query, setQuery] = useState("");

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

  useEffect(() => { register(saveId, doSave, dirty, saved); });

  function setField(key: keyof T, val: unknown) { setEditing(d => d ? { ...d, [key]: val } : d); }

  const shown = query.trim() ? items.filter(it => match(it[primaryKey], query)) : items;

  function Form() {
    if (!draft) return null;
    return (
      <div className="rounded-xl p-4 space-y-3" style={{ backgroundColor: "var(--bg-surface)", border: "2px solid #b9dfd8", boxShadow: "var(--shadow-card)" }}>
        <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#0f8578" }}>{adding ? `New ${title}` : `Edit ${title}`}</p>
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
          <button onClick={cancel} className="px-3 py-1.5 rounded-lg text-sm cursor-pointer" style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}>Cancel</button>
          <button onClick={commit} className="px-4 py-1.5 rounded-lg text-sm font-medium text-white cursor-pointer" style={{ backgroundColor: "#0f8578" }}>{adding ? "Add" : "Update"}</button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {adding && Form()}
      <div className="rounded-xl overflow-hidden" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" }}>
        <div className="flex items-center justify-between gap-3 px-4 py-3" style={{ borderBottom: "1px solid var(--border)", backgroundColor: "var(--bg-surface-2)" }}>
          <p className="text-sm font-semibold shrink-0" style={{ color: "var(--text-primary)" }}>{title}
            <span className="ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ backgroundColor: "var(--bg-input)", color: "var(--text-muted)" }}>{items.length}</span></p>
          <div className="flex items-center gap-2">
            {items.length > 0 && <SearchInput value={query} onChange={setQuery} />}
            {!adding && <button onClick={startAdd} title={`Add ${title}`} aria-label={`Add ${title}`} className="flex items-center justify-center p-1.5 rounded-lg text-white cursor-pointer transition hover:brightness-110" style={{ backgroundColor: "#0f8578" }}><Plus className="w-4 h-4" /></button>}
          </div>
        </div>
        {items.length === 0 ? (
          <div className="py-10 text-center"><p className="text-sm" style={{ color: "var(--text-muted)" }}>Nothing here yet.</p></div>
        ) : shown.length === 0 ? (
          <div className="py-10 text-center"><p className="text-sm" style={{ color: "var(--text-muted)" }}>No matches for “{query}”.</p></div>
        ) : shown.map((it, i) => editing && !adding && editing.id === it.id ? (
          <div key={it.id} className="p-4" style={{ borderBottom: i < shown.length - 1 ? "1px solid var(--border)" : "none" }}>{Form()}</div>
        ) : (
          <div key={it.id} className="flex items-center gap-3 px-4 py-3 hover:bg-[var(--bg-surface-2)] transition-colors"
            style={{ borderBottom: i < shown.length - 1 ? "1px solid var(--border)" : "none", opacity: it.active ? 1 : 0.5 }}>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>{String(it[primaryKey])}</p>
              {subtitleKey && <p className="text-[11px] truncate" style={{ color: "var(--text-muted)" }}>{String(it[subtitleKey] ?? "")}</p>}
            </div>
            {rowToggle && <Toggle on={it.active} onChange={() => toggle(it.id)} />}
            <button onClick={() => startEdit(it)} className="p-1.5 rounded-lg hover:bg-[var(--bg-input)] cursor-pointer" style={{ color: "var(--text-muted)" }}><Pencil className="w-3.5 h-3.5" /></button>
            <button onClick={() => duplicate(it)} className="p-1.5 rounded-lg hover:bg-[var(--bg-input)] cursor-pointer" style={{ color: "var(--text-muted)" }}><Copy className="w-3.5 h-3.5" /></button>
            <button onClick={() => remove(it.id)} className="p-1.5 rounded-lg hover:bg-red-50 cursor-pointer" style={{ color: "#d1d5db" }}
              onMouseEnter={e => (e.currentTarget.style.color = "#ef4444")} onMouseLeave={e => (e.currentTarget.style.color = "#d1d5db")}><Trash2 className="w-3.5 h-3.5" /></button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ═══ Agreement (plan) templates + numbering ═══════════════
const TMPL_STATUS: Record<string, { bg: string; color: string }> = {
  active:   { bg: "#d1fae5", color: "#065f46" },
  draft:    { bg: "#d3ebe6", color: "#0a5c53" },
  archived: { bg: "var(--bg-input)", color: "var(--text-muted)" },
};

function TemplatesTab({ register }: { register: Saver }) {
  const [items, setItems] = useState<PlanTemplate[]>([]);
  const [editing, setEditing] = useState<PlanTemplate | null>(null);
  const [adding, setAdding] = useState(false);
  const [numbering, setNumbering] = useState(getNumbering());
  const [dirty, setDirty] = useState(false);
  const [saved, setSaved] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => { setItems(getPlanTemplates()); setNumbering(getNumbering()); }, []);
  const mark = () => { setDirty(true); setSaved(false); };

  function startAdd() { setEditing(blankPlanTemplate()); setAdding(true); }
  function startEdit(t: PlanTemplate) { setEditing({ ...t }); setAdding(false); }
  function cancel() { setEditing(null); setAdding(false); }
  function handleSaved(t: PlanTemplate) {
    if (adding) setItems(p => [...p, t]); else setItems(p => p.map(x => x.id === t.id ? t : x));
    cancel(); mark();
  }
  function duplicate(t: PlanTemplate) { setItems(p => [...p, { ...t, id: agrId("pt"), name: `${t.name} (Copy)`, key: agrSlug(`${t.key}_copy`), status: "draft" }]); mark(); }
  function remove(id: string) { setItems(p => p.filter(t => t.id !== id)); mark(); }
  function doSave() { savePlanTemplates(items); saveNumbering(numbering); setItems(getPlanTemplates()); setDirty(false); setSaved(true); setTimeout(() => setSaved(false), 2000); }

  useEffect(() => { register("templates", doSave, dirty, saved); });

  const shown = query.trim() ? items.filter(t => match(t.name, query)) : items;

  return (
    <div className="space-y-4">
      {editing && <TemplateEditorModal template={editing} isNew={adding} onCancel={cancel} onSave={handleSaved} />}
      <div className="rounded-xl overflow-hidden" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" }}>
        <div className="flex items-center justify-between gap-3 px-4 py-3" style={{ borderBottom: "1px solid var(--border)", backgroundColor: "var(--bg-surface-2)" }}>
          <p className="text-sm font-semibold shrink-0" style={{ color: "var(--text-primary)" }}>Agreement Templates
            <span className="ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ backgroundColor: "var(--bg-input)", color: "var(--text-muted)" }}>{items.length}</span></p>
          <div className="flex items-center gap-2">
            {items.length > 0 && <SearchInput value={query} onChange={setQuery} />}
            <button onClick={startAdd} title="Add Template" aria-label="Add Template" className="flex items-center justify-center p-1.5 rounded-lg text-white cursor-pointer transition hover:brightness-110" style={{ backgroundColor: "#0f8578" }}><Plus className="w-4 h-4" /></button>
          </div>
        </div>
        <div className="grid px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider"
          style={{ gridTemplateColumns: "2.2fr 1fr 0.8fr 0.8fr 0.7fr 96px", gap: "0.75rem", color: "var(--text-muted)", borderBottom: "1px solid var(--border)" }}>
          <span>Template</span><span>Industry</span><span>Services</span><span>Visits</span><span>Status</span><span />
        </div>
        {shown.length === 0 ? (
          <div className="py-10 text-center"><p className="text-sm" style={{ color: "var(--text-muted)" }}>{items.length === 0 ? "No templates yet." : `No matches for “${query}”.`}</p></div>
        ) : shown.map((t, i) => (
          <div key={t.id} className="grid px-4 py-3 items-center hover:bg-[var(--bg-surface-2)] transition-colors"
            style={{ gridTemplateColumns: "2.2fr 1fr 0.8fr 0.8fr 0.7fr 96px", gap: "0.75rem", borderBottom: i < shown.length - 1 ? "1px solid var(--border)" : "none", opacity: t.active ? 1 : 0.5 }}>
            <div className="min-w-0"><p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>{t.name}</p><p className="text-[11px] truncate" style={{ color: "var(--text-muted)" }}>{t.description}</p></div>
            <span className="text-xs" style={{ color: "var(--text-secondary)" }}>{t.industry}</span>
            <span className="text-xs" style={{ color: "var(--text-secondary)" }}>{t.services.length}</span>
            <span className="text-xs" style={{ color: "var(--text-secondary)" }}>{t.visits.length}</span>
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full inline-block w-fit" style={TMPL_STATUS[t.status]}>{t.status}</span>
            <div className="flex items-center gap-1 justify-end">
              <button onClick={() => startEdit(t)} className="p-1.5 rounded-lg hover:bg-[var(--bg-input)] cursor-pointer" style={{ color: "var(--text-muted)" }}><Pencil className="w-3.5 h-3.5" /></button>
              <button onClick={() => duplicate(t)} className="p-1.5 rounded-lg hover:bg-[var(--bg-input)] cursor-pointer" style={{ color: "var(--text-muted)" }}><Copy className="w-3.5 h-3.5" /></button>
              <button onClick={() => remove(t.id)} className="p-1.5 rounded-lg hover:bg-red-50 cursor-pointer" style={{ color: "#d1d5db" }}
                onMouseEnter={e => (e.currentTarget.style.color = "#ef4444")} onMouseLeave={e => (e.currentTarget.style.color = "#d1d5db")}><Trash2 className="w-3.5 h-3.5" /></button>
            </div>
          </div>
        ))}
      </div>

      {/* Numbering */}
      <div className="rounded-xl p-4" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" }}>
        <div className="flex items-center gap-2 mb-3"><Hash className="w-3.5 h-3.5" style={{ color: "#0f8578" }} /><p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Agreement Numbering</p></div>
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

// ═══ Visit Schedule Templates list ("when we go") ═════════
function SchedulesList({ register }: { register: Saver }) {
  const [items, setItems] = useState<VisitScheduleTemplate[]>([]);
  const [editing, setEditing] = useState<VisitScheduleTemplate | null>(null);
  const [adding, setAdding] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [saved, setSaved] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => { setItems(getVisitScheduleTemplates()); }, []);
  const mark = () => { setDirty(true); setSaved(false); };

  function startAdd() { setEditing(blankVisitSchedule()); setAdding(true); }
  function startEdit(t: VisitScheduleTemplate) { setEditing({ ...t }); setAdding(false); }
  function cancel() { setEditing(null); setAdding(false); }
  function handleSaved(t: VisitScheduleTemplate) { if (adding) setItems(p => [...p, t]); else setItems(p => p.map(x => x.id === t.id ? t : x)); cancel(); mark(); }
  function duplicate(t: VisitScheduleTemplate) { setItems(p => [...p, { ...t, id: agrId("vst"), name: `${t.name} (Copy)`, key: agrSlug(`${t.key}_copy`) }]); mark(); }
  function remove(id: string) { setItems(p => p.filter(t => t.id !== id)); mark(); }
  function doSave() { saveVisitScheduleTemplates(items); setItems(getVisitScheduleTemplates()); setDirty(false); setSaved(true); setTimeout(() => setSaved(false), 2000); }
  useEffect(() => { register("schedules", doSave, dirty, saved); });

  const shown = query.trim() ? items.filter(t => match(t.name, query)) : items;

  return (
    <div className="space-y-3">
      {editing && <VisitScheduleTemplateEditorModal template={editing} isNew={adding} onCancel={cancel} onSave={handleSaved} />}
      <p className="text-xs" style={{ color: "var(--text-secondary)" }}>Reusable visit schedules — <span style={{ fontWeight: 600 }}>when we go</span>. Load these into an agreement to fill in its visits.</p>
      <div className="rounded-xl overflow-hidden" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" }}>
        <div className="flex items-center justify-between gap-3 px-4 py-3" style={{ borderBottom: "1px solid var(--border)", backgroundColor: "var(--bg-surface-2)" }}>
          <p className="text-sm font-semibold shrink-0" style={{ color: "var(--text-primary)" }}>Schedule Templates
            <span className="ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ backgroundColor: "var(--bg-input)", color: "var(--text-muted)" }}>{items.length}</span></p>
          <div className="flex items-center gap-2">
            {items.length > 0 && <SearchInput value={query} onChange={setQuery} />}
            <button onClick={startAdd} title="Add Schedule Template" aria-label="Add Schedule Template" className="flex items-center justify-center p-1.5 rounded-lg text-white cursor-pointer transition hover:brightness-110" style={{ backgroundColor: "#0f8578" }}><Plus className="w-4 h-4" /></button>
          </div>
        </div>
        <div className="grid px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider"
          style={{ gridTemplateColumns: "2.4fr 1fr 0.7fr 96px", gap: "0.75rem", color: "var(--text-muted)", borderBottom: "1px solid var(--border)" }}>
          <span>Schedule</span><span>Industry</span><span>Visits</span><span />
        </div>
        {shown.length === 0 ? (
          <div className="py-10 text-center"><p className="text-sm" style={{ color: "var(--text-muted)" }}>{items.length === 0 ? "No visit schedules yet." : `No matches for “${query}”.`}</p></div>
        ) : shown.map((t, i) => (
          <div key={t.id} className="grid px-4 py-3 items-center hover:bg-[var(--bg-surface-2)] transition-colors"
            style={{ gridTemplateColumns: "2.4fr 1fr 0.7fr 96px", gap: "0.75rem", borderBottom: i < shown.length - 1 ? "1px solid var(--border)" : "none", opacity: t.active ? 1 : 0.5 }}>
            <div className="min-w-0"><p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>{t.name}</p><p className="text-[11px] truncate" style={{ color: "var(--text-muted)" }}>{t.description}</p></div>
            <span className="text-xs" style={{ color: "var(--text-secondary)" }}>{t.industry}</span>
            <span className="text-xs" style={{ color: "var(--text-secondary)" }}>{t.visits.length}</span>
            <div className="flex items-center gap-1 justify-end">
              <button onClick={() => startEdit(t)} className="p-1.5 rounded-lg hover:bg-[var(--bg-input)] cursor-pointer" style={{ color: "var(--text-muted)" }}><Pencil className="w-3.5 h-3.5" /></button>
              <button onClick={() => duplicate(t)} className="p-1.5 rounded-lg hover:bg-[var(--bg-input)] cursor-pointer" style={{ color: "var(--text-muted)" }}><Copy className="w-3.5 h-3.5" /></button>
              <button onClick={() => remove(t.id)} className="p-1.5 rounded-lg hover:bg-red-50 cursor-pointer" style={{ color: "#d1d5db" }}
                onMouseEnter={e => (e.currentTarget.style.color = "#ef4444")} onMouseLeave={e => (e.currentTarget.style.color = "#d1d5db")}><Trash2 className="w-3.5 h-3.5" /></button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ═══ Service Scope Templates list ("what we do") ══════════
function ScopesList({ register }: { register: Saver }) {
  const [items, setItems] = useState<ServiceScopeTemplate[]>([]);
  const [editing, setEditing] = useState<ServiceScopeTemplate | null>(null);
  const [adding, setAdding] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [saved, setSaved] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => { setItems(getServiceScopeTemplates()); }, []);
  const mark = () => { setDirty(true); setSaved(false); };

  function startAdd() { setEditing(blankServiceScope()); setAdding(true); }
  function startEdit(t: ServiceScopeTemplate) { setEditing({ ...t }); setAdding(false); }
  function cancel() { setEditing(null); setAdding(false); }
  function handleSaved(t: ServiceScopeTemplate) { if (adding) setItems(p => [...p, t]); else setItems(p => p.map(x => x.id === t.id ? t : x)); cancel(); mark(); }
  function duplicate(t: ServiceScopeTemplate) { setItems(p => [...p, { ...t, id: agrId("sst"), name: `${t.name} (Copy)`, key: agrSlug(`${t.key}_copy`) }]); mark(); }
  function remove(id: string) { setItems(p => p.filter(t => t.id !== id)); mark(); }
  function doSave() { saveServiceScopeTemplates(items); setItems(getServiceScopeTemplates()); setDirty(false); setSaved(true); setTimeout(() => setSaved(false), 2000); }
  useEffect(() => { register("scopes", doSave, dirty, saved); });

  const shown = query.trim() ? items.filter(t => match(t.name, query)) : items;

  return (
    <div className="space-y-3">
      {editing && <ServiceScopeTemplateEditorModal template={editing} isNew={adding} onCancel={cancel} onSave={handleSaved} />}
      <p className="text-xs" style={{ color: "var(--text-secondary)" }}>Reusable service groups — <span style={{ fontWeight: 600 }}>what we do</span>. Load these into an agreement to fill in its services.</p>
      <div className="rounded-xl overflow-hidden" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" }}>
        <div className="flex items-center justify-between gap-3 px-4 py-3" style={{ borderBottom: "1px solid var(--border)", backgroundColor: "var(--bg-surface-2)" }}>
          <p className="text-sm font-semibold shrink-0" style={{ color: "var(--text-primary)" }}>Scope Templates
            <span className="ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ backgroundColor: "var(--bg-input)", color: "var(--text-muted)" }}>{items.length}</span></p>
          <div className="flex items-center gap-2">
            {items.length > 0 && <SearchInput value={query} onChange={setQuery} />}
            <button onClick={startAdd} title="Add Scope Template" aria-label="Add Scope Template" className="flex items-center justify-center p-1.5 rounded-lg text-white cursor-pointer transition hover:brightness-110" style={{ backgroundColor: "#0f8578" }}><Plus className="w-4 h-4" /></button>
          </div>
        </div>
        <div className="grid px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider"
          style={{ gridTemplateColumns: "2.4fr 1fr 0.7fr 96px", gap: "0.75rem", color: "var(--text-muted)", borderBottom: "1px solid var(--border)" }}>
          <span>Service Scope</span><span>Industry</span><span>Services</span><span />
        </div>
        {shown.length === 0 ? (
          <div className="py-10 text-center"><p className="text-sm" style={{ color: "var(--text-muted)" }}>{items.length === 0 ? "No service scopes yet." : `No matches for “${query}”.`}</p></div>
        ) : shown.map((t, i) => (
          <div key={t.id} className="grid px-4 py-3 items-center hover:bg-[var(--bg-surface-2)] transition-colors"
            style={{ gridTemplateColumns: "2.4fr 1fr 0.7fr 96px", gap: "0.75rem", borderBottom: i < shown.length - 1 ? "1px solid var(--border)" : "none", opacity: t.active ? 1 : 0.5 }}>
            <div className="min-w-0"><p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>{t.name}</p><p className="text-[11px] truncate" style={{ color: "var(--text-muted)" }}>{t.description}</p></div>
            <span className="text-xs" style={{ color: "var(--text-secondary)" }}>{t.industry}</span>
            <span className="text-xs" style={{ color: "var(--text-secondary)" }}>{t.services.length}</span>
            <div className="flex items-center gap-1 justify-end">
              <button onClick={() => startEdit(t)} className="p-1.5 rounded-lg hover:bg-[var(--bg-input)] cursor-pointer" style={{ color: "var(--text-muted)" }}><Pencil className="w-3.5 h-3.5" /></button>
              <button onClick={() => duplicate(t)} className="p-1.5 rounded-lg hover:bg-[var(--bg-input)] cursor-pointer" style={{ color: "var(--text-muted)" }}><Copy className="w-3.5 h-3.5" /></button>
              <button onClick={() => remove(t.id)} className="p-1.5 rounded-lg hover:bg-red-50 cursor-pointer" style={{ color: "#d1d5db" }}
                onMouseEnter={e => (e.currentTarget.style.color = "#ef4444")} onMouseLeave={e => (e.currentTarget.style.color = "#d1d5db")}><Trash2 className="w-3.5 h-3.5" /></button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ═══ Atomic libraries (Visit Templates / Services) ════════
const SCOPE_OPTIONS = (Object.keys(SERVICE_SCOPE_LABELS) as ServiceScopeType[]).map(k => ({ value: k, label: SERVICE_SCOPE_LABELS[k] }));
const APPLIES_OPTIONS = (Object.keys(SERVICE_APPLIES_LABELS) as ServiceApplies[]).map(k => ({ value: k, label: SERVICE_APPLIES_LABELS[k] }));

// Individual Visit Templates — the single visits that schedules are built from.
function VisitTemplatesCrud({ register }: { register: Saver }) {
  const freqOptions = useMemo(() => getVisitRules().filter(r => r.active).map(r => ({ value: r.key, label: r.name })), []);
  const jobTypeOptions = useMemo(() => [{ value: "", label: "None" }, ...getJobTypes().map(j => ({ value: j.key, label: j.name }))], []);
  const woOptions = useMemo(() => [{ value: "", label: "None" }, ...getWorkOrderTemplates().filter(t => t.active).map(t => ({ value: t.id, label: t.name }))], []);
  const boardOptions = useMemo(() => [{ value: "", label: "Any board" }, ...getBoardsForContext().map(b => ({ value: b.id, label: b.name }))], []);
  return (
    <SimpleCrud<VisitTemplate> title="Visit Template" saveId="visit_templates" get={getVisitTemplates} save={saveVisitTemplates} register={register} rowToggle={false}
      primaryKey="name" subtitleKey="preferredWindow"
      fields={[
        { key: "name", label: "Name", type: "text" },
        { key: "frequencyKey", label: "Frequency", type: "select", options: freqOptions },
        { key: "preferredWindow", label: "Preferred / Due Window", type: "text" },
        { key: "durationMin", label: "Duration (min)", type: "number", min: 15 },
        { key: "jobTypeKey", label: "Job Type Created", type: "select", options: jobTypeOptions },
        { key: "workOrderTemplateId", label: "Work Order Template", type: "select", options: woOptions },
        { key: "dispatchBoardId", label: "Dispatch Board", type: "select", options: boardOptions },
        { key: "active", label: "Active", type: "toggle" },
      ]}
      makeNew={() => ({ id: agrId("vt"), name: "", frequencyKey: freqOptions[0]?.value ?? "semi_annual", preferredWindow: "", durationMin: 90, jobTypeKey: "agreement_visit", workOrderTemplateId: "", dispatchBoardId: "", autoGenerate: true, active: true, order: 999 })} />
  );
}

// Individual Services — the single services that scopes are built from.
function ServiceItemsCrud({ register }: { register: Saver }) {
  const woOptions = useMemo(() => [{ value: "", label: "None" }, ...getWorkOrderTemplates().filter(t => t.active).map(t => ({ value: t.id, label: t.name }))], []);
  const itemOptions = useMemo(() => [{ value: "", label: "None" }, ...getAllItems().map(i => ({ value: i.id, label: i.name }))], []);
  return (
    <SimpleCrud<ServiceItem> title="Service" saveId="services" get={getServiceItems} save={saveServiceItems} register={register} rowToggle={false}
      primaryKey="name" subtitleKey="description"
      fields={[
        { key: "name", label: "Name", type: "text" },
        { key: "description", label: "Description", type: "text", full: true },
        { key: "scopeType", label: "Service Type", type: "select", options: SCOPE_OPTIONS },
        { key: "applies", label: "Applies", type: "select", options: APPLIES_OPTIONS },
        { key: "defaultQuantity", label: "Default Qty", type: "number", min: 0 },
        { key: "limit", label: "Usage Limit", type: "number", min: 0 },
        { key: "itemId", label: "Linked Item", type: "select", options: itemOptions },
        { key: "workOrderTemplateId", label: "Linked Work Order", type: "select", options: woOptions },
        { key: "active", label: "Active", type: "toggle" },
      ]}
      makeNew={() => ({ id: agrId("si"), name: "", description: "", scopeType: "included", applies: "per_visit", active: true, order: 999 })} />
  );
}

// Option lists shared by the Types / Terms / Renewals forms.
const INDUSTRY_OPTIONS: { value: Industry; label: string }[] = [
  { value: "HVAC", label: "HVAC" }, { value: "Roofing", label: "Roofing" },
  { value: "Plumbing", label: "Plumbing" }, { value: "Property Maintenance", label: "Property Maintenance" },
  { value: "Consulting", label: "Consulting" }, { value: "General", label: "General" },
];
const TERM_TYPE_OPTIONS = (Object.keys(TERM_TYPE_LABELS) as TermType[]).map(k => ({ value: k, label: TERM_TYPE_LABELS[k] }));
const RENEWAL_TYPE_OPTIONS = (Object.keys(RENEWAL_TYPE_LABELS) as RenewalType[]).map(k => ({ value: k, label: RENEWAL_TYPE_LABELS[k] }));
const PRICE_INC_OPTIONS = [{ value: "pct", label: "Percentage" }, { value: "flat", label: "Flat amount" }];

// Per-module render helpers (single-list modules reuse SimpleCrud).
function TypesModule({ register }: { register: Saver }) {
  return (
    <SimpleCrud<AgreementType> title="Agreement Type" saveId="types" get={getAgreementTypes} save={saveAgreementTypes} register={register}
      primaryKey="name" subtitleKey="description"
      fields={[
        { key: "name", label: "Name", type: "text" },
        { key: "industry", label: "Industry", type: "select", options: INDUSTRY_OPTIONS },
        { key: "description", label: "Description", type: "text", full: true },
        { key: "active", label: "Active", type: "toggle" },
      ]}
      makeNew={() => ({ id: agrId("at"), name: "", key: "", industry: "General", description: "", active: true, order: 999 })} />
  );
}
function BillingModule({ register }: { register: Saver }) {
  return (
    <SimpleCrud<BillingRule> title="Billing Rule" saveId="billing" get={getBillingRules} save={saveBillingRules} register={register}
      primaryKey="name" subtitleKey="key"
      fields={[
        { key: "name", label: "Name", type: "text" },
        { key: "periodsPerYear", label: "Periods / Year", type: "number", min: 0 },
        { key: "active", label: "Active", type: "toggle" },
      ]}
      makeNew={() => ({ id: agrId("br"), name: "", key: "", periodsPerYear: 1, active: true, order: 999 })} />
  );
}
function BenefitsModule({ register }: { register: Saver }) {
  return (
    <SimpleCrud<Benefit> title="Benefit" saveId="benefits" get={getBenefits} save={saveBenefits} register={register}
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
  );
}
function TermsModule({ register }: { register: Saver }) {
  return (
    <SimpleCrud<TermsBlock> title="Terms Block" saveId="terms" get={getTermsBlocks} save={saveTermsBlocks} register={register}
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
  );
}
function RenewalsModule({ register }: { register: Saver }) {
  return (
    <SimpleCrud<RenewalRule> title="Renewal Rule" saveId="renewals" get={getRenewalRules} save={saveRenewalRules} register={register}
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
  );
}

// ═══ Module hub ═══════════════════════════════════════════
interface ModuleDef { key: string; label: string; description: string; icon: typeof FileText; }
const MODULES: ModuleDef[] = [
  { key: "templates",      label: "Agreement Templates", description: "Full plan templates and agreement numbering.", icon: FileText },
  { key: "visit_planning", label: "Visit Planning",      description: "Schedule templates and the visit templates they're built from.", icon: CalendarClock },
  { key: "service_scope",  label: "Service Scope",       description: "Scope templates and the individual services they include.", icon: Wrench },
  { key: "types",          label: "Agreement Types",     description: "Categories of agreement by industry.", icon: Tag },
  { key: "billing",        label: "Billing Rules",       description: "Billing cadences and periods per year.", icon: DollarSign },
  { key: "benefits",       label: "Benefits",            description: "Member perks and included benefits.", icon: Star },
  { key: "terms",          label: "Terms",               description: "Reusable legal and customer-facing clauses.", icon: ScrollText },
  { key: "renewals",       label: "Renewals",            description: "Renewal rules, reminders, and price increases.", icon: RefreshCw },
];

function StackedSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2.5">
      <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>{title}</p>
      {children}
    </div>
  );
}

function renderModule(key: string, register: Saver): React.ReactNode {
  switch (key) {
    case "templates": return <TemplatesTab register={register} />;
    case "visit_planning": return (
      <div className="space-y-8">
        <StackedSection title="Schedules"><SchedulesList register={register} /></StackedSection>
        <StackedSection title="Visit Templates"><VisitTemplatesCrud register={register} /></StackedSection>
      </div>
    );
    case "service_scope": return (
      <div className="space-y-8">
        <StackedSection title="Scopes"><ScopesList register={register} /></StackedSection>
        <StackedSection title="Services"><ServiceItemsCrud register={register} /></StackedSection>
      </div>
    );
    case "types":    return <TypesModule register={register} />;
    case "billing":  return <BillingModule register={register} />;
    case "benefits": return <BenefitsModule register={register} />;
    case "terms":    return <TermsModule register={register} />;
    case "renewals": return <RenewalsModule register={register} />;
    default:         return null;
  }
}

// ═══ Section (controlled hub + module pages) ══════════════
export default function AgreementsSettingsSection({ activeModule, onOpen, onBack }: {
  activeModule: string | null;
  onOpen: (key: string, label: string) => void;
  onBack: () => void;
}) {
  // Multi-registrant save: each list registers its own save keyed by id, so a
  // stacked page (two lists) publishes one combined Save to the top-right slot.
  const registry = useRef<Map<string, { save: () => void; dirty: boolean; saved: boolean }>>(new Map());
  const [hdr, setHdr] = useState<{ dirty: boolean; saved: boolean }>({ dirty: false, saved: false });
  const recompute = useCallback(() => {
    const all = [...registry.current.values()];
    const dirty = all.some(s => s.dirty);
    const saved = all.length > 0 && all.every(s => s.saved);
    setHdr(prev => (prev.dirty === dirty && prev.saved === saved) ? prev : { dirty, saved });
  }, []);
  const register = useCallback<Saver>((id, save, dirty, saved) => {
    registry.current.set(id, { save, dirty, saved });
    recompute();
  }, [recompute]);
  const runSave = useCallback(() => { registry.current.forEach(s => s.save()); }, []);

  // Clear stale registrants when the open module changes (one module mounts at a
  // time). Done during render so it happens before the new module's lists register.
  const prevModule = useRef<string | null>(activeModule);
  if (prevModule.current !== activeModule) {
    prevModule.current = activeModule;
    registry.current.clear();
  }
  useEffect(() => { setHdr({ dirty: false, saved: false }); }, [activeModule]);

  useRegisterSaveAction({ dirty: hdr.dirty, saved: hdr.saved, onSave: runSave });

  // ── Hub ──
  if (!activeModule) {
    return (
      <div className="space-y-5">
        <div>
          <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>Agreements</h2>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>
            Reusable defaults for service plans. Pick a module to manage its records.
          </p>
        </div>
        <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))" }}>
          {MODULES.map(m => {
            const Icon = m.icon;
            return (
              <button key={m.key} onClick={() => onOpen(m.key, m.label)}
                className="flex items-start gap-3 p-4 rounded-xl text-left w-full transition-all group hover:shadow-md cursor-pointer"
                style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" }}>
                <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: "var(--bg-surface-2)" }}>
                  <Icon className="w-4 h-4" style={{ color: "#0f8578" }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{m.label}</p>
                  <p className="text-xs mt-0.5 leading-snug" style={{ color: "var(--text-muted)" }}>{m.description}</p>
                </div>
                <ChevronRight className="w-4 h-4 shrink-0 mt-0.5 opacity-0 group-hover:opacity-40 transition-opacity" style={{ color: "var(--text-muted)" }} />
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // ── Module page ──
  const mod = MODULES.find(m => m.key === activeModule);
  if (!mod) { onBack(); return null; }
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>{mod.label}</h2>
        <p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>{mod.description}</p>
      </div>
      {renderModule(mod.key, register)}
    </div>
  );
}
