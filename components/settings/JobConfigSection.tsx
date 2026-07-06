"use client";

import { useState, useEffect } from "react";
import { Plus, Pencil, ChevronUp, ChevronDown, Trash2, Lock, X } from "lucide-react";
import { pingSaved } from "@/components/shared/SavedPill";
import {
  getJobTypes, saveJobTypes,
  jcId, jcSlug,
  JOB_TYPE_CATEGORY_LABELS, STATUS_COLORS, WORK_ORDER_POLICY_LABELS,
  type JobTypeDef, type JobTypeCategory, type WorkOrderPolicy,
} from "@/lib/job-config/data";
import { getTemplates } from "@/lib/work-order-templates/data";
import UiSelect from "@/components/ui/Select";

const TYPE_CATS   = Object.keys(JOB_TYPE_CATEGORY_LABELS)   as JobTypeCategory[];
const WO_POLICIES = Object.keys(WORK_ORDER_POLICY_LABELS)   as WorkOrderPolicy[];

// Head and rows share ONE template so every column lines up.
const TYPE_COLS = "44px 1.8fr 0.8fr 1fr 64px 76px";

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

// Core entries (default types, lifecycle statuses) are required by other
// modules — a quiet lock marks them; delete/deactivate are protected.
function CoreBadge() {
  return (
    <span title="Core — other modules depend on this key" className="inline-flex shrink-0">
      <Lock className="w-3 h-3" style={{ color: "var(--text-muted)" }} />
    </span>
  );
}

// ─── Job Types tab ────────────────────────────────────────
type TypeForm = { name: string; key: string; description: string; duration: number; category: JobTypeCategory; color: string; active: boolean; workOrderPolicy: WorkOrderPolicy; defaultWorkOrderTemplateId: string };
const EMPTY_TYPE: TypeForm = { name: "", key: "", description: "", duration: 60, category: "service", color: STATUS_COLORS[0], active: true, workOrderPolicy: "optional", defaultWorkOrderTemplateId: "" };

function JobTypesTab() {
  const [items, setItems] = useState<JobTypeDef[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState<TypeForm>({ ...EMPTY_TYPE });
  const [dirty, setDirty] = useState(false);

  useEffect(() => { setItems(getJobTypes()); }, []);
  const woTemplates = getTemplates().filter(t => t.active);
  function mark() { setDirty(true); }

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

  useEffect(() => {
    if (!dirty) return;
    const t = setTimeout(() => { saveJobTypes(items); setDirty(false); pingSaved(); }, 500);
    return () => clearTimeout(t);
  }, [dirty, items]);

  const sorted = [...items].sort((a, b) => a.order - b.order);
  const editingType = items.find(t => t.id === editingId);
  const formOpen = showAdd || editingId !== null;

  function Form() {
    return (
      <div className="space-y-3">
        {editingType?.core && (
          <p className="text-[11px] rounded-lg px-3 py-2" style={{ backgroundColor: "var(--bg-surface-2)", color: "var(--text-muted)" }}>
            This is a core type — dispatch, work order templates, and reporting reference its key. You can rename or recolor it, but its key can&apos;t change and it can&apos;t be deleted.
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
        {/* Work order template for this job type — the auto-create policy is
            configured in Settings → Work Orders. */}
        <div className="rounded-lg p-3 space-y-2" style={{ backgroundColor: "var(--bg-surface-2)", border: "1px solid var(--border)" }}>
          <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Work Order</p>
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Default Template</label>
            <UiSelect value={form.defaultWorkOrderTemplateId} onChange={v => setForm(f => ({ ...f, defaultWorkOrderTemplateId: v }))}
              options={[{ value: "", label: "Auto — match job type" }, ...woTemplates.map(t => ({ value: t.id, label: t.name }))]} />
          </div>
          <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>Whether a work order auto-creates when a job is booked is set in Settings → Work Orders.</p>
        </div>
        {!editingType?.core && (
          <label className="flex items-center gap-2 cursor-pointer pt-1">
            <Toggle on={form.active} onChange={v => setForm(f => ({ ...f, active: v }))} />
            <span className="text-sm" style={{ color: "var(--text-secondary)" }}>Active</span>
          </label>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {dirty && <div className="text-xs px-3 py-1.5 rounded-lg inline-block" style={{ backgroundColor: "#fef3c7", color: "#92400e" }}>Unsaved changes</div>}

      <div className="rounded-xl overflow-hidden"
        style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" }}>
        <div className="flex items-center justify-between px-4 py-3"
          style={{ borderBottom: "1px solid var(--border)", backgroundColor: "var(--bg-surface-2)" }}>
          <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Job Types</p>
          <button onClick={startAdd} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white" style={{ backgroundColor: "#4f46e5" }}>
            <Plus className="w-3.5 h-3.5" /> Add Job Type
          </button>
        </div>
        <div className="grid px-4 py-2.5 gap-3 text-[10px] font-semibold uppercase tracking-wider"
          style={{ gridTemplateColumns: TYPE_COLS, color: "var(--text-muted)", borderBottom: "1px solid var(--border)" }}>
          <span>Order</span><span>Name</span><span>Duration</span><span>Category</span><span>Active</span><span />
        </div>
        {sorted.map((t, i) => (
          <div key={t.id} className="group grid px-4 py-3 gap-3 items-center hover:bg-[var(--bg-surface-2)] transition-colors"
            style={{ gridTemplateColumns: TYPE_COLS, borderBottom: i < sorted.length - 1 ? "1px solid var(--border)" : "none", opacity: t.active ? 1 : 0.5 }}>
            <div className="flex flex-col items-start">
              <button onClick={() => move(t.id, -1)} disabled={i === 0} className="disabled:opacity-20" style={{ color: "var(--text-muted)" }}><ChevronUp className="w-3.5 h-3.5" /></button>
              <button onClick={() => move(t.id, 1)} disabled={i === sorted.length - 1} className="disabled:opacity-20" style={{ color: "var(--text-muted)" }}><ChevronDown className="w-3.5 h-3.5" /></button>
            </div>
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: t.color }} />
              <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>{t.name}</p>
              {t.core && <CoreBadge />}
            </div>
            <span className="text-xs" style={{ color: "var(--text-secondary)" }}>{t.duration}m</span>
            <span className="text-xs truncate" style={{ color: "var(--text-secondary)" }}>{JOB_TYPE_CATEGORY_LABELS[t.category]}</span>
            <div>
              {t.core
                ? <span className="text-xs" title="Core type — stays active" style={{ color: "var(--text-muted)" }}>Active</span>
                : <Toggle on={t.active} onChange={() => toggle(t.id)} />}
            </div>
            <div className="flex items-center gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
              <button onClick={() => startEdit(t)} className="p-1.5 rounded-lg hover:bg-[var(--bg-input)]" style={{ color: "var(--text-muted)" }}><Pencil className="w-3.5 h-3.5" /></button>
              {t.core
                ? <span className="p-1.5" title="Core type — can't be deleted" style={{ color: "var(--text-muted)", opacity: 0.5 }}><Lock className="w-3.5 h-3.5" /></span>
                : <button onClick={() => remove(t.id)} className="p-1.5 rounded-lg hover:bg-red-50" style={{ color: "#d1d5db" }}
                    onMouseEnter={e => (e.currentTarget.style.color = "#ef4444")} onMouseLeave={e => (e.currentTarget.style.color = "#d1d5db")}><Trash2 className="w-3.5 h-3.5" /></button>}
            </div>
          </div>
        ))}
      </div>

      {/* Create / edit — standard popup, same container language as the rest of the CRM */}
      {formOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={cancel}>
          <div className="w-full max-w-lg max-h-[90vh] flex flex-col rounded-2xl overflow-hidden"
            onClick={e => e.stopPropagation()}
            style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "0 16px 48px rgba(0,0,0,0.24)" }}>
            <div className="flex items-center justify-between px-6 py-5 shrink-0" style={{ borderBottom: "1px solid var(--border)" }}>
              <h2 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>{editingId ? "Edit Job Type" : "New Job Type"}</h2>
              <button onClick={cancel} className="p-2 rounded-lg" style={{ color: "var(--text-muted)" }}><X className="w-4 h-4" /></button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-5">{Form()}</div>
            <div className="px-6 py-4 flex justify-end gap-2 shrink-0" style={{ borderTop: "1px solid var(--border)" }}>
              <button onClick={cancel} className="px-3 py-2 rounded-lg text-sm" style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}>Cancel</button>
              <button onClick={commit} disabled={!form.name.trim()}
                className="px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-40" style={{ backgroundColor: "#4f46e5" }}>
                {editingId ? "Update" : "Add Job Type"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Section ──────────────────────────────────────────────
export default function JobConfigSection() {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>Job Types</h2>
        <p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>
          Configure how jobs are categorized — types drive the Jobs page, scheduling, and reports.
          The status lifecycle is fixed; see Settings → Reference for how jobs flow.
        </p>
      </div>

      <JobTypesTab />

      <p className="text-xs" style={{ color: "var(--text-muted)" }}>
        Job types will move to the Company layer so each company can start from an
        industry default and customize. They drive Jobs, Work Orders, scheduling, and dashboards.
      </p>
    </div>
  );
}
