// ─── Settings scope — the hierarchy "layer" you're editing ─
// Org → Company → Branch (location) → Service Area. A single SettingsScope
// (activeLayer + selected node) is shared across all settings pages so we never
// add a per-page layer picker. See components/providers/SettingsScopeProvider.

export type Layer = "org" | "company" | "location" | "service_area";

export const LAYER_ORDER: Layer[] = ["org", "company", "location", "service_area"];

export interface LayerMeta {
  key: Layer;
  label: string;   // "Branch" reads better than "location" in the UI
  color: string;   // layer identity color
}

export const LAYER_META: Record<Layer, LayerMeta> = {
  org:          { key: "org",          label: "Organization", color: "#0f8578" },
  company:      { key: "company",      label: "Company",      color: "#0d9488" },
  location:     { key: "location",     label: "Branch",       color: "#d97706" },
  service_area: { key: "service_area", label: "Service Area", color: "#059669" },
};

// Which layers exist for this org, given its hierarchy mode. Org is always
// present; the rest appear as the business turns the layers on.
export function availableLayers(s: {
  multiCompany: boolean; multiLocation: boolean; serviceAreasEnabled: boolean;
}): Layer[] {
  const out: Layer[] = ["org"];
  if (s.multiCompany)        out.push("company");
  if (s.multiLocation)       out.push("location");
  if (s.serviceAreasEnabled) out.push("service_area");
  return out;
}

// Where a settings section can be edited.
//   Layer[] — the specific layers it lives at
//   "any"   — personal/global setting, not layer-scoped (e.g. Appearance)
export type SectionLayers = Layer[] | "any";

// Resolve where a section is actually editable given the available layers.
// If none of its declared layers are turned on (e.g. a Branch-only setting in a
// single-location org), it collapses to Org — which is always available — so the
// setting never becomes unreachable.
export function effectiveLayers(section: SectionLayers, available: Layer[]): Layer[] | "any" {
  if (section === "any") return "any";
  const inter = section.filter(l => available.includes(l));
  return inter.length ? inter : ["org"];
}

// The layer a section should jump to when it's not editable at the active layer
// (the highest-priority applicable layer in canonical order).
export function jumpLayer(eff: Layer[]): Layer {
  return LAYER_ORDER.find(l => eff.includes(l)) ?? "org";
}
