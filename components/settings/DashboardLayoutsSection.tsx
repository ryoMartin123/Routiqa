"use client";

// ─── Settings → Dashboard Layouts ─────────────────────────
// Save the current dashboard arrangement as a reusable layout template, then
// apply it back any time (e.g. a different layout per scope). Import/export as
// JSON. The widgets themselves come from the dashboard / widget builder — this
// manages the whole arrangement.

import { useMemo, useRef, useState } from "react";
import { LayoutDashboard, Upload, Copy, Trash2, Check, Pencil, Plus, X, Wand2, LineChart } from "lucide-react";
import type { LayoutItem as RGLItem } from "react-grid-layout";
import { useDataVersion } from "@/lib/sync/useDataVersion";
import { useHierarchy } from "@/components/providers/HierarchyProvider";
import DashboardGrid from "@/components/dashboard/DashboardGrid";
import {
  getTemplates, saveCurrentAsTemplate, createTemplate, updateTemplate, applyTemplateHere, duplicateTemplate, deleteTemplate, renameTemplate,
  importJSON, applyTemplateToScope, setScopeDefault, scopesForTemplate,
  type DashboardTemplate,
} from "@/lib/dashboard/templates";
import { scopeKeyOf, nextFreeY, type LayoutItem } from "@/lib/dashboard/layouts";
import { resolveWidgetDef, REPORT_WIDGET_PREFIX, type ContextLevel } from "@/lib/dashboard/registry";
import { getReport, getReports } from "@/lib/analytics/store";

const ACCENT = "#4f46e5";
function widgetLabel(id: string): string {
  if (id.startsWith("report:")) return getReport(id.slice(7))?.name ?? "Report";
  return resolveWidgetDef(id)?.title ?? id;
}
function widgetWidth(id: string): number {
  const d = resolveWidgetDef(id);
  return d?.defaultSize === "full" ? 12 : d?.defaultSize === "wide" ? 8 : 4;
}

export default function DashboardLayoutsSection() {
  const rev = useDataVersion();
  const templates = useMemo(() => getTemplates(), [rev]);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [applied, setApplied] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameText, setRenameText] = useState("");
  const [importErr, setImportErr] = useState<string | null>(null);
  const [builder, setBuilder] = useState<{ template: DashboardTemplate | null } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const { allCompanies, allLocations, effectiveCompanyId, effectiveLocationId, activeScopeLabel } = useHierarchy();
  const currentScopeKey = scopeKeyOf(effectiveCompanyId, effectiveLocationId);
  const scopeOptions = useMemo(() => [
    { key: "org", label: "Org-wide" },
    ...allCompanies.map(c => ({ key: `company:${c.id}`, label: c.name })),
    ...allLocations.map(l => ({ key: `location:${l.id}`, label: `↳ ${l.name}` })),
  ], [allCompanies, allLocations]);
  const scopeLabel = (key: string): string =>
    key === "org" ? "Org-wide"
      : key.startsWith("company:") ? (allCompanies.find(c => c.id === key.slice(8))?.name ?? "Company")
      : key.startsWith("location:") ? (allLocations.find(l => l.id === key.slice(9))?.name ?? "Location")
      : key;

  const saveCurrent = () => { saveCurrentAsTemplate(newName || "My dashboard layout"); setNewName(""); setCreating(false); };
  const apply = (id: string) => { applyTemplateHere(id, currentScopeKey); setApplied(id); setTimeout(() => setApplied(a => (a === id ? null : a)), 2200); };
  const onImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; e.target.value = "";
    if (!f) return;
    const res = importJSON(await f.text(), f.name.replace(/\.json$/i, ""));
    setImportErr("error" in res ? res.error : null);
  };
  const commitRename = (id: string) => { renameTemplate(id, renameText); setRenaming(null); };

  return (
    <div className="space-y-4">
      {/* Header + actions */}
      <div className="rounded-xl p-4 flex flex-wrap items-center gap-3" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)" }}>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Dashboard layout templates</p>
          <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>Save, build, or import a dashboard layout, then apply it. <b style={{ color: "var(--text-secondary)" }}>Apply</b> targets your current scope ({activeScopeLabel}); set a per-scope default to auto-load one when you switch.</p>
        </div>
        <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={onImportFile} />
        <button onClick={() => fileRef.current?.click()} className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg" style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}><Upload className="w-3.5 h-3.5" /> Import</button>
        <button onClick={() => setBuilder({ template: null })} className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg" style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}><Wand2 className="w-3.5 h-3.5" /> Create layout</button>
        <button onClick={() => setCreating(c => !c)} className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg text-white" style={{ backgroundColor: ACCENT }}><Plus className="w-3.5 h-3.5" /> Save current dashboard</button>
      </div>

      {creating && (
        <div className="rounded-xl p-3 flex items-center gap-2" style={{ backgroundColor: "var(--accent-soft-bg)", border: "1px solid var(--accent-soft-border)" }}>
          <input autoFocus value={newName} onChange={e => setNewName(e.target.value)} onKeyDown={e => e.key === "Enter" && saveCurrent()} placeholder="Layout name (e.g. Owner overview, Location dispatch…)"
            className="flex-1 rounded-lg px-2.5 py-1.5 text-sm outline-none" style={{ border: "1px solid var(--border)", backgroundColor: "var(--bg-surface)", color: "var(--text-primary)" }} />
          <button onClick={saveCurrent} className="text-xs font-semibold px-3 py-1.5 rounded-lg text-white" style={{ backgroundColor: ACCENT }}>Save</button>
          <button onClick={() => { setCreating(false); setNewName(""); }} className="text-xs px-2 py-1.5" style={{ color: "var(--text-muted)" }}>Cancel</button>
        </div>
      )}
      {importErr && <p className="text-xs px-1" style={{ color: "#dc2626" }}>{importErr}</p>}

      {/* Templates */}
      {templates.length === 0 ? (
        <div className="rounded-xl p-10 text-center" style={{ border: "1px dashed var(--border)", backgroundColor: "var(--bg-surface)" }}>
          <LayoutDashboard className="w-6 h-6 mx-auto mb-2" style={{ color: "var(--text-muted)" }} />
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>No layout templates yet.</p>
          <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>Build a dashboard, then &ldquo;Save current dashboard&rdquo; to reuse it later.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {templates.map(t => {
            const vis = t.items.filter(i => i.visible);
            return (
              <div key={t.id} className="rounded-xl p-3" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)" }}>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="min-w-0">
                    {renaming === t.id ? (
                      <input autoFocus value={renameText} onChange={e => setRenameText(e.target.value)}
                        onKeyDown={e => e.key === "Enter" && commitRename(t.id)} onBlur={() => commitRename(t.id)}
                        className="text-sm font-semibold rounded px-1.5 py-0.5 outline-none w-full" style={{ border: "1px solid var(--border)", backgroundColor: "var(--bg-surface-2)", color: "var(--text-primary)" }} />
                    ) : (
                      <p className="text-sm font-semibold truncate flex items-center gap-1.5" style={{ color: "var(--text-primary)" }}>
                        {t.name}
                        <button onClick={() => { setRenaming(t.id); setRenameText(t.name); }} title="Rename"><Pencil className="w-3 h-3" style={{ color: "var(--text-muted)" }} /></button>
                      </p>
                    )}
                    <p className="text-[11px] mt-0.5" style={{ color: "var(--text-muted)" }}>{vis.length} widget{vis.length === 1 ? "" : "s"} · {new Date(t.createdAt).toLocaleDateString()}</p>
                  </div>
                  <button onClick={() => apply(t.id)} className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-lg text-white shrink-0" style={{ backgroundColor: applied === t.id ? "#16a34a" : ACCENT }}>
                    {applied === t.id ? <><Check className="w-3.5 h-3.5" /> Applied</> : "Apply"}
                  </button>
                </div>
                <LayoutPreview items={t.items} />
                <div className="flex flex-wrap gap-1 mt-2">
                  {vis.slice(0, 4).map((i, idx) => <span key={`${i.widgetId}-${idx}`} className="text-[9px] px-1.5 py-0.5 rounded truncate max-w-[130px]" style={{ backgroundColor: "var(--bg-surface-2)", color: "var(--text-muted)" }}>{widgetLabel(i.widgetId)}</span>)}
                  {vis.length > 4 && <span className="text-[9px] px-1.5 py-0.5" style={{ color: "var(--text-muted)" }}>+{vis.length - 4}</span>}
                </div>
                <div className="flex items-center gap-1 mt-2 pt-2" style={{ borderTop: "1px solid var(--border)" }}>
                  <IconAction icon={Wand2} label="Edit" onClick={() => setBuilder({ template: t })} />
                  <IconAction icon={Copy} label="Duplicate" onClick={() => duplicateTemplate(t.id)} />
                  <IconAction icon={Trash2} label="Delete" danger onClick={() => { if (confirm(`Delete “${t.name}”?`)) deleteTemplate(t.id); }} />
                </div>
                {/* Auto-apply this layout when the dashboard is on a given scope. */}
                <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                  <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Default for:</span>
                  {scopesForTemplate(t.id).map(sk => (
                    <span key={sk} className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full" style={{ backgroundColor: "var(--accent-soft-bg)", color: "var(--accent-text)" }}>
                      {scopeLabel(sk)}<button onClick={() => setScopeDefault(sk, null)} title="Remove"><X className="w-2.5 h-2.5" /></button>
                    </span>
                  ))}
                  {scopesForTemplate(t.id).length === 0 && <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>none</span>}
                  <select value="" onChange={e => { if (e.target.value) applyTemplateToScope(t.id, e.target.value); }}
                    className="text-[10px] rounded-md px-1 py-0.5 outline-none cursor-pointer" style={{ border: "1px solid var(--border)", backgroundColor: "var(--bg-surface)", color: "var(--text-secondary)" }}>
                    <option value="">+ scope…</option>
                    {scopeOptions.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
                  </select>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {builder && <LayoutBuilderModal template={builder.template} onClose={() => setBuilder(null)} />}
    </div>
  );
}

// ── Create-a-layout builder — the real customize experience (live drag/resize/
// drop of actual widgets), saved as a template instead of onto the dashboard. ──
const BUILDER_CTX: ContextLevel = "org";

function LayoutBuilderModal({ template, onClose }: { template: DashboardTemplate | null; onClose: () => void }) {
  const [name, setName] = useState(template?.name ?? "");
  const [draft, setDraft] = useState<LayoutItem[]>(() => (template ? template.items.map(i => ({ ...i })) : []));
  const [dragWidget, setDragWidget] = useState<{ id: string; w: number; h: number } | null>(null);

  const contextVisible = useMemo(
    () => draft.filter(i => i.visible && (resolveWidgetDef(i.widgetId)?.allowedContexts.includes(BUILDER_CTX) ?? false)),
    [draft],
  );
  const palette = useMemo(() => {
    const present = new Set(draft.filter(i => i.visible).map(i => i.widgetId));
    return getReports().filter(r => !present.has(REPORT_WIDGET_PREFIX + r.id)).map(r => ({ id: r.id, name: r.name, sub: `${r.viz} · ${r.source}` }));
  }, [draft]);

  // Same handlers as the dashboard's customize mode.
  const handleLayoutChange = (nl: readonly RGLItem[]) => setDraft(prev => {
    let changed = false;
    const next = prev.map(item => {
      const u = nl.find(l => l.i === item.widgetId);
      if (!u || (u.x === item.x && u.y === item.y && u.w === item.w && u.h === item.h)) return item;
      changed = true;
      return { ...item, x: u.x, y: u.y, w: u.w, h: u.h };
    });
    return changed ? next : prev;
  });
  const removeWidget = (id: string) => setDraft(prev => prev.filter(i => i.widgetId !== id));
  const addWidget = (id: string) => {
    const y = nextFreeY(contextVisible);
    setDraft(prev => prev.some(i => i.widgetId === id)
      ? prev.map(i => (i.widgetId === id ? { ...i, visible: true, x: 0, y, w: widgetWidth(id), h: i.h } : i))
      : [...prev, { widgetId: id, visible: true, order: prev.length + 1, x: 0, y, w: widgetWidth(id), h: 6, minW: 3, minH: 3 }]);
  };
  const handleDropWidget = (x: number, y: number) => {
    if (!dragWidget) return;
    const { id, w, h } = dragWidget;
    setDraft(prev => prev.some(i => i.widgetId === id)
      ? prev.map(i => (i.widgetId === id ? { ...i, visible: true, x, y, w } : i))
      : [...prev, { widgetId: id, visible: true, order: prev.length + 1, x, y, w, h, minW: 3, minH: 3 }]);
    setDragWidget(null);
  };
  const onDragStart = (id: string) => { const item = draft.find(i => i.widgetId === id); setDragWidget({ id, w: widgetWidth(id), h: item?.h ?? 6 }); };
  const save = () => {
    if (!contextVisible.length) return;
    if (template) updateTemplate(template.id, { name, items: draft });
    else createTemplate(name || "New layout", draft);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-6xl h-[88vh] flex flex-col rounded-2xl overflow-hidden" onClick={e => e.stopPropagation()} style={{ backgroundColor: "var(--bg-surface)", boxShadow: "0 24px 64px rgba(0,0,0,0.4)" }}>
        {/* Header */}
        <div className="flex items-center gap-2 px-5 py-4 shrink-0" style={{ borderBottom: "1px solid var(--border)" }}>
          <Wand2 className="w-4 h-4 shrink-0" style={{ color: ACCENT }} />
          <input autoFocus value={name} onChange={e => setName(e.target.value)} placeholder="New layout name…" className="flex-1 text-sm font-semibold outline-none bg-transparent min-w-0" style={{ color: "var(--text-primary)" }} />
          <span className="text-[11px] hidden md:block" style={{ color: "var(--text-muted)" }}>Click or drag to add · drag the handle to move · resize from the corner</span>
          <button onClick={onClose} className="w-7 h-7 rounded-md flex items-center justify-center hover:bg-[var(--bg-surface-2)] shrink-0" style={{ color: "var(--text-muted)" }}><X className="w-4 h-4" /></button>
        </div>
        {/* Body: palette + live grid */}
        <div className="flex-1 min-h-0 flex">
          <div className="w-60 shrink-0 overflow-y-auto p-3 space-y-1.5" style={{ borderRight: "1px solid var(--border)" }}>
            <p className="text-[10px] font-semibold uppercase tracking-wider px-1 mb-1" style={{ color: "var(--text-muted)" }}>Widgets</p>
            {palette.length === 0 && <p className="text-xs px-1 py-2" style={{ color: "var(--text-muted)" }}>All report widgets are on the board.</p>}
            {palette.map(r => (
              <button key={r.id} onClick={() => addWidget(REPORT_WIDGET_PREFIX + r.id)} draggable
                onDragStart={e => { onDragStart(REPORT_WIDGET_PREFIX + r.id); e.dataTransfer.effectAllowed = "copy"; e.dataTransfer.setData("text/plain", REPORT_WIDGET_PREFIX + r.id); }}
                onDragEnd={() => setDragWidget(null)}
                className="w-full flex items-start gap-2 text-left p-2.5 rounded-lg transition-all hover:shadow-sm cursor-grab active:cursor-grabbing" style={{ backgroundColor: "var(--bg-surface-2)", border: "1px solid var(--border)" }}>
                <div className="w-6 h-6 rounded-md flex items-center justify-center shrink-0 mt-0.5" style={{ backgroundColor: "var(--accent-soft-2-bg)" }}><LineChart className="w-3 h-3" style={{ color: "var(--accent-text)" }} /></div>
                <div className="min-w-0"><p className="text-xs font-semibold truncate" style={{ color: "var(--text-primary)" }}>{r.name}</p><p className="text-[10px] truncate capitalize" style={{ color: "var(--text-muted)" }}>{r.sub}</p></div>
              </button>
            ))}
          </div>
          <div className="flex-1 min-w-0 overflow-y-auto p-4 relative" style={{ backgroundColor: "var(--bg-page)" }}
            onDragOver={contextVisible.length === 0 ? (e => e.preventDefault()) : undefined}
            onDrop={contextVisible.length === 0 ? (e => { e.preventDefault(); handleDropWidget(0, 0); }) : undefined}>
            {contextVisible.length === 0 && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-center pointer-events-none px-6" style={{ color: "var(--text-muted)" }}>
                <LayoutDashboard className="w-7 h-7" />
                <p className="text-sm">Click or drag a widget from the left onto the board to start.</p>
              </div>
            )}
            {/* Grid stays mounted even when empty so the first widget can be dropped. */}
            <DashboardGrid contextVisible={contextVisible} customizing onLayoutChange={handleLayoutChange} onHideWidget={removeWidget}
              dragSize={dragWidget ? { w: dragWidget.w, h: dragWidget.h } : null} onDropWidget={handleDropWidget} />
          </div>
        </div>
        {/* Footer */}
        <div className="flex items-center justify-between gap-2 px-5 py-3 shrink-0" style={{ borderTop: "1px solid var(--border)" }}>
          <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>{contextVisible.length} widget{contextVisible.length === 1 ? "" : "s"}</span>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="text-sm font-medium px-3 py-2 rounded-lg" style={{ color: "var(--text-secondary)" }}>Cancel</button>
            <button onClick={save} disabled={!contextVisible.length} className="text-sm font-semibold px-4 py-2 rounded-lg text-white disabled:opacity-40" style={{ backgroundColor: ACCENT }}>{template ? "Save changes" : "Save layout"}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function LayoutPreview({ items }: { items: { widgetId: string; visible: boolean; x: number; y: number; w: number; h: number }[] }) {
  const vis = items.filter(i => i.visible);
  const rows = Math.max(1, ...vis.map(i => i.y + i.h));
  return (
    <div className="relative rounded-lg overflow-hidden" style={{ height: 96, backgroundColor: "var(--bg-surface-2)", border: "1px solid var(--border)" }}>
      {vis.map((i, idx) => (
        <div key={idx} className="absolute" style={{ left: `${(i.x / 12) * 100}%`, width: `${(i.w / 12) * 100}%`, top: `${(i.y / rows) * 100}%`, height: `${(i.h / rows) * 100}%`, padding: 2 }}>
          <div className="w-full h-full rounded" style={{ backgroundColor: "var(--accent-soft-2-bg)", border: "1px solid var(--accent-soft-border)" }} />
        </div>
      ))}
    </div>
  );
}

function IconAction({ icon: Icon, label, onClick, danger }: { icon: typeof Copy; label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button onClick={onClick} className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-md hover:bg-[var(--bg-surface-2)]" style={{ color: danger ? "#dc2626" : "var(--text-secondary)" }}>
      <Icon className="w-3 h-3" /> {label}
    </button>
  );
}
