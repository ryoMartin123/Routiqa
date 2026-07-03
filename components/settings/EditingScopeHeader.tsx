"use client";

// ─── EditingScopeHeader ───────────────────────────────────
// Compact "you are here" scope bar at the top of a settings section: one scope
// badge, the scope name, a one-line path summary, a short plain-English note, and
// a Change scope button (opens ScopeSwitcherModal). Scope/inheritance logic is
// unchanged — this is presentation only. Global ("any") settings get a one-liner.

import { useState } from "react";
import { Layers, SlidersHorizontal } from "lucide-react";
import { useSettingsScope } from "@/components/providers/SettingsScopeProvider";
import { effectiveLayers, LAYER_META, LAYER_ORDER, type Layer, type SectionLayers } from "@/lib/settings-scope/types";
import ScopeSwitcherModal from "@/components/settings/ScopeSwitcherModal";

// How a lower (not-yet-narrowed) layer reads in the path summary.
const ALL_LABEL: Record<Layer, string> = {
  org: "Entire organization",
  company: "All companies",
  location: "All branches",
  service_area: "All service areas",
};

// The single scope badge label per active layer.
const SCOPE_BADGE: Record<Layer, string> = {
  org: "Organization-wide",
  company: "Company",
  location: "Branch",
  service_area: "Service Area",
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
      <div className="rounded-xl px-4 py-2.5 mb-5 flex items-center gap-2.5"
        style={{ backgroundColor: "var(--bg-surface-2)", border: "1px solid var(--border)" }}>
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
  const scopeName = nodeName(activeLayer);

  // Is there anything to switch between? Only then is "Change scope" useful.
  const effArr = (eff === "any" ? [] : eff) as Layer[];
  const canSwitch =
    effArr.length > 1 ||
    (effArr.includes("company") && companyOptions.length > 1) ||
    (effArr.includes("location") && locationOptions.length > 1) ||
    (effArr.includes("service_area") && areaOptions.length > 1);

  // One-line path summary across the layers below the org (e.g.
  // "All companies · All branches · All service areas").
  const pathSummary = available
    .filter(l => l !== "org")
    .map(l => (LAYER_ORDER.indexOf(l) <= activeIdx ? nodeName(l) : ALL_LABEL[l]))
    .join(" · ");

  const explain =
    activeLayer === "org"      ? "Applies everywhere unless a lower level overrides it." :
    activeLayer === "company"  ? `Applies to all branches of ${scopeName} unless one overrides it.` :
                                 `Applies to ${scopeName} only — won't affect other ${activeLayer === "service_area" ? "service areas" : "branches"}.`;

  return (
    <>
      <div className="rounded-xl mb-5 flex items-center gap-3 px-4 py-2.5"
        style={{ border: `1px solid ${meta.color}40`, backgroundColor: meta.color + "0a" }}>
        {/* Badge + scope name + path */}
        <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-full shrink-0"
          style={{ backgroundColor: meta.color + "1f", color: meta.color }}>{SCOPE_BADGE[activeLayer]}</span>
        <div className="min-w-0 flex-1">
          <p className="text-sm truncate" style={{ color: "var(--text-primary)" }}>
            Editing defaults for <span className="font-semibold">{scopeName}</span>
          </p>
          {pathSummary && <p className="text-[11px] truncate mt-0.5" style={{ color: "var(--text-muted)" }}>{pathSummary}</p>}
        </div>

        {/* Short explanation (secondary) */}
        <p className="hidden lg:block text-[11px] leading-snug text-right shrink-0" style={{ color: "var(--text-secondary)", maxWidth: "260px" }}>{explain}</p>

        {/* Change scope */}
        {canSwitch && (
          <button onClick={() => setSwitcherOpen(true)}
            className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-lg transition-colors shrink-0"
            style={{ border: `1px solid ${meta.color}66`, color: meta.color }}>
            <SlidersHorizontal className="w-3 h-3" /> Change scope
          </button>
        )}
      </div>

      {switcherOpen && <ScopeSwitcherModal sectionLayers={sectionLayers} onClose={() => setSwitcherOpen(false)} />}
    </>
  );
}
