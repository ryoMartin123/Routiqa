"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Plus, Pencil, ChevronUp, ChevronDown, Trash2, Check, RotateCcw, Briefcase, Tags, Lock } from "lucide-react";
import {
  getJobTypes, saveJobTypes, resetJobTypes,
  getJobStatuses, saveJobStatuses, resetJobStatuses,
  jcId, jcSlug,
  JOB_TYPE_CATEGORY_LABELS, JOB_STATUS_CATEGORY_LABELS, STATUS_COLORS, WORK_ORDER_POLICY_LABELS,
  type JobTypeDef, type JobTypeCategory, type JobStatusDef, type JobStatusCategory, type WorkOrderPolicy,
} from "@/lib/job-config/data";
import { getTemplates } from "@/lib/work-order-templates/data";
import UiSelect from "@/components/ui/Select";

const TYPE_CATS   = Object.keys(JOB_TYPE_CATEGORY_LABELS)   as JobTypeCategory[];
const STATUS_CATS = Object.keys(JOB_STATUS_CATEGORY_LABELS) as JobStatusCategory[];
const WO_POLICIES = Object.keys(WORK_ORDER_POLICY_LABELS)   as WorkOrderPolicy[];

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

// Core entries (e.g. the Maintenance type keyed agreement_visit, lifecycle statuses) are required by
// other modules — flagged with a locked badge and protected from delete/deactivate.
function CoreBadge() {
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0"
      style={{ backgroundColor: "#e0e7ff", color: "#3730a3" }}>
      <Lock className="w-2.5 h-2.5" /> Core
    </span>
  );
}

// Each tab reports its save/reset handlers + dirty/saved up to the section header.
type Saver = (save: () => void, reset: () => void, dirty: boolean, saved: boolean) => void;

// ─── Job Types tab ────────────────────────────────────────
type TypeForm = { name: string; key: string; description: string; duration: number; category: JobTypeCategory; color: string; active: boolean; workOrderPolicy: WorkOrderPolicy; defaultWorkOrderTemplateId: string };
const EMPTY_TYPE: TypeForm = { name: "", key: "", description: "", duration: 60, category: "service", color: STATUS_COLORS[0], active: true, workOrderPolicy: "optional", defaultWorkOrderTemplateId: "" };

function JobTypesTab({ register }: { register: Saver }) {
  const [items, setItems] = useState<JobTypeDef[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState<TypeForm>({ ...EMPTY_TYPE });
  const [dirty, setDirty] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => { setItems(getJobTypes()); }, []);
  const woTemplates = getTemplates().filter(t => t.active);
  function mark() { setDirty(true); setSaved(false); }

  function move(id: string, dir: -1 | 1) {
    const sorted = [...items].sort((a, b) => a.order - b.order);
    const idx = sorted.findIndex(s => s.id === id), swap = idx + dir;
    if (swap < 0 || swap >= sorted.length) return;
    [sorted[idx].order, sorted[swap].order] = [sorted[swap].order, sorted[idx].order];
    setItems([...sorted]); mark();
  }
  function startEdit(t: JobTypeDef) {
    setForm({ name: t.name, key: t.key, description: t.description, duration: t.duration, category: t.category, color: t.color ?? STATUS_COLORS[0], active: t.active, workOrderPolicy: t.workOrderPolicy ?? "optional", defaultWorkOrderTemplateId: t.defaultWorkOrderTemplateId ?? "" });
    setEditingId(t.id); setShowAdd(false);
  }
  function startAdd() { setForm({ ...EMPTY_TYPE }); setShowAdd(true); setEditingId(null); }
  function cancel() { setEditingId(null); setShowAdd(false); }
  function commit() {
    if (!form.name.trim()) return;
    if (editingId) {
      setItems(prev => prev.map(t => t.id === editingId ? { ...t, ...form, key: form.key || jcSlug(form.name) } : t));
    } else {
      const max = items.length ? Math.max(...items.map(t => t.order)) : 0;
      setItems(prev => [...prev, { id: jcId("jt"), ...form, key: form.key || jcSlug(form.name), order: max + 1 }]);
    }
    cancel(); mark();
  }
  function toggle(id: string) { setItems(prev => prev.map(t => t.id === id ? { ...t, active: !t.active } : t)); mark(); }
  function remove(id: string) { setItems(prev => prev.filter(t => t.id !== id)); mark(); }
  function save() { saveJobTypes(items); setItems(getJobTypes()); setDirty(false); setSaved(true); setTimeout(() => setSaved(false), 2000); }
  function reset() { setItems(resetJobTypes()); setDirty(false); }

  useEffect(() => { register(save, reset, dirty, saved); });

  const sorted = [...items].sort((a, b) => a.order - b.order);
  const editingType = items.find(t => t.id === editingId);

  function Form() {
    return (
      <div className="rounded-xl p-4 space-y-3"
        style={{ backgroundColor: "var(--bg-surface)", border: "2px solid #c7d2fe", boxShadow: "var(--shadow-card)" }}>
        <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#4f46e5" }}>
          {editingId ? "Edit Job Type" : "New Job Type"}
        </p>
        {editingType?.core && (
          <p className="text-[11px] rounded-lg px-3 py-2" style={{ backgroundColor: "var(--bg-surface-2)", color: "var(--text-muted)" }}>
            This is a core type required by Agreements. You can rename or recolor it, but its key can&apos;t change and it can&apos;t be deleted.
          </p>
        )}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Name *</label>
            <input value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value, key: editingId ? f.key : jcSlug(e.target.value) }))}
              className="w-full rounded-lg px-3 py-2 text-sm outline-none"
              style={{ border: "1px solid var(--border)", backgroundColor: "var(--bg-surface)", color: "var(--text-primary)" }} />
          </div>
          <div>
            <label className="text-xs font-medium mb-1 flex items-center gap-1.5" style={{ color: "var(--text-secondary)" }}>
              Key {editingType?.core && <Lock className="w-3 h-3" style={{ color: "var(--text-muted)" }} />}
            </label>
            <input value={form.key} readOnly={editingType?.core}
              onChange={e => { if (!editingType?.core) setForm(f => ({ ...f, key: jcSlug(e.target.value) })); }}
              title={editingType?.core ? "Core type — key is locked because other modules reference it" : undefined}
              className="w-full rounded-lg px-3 py-2 text-sm font-mono outline-none"
              style={{ border: "1px solid var(--border)", backgroundColor: "var(--bg-input)", color: "var(--text-primary)", opacity: editingType?.core ? 0.6 : 1, cursor: editingType?.core ? "not-allowed" : "text" }} />
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Description</label>
          <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            className="w-full rounded-lg px-3 py-2 text-sm outline-none"
            style={{ border: "1px solid var(--border)", backgroundColor: "var(--bg-surface)", color: "var(--text-primary)" }} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Default Duration (min)</label>
            <input type="number" min={0} step={15} value={form.duration}
              onChange={e => setForm(f => ({ ...f, duration: parseInt(e.target.value) || 0 }))}
              className="w-full rounded-lg px-3 py-2 text-sm outline-none"
              style={{ border: "1px solid var(--border)", backgroundColor: "var(--bg-surface)", color: "var(--text-primary)" }} />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Category</label>
            <UiSelect value={form.category} onChange={v => setForm(f => ({ ...f, category: v as JobTypeCategory }))}
              options={TYPE_CATS.map(c => ({ value: c, label: JOB_TYPE_CATEGORY_LABELS[c] }))} />
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>Color
            <span className="font-normal" style={{ color: "var(--text-muted)" }}> — used on the dispatch board</span>
          </label>
          <div className="flex flex-wrap gap-1.5">
            {STATUS_COLORS.map(c => (
              <button key={c} onClick={() => setForm(f => ({ ...f, color: c }))} className="w-6 h-6 rounded-full"
                style={{ backgroundColor: c, outline: form.color === c ? "2px solid var(--text-primary)" : "none", outlineOffset: "1px" }} />
            ))}
          </div>
        </div>
        {/* Work order behavior for this job type */}
        <div className="rounded-lg p-3 space-y-2.5" style={{ backgroundColor: "var(--bg-surface-2)", border: "1px solid var(--border)" }}>
          <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Work Order</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Policy</label>
              <UiSelect value={form.workOrderPolicy} onChange={v => setForm(f => ({ ...f, workOrderPolicy: v as WorkOrderPolicy }))}
                options={WO_POLICIES.map(p => ({ value: p, label: WORK_ORDER_POLICY_LABELS[p] }))} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Default Template</label>
              <UiSelect value={form.defaultWorkOrderTemplateId} onChange={v => setForm(f => ({ ...f, defaultWorkOrderTemplateId: v }))}
                options={[{ value: "", label: "Auto — match job type" }, ...woTemplates.map(t => ({ value: t.id, label: t.name }))]} />
            </div>
          </div>
          <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
            {form.workOrderPolicy === "auto" ? "A work order is created automatically from the template when a job of this type is booked."
              : form.workOrderPolicy === "required" ? "A completed work order is required before a job of this type can be finished."
              : "No work order by default — add one (template or blank) from the job when needed."}
          </p>
        </div>
        <div className="flex items-center justify-between pt-1">
          <label className="flex items-center gap-2 cursor-pointer">
            <Toggle on={form.active} onChange={v => setForm(f => ({ ...f, active: v }))} />
            <span className="text-sm" style={{ color: "var(--text-secondary)" }}>Active</span>
          </label>
          <div className="flex gap-2">
            <button onClick={cancel} className="px-3 py-1.5 rounded-lg text-sm" style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}>Cancel</button>
            <button onClick={commit} disabled={!form.name.trim()}
              className="px-4 py-1.5 rounded-lg text-sm font-medium text-white disabled:opacity-40" style={{ backgroundColor: "#4f46e5" }}>
              {editingId ? "Update" : "Add Job Type"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {dirty && <div className="text-xs px-3 py-1.5 rounded-lg inline-block" style={{ backgroundColor: "#fef3c7", color: "#92400e" }}>Unsaved changes</div>}

      {showAdd && Form()}

      <div className="rounded-xl overflow-hidden"
        style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" }}>
        <div className="flex items-center justify-between px-4 py-3"
          style={{ borderBottom: "1px solid var(--border)", backgroundColor: "var(--bg-surface-2)" }}>
          <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Job Types
            <span className="ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ backgroundColor: "var(--bg-input)", color: "var(--text-muted)" }}>{items.length}</span>
          </p>
          {!showAdd && (
            <button onClick={startAdd} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white" style={{ backgroundColor: "#4f46e5" }}>
              <Plus className="w-3.5 h-3.5" /> Add Job Type
            </button>
          )}
        </div>
        <div className="grid px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider"
          style={{ gridTemplateColumns: "auto 2fr 1.4fr 0.8fr 1fr 0.8fr auto", gap: "0.75rem", color: "var(--text-muted)", borderBottom: "1px solid var(--border)" }}>
          <span>Order</span><span>Name</span><span>Key</span><span>Duration</span><span>Category</span><span className="text-center">Active</span><span />
        </div>
        {sorted.map((t, i) => editingId === t.id ? (
          <div key={t.id} className="p-4" style={{ borderBottom: i < sorted.length - 1 ? "1px solid var(--border)" : "none" }}>{Form()}</div>
        ) : (
          <div key={t.id} className="grid px-4 py-3 items-center hover:bg-[var(--bg-surface-2)] transition-colors"
            style={{ gridTemplateColumns: "auto 2fr 1.4fr 0.8fr 1fr 0.8fr auto", gap: "0.75rem", borderBottom: i < sorted.length - 1 ? "1px solid var(--border)" : "none", opacity: t.active ? 1 : 0.5 }}>
            <div className="flex flex-col">
              <button onClick={() => move(t.id, -1)} disabled={i === 0} className="disabled:opacity-20" style={{ color: "var(--text-muted)" }}><ChevronUp className="w-3.5 h-3.5" /></button>
              <button onClick={() => move(t.id, 1)} disabled={i === sorted.length - 1} className="disabled:opacity-20" style={{ color: "var(--text-muted)" }}><ChevronDown className="w-3.5 h-3.5" /></button>
            </div>
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: t.color }} />
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>{t.name}</p>
                  {t.core && <CoreBadge />}
                </div>
                {t.description && <p className="text-[11px] truncate" style={{ color: "var(--text-muted)" }}>{t.description}</p>}
              </div>
            </div>
            <span className="text-xs font-mono truncate" style={{ color: "var(--text-muted)" }}>{t.key}</span>
            <span className="text-xs" style={{ color: "var(--text-secondary)" }}>{t.duration}m</span>
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full inline-block w-fit"
              style={{ backgroundColor: "var(--bg-input)", color: "var(--text-secondary)" }}>{JOB_TYPE_CATEGORY_LABELS[t.category]}</span>
            <div className="flex justify-center">
              {t.core
                ? <span title="Core type — stays active" style={{ opacity: 0.4, cursor: "not-allowed" }}><Toggle on onChange={() => {}} /></span>
                : <Toggle on={t.active} onChange={() => toggle(t.id)} />}
            </div>
            <div className="flex items-center gap-1 justify-end">
              <button onClick={() => startEdit(t)} className="p-1.5 rounded-lg hover:bg-[var(--bg-input)]" style={{ color: "var(--text-muted)" }}><Pencil className="w-3.5 h-3.5" /></button>
              {t.core
                ? <span className="p-1.5" title="Core type — can't be deleted" style={{ color: "var(--text-muted)", opacity: 0.5 }}><Lock className="w-3.5 h-3.5" /></span>
                : <button onClick={() => remove(t.id)} className="p-1.5 rounded-lg hover:bg-red-50" style={{ color: "#d1d5db" }}
                    onMouseEnter={e => (e.currentTarget.style.color = "#ef4444")} onMouseLeave={e => (e.currentTarget.style.color = "#d1d5db")}><Trash2 className="w-3.5 h-3.5" /></button>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Job Statuses tab ─────────────────────────────────────
type StatusForm = { name: string; key: string; color: string; category: JobStatusCategory; active: boolean };
const EMPTY_STATUS: StatusForm = { name: "", key: "", color: STATUS_COLORS[0], category: "open", active: true };

function JobStatusesTab({ register }: { register: Saver }) {
  const [items, setItems] = useState<JobStatusDef[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState<StatusForm>({ ...EMPTY_STATUS });
  const [dirty, setDirty] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => { setItems(getJobStatuses()); }, []);
  function mark() { setDirty(true); setSaved(false); }

  function move(id: string, dir: -1 | 1) {
    const sorted = [...items].sort((a, b) => a.order - b.order);
    const idx = sorted.findIndex(s => s.id === id), swap = idx + dir;
    if (swap < 0 || swap >= sorted.length) return;
    [sorted[idx].order, sorted[swap].order] = [sorted[swap].order, sorted[idx].order];
    setItems([...sorted]); mark();
  }
  function startEdit(s: JobStatusDef) {
    setForm({ name: s.name, key: s.key, color: s.color, category: s.category, active: s.active });
    setEditingId(s.id); setShowAdd(false);
  }
  function startAdd() { setForm({ ...EMPTY_STATUS }); setShowAdd(true); setEditingId(null); }
  function cancel() { setEditingId(null); setShowAdd(false); }
  function commit() {
    if (!form.name.trim()) return;
    if (editingId) {
      setItems(prev => prev.map(s => s.id === editingId ? { ...s, ...form, key: form.key || jcSlug(form.name) } : s));
    } else {
      const max = items.length ? Math.max(...items.map(s => s.order)) : 0;
      setItems(prev => [...prev, { id: jcId("js"), ...form, key: form.key || jcSlug(form.name), order: max + 1 }]);
    }
    cancel(); mark();
  }
  function toggle(id: string) { setItems(prev => prev.map(s => s.id === id ? { ...s, active: !s.active } : s)); mark(); }
  function remove(id: string) { setItems(prev => prev.filter(s => s.id !== id)); mark(); }
  function save() { saveJobStatuses(items); setItems(getJobStatuses()); setDirty(false); setSaved(true); setTimeout(() => setSaved(false), 2000); }
  function reset() { setItems(resetJobStatuses()); setDirty(false); }

  useEffect(() => { register(save, reset, dirty, saved); });

  const sorted = [...items].sort((a, b) => a.order - b.order);
  const editingStatus = items.find(s => s.id === editingId);

  function Form() {
    return (
      <div className="rounded-xl p-4 space-y-3"
        style={{ backgroundColor: "var(--bg-surface)", border: "2px solid #c7d2fe", boxShadow: "var(--shadow-card)" }}>
        <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#4f46e5" }}>
          {editingId ? "Edit Status" : "New Status"}
        </p>
        {editingStatus?.core && (
          <p className="text-[11px] rounded-lg px-3 py-2" style={{ backgroundColor: "var(--bg-surface-2)", color: "var(--text-muted)" }}>
            This is a core status that drives the job lifecycle and dispatch lanes. You can rename or recolor it, but its key can&apos;t change and it can&apos;t be deleted.
          </p>
        )}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Name *</label>
            <input value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value, key: editingId ? f.key : jcSlug(e.target.value) }))}
              className="w-full rounded-lg px-3 py-2 text-sm outline-none"
              style={{ border: "1px solid var(--border)", backgroundColor: "var(--bg-surface)", color: "var(--text-primary)" }} />
          </div>
          <div>
            <label className="text-xs font-medium mb-1 flex items-center gap-1.5" style={{ color: "var(--text-secondary)" }}>
              Key {editingStatus?.core && <Lock className="w-3 h-3" style={{ color: "var(--text-muted)" }} />}
            </label>
            <input value={form.key} readOnly={editingStatus?.core}
              onChange={e => { if (!editingStatus?.core) setForm(f => ({ ...f, key: jcSlug(e.target.value) })); }}
              title={editingStatus?.core ? "Core status — key is locked because the job lifecycle references it" : undefined}
              className="w-full rounded-lg px-3 py-2 text-sm font-mono outline-none"
              style={{ border: "1px solid var(--border)", backgroundColor: "var(--bg-input)", color: "var(--text-primary)", opacity: editingStatus?.core ? 0.6 : 1, cursor: editingStatus?.core ? "not-allowed" : "text" }} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Category</label>
            <UiSelect value={form.category} onChange={v => setForm(f => ({ ...f, category: v as JobStatusCategory }))}
              options={STATUS_CATS.map(c => ({ value: c, label: JOB_STATUS_CATEGORY_LABELS[c] }))} />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>Color</label>
            <div className="flex flex-wrap gap-1.5">
              {STATUS_COLORS.map(c => (
                <button key={c} onClick={() => setForm(f => ({ ...f, color: c }))} className="w-6 h-6 rounded-full"
                  style={{ backgroundColor: c, outline: form.color === c ? "2px solid var(--text-primary)" : "none", outlineOffset: "1px" }} />
              ))}
            </div>
          </div>
        </div>
        <div className="flex items-center justify-between pt-1">
          <label className="flex items-center gap-2 cursor-pointer">
            <Toggle on={form.active} onChange={v => setForm(f => ({ ...f, active: v }))} />
            <span className="text-sm" style={{ color: "var(--text-secondary)" }}>Active</span>
          </label>
          <div className="flex gap-2">
            <button onClick={cancel} className="px-3 py-1.5 rounded-lg text-sm" style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}>Cancel</button>
            <button onClick={commit} disabled={!form.name.trim()}
              className="px-4 py-1.5 rounded-lg text-sm font-medium text-white disabled:opacity-40" style={{ backgroundColor: "#4f46e5" }}>
              {editingId ? "Update" : "Add Status"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {dirty && <div className="text-xs px-3 py-1.5 rounded-lg inline-block" style={{ backgroundColor: "#fef3c7", color: "#92400e" }}>Unsaved changes</div>}

      {showAdd && Form()}

      <div className="rounded-xl overflow-hidden"
        style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" }}>
        <div className="flex items-center justify-between px-4 py-3"
          style={{ borderBottom: "1px solid var(--border)", backgroundColor: "var(--bg-surface-2)" }}>
          <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Job Statuses
            <span className="ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ backgroundColor: "var(--bg-input)", color: "var(--text-muted)" }}>{items.length}</span>
          </p>
          {!showAdd && (
            <button onClick={startAdd} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white" style={{ backgroundColor: "#4f46e5" }}>
              <Plus className="w-3.5 h-3.5" /> Add Status
            </button>
          )}
        </div>
        <div className="grid px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider"
          style={{ gridTemplateColumns: "auto 2fr 1.5fr 1fr 0.8fr auto", gap: "0.75rem", color: "var(--text-muted)", borderBottom: "1px solid var(--border)" }}>
          <span>Order</span><span>Status</span><span>Key</span><span>Category</span><span className="text-center">Active</span><span />
        </div>
        {sorted.map((s, i) => editingId === s.id ? (
          <div key={s.id} className="p-4" style={{ borderBottom: i < sorted.length - 1 ? "1px solid var(--border)" : "none" }}>{Form()}</div>
        ) : (
          <div key={s.id} className="grid px-4 py-3 items-center hover:bg-[var(--bg-surface-2)] transition-colors"
            style={{ gridTemplateColumns: "auto 2fr 1.5fr 1fr 0.8fr auto", gap: "0.75rem", borderBottom: i < sorted.length - 1 ? "1px solid var(--border)" : "none", opacity: s.active ? 1 : 0.5 }}>
            <div className="flex flex-col">
              <button onClick={() => move(s.id, -1)} disabled={i === 0} className="disabled:opacity-20" style={{ color: "var(--text-muted)" }}><ChevronUp className="w-3.5 h-3.5" /></button>
              <button onClick={() => move(s.id, 1)} disabled={i === sorted.length - 1} className="disabled:opacity-20" style={{ color: "var(--text-muted)" }}><ChevronDown className="w-3.5 h-3.5" /></button>
            </div>
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
              <span className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>{s.name}</span>
              {s.core && <CoreBadge />}
            </div>
            <span className="text-xs font-mono truncate" style={{ color: "var(--text-muted)" }}>{s.key}</span>
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full inline-block w-fit"
              style={{ backgroundColor: "var(--bg-input)", color: "var(--text-secondary)" }}>{JOB_STATUS_CATEGORY_LABELS[s.category]}</span>
            <div className="flex justify-center">
              {s.core
                ? <span title="Core status — stays active" style={{ opacity: 0.4, cursor: "not-allowed" }}><Toggle on onChange={() => {}} /></span>
                : <Toggle on={s.active} onChange={() => toggle(s.id)} />}
            </div>
            <div className="flex items-center gap-1 justify-end">
              <button onClick={() => startEdit(s)} className="p-1.5 rounded-lg hover:bg-[var(--bg-input)]" style={{ color: "var(--text-muted)" }}><Pencil className="w-3.5 h-3.5" /></button>
              {s.core
                ? <span className="p-1.5" title="Core status — can't be deleted" style={{ color: "var(--text-muted)", opacity: 0.5 }}><Lock className="w-3.5 h-3.5" /></span>
                : <button onClick={() => remove(s.id)} className="p-1.5 rounded-lg hover:bg-red-50" style={{ color: "#d1d5db" }}
                    onMouseEnter={e => (e.currentTarget.style.color = "#ef4444")} onMouseLeave={e => (e.currentTarget.style.color = "#d1d5db")}><Trash2 className="w-3.5 h-3.5" /></button>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Section ──────────────────────────────────────────────
export default function JobConfigSection() {
  const [tab, setTab] = useState<"types" | "statuses">("types");

  // Active tab registers its handlers so the header shows Save/Reset inline.
  const saverRef = useRef<() => void>(() => {});
  const resetRef = useRef<() => void>(() => {});
  const [hdr, setHdr] = useState<{ dirty: boolean; saved: boolean }>({ dirty: false, saved: false });
  const register = useCallback<Saver>((save, reset, dirty, saved) => {
    saverRef.current = save;
    resetRef.current = reset;
    setHdr(prev => (prev.dirty === dirty && prev.saved === saved) ? prev : { dirty, saved });
  }, []);
  function switchTab(next: "types" | "statuses") { setTab(next); setHdr({ dirty: false, saved: false }); }

  return (
    <div className="space-y-5">
      {/* Header — Save / Reset inline with the title */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>Job Types &amp; Statuses</h2>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>
            Configure how jobs are categorized and tracked. These drive the Jobs page, scheduling, and reports.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={() => resetRef.current()}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm transition-colors"
            style={{ border: "1px solid var(--border)", color: "var(--text-secondary)", backgroundColor: "var(--bg-surface)" }}>
            <RotateCcw className="w-3.5 h-3.5" /> Reset Defaults
          </button>
          <button onClick={() => saverRef.current()} disabled={!hdr.dirty && !hdr.saved}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-white transition-colors disabled:opacity-50"
            style={{ backgroundColor: hdr.saved ? "#10b981" : "#4f46e5" }}>
            <Check className="w-3.5 h-3.5" /> {hdr.saved ? "Saved" : "Save Changes"}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b" style={{ borderColor: "var(--border-subtle)" }}>
        {([
          { key: "types"    as const, label: "Job Types",    icon: Briefcase },
          { key: "statuses" as const, label: "Job Statuses", icon: Tags },
        ]).map(t => {
          const active = tab === t.key;
          const Icon = t.icon;
          return (
            <button key={t.key} onClick={() => switchTab(t.key)}
              className="relative flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-colors"
              style={{ color: active ? "#4f46e5" : "var(--text-muted)" }}>
              <Icon className="w-3.5 h-3.5 shrink-0" /> {t.label}
              {active && <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-t bg-indigo-600" />}
            </button>
          );
        })}
      </div>

      {tab === "types" ? <JobTypesTab register={register} /> : <JobStatusesTab register={register} />}

      <p className="text-xs" style={{ color: "var(--text-muted)" }}>
        Job types and statuses will move to the Company layer so each company can start from an
        industry default and customize. They will drive Jobs, Work Orders, scheduling, and dashboards.
      </p>
    </div>
  );
}
