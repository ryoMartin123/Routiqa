// ─── Roles · app + scope + level helpers ──────────────────
// Presentation/derivation logic shared by the Roles & Permissions page, the role
// detail drawer, and the guided Role Builder. Keeps the components dumb: which
// apps a role grants, its default data scope, per-module access levels, and the
// sensitive/administrative permission groupings all resolve here.

import type { PlatformAppId } from "@/lib/platform/apps";
import type {
  AccessLevel, Action, DataScope, FieldMask, Resource, RoleDefinition, SensitiveFlag,
} from "./types";
import { getRolePreset } from "./presets";

// ─── Apps ─────────────────────────────────────────────────
export type RoleAppId = Exclude<PlatformAppId, never>;

export const APP_META: Record<PlatformAppId, { name: string; description: string; accent: string }> = {
  portal:         { name: "My Portal",       description: "Personal home — schedule, pay, tasks, documents.",    accent: "#0ea5e9" },
  crm:            { name: "CRM",             description: "Customers, leads, quotes, jobs, dispatching.",        accent: "#6366f1" },
  marketing:      { name: "Marketing",       description: "Campaigns, audiences, templates, follow-ups.",        accent: "#e11d48" },
  team_workspace: { name: "Team Workspace",  description: "Channels, meetings, announcements, action items.",    accent: "#2563eb" },
  inventory:      { name: "Inventory & Procurement", description: "Materials, truck stock, POs, vendors, subs.", accent: "#f97316" },
  hr:             { name: "HR",              description: "Employees, hiring, onboarding, time off.",            accent: "#ec4899" },
  accounting:     { name: "Accounting",      description: "Invoices, payments, expenses, reports.",              accent: "#22c55e" },
  documents:      { name: "Documents",       description: "Company library, SOPs, policies, files.",             accent: "#f59e0b" },
  admin:          { name: "Admin",           description: "Users, roles, structure, security, billing.",         accent: "#a855f7" },
};

export const APP_ORDER: PlatformAppId[] = ["portal", "crm", "marketing", "team_workspace", "inventory", "hr", "accounting", "documents", "admin"];

// Which app each CRM resource belongs to (for grouped permission accordions and
// app-access derivation). HR has no granular resources in the v1 model.
export const RESOURCE_APP: Partial<Record<Resource, PlatformAppId>> = {
  dashboard: "crm", customers: "crm", contacts: "crm", leads: "crm", deals: "crm",
  jobs: "crm", projects: "crm", tasks: "crm", agreements: "crm", marketing: "marketing",
  communications: "crm", calendar: "crm", quotes: "crm", items: "crm",
  invoices: "accounting", payments: "accounting", reports: "accounting",
  files: "documents",
  settings: "admin", users: "admin", hierarchy: "admin", billing: "admin",
};

export function resourcesForApp(app: PlatformAppId): Resource[] {
  return (Object.keys(RESOURCE_APP) as Resource[]).filter((r) => RESOURCE_APP[r] === app);
}

// System-role app access mirrors lib/platform/access ROLE_DEFAULTS.
const SYSTEM_ROLE_APPS: Record<string, PlatformAppId[]> = {
  org_owner: ["portal", "crm", "marketing", "team_workspace", "inventory", "hr", "accounting", "documents", "admin"],
  org_admin: ["portal", "crm", "marketing", "team_workspace", "inventory", "hr", "accounting", "documents", "admin"],
  branch_manager: ["portal", "crm", "marketing", "team_workspace", "inventory", "documents", "admin"],
  location_manager: ["portal", "crm", "marketing", "team_workspace", "documents"],
  dispatcher: ["portal", "crm", "team_workspace", "documents"],
  field_technician: ["portal", "crm", "team_workspace", "documents"],
  installer: ["portal", "crm", "team_workspace", "documents"],
  salesperson: ["portal", "crm", "team_workspace", "documents"],
  accounting: ["portal", "crm", "inventory", "accounting", "documents"],
  hr_manager: ["portal", "team_workspace", "hr", "documents"],
};

const ADMIN_FLAG_SET: SensitiveFlag[] = ["users_manage", "roles_manage", "hierarchy_manage", "billing_manage", "security_manage"];

// Apps a role can open. Explicit role.apps wins; system roles use the map above;
// custom roles derive from their capabilities + flags. Portal is always implied.
export function roleApps(role: RoleDefinition): PlatformAppId[] {
  if (role.apps && role.apps.length) {
    return APP_ORDER.filter((a) => a === "portal" || role.apps!.includes(a));
  }
  if (SYSTEM_ROLE_APPS[role.key]) return SYSTEM_ROLE_APPS[role.key];

  const set = new Set<PlatformAppId>(["portal"]);
  const granted = (r: Resource) => role.allAccess || Boolean(role.capabilities[r]);
  if (role.allAccess || resourcesForApp("crm").some(granted)) set.add("crm");
  if (role.allAccess || resourcesForApp("marketing").some(granted)) set.add("marketing");
  if (role.allAccess || resourcesForApp("accounting").some(granted)) set.add("accounting");
  if (role.allAccess || granted("files")) set.add("documents");
  if (role.allAccess || resourcesForApp("admin").some(granted) || role.flags.some((f) => ADMIN_FLAG_SET.includes(f))) set.add("admin");
  if (role.allAccess || role.flags.includes("users_manage")) set.add("hr");
  return APP_ORDER.filter((a) => set.has(a));
}

export function roleHasApp(role: RoleDefinition, app: PlatformAppId): boolean {
  return app === "portal" || roleApps(role).includes(app);
}

// ─── Data scope ───────────────────────────────────────────
export const DATA_SCOPES: { value: DataScope; label: string; hint: string }[] = [
  { value: "self",         label: "Self only",      hint: "Only their own record" },
  { value: "assigned",     label: "Assigned only",  hint: "Records assigned to or created by them" },
  { value: "team",         label: "Team",           hint: "Their team's records" },
  { value: "location",     label: "Location",       hint: "Their assigned location(s)" },
  { value: "company",      label: "Company",        hint: "Their company / brand" },
  { value: "organization", label: "Organization",   hint: "The whole organization" },
  { value: "all",          label: "All",            hint: "Everything, no scope limit" },
];

export const SCOPE_LABEL: Record<DataScope, string> = Object.fromEntries(
  DATA_SCOPES.map((s) => [s.value, s.label]),
) as Record<DataScope, string>;

const SYSTEM_ROLE_SCOPE: Record<string, DataScope> = {
  org_owner: "all", org_admin: "organization", branch_manager: "company",
  location_manager: "location", dispatcher: "location", field_technician: "assigned",
  installer: "assigned", salesperson: "assigned", accounting: "organization", hr_manager: "company",
};

const TIER_SCOPE: Record<string, DataScope> = {
  org_admin: "organization", company_admin: "company", location_manager: "location", employee: "assigned",
};

export function roleDataScope(role: RoleDefinition): DataScope {
  return role.dataScope ?? SYSTEM_ROLE_SCOPE[role.key] ?? TIER_SCOPE[role.scopeTier] ?? "assigned";
}

// ─── Module access levels (simple, progressive) ───────────
export type ModuleLevel = "none" | "view" | "create_edit" | "manage" | "custom";

export const MODULE_LEVEL_LABELS: Record<ModuleLevel, string> = {
  none: "None", view: "View", create_edit: "Create / Edit", manage: "Manage", custom: "Custom",
};

const MANAGE_ACTIONS: Action[] = ["view", "create", "edit", "delete", "assign", "approve", "export"];

// Turn a simple level into a capability row at the given access level (own/all).
export function rowForLevel(level: ModuleLevel, access: AccessLevel = "all"): Partial<Record<Action, AccessLevel>> {
  switch (level) {
    case "none":        return {};
    case "view":        return { view: access };
    case "create_edit": return { view: access, create: access, edit: access };
    case "manage":      return Object.fromEntries(MANAGE_ACTIONS.map((a) => [a, access]));
    default:            return {};
  }
}

// Classify a capability row back into a simple level (or "custom").
export function levelOfRow(row?: Partial<Record<Action, AccessLevel>>): ModuleLevel {
  if (!row) return "none";
  const on = (Object.keys(row) as Action[]).filter((a) => row[a] && row[a] !== "none");
  if (on.length === 0) return "none";
  const set = new Set(on);
  const eq = (...a: Action[]) => a.length === set.size && a.every((x) => set.has(x));
  if (eq("view")) return "view";
  if (eq("view", "create", "edit")) return "create_edit";
  if (MANAGE_ACTIONS.every((a) => set.has(a)) && set.size === MANAGE_ACTIONS.length) return "manage";
  return "custom";
}

// ─── App access levels (coarse, per app) ──────────────────
export type AppLevel = "none" | "view" | "standard" | "manager" | "full" | "custom";

export const APP_LEVELS: { value: AppLevel; label: string }[] = [
  { value: "none",     label: "No access" },
  { value: "view",     label: "View only" },
  { value: "standard", label: "Standard access" },
  { value: "manager",  label: "Manager access" },
  { value: "full",     label: "Full access" },
  { value: "custom",   label: "Custom" },
];

const APP_TO_MODULE: Record<Exclude<AppLevel, "custom" | "full">, ModuleLevel> = {
  none: "none", view: "view", standard: "create_edit", manager: "manage",
};

// Apply an app-wide access level across all of an app's resources.
export function applyAppLevel(role: RoleDefinition, app: PlatformAppId, level: AppLevel, access: AccessLevel = "all"): RoleDefinition {
  if (level === "custom") return role;
  const caps = { ...role.capabilities };
  for (const res of resourcesForApp(app)) {
    if (level === "none") { delete caps[res]; continue; }
    const row = level === "full"
      ? Object.fromEntries((["view", "create", "edit", "delete", "assign", "approve", "export", "configure"] as Action[]).map((a) => [a, access]))
      : rowForLevel(APP_TO_MODULE[level], access);
    caps[res] = row;
  }
  return { ...role, capabilities: caps };
}

// Infer the current app level from a role's caps across the app's resources.
export function appLevelOf(role: RoleDefinition, app: PlatformAppId): AppLevel {
  const res = resourcesForApp(app);
  if (res.length === 0) return "none";
  const levels = res.map((r) => levelOfRow(role.capabilities[r]));
  if (levels.every((l) => l === "none")) return "none";
  if (levels.some((l) => l === "custom")) return "custom";
  const uniq = new Set(levels.filter((l) => l !== "none"));
  if (uniq.size === 1) {
    const only = [...uniq][0];
    if (only === "view") return "view";
    if (only === "create_edit") return "standard";
    if (only === "manage") return "manager";
  }
  return "custom";
}

// ─── Sensitive + administrative permissions ───────────────
// Sensitive = view-into-restricted-data (field masks). Administrative = high-trust
// management flags. Kept separate per the spec.
export const SENSITIVE_MASK_ORDER: FieldMask[] = [
  "finance_internal_pricing", "finance_cost_margin", "finance_totals", "finance_field_pricing", "finance_payroll",
  "comms_internal_notes", "sales_other_commissions", "documents_confidential", "accounting_reports",
];

// The management flags shown in the Sensitive Access card alongside the masks.
export const MANAGE_FLAG_ORDER: SensitiveFlag[] = [
  "billing_manage", "users_manage", "roles_manage", "security_manage",
];

// Remaining platform flags (operational authority), shown under Admin permissions.
export const PLATFORM_FLAG_ORDER: SensitiveFlag[] = [
  "hierarchy_manage", "reports_cross_scope", "records_deactivate", "automation_manage", "jobs_status_override",
];

export function sensitiveCount(role: RoleDefinition): number {
  return role.masks.length;
}
export function adminCount(role: RoleDefinition): number {
  return role.flags.length;
}
export function hasAdminAccess(role: RoleDefinition): boolean {
  return roleApps(role).includes("admin") || role.flags.some((f) => ADMIN_FLAG_SET.includes(f));
}

// ─── Start-From presets (Role Builder step 2) ─────────────
export interface StartPreset { id: string; label: string; description: string; roleKey?: string }

export const START_PRESETS: StartPreset[] = [
  { id: "field_technician", label: "Technician",       description: "Assigned jobs, work orders, photos.", roleKey: "field_technician" },
  { id: "dispatcher",       label: "Dispatcher",       description: "Schedule and assign field work.",     roleKey: "dispatcher" },
  { id: "salesperson",      label: "Salesperson",      description: "Leads, quotes, and proposals.",       roleKey: "salesperson" },
  { id: "installer",        label: "Installer",        description: "Installations and project work.",     roleKey: "installer" },
  { id: "location_manager", label: "Location Manager", description: "Run a single location.",              roleKey: "location_manager" },
  { id: "branch_manager",   label: "Company Manager",  description: "Run a company and its locations.",    roleKey: "branch_manager" },
  { id: "accounting",       label: "Accounting",       description: "Invoices, payments, reports.",        roleKey: "accounting" },
  { id: "hr_manager",       label: "HR Manager",       description: "Employees, onboarding, time off.",    roleKey: "hr_manager" },
  { id: "document_manager", label: "Document Manager", description: "Manage the company document library." },
];

// A synthetic Document Manager (no shipped preset) for the Start-From card.
function documentManagerRole(): RoleDefinition {
  return {
    key: "", label: "", description: "", system: false, scopeTier: "employee",
    dataScope: "company", apps: ["portal", "documents"],
    capabilities: { dashboard: { view: "all" }, files: { view: "all", create: "all", edit: "all", delete: "all" } },
    masks: ["documents_confidential"], flags: [],
  };
}

// Build a fresh draft from a Start-From choice (preset key or synthetic).
export function draftFromPreset(id: string): RoleDefinition {
  if (id === "document_manager") return documentManagerRole();
  const preset = getRolePreset(id);
  const clone: RoleDefinition = JSON.parse(JSON.stringify(preset));
  // A new role built from a preset is custom + editable; keep the capability shape.
  clone.key = ""; clone.label = ""; clone.description = preset.description;
  clone.system = false; clone.locked = false;
  clone.apps = roleApps(preset);
  clone.dataScope = roleDataScope(preset);
  return clone;
}
