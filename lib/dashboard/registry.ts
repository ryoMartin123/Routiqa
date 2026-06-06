// Dashboard widget registry.
// Read-only — never changes at runtime. Visibility/order live in layouts.ts.

import type { RoleKey } from "@/lib/roles/types";

export type WidgetSize     = "full" | "wide" | "narrow";
export type ContextLevel   = "org" | "company" | "location" | "service_area";
export type WidgetCategory = "operations" | "sales" | "financial" | "activity";

export interface WidgetDef {
  id:              string;
  title:           string;
  description:     string;
  category:        WidgetCategory;
  defaultSize:     WidgetSize;
  // Context levels where this widget is meaningful.
  allowedContexts: ContextLevel[];
  // Roles that can see this widget. Empty = all roles.
  allowedRoles:    RoleKey[];
}

export const WIDGET_REGISTRY: WidgetDef[] = [

  // ── Available at all context levels ──────────────────────
  {
    id: "stats_overview", title: "Stats Overview",
    description: "Today's jobs, open leads, overdue tasks, and outstanding balance at a glance.",
    category: "operations", defaultSize: "full",
    allowedContexts: ["org", "company", "location", "service_area"],
    allowedRoles: [],
  },
  {
    id: "urgent_panel", title: "Urgent Items",
    description: "Overdue tasks, overdue invoices, and active emergency jobs.",
    category: "operations", defaultSize: "narrow",
    allowedContexts: ["org", "company", "location", "service_area"],
    allowedRoles: [],
  },
  {
    id: "recent_activity", title: "Recent Activity",
    description: "Latest activity events across all customers — notes, jobs, calls, and more.",
    category: "activity", defaultSize: "wide",
    allowedContexts: ["org", "company", "location", "service_area"],
    allowedRoles: [],
  },
  {
    id: "pipeline_snapshot", title: "Pipeline Snapshot",
    description: "Lead counts by pipeline stage with a visual bar chart.",
    category: "sales", defaultSize: "narrow",
    allowedContexts: ["org", "company", "location", "service_area"],
    allowedRoles: [],
  },
  {
    id: "agreement_renewals", title: "Agreement Renewals",
    description: "Upcoming agreement renewals and expiring maintenance plans.",
    category: "financial", defaultSize: "narrow",
    allowedContexts: ["org", "company", "location", "service_area"],
    allowedRoles: [],
  },

  // ── Org-level ─────────────────────────────────────────────
  {
    id: "company_performance", title: "Company Performance",
    description: "Side-by-side stats for each company — jobs, leads, and outstanding revenue.",
    category: "operations", defaultSize: "wide",
    allowedContexts: ["org"],
    allowedRoles: ["org_admin"],
  },
  {
    id: "revenue_by_company", title: "Revenue by Company",
    description: "Paid and outstanding invoice totals broken down per company.",
    category: "financial", defaultSize: "narrow",
    allowedContexts: ["org"],
    allowedRoles: ["org_admin"],
  },

  // ── Company + Org ─────────────────────────────────────────
  {
    id: "location_performance", title: "Location Performance",
    description: "Key metrics per branch — jobs, open leads, and outstanding invoices.",
    category: "operations", defaultSize: "wide",
    allowedContexts: ["org", "company"],
    allowedRoles: ["org_admin", "branch_manager"],
  },
  {
    id: "quotes_followup", title: "Quotes — Follow-Up",
    description: "Sent quotes that have not yet been approved and need follow-up.",
    category: "sales", defaultSize: "narrow",
    allowedContexts: ["org", "company", "location"],
    allowedRoles: [],
  },
  {
    id: "revenue_snapshot", title: "Revenue Snapshot",
    description: "Month-to-date revenue bar chart with outstanding and average ticket metrics.",
    category: "financial", defaultSize: "narrow",
    allowedContexts: ["org", "company", "location"],
    allowedRoles: ["org_admin", "branch_manager", "location_manager"],
  },

  // ── Company + Location + Service Area ─────────────────────
  {
    id: "todays_jobs", title: "Today's Jobs",
    description: "Jobs scheduled for today and currently in progress.",
    category: "operations", defaultSize: "wide",
    allowedContexts: ["company", "location", "service_area"],
    allowedRoles: [],
  },
  {
    id: "open_work_orders", title: "Open Work Orders",
    description: "Pending and in-progress work orders with checklist progress.",
    category: "operations", defaultSize: "narrow",
    allowedContexts: ["company", "location", "service_area"],
    allowedRoles: [],
  },
  {
    id: "invoices_due", title: "Invoices Due",
    description: "Unpaid invoices sorted by due date, highlighting overdue balances.",
    category: "financial", defaultSize: "wide",
    allowedContexts: ["company", "location", "service_area"],
    allowedRoles: [],
  },
  {
    id: "missing_required_photos", title: "Missing Required Photos",
    description: "Jobs with incomplete required photo checklists.",
    category: "operations", defaultSize: "narrow",
    allowedContexts: ["company", "location", "service_area"],
    allowedRoles: ["org_admin", "branch_manager", "location_manager"],
  },

  // ── Service Area ──────────────────────────────────────────
  {
    id: "leads_in_territory", title: "Leads in Territory",
    description: "All open leads within the selected service area.",
    category: "sales", defaultSize: "wide",
    allowedContexts: ["service_area"],
    allowedRoles: [],
  },
  {
    id: "jobs_in_territory", title: "Jobs in Territory",
    description: "Scheduled and active jobs within the selected service area.",
    category: "operations", defaultSize: "narrow",
    allowedContexts: ["service_area"],
    allowedRoles: [],
  },
];

// ── Lookups ───────────────────────────────────────────────
export const WIDGET_MAP: Record<string, WidgetDef> =
  Object.fromEntries(WIDGET_REGISTRY.map(w => [w.id, w]));

export const CATEGORY_LABELS: Record<WidgetCategory, string> = {
  operations: "Operations",
  sales:      "Sales",
  financial:  "Financial",
  activity:   "Activity",
};

export const CONTEXT_LABELS: Record<ContextLevel, string> = {
  org:          "Organization",
  company:      "Company",
  location:     "Location",
  service_area: "Service Area",
};

export const SIZE_COLS: Record<WidgetSize, string> = {
  full:   "col-span-3",
  wide:   "col-span-2",
  narrow: "col-span-1",
};

export function getContextLevel(
  effectiveCompanyId?: string,
  effectiveLocationId?: string,
  effectiveServiceAreaId?: string,
): ContextLevel {
  if (effectiveServiceAreaId) return "service_area";
  if (effectiveLocationId)    return "location";
  if (effectiveCompanyId)     return "company";
  return "org";
}
