"use client";

// ─── SettingsScopeProvider ────────────────────────────────
// Holds the single "which layer am I editing" state shared by every settings
// page: the active layer plus the selected Company / Branch / Service-Area node.
// Defaults to Organization; node ids seed from the current top-bar selection for
// convenience. Read it with useSettingsScope().

import { createContext, useContext, useMemo, useState } from "react";
import { useHierarchy } from "@/components/providers/HierarchyProvider";
import { serviceAreas as ALL_SERVICE_AREAS } from "@/lib/hierarchy/data";
import { availableLayers as computeAvailable, type Layer } from "@/lib/settings-scope/types";

interface NodeOption { value: string; label: string }

interface SettingsScopeValue {
  activeLayer: Layer;
  setActiveLayer: (l: Layer) => void;
  available: Layer[];

  companyId: string;
  locationId: string;
  serviceAreaId: string;
  setCompanyId: (id: string) => void;
  setLocationId: (id: string) => void;
  setServiceAreaId: (id: string) => void;

  companyOptions: NodeOption[];
  locationOptions: NodeOption[];
  areaOptions: NodeOption[];

  nodeName: (l: Layer) => string;
}

const Ctx = createContext<SettingsScopeValue | null>(null);

export function SettingsScopeProvider({ children }: { children: React.ReactNode }) {
  const {
    orgSettings, organization, allCompanies, allLocations,
    effectiveCompanyId, effectiveLocationId, effectiveServiceAreaId,
  } = useHierarchy();

  const companies = useMemo(() => allCompanies.filter(c => c.status === "active"), [allCompanies]);
  const locations = useMemo(() => allLocations.filter(l => l.status === "active"), [allLocations]);
  const areas = useMemo(() => ALL_SERVICE_AREAS.filter(a => a.status === "active"), []);

  const available = useMemo(() => computeAvailable(orgSettings), [orgSettings]);

  const [activeLayer, setActiveLayerState] = useState<Layer>("org");
  const [companyId, setCompanyIdState] = useState<string>(() => effectiveCompanyId ?? companies[0]?.id ?? "");
  const [locationId, setLocationIdState] = useState<string>(() => effectiveLocationId ?? "");
  const [serviceAreaId, setServiceAreaIdState] = useState<string>(() => effectiveServiceAreaId ?? "");

  // ── Node option lists (cascade down the current selection) ──
  const companyOptions = useMemo<NodeOption[]>(
    () => companies.map(c => ({ value: c.id, label: c.name })), [companies],
  );
  const locationOptions = useMemo<NodeOption[]>(
    () => locations.filter(l => !companyId || l.companyId === companyId).map(l => ({ value: l.id, label: l.name })),
    [locations, companyId],
  );
  const areaOptions = useMemo<NodeOption[]>(
    () => areas.filter(a => !locationId || a.locationId === locationId).map(a => ({ value: a.id, label: a.name })),
    [areas, locationId],
  );

  // ── Setters (keep the chain coherent) ──
  function setCompanyId(id: string) {
    setCompanyIdState(id);
    setLocationIdState("");
    setServiceAreaIdState("");
  }
  function setLocationId(id: string) {
    setLocationIdState(id);
    const loc = locations.find(l => l.id === id);
    if (loc) setCompanyIdState(loc.companyId);
    setServiceAreaIdState("");
  }
  function setServiceAreaId(id: string) {
    setServiceAreaIdState(id);
    const a = areas.find(s => s.id === id);
    if (a) { setLocationIdState(a.locationId); setCompanyIdState(a.companyId); }
  }

  // Switching layer auto-selects a node for that layer if none is chosen yet.
  function setActiveLayer(l: Layer) {
    setActiveLayerState(l);
    if (l === "company" && !companyId) {
      setCompanyIdState(companies[0]?.id ?? "");
    }
    if (l === "location" && !locationId) {
      const first = locations.find(loc => !companyId || loc.companyId === companyId) ?? locations[0];
      if (first) { setLocationIdState(first.id); setCompanyIdState(first.companyId); }
    }
    if (l === "service_area" && !serviceAreaId) {
      const first = areas.find(a => !locationId || a.locationId === locationId) ?? areas[0];
      if (first) { setServiceAreaIdState(first.id); setLocationIdState(first.locationId); setCompanyIdState(first.companyId); }
    }
  }

  function nodeName(l: Layer): string {
    if (l === "org") return organization.name;
    if (l === "company") return companies.find(c => c.id === companyId)?.name ?? "Select company…";
    if (l === "location") return locations.find(x => x.id === locationId)?.name ?? "Select branch…";
    return areas.find(a => a.id === serviceAreaId)?.name ?? "Select area…";
  }

  const value: SettingsScopeValue = {
    activeLayer, setActiveLayer, available,
    companyId, locationId, serviceAreaId,
    setCompanyId, setLocationId, setServiceAreaId,
    companyOptions, locationOptions, areaOptions,
    nodeName,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSettingsScope(): SettingsScopeValue {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useSettingsScope must be used within SettingsScopeProvider");
  return ctx;
}
