"use client";

// ─── Tasks settings ───────────────────────────────────────
// Customize the task-type catalog (label, color, active, order) and the
// defaults the New Task modal pre-fills. Self-contained with its own Save —
// reads/writes lib/tasks/settings.

import { useState, useEffect } from "react";
import { Plus, Pencil, ChevronUp, ChevronDown, Trash2, Check, RotateCcw } from "lucide-react";
import {
  getTaskSettings, saveTaskSettings, resetTaskSettings,
  TASK_TYPE_COLORS, ttId, ttSlug,
  type TaskSettings, type TaskTypeDef, type DefaultAssignee,
} from "@/lib/tasks/settings";
import UiSelect from "@/components/ui/Select";

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

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl p-5"
      style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-subtle)", boxShadow: "var(--shadow-card)" }}>
      {children}
    </div>
  );
}

type FormState = { name: string; key: string; color: string; active: boolean };
const EMPTY: FormState = { name: "", key: "", color: TASK_TYPE_COLORS[0], active: true };

export default function TasksSettingsSection() {
  const [s, setS] = useState<TaskSettings | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState<FormState>({ ...EMPTY });
  const [dirty, setDirty] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => { setS(getTaskSettings()); }, []);
  function mark() { setDirty(true); setSaved(false); }

  if (!s) return <div className="p-6 text-sm" style={{ color: "var(--text-muted)" }}>Loading…</div>;

  const sorted = [...s.types].sort((a, b) => a.order - b.order);
  const activeTypes = sorted.filter(t => t.active);

  function setTypes(next: TaskTypeDef[]) { setS(prev => prev && { ...prev, types: next }); mark(); }
  function setField<K extends keyof TaskSettings>(k: K, v: TaskSettings[K]) { setS(prev => prev && { ...prev, [k]: v }); mark(); }

  function move(id: string, dir: -1 | 1) {
    const list = [...sorted];
    const idx = list.findIndex(t => t.id === id), swap = idx + dir;
    if (swap < 0 || swap >= list.length) return;
    [list[idx].order, list[swap].order] = [list[swap].order, list[idx].order];
    setTypes(list);
  }
  function startEdit(t: TaskTypeDef) { setForm({ name: t.label, key: t.key, color: t.color, active: t.active }); setEditingId(t.id); setShowAdd(false); }
  function startAdd() { setForm({ ...EMPTY }); setShowAdd(true); setEditingId(null); }
  function cancel() { setEditingId(null); setShowAdd(false); }
  function commit() {
    if (!form.name.trim()) return;
    if (editingId) {
      setTypes(s!.types.map(t => t.id === editingId ? { ...t, label: form.name.trim(), key: form.key || ttSlug(form.name), color: form.color, active: form.active } : t));
    } else {
      const max = s!.types.length ? Math.max(...s!.types.map(t => t.order)) : 0;
      const key = form.key || ttSlug(form.name);
      setTypes([...s!.types, { id: ttId(), key, label: form.name.trim(), color: form.color, active: form.active, order: max + 1 }]);
    }
    cancel();
  }
  function toggleActive(id: string) { setTypes(s!.types.map(t => t.id === id ? { ...t, active: !t.active } : t)); }
  function remove(id: string) {
    const removed = s!.types.find(t => t.id === id);
    const next = s!.types.filter(t => t.id !== id);
    setS(prev => prev && {
      ...prev,
      types: next,
      // Keep defaultTypeKey valid if its type was deleted.
      defaultTypeKey: removed?.key === prev.defaultTypeKey ? (next.find(t => t.active)?.key ?? next[0]?.key ?? "") : prev.defaultTypeKey,
    });
    mark();
  }
  function save() {
    saveTaskSettings(s!);
    setDirty(false); setSaved(true); setTimeout(() => setSaved(false), 2000);
  }
  function reset() { setS(resetTaskSettings()); setEditingId(null); setShowAdd(false); setDirty(false); }

  function Form() {
    return (
      <div className="rounded-xl p-4 space-y-3" style={{ backgroundColor: "var(--bg-surface)", border: "2px solid #c7d2fe", boxShadow: "var(--shadow-card)" }}>
        <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#4f46e5" }}>{editingId ? "Edit Task Type" : "New Task Type"}</p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Name *</label>
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value, key: editingId ? f.key : ttSlug(e.target.value) }))}
              placeholder="e.g. Follow-Up"
              className="w-full rounded-lg px-3 py-2 text-sm outline-none" style={{ border: "1px solid var(--border)", backgroundColor: "var(--bg-surface)", color: "var(--text-primary)" }} />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Key</label>
            <input value={form.key} onChange={e => setForm(f => ({ ...f, key: ttSlug(e.target.value) }))}
              disabled={!!editingId}
              className="w-full rounded-lg px-3 py-2 text-sm font-mono outline-none disabled:opacity-60"
              style={{ border: "1px solid var(--border)", backgroundColor: "var(--bg-input)", color: "var(--text-primary)" }} />
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>Color</label>
          <div className="flex flex-wrap gap-1.5">
            {TASK_TYPE_COLORS.map(c => (
              <button key={c} onClick={() => setForm(f => ({ ...f, color: c }))} className="w-6 h-6 rounded-full"
                style={{ backgroundColor: c, outline: form.color === c ? "2px solid var(--text-primary)" : "none", outlineOffset: "1px" }} />
            ))}
          </div>
        </div>
        <div className="flex items-center justify-between pt-1">
          <label className="flex items-center gap-2 cursor-pointer">
            <Toggle on={form.active} onChange={v => setForm(f => ({ ...f, active: v }))} />
            <span className="text-sm" style={{ color: "var(--text-secondary)" }}>Active</span>
          </label>
          <div className="flex gap-2">
            <button onClick={cancel} className="px-3 py-1.5 rounded-lg text-sm" style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}>Cancel</button>
            <button onClick={commit} disabled={!form.name.trim()} className="px-4 py-1.5 rounded-lg text-sm font-medium text-white disabled:opacity-40" style={{ backgroundColor: "#4f46e5" }}>{editingId ? "Update" : "Add Type"}</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header + actions */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>Tasks</h2>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>
            Customize task types and the defaults used when creating follow-ups, calls, and scheduled actions.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={reset} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm transition-colors"
            style={{ border: "1px solid var(--border)", color: "var(--text-secondary)", backgroundColor: "var(--bg-surface)" }}>
            <RotateCcw className="w-3.5 h-3.5" /> Reset Defaults
          </button>
          <button onClick={save} disabled={!dirty && !saved}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-white transition-colors disabled:opacity-50" style={{ backgroundColor: saved ? "#10b981" : "#4f46e5" }}>
            <Check className="w-3.5 h-3.5" /> {saved ? "Saved" : "Save Changes"}
          </button>
        </div>
      </div>

      {dirty && <div className="rounded-lg px-3 py-2 text-xs" style={{ backgroundColor: "#fef3c7", color: "#92400e" }}>You have unsaved changes.</div>}

      {showAdd && <Form />}

      {/* Task types table */}
      <div className="rounded-xl overflow-hidden" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-subtle)", boxShadow: "var(--shadow-card)" }}>
        <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: "1px solid var(--border-subtle)", backgroundColor: "var(--bg-surface-2)" }}>
          <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Task Types
            <span className="ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ backgroundColor: "var(--bg-input)", color: "var(--text-muted)" }}>{s.types.length}</span></p>
          {!showAdd && <button onClick={startAdd} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white" style={{ backgroundColor: "#4f46e5" }}><Plus className="w-3.5 h-3.5" /> Add Type</button>}
        </div>
        <div className="grid px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider"
          style={{ gridTemplateColumns: "auto 2fr 1.4fr 0.8fr auto", gap: "0.75rem", color: "var(--text-muted)", borderBottom: "1px solid var(--border-subtle)" }}>
          <span>Order</span><span>Type</span><span>Key</span><span className="text-center">Active</span><span />
        </div>
        {sorted.map((t, i) => editingId === t.id ? (
          <div key={t.id} className="p-4" style={{ borderBottom: i < sorted.length - 1 ? "1px solid var(--border-subtle)" : "none" }}><Form /></div>
        ) : (
          <div key={t.id} className="grid px-4 py-3 items-center hover:bg-[var(--bg-surface-2)] transition-colors"
            style={{ gridTemplateColumns: "auto 2fr 1.4fr 0.8fr auto", gap: "0.75rem", borderBottom: i < sorted.length - 1 ? "1px solid var(--border-subtle)" : "none", opacity: t.active ? 1 : 0.5 }}>
            <div className="flex flex-col">
              <button onClick={() => move(t.id, -1)} disabled={i === 0} className="disabled:opacity-20" style={{ color: "var(--text-muted)" }}><ChevronUp className="w-3.5 h-3.5" /></button>
              <button onClick={() => move(t.id, 1)} disabled={i === sorted.length - 1} className="disabled:opacity-20" style={{ color: "var(--text-muted)" }}><ChevronDown className="w-3.5 h-3.5" /></button>
            </div>
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: t.color }} />
              <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>{t.label}</p>
            </div>
            <span className="text-[11px] font-mono truncate" style={{ color: "var(--text-muted)" }}>{t.key}</span>
            <div className="flex justify-center"><Toggle on={t.active} onChange={() => toggleActive(t.id)} /></div>
            <div className="flex items-center gap-1 justify-end">
              <button onClick={() => startEdit(t)} className="p-1.5 rounded-lg hover:bg-[var(--bg-input)]" style={{ color: "var(--text-muted)" }}><Pencil className="w-3.5 h-3.5" /></button>
              <button onClick={() => remove(t.id)} className="p-1.5 rounded-lg hover:bg-red-50" style={{ color: "#d1d5db" }}
                onMouseEnter={e => (e.currentTarget.style.color = "#ef4444")} onMouseLeave={e => (e.currentTarget.style.color = "#d1d5db")}><Trash2 className="w-3.5 h-3.5" /></button>
            </div>
          </div>
        ))}
      </div>

      {/* Defaults */}
      <Card>
        <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: "var(--text-muted)" }}>New Task Defaults</p>
        <p className="text-xs mb-4" style={{ color: "var(--text-muted)" }}>What the New Task form pre-fills when your team creates a task.</p>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>Default Type</label>
            <UiSelect value={s.defaultTypeKey} onChange={v => setField("defaultTypeKey", v)}
              options={activeTypes.map(t => ({ value: t.key, label: t.label }))} />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>Default Due (days from today)</label>
            <input type="number" min={0} max={365} value={s.defaultDueInDays}
              onChange={e => setField("defaultDueInDays", Math.max(0, Math.min(365, Number(e.target.value) || 0)))}
              className="w-full rounded-lg px-3 py-2 text-sm outline-none"
              style={{ border: "1px solid var(--border)", backgroundColor: "var(--bg-surface)", color: "var(--text-primary)" }} />
          </div>
        </div>
        <div className="mt-4">
          <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>Default Assignee</label>
          <div className="flex gap-2">
            {([
              { key: "creator" as DefaultAssignee, label: "Me (task creator)" },
              { key: "unassigned" as DefaultAssignee, label: "Unassigned" },
            ]).map(opt => {
              const active = s.defaultAssignee === opt.key;
              return (
                <button key={opt.key} onClick={() => setField("defaultAssignee", opt.key)}
                  className="flex-1 py-2 rounded-lg text-sm font-medium transition-all"
                  style={{ border: `1.5px solid ${active ? "#4f46e5" : "var(--border)"}`, backgroundColor: active ? "#e0e7ff" : "var(--bg-surface-2)", color: active ? "#4f46e5" : "var(--text-secondary)" }}>
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>
      </Card>

      {/* Display preferences */}
      <Card>
        <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: "var(--text-muted)" }}>Display</p>
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>Highlight overdue tasks</p>
            <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>Show overdue due dates in red with a warning marker on the Tasks list.</p>
          </div>
          <Toggle on={s.highlightOverdue} onChange={v => setField("highlightOverdue", v)} />
        </div>
      </Card>

      <p className="text-xs" style={{ color: "var(--text-muted)" }}>
        Task types drive the type picker in the New Task modal and the labels shown across the Tasks list,
        dashboard, and calendar. The keys <span className="font-mono">schedule</span> and <span className="font-mono">call</span> also feed dispatch triage.
      </p>
    </div>
  );
}
