"use client";

// ─── InheritanceChip ──────────────────────────────────────
// Shows whether the setting at the active layer is inherited or overridden, and
// offers the matching action: Override here (materialize a local copy) or Reset
// (drop the override and fall back to the parent / default).

import { ArrowDownToLine, RotateCcw, CornerDownRight } from "lucide-react";
import { useSettingsScope } from "@/components/providers/SettingsScopeProvider";
import { LAYER_META } from "@/lib/settings-scope/types";
import type { Source } from "@/lib/settings-scope/store";

function sourceLabel(s: Source): string {
  return s === "default" ? "built-in defaults" : LAYER_META[s].label;
}

export default function InheritanceChip({
  source, isOverride, parentSource, onOverride, onReset,
}: {
  source: Source;
  isOverride: boolean;
  parentSource: Source;
  onOverride: () => void;
  onReset: () => void;
}) {
  const { activeLayer } = useSettingsScope();
  const meta = LAYER_META[activeLayer];

  if (isOverride) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-lg px-3 py-2"
        style={{ backgroundColor: meta.color + "12", border: `1px solid ${meta.color}40` }}>
        <span className="flex items-center gap-2 text-xs font-medium" style={{ color: meta.color }}>
          <CornerDownRight className="w-3.5 h-3.5 shrink-0" />
          Overridden at {meta.label} — values here differ from {sourceLabel(parentSource)}.
        </span>
        <button onClick={onReset}
          className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-md shrink-0 transition-colors"
          style={{ border: `1px solid ${meta.color}66`, color: meta.color }}>
          <RotateCcw className="w-3 h-3" /> Reset to {sourceLabel(parentSource)}
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg px-3 py-2"
      style={{ backgroundColor: "var(--bg-surface-2)", border: "1px solid var(--border)" }}>
      <span className="flex items-center gap-2 text-xs" style={{ color: "var(--text-secondary)" }}>
        <ArrowDownToLine className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--text-muted)" }} />
        Inherited from <span className="font-semibold">{sourceLabel(source)}</span>. Editing &amp; saving will override it at {meta.label}.
      </span>
      <button onClick={onOverride}
        className="text-xs font-medium px-2.5 py-1 rounded-md shrink-0 text-white transition-opacity hover:opacity-90"
        style={{ backgroundColor: meta.color }}>
        Override here
      </button>
    </div>
  );
}
