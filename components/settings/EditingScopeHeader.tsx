"use client";

// ─── EditingScopeHeader ───────────────────────────────────
// The "you are here" banner at the top of a settings section: spells out the
// active scope (Organization → Company → Branch), states plainly who a change
// here affects, and warns clearly when editing a single branch. Changing the
// layer is done through a popup (ScopeSwitcherModal) — kept out of the banner so
// it stays clean. Global ("any") settings get a simpler note; not all is layered.

import { useState } from "react";
import { AlertTriangle, Layers, SlidersHorizontal } from "lucide-react";
import { useSettingsScope } from "@/components/providers/SettingsScopeProvider";
import { effectiveLayers, LAYER_META, LAYER_ORDER, type Layer, type SectionLayers } from "@/lib/settings-scope/types";
import ScopeSwitcherModal from "@/components/settings/ScopeSwitcherModal";

// What a lower (not-yet-narrowed) layer reads as on each line.
const ALL_LABEL: Record<Layer, string> = {
  org: "Entire organization",
  company: "All companies",
  location: "All branches",
  service_area: "All service areas",
};

export default function EditingScopeHeader({ sectionLayers }: { sectionLayers: SectionLayers }) {
  const {
    activeLayer, available, nodeName,
    companyOptions, locationOptions, areaOptions,
  } = useSettingsScope();
  const [switcherOpen, setSwitcherOpen] = useState(false);

  // Global setting — scope doesn't apply.
  if (sectionLayers === "any") {
    return (
      <div className="rounded-xl px-4 py-3 mb-5 flex items-center gap-2.5"
        style={{ backgroundColor: "var(--bg-surface-2)", border: "1px solid var(--border-subtle)" }}>
        <Layers className="w-4 h-4 shrink-0" style={{ color: "var(--text-muted)" }} />
        <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
          This is a <span className="font-semibold">global</span> setting — it applies to your whole account, the same everywhere.
        </p>
      </div>
    );
  }

  const eff = effectiveLayers(sectionLayers, available);
  const meta = LAYER_META[activeLayer];
  const activeIdx = LAYER_ORDER.indexOf(activeLayer);

  // Is there anything to switch between (more than one layer, or a layer with
  // multiple nodes to pick)? Only then is the "Change scope" button useful.
  const effArr = (eff === "any" ? [] : eff) as Layer[];
  const canSwitch =
    effArr.length > 1 ||
    (effArr.includes("company") && companyOptions.length > 1) ||
    (effArr.includes("location") && locationOptions.length > 1) ||
    (effArr.includes("service_area") && areaOptions.length > 1);

  const lines = available.map(l => {
    const idx = LAYER_ORDER.indexOf(l);
    return {
      layer: l,
      label: LAYER_META[l].label,
      color: LAYER_META[l].color,
      value: idx <= activeIdx ? nodeName(l) : ALL_LABEL[l],
      isActive: l === activeLayer,
    };
  });

  const node = nodeName(activeLayer);
  const helper =
    activeLayer === "org"      ? "Changes made here apply to the entire organization — every company and branch — unless one overrides them." :
    activeLayer === "company"  ? `Changes made here apply to all branches under ${node} unless a branch has an override.` :
    activeLayer === "location" ? `Changes made here apply to ${node} only and won't affect other branches.` :
                                 `Changes made here apply to ${node} only.`;

  const isNarrow = activeLayer === "location" || activeLayer === "service_area";

  return (
    <>
      <div className="rounded-xl overflow-hidden mb-5" style={{ border: `1px solid ${meta.color}40`, backgroundColor: meta.color + "0a" }}>
        <div className="px-4 py-3.5">
          <div className="flex items-center justify-between gap-3 mb-2.5">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full" style={{ backgroundColor: meta.color + "1f", color: meta.color }}>
                Editing Scope
              </span>
              <span className="text-sm font-semibold" style={{ color: meta.color }}>{meta.label} Level</span>
            </div>
            {canSwitch && (
              <button onClick={() => setSwitcherOpen(true)}
                className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-lg transition-colors shrink-0"
                style={{ border: `1px solid ${meta.color}66`, color: meta.color }}>
                <SlidersHorizontal className="w-3 h-3" /> Change scope
              </button>
            )}
          </div>

          <div className="space-y-1">
            {lines.map(ln => (
              <div key={ln.layer} className="flex items-center gap-2 text-xs">
                <span className="w-24 shrink-0" style={{ color: "var(--text-muted)" }}>{ln.label}</span>
                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: ln.isActive ? ln.color : "var(--border)" }} />
                <span style={{ color: ln.isActive ? "var(--text-primary)" : "var(--text-secondary)", fontWeight: ln.isActive ? 600 : 400 }}>{ln.value}</span>
              </div>
            ))}
          </div>

          <p className="text-xs mt-3 leading-relaxed" style={{ color: "var(--text-secondary)" }}>{helper}</p>
        </div>

        {isNarrow && (
          <div className="flex items-center gap-2 px-4 py-2" style={{ backgroundColor: "var(--warning-soft-bg)", borderTop: `1px solid ${meta.color}30` }}>
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--warning-icon)" }} />
            <p className="text-xs font-medium" style={{ color: "var(--warning-text)" }}>
              You are editing {node} only. This will not affect other {activeLayer === "service_area" ? "service areas" : "branches"}.
            </p>
          </div>
        )}
      </div>

      {switcherOpen && <ScopeSwitcherModal sectionLayers={sectionLayers} onClose={() => setSwitcherOpen(false)} />}
    </>
  );
}
