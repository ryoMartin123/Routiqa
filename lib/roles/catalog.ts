// ─── Catalog — display metadata for the permission matrix UI ──
// Drives the Settings → Roles matrix (resource rows, action columns, mask & flag
// toggles). Pure labels/ordering; no behavior. Keep in sync with types.ts.

import type { Resource, Action, FieldMask, SensitiveFlag } from "./types";

export const RESOURCE_LABELS: Record<Resource, string> = {
  dashboard:      "Dashboard",
  customers:      "Customers",
  contacts:       "Contacts",
  leads:          "Leads",
  deals:          "Deals / Pipeline",
  jobs:           "Jobs",
  projects:       "Projects",
  tasks:          "Tasks",
  files:          "Photos & Files",
  agreements:     "Agreements",
  marketing:      "Marketing",
  communications: "Communications",
  calendar:       "Calendar / Dispatch",
  quotes:         "Quotes",
  invoices:       "Invoices",
  payments:       "Payments",
  reports:        "Reports",
  items:          "Items / Catalog",
  settings:       "Settings",
  users:          "Users",
  hierarchy:      "Companies & Locations",
  billing:        "Billing",
};

// Order resources appear in the matrix.
export const RESOURCE_ORDER: Resource[] = [
  "dashboard", "customers", "contacts", "leads", "deals", "jobs", "projects",
  "tasks", "files", "agreements", "marketing", "communications", "calendar",
  "quotes", "invoices", "payments", "reports", "items", "settings", "users",
  "hierarchy", "billing",
];

export const ACTION_LABELS: Record<Action, string> = {
  view:      "View",
  create:    "Create",
  edit:      "Edit",
  delete:    "Deactivate",
  assign:    "Assign",
  approve:   "Approve",
  export:    "Export",
  configure: "Configure",
};

export const ACTION_ORDER: Action[] = [
  "view", "create", "edit", "delete", "assign", "approve", "export", "configure",
];

export const MASK_LABELS: Record<FieldMask, { label: string; description: string }> = {
  finance_internal_pricing: { label: "Internal pricing",    description: "Internal price book and list pricing." },
  finance_cost_margin:     { label: "Cost & margin",       description: "Item cost, markup, and profit margin on quotes/jobs." },
  finance_totals:          { label: "Financial totals",    description: "Quote/invoice totals, balances, and payment amounts." },
  finance_field_pricing:   { label: "Field pricing",        description: "Line-item prices on work orders in the field / mobile app. Turn on to let techs see and quote pricing on site." },
  finance_field_billing:   { label: "Field billing",        description: "Create quotes and invoices from a work order or job. Turn off to let a role capture parts/labor and see pricing, but leave invoicing to the office." },
  finance_payroll:         { label: "Payroll / labor cost", description: "Technician pay rates and internal labor cost." },
  comms_internal_notes:    { label: "Internal notes",      description: "Internal-only notes hidden from customer-facing views." },
  sales_other_commissions: { label: "Others' commissions", description: "Commission figures for other sales reps." },
  documents_confidential:  { label: "Confidential documents", description: "Restricted/confidential documents and folders." },
  accounting_reports:      { label: "Accounting reports",  description: "Accounting and financial reporting." },
};

export const FLAG_LABELS: Record<SensitiveFlag, { label: string; description: string }> = {
  hierarchy_manage:    { label: "Manage structure",   description: "Create/deactivate companies, locations, and service areas." },
  users_manage:        { label: "Manage users",       description: "Invite and edit users and their role assignments." },
  roles_manage:        { label: "Manage roles",       description: "Edit role definitions and create custom roles." },
  billing_manage:      { label: "Manage billing",     description: "Change subscription, payment method, and billing." },
  security_manage:     { label: "Manage security",    description: "Manage security and access policies." },
  reports_cross_scope: { label: "Cross-scope reports", description: "View reporting across companies/locations." },
  records_deactivate:  { label: "Deactivate records", description: "Deactivate/archive business records." },
  automation_manage:   { label: "Manage automation",  description: "Configure marketing and automation rules." },
  jobs_status_override: { label: "Override job status", description: "Force a job to any status, bypassing the normal transition flow (dispatch authority)." },
};
