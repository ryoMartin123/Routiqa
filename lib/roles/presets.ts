// ─── Default roles (HVAC preset) ──────────────────────────
// The roles a fresh HVAC org ships with. They're plain data: the roles store
// (store.ts) seeds itself from these, after which admins can edit permissions or
// add custom roles. The resolver and matrix UI read whatever the store returns,
// so editing a role here vs. in the UI is the same shape.
//
// Missing resource ⇒ no access; missing action ⇒ "none". Org/branch admins use
// `allAccess` (scoped by their membership) instead of an exhaustive map.

import type { Action, AccessLevel, RoleDefinition, RoleKey } from "./types";

// Action-level shorthands.
const A: AccessLevel = "all";
const O: AccessLevel = "own";
const FULL: Record<Action, AccessLevel> = {
  view: A, create: A, edit: A, delete: A, assign: A, approve: A, export: A, configure: A,
};
const VIEW: Partial<Record<Action, AccessLevel>> = { view: A };

export const ROLE_PRESETS: Record<RoleKey, RoleDefinition> = {
  // ── Organization Owner (the account holder) ──────────────
  org_owner: {
    key: "org_owner", label: "Organization Owner", system: true, scopeTier: "org_admin",
    description: "The account owner. Full control of everything, including billing and ownership.",
    allAccess: true,
    capabilities: { billing: { ...FULL } },
    masks: ["finance_cost_margin", "finance_totals", "finance_payroll", "comms_internal_notes", "sales_other_commissions"],
    flags: ["hierarchy_manage", "users_manage", "roles_manage", "billing_manage", "reports_cross_scope", "records_deactivate", "automation_manage"],
  },

  // ── Org Admin ────────────────────────────────────────────
  org_admin: {
    key: "org_admin", label: "Org Admin", system: true, scopeTier: "org_admin",
    description: "Manage every company, location, user, and setting across the organization. No billing.",
    allAccess: true,
    capabilities: {},
    masks: ["finance_cost_margin", "finance_totals", "finance_payroll", "comms_internal_notes", "sales_other_commissions"],
    flags: ["hierarchy_manage", "users_manage", "roles_manage", "reports_cross_scope", "records_deactivate", "automation_manage"],
  },

  // ── Branch Manager (over a company / brand and its locations) ──
  branch_manager: {
    key: "branch_manager", label: "Branch Manager", system: true, scopeTier: "company_admin",
    description: "Run a company/brand and all of its locations: team, operations, and local reporting.",
    allAccess: true,
    capabilities: {},
    masks: ["finance_cost_margin", "finance_totals", "comms_internal_notes", "sales_other_commissions"],
    flags: ["users_manage", "reports_cross_scope", "records_deactivate", "automation_manage"],
  },

  // ── Location Manager (a single branch) ───────────────────
  location_manager: {
    key: "location_manager", label: "Location Manager", system: true, scopeTier: "location_manager",
    description: "Run one location: customers, jobs, scheduling, team, and local reports.",
    capabilities: {
      dashboard: VIEW,
      customers: { ...FULL }, contacts: { ...FULL }, leads: { ...FULL }, deals: { ...FULL },
      jobs: { ...FULL }, projects: { ...FULL }, tasks: { ...FULL }, files: { ...FULL },
      agreements: { ...FULL }, communications: { view: A, create: A, edit: A },
      calendar: { ...FULL }, quotes: { ...FULL },
      invoices: { view: A, create: A, edit: A, export: A }, payments: { view: A, create: A },
      reports: { view: A, export: A }, items: VIEW, settings: VIEW, users: VIEW,
    },
    masks: ["finance_cost_margin", "finance_totals", "comms_internal_notes", "sales_other_commissions"],
    flags: ["records_deactivate"],
  },

  // ── Dispatcher (can own multiple locations via grants) ───
  dispatcher: {
    key: "dispatcher", label: "Dispatcher", system: true, scopeTier: "employee",
    description: "Schedule and assign field work across one or more locations; owns the dispatch board.",
    capabilities: {
      dashboard: VIEW,
      calendar: { view: A, create: A, edit: A, assign: A },
      jobs: { view: A, create: A, edit: A, assign: A }, tasks: { view: A, create: A, edit: A, assign: A },
      customers: VIEW, contacts: VIEW, leads: VIEW, files: VIEW, projects: VIEW,
      communications: { view: A, create: A }, reports: VIEW,
    },
    masks: ["comms_internal_notes"],
    flags: [],
  },

  // ── Field Technician (service) ───────────────────────────
  field_technician: {
    key: "field_technician", label: "Field Technician", system: true, scopeTier: "employee",
    description: "See and update assigned service jobs, work orders, and photos. No financials.",
    capabilities: {
      dashboard: VIEW,
      jobs: { view: O, edit: O }, tasks: { view: O, edit: O },
      files: { view: O, create: O }, customers: { view: O }, calendar: { view: O },
    },
    masks: [],
    flags: [],
  },

  // ── Installer (project / install crew) ───────────────────
  installer: {
    key: "installer", label: "Installer", system: true, scopeTier: "employee",
    description: "Carry out assigned installations and projects, with work orders and photos. No financials.",
    capabilities: {
      dashboard: VIEW,
      jobs: { view: O, edit: O }, projects: { view: O, edit: O }, tasks: { view: O, edit: O },
      files: { view: O, create: O }, customers: { view: O }, calendar: { view: O },
    },
    masks: [],
    flags: [],
  },

  // ── Salesperson / Estimator ──────────────────────────────
  salesperson: {
    key: "salesperson", label: "Salesperson", system: true, scopeTier: "employee",
    description: "Work the pipeline: leads, quotes, proposals, and agreements.",
    capabilities: {
      dashboard: VIEW,
      leads: { view: A, create: A, edit: O, assign: O }, deals: { view: A, create: A, edit: O },
      quotes: { view: A, create: A, edit: A, approve: A },
      customers: { view: A, create: A, edit: A }, contacts: { ...FULL },
      agreements: { view: A, create: A }, jobs: { view: O }, tasks: { view: O, create: O, edit: O },
      calendar: { view: O, create: O }, files: { view: A, create: A },
      communications: { view: A, create: A }, reports: { view: O },
    },
    masks: ["finance_cost_margin", "finance_totals", "comms_internal_notes"],
    flags: [],
  },
};

// Minimal safe role for an unknown key (e.g. a deleted custom role still on a
// grant). Dashboard view only.
export const FALLBACK_ROLE: RoleDefinition = {
  key: "__fallback", label: "Limited", system: true, scopeTier: "employee",
  description: "Minimal access (role not found).",
  capabilities: { dashboard: { view: "all" } },
  masks: [], flags: [],
};

export function getRolePreset(key: RoleKey): RoleDefinition {
  return ROLE_PRESETS[key] ?? FALLBACK_ROLE;
}

// Ordered list for the Roles UI (owner/admins first, then operational).
export const ROLE_ORDER: RoleKey[] = [
  "org_owner", "org_admin", "branch_manager", "location_manager",
  "dispatcher", "field_technician", "installer", "salesperson",
];

// Roles offered when assigning a user (excludes org_owner, set only on the
// account owner). Custom roles are appended by the store at runtime.
export const ASSIGNABLE_ROLES: RoleKey[] = ROLE_ORDER.filter(r => r !== "org_owner");
