// ─── Preset roles ─────────────────────────────────────────
// System roles, expressed as capability maps. They are NOT user-editable today;
// a future custom-role builder writes new RoleDefinition rows in this same shape,
// so the resolver and gating UI never change ("presets now, custom-ready").
//
// Tuning these is intentionally easy — they're plain data. Missing resource ⇒ no
// access; missing action ⇒ "none". org_owner/org_admin/company_admin use
// `allAccess` (scoped by their membership) instead of an exhaustive map.

import type { Action, AccessLevel, CapabilityMap, RoleDefinition, RoleKey } from "./types";

// Action-level shorthands.
const A: AccessLevel = "all";
const O: AccessLevel = "own";
const FULL: Record<Action, AccessLevel> = {
  view: A, create: A, edit: A, delete: A, assign: A, approve: A, export: A, configure: A,
};
const VIEW: Partial<Record<Action, AccessLevel>> = { view: A };

export const ROLE_PRESETS: Record<RoleKey, RoleDefinition> = {
  // ── Org-wide admins (allAccess, scoped by membership) ────
  org_owner: {
    key: "org_owner", label: "Organization Owner", system: true, scopeTier: "org_admin",
    description: "Full control of the entire organization, including billing and ownership.",
    allAccess: true,
    capabilities: { billing: { ...FULL } },
    masks: ["finance_cost_margin", "finance_totals", "finance_payroll", "comms_internal_notes", "sales_other_commissions"],
    flags: ["hierarchy_manage", "users_manage", "roles_manage", "billing_manage", "reports_cross_scope", "records_deactivate", "automation_manage"],
  },
  org_admin: {
    key: "org_admin", label: "Organization Admin", system: true, scopeTier: "org_admin",
    description: "Manage all companies, locations, users, and settings. No billing/ownership.",
    allAccess: true,
    capabilities: {},
    masks: ["finance_cost_margin", "finance_totals", "finance_payroll", "comms_internal_notes", "sales_other_commissions"],
    flags: ["hierarchy_manage", "users_manage", "roles_manage", "reports_cross_scope", "records_deactivate", "automation_manage"],
  },
  company_admin: {
    key: "company_admin", label: "Company Admin", system: true, scopeTier: "company_admin",
    description: "Full control within one company and its locations.",
    allAccess: true,
    capabilities: {},
    masks: ["finance_cost_margin", "finance_totals", "finance_payroll", "comms_internal_notes", "sales_other_commissions"],
    flags: ["hierarchy_manage", "users_manage", "reports_cross_scope", "records_deactivate", "automation_manage"],
  },

  // ── Location / branch manager ────────────────────────────
  location_manager: {
    key: "location_manager", label: "Location Manager", system: true, scopeTier: "location_manager",
    description: "Run a branch: customers, jobs, scheduling, team, and local reports.",
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

  // ── Dispatcher ───────────────────────────────────────────
  dispatcher: {
    key: "dispatcher", label: "Dispatcher", system: true, scopeTier: "employee",
    description: "Schedule and assign field work; owns the calendar and dispatch queue.",
    capabilities: {
      dashboard: VIEW,
      calendar: { view: A, create: A, edit: A, assign: A },
      jobs: { view: A, edit: A, assign: A }, tasks: { view: A, create: A, edit: A, assign: A },
      customers: VIEW, contacts: VIEW, leads: VIEW, files: VIEW,
      communications: { view: A, create: A }, reports: VIEW,
    },
    masks: ["comms_internal_notes"],
    flags: [],
  },

  // ── CSR / office ─────────────────────────────────────────
  csr: {
    key: "csr", label: "CSR / Office", system: true, scopeTier: "employee",
    description: "Front office: customers, scheduling, communications, and invoicing.",
    capabilities: {
      dashboard: VIEW,
      customers: { ...FULL }, contacts: { ...FULL }, leads: { ...FULL },
      jobs: { view: A, create: A, edit: A }, tasks: { ...FULL },
      calendar: { view: A, create: A }, communications: { ...FULL },
      quotes: { view: A, create: A, edit: A },
      invoices: { view: A, create: A, edit: A }, payments: { view: A, create: A },
      agreements: { view: A, create: A }, files: { view: A, create: A }, reports: VIEW,
    },
    masks: ["finance_totals", "comms_internal_notes"],
    flags: [],
  },

  // ── Sales / estimator ────────────────────────────────────
  sales: {
    key: "sales", label: "Sales / Estimator", system: true, scopeTier: "employee",
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

  // ── Field technician ─────────────────────────────────────
  technician: {
    key: "technician", label: "Field Technician", system: true, scopeTier: "employee",
    description: "See and update assigned jobs, work orders, and photos. No financials.",
    capabilities: {
      dashboard: VIEW,
      jobs: { view: O, edit: O }, tasks: { view: O, edit: O },
      files: { view: O, create: O }, customers: { view: O }, calendar: { view: O },
    },
    masks: [],
    flags: [],
  },

  // ── Bookkeeper / accountant ──────────────────────────────
  bookkeeper: {
    key: "bookkeeper", label: "Bookkeeper", system: true, scopeTier: "company_admin",
    description: "Invoices, payments, and financial reporting. Read-only on operations.",
    capabilities: {
      dashboard: VIEW,
      invoices: { view: A, create: A, edit: A, export: A }, payments: { ...FULL },
      quotes: VIEW, agreements: VIEW, customers: VIEW, jobs: VIEW,
      reports: { view: A, export: A }, items: VIEW,
    },
    masks: ["finance_cost_margin", "finance_totals", "finance_payroll"],
    flags: ["reports_cross_scope"],
  },

  // ── Marketing ────────────────────────────────────────────
  marketing: {
    key: "marketing", label: "Marketing", system: true, scopeTier: "company_admin",
    description: "Campaigns, templates, and audiences. Reads CRM data; no financials.",
    capabilities: {
      dashboard: VIEW,
      marketing: { ...FULL }, communications: { view: A, create: A },
      customers: VIEW, leads: VIEW, agreements: VIEW, reports: VIEW,
    },
    masks: [],
    flags: ["automation_manage"],
  },

  // ── Generic employee (hierarchy fallback) ────────────────
  employee: {
    key: "employee", label: "Employee", system: true, scopeTier: "employee",
    description: "Basic access to assigned work.",
    capabilities: {
      dashboard: VIEW,
      jobs: { view: O }, tasks: { view: O, edit: O }, customers: { view: O }, files: { view: O },
    },
    masks: [],
    flags: [],
  },

  // ── Read-only viewer / auditor ───────────────────────────
  viewer: {
    key: "viewer", label: "Viewer", system: true, scopeTier: "employee",
    description: "Read-only access within scope. No changes.",
    capabilities: {
      dashboard: VIEW, customers: VIEW, contacts: VIEW, leads: VIEW, deals: VIEW,
      jobs: VIEW, projects: VIEW, tasks: VIEW, files: VIEW, agreements: VIEW,
      calendar: VIEW, quotes: VIEW, invoices: VIEW, reports: VIEW,
    },
    masks: [],
    flags: [],
  },
};

export function getRolePreset(key: RoleKey): RoleDefinition {
  return ROLE_PRESETS[key];
}

// Ordered list for the Roles UI (admins first, then operational, then read-only).
export const ROLE_ORDER: RoleKey[] = [
  "org_owner", "org_admin", "company_admin", "location_manager", "dispatcher",
  "csr", "sales", "technician", "bookkeeper", "marketing", "employee", "viewer",
];

// Roles offered when assigning a user (excludes the org_owner super-grant, which
// is set elsewhere). Plain export so the Users UI can list them.
export const ASSIGNABLE_ROLES: RoleKey[] = ROLE_ORDER.filter(r => r !== "org_owner");
