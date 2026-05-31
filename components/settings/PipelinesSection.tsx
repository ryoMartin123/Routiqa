"use client";

import { useState, useEffect } from "react";
import { Plus, Pencil, ChevronUp, ChevronDown, Trash2, Check, X, RotateCcw } from "lucide-react";
import {
  getStages, saveStages, resetStages, newStageId, slugify,
  STAGE_CATEGORY_LABELS, STAGE_COLORS,
  type PipelineStage, type StageCategory,
} from "@/lib/pipelines/data";
import UiSelect from "@/components/ui/Select";

const CATEGORIES = Object.keys(STAGE_CATEGORY_LABELS) as StageCategory[];

const CATEGORY_BADGE: Record<StageCategory, { bg: string; color: string }> = {
  open: { bg: "#e0e7ff", color: "#3730a3" },
  won:  { bg: "#d1fae5", color: "#065f46" },
  lost: { bg: "#fee2e2", color: "#991b1b" },
};

type FormState = { name: string; key: string; color: string; category: StageCategory; active: boolean };
const EMPTY_FORM: FormState = { name: "", key: "", color: STAGE_COLORS[0], category: "open", active: true };

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

export default function PipelinesSection() {
  const [stages, setStages] = useState<PipelineStage[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState<FormState>({ ...EMPTY_FORM });
  const [saved, setSaved] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => { setStages(getStages()); }, []);

  function markDirty() { setDirty(true); setSaved(false); }

  // ── Reorder ──
  function move(id: string, dir: -1 | 1) {
    const sorted = [...stages].sort((a, b) => a.order - b.order);
    const idx = sorted.findIndex(s => s.id === id);
    const swap = idx + dir;
    if (swap < 0 || swap >= sorted.length) return;
    const a = sorted[idx].order;
    sorted[idx].order = sorted[swap].order;
    sorted[swap].order = a;
    setStages([...sorted]);
    markDirty();
  }

  // ── Inline edit ──
  function startEdit(s: PipelineStage) {
    setForm({ name: s.name, key: s.key, color: s.color, category: s.category, active: s.active });
    setEditingId(s.id);
    setShowAdd(false);
  }
  function startAdd() {
    setForm({ ...EMPTY_FORM });
    setShowAdd(true);
    setEditingId(null);
  }
  function cancelForm() { setEditingId(null); setShowAdd(false); }

  function commitForm() {
    if (!form.name.trim()) return;
    if (editingId) {
      setStages(prev => prev.map(s => s.id === editingId ? { ...s, ...form, key: form.key || slugify(form.name) } : s));
    } else {
      const maxOrder = stages.length > 0 ? Math.max(...stages.map(s => s.order)) : 0;
      setStages(prev => [...prev, {
        id: newStageId(), name: form.name.trim(), key: form.key || slugify(form.name),
        color: form.color, category: form.category, active: form.active, order: maxOrder + 1,
      }]);
    }
    cancelForm();
    markDirty();
  }

  function toggleActive(id: string) {
    setStages(prev => prev.map(s => s.id === id ? { ...s, active: !s.active } : s));
    markDirty();
  }
  function remove(id: string) {
    setStages(prev => prev.filter(s => s.id !== id));
    markDirty();
  }

  function handleSave() {
    saveStages(stages);
    setStages(getStages());
    setDirty(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }
  function handleReset() {
    setStages(resetStages());
    setDirty(false);
  }

  const sorted = [...stages].sort((a, b) => a.order - b.order);

  // ── Inline form renderer ──
  function FormCard() {
    return (
      <div className="rounded-xl p-4 space-y-3"
        style={{ backgroundColor: "var(--bg-surface)", border: "2px solid #c7d2fe", boxShadow: "var(--shadow-card)" }}>
        <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#4f46e5" }}>
          {editingId ? "Edit Stage" : "New Stage"}
        </p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Stage Name *</label>
            <input value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value, key: editingId ? f.key : slugify(e.target.value) }))}
              placeholder="e.g. Proposal Sent"
              className="w-full rounded-lg px-3 py-2 text-sm outline-none"
              style={{ border: "1px solid var(--border)", backgroundColor: "var(--bg-surface)", color: "var(--text-primary)" }} />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Key</label>
            <input value={form.key} onChange={e => setForm(f => ({ ...f, key: slugify(e.target.value) }))}
              className="w-full rounded-lg px-3 py-2 text-sm font-mono outline-none"
              style={{ border: "1px solid var(--border)", backgroundColor: "var(--bg-input)", color: "var(--text-primary)" }} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Category</label>
            <UiSelect value={form.category} onChange={v => setForm(f => ({ ...f, category: v as StageCategory }))}
              options={CATEGORIES.map(c => ({ value: c, label: STAGE_CATEGORY_LABELS[c] }))} />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>Color</label>
            <div className="flex flex-wrap gap-1.5">
              {STAGE_COLORS.map(c => (
                <button key={c} onClick={() => setForm(f => ({ ...f, color: c }))}
                  className="w-6 h-6 rounded-full transition-transform"
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
            <button onClick={cancelForm}
              className="px-3 py-1.5 rounded-lg text-sm" style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}>
              Cancel
            </button>
            <button onClick={commitForm} disabled={!form.name.trim()}
              className="px-4 py-1.5 rounded-lg text-sm font-medium text-white disabled:opacity-40"
              style={{ backgroundColor: "#4f46e5" }}>
              {editingId ? "Update Stage" : "Add Stage"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>Pipelines</h2>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>
            Manage your lead pipeline stages. These drive the Leads page and pipeline board.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleReset}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm transition-colors"
            style={{ border: "1px solid var(--border)", color: "var(--text-secondary)", backgroundColor: "var(--bg-surface)" }}>
            <RotateCcw className="w-3.5 h-3.5" /> Reset Defaults
          </button>
          <button onClick={handleSave} disabled={!dirty && !saved}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-white transition-colors disabled:opacity-50"
            style={{ backgroundColor: saved ? "#10b981" : "#4f46e5" }}>
            <Check className="w-3.5 h-3.5" /> {saved ? "Saved" : "Save Changes"}
          </button>
        </div>
      </div>

      {dirty && (
        <div className="rounded-lg px-3 py-2 text-xs" style={{ backgroundColor: "#fef3c7", color: "#92400e" }}>
          You have unsaved changes.
        </div>
      )}

      {/* Add form (when adding) */}
      {showAdd && FormCard()}

      {/* Table */}
      <div className="rounded-xl overflow-hidden"
        style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-subtle)", boxShadow: "var(--shadow-card)" }}>
        <div className="flex items-center justify-between px-4 py-3"
          style={{ borderBottom: "1px solid var(--border-subtle)", backgroundColor: "var(--bg-surface-2)" }}>
          <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
            Pipeline Stages
            <span className="ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded-full"
              style={{ backgroundColor: "var(--bg-input)", color: "var(--text-muted)" }}>{stages.length}</span>
          </p>
          {!showAdd && (
            <button onClick={startAdd}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white"
              style={{ backgroundColor: "#4f46e5" }}>
              <Plus className="w-3.5 h-3.5" /> Add Stage
            </button>
          )}
        </div>

        <div className="grid px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider"
          style={{ gridTemplateColumns: "auto 2fr 1.5fr 1fr 1fr auto", gap: "1rem", color: "var(--text-muted)", borderBottom: "1px solid var(--border-subtle)" }}>
          <span>Order</span><span>Stage</span><span>Key</span><span>Category</span><span className="text-center">Active</span><span />
        </div>

        {sorted.map((s, i) => (
          editingId === s.id ? (
            <div key={s.id} className="p-4" style={{ borderBottom: i < sorted.length - 1 ? "1px solid var(--border-subtle)" : "none" }}>
              {FormCard()}
            </div>
          ) : (
            <div key={s.id}
              className="grid px-4 py-3 items-center hover:bg-[var(--bg-surface-2)] transition-colors"
              style={{ gridTemplateColumns: "auto 2fr 1.5fr 1fr 1fr auto", gap: "1rem", borderBottom: i < sorted.length - 1 ? "1px solid var(--border-subtle)" : "none", opacity: s.active ? 1 : 0.5 }}>
              {/* Reorder */}
              <div className="flex flex-col">
                <button onClick={() => move(s.id, -1)} disabled={i === 0} className="disabled:opacity-20" style={{ color: "var(--text-muted)" }}>
                  <ChevronUp className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => move(s.id, 1)} disabled={i === sorted.length - 1} className="disabled:opacity-20" style={{ color: "var(--text-muted)" }}>
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>
              </div>
              {/* Stage name + color */}
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
                <span className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>{s.name}</span>
              </div>
              <span className="text-xs font-mono truncate" style={{ color: "var(--text-muted)" }}>{s.key}</span>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full inline-block w-fit"
                style={CATEGORY_BADGE[s.category]}>{STAGE_CATEGORY_LABELS[s.category]}</span>
              <div className="flex justify-center"><Toggle on={s.active} onChange={() => toggleActive(s.id)} /></div>
              <div className="flex items-center gap-1 justify-end">
                <button onClick={() => startEdit(s)} className="p-1.5 rounded-lg hover:bg-[var(--bg-input)]" style={{ color: "var(--text-muted)" }}>
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => remove(s.id)} className="p-1.5 rounded-lg hover:bg-red-50" style={{ color: "#d1d5db" }}
                  onMouseEnter={e => (e.currentTarget.style.color = "#ef4444")}
                  onMouseLeave={e => (e.currentTarget.style.color = "#d1d5db")}>
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )
        ))}
      </div>

      <p className="text-xs" style={{ color: "var(--text-muted)" }}>
        Pipelines will move to the Company layer so each company can start from an industry default
        (HVAC, roofing, plumbing, etc.) and customize from there.
      </p>
    </div>
  );
}
