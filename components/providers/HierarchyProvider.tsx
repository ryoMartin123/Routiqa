"use client";

// Holds the active Company / Location / Service Area selection and exposes the
// authorized option lists for the signed-in user. Selection persists across
// navigation within the session (sessionStorage).
//
// showCompanySelector / showLocationSelector / showServiceAreaSelector are gated
// by BOTH the user's authorized options AND the org's OrgSettings feature flags.
// This lets simple single-location businesses hide the selectors entirely.

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  authorizedCompanies,
  authorizedLocations,
  authorizedServiceAreas,
  currentUser,
  organization,
  orgSettings as defaultOrgSettings,
  MODE_PRESETS,
  roleLabel,
} from "@/lib/hierarchy/data";
import type {
  Company,
  HierarchyMode,
  Location,
  OrgSettings,
  Organization,
  SelectionValue,
  ServiceArea,
} from "@/lib/hierarchy/types";

interface HierarchyContextValue {
  organization: Organization;
  userName: string;
  userInitials: string;
  userRole: string;

  // Raw selection ("all" or an id).
  company: SelectionValue;
  location: SelectionValue;
  serviceArea: SelectionValue;

  setCompany: (v: SelectionValue) => void;
  setLocation: (v: SelectionValue) => void;
  setServiceArea: (v: SelectionValue) => void;

  // Authorized options for the current user, cascaded by the selection above.
  companyOptions: Company[];
  locationOptions: Location[];
  serviceAreaOptions: ServiceArea[];

  // Gated by both options count AND orgSettings feature flags.
  showCompanySelector: boolean;
  showLocationSelector: boolean;
  showServiceAreaSelector: boolean;

  // Resolved filter values for queries ("all" -> undefined).
  effectiveCompanyId?: string;
  effectiveLocationId?: string;
  effectiveServiceAreaId?: string;

  // Friendly label for the sidebar header (active company / location).
  activeScopeLabel: string;

  // Business structure config — readable and settable from the settings page.
  orgSettings: OrgSettings;
  setOrgMode: (mode: HierarchyMode) => void;
}

const HierarchyContext = createContext<HierarchyContextValue | null>(null);

export function useHierarchy(): HierarchyContextValue {
  const ctx = useContext(HierarchyContext);
  if (!ctx) throw new Error("useHierarchy must be used within HierarchyProvider");
  return ctx;
}

const STORAGE_KEY = "crm-hierarchy";
const SETTINGS_KEY = "crm-org-settings";

function resolve(v: SelectionValue): string | undefined {
  return v === "all" ? undefined : v;
}

export function HierarchyProvider({ children }: { children: React.ReactNode }) {
  const user = currentUser;

  const [company, setCompanyState]       = useState<SelectionValue>("all");
  const [location, setLocationState]     = useState<SelectionValue>("all");
  const [serviceArea, setServiceAreaState] = useState<SelectionValue>("all");

  // Org settings are persisted in localStorage so the settings page demo works.
  const [settings, setSettings] = useState<OrgSettings>(defaultOrgSettings);

  // Restore persisted state on mount — validate IDs against current options
  // so stale IDs (from dev changes or location renames) don't filter out all records.
  useEffect(() => {
    try {
      const rawSel = sessionStorage.getItem(STORAGE_KEY);
      if (rawSel) {
        const saved = JSON.parse(rawSel) as Partial<Record<"company" | "location" | "serviceArea", SelectionValue>>;

        // Validate against the full authorized sets (no cascaded filter at restore time).
        const allCompanies = authorizedCompanies(user);
        const allLocations = authorizedLocations(user);

        const coOk  = !saved.company     || saved.company    === "all" || allCompanies.some(c => c.id === saved.company);
        const locOk = !saved.location    || saved.location   === "all" || allLocations.some(l => l.id === saved.location);

        if (saved.company     && coOk)  setCompanyState(saved.company);
        if (saved.location    && locOk) setLocationState(saved.location);
        if (saved.serviceArea)          setServiceAreaState(saved.serviceArea);

        // Clear stale storage if any key was invalid.
        if (!coOk || !locOk) sessionStorage.removeItem(STORAGE_KEY);
      }
    } catch { /* ignore */ }

    try {
      const rawSettings = localStorage.getItem(SETTINGS_KEY);
      if (rawSettings) {
        const saved = JSON.parse(rawSettings) as OrgSettings;
        if (saved.mode) setSettings(saved);
      }
    } catch { /* ignore */ }
  }, []);

  function persistSelection(next: { company: SelectionValue; location: SelectionValue; serviceArea: SelectionValue }) {
    try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* ignore */ }
  }

  // Setters cascade: changing a level resets children to "all".
  function setCompany(v: SelectionValue) {
    setCompanyState(v); setLocationState("all"); setServiceAreaState("all");
    persistSelection({ company: v, location: "all", serviceArea: "all" });
  }
  function setLocation(v: SelectionValue) {
    setLocationState(v); setServiceAreaState("all");
    persistSelection({ company, location: v, serviceArea: "all" });
  }
  function setServiceArea(v: SelectionValue) {
    setServiceAreaState(v);
    persistSelection({ company, location, serviceArea: v });
  }

  // Switch business structure mode using presets.
  function setOrgMode(mode: HierarchyMode) {
    const next = MODE_PRESETS[mode];
    setSettings(next);
    // Reset selections that are no longer applicable.
    if (!next.multiCompany)   { setCompanyState("all"); }
    if (!next.multiLocation)  { setLocationState("all"); }
    if (!next.serviceAreasEnabled) { setServiceAreaState("all"); }
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(next)); } catch { /* ignore */ }
  }

  const companyOptions  = useMemo(() => authorizedCompanies(user), [user]);
  const locationOptions = useMemo(() => authorizedLocations(user, resolve(company)), [user, company]);
  const serviceAreaOptions = useMemo(() => authorizedServiceAreas(user, resolve(location)), [user, location]);

  // Gate each selector through BOTH the data (are there options?) AND
  // the org feature flags (has the admin enabled this layer?).
  const showCompanySelector     = settings.multiCompany      && companyOptions.length > 1;
  const showLocationSelector    = settings.multiLocation     && locationOptions.length > 1;
  const showServiceAreaSelector = settings.serviceAreasEnabled && serviceAreaOptions.length > 0;

  const effectiveCompanyId =
    resolve(company) ?? (companyOptions.length === 1 ? companyOptions[0].id : undefined);
  const effectiveLocationId =
    resolve(location) ?? (locationOptions.length === 1 ? locationOptions[0].id : undefined);
  const effectiveServiceAreaId = resolve(serviceArea);

  const activeScopeLabel = useMemo(() => {
    const loc = locationOptions.find((l) => l.id === effectiveLocationId);
    if (loc) return loc.name;
    const co = companyOptions.find((c) => c.id === effectiveCompanyId);
    if (co) return co.name;
    return "All locations";
  }, [companyOptions, locationOptions, effectiveCompanyId, effectiveLocationId]);

  const value: HierarchyContextValue = {
    organization,
    userName: user.fullName,
    userInitials: user.initials,
    userRole: roleLabel(user),
    company, location, serviceArea,
    setCompany, setLocation, setServiceArea,
    companyOptions, locationOptions, serviceAreaOptions,
    showCompanySelector, showLocationSelector, showServiceAreaSelector,
    effectiveCompanyId, effectiveLocationId, effectiveServiceAreaId,
    activeScopeLabel,
    orgSettings: settings,
    setOrgMode,
  };

  return (
    <HierarchyContext.Provider value={value}>
      {children}
    </HierarchyContext.Provider>
  );
}
