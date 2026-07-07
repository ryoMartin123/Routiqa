// Mock hierarchy data + authorization helpers.
//
// In production these collections come from Supabase (filtered by RLS); the
// prototype uses in-memory data that matches supabase/seed.sql. The
// authorization helpers below are the single source of truth for "what can this
// user see" and are written to work identically against real data.

import type {
  Company,
  CurrentUser,
  Location,
  OrgSettings,
  Organization,
  ServiceArea,
} from "./types";

const ORG_ID = "org_northstar";

export const organization: Organization = {
  id: ORG_ID,
  name: "Northstar Holdings",
  status: "active",
};

export const companies: Company[] = [
  { id: "co_hvac", organizationId: ORG_ID, name: "Northstar HVAC", industry: "hvac", primaryColor: "#0f8578", status: "active" },
  { id: "co_roofing", organizationId: ORG_ID, name: "Northstar Roofing", industry: "roofing", primaryColor: "#0891b2", status: "active" },
];

export const locations: Location[] = [
  { id: "loc_augusta",  organizationId: ORG_ID, companyId: "co_hvac",    name: "Augusta Branch",  city: "Augusta",  state: "GA", status: "active" },
  { id: "loc_evans",    organizationId: ORG_ID, companyId: "co_hvac",    name: "Evans Branch",    city: "Evans",    state: "GA", status: "active" },
  { id: "loc_columbia", organizationId: ORG_ID, companyId: "co_roofing", name: "Columbia Branch", city: "Columbia", state: "SC", status: "active" },
];

export const serviceAreas: ServiceArea[] = [
  { id: "sa_augusta",   organizationId: ORG_ID, companyId: "co_hvac",    locationId: "loc_augusta",  name: "Augusta, GA",       status: "active" },
  { id: "sa_martinez",  organizationId: ORG_ID, companyId: "co_hvac",    locationId: "loc_augusta",  name: "Martinez, GA",      status: "active" },
  { id: "sa_grovetown", organizationId: ORG_ID, companyId: "co_hvac",    locationId: "loc_augusta",  name: "Grovetown, GA",     status: "active" },
  { id: "sa_n_augusta", organizationId: ORG_ID, companyId: "co_hvac",    locationId: "loc_augusta",  name: "North Augusta, SC", status: "active" },
  { id: "sa_evans",     organizationId: ORG_ID, companyId: "co_hvac",    locationId: "loc_evans",    name: "Evans, GA",         status: "active" },
  { id: "sa_harlem",    organizationId: ORG_ID, companyId: "co_hvac",    locationId: "loc_evans",    name: "Harlem, GA",        status: "active" },
  { id: "sa_columbia",  organizationId: ORG_ID, companyId: "co_roofing", locationId: "loc_columbia", name: "Columbia, SC",      status: "active" },
  { id: "sa_aiken",     organizationId: ORG_ID, companyId: "co_roofing", locationId: "loc_columbia", name: "Aiken, SC",         status: "active" },
];

// ─── Organization settings ────────────────────────────────
// Stored in organization_settings table in production.
// Change mode here to see the UI adapt instantly.
// Default module flags — all on for the prototype.
const DEFAULT_MODULES = { projectsEnabled: true, agreementsEnabled: true, marketingEnabled: true, customerQuickAdd: false };

export const orgSettings: OrgSettings = {
  mode: "advanced_territory",
  multiCompany: true,
  multiLocation: true,
  serviceAreasEnabled: true,
  ...DEFAULT_MODULES,
};

// Mode presets — hierarchy layers only. Module flags are preserved when switching modes.
export const MODE_PRESETS: Record<OrgSettings["mode"], Omit<OrgSettings, "projectsEnabled" | "agreementsEnabled" | "marketingEnabled" | "customerQuickAdd">> = {
  simple:             { mode: "simple",             multiCompany: false, multiLocation: false, serviceAreasEnabled: false },
  multi_location:     { mode: "multi_location",     multiCompany: false, multiLocation: true,  serviceAreasEnabled: false },
  multi_company:      { mode: "multi_company",       multiCompany: true,  multiLocation: true,  serviceAreasEnabled: false },
  advanced_territory: { mode: "advanced_territory", multiCompany: true,  multiLocation: true,  serviceAreasEnabled: true  },
};

// Current signed-in user (prototype). Swap to a Supabase session lookup later.
// Ryo Martin is the org admin/owner so all three selectors are demonstrable;
// change the membership to see the selectors collapse for narrower roles.
export const currentUser: CurrentUser = {
  id: "user_marcus",
  fullName: "Ryo Martin",
  initials: "RM",
  organizationId: ORG_ID,
  memberships: [{ organizationId: ORG_ID, role: "org_admin" }],
};

// ---------------------------------------------------------------------------
// Authorization — resolve what a user can see, downward from their grants.
// All helpers consider only active records.
// ---------------------------------------------------------------------------

export function roleLabel(user: CurrentUser): string {
  const roles = new Set(user.memberships.map((m) => m.role));
  if (roles.has("org_admin")) return "Organization Admin";
  if (roles.has("company_admin")) return "Company Admin";
  if (roles.has("location_manager")) return "Location Manager";
  return "Employee";
}

export function authorizedCompanies(user: CurrentUser): Company[] {
  const active = getAllCompanies().filter((c) => c.status === "active");
  if (user.memberships.some((m) => m.role === "org_admin")) return active;

  const allowed = new Set<string>();
  for (const m of user.memberships) {
    if (m.companyId) allowed.add(m.companyId);
    if (m.locationId) {
      const loc = getAllLocations().find((l) => l.id === m.locationId);
      if (loc) allowed.add(loc.companyId);
    }
  }
  return active.filter((c) => allowed.has(c.id));
}

export function authorizedLocations(
  user: CurrentUser,
  companyId?: string,
): Location[] {
  let active = getAllLocations().filter((l) => l.status === "active");
  if (companyId && companyId !== "all") {
    active = active.filter((l) => l.companyId === companyId);
  }

  const isOrgAdmin = user.memberships.some((m) => m.role === "org_admin");
  const companyAdminScopes = user.memberships
    .filter((m) => m.role === "company_admin" && m.companyId)
    .map((m) => m.companyId);
  const locationScopes = new Set(
    user.memberships.filter((m) => m.locationId).map((m) => m.locationId),
  );

  if (isOrgAdmin) return active;

  return active.filter(
    (l) =>
      companyAdminScopes.includes(l.companyId) || locationScopes.has(l.id),
  );
}

export function authorizedServiceAreas(
  user: CurrentUser,
  locationId?: string,
): ServiceArea[] {
  if (!locationId || locationId === "all") return [];

  // The user must be authorized for the parent location.
  const allowedLocationIds = new Set(
    authorizedLocations(user).map((l) => l.id),
  );
  if (!allowedLocationIds.has(locationId)) return [];

  return getAllServiceAreas().filter(
    (sa) => sa.status === "active" && sa.locationId === locationId,
  );
}

// ---------------------------------------------------------------------------
// Runtime hierarchy store
// ---------------------------------------------------------------------------
// Companies and locations created in-session (e.g. via the Add Location / Add
// Company wizards) persist to localStorage so admins can grow their structure
// without a backend. Mirrors the seed + override pattern used by lib/jobs/data.
// Server-side renders see seed data only (window undefined).

const COMPANIES_KEY      = "crm-extra-companies";
const LOCATIONS_KEY      = "crm-extra-locations";
const SERVICE_AREAS_KEY  = "crm-extra-service-areas";
// Overrides persist edits (rename, city/state, status) to *seed* records
// without mutating the constant arrays — mirrors the jobs override pattern.
const CO_OV_KEY  = "crm-company-overrides";
const LOC_OV_KEY = "crm-location-overrides";
const SA_OV_KEY  = "crm-service-area-overrides";
const ORG_KEY    = "crm-organization-override";
// Deleted-id lists (so seed records can be removed without mutating the consts).
const CO_DEL_KEY  = "crm-deleted-companies";
const LOC_DEL_KEY = "crm-deleted-locations";
const SA_DEL_KEY  = "crm-deleted-service-areas";

let _extraCompanies:    Company[] | null = null;
let _extraLocations:    Location[] | null = null;
let _extraServiceAreas: ServiceArea[] | null = null;
let _companyOv:     Record<string, Partial<Company>> | null = null;
let _locationOv:    Record<string, Partial<Location>> | null = null;
let _serviceAreaOv: Record<string, Partial<ServiceArea>> | null = null;
let _orgOverride:   Partial<Organization> | null = null;
let _deletedCo:  string[] | null = null;
let _deletedLoc: string[] | null = null;
let _deletedSa:  string[] | null = null;

function readJSON<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try { const r = localStorage.getItem(key); return r ? (JSON.parse(r) as T) : fallback; }
  catch { return fallback; }
}
function writeJSON(key: string, value: unknown): void {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* ignore */ }
}

function extraCompanies(): Company[]       { return (_extraCompanies    ??= readJSON(COMPANIES_KEY, [])); }
function extraLocations(): Location[]      { return (_extraLocations    ??= readJSON(LOCATIONS_KEY, [])); }
function extraServiceAreas(): ServiceArea[]{ return (_extraServiceAreas ??= readJSON(SERVICE_AREAS_KEY, [])); }
function companyOv():     Record<string, Partial<Company>>     { return (_companyOv     ??= readJSON(CO_OV_KEY, {})); }
function locationOv():    Record<string, Partial<Location>>    { return (_locationOv    ??= readJSON(LOC_OV_KEY, {})); }
function serviceAreaOv(): Record<string, Partial<ServiceArea>> { return (_serviceAreaOv ??= readJSON(SA_OV_KEY, {})); }
function orgOverride():   Partial<Organization>                { return (_orgOverride   ??= readJSON(ORG_KEY, {})); }

function applyCoOv(c: Company): Company         { const o = companyOv()[c.id];     return o ? { ...c, ...o } : c; }
function applyLocOv(l: Location): Location      { const o = locationOv()[l.id];    return o ? { ...l, ...o } : l; }
function applySaOv(s: ServiceArea): ServiceArea { const o = serviceAreaOv()[s.id]; return o ? { ...s, ...o } : s; }

function deletedCo():  string[] { return (_deletedCo  ??= readJSON(CO_DEL_KEY, [])); }
function deletedLoc(): string[] { return (_deletedLoc ??= readJSON(LOC_DEL_KEY, [])); }
function deletedSa():  string[] { return (_deletedSa  ??= readJSON(SA_DEL_KEY, [])); }

// Full collections (seed + session, with overrides applied, deleted removed).
// Source of truth for the selectors, settings management screens, and auth helpers.
export function getAllCompanies(): Company[] {
  const del = new Set(deletedCo());
  return [...companies, ...extraCompanies()].filter(c => !del.has(c.id)).map(applyCoOv);
}
export function getAllLocations(): Location[] {
  const del = new Set(deletedLoc());
  return [...locations, ...extraLocations()].filter(l => !del.has(l.id)).map(applyLocOv);
}
export function getAllServiceAreas(): ServiceArea[] {
  const del = new Set(deletedSa());
  return [...serviceAreas, ...extraServiceAreas()].filter(s => !del.has(s.id)).map(applySaOv);
}

function markDeleted(key: string, ref: string[], id: string): string[] {
  if (ref.includes(id)) return ref;
  const next = [...ref, id];
  writeJSON(key, next);
  return next;
}

// Organization with any saved override (e.g. renamed) applied.
export function getOrganization(): Organization { return { ...organization, ...orgOverride() }; }
export function updateOrganization(patch: Partial<Organization>): Organization {
  _orgOverride = { ...orgOverride(), ...patch };
  writeJSON(ORG_KEY, _orgOverride);
  return getOrganization();
}

// Active-record counts drive the ratchet: a hierarchy layer can only be turned
// OFF while at most one active record depends on it.
export function activeCompanyCount(): number {
  return getAllCompanies().filter((c) => c.status === "active").length;
}
export function activeLocationCount(companyId?: string): number {
  return getAllLocations().filter(
    (l) => l.status === "active" && (!companyId || l.companyId === companyId),
  ).length;
}

export interface NewCompanyInput { name: string; industry?: string; primaryColor?: string; }
export function createCompany(input: NewCompanyInput): Company {
  const co: Company = {
    id: `co-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
    organizationId: ORG_ID,
    name: input.name.trim(),
    industry: input.industry,
    primaryColor: input.primaryColor,
    status: "active",
  };
  _extraCompanies = [...extraCompanies(), co];
  try { localStorage.setItem(COMPANIES_KEY, JSON.stringify(_extraCompanies)); } catch { /* ignore */ }
  return co;
}

export interface NewLocationInput { companyId: string; name: string; city?: string; state?: string; }
export function createLocation(input: NewLocationInput): Location {
  const loc: Location = {
    id: `loc-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
    organizationId: ORG_ID,
    companyId: input.companyId,
    name: input.name.trim(),
    city: input.city,
    state: input.state,
    status: "active",
  };
  _extraLocations = [...extraLocations(), loc];
  try { localStorage.setItem(LOCATIONS_KEY, JSON.stringify(_extraLocations)); } catch { /* ignore */ }
  return loc;
}

export interface NewServiceAreaInput { locationId: string; companyId?: string; name: string; }
export function createServiceArea(input: NewServiceAreaInput): ServiceArea {
  const parentLoc = getAllLocations().find(l => l.id === input.locationId);
  const sa: ServiceArea = {
    id: `sa-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
    organizationId: ORG_ID,
    companyId: input.companyId ?? parentLoc?.companyId ?? "",
    locationId: input.locationId,
    name: input.name.trim(),
    status: "active",
  };
  _extraServiceAreas = [...extraServiceAreas(), sa];
  writeJSON(SERVICE_AREAS_KEY, _extraServiceAreas);
  return sa;
}

// ── Active-state helpers ───────────────────────────────────
export function isCompanyActive(id: string): boolean {
  return getAllCompanies().find(c => c.id === id)?.status === "active";
}
export function isLocationActive(id: string): boolean {
  return getAllLocations().find(l => l.id === id)?.status === "active";
}
// A location/service area may only be activated when its parents are active.
export function canActivateLocation(locationId: string): boolean {
  const loc = getAllLocations().find(l => l.id === locationId);
  return !!loc && isCompanyActive(loc.companyId);
}
export function canActivateServiceArea(serviceAreaId: string): boolean {
  const sa = getAllServiceAreas().find(s => s.id === serviceAreaId);
  if (!sa) return false;
  const loc = getAllLocations().find(l => l.id === sa.locationId);
  return !!loc && loc.status === "active" && isCompanyActive(loc.companyId);
}

// ── Updates ────────────────────────────────────────────────
// Session records mutate in place; seed records persist via overrides.
function writeCompany(id: string, patch: Partial<Company>) {
  if (extraCompanies().some(c => c.id === id)) {
    _extraCompanies = extraCompanies().map(c => c.id === id ? { ...c, ...patch } : c);
    writeJSON(COMPANIES_KEY, _extraCompanies);
  } else {
    _companyOv = { ...companyOv(), [id]: { ...companyOv()[id], ...patch } };
    writeJSON(CO_OV_KEY, _companyOv);
  }
}
function writeLocation(id: string, patch: Partial<Location>) {
  if (extraLocations().some(l => l.id === id)) {
    _extraLocations = extraLocations().map(l => l.id === id ? { ...l, ...patch } : l);
    writeJSON(LOCATIONS_KEY, _extraLocations);
  } else {
    _locationOv = { ...locationOv(), [id]: { ...locationOv()[id], ...patch } };
    writeJSON(LOC_OV_KEY, _locationOv);
  }
}
function writeServiceArea(id: string, patch: Partial<ServiceArea>) {
  if (extraServiceAreas().some(s => s.id === id)) {
    _extraServiceAreas = extraServiceAreas().map(s => s.id === id ? { ...s, ...patch } : s);
    writeJSON(SERVICE_AREAS_KEY, _extraServiceAreas);
  } else {
    _serviceAreaOv = { ...serviceAreaOv(), [id]: { ...serviceAreaOv()[id], ...patch } };
    writeJSON(SA_OV_KEY, _serviceAreaOv);
  }
}

export function updateCompany(id: string, patch: Partial<Company>): Company | undefined {
  writeCompany(id, patch);
  // Deactivating a company cascades down: its branches (and their service
  // areas) deactivate too — they can't operate without an active parent.
  if (patch.status === "inactive") {
    getAllLocations().filter(l => l.companyId === id && l.status === "active")
      .forEach(l => updateLocation(l.id, { status: "inactive" }));
  }
  return getAllCompanies().find(c => c.id === id);
}

export function updateLocation(id: string, patch: Partial<Location>): Location | undefined {
  const p = { ...patch };
  // Guard: can't activate a branch under an inactive company.
  if (p.status === "active") {
    const loc = getAllLocations().find(l => l.id === id);
    if (loc && !isCompanyActive(loc.companyId)) p.status = "inactive";
  }
  writeLocation(id, p);
  // Deactivating a branch cascades to its service areas.
  if (p.status === "inactive") {
    getAllServiceAreas().filter(s => s.locationId === id && s.status === "active")
      .forEach(s => writeServiceArea(s.id, { status: "inactive" }));
  }
  return getAllLocations().find(l => l.id === id);
}

export function updateServiceArea(id: string, patch: Partial<ServiceArea>): ServiceArea | undefined {
  const p = { ...patch };
  // Guard: can't activate a service area unless its branch AND company are active.
  if (p.status === "active") {
    const sa = getAllServiceAreas().find(s => s.id === id);
    const loc = sa ? getAllLocations().find(l => l.id === sa.locationId) : undefined;
    if (!loc || loc.status !== "active" || !isCompanyActive(loc.companyId)) p.status = "inactive";
  }
  writeServiceArea(id, p);
  return getAllServiceAreas().find(s => s.id === id);
}

// ── Deletes (hierarchy records only — cascade to children) ──
// Domain data (customers, jobs, …) is cascaded separately in lib/hierarchy/cascade.ts.
export function deleteServiceArea(id: string): void {
  _deletedSa = markDeleted(SA_DEL_KEY, deletedSa(), id);
  if (extraServiceAreas().some(s => s.id === id)) {
    _extraServiceAreas = extraServiceAreas().filter(s => s.id !== id);
    writeJSON(SERVICE_AREAS_KEY, _extraServiceAreas);
  }
}
export function deleteLocation(id: string): void {
  // Cascade to the location's service areas first.
  getAllServiceAreas().filter(s => s.locationId === id).forEach(s => deleteServiceArea(s.id));
  _deletedLoc = markDeleted(LOC_DEL_KEY, deletedLoc(), id);
  if (extraLocations().some(l => l.id === id)) {
    _extraLocations = extraLocations().filter(l => l.id !== id);
    writeJSON(LOCATIONS_KEY, _extraLocations);
  }
}
export function deleteCompany(id: string): void {
  // Cascade to branches (which cascade to service areas) + any orphan areas.
  getAllLocations().filter(l => l.companyId === id).forEach(l => deleteLocation(l.id));
  getAllServiceAreas().filter(s => s.companyId === id).forEach(s => deleteServiceArea(s.id));
  _deletedCo = markDeleted(CO_DEL_KEY, deletedCo(), id);
  if (extraCompanies().some(c => c.id === id)) {
    _extraCompanies = extraCompanies().filter(c => c.id !== id);
    writeJSON(COMPANIES_KEY, _extraCompanies);
  }
}
