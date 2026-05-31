"use client";

import React, { useState, useMemo } from "react";
import type { LayoutItem as RGLItem } from "react-grid-layout";
// The interactive widget grid (react-grid-layout + every widget) lives in its own
// file for organization, but is imported normally — the grid's drag/resize and
// container-width measurement need it mounted synchronously with the page.
import DashboardGrid from "@/components/dashboard/DashboardGrid";
import {
  Settings2, Save, X, RotateCcw,
  Plus, Eye, ChevronDown, ChevronUp,
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
function ContextBadge({ level }: { level: ContextLevel }) {
  const c = CTX_COLORS[level];
  return (
    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
      style={{ backgroundColor: c.bg, color: c.color }}>
      {CONTEXT_LABELS[level]}
    </span>
  );
}

// ─── Sticky customize toolbar ─────────────────────────────
function CustomizeToolbar({
  contextLevel, showAddPanel,
  onToggleAdd, onSave, onCancel, onReset,
}: {
  contextLevel: ContextLevel;
  showAddPanel: boolean;
  onToggleAdd: () => void;
  onSave:      () => void;
  onCancel:    () => void;
  onReset:     () => void;
}) {
  return (
    <div className="sticky top-0 z-30 flex flex-wrap items-center justify-between gap-3 px-5 py-3 rounded-xl"
      style={{
        backgroundColor: "var(--accent-soft-bg)",
        border:          "1.5px solid var(--accent-soft-border)",
        backdropFilter:  "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        boxShadow: "var(--shadow-card)",
      }}>

      {/* Left — mode indicator */}
      <div className="flex items-center gap-2.5">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
            style={{ backgroundColor: "var(--accent-icon)" }} />
          <span className="relative inline-flex rounded-full h-2 w-2"
            style={{ backgroundColor: "var(--accent-icon)" }} />
        </span>
        <p className="text-sm font-semibold" style={{ color: "var(--accent-text-strong)" }}>Customize Mode</p>
        <ContextBadge level={contextLevel} />
        <span className="text-xs hidden xl:block" style={{ color: "var(--accent-text)" }}>
          Drag handle to move · drag corner to resize
        </span>
      </div>

      {/* Right — actions */}
      <div className="flex items-center gap-2">
        {/* Add Widget — toggles the panel below */}
        <button onClick={onToggleAdd}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
          style={{
            backgroundColor: showAddPanel ? "var(--accent-text)" : "transparent",
            border:          `1px solid ${showAddPanel ? "var(--accent-text)" : "var(--accent-soft-border)"}`,
            color:            showAddPanel ? "#fff" : "var(--accent-text)",
          }}>
          <Plus className="w-3 h-3" />
          Add Widget
          {showAddPanel
            ? <ChevronUp   className="w-3 h-3" />
            : <ChevronDown className="w-3 h-3" />}
        </button>

        <div className="w-px h-4" style={{ backgroundColor: "var(--accent-soft-border)" }} />

        <button onClick={onReset}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-colors"
          style={{ border: "1px solid var(--accent-soft-border)", color: "var(--accent-text)" }}
          title="Reset to default layout">
          <RotateCcw className="w-3 h-3" /> Reset Default
        </button>
        <button onClick={onCancel}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-colors"
          style={{ border: "1px solid var(--border)", color: "var(--text-secondary)", backgroundColor: "var(--bg-surface)" }}>
          <X className="w-3 h-3" /> Cancel
        </button>
        <button onClick={onSave}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white transition-colors"
          style={{ backgroundColor: "var(--accent-text)" }}>
          <Save className="w-3 h-3" /> Save Layout
        </button>
      </div>
    </div>
  );
}

// ─── Add widgets panel ────────────────────────────────────
function AddWidgetsPanel({
  hiddenIds, contextLevel, onAdd,
}: {
  hiddenIds: string[]; contextLevel: ContextLevel; onAdd: (id: string) => void;
}) {
  const available = WIDGET_REGISTRY.filter(
    w => hiddenIds.includes(w.id) && w.allowedContexts.includes(contextLevel)
  );
  const otherCtx = WIDGET_REGISTRY.filter(
    w => hiddenIds.includes(w.id) && !w.allowedContexts.includes(contextLevel)
  );

  if (available.length === 0 && otherCtx.length === 0) return (
    <div className="rounded-xl p-4 text-center" style={{ border: "1.5px dashed var(--border)", backgroundColor: "var(--bg-surface-2)" }}>
      <p className="text-sm" style={{ color: "var(--text-muted)" }}>All widgets for this context are already visible.</p>
    </div>
  );

  const grouped = available.reduce<Partial<Record<WidgetCategory, typeof WIDGET_REGISTRY>>>((acc, w) => {
    if (!acc[w.category]) acc[w.category] = [];
    acc[w.category]!.push(w);
    return acc;
  }, {});

  return (
    <div className="rounded-xl overflow-hidden"
      style={{ border: "1.5px solid var(--accent-soft-border)", backgroundColor: "var(--bg-surface)", boxShadow: "var(--shadow-card)" }}>
      <div className="flex items-center gap-2 px-5 py-3" style={{ borderBottom: "1px solid var(--accent-soft-border)", backgroundColor: "var(--accent-soft-bg)" }}>
        <Plus className="w-4 h-4" style={{ color: "var(--accent-text)" }} />
        <p className="text-sm font-semibold" style={{ color: "var(--accent-text-strong)" }}>Add Widgets</p>
        <ContextBadge level={contextLevel} />
        <span className="text-xs ml-1" style={{ color: "var(--accent-text)" }}>
          — click a widget to add it to your dashboard
        </span>
      </div>
      <div className="p-4 space-y-4">
        {available.length > 0 ? (
          (Object.entries(grouped) as [WidgetCategory, typeof WIDGET_REGISTRY][]).map(([cat, widgets]) => (
            <div key={cat}>
              <p className="text-[10px] font-semibold uppercase tracking-widest mb-2" style={{ color: "var(--accent-text)" }}>
                {CATEGORY_LABELS[cat]}
              </p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {widgets.map(w => (
                  <button key={w.id} onClick={() => onAdd(w.id)}
                    className="flex items-start gap-3 text-left p-3 rounded-xl transition-all hover:shadow-sm group"
                    style={{ backgroundColor: "var(--bg-surface-2)", border: "1px solid var(--border-subtle)" }}>
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                      style={{ backgroundColor: "var(--accent-soft-2-bg)" }}>
                      <Eye className="w-3.5 h-3.5" style={{ color: "var(--accent-text)" }} />
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
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 opacity-50">
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

  function addWidget(id: string) {
    const ctxVisible = draft.filter(i =>
      i.visible && (WIDGET_MAP[i.widgetId]?.allowedContexts.includes(contextLevel) ?? false)
    );
    const y   = nextFreeY(ctxVisible);
    const def = WIDGET_MAP[id];
    const w   = def.defaultSize === "full" ? 12 : def.defaultSize === "wide" ? 8 : 4;
    setDraft(prev => prev.map(i =>
      i.widgetId === id ? { ...i, visible: true, x: 0, y, w, h: i.h } : i
    ));
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
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
            {GREET_DATE} — good morning, {userName}
          </p>
          <div className="flex items-center gap-2 mt-0.5">
            <h1 className="text-2xl font-semibold" style={{ color: "var(--text-primary)" }}>Dashboard</h1>
            <ContextBadge level={contextLevel} />
            {activeScopeLabel !== "All locations" && (
              <span className="text-base font-normal" style={{ color: "var(--text-muted)" }}>
                · {activeScopeLabel}
              </span>
            )}
          </div>
        </div>
        {!customizing && (
          <button onClick={startCustomize}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm transition-colors hover:bg-[var(--bg-surface-2)]"
            style={{ border: "1px solid var(--border)", color: "var(--text-secondary)", backgroundColor: "var(--bg-surface)" }}>
            <Settings2 className="w-3.5 h-3.5" /> Customize
          </button>
        )}
      </div>

      {/* ── Sticky customize toolbar ────────────────────── */}
      {customizing && (
        <CustomizeToolbar
          contextLevel={contextLevel}
          showAddPanel={showAddPanel}
          onToggleAdd={() => setShowAddPanel(v => !v)}
          onSave={handleSave}
          onCancel={handleCancel}
          onReset={handleReset}
        />
      )}

      {/* ── Add widgets panel (collapsible, right below toolbar) ── */}
      {customizing && showAddPanel && (
        <AddWidgetsPanel
          hiddenIds={hiddenIds}
          contextLevel={contextLevel}
          onAdd={addWidget}
        />
      )}

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
        />
      )}
    </div>
  );
}
