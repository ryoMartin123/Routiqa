// ─── Roles & permissions — capability layer ───────────────
// This sits ON TOP of the hierarchy auth in lib/hierarchy (which already decides
// WHICH companies/locations a user can see, via CurrentUser.memberships). Here we
// add WHAT a user can do/see within that scope: per-resource actions, field
// masks, and sensitive-action flags.
//
// Permissions = Scope × Capability. Scope comes from the membership (hierarchy);
// capability comes from the membership's role, resolved against ROLE_PRESETS.
//
// Maps to future DB: a `roles` table (system + custom rows) and policies keyed on
// organization_id / company_id / location_id / service_area_id.

import type { HierarchyRole } from "@/lib/hierarchy/types";

// ─── Resources (modules a capability can target) ──────────
export type Resource =
  | "dashboard"
  | "customers"
  | "contacts"
  | "leads"
  | "deals"
  | "jobs"
  | "projects"
  | "tasks"
  | "files"
  | "agreements"
  | "marketing"
  | "communications"
  | "calendar"        // calendar / dispatch
  | "quotes"
  | "invoices"
  | "payments"
  | "reports"
  | "items"           // price book / catalog
  | "settings"
  | "users"
  | "hierarchy"       // companies / locations / service areas
  | "billing";

// ─── Actions ──────────────────────────────────────────────
export type Action =
  | "view"
  | "create"
  | "edit"
  | "delete"          // = deactivate (we soft-delete business records)
  | "assign"
  | "approve"
  | "export"
  | "configure";

// none < own < all.  "own" = records where assigned_to / created_by = me.
export type AccessLevel = "none" | "own" | "all";

// ─── Field masks (the v1 sensitive-data layer) ────────────
// Default hidden; a role must grant the flag to reveal the field/section.
export type FieldMask =
  | "finance_cost_margin"       // item cost, markup, margin
  | "finance_totals"            // quote/invoice totals, balances, payments
  | "finance_payroll"           // labor cost / pay rates
  | "comms_internal_notes"      // internal-only notes
  | "sales_other_commissions";  // other reps' commissions

// ─── Sensitive-action flags ───────────────────────────────
export type SensitiveFlag =
  | "hierarchy_manage"          // create/deactivate companies·locations·areas
  | "users_manage"             // invite/edit users & their assignments
  | "roles_manage"             // edit role definitions / custom roles
  | "billing_manage"           // change subscription / billing
  | "reports_cross_scope"      // cross-company / cross-location reporting
  | "records_deactivate"       // deactivate business records
  | "automation_manage";        // marketing/automation rules

// ─── Role keys ────────────────────────────────────────────
// A role key is any string: built-in defaults (see DEFAULT_ROLE_KEYS) plus
// admin-created custom roles. Kept as `string` (rather than a closed union) so
// the custom-role builder can mint new keys without a type change. HierarchyRole
// keys are a subset, so existing hierarchy memberships still resolve.
export type RoleKey = string;

// The built-in roles shipped by default (HVAC preset). Custom roles live
// alongside these in the roles store.
export const DEFAULT_ROLE_KEYS = [
  "org_owner",
  "org_admin",
  "branch_manager",
  "location_manager",
  "dispatcher",
  "field_technician",
  "installer",
  "salesperson",
] as const;

// ─── Capability map ───────────────────────────────────────
export type CapabilityMap = Partial<Record<Resource, Partial<Record<Action, AccessLevel>>>>;

export interface RoleDefinition {
  key: RoleKey;
  label: string;
  description: string;
  system: boolean;              // preset (not user-editable) vs future custom role
  scopeTier: HierarchyRole;     // which hierarchy tier this role implies for visibility
  /** When true, grants every action on every resource except RESTRICTED_RESOURCES
   *  (within the membership's scope). Used by org/company admins to avoid an
   *  exhaustive map. */
  allAccess?: boolean;
  capabilities: CapabilityMap;
  masks: FieldMask[];
  flags: SensitiveFlag[];
}

// Resources that allAccess does NOT cover — they always require an explicit grant.
export const RESTRICTED_RESOURCES: Resource[] = ["billing"];

// ─── Resolution context ───────────────────────────────────
// Optional record context for a permission check. Omit for a "can they do this
// anywhere?" module-level check.
export interface PermissionContext {
  companyId?: string;
  locationId?: string;
  serviceAreaId?: string;
  ownedByMe?: boolean;          // is the record assigned to / created by the user?
}

// ─── Principal ────────────────────────────────────────────
// What the resolver actually consumes — decoupled from any specific user model.
// A grant is one role at one scope (org-wide when no ids are set). Adapters in
// principal.ts build this from the hierarchy CurrentUser or a directory AppUser.
export interface RoleGrant {
  role: RoleKey;
  companyId?: string;
  locationId?: string;
  serviceAreaId?: string;
}

export interface Principal {
  id: string;
  name: string;
  grants: RoleGrant[];
}
