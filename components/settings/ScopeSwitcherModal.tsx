"use client";

// ─── ScopeSwitcherModal ───────────────────────────────────
// A centered popup for changing the editing layer (and node) for a settings
// section. Only offers the layers the section actually supports, so you can't
// switch to a layer where the setting isn't editable. Changes apply live; Done
// closes.

import { useEffect } from "react";
import { X, Building2, Building, MapPin, Map, Check } from "lucide-react";
import UiSelect from "@/components/ui/Select";
import { useSettingsScope } from "@/components/providers/SettingsScopeProvider";
import { effectiveLayers, LAYER_META, type Layer, type SectionLayers } from "@/lib/settings-scope/types";

const LAYER_ICON: Record<Layer, typeof Building2> = {
  org: Building2, company: Building, location: MapPin, service_area: Map,
};

const LAYER_DESC: Record<Layer, string> = {
  org: "Applies to your entire organization — every company and branch.",
  company: "Applies to all branches under the selected company.",
  location: "Applies to one branch only.",
  service_area: "Applies to one service area only.",
};

export default function ScopeSwitcherModal({ sectionLayers, onClose }: { sectionLayers: SectionLayers; onClose: () => void }) {
  const {
    activeLayer, setActiveLayer, available,
    companyId, locationId, serviceAreaId, setCompanyId, setLocationId, setServiceAreaId,
    companyOptions, locationOptions, areaOptions,
  } = useSettingsScope();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const eff = effectiveLayers(sectionLayers, available);
  const layers = (eff === "any" ? [] : eff) as Layer[];

  const nodeFor = (l: Layer) => {
    if (l === "company") return { value: companyId, set: setCompanyId, options: companyOptions };
    if (l === "location") return { value: locationId, set: setLocationId, options: locationOptions };
    if (l === "service_area") return { value: serviceAreaId, set: setServiceAreaId, options: areaOptions };
    return null;
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div role="dialog" aria-modal="true" className="w-full max-w-md rounded-2xl overflow-hidden" onClick={e => e.stopPropagation()}
        style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-subtle)", boxShadow: "0 16px 48px rgba(0,0,0,0.24)" }}>
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
          <div>
            <p className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>Change editing scope</p>
            <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>Choose which level changes to this section apply to.</p>
          </div>
          <button onClick={onClose} style={{ color: "var(--text-muted)" }}><X className="w-4 h-4" /></button>
        </div>

        <div className="px-6 py-4 space-y-2">
          {layers.map(l => {
            const lm = LAYER_META[l];
            const Icon = LAYER_ICON[l];
            const isActive = activeLayer === l;
            const picker = nodeFor(l);
            return (
              <div key={l} className="rounded-xl p-3 transition-all"
                style={{ border: `1.5px solid ${isActive ? lm.color : "var(--border)"}`, backgroundColor: isActive ? lm.color + "0f" : "var(--bg-surface-2)" }}>
                <button onClick={() => setActiveLayer(l)} className="w-full flex items-start gap-3 text-left">
                  <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5"
                    style={{ backgroundColor: isActive ? lm.color : "var(--bg-input)", color: isActive ? "#fff" : "var(--text-muted)" }}>
                    {isActive ? <Check className="w-3.5 h-3.5" /> : <Icon className="w-3.5 h-3.5" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold" style={{ color: isActive ? lm.color : "var(--text-primary)" }}>{lm.label}</p>
                    <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{LAYER_DESC[l]}</p>
                  </div>
                </button>
                {picker && (
                  <div className="mt-2.5 pl-9" onClick={e => e.stopPropagation()}>
                    <UiSelect size="sm" value={picker.value}
                      onChange={v => { picker.set(v); setActiveLayer(l); }}
                      options={picker.options.length ? picker.options : [{ value: "", label: "None available" }]}
                      placeholder={`Select ${lm.label.toLowerCase()}…`} />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="px-6 py-4 flex justify-end" style={{ borderTop: "1px solid var(--border-subtle)" }}>
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-medium bg-indigo-600 hover:bg-indigo-700 text-white transition-colors">Done</button>
        </div>
      </div>
    </div>
  );
}
