"use client";

// ─── Settings · Projects · Maps ───────────────────────────
// Customize the project Map TEMPLATES — the connected workflows instantiated for
// a project by type. Lists built-in + custom maps with a live preview, and a full
// step editor (title, group, type, manual-or-mirrored record, assignee, deps)
// with a preview that updates as you build. Persisted via the scoped settings
// store; the project Map + new-project wizard read these.

import { useEffect, useMemo, useState } from "react";
import {
  Plus, Pencil, Trash2, Copy, ChevronUp, ChevronDown, ArrowLeft, X,
  Layers, Flag, Briefcase, CheckSquare, ClipboardList, Package, ShoppingCart, HardHat, FileText, Receipt,
} from "lucide-react";
import UiSelect from "@/components/ui/Select";
import { useScopedSetting } from "@/lib/settings-scope/useScopedSetting";
import InheritanceChip from "@/components/settings/InheritanceChip";
import { useRegisterSaveAction } from "@/components/settings/SettingsActions";
import {
  DEFAULT_MAP_TEMPLATES, MAP_TEMPLATES_KEY, newMapTemplateId, newMapNodeKey,
  type MapTemplate, type TemplateNode, type MirrorSource,
} from "@/lib/projects/map-templates";
import { NODE_TYPE_LABEL, type MapNodeType } from "@/lib/projects/map";
import { PROJECT_TYPES_KEY, DEFAULT_PROJECT_TYPES, type ProjectTypeOption } from "@/lib/projects/settings";

const ACCENT = "#4f46e5";
const TYPE_ICON: Record<MapNodeType, typeof Layers> = {
  phase: Layers, milestone: Flag, job: Briefcase, task: CheckSquare, work_order: ClipboardList,
  material_request: Package, purchase_order: ShoppingCart, subcontractor: HardHat, document: FileText, billing: Receipt,
};
const NODE_TYPES = Object.keys(NODE_TYPE_LABEL) as MapNodeType[];
const MIRROR_LABEL: Record<MirrorSource, string> = {
  quote: "Quote", job: "Job", work_order: "Work Order", material_request: "Material Request",
  purchase_order: "Purchase Order", equipment_received: "Equipment Received", subcontractor: "Subcontractor", invoice: "Invoice",
};
const MIRROR_SOURCES = Object.keys(MIRROR_LABEL) as MirrorSource[];
const SOURCE_OPTS = [{ value: "manual", label: "Manual step" }, ...MIRROR_SOURCES.map(s => ({ value: s, label: `Mirror → ${MIRROR_LABEL[s]}` }))];

const inputCls = "w-full rounded-lg px-3 py-2 text-sm outline-none";
const inputStyle = { border: "1px solid var(--border)", backgroundColor: "var(--bg-surface)", color: "var(--text-primary)" } as const;
const initials = (n?: string) => { if (!n) return ""; const p = n.trim().split(/\s+/); return (p.length >= 2 ? p[0][0] + p[p.length - 1][0] : n.slice(0, 2)).toUpperCase(); };
const clone = (t: MapTemplate): MapTemplate => JSON.parse(JSON.stringify(t));
const isBuiltIn = (id: string) => DEFAULT_MAP_TEMPLATES.some(t => t.id === id);

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!on)} role="switch" aria-checked={on} type="button"
      className="relative w-8 h-4 rounded-full transition-colors shrink-0"
      style={{ backgroundColor: on ? ACCENT : "var(--bg-input)", border: "1px solid var(--border)" }}>
      <span className="absolute top-0.5 left-0.5 w-3 h-3 rounded-full bg-white shadow transition-transform"
        style={{ transform: on ? "translateX(16px)" : "translateX(0)" }} />
    </button>
  );
}

// ─── Live preview — grouped node columns (mirrors the Project Map) ──
function MapPreview({ template, compact }: { template: MapTemplate; compact?: boolean }) {
  // Any node whose group isn't in the ordered groups list falls into "Other" so
  // nothing is ever hidden from the preview.
  const groups = [...template.groups];
  const extra = template.nodes.filter(n => !groups.includes(n.group));
  const cols = [...groups, ...(extra.length ? ["Other"] : [])];
  return (
    <div className="flex gap-1.5 overflow-x-auto thin-scroll-x pb-1">
      {cols.map((g, gi) => {
        const nodes = template.nodes.filter(n => (g === "Other" ? !template.groups.includes(n.group) : n.group === g));
        return (
          <div key={g} className="shrink-0" style={{ width: compact ? 132 : 152 }}>
            <div className="flex items-center justify-between mb-1 px-0.5">
              <p className="text-[9px] font-semibold uppercase tracking-wider truncate" style={{ color: "var(--text-muted)" }}>{g}</p>
              <span className="text-[9px]" style={{ color: "var(--text-muted)" }}>{nodes.length}</span>
            </div>
            <div className="space-y-1">
              {nodes.map(n => {
                const Icon = TYPE_ICON[n.type] ?? CheckSquare;
                return (
                  <div key={n.key} className="rounded-md px-1.5 py-1" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-subtle)" }}>
                    <div className="flex items-center gap-1">
                      <Icon className="w-3 h-3 shrink-0" style={{ color: ACCENT }} />
                      <span className="text-[10px] font-medium leading-tight truncate" style={{ color: "var(--text-primary)" }}>{n.title}</span>
                    </div>
                    <div className="flex items-center gap-1 mt-0.5">
                      <span className="text-[8px] px-1 rounded" style={{ backgroundColor: "var(--bg-input)", color: "var(--text-muted)" }}>{n.manual ? "Manual" : MIRROR_LABEL[n.mirror as MirrorSource] ?? NODE_TYPE_LABEL[n.type]}</span>
                      {n.assignedTo && <span className="text-[8px] truncate" style={{ color: "var(--text-muted)" }}>· {initials(n.assignedTo)}</span>}
                    </div>
                  </div>
                );
              })}
              {nodes.length === 0 && <p className="text-[9px] px-1 py-2 text-center" style={{ color: "var(--text-muted)" }}>—</p>}
            </div>
            {gi < cols.length - 1 && null}
          </div>
        );
      })}
    </div>
  );
}

// ─── Main editor ──────────────────────────────────────────
export default function ProjectMapsEditor() {
  const scoped = useScopedSetting<MapTemplate[]>(MAP_TEMPLATES_KEY, DEFAULT_MAP_TEMPLATES);
  const typesScoped = useScopedSetting<ProjectTypeOption[]>(PROJECT_TYPES_KEY, DEFAULT_PROJECT_TYPES);
  const [templates, setTemplates] = useState<MapTemplate[]>(DEFAULT_MAP_TEMPLATES);
  const [baseline, setBaseline] = useState(() => JSON.stringify(DEFAULT_MAP_TEMPLATES));
  const [saved, setSaved] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<MapTemplate | null>(null);   // null ⇒ editing a freshly-added template

  useEffect(() => {
    setTemplates(scoped.value); setBaseline(JSON.stringify(scoped.value)); setEditingId(null); setSnapshot(null);
  }, [scoped.value]);

  const dirty = JSON.stringify(templates) !== baseline;
  function handleSave() { scoped.save(templates); setBaseline(JSON.stringify(templates)); setSaved(true); setTimeout(() => setSaved(false), 2000); }
  useRegisterSaveAction({ dirty, saved, onSave: handleSave });

  const draft = editingId ? templates.find(t => t.id === editingId) ?? null : null;
  const typeOpts = typesScoped.value.filter(t => t.active);

  // ── List-level actions ──
  function startNew() {
    const t: MapTemplate = {
      id: newMapTemplateId(), name: "New Map", projectTypes: [], groups: ["Planning", "Work", "Closeout"],
      nodes: [{ key: "created", title: "Project Created", type: "milestone", group: "Planning", manual: true, deps: [] }],
    };
    setTemplates(prev => [...prev, t]); setSnapshot(null); setEditingId(t.id); setSaved(false);
  }
  function startEdit(t: MapTemplate) { setSnapshot(clone(t)); setEditingId(t.id); }
  function duplicate(t: MapTemplate) {
    const copy = clone(t); copy.id = newMapTemplateId(); copy.name = `${t.name} (Copy)`; copy.projectTypes = [];
    setTemplates(prev => [...prev, copy]); setSaved(false);
  }
  function removeTemplate(id: string) { setTemplates(prev => prev.filter(t => t.id !== id)); setSaved(false); }
  function doneEditing() { setEditingId(null); setSnapshot(null); }
  function cancelEditing() {
    if (snapshot) setTemplates(prev => prev.map(t => t.id === snapshot.id ? snapshot : t));
    else if (editingId) setTemplates(prev => prev.filter(t => t.id !== editingId));   // discard the new one
    setEditingId(null); setSnapshot(null);
  }

  // ── Draft mutations (edit in place; preview/dirty stay live) ──
  function patch(p: Partial<MapTemplate>) { setTemplates(prev => prev.map(t => t.id === editingId ? { ...t, ...p } : t)); setSaved(false); }
  function patchNode(key: string, p: Partial<TemplateNode>) {
    if (!draft) return;
    patch({ nodes: draft.nodes.map(n => n.key === key ? { ...n, ...p } : n) });
  }
  function addNode() {
    if (!draft) return;
    patch({ nodes: [...draft.nodes, { key: newMapNodeKey(), title: "New Step", type: "task", group: draft.groups[0] ?? "Planning", manual: true, deps: [] }] });
  }
  function removeNode(key: string) {
    if (!draft) return;
    patch({ nodes: draft.nodes.filter(n => n.key !== key).map(n => ({ ...n, deps: n.deps.filter(d => d !== key) })) });
  }
  function moveNode(key: string, dir: -1 | 1) {
    if (!draft) return;
    const arr = [...draft.nodes]; const i = arr.findIndex(n => n.key === key); const j = i + dir;
    if (j < 0 || j >= arr.length) return;
    [arr[i], arr[j]] = [arr[j], arr[i]]; patch({ nodes: arr });
  }
  function setSource(key: string, value: string) {
    if (value === "manual") patchNode(key, { manual: true, mirror: undefined, createable: false });
    else patchNode(key, { manual: false, mirror: value as MirrorSource, createable: true });
  }
  function toggleDep(key: string, depKey: string) {
    if (!draft) return;
    const node = draft.nodes.find(n => n.key === key); if (!node) return;
    const has = node.deps.includes(depKey);
    patchNode(key, { deps: has ? node.deps.filter(d => d !== depKey) : [...node.deps, depKey] });
  }
  // Groups
  function addGroup(name: string) { if (!draft || !name.trim() || draft.groups.includes(name.trim())) return; patch({ groups: [...draft.groups, name.trim()] }); }
  function removeGroup(name: string) { if (!draft) return; patch({ groups: draft.groups.filter(g => g !== name) }); }
  function moveGroup(name: string, dir: -1 | 1) {
    if (!draft) return;
    const arr = [...draft.groups]; const i = arr.indexOf(name); const j = i + dir;
    if (j < 0 || j >= arr.length) return;
    [arr[i], arr[j]] = [arr[j], arr[i]]; patch({ groups: arr });
  }
  function toggleProjectType(key: string) {
    if (!draft) return;
    const has = (draft.projectTypes as string[]).includes(key);
    patch({ projectTypes: (has ? draft.projectTypes.filter(k => k !== key) : [...draft.projectTypes, key]) as MapTemplate["projectTypes"] });
  }

  // ── Editor view ──
  if (draft) return (
    <div className="space-y-4">
      <button onClick={cancelEditing} className="flex items-center gap-1.5 text-sm font-medium" style={{ color: "var(--text-secondary)" }}><ArrowLeft className="w-4 h-4" /> All maps</button>

      {/* Template meta */}
      <div className="rounded-xl p-4 space-y-3" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-subtle)", boxShadow: "var(--shadow-card)" }}>
        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Map name *</label>
          <input value={draft.name} onChange={e => patch({ name: e.target.value })} className={inputCls} style={inputStyle} placeholder="e.g. Roofing Replacement" />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>Applies to project types</label>
          <div className="flex flex-wrap gap-1.5">
            {typeOpts.map(t => {
              const on = (draft.projectTypes as string[]).includes(t.key);
              return (
                <button key={t.key} onClick={() => toggleProjectType(t.key)} className="text-xs font-medium px-2.5 py-1 rounded-full transition-colors"
                  style={{ backgroundColor: on ? "var(--accent-soft-bg)" : "var(--bg-input)", color: on ? "var(--accent-text)" : "var(--text-muted)", border: `1px solid ${on ? "var(--accent-soft-border)" : "transparent"}` }}>
                  {t.label}
                </button>
              );
            })}
          </div>
          <p className="text-[10px] mt-1.5" style={{ color: "var(--text-muted)" }}>A new project picks the first map matching its type.</p>
        </div>
        {/* Groups (columns) */}
        <div>
          <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>Groups <span style={{ color: "var(--text-muted)" }}>(workflow columns, in order)</span></label>
          <div className="flex flex-wrap items-center gap-1.5">
            {draft.groups.map((g, i) => (
              <span key={g} className="flex items-center gap-1 text-xs font-medium pl-2 pr-1 py-1 rounded-lg" style={{ backgroundColor: "var(--bg-input)", color: "var(--text-secondary)" }}>
                {g}
                <button onClick={() => moveGroup(g, -1)} disabled={i === 0} className="disabled:opacity-20" style={{ color: "var(--text-muted)" }}><ChevronUp className="w-3 h-3" /></button>
                <button onClick={() => moveGroup(g, 1)} disabled={i === draft.groups.length - 1} className="disabled:opacity-20" style={{ color: "var(--text-muted)" }}><ChevronDown className="w-3 h-3" /></button>
                <button onClick={() => removeGroup(g)} style={{ color: "var(--text-muted)" }}><X className="w-3 h-3" /></button>
              </span>
            ))}
            <AddGroupInput onAdd={addGroup} />
          </div>
        </div>
      </div>

      {/* Steps */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Steps <span className="text-xs font-normal" style={{ color: "var(--text-muted)" }}>({draft.nodes.length})</span></p>
          <button onClick={addNode} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-white" style={{ backgroundColor: ACCENT }}><Plus className="w-3.5 h-3.5" /> Add step</button>
        </div>
        {draft.nodes.map((n, i) => (
          <div key={n.key} className="rounded-xl p-3 space-y-2.5" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-subtle)", boxShadow: "var(--shadow-card)" }}>
            <div className="flex items-center gap-2">
              <div className="flex flex-col shrink-0">
                <button onClick={() => moveNode(n.key, -1)} disabled={i === 0} className="disabled:opacity-20" style={{ color: "var(--text-muted)" }}><ChevronUp className="w-3.5 h-3.5" /></button>
                <button onClick={() => moveNode(n.key, 1)} disabled={i === draft.nodes.length - 1} className="disabled:opacity-20" style={{ color: "var(--text-muted)" }}><ChevronDown className="w-3.5 h-3.5" /></button>
              </div>
              <input value={n.title} onChange={e => patchNode(n.key, { title: e.target.value })} className={inputCls} style={inputStyle} placeholder="Step title" />
              <button onClick={() => removeNode(n.key)} className="p-2 rounded-lg hover:bg-red-50 shrink-0" style={{ color: "#9ca3af" }}><Trash2 className="w-4 h-4" /></button>
            </div>
            <div className="grid grid-cols-2 gap-2 pl-7">
              <Field label="Group"><UiSelect size="sm" value={n.group} onChange={v => patchNode(n.key, { group: v })} options={draft.groups.map(g => ({ value: g, label: g }))} /></Field>
              <Field label="Type"><UiSelect size="sm" value={n.type} onChange={v => patchNode(n.key, { type: v as MapNodeType })} options={NODE_TYPES.map(t => ({ value: t, label: NODE_TYPE_LABEL[t] }))} /></Field>
              <Field label="Source"><UiSelect size="sm" value={n.manual ? "manual" : (n.mirror ?? "manual")} onChange={v => setSource(n.key, v)} options={SOURCE_OPTS} /></Field>
              <Field label="Assignee"><input value={n.assignedTo ?? ""} onChange={e => patchNode(n.key, { assignedTo: e.target.value || undefined })} className={`${inputCls} py-1.5`} style={inputStyle} placeholder="Unassigned" /></Field>
            </div>
            {!n.manual && (
              <label className="flex items-center gap-2 pl-7 cursor-pointer">
                <Toggle on={!!n.createable} onChange={v => patchNode(n.key, { createable: v })} />
                <span className="text-xs" style={{ color: "var(--text-secondary)" }}>Offer “Create &amp; link” when no record exists</span>
              </label>
            )}
            {draft.nodes.length > 1 && (
              <div className="pl-7">
                <p className="text-[10px] font-medium mb-1" style={{ color: "var(--text-muted)" }}>Needs first (dependencies)</p>
                <div className="flex flex-wrap gap-1.5">
                  {draft.nodes.filter(o => o.key !== n.key).map(o => {
                    const on = n.deps.includes(o.key);
                    return (
                      <button key={o.key} onClick={() => toggleDep(n.key, o.key)} className="text-[10px] px-2 py-0.5 rounded-full transition-colors"
                        style={{ backgroundColor: on ? "var(--accent-soft-bg)" : "var(--bg-input)", color: on ? "var(--accent-text)" : "var(--text-muted)", border: `1px solid ${on ? "var(--accent-soft-border)" : "transparent"}` }}>
                        {o.title}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Live preview */}
      <div className="rounded-xl p-4" style={{ backgroundColor: "var(--bg-surface-2)", border: "1px dashed var(--border)" }}>
        <p className="text-[10px] font-semibold uppercase tracking-widest mb-2" style={{ color: "var(--text-muted)" }}>Preview</p>
        <MapPreview template={draft} />
      </div>

      <div className="flex justify-end gap-2">
        <button onClick={cancelEditing} className="px-3 py-2 rounded-lg text-sm" style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}>Cancel</button>
        <button onClick={doneEditing} disabled={!draft.name.trim()} className="px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-40" style={{ backgroundColor: ACCENT }}>Done</button>
      </div>
      <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>“Done” keeps your changes in this editor — use the page’s <b>Save</b> to persist them.</p>
    </div>
  );

  // ── List view ──
  return (
    <div className="space-y-4">
      <InheritanceChip source={scoped.source} isOverride={scoped.isOverride} parentSource={scoped.parentSource} onOverride={scoped.override} onReset={scoped.reset} />
      {dirty && <div className="rounded-lg px-3 py-2 text-xs" style={{ backgroundColor: "#fef3c7", color: "#92400e" }}>You have unsaved changes.</div>}
      <div className="flex items-center justify-between">
        <p className="text-sm" style={{ color: "var(--text-secondary)" }}>Project Map templates drive each project’s connected workflow and the new-project wizard.</p>
        <button onClick={startNew} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-white shrink-0" style={{ backgroundColor: ACCENT }}><Plus className="w-3.5 h-3.5" /> New Map</button>
      </div>

      <div className="space-y-3">
        {templates.map(t => (
          <div key={t.id} className="rounded-xl overflow-hidden" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-subtle)", boxShadow: "var(--shadow-card)" }}>
            <div className="flex items-start justify-between gap-3 px-4 py-3" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{t.name}</p>
                  {isBuiltIn(t.id) && <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full" style={{ backgroundColor: "var(--bg-input)", color: "var(--text-muted)" }}>Built-in</span>}
                </div>
                <p className="text-[11px] mt-0.5" style={{ color: "var(--text-muted)" }}>
                  {t.nodes.length} steps · {t.groups.length} groups{t.projectTypes.length ? ` · ${t.projectTypes.join(", ")}` : " · no type assigned"}
                </p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button onClick={() => startEdit(t)} title="Edit" className="p-1.5 rounded-lg hover:bg-[var(--bg-input)]" style={{ color: "var(--text-muted)" }}><Pencil className="w-3.5 h-3.5" /></button>
                <button onClick={() => duplicate(t)} title="Duplicate" className="p-1.5 rounded-lg hover:bg-[var(--bg-input)]" style={{ color: "var(--text-muted)" }}><Copy className="w-3.5 h-3.5" /></button>
                {!isBuiltIn(t.id) && <button onClick={() => removeTemplate(t.id)} title="Delete" className="p-1.5 rounded-lg hover:bg-red-50" style={{ color: "#9ca3af" }}><Trash2 className="w-3.5 h-3.5" /></button>}
              </div>
            </div>
            <div className="p-3"><MapPreview template={t} compact /></div>
          </div>
        ))}
        {templates.length === 0 && <p className="text-sm text-center py-6" style={{ color: "var(--text-muted)" }}>No map templates yet.</p>}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="block text-[10px] font-medium mb-1" style={{ color: "var(--text-muted)" }}>{label}</label>{children}</div>;
}
function AddGroupInput({ onAdd }: { onAdd: (name: string) => void }) {
  const [v, setV] = useState("");
  function commit() { if (v.trim()) { onAdd(v); setV(""); } }
  return (
    <span className="flex items-center gap-1">
      <input value={v} onChange={e => setV(e.target.value)} onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); commit(); } }}
        placeholder="Add group…" className="text-xs rounded-lg px-2 py-1 outline-none" style={{ ...inputStyle, width: 110 }} />
      <button onClick={commit} disabled={!v.trim()} className="p-1 rounded-md disabled:opacity-30" style={{ color: ACCENT }}><Plus className="w-3.5 h-3.5" /></button>
    </span>
  );
}
