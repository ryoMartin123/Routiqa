"use client";

// ─── Settings Scope Path bar ──────────────────────────────
// The single layer switcher for all of Settings: a clickable breadcrumb of the
// layers this org uses (Org › Company › Branch › Area). The active layer is
// highlighted in its identity color; non-org layers carry a dropdown to pick the
// node. No per-page pickers anywhere else.

import { Building2, Building, MapPin, Map, ChevronRight } from "lucide-react";
import UiSelect from "@/components/ui/Select";
import { useSettingsScope } from "@/components/providers/SettingsScopeProvider";
import { LAYER_META, type Layer } from "@/lib/settings-scope/types";

const LAYER_ICON: Record<Layer, typeof Building2> = {
  org: Building2, company: Building, location: MapPin, service_area: Map,
};

export default function SettingsScopeBar() {
  const {
    activeLayer, setActiveLayer, available, nodeName,
    companyId, locationId, serviceAreaId, setCompanyId, setLocationId, setServiceAreaId,
    companyOptions, locationOptions, areaOptions,
  } = useSettingsScope();

  const nodeFor = (l: Layer) => {
    if (l === "company") return { value: companyId, set: setCompanyId, options: companyOptions };
    if (l === "location") return { value: locationId, set: setLocationId, options: locationOptions };
    if (l === "service_area") return { value: serviceAreaId, set: setServiceAreaId, options: areaOptions };
    return null;
  };

  return (
    <div className="flex items-center gap-1.5 flex-wrap px-6 py-3"
      style={{ backgroundColor: "var(--bg-surface)", borderBottom: "1px solid var(--border-subtle)" }}>
      <span className="text-[11px] font-semibold uppercase tracking-widest mr-1 shrink-0" style={{ color: "var(--text-muted)" }}>
        Editing
      </span>

      {available.map((l, i) => {
        const meta = LAYER_META[l];
        const Icon = LAYER_ICON[l];
        const active = activeLayer === l;
        const node = nodeFor(l);

        return (
          <div key={l} className="flex items-center gap-1.5">
            {i > 0 && <ChevronRight className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--text-muted)" }} />}

            <div className="flex items-center rounded-lg overflow-hidden"
              style={{
                border: `1.5px solid ${active ? meta.color : "var(--border)"}`,
                backgroundColor: active ? meta.color + "14" : "var(--bg-surface-2)",
              }}>
              {/* Layer label — clicking it makes this the active layer */}
              <button onClick={() => setActiveLayer(l)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 transition-colors"
                style={{ color: active ? meta.color : "var(--text-secondary)" }}>
                <Icon className="w-3.5 h-3.5 shrink-0" />
                <span className="text-xs font-semibold">{meta.label}</span>
                {l === "org" && <span className="text-xs" style={{ color: active ? meta.color : "var(--text-muted)" }}>· {nodeName("org")}</span>}
              </button>

              {/* Node picker for company / branch / area */}
              {node && (
                <div className="pr-1" style={{ borderLeft: `1px solid ${active ? meta.color + "55" : "var(--border)"}` }}>
                  <UiSelect size="sm" value={node.value}
                    onChange={(v) => { node.set(v); setActiveLayer(l); }}
                    options={node.options.length ? node.options : [{ value: "", label: "None available" }]}
                    placeholder={`Select ${meta.label.toLowerCase()}…`} />
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
