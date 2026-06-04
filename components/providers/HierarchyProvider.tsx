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
  getAllCompanies,
  getAllLocations,
  createCompany,
  createLocation,
  activeCompanyCount,
  activeLocationCount,
} from "@/lib/hierarchy/data";
import type { NewCompanyInput, NewLocationInput } from "@/lib/hierarchy/data";
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
  setOrgSetting: <K extends keyof OrgSettings>(key: K, value: OrgSettings[K]) => void;

  // Full hierarchy collections (seed + session) for management screens.
  allCompanies: Company[];
  allLocations: Location[];

  // Guided growth — creating the 2nd company/location auto-enables its layer.
  addCompany: (input: NewCompanyInput) => Company;
  addLocation: (input: NewLocationInput) => Location;

  // Ratchet flags — a layer can only be turned OFF while ≤1 active record
  // depends on it. false ⇒ the toggle/mode that would collapse it is locked.
  canDisableMultiCompany: boolean;
  canDisableMultiLocation: boolean;
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

  // Bumped whenever a company/location is added so memoized lists recompute.
  const [hierarchyVersion, setHierarchyVersion] = useState(0);

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

  // Switch business structure mode — applies hierarchy preset, preserves module flags.
  // Ratchet guard: a preset that would collapse a layer is blocked while data
  // still depends on it. Growing (enabling layers) is always allowed.
  function setOrgMode(mode: HierarchyMode) {
    const preset = MODE_PRESETS[mode];
    if (!preset.multiCompany  && activeCompanyCount()  > 1) return;
    if (!preset.multiLocation && activeLocationCount() > 1) return;
    const next: OrgSettings = {
      ...settings,          // keep existing module flags
      ...preset,            // overwrite hierarchy flags + mode
    };
    setSettings(next);
    if (!next.multiCompany)        { setCompanyState("all"); }
    if (!next.multiLocation)       { setLocationState("all"); }
    if (!next.serviceAreasEnabled) { setServiceAreaState("all"); }
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(next)); } catch { /* ignore */ }
  }

  // Fine-grained update for individual toggle fields.
  function setOrgSetting<K extends keyof OrgSettings>(key: K, value: OrgSettings[K]) {
    // Ratchet guard: refuse to collapse a layer that data still depends on.
    if (key === "multiCompany"  && value === false && activeCompanyCount()  > 1) return;
    if (key === "multiLocation" && value === false && activeLocationCount() > 1) return;
    const next = { ...settings, [key]: value };
    // Sync mode if hierarchy flags now match a preset exactly.
    const match = (Object.keys(MODE_PRESETS) as HierarchyMode[]).find(m => {
      const p = MODE_PRESETS[m];
      return p.multiCompany === next.multiCompany &&
             p.multiLocation === next.multiLocation &&
             p.serviceAreasEnabled === next.serviceAreasEnabled;
    });
    if (match) next.mode = match;
    setSettings(next);
    // Reset selectors if a hierarchy layer was disabled.
    if (key === "multiCompany"      && !value) setCompanyState("all");
    if (key === "multiLocation"     && !value) setLocationState("all");
    if (key === "serviceAreasEnabled" && !value) setServiceAreaState("all");
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(next)); } catch { /* ignore */ }
  }

  // ── Guided growth ──────────────────────────────────────────
  // Adding a company/location persists it and, when it's the one that takes the
  // org from a single record to multiple, flips that hierarchy layer on so the
  // selector appears. The admin thinks "I'm adding a branch," not "I'm changing
  // my structure mode" — the mode change is a side effect.
  function addCompany(input: NewCompanyInput): Company {
    const co = createCompany(input);
    setHierarchyVersion((v) => v + 1);
    if (activeCompanyCount() > 1 && !settings.multiCompany) {
      setOrgSetting("multiCompany", true);
    }
    return co;
  }

  function addLocation(input: NewLocationInput): Location {
    const loc = createLocation(input);
    setHierarchyVersion((v) => v + 1);
    if (activeLocationCount() > 1 && !settings.multiLocation) {
      setOrgSetting("multiLocation", true);
    }
    return loc;
  }

  const companyOptions  = useMemo(() => authorizedCompanies(user), [user, hierarchyVersion]);
  const locationOptions = useMemo(() => authorizedLocations(user, resolve(company)), [user, company, hierarchyVersion]);
  const serviceAreaOptions = useMemo(() => authorizedServiceAreas(user, resolve(location)), [user, location, hierarchyVersion]);

  // Full collections for management screens (all statuses, no cascade filter).
  const allCompanies = useMemo(() => getAllCompanies(), [hierarchyVersion]);
  const allLocations = useMemo(() => getAllLocations(), [hierarchyVersion]);

  // Ratchet: only collapsible while at most one active record remains.
  const canDisableMultiCompany  = useMemo(() => activeCompanyCount()  <= 1, [hierarchyVersion]);
  const canDisableMultiLocation = useMemo(() => activeLocationCount() <= 1, [hierarchyVersion]);

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
    setOrgSetting,
    allCompanies,
    allLocations,
    addCompany,
    addLocation,
    canDisableMultiCompany,
    canDisableMultiLocation,
  };

  return (
    <HierarchyContext.Provider value={value}>
      {children}
    </HierarchyContext.Provider>
  );
}
