"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  Plus, Pencil, Copy, Trash2, ChevronUp, ChevronDown, Check, Camera,
  ClipboardList, ListChecks, Image as ImageIcon, FileText,
} from "lucide-react";
import {
  getTemplates, saveTemplates,
  getChecklist, saveChecklist,
  getPhotos, savePhotos,
  getInstructions, saveInstructions,
  woId, woSlug,
  WO_PRIORITY_LABELS, CHECKLIST_TYPE_LABELS, PHOTO_CATEGORIES,
  type WorkOrderTemplate, type WOPriority,
  type ChecklistItem, type ChecklistItemType,
  type RequiredPhoto, type WOInstructions,
} from "@/lib/work-order-templates/data";
import { getJobTypes } from "@/lib/job-config/data";
import UiSelect from "@/components/ui/Select";

const PRIORITIES = Object.keys(WO_PRIORITY_LABELS) as WOPriority[];
const CHECK_TYPES = Object.keys(CHECKLIST_TYPE_LABELS) as ChecklistItemType[];

const PRIORITY_BADGE: Record<WOPriority, { bg: string; color: string }> = {
  low:    { bg: "var(--bg-input)", color: "var(--text-muted)" },
  normal: { bg: "#e0e7ff",         color: "#3730a3" },
  high:   { bg: "#fef3c7",         color: "#92400e" },
  urgent: { bg: "#fee2e2",         color: "#991b1b" },
};

// Lets each tab report its save handler + dirty/saved state up to the section header.
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

function TemplatePicker({ templates, value, onChange }: {
  templates: WorkOrderTemplate[]; value: string; onChange: (id: string) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs font-medium shrink-0" style={{ color: "var(--text-secondary)" }}>Template:</span>
      <UiSelect value={value} onChange={onChange} className="w-64"
        options={templates.map(t => ({ value: t.id, label: t.name }))} />
    </div>
  );
}

// ═══ Templates tab ════════════════════════════════════════
type TForm = { name: string; key: string; description: string; jobTypeKey: string; priority: WOPriority; duration: number; active: boolean };
const EMPTY_T: TForm = { name: "", key: "", description: "", jobTypeKey: "", priority: "normal", duration: 60, active: true };

function TemplatesTab({ register }: { register: Saver }) {
  const jobTypes = getJobTypes();
  const [items, setItems] = useState<WorkOrderTemplate[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState<TForm>({ ...EMPTY_T });
  const [dirty, setDirty] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => { setItems(getTemplates()); }, []);
  function mark() { setDirty(true); setSaved(false); }

  function startEdit(t: WorkOrderTemplate) {
    setForm({ name: t.name, key: t.key, description: t.description, jobTypeKey: t.jobTypeKey, priority: t.priority, duration: t.duration, active: t.active });
    setEditingId(t.id); setShowAdd(false);
  }
  function startAdd() { setForm({ ...EMPTY_T, jobTypeKey: jobTypes[0]?.key ?? "" }); setShowAdd(true); setEditingId(null); }
  function duplicate(t: WorkOrderTemplate) {
    const max = items.length ? Math.max(...items.map(x => x.order)) : 0;
    setItems(prev => [...prev, { ...t, id: woId("wt"), name: `${t.name} (Copy)`, key: woSlug(`${t.key}_copy`), order: max + 1 }]);
    mark();
  }
  function cancel() { setEditingId(null); setShowAdd(false); }
  function commit() {
    if (!form.name.trim()) return;
    if (editingId) {
      setItems(prev => prev.map(t => t.id === editingId ? { ...t, ...form, key: form.key || woSlug(form.name) } : t));
    } else {
      const max = items.length ? Math.max(...items.map(t => t.order)) : 0;
      setItems(prev => [...prev, { id: woId("wt"), ...form, key: form.key || woSlug(form.name), order: max + 1 }]);
    }
    cancel(); mark();
  }
  function toggle(id: string) { setItems(prev => prev.map(t => t.id === id ? { ...t, active: !t.active } : t)); mark(); }
  function remove(id: string) { setItems(prev => prev.filter(t => t.id !== id)); mark(); }
  function save() { saveTemplates(items); setItems(getTemplates()); setDirty(false); setSaved(true); setTimeout(() => setSaved(false), 2000); }

  useEffect(() => { register(save, dirty, saved); });

  function Form() {
    return (
      <div className="rounded-xl p-4 space-y-3" style={{ backgroundColor: "var(--bg-surface)", border: "2px solid #c7d2fe", boxShadow: "var(--shadow-card)" }}>
        <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#4f46e5" }}>{editingId ? "Edit Template" : "New Template"}</p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Name *</label>
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value, key: editingId ? f.key : woSlug(e.target.value) }))}
              className="w-full rounded-lg px-3 py-2 text-sm outline-none" style={{ border: "1px solid var(--border)", backgroundColor: "var(--bg-surface)", color: "var(--text-primary)" }} />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Key</label>
            <input value={form.key} onChange={e => setForm(f => ({ ...f, key: woSlug(e.target.value) }))}
              className="w-full rounded-lg px-3 py-2 text-sm font-mono outline-none" style={{ border: "1px solid var(--border)", backgroundColor: "var(--bg-input)", color: "var(--text-primary)" }} />
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Description</label>
          <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            className="w-full rounded-lg px-3 py-2 text-sm outline-none" style={{ border: "1px solid var(--border)", backgroundColor: "var(--bg-surface)", color: "var(--text-primary)" }} />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Linked Job Type</label>
            <UiSelect value={form.jobTypeKey} onChange={v => setForm(f => ({ ...f, jobTypeKey: v }))}
              placeholder="None"
              options={[{ value: "", label: "None" }, ...jobTypes.map(jt => ({ value: jt.key, label: jt.name }))]} />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Priority</label>
            <UiSelect value={form.priority} onChange={v => setForm(f => ({ ...f, priority: v as WOPriority }))}
              options={PRIORITIES.map(p => ({ value: p, label: WO_PRIORITY_LABELS[p] }))} />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Duration (min)</label>
            <input type="number" min={0} step={15} value={form.duration} onChange={e => setForm(f => ({ ...f, duration: parseInt(e.target.value) || 0 }))}
              className="w-full rounded-lg px-3 py-2 text-sm outline-none" style={{ border: "1px solid var(--border)", backgroundColor: "var(--bg-surface)", color: "var(--text-primary)" }} />
          </div>
        </div>
        <div className="flex items-center justify-between pt-1">
          <label className="flex items-center gap-2 cursor-pointer"><Toggle on={form.active} onChange={v => setForm(f => ({ ...f, active: v }))} /><span className="text-sm" style={{ color: "var(--text-secondary)" }}>Active</span></label>
          <div className="flex gap-2">
            <button onClick={cancel} className="px-3 py-1.5 rounded-lg text-sm" style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}>Cancel</button>
            <button onClick={commit} disabled={!form.name.trim()} className="px-4 py-1.5 rounded-lg text-sm font-medium text-white disabled:opacity-40" style={{ backgroundColor: "#4f46e5" }}>{editingId ? "Update" : "Add Template"}</button>
          </div>
        </div>
      </div>
    );
  }

  const jobTypeName = (key: string) => jobTypes.find(j => j.key === key)?.name ?? "—";

  return (
    <div className="space-y-4">
      {showAdd && Form()}
      <div className="rounded-xl overflow-hidden" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" }}>
        <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: "1px solid var(--border)", backgroundColor: "var(--bg-surface-2)" }}>
          <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Work Order Templates
            <span className="ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ backgroundColor: "var(--bg-input)", color: "var(--text-muted)" }}>{items.length}</span></p>
          {!showAdd && <button onClick={startAdd} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white" style={{ backgroundColor: "#4f46e5" }}><Plus className="w-3.5 h-3.5" /> Add Template</button>}
        </div>
        <div className="grid px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider"
          style={{ gridTemplateColumns: "2fr 1.5fr 1fr 0.8fr 0.7fr auto", gap: "0.75rem", color: "var(--text-muted)", borderBottom: "1px solid var(--border)" }}>
          <span>Template</span><span>Linked Job Type</span><span>Priority</span><span>Duration</span><span className="text-center">Active</span><span />
        </div>
        {items.map((t, i) => editingId === t.id ? (
          <div key={t.id} className="p-4" style={{ borderBottom: i < items.length - 1 ? "1px solid var(--border)" : "none" }}>{Form()}</div>
        ) : (
          <div key={t.id} className="grid px-4 py-3 items-center hover:bg-[var(--bg-surface-2)] transition-colors"
            style={{ gridTemplateColumns: "2fr 1.5fr 1fr 0.8fr 0.7fr auto", gap: "0.75rem", borderBottom: i < items.length - 1 ? "1px solid var(--border)" : "none", opacity: t.active ? 1 : 0.5 }}>
            <div className="min-w-0"><p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>{t.name}</p>{t.description && <p className="text-[11px] truncate" style={{ color: "var(--text-muted)" }}>{t.description}</p>}</div>
            <span className="text-xs" style={{ color: "var(--text-secondary)" }}>{jobTypeName(t.jobTypeKey)}</span>
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full inline-block w-fit" style={PRIORITY_BADGE[t.priority]}>{WO_PRIORITY_LABELS[t.priority]}</span>
            <span className="text-xs" style={{ color: "var(--text-secondary)" }}>{t.duration}m</span>
            <div className="flex justify-center"><Toggle on={t.active} onChange={() => toggle(t.id)} /></div>
            <div className="flex items-center gap-1 justify-end">
              <button onClick={() => startEdit(t)} className="p-1.5 rounded-lg hover:bg-[var(--bg-input)]" title="Edit" style={{ color: "var(--text-muted)" }}><Pencil className="w-3.5 h-3.5" /></button>
              <button onClick={() => duplicate(t)} className="p-1.5 rounded-lg hover:bg-[var(--bg-input)]" title="Duplicate" style={{ color: "var(--text-muted)" }}><Copy className="w-3.5 h-3.5" /></button>
              <button onClick={() => remove(t.id)} className="p-1.5 rounded-lg hover:bg-red-50" title="Delete" style={{ color: "#d1d5db" }}
                onMouseEnter={e => (e.currentTarget.style.color = "#ef4444")} onMouseLeave={e => (e.currentTarget.style.color = "#d1d5db")}><Trash2 className="w-3.5 h-3.5" /></button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ═══ Checklists tab ═══════════════════════════════════════
function ChecklistsTab({ templates, register }: { templates: WorkOrderTemplate[]; register: Saver }) {
  const [templateId, setTemplateId] = useState(templates[0]?.id ?? "");
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [label, setLabel] = useState("");
  const [type, setType] = useState<ChecklistItemType>("checkbox");
  const [required, setRequired] = useState(false);
  const [saved, setSaved] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => { if (templateId) setItems(getChecklist(templateId)); }, [templateId]);
  function mark() { setDirty(true); setSaved(false); }

  function move(id: string, dir: -1 | 1) {
    const sorted = [...items].sort((a, b) => a.order - b.order);
    const idx = sorted.findIndex(s => s.id === id), swap = idx + dir;
    if (swap < 0 || swap >= sorted.length) return;
    [sorted[idx].order, sorted[swap].order] = [sorted[swap].order, sorted[idx].order];
    setItems([...sorted]); mark();
  }
  function add() {
    if (!label.trim()) return;
    const max = items.length ? Math.max(...items.map(i => i.order)) : 0;
    setItems(prev => [...prev, { id: woId("ci"), templateId, label: label.trim(), type, required, order: max + 1, active: true }]);
    setLabel(""); setType("checkbox"); setRequired(false); setShowAdd(false); mark();
  }
  function toggleActive(id: string) { setItems(prev => prev.map(i => i.id === id ? { ...i, active: !i.active } : i)); mark(); }
  function toggleReq(id: string) { setItems(prev => prev.map(i => i.id === id ? { ...i, required: !i.required } : i)); mark(); }
  function remove(id: string) { setItems(prev => prev.filter(i => i.id !== id)); mark(); }
  function save() { saveChecklist(templateId, items); setItems(getChecklist(templateId)); setDirty(false); setSaved(true); setTimeout(() => setSaved(false), 2000); }

  useEffect(() => { register(save, dirty, saved); });

  const sorted = [...items].sort((a, b) => a.order - b.order);

  return (
    <div className="space-y-4">
      <TemplatePicker templates={templates} value={templateId} onChange={setTemplateId} />

      {showAdd && (
        <div className="rounded-xl p-4 space-y-3" style={{ backgroundColor: "var(--bg-surface)", border: "2px solid #c7d2fe", boxShadow: "var(--shadow-card)" }}>
          <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#4f46e5" }}>New Checklist Item</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Item Label *</label>
              <input value={label} onChange={e => setLabel(e.target.value)} placeholder="e.g. Verify thermostat operation"
                className="w-full rounded-lg px-3 py-2 text-sm outline-none" style={{ border: "1px solid var(--border)", backgroundColor: "var(--bg-surface)", color: "var(--text-primary)" }} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Type</label>
              <UiSelect value={type} onChange={v => setType(v as ChecklistItemType)}
                options={CHECK_TYPES.map(c => ({ value: c, label: CHECKLIST_TYPE_LABELS[c] }))} />
            </div>
          </div>
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 cursor-pointer"><Toggle on={required} onChange={setRequired} /><span className="text-sm" style={{ color: "var(--text-secondary)" }}>Required</span></label>
            <div className="flex gap-2">
              <button onClick={() => setShowAdd(false)} className="px-3 py-1.5 rounded-lg text-sm" style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}>Cancel</button>
              <button onClick={add} disabled={!label.trim()} className="px-4 py-1.5 rounded-lg text-sm font-medium text-white disabled:opacity-40" style={{ backgroundColor: "#4f46e5" }}>Add Item</button>
            </div>
          </div>
        </div>
      )}

      <div className="rounded-xl overflow-hidden" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" }}>
        <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: "1px solid var(--border)", backgroundColor: "var(--bg-surface-2)" }}>
          <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Checklist Items
            <span className="ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ backgroundColor: "var(--bg-input)", color: "var(--text-muted)" }}>{items.length}</span></p>
          {!showAdd && <button onClick={() => setShowAdd(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white" style={{ backgroundColor: "#4f46e5" }}><Plus className="w-3.5 h-3.5" /> Add Item</button>}
        </div>
        <div className="grid px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider"
          style={{ gridTemplateColumns: "auto 2fr 1.2fr 0.8fr 0.8fr auto", gap: "0.75rem", color: "var(--text-muted)", borderBottom: "1px solid var(--border)" }}>
          <span>Order</span><span>Item</span><span>Type</span><span className="text-center">Required</span><span className="text-center">Active</span><span />
        </div>
        {sorted.length === 0 ? (
          <div className="py-10 text-center"><p className="text-sm" style={{ color: "var(--text-muted)" }}>No checklist items for this template yet.</p></div>
        ) : sorted.map((c, i) => (
          <div key={c.id} className="grid px-4 py-3 items-center hover:bg-[var(--bg-surface-2)] transition-colors"
            style={{ gridTemplateColumns: "auto 2fr 1.2fr 0.8fr 0.8fr auto", gap: "0.75rem", borderBottom: i < sorted.length - 1 ? "1px solid var(--border)" : "none", opacity: c.active ? 1 : 0.5 }}>
            <div className="flex flex-col">
              <button onClick={() => move(c.id, -1)} disabled={i === 0} className="disabled:opacity-20" style={{ color: "var(--text-muted)" }}><ChevronUp className="w-3.5 h-3.5" /></button>
              <button onClick={() => move(c.id, 1)} disabled={i === sorted.length - 1} className="disabled:opacity-20" style={{ color: "var(--text-muted)" }}><ChevronDown className="w-3.5 h-3.5" /></button>
            </div>
            <span className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>{c.label}</span>
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full inline-block w-fit" style={{ backgroundColor: "var(--bg-input)", color: "var(--text-secondary)" }}>{CHECKLIST_TYPE_LABELS[c.type]}</span>
            <div className="flex justify-center"><Toggle on={c.required} onChange={() => toggleReq(c.id)} /></div>
            <div className="flex justify-center"><Toggle on={c.active} onChange={() => toggleActive(c.id)} /></div>
            <div className="flex justify-end">
              <button onClick={() => remove(c.id)} className="p-1.5 rounded-lg hover:bg-red-50" style={{ color: "#d1d5db" }}
                onMouseEnter={e => (e.currentTarget.style.color = "#ef4444")} onMouseLeave={e => (e.currentTarget.style.color = "#d1d5db")}><Trash2 className="w-3.5 h-3.5" /></button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ═══ Required Photos tab ══════════════════════════════════
function RequiredPhotosTab({ templates, register }: { templates: WorkOrderTemplate[]; register: Saver }) {
  const [templateId, setTemplateId] = useState(templates[0]?.id ?? "");
  const [items, setItems] = useState<RequiredPhoto[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [category, setCategory] = useState(PHOTO_CATEGORIES[0]);
  const [minCount, setMinCount] = useState(1);
  const [required, setRequired] = useState(true);
  const [notes, setNotes] = useState("");
  const [saved, setSaved] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => { if (templateId) setItems(getPhotos(templateId)); }, [templateId]);
  function mark() { setDirty(true); setSaved(false); }

  function add() {
    setItems(prev => [...prev, { id: woId("rp"), templateId, category, required, minCount, notes: notes.trim() }]);
    setCategory(PHOTO_CATEGORIES[0]); setMinCount(1); setRequired(true); setNotes(""); setShowAdd(false); mark();
  }
  function toggleReq(id: string) { setItems(prev => prev.map(p => p.id === id ? { ...p, required: !p.required } : p)); mark(); }
  function setMin(id: string, n: number) { setItems(prev => prev.map(p => p.id === id ? { ...p, minCount: Math.max(0, n) } : p)); mark(); }
  function remove(id: string) { setItems(prev => prev.filter(p => p.id !== id)); mark(); }
  function save() { savePhotos(templateId, items); setItems(getPhotos(templateId)); setDirty(false); setSaved(true); setTimeout(() => setSaved(false), 2000); }

  useEffect(() => { register(save, dirty, saved); });

  return (
    <div className="space-y-4">
      <TemplatePicker templates={templates} value={templateId} onChange={setTemplateId} />

      {showAdd && (
        <div className="rounded-xl p-4 space-y-3" style={{ backgroundColor: "var(--bg-surface)", border: "2px solid #c7d2fe", boxShadow: "var(--shadow-card)" }}>
          <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#4f46e5" }}>New Required Photo Rule</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Photo Category</label>
              <UiSelect value={category} onChange={setCategory}
                options={PHOTO_CATEGORIES.map(c => ({ value: c, label: c }))} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Minimum Photos</label>
              <input type="number" min={0} value={minCount} onChange={e => setMinCount(parseInt(e.target.value) || 0)}
                className="w-full rounded-lg px-3 py-2 text-sm outline-none" style={{ border: "1px solid var(--border)", backgroundColor: "var(--bg-surface)", color: "var(--text-primary)" }} />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Notes / Instructions</label>
            <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="e.g. Capture the nameplate clearly"
              className="w-full rounded-lg px-3 py-2 text-sm outline-none" style={{ border: "1px solid var(--border)", backgroundColor: "var(--bg-surface)", color: "var(--text-primary)" }} />
          </div>
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 cursor-pointer"><Toggle on={required} onChange={setRequired} /><span className="text-sm" style={{ color: "var(--text-secondary)" }}>Required</span></label>
            <div className="flex gap-2">
              <button onClick={() => setShowAdd(false)} className="px-3 py-1.5 rounded-lg text-sm" style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}>Cancel</button>
              <button onClick={add} className="px-4 py-1.5 rounded-lg text-sm font-medium text-white" style={{ backgroundColor: "#4f46e5" }}>Add Rule</button>
            </div>
          </div>
        </div>
      )}

      <div className="rounded-xl overflow-hidden" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" }}>
        <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: "1px solid var(--border)", backgroundColor: "var(--bg-surface-2)" }}>
          <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Required Photos
            <span className="ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ backgroundColor: "var(--bg-input)", color: "var(--text-muted)" }}>{items.length}</span></p>
          {!showAdd && <button onClick={() => setShowAdd(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white" style={{ backgroundColor: "#4f46e5" }}><Plus className="w-3.5 h-3.5" /> Add Rule</button>}
        </div>
        <div className="grid px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider"
          style={{ gridTemplateColumns: "1.3fr 0.8fr 0.8fr 2fr auto", gap: "0.75rem", color: "var(--text-muted)", borderBottom: "1px solid var(--border)" }}>
          <span>Category</span><span className="text-center">Required</span><span>Min #</span><span>Notes</span><span />
        </div>
        {items.length === 0 ? (
          <div className="py-10 text-center"><p className="text-sm" style={{ color: "var(--text-muted)" }}>No required photo rules for this template yet.</p></div>
        ) : items.map((p, i) => (
          <div key={p.id} className="grid px-4 py-3 items-center hover:bg-[var(--bg-surface-2)] transition-colors"
            style={{ gridTemplateColumns: "1.3fr 0.8fr 0.8fr 2fr auto", gap: "0.75rem", borderBottom: i < items.length - 1 ? "1px solid var(--border)" : "none" }}>
            <div className="flex items-center gap-2"><Camera className="w-3.5 h-3.5 shrink-0" style={{ color: "#2563eb" }} /><span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{p.category}</span></div>
            <div className="flex justify-center"><Toggle on={p.required} onChange={() => toggleReq(p.id)} /></div>
            <input type="number" min={0} value={p.minCount} onChange={e => setMin(p.id, parseInt(e.target.value) || 0)}
              className="w-14 rounded-lg px-2 py-1 text-sm outline-none" style={{ border: "1px solid var(--border)", backgroundColor: "var(--bg-surface)", color: "var(--text-primary)" }} />
            <span className="text-xs truncate" style={{ color: "var(--text-muted)" }}>{p.notes || "—"}</span>
            <div className="flex justify-end">
              <button onClick={() => remove(p.id)} className="p-1.5 rounded-lg hover:bg-red-50" style={{ color: "#d1d5db" }}
                onMouseEnter={e => (e.currentTarget.style.color = "#ef4444")} onMouseLeave={e => (e.currentTarget.style.color = "#d1d5db")}><Trash2 className="w-3.5 h-3.5" /></button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ═══ Instructions tab ═════════════════════════════════════
const INSTRUCTION_FIELDS: { key: keyof Omit<WOInstructions, "templateId">; label: string; placeholder: string }[] = [
  { key: "internal",       label: "Internal Instructions",   placeholder: "Steps and guidance for the field team (not shown to the customer)…" },
  { key: "customerFacing", label: "Customer-Facing Instructions", placeholder: "What the customer should know or prepare…" },
  { key: "safety",         label: "Safety Notes",            placeholder: "Lockout/tagout, PPE, hazards…" },
  { key: "access",         label: "Access Notes",            placeholder: "Gate codes, key locations, parking (placeholder — populated per job)…" },
  { key: "materials",      label: "Material Notes",          placeholder: "Common parts, materials to bring…" },
  { key: "completion",     label: "Completion Requirements", placeholder: "What must be done before marking complete…" },
];

function InstructionsTab({ templates, register }: { templates: WorkOrderTemplate[]; register: Saver }) {
  const [templateId, setTemplateId] = useState(templates[0]?.id ?? "");
  const [rec, setRec] = useState<WOInstructions>(() => getInstructions(templates[0]?.id ?? ""));
  const [saved, setSaved] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => { if (templateId) { setRec(getInstructions(templateId)); setDirty(false); } }, [templateId]);

  function set(key: keyof Omit<WOInstructions, "templateId">, val: string) {
    setRec(r => ({ ...r, [key]: val })); setDirty(true); setSaved(false);
  }
  function save() { saveInstructions(rec); setDirty(false); setSaved(true); setTimeout(() => setSaved(false), 2000); }

  useEffect(() => { register(save, dirty, saved); });

  return (
    <div className="space-y-4">
      <TemplatePicker templates={templates} value={templateId} onChange={setTemplateId} />
      <div className="grid grid-cols-2 gap-4">
        {INSTRUCTION_FIELDS.map(f => (
          <div key={f.key} className="rounded-xl p-4" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" }}>
            <label className="block text-xs font-semibold mb-2" style={{ color: "var(--text-primary)" }}>{f.label}</label>
            <textarea value={rec[f.key]} onChange={e => set(f.key, e.target.value)} placeholder={f.placeholder} rows={3}
              className="w-full rounded-lg px-3 py-2 text-sm outline-none resize-none" style={{ border: "1px solid var(--border)", backgroundColor: "var(--bg-surface-2)", color: "var(--text-primary)" }} />
          </div>
        ))}
      </div>
    </div>
  );
}

// ═══ Main section ═════════════════════════════════════════
export default function WorkOrderTemplatesSection() {
  const [tab, setTab] = useState<"templates" | "checklists" | "photos" | "instructions">("templates");
  const [templates, setTemplates] = useState<WorkOrderTemplate[]>([]);

  useEffect(() => { setTemplates(getTemplates()); }, [tab]);

  // Active tab registers its save handler + dirty/saved here so the
  // header can render a single Save Changes button inline with the title.
  const saverRef = useRef<() => void>(() => {});
  const [hdr, setHdr] = useState<{ dirty: boolean; saved: boolean }>({ dirty: false, saved: false });
  const register = useCallback<Saver>((save, dirty, saved) => {
    saverRef.current = save;
    setHdr(prev => (prev.dirty === dirty && prev.saved === saved) ? prev : { dirty, saved });
  }, []);

  function switchTab(next: typeof tab) {
    setTab(next);
    setHdr({ dirty: false, saved: false });
  }

  const TABS = [
    { key: "templates"    as const, label: "Templates",       icon: ClipboardList },
    { key: "checklists"   as const, label: "Checklists",      icon: ListChecks },
    { key: "photos"       as const, label: "Required Photos", icon: ImageIcon },
    { key: "instructions" as const, label: "Instructions",    icon: FileText },
  ];

  return (
    <div className="space-y-5">
      {/* Header — Save Changes inline with the title */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>Work Orders &amp; Checklist Templates</h2>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>
            Define how the field team completes each type of work — templates, checklists, required photos, and instructions.
          </p>
        </div>
        <button onClick={() => saverRef.current()} disabled={!hdr.dirty && !hdr.saved}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-white transition-colors disabled:opacity-50 shrink-0"
          style={{ backgroundColor: hdr.saved ? "#10b981" : "#4f46e5" }}>
          <Check className="w-3.5 h-3.5" /> {hdr.saved ? "Saved" : "Save Changes"}
        </button>
      </div>

      <div className="flex items-center gap-1 border-b overflow-x-auto" style={{ borderColor: "var(--border-subtle)" }}>
        {TABS.map(t => {
          const active = tab === t.key; const Icon = t.icon;
          return (
            <button key={t.key} onClick={() => switchTab(t.key)}
              className="relative flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-colors whitespace-nowrap"
              style={{ color: active ? "#4f46e5" : "var(--text-muted)" }}>
              <Icon className="w-3.5 h-3.5 shrink-0" /> {t.label}
              {active && <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-t bg-indigo-600" />}
            </button>
          );
        })}
      </div>

      {tab === "templates"    && <TemplatesTab     register={register} />}
      {tab === "checklists"   && <ChecklistsTab    templates={templates} register={register} />}
      {tab === "photos"       && <RequiredPhotosTab templates={templates} register={register} />}
      {tab === "instructions" && <InstructionsTab  templates={templates} register={register} />}

      <p className="text-xs" style={{ color: "var(--text-muted)" }}>
        Work order templates will move to the Company layer so each company starts from an industry
        default and customizes. When a job is created, its job type will suggest the matching template.
      </p>
    </div>
  );
}
