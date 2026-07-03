"use client";

import React, { useState, useMemo, useRef, useEffect } from "react";
import type { LayoutItem as RGLItem } from "react-grid-layout";
// The interactive widget grid (react-grid-layout + every widget) lives in its own
// file for organization, but is imported normally — the grid's drag/resize and
// container-width measurement need it mounted synchronously with the page.
import DashboardGrid from "@/components/dashboard/DashboardGrid";
import {
  Settings2, Check, X, RotateCcw,
  Plus, GripVertical, Info, MoreHorizontal, LineChart,
} from "lucide-react";

import { useHierarchy } from "@/components/providers/HierarchyProvider";
import {
  CONTEXT_LABELS,
  getContextLevel, resolveWidgetDef, REPORT_WIDGET_PREFIX, type ContextLevel,
} from "@/lib/dashboard/registry";
import { getReports } from "@/lib/analytics/store";
import Link from "next/link";
import {
  DEFAULT_LAYOUT, loadLayout, saveLayout, saveLayoutForScope, scopeKeyOf, nextFreeY,
  type LayoutItem as DashItem,
} from "@/lib/dashboard/layouts";
import { resolveLayoutForScope } from "@/lib/dashboard/templates";

// Live date + time-of-day greeting. Computed after mount (empty on the server)
// so the client fills in the real local date without a hydration mismatch.
function useGreeting() {
  const [g, setG] = useState<{ date: string; part: string }>({ date: "", part: "morning" });
  useEffect(() => {
    const now = new Date();
    const h = now.getHours();
    setG({
      date: now.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" }),
      part: h < 12 ? "morning" : h < 18 ? "afternoon" : "evening",
    });
  }, []);
  return g;
}

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
  const [menuOpen, setMenuOpen] = useState(false);

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
          : { position: "relative", zIndex: 50 }),
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
        <span className="hidden md:inline text-sm font-semibold" style={{ color: "var(--accent-text-strong)" }}>Customizing</span>
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

      <button onClick={onSave} title="Done" aria-label="Done"
        className="flex items-center justify-center w-9 h-9 rounded-xl text-white transition-opacity hover:opacity-90"
        style={{ backgroundColor: "var(--accent-text)", boxShadow: "0 2px 8px -1px rgba(49,46,129,0.4)" }}>
        <Check className="w-4 h-4" />
      </button>

      {/* Overflow — secondary actions (reset / cancel) */}
      <div className="relative">
        <button onClick={() => setMenuOpen(o => !o)} aria-label="More options"
          className="flex items-center justify-center w-8 h-8 rounded-xl transition-colors hover:bg-[var(--bg-surface-2)]"
          style={{ color: "var(--text-secondary)" }}>
          <MoreHorizontal className="w-4 h-4" />
        </button>
        {menuOpen && (
          <>
            <button aria-hidden tabIndex={-1} onClick={() => setMenuOpen(false)} className="fixed inset-0 z-40 cursor-default" />
            <div className="absolute right-0 top-full mt-2 z-50 w-44 rounded-xl overflow-hidden py-1"
              style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "0 12px 32px rgba(0,0,0,0.18)" }}>
              <button onClick={() => { setMenuOpen(false); onReset(); }}
                className="flex items-center gap-2 w-full px-3 py-2 text-sm transition-colors hover:bg-[var(--bg-surface-2)]" style={{ color: "var(--text-primary)" }}>
                <RotateCcw className="w-3.5 h-3.5" style={{ color: "var(--text-muted)" }} /> Reset to default
              </button>
              <button onClick={() => { setMenuOpen(false); onCancel(); }}
                className="flex items-center gap-2 w-full px-3 py-2 text-sm transition-colors hover:bg-[var(--bg-surface-2)]" style={{ color: "var(--text-primary)" }}>
                <X className="w-3.5 h-3.5" style={{ color: "var(--text-muted)" }} /> Cancel
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Add widgets drawer ───────────────────────────────────
// Slides in from the right and overlays the dashboard (no dimming
// backdrop) so the user can watch widgets drop into the grid live as
// they click them.
function AddWidgetsDrawer({
  contextLevel, reportWidgets, onAdd, onClose, onDragStartWidget, onDragEndWidget,
}: {
  contextLevel: ContextLevel;
  reportWidgets: { id: string; name: string; sub: string }[];
  onAdd: (id: string) => void; onClose: () => void;
  onDragStartWidget: (id: string) => void; onDragEndWidget: () => void;
}) {
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

      {/* Body — analytics report widgets only */}
      <div className="flex-1 overflow-y-auto dashboard-widget-content p-4 space-y-4">
        {reportWidgets.length === 0 ? (
          <div className="rounded-xl p-6 text-center space-y-2" style={{ border: "1.5px dashed var(--border)", backgroundColor: "var(--bg-surface-2)" }}>
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>Every analytics report is already on your dashboard.</p>
            <Link href="/analytics/builder" className="inline-block text-xs font-semibold" style={{ color: "var(--accent-text)" }}>Build a new one in Analytics →</Link>
          </div>
        ) : (
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest mb-2" style={{ color: "var(--accent-text)" }}>From Analytics</p>
            <div className="grid grid-cols-1 gap-2">
              {reportWidgets.map(r => (
                <button key={r.id}
                  onClick={() => onAdd(REPORT_WIDGET_PREFIX + r.id)}
                  draggable
                  onDragStart={e => { onDragStartWidget(REPORT_WIDGET_PREFIX + r.id); e.dataTransfer.effectAllowed = "copy"; e.dataTransfer.setData("text/plain", REPORT_WIDGET_PREFIX + r.id); }}
                  onDragEnd={onDragEndWidget}
                  className="flex items-start gap-2.5 text-left p-3 rounded-xl transition-all hover:shadow-sm cursor-grab active:cursor-grabbing"
                  style={{ backgroundColor: "var(--bg-surface-2)", border: "1px solid var(--border)" }}>
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5" style={{ backgroundColor: "var(--accent-soft-2-bg)" }}>
                    <LineChart className="w-3.5 h-3.5" style={{ color: "var(--accent-text)" }} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold truncate" style={{ color: "var(--text-primary)" }}>{r.name}</p>
                    <p className="text-[10px] leading-snug mt-0.5 truncate" style={{ color: "var(--text-muted)" }}>{r.sub}</p>
                  </div>
                </button>
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
  const greeting = useGreeting();

  // Each scope (org / company / location) has its own layout, auto-loaded on switch.
  const scopeKey = scopeKeyOf(effectiveCompanyId, effectiveLocationId);
  const [layout,       setLayout]       = useState<DashItem[]>(() => resolveLayoutForScope(scopeKey));
  const [draft,        setDraft]        = useState<DashItem[]>(layout);
  const [customizing,  setCustomizing]  = useState(false);
  const [showAddPanel, setShowAddPanel] = useState(false);
  const [dockPos,      setDockPos]      = useState<DockPos>(null);
  // Widget being dragged out of the Add-Widgets drawer onto the grid.
  const [dragWidget,   setDragWidget]   = useState<{ id: string; w: number; h: number } | null>(null);

  // Switching scope swaps in that scope's layout (its own edits, an assigned
  // template default, or the org layout as a fallback).
  const prevScopeRef = useRef(scopeKey);
  useEffect(() => {
    if (prevScopeRef.current === scopeKey) return;
    prevScopeRef.current = scopeKey;
    const next = resolveLayoutForScope(scopeKey);
    setLayout(next);
    setDraft(next);
    setCustomizing(false);
  }, [scopeKey]);

  // Widgets visible + allowed at current context level, sorted by y then x
  const contextVisible = useMemo(() =>
    draft
      .filter(i => i.visible && (resolveWidgetDef(i.widgetId)?.allowedContexts.includes(contextLevel) ?? false))
      .sort((a, b) => a.y !== b.y ? a.y - b.y : a.x - b.x),
    [draft, contextLevel]
  );

  function startCustomize() {
    setDraft(layout);
    setCustomizing(true);
    setShowAddPanel(false);
    setDockPos(null);   // dock starts inline by the title each session
  }

  // Default grid width (cols) for a widget based on its registry size.
  function widgetWidth(id: string) {
    const def = resolveWidgetDef(id);
    return def?.defaultSize === "full" ? 12 : def?.defaultSize === "wide" ? 8 : 4;
  }

  // Sync positions from RGL after drag/resize (only during customizing).
  // Bail out when nothing actually moved — returning the same `prev` reference
  // skips the re-render, which breaks the onLayoutChange → setState → re-render
  // → onLayoutChange feedback loop that caused rapid jitter.
  function handleLayoutChange(newLayout: readonly RGLItem[]) {
    if (!customizing) return;
    setDraft(prev => {
      let changed = false;
      const next = prev.map(item => {
        const upd = newLayout.find(l => l.i === item.widgetId);
        if (!upd || (upd.x === item.x && upd.y === item.y && upd.w === item.w && upd.h === item.h)) return item;
        changed = true;
        return { ...item, x: upd.x, y: upd.y, w: upd.w, h: upd.h };
      });
      return changed ? next : prev;
    });
  }

  function hideWidget(id: string) {
    setDraft(prev => prev.map(i => i.widgetId === id ? { ...i, visible: false } : i));
  }

  // Click-to-add: drop the widget at the bottom of the current context.
  // Report widgets aren't in the default layout, so append them on first add.
  function addWidget(id: string) {
    const ctxVisible = draft.filter(i =>
      i.visible && (resolveWidgetDef(i.widgetId)?.allowedContexts.includes(contextLevel) ?? false)
    );
    const y = nextFreeY(ctxVisible);
    setDraft(prev => prev.some(i => i.widgetId === id)
      ? prev.map(i => i.widgetId === id ? { ...i, visible: true, x: 0, y, w: widgetWidth(id), h: i.h } : i)
      : [...prev, { widgetId: id, visible: true, order: prev.length + 1, x: 0, y, w: widgetWidth(id), h: 6, minW: 3, minH: 3 }]);
  }

  // Drag-to-add: place the widget at the exact grid cell it was dropped on.
  // Report widgets aren't in the default layout, so append them on first drop.
  function handleDropWidget(x: number, y: number) {
    if (!dragWidget) return;
    const { id, w, h } = dragWidget;
    setDraft(prev => prev.some(i => i.widgetId === id)
      ? prev.map(i => i.widgetId === id ? { ...i, visible: true, x, y, w } : i)
      : [...prev, { widgetId: id, visible: true, order: prev.length + 1, x, y, w, h, minW: 3, minH: 3 }]);
    setDragWidget(null);
  }

  function handleDragStartWidget(id: string) {
    const item = draft.find(i => i.widgetId === id);
    setDragWidget({ id, w: widgetWidth(id), h: item?.h ?? 6 });
  }

  function handleSave() {
    saveLayoutForScope(scopeKey, draft);   // persist per active scope
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
            {activeScopeLabel !== "All locations" && (
              <span className="text-base font-normal" style={{ color: "var(--text-muted)" }}>
                · {activeScopeLabel}
              </span>
            )}
          </div>
          <p className="text-[13px] mt-0.5 leading-snug" style={{ color: "var(--text-muted)" }}>
            Overview of today&apos;s work, sales activity, and company performance.
          </p>
        </div>

        {/* Center: greeting */}
        <p className="flex-1 text-center text-sm" style={{ color: "var(--text-secondary)" }}>
          {greeting.date && `${greeting.date} — `}good {greeting.part}, {userName.split(" ")[0]}
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
          style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)" }}>
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
              contextLevel={contextLevel}
              reportWidgets={getReports()
                .filter(r => !draft.some(i => i.widgetId === REPORT_WIDGET_PREFIX + r.id && i.visible))
                .map(r => ({ id: r.id, name: r.name || "Untitled report", sub: "Analytics report" }))}
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
