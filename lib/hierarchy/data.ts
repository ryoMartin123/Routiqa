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
  { id: "co_hvac", organizationId: ORG_ID, name: "Northstar HVAC", industry: "hvac", primaryColor: "#4f46e5", status: "active" },
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
const DEFAULT_MODULES = { projectsEnabled: true, agreementsEnabled: true, marketingEnabled: true };

export const orgSettings: OrgSettings = {
  mode: "advanced_territory",
  multiCompany: true,
  multiLocation: true,
  serviceAreasEnabled: true,
  ...DEFAULT_MODULES,
};

// Mode presets — hierarchy layers only. Module flags are preserved when switching modes.
export const MODE_PRESETS: Record<OrgSettings["mode"], Omit<OrgSettings, "projectsEnabled" | "agreementsEnabled" | "marketingEnabled">> = {
  simple:             { mode: "simple",             multiCompany: false, multiLocation: false, serviceAreasEnabled: false },
  multi_location:     { mode: "multi_location",     multiCompany: false, multiLocation: true,  serviceAreasEnabled: false },
  multi_company:      { mode: "multi_company",       multiCompany: true,  multiLocation: true,  serviceAreasEnabled: false },
  advanced_territory: { mode: "advanced_territory", multiCompany: true,  multiLocation: true,  serviceAreasEnabled: true  },
};

// Current signed-in user (prototype). Swap to a Supabase session lookup later.
// Marcus is an org_admin so all three selectors are demonstrable; change the
// membership to see the selectors collapse for narrower roles.
export const currentUser: CurrentUser = {
  id: "user_marcus",
  fullName: "Marcus Reyes",
  initials: "MR",
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

const COMPANIES_KEY = "crm-extra-companies";
const LOCATIONS_KEY = "crm-extra-locations";

let _extraCompanies: Company[] | null = null;
let _extraLocations: Location[] | null = null;

function extraCompanies(): Company[] {
  if (_extraCompanies) return _extraCompanies;
  if (typeof window === "undefined") return [];
  try { const r = localStorage.getItem(COMPANIES_KEY); _extraCompanies = r ? JSON.parse(r) : []; }
  catch { _extraCompanies = []; }
  return _extraCompanies!;
}

function extraLocations(): Location[] {
  if (_extraLocations) return _extraLocations;
  if (typeof window === "undefined") return [];
  try { const r = localStorage.getItem(LOCATIONS_KEY); _extraLocations = r ? JSON.parse(r) : []; }
  catch { _extraLocations = []; }
  return _extraLocations!;
}

// Full collections (seed + session). These are the source of truth for the
// selectors, settings management screens, and authorization helpers.
export function getAllCompanies(): Company[] { return [...companies, ...extraCompanies()]; }
export function getAllLocations(): Location[] { return [...locations, ...extraLocations()]; }
export function getAllServiceAreas(): ServiceArea[] { return serviceAreas; }

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
