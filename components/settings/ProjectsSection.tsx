"use client";

import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2, ChevronUp, ChevronDown } from "lucide-react";
import UiSelect from "@/components/ui/Select";
import { useScopedSetting } from "@/lib/settings-scope/useScopedSetting";
import InheritanceChip from "@/components/settings/InheritanceChip";
import { useRegisterSaveAction } from "@/components/settings/SettingsActions";
import ProjectMapsEditor from "@/components/settings/ProjectMapsEditor";
import {
  PROJECT_STAGES_KEY, DEFAULT_PROJECT_STAGES, reorderProjectStages, PROJECT_STAGE_COLORS, newProjectStageId, slugify,
  PROJECT_TYPES_KEY, DEFAULT_PROJECT_TYPES,
  PROJECT_DEFAULTS_KEY, DEFAULT_PROJECT_DEFAULTS,
  type ProjectStage, type ProjectStageCategory, type ProjectTypeOption, type ProjectDefaults,
} from "@/lib/projects/settings";

const SUBTABS = [
  { key: "stages",   label: "Stages" },
  { key: "types",    label: "Types" },
  { key: "maps",     label: "Maps" },
  { key: "defaults", label: "Defaults" },
] as const;
type SubTab = typeof SUBTABS[number]["key"];

const inputCls = "w-full rounded-lg px-3 py-2 text-sm outline-none";
const inputStyle = { border: "1px solid var(--border)", backgroundColor: "var(--bg-surface)", color: "var(--text-primary)" } as const;

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!on)} role="switch" aria-checked={on} type="button"
      className="relative w-8 h-4 rounded-full transition-colors shrink-0"
      style={{ backgroundColor: on ? "#4f46e5" : "var(--bg-input)", border: "1px solid var(--border)" }}>
      <span className="absolute top-0.5 left-0.5 w-3 h-3 rounded-full bg-white shadow transition-transform"
        style={{ transform: on ? "translateX(16px)" : "translateX(0)" }} />
    </button>
  );
}

export default function ProjectsSection() {
  const [sub, setSub] = useState<SubTab>("stages");
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>Projects</h2>
        <p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>
          Customize the project pipeline, types, map workflows, and defaults. These drive the Projects board, the project Map, and the new-project wizard.
        </p>
      </div>

      {/* Sub-tab nav */}
      <div className="flex items-center gap-0.5">
        {SUBTABS.map(t => {
          const active = sub === t.key;
          return (
            <button key={t.key} onClick={() => setSub(t.key)}
              className="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
              style={{
                backgroundColor: active ? "var(--accent-soft-bg)" : "transparent",
                color: active ? "var(--accent-text)" : "var(--text-muted)",
                border: `1px solid ${active ? "var(--accent-soft-border)" : "transparent"}`,
              }}>
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Only the active editor is mounted, so only its Save action registers. */}
      {sub === "stages"   && <StagesEditor />}
      {sub === "types"    && <TypesEditor />}
      {sub === "maps"     && <ProjectMapsEditor />}
      {sub === "defaults" && <DefaultsEditor />}
    </div>
  );
}

// ─── Stages ───────────────────────────────────────────────
const CATEGORY_LABELS: Record<ProjectStageCategory, string> = { open: "Open", done: "Done", canceled: "Canceled" };
const CATEGORIES = Object.keys(CATEGORY_LABELS) as ProjectStageCategory[];
const CATEGORY_BADGE: Record<ProjectStageCategory, { bg: string; color: string }> = {
  open:     { bg: "#e0e7ff", color: "#3730a3" },
  done:     { bg: "#d1fae5", color: "#065f46" },
  canceled: { bg: "#fee2e2", color: "#991b1b" },
};
const sortStages = (s: ProjectStage[]) => [...s].sort((a, b) => a.order - b.order).map(x => ({ ...x }));
type StageForm = { name: string; key: string; color: string; category: ProjectStageCategory; active: boolean };
const EMPTY_STAGE: StageForm = { name: "", key: "", color: PROJECT_STAGE_COLORS[0], category: "open", active: true };

function StagesEditor() {
  const scoped = useScopedSetting<ProjectStage[]>(PROJECT_STAGES_KEY, DEFAULT_PROJECT_STAGES);
  const [stages, setStages] = useState<ProjectStage[]>(() => sortStages(DEFAULT_PROJECT_STAGES));
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState<StageForm>({ ...EMPTY_STAGE });
  const [saved, setSaved] = useState(false);
  const [baseline, setBaseline] = useState(() => JSON.stringify(sortStages(DEFAULT_PROJECT_STAGES)));

  useEffect(() => {
    const next = sortStages(scoped.value);
    setStages(next); setBaseline(JSON.stringify(next)); setEditingId(null); setShowAdd(false);
  }, [scoped.value]);

  const dirty = JSON.stringify(sortStages(stages)) !== baseline;

  function move(id: string, dir: -1 | 1) {
    const sorted = [...stages].sort((a, b) => a.order - b.order);
    const idx = sorted.findIndex(s => s.id === id); const swap = idx + dir;
    if (swap < 0 || swap >= sorted.length) return;
    const o = sorted[idx].order; sorted[idx].order = sorted[swap].order; sorted[swap].order = o;
    setStages([...sorted]); setSaved(false);
  }
  function startEdit(s: ProjectStage) { setForm({ name: s.name, key: s.key, color: s.color, category: s.category, active: s.active }); setEditingId(s.id); setShowAdd(false); }
  function startAdd() { setForm({ ...EMPTY_STAGE }); setShowAdd(true); setEditingId(null); }
  function cancelForm() { setEditingId(null); setShowAdd(false); }
  function commitForm() {
    if (!form.name.trim()) return;
    if (editingId) setStages(prev => prev.map(s => s.id === editingId ? { ...s, ...form, key: form.key || slugify(form.name) } : s));
    else {
      const maxOrder = stages.length ? Math.max(...stages.map(s => s.order)) : 0;
      setStages(prev => [...prev, { id: newProjectStageId(), name: form.name.trim(), key: form.key || slugify(form.name), color: form.color, category: form.category, active: form.active, order: maxOrder + 1 }]);
    }
    cancelForm(); setSaved(false);
  }
  function handleSave() {
    const next = reorderProjectStages(stages);
    scoped.save(next); setBaseline(JSON.stringify(sortStages(next))); setSaved(true); setTimeout(() => setSaved(false), 2000);
  }
  useRegisterSaveAction({ dirty, saved, onSave: handleSave });

  const sorted = [...stages].sort((a, b) => a.order - b.order);

  function FormCard() {
    return (
      <div className="rounded-xl p-4 space-y-3" style={{ backgroundColor: "var(--bg-surface)", border: "2px solid #c7d2fe", boxShadow: "var(--shadow-card)" }}>
        <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#4f46e5" }}>{editingId ? "Edit Stage" : "New Stage"}</p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Stage Name *</label>
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value, key: editingId ? f.key : slugify(e.target.value) }))} placeholder="e.g. Permitting" className={inputCls} style={inputStyle} />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Key</label>
            <input value={form.key} onChange={e => setForm(f => ({ ...f, key: slugify(e.target.value) }))} className={`${inputCls} font-mono`} style={{ ...inputStyle, backgroundColor: "var(--bg-input)" }} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Category</label>
            <UiSelect value={form.category} onChange={v => setForm(f => ({ ...f, category: v as ProjectStageCategory }))} options={CATEGORIES.map(c => ({ value: c, label: CATEGORY_LABELS[c] }))} />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>Color</label>
            <div className="flex flex-wrap gap-1.5">
              {PROJECT_STAGE_COLORS.map(c => (
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
            <button onClick={cancelForm} className="px-3 py-1.5 rounded-lg text-sm" style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}>Cancel</button>
            <button onClick={commitForm} disabled={!form.name.trim()} className="px-4 py-1.5 rounded-lg text-sm font-medium text-white disabled:opacity-40" style={{ backgroundColor: "#4f46e5" }}>{editingId ? "Update Stage" : "Add Stage"}</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <InheritanceChip source={scoped.source} isOverride={scoped.isOverride} parentSource={scoped.parentSource} onOverride={scoped.override} onReset={scoped.reset} />
      {dirty && <div className="rounded-lg px-3 py-2 text-xs" style={{ backgroundColor: "#fef3c7", color: "#92400e" }}>You have unsaved changes.</div>}
      {showAdd && FormCard()}
      <div className="rounded-xl overflow-hidden" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-subtle)", boxShadow: "var(--shadow-card)" }}>
        <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: "1px solid var(--border-subtle)", backgroundColor: "var(--bg-surface-2)" }}>
          <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Project Stages
            <span className="ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ backgroundColor: "var(--bg-input)", color: "var(--text-muted)" }}>{stages.length}</span>
          </p>
          {!showAdd && <button onClick={startAdd} className="flex items-center justify-center w-7 h-7 rounded-lg text-white hover:bg-indigo-700" style={{ backgroundColor: "#4f46e5" }}><Plus className="w-4 h-4" /></button>}
        </div>
        {sorted.map((s, i) => (
          editingId === s.id ? (
            <div key={s.id} className="p-4" style={{ borderBottom: i < sorted.length - 1 ? "1px solid var(--border-subtle)" : "none" }}>{FormCard()}</div>
          ) : (
            <div key={s.id} className="grid px-4 py-3 items-center hover:bg-[var(--bg-surface-2)]" style={{ gridTemplateColumns: "auto 2fr 1.5fr 1fr 1fr auto", gap: "1rem", borderBottom: i < sorted.length - 1 ? "1px solid var(--border-subtle)" : "none", opacity: s.active ? 1 : 0.5 }}>
              <div className="flex flex-col">
                <button onClick={() => move(s.id, -1)} disabled={i === 0} className="disabled:opacity-20" style={{ color: "var(--text-muted)" }}><ChevronUp className="w-3.5 h-3.5" /></button>
                <button onClick={() => move(s.id, 1)} disabled={i === sorted.length - 1} className="disabled:opacity-20" style={{ color: "var(--text-muted)" }}><ChevronDown className="w-3.5 h-3.5" /></button>
              </div>
              <div className="flex items-center gap-2.5 min-w-0"><div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: s.color }} /><span className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>{s.name}</span></div>
              <span className="text-xs font-mono truncate" style={{ color: "var(--text-muted)" }}>{s.key}</span>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full inline-block w-fit" style={CATEGORY_BADGE[s.category]}>{CATEGORY_LABELS[s.category]}</span>
              <div className="flex justify-center"><Toggle on={s.active} onChange={() => { setStages(prev => prev.map(x => x.id === s.id ? { ...x, active: !x.active } : x)); setSaved(false); }} /></div>
              <div className="flex items-center gap-1 justify-end">
                <button onClick={() => startEdit(s)} className="p-1.5 rounded-lg hover:bg-[var(--bg-input)]" style={{ color: "var(--text-muted)" }}><Pencil className="w-3.5 h-3.5" /></button>
                <button onClick={() => { setStages(prev => prev.filter(x => x.id !== s.id)); setSaved(false); }} className="p-1.5 rounded-lg hover:bg-red-50" style={{ color: "#9ca3af" }}><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
            </div>
          )
        ))}
      </div>
    </div>
  );
}

// ─── Types ────────────────────────────────────────────────
function TypesEditor() {
  const scoped = useScopedSetting<ProjectTypeOption[]>(PROJECT_TYPES_KEY, DEFAULT_PROJECT_TYPES);
  const [types, setTypes] = useState<ProjectTypeOption[]>(DEFAULT_PROJECT_TYPES);
  const [newName, setNewName] = useState("");
  const [saved, setSaved] = useState(false);
  const [baseline, setBaseline] = useState(() => JSON.stringify(DEFAULT_PROJECT_TYPES));

  useEffect(() => { setTypes(scoped.value); setBaseline(JSON.stringify(scoped.value)); }, [scoped.value]);
  const dirty = JSON.stringify(types) !== baseline;

  function add() {
    const name = newName.trim(); if (!name) return;
    setTypes(prev => [...prev, { key: slugify(name), label: name, active: true }]); setNewName(""); setSaved(false);
  }
  function handleSave() { scoped.save(types); setBaseline(JSON.stringify(types)); setSaved(true); setTimeout(() => setSaved(false), 2000); }
  useRegisterSaveAction({ dirty, saved, onSave: handleSave });

  return (
    <div className="space-y-4">
      <InheritanceChip source={scoped.source} isOverride={scoped.isOverride} parentSource={scoped.parentSource} onOverride={scoped.override} onReset={scoped.reset} />
      {dirty && <div className="rounded-lg px-3 py-2 text-xs" style={{ backgroundColor: "#fef3c7", color: "#92400e" }}>You have unsaved changes.</div>}
      <div className="flex items-center gap-2">
        <input value={newName} onChange={e => setNewName(e.target.value)} onKeyDown={e => { if (e.key === "Enter") add(); }} placeholder="New project type…" className={inputCls} style={inputStyle} />
        <button onClick={add} disabled={!newName.trim()} className="px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-40 shrink-0" style={{ backgroundColor: "#4f46e5" }}>Add</button>
      </div>
      <div className="rounded-xl overflow-hidden" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-subtle)", boxShadow: "var(--shadow-card)" }}>
        {types.map((t, i) => (
          <div key={t.key} className="flex items-center justify-between px-4 py-2.5" style={{ borderBottom: i < types.length - 1 ? "1px solid var(--border-subtle)" : "none", opacity: t.active ? 1 : 0.5 }}>
            <div className="min-w-0">
              <input value={t.label} onChange={e => { setTypes(prev => prev.map(x => x.key === t.key ? { ...x, label: e.target.value } : x)); setSaved(false); }}
                className="text-sm font-medium bg-transparent outline-none" style={{ color: "var(--text-primary)" }} />
              <span className="block text-[10px] font-mono" style={{ color: "var(--text-muted)" }}>{t.key}</span>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <Toggle on={t.active} onChange={v => { setTypes(prev => prev.map(x => x.key === t.key ? { ...x, active: v } : x)); setSaved(false); }} />
              <button onClick={() => { setTypes(prev => prev.filter(x => x.key !== t.key)); setSaved(false); }} className="p-1.5 rounded-lg hover:bg-red-50" style={{ color: "#9ca3af" }}><Trash2 className="w-3.5 h-3.5" /></button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Defaults ─────────────────────────────────────────────
function DefaultsEditor() {
  const scoped = useScopedSetting<ProjectDefaults>(PROJECT_DEFAULTS_KEY, DEFAULT_PROJECT_DEFAULTS);
  const typesScoped = useScopedSetting<ProjectTypeOption[]>(PROJECT_TYPES_KEY, DEFAULT_PROJECT_TYPES);
  const [d, setD] = useState<ProjectDefaults>(DEFAULT_PROJECT_DEFAULTS);
  const [saved, setSaved] = useState(false);
  const [baseline, setBaseline] = useState(() => JSON.stringify(DEFAULT_PROJECT_DEFAULTS));

  useEffect(() => { setD(scoped.value); setBaseline(JSON.stringify(scoped.value)); }, [scoped.value]);
  const dirty = JSON.stringify(d) !== baseline;

  function handleSave() { scoped.save(d); setBaseline(JSON.stringify(d)); setSaved(true); setTimeout(() => setSaved(false), 2000); }
  useRegisterSaveAction({ dirty, saved, onSave: handleSave });

  const typeOpts = typesScoped.value.filter(t => t.active).map(t => ({ value: t.key, label: t.label }));

  return (
    <div className="space-y-4">
      <InheritanceChip source={scoped.source} isOverride={scoped.isOverride} parentSource={scoped.parentSource} onOverride={scoped.override} onReset={scoped.reset} />
      {dirty && <div className="rounded-lg px-3 py-2 text-xs" style={{ backgroundColor: "#fef3c7", color: "#92400e" }}>You have unsaved changes.</div>}
      <div className="rounded-xl p-5 space-y-4" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-subtle)", boxShadow: "var(--shadow-card)" }}>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Default Type</label>
            <UiSelect value={d.defaultTypeKey} onChange={v => { setD(p => ({ ...p, defaultTypeKey: v })); setSaved(false); }} options={typeOpts} />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Default Priority</label>
            <UiSelect value={d.defaultPriority} onChange={v => { setD(p => ({ ...p, defaultPriority: v as ProjectDefaults["defaultPriority"] })); setSaved(false); }}
              options={["low", "normal", "high", "urgent"].map(p => ({ value: p, label: p.charAt(0).toUpperCase() + p.slice(1) }))} />
          </div>
        </div>
        <div className="flex items-center justify-between py-2" style={{ borderTop: "1px solid var(--border-subtle)" }}>
          <div>
            <span className="text-sm" style={{ color: "var(--text-primary)" }}>Show budget fields</span>
            <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>Estimated vs. actual value and cost on projects.</p>
          </div>
          <Toggle on={d.showBudget} onChange={v => { setD(p => ({ ...p, showBudget: v })); setSaved(false); }} />
        </div>
      </div>
    </div>
  );
}
