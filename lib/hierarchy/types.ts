// Core hierarchy domain types: Organization -> Company -> Location -> Service Area
// These mirror the columns in supabase/migrations/0001_core_hierarchy.sql.

export type Status = "active" | "inactive";

export type HierarchyRole =
  | "org_admin"
  | "company_admin"
  | "location_manager"
  | "employee";

export interface Organization {
  id: string;
  name: string;
  status: Status;
}

export interface Company {
  id: string;
  organizationId: string;
  name: string;
  industry?: string;
  primaryColor?: string;
  status: Status;
}

export interface Location {
  id: string;
  organizationId: string;
  companyId: string;
  name: string;
  city?: string;
  state?: string;
  status: Status;
}

export interface ServiceArea {
  id: string;
  organizationId: string;
  companyId: string;
  locationId: string;
  name: string;
  status: Status;
}

// A grant of a role at a scope. Resolution is downward from the scope.
//   org_admin        -> companyId & locationId undefined
//   company_admin    -> companyId set, locationId undefined
//   location_manager -> companyId + locationId set
//   employee         -> companyId + locationId set
export interface Membership {
  organizationId: string;
  role: HierarchyRole;
  companyId?: string;
  locationId?: string;
}

export interface CurrentUser {
  id: string;
  fullName: string;
  initials: string;
  organizationId: string;
  memberships: Membership[];
}

// "all" = the All option at a level (only offered where the user is authorized
// for the whole level). null = nothing selected yet / not applicable.
export type SelectionValue = string | "all";

// ─── Business structure modes ─────────────────────────────
// Admins set this in Settings → Organization → Business Structure.
// The UI adapts — unused layers are hidden entirely.
export type HierarchyMode =
  | "simple"              // 1 company, 1 location, no territories
  | "multi_location"      // 1 company, multiple locations
  | "multi_company"       // multiple companies + locations
  | "advanced_territory"; // full hierarchy + service areas

export interface OrgSettings {
  mode: HierarchyMode;
  // Hierarchy layer visibility
  multiCompany: boolean;
  multiLocation: boolean;
  serviceAreasEnabled: boolean;
  // Module availability
  projectsEnabled: boolean;
  agreementsEnabled: boolean;
  marketingEnabled: boolean;
  // Preferences
  customerQuickAdd: boolean;   // offer the fast name+phone "Quick Add" path on the New Customer modal
}
