"use client";

import React, { useState, useMemo, useRef, useEffect } from "react";
import type { LayoutItem as RGLItem } from "react-grid-layout";
// The interactive widget grid (react-grid-layout + every widget) lives in its own
// file for organization, but is imported normally — the grid's drag/resize and
// container-width measurement need it mounted synchronously with the page.
import DashboardGrid from "@/components/dashboard/DashboardGrid";
import {
  Settings2, Save, X, RotateCcw,
  Plus, GripVertical, Info,
} from "lucide-react";

import { useHierarchy } from "@/components/providers/HierarchyProvider";
import {
  WIDGET_REGISTRY, WIDGET_MAP, CATEGORY_LABELS, CONTEXT_LABELS,
  getContextLevel, type WidgetCategory, type ContextLevel,
} from "@/lib/dashboard/registry";
import {
  DEFAULT_LAYOUT, loadLayout, saveLayout, nextFreeY,
  type LayoutItem as DashItem,
} from "@/lib/dashboard/layouts";

const GREET_DATE = "Friday, May 30";

// ─── Context badge ────────────────────────────────────────
const CTX_COLORS: Record<ContextLevel, { bg: string; color: string }> = {
  org:          { bg: "#ede9fe", color: "#5b21b6" },
  company:      { bg: "#e0e7ff", color: "#3730a3" },
  location:     { bg: "#dbeafe", color: "#1e40af" },
  service_area: { bg: "#d1fae5", color: "#065f46" },
};
// Shows as a small info icon; hovering reveals the context label pill.
function ContextBadge({ level }: { level: ContextLevel }) {
  const c = CTX_COLORS[level];
  return (
    <span className="relative inline-flex group/ctx">
      <Info className="w-4 h-4 cursor-help" style={{ color: c.color }} />
      <span className="pointer-events-none absolute left-1/2 -translate-x-1/2 top-full mt-1.5 z-30 whitespace-nowrap text-[10px] font-bold px-2 py-0.5 rounded-full opacity-0 group-hover/ctx:opacity-100 transition-opacity"
        style={{ backgroundColor: c.bg, color: c.color, boxShadow: "0 2px 8px rgba(0,0,0,0.14)" }}>
        {CONTEXT_LABELS[level]}
      </span>
    </span>
  );
}

// ─── Customize action dock ────────────────────────────────
// Defaults inline on the same row as the Dashboard title (pos === null).
// Grab the handle and it pops out into a free-floating bar (position:
// fixed) the user can drag anywhere; double-click the handle to re-dock.
type DockPos = { x: number; y: number } | null;

function EditDock({
  contextLevel, showAddPanel, pos, onPosChange,
  onToggleAdd, onSave, onCancel, onReset,
}: {
  contextLevel: ContextLevel;
  showAddPanel: boolean;
  pos:          DockPos;
  onPosChange:  (p: DockPos) => void;
  onToggleAdd:  () => void;
  onSave:       () => void;
  onCancel:     () => void;
  onReset:      () => void;
}) {
  const ref       = useRef<HTMLDivElement>(null);
  const dragOff   = useRef<{ dx: number; dy: number } | null>(null);
  const floating  = pos !== null;

  // Window-level listeners stay mounted; dragOff.current gates them so we
  // only reposition while an actual drag is in progress.
  useEffect(() => {
    function move(e: PointerEvent) {
      if (!dragOff.current) return;
      const w = ref.current?.offsetWidth  ?? 0;
      const h = ref.current?.offsetHeight ?? 0;
      const x = Math.max(8, Math.min(e.clientX - dragOff.current.dx, window.innerWidth  - w - 8));
      const y = Math.max(8, Math.min(e.clientY - dragOff.current.dy, window.innerHeight - h - 8));
      onPosChange({ x, y });
    }
    function up() {
      if (!dragOff.current) return;
      dragOff.current = null;
      document.body.style.userSelect = "";
    }
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup",   up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup",   up);
    };
  }, [onPosChange]);

  function startDrag(e: React.PointerEvent) {
    if (e.button !== 0) return;
    const rect = ref.current!.getBoundingClientRect();
    dragOff.current = { dx: e.clientX - rect.left, dy: e.clientY - rect.top };
    // Seed the position from the current rect so the inline→floating jump
    // is seamless (it stays exactly where it was when grabbed).
    onPosChange({ x: rect.left, y: rect.top });
    document.body.style.userSelect = "none";
  }

  return (
    <div ref={ref}
      className="dashboard-edit-dock flex items-center gap-1.5 sm:gap-2 pl-1.5 pr-2 py-2 rounded-2xl"
      style={{
        backgroundColor: "var(--bg-surface)",
        border:          "1px solid var(--accent-soft-border)",
        backdropFilter:  "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        boxShadow: floating
          ? "0 16px 48px -10px rgba(49,46,129,0.34), 0 4px 12px -2px rgba(0,0,0,0.14)"
          : "var(--shadow-card)",
        ...(floating
          ? { position: "fixed", left: pos!.x, top: pos!.y, zIndex: 50 }
          : {}),
      }}>

      {/* Drag handle + mode indicator */}
      <div
        onPointerDown={startDrag}
        onDoubleClick={() => onPosChange(null)}
        title={floating ? "Drag to move · double-click to re-dock" : "Drag to detach"}
        className="flex items-center gap-2 pl-1.5 pr-2 py-1 rounded-xl select-none cursor-grab active:cursor-grabbing">
        <GripVertical className="w-3.5 h-3.5" style={{ color: "var(--text-muted)" }} />
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
            style={{ backgroundColor: "var(--accent-icon)" }} />
          <span className="relative inline-flex rounded-full h-2 w-2"
            style={{ backgroundColor: "var(--accent-icon)" }} />
        </span>
        <span className="hidden md:inline text-sm font-semibold" style={{ color: "var(--accent-text-strong)" }}>Customize Mode</span>
        <ContextBadge level={contextLevel} />
      </div>

      <div className="w-px h-7" style={{ backgroundColor: "var(--border)" }} />

      {/* Actions */}
      <button onClick={onToggleAdd}
        className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-all"
        style={{
          backgroundColor: showAddPanel ? "var(--accent-text)" : "var(--accent-soft-bg)",
          color:           showAddPanel ? "#fff" : "var(--accent-text)",
        }}>
        <Plus className="w-3.5 h-3.5" /> Add Widget
      </button>

      <button onClick={onReset}
        className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs transition-colors hover:bg-[var(--bg-surface-2)]"
        style={{ color: "var(--text-secondary)" }}
        title="Reset to default layout">
        <RotateCcw className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Reset</span>
      </button>
      <button onClick={onCancel}
        className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs transition-colors hover:bg-[var(--bg-surface-2)]"
        style={{ color: "var(--text-secondary)" }}>
        <X className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Cancel</span>
      </button>
      <button onClick={onSave}
        className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-white transition-opacity hover:opacity-90"
        style={{ backgroundColor: "var(--accent-text)", boxShadow: "0 2px 8px -1px rgba(49,46,129,0.4)" }}>
        <Save className="w-3.5 h-3.5" /> Save Layout
      </button>
    </div>
  );
}

// ─── Add widgets drawer ───────────────────────────────────
// Slides in from the right and overlays the dashboard (no dimming
// backdrop) so the user can watch widgets drop into the grid live as
// they click them.
function AddWidgetsDrawer({
  hiddenIds, contextLevel, onAdd, onClose, onDragStartWidget, onDragEndWidget,
}: {
  hiddenIds: string[]; contextLevel: ContextLevel;
  onAdd: (id: string) => void; onClose: () => void;
  onDragStartWidget: (id: string) => void; onDragEndWidget: () => void;
}) {
  const available = WIDGET_REGISTRY.filter(
    w => hiddenIds.includes(w.id) && w.allowedContexts.includes(contextLevel)
  );
  const otherCtx = WIDGET_REGISTRY.filter(
    w => hiddenIds.includes(w.id) && !w.allowedContexts.includes(contextLevel)
  );

  const grouped = available.reduce<Partial<Record<WidgetCategory, typeof WIDGET_REGISTRY>>>((acc, w) => {
    if (!acc[w.category]) acc[w.category] = [];
    acc[w.category]!.push(w);
    return acc;
  }, {});

  return (
    <div className="dashboard-edit-drawer fixed top-0 right-0 bottom-0 z-50 w-full max-w-sm flex flex-col"
      style={{ backgroundColor: "var(--bg-surface)", borderLeft: "1px solid var(--border)", boxShadow: "-16px 0 48px -12px rgba(0,0,0,0.22)" }}>

      {/* Header */}
      <div className="flex items-center gap-2 px-5 py-4 shrink-0" style={{ borderBottom: "1px solid var(--border)" }}>
        <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
          style={{ backgroundColor: "var(--accent-soft-bg)" }}>
          <Plus className="w-4 h-4" style={{ color: "var(--accent-text)" }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Add Widgets</p>
            <ContextBadge level={contextLevel} />
          </div>
          <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>Drag onto the board, or click to add</p>
        </div>
        <button onClick={onClose}
          className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors hover:bg-[var(--bg-surface-2)]"
          style={{ color: "var(--text-secondary)" }} aria-label="Close">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto dashboard-widget-content p-4 space-y-4">
        {available.length === 0 && otherCtx.length === 0 ? (
          <div className="rounded-xl p-6 text-center" style={{ border: "1.5px dashed var(--border)", backgroundColor: "var(--bg-surface-2)" }}>
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>All widgets for this context are already visible.</p>
          </div>
        ) : available.length > 0 ? (
          (Object.entries(grouped) as [WidgetCategory, typeof WIDGET_REGISTRY][]).map(([cat, widgets]) => (
            <div key={cat}>
              <p className="text-[10px] font-semibold uppercase tracking-widest mb-2" style={{ color: "var(--accent-text)" }}>
                {CATEGORY_LABELS[cat]}
              </p>
              <div className="grid grid-cols-1 gap-2">
                {widgets.map(w => (
                  <button key={w.id}
                    onClick={() => onAdd(w.id)}
                    draggable
                    onDragStart={e => { onDragStartWidget(w.id); e.dataTransfer.effectAllowed = "copy"; e.dataTransfer.setData("text/plain", w.id); }}
                    onDragEnd={onDragEndWidget}
                    className="flex items-start gap-2.5 text-left p-3 rounded-xl transition-all hover:shadow-sm cursor-grab active:cursor-grabbing"
                    style={{ backgroundColor: "var(--bg-surface-2)", border: "1px solid var(--border-subtle)" }}>
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                      style={{ backgroundColor: "var(--accent-soft-2-bg)" }}>
                      <GripVertical className="w-3.5 h-3.5" style={{ color: "var(--accent-text)" }} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>{w.title}</p>
                      <p className="text-[10px] leading-snug mt-0.5" style={{ color: "var(--text-muted)" }}>{w.description}</p>
                      <span className="inline-block mt-1.5 text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded"
                        style={{ backgroundColor: "var(--accent-soft-2-bg)", color: "var(--accent-text)" }}>
                        {w.defaultSize === "full" ? "Full width" : w.defaultSize === "wide" ? "Wide (⅔)" : "Narrow (⅓)"}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ))
        ) : (
          <p className="text-xs text-center py-2" style={{ color: "var(--text-muted)" }}>
            No hidden widgets available for this context level.
          </p>
        )}

        {otherCtx.length > 0 && (
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest mb-2" style={{ color: "var(--text-muted)" }}>
              Available at other context levels
            </p>
            <div className="grid grid-cols-1 gap-2 opacity-50">
              {otherCtx.map(w => (
                <div key={w.id} className="flex flex-col p-3 rounded-xl"
                  style={{ backgroundColor: "var(--bg-surface-2)", border: "1px solid var(--border)" }}>
                  <p className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>{w.title}</p>
                  <p className="text-[10px] mt-1" style={{ color: "var(--text-muted)" }}>
                    {w.allowedContexts.map(c => CONTEXT_LABELS[c]).join(", ")}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────
export default function DashboardPage() {
  const {
    userName, activeScopeLabel,
    effectiveCompanyId, effectiveLocationId, effectiveServiceAreaId,
  } = useHierarchy();

  const contextLevel = getContextLevel(effectiveCompanyId, effectiveLocationId, effectiveServiceAreaId);

  const [layout,       setLayout]       = useState<DashItem[]>(() => loadLayout());
  const [draft,        setDraft]        = useState<DashItem[]>(layout);
  const [customizing,  setCustomizing]  = useState(false);
  const [showAddPanel, setShowAddPanel] = useState(false);
  const [dockPos,      setDockPos]      = useState<DockPos>(null);
  // Widget being dragged out of the Add-Widgets drawer onto the grid.
  const [dragWidget,   setDragWidget]   = useState<{ id: string; w: number; h: number } | null>(null);

  // Widgets visible + allowed at current context level, sorted by y then x
  const contextVisible = useMemo(() =>
    draft
      .filter(i => i.visible && (WIDGET_MAP[i.widgetId]?.allowedContexts.includes(contextLevel) ?? false))
      .sort((a, b) => a.y !== b.y ? a.y - b.y : a.x - b.x),
    [draft, contextLevel]
  );

  const hiddenIds = draft.filter(i => !i.visible).map(i => i.widgetId);

  function startCustomize() {
    setDraft(layout);
    setCustomizing(true);
    setShowAddPanel(false);
    setDockPos(null);   // dock starts inline by the title each session
  }

  // Default grid width (cols) for a widget based on its registry size.
  function widgetWidth(id: string) {
    const def = WIDGET_MAP[id];
    return def?.defaultSize === "full" ? 12 : def?.defaultSize === "wide" ? 8 : 4;
  }

  // Sync positions from RGL after drag/resize (only during customizing)
  function handleLayoutChange(newLayout: readonly RGLItem[]) {
    if (!customizing) return;
    setDraft(prev => prev.map(item => {
      const upd = newLayout.find(l => l.i === item.widgetId);
      if (!upd) return item;
      return { ...item, x: upd.x, y: upd.y, w: upd.w, h: upd.h };
    }));
  }

  function hideWidget(id: string) {
    setDraft(prev => prev.map(i => i.widgetId === id ? { ...i, visible: false } : i));
  }

  // Click-to-add: drop the widget at the bottom of the current context.
  function addWidget(id: string) {
    const ctxVisible = draft.filter(i =>
      i.visible && (WIDGET_MAP[i.widgetId]?.allowedContexts.includes(contextLevel) ?? false)
    );
    const y = nextFreeY(ctxVisible);
    setDraft(prev => prev.map(i =>
      i.widgetId === id ? { ...i, visible: true, x: 0, y, w: widgetWidth(id), h: i.h } : i
    ));
  }

  // Drag-to-add: place the widget at the exact grid cell it was dropped on.
  function handleDropWidget(x: number, y: number) {
    if (!dragWidget) return;
    const { id, w } = dragWidget;
    setDraft(prev => prev.map(i =>
      i.widgetId === id ? { ...i, visible: true, x, y, w } : i
    ));
    setDragWidget(null);
  }

  function handleDragStartWidget(id: string) {
    const item = draft.find(i => i.widgetId === id);
    setDragWidget({ id, w: widgetWidth(id), h: item?.h ?? 6 });
  }

  function handleSave() {
    saveLayout(draft);
    setLayout(draft);
    setCustomizing(false);
    setShowAddPanel(false);
  }

  function handleCancel() {
    setDraft(layout);
    setCustomizing(false);
    setShowAddPanel(false);
  }

  function handleReset() {
    setDraft(DEFAULT_LAYOUT);
  }

  return (
    <div className="p-6 space-y-4 transition-colors duration-300"
      style={customizing
        ? { backgroundColor: "rgba(79,70,229,0.018)" }
        : {}}>

      {/* ── Page header ────────────────────────────────── */}
      <div className="flex items-center justify-between gap-4">
        {/* Left: title + context info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold" style={{ color: "var(--text-primary)" }}>Dashboard</h1>
            <ContextBadge level={contextLevel} />
            {activeScopeLabel !== "All locations" && (
              <span className="text-base font-normal" style={{ color: "var(--text-muted)" }}>
                · {activeScopeLabel}
              </span>
            )}
          </div>
        </div>

        {/* Center: greeting */}
        <p className="flex-1 text-center text-sm" style={{ color: "var(--text-secondary)" }}>
          {GREET_DATE} — good morning, {userName}
        </p>

        {/* Right: customize / edit dock */}
        <div className="flex-1 flex justify-end">
          {!customizing ? (
            <button onClick={startCustomize}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm transition-colors hover:bg-[var(--bg-surface-2)]"
              style={{ border: "1px solid var(--border)", color: "var(--text-secondary)", backgroundColor: "var(--bg-surface)" }}>
              <Settings2 className="w-3.5 h-3.5" /> Customize
            </button>
          ) : (
            /* Docks inline here by default; pops to free-floating when dragged. */
            <EditDock
              contextLevel={contextLevel}
              showAddPanel={showAddPanel}
              pos={dockPos}
              onPosChange={setDockPos}
              onToggleAdd={() => setShowAddPanel(v => !v)}
              onSave={handleSave}
              onCancel={handleCancel}
              onReset={handleReset}
            />
          )}
        </div>
      </div>

      {/* ── Widget grid ─────────────────────────────────── */}
      {contextVisible.length === 0 ? (
        <div className="rounded-xl p-12 text-center"
          style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-subtle)" }}>
          <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
            No widgets for this context level
          </p>
          <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
            Click Customize → Add Widget to set up your {CONTEXT_LABELS[contextLevel]} dashboard.
          </p>
          {!customizing && (
            <button onClick={startCustomize}
              className="mt-3 inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm transition-colors"
              style={{ border: "1px solid var(--border)", color: "var(--text-secondary)", backgroundColor: "var(--bg-surface-2)" }}>
              <Settings2 className="w-3.5 h-3.5" /> Customize Dashboard
            </button>
          )}
        </div>
      ) : (
        <DashboardGrid
          contextVisible={contextVisible}
          customizing={customizing}
          onLayoutChange={handleLayoutChange}
          onHideWidget={hideWidget}
          dragSize={dragWidget ? { w: dragWidget.w, h: dragWidget.h } : null}
          onDropWidget={handleDropWidget}
        />
      )}

      {/* ── Customize ("edit mode") chrome — all overlays, no layout shift ── */}
      {customizing && (
        <>
          {/* Ambient frame signalling edit mode */}
          <div className="dashboard-edit-frame" aria-hidden="true" />

          {/* Add-widgets slide-over (right) */}
          {showAddPanel && (
            <AddWidgetsDrawer
              hiddenIds={hiddenIds}
              contextLevel={contextLevel}
              onAdd={addWidget}
              onClose={() => setShowAddPanel(false)}
              onDragStartWidget={handleDragStartWidget}
              onDragEndWidget={() => setDragWidget(null)}
            />
          )}
        </>
      )}
    </div>
  );
}
