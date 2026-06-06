"use client";

// ─── SectionGate ──────────────────────────────────────────
// Wraps a settings section. If the section is editable at the active layer, it
// renders normally. If not, it shows a read-only notice pointing to the layer
// where the setting lives, with a one-click jump — nothing is hidden.

import { Lock, ArrowRight } from "lucide-react";
import { useSettingsScope } from "@/components/providers/SettingsScopeProvider";
import {
  effectiveLayers, jumpLayer, LAYER_META, type SectionLayers,
} from "@/lib/settings-scope/types";

export default function SectionGate({
  layers, title, children,
}: {
  layers: SectionLayers;
  title: string;
  children: React.ReactNode;
}) {
  const { activeLayer, available, setActiveLayer } = useSettingsScope();
  const eff = effectiveLayers(layers, available);

  if (eff === "any" || eff.includes(activeLayer)) return <>{children}</>;

  const target = jumpLayer(eff);
  const meta = LAYER_META[target];

  return (
    <div className="rounded-xl p-6 flex flex-col items-center text-center gap-3"
      style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-subtle)", boxShadow: "var(--shadow-card)" }}>
      <div className="w-11 h-11 rounded-full flex items-center justify-center" style={{ backgroundColor: meta.color + "18" }}>
        <Lock className="w-5 h-5" style={{ color: meta.color }} />
      </div>
      <div>
        <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
          {title} is managed at the {meta.label} level
        </p>
        <p className="text-xs mt-1 max-w-sm" style={{ color: "var(--text-muted)" }}>
          You&apos;re editing a different layer right now. Switch to {meta.label} to view or change this setting.
        </p>
      </div>
      <button onClick={() => setActiveLayer(target)}
        className="flex items-center gap-1.5 text-sm font-medium px-3.5 py-2 rounded-lg text-white transition-opacity hover:opacity-90"
        style={{ backgroundColor: meta.color }}>
        Switch to {meta.label} <ArrowRight className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
