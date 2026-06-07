// Custom Widget registry — option metadata, per-source field definitions,
// normalized record accessors, and the preview evaluator.
// All point-and-click; no raw SQL.

import { ALL_JOBS, JOB_STATUS_CONFIG, JOB_TYPE_CONFIG } from "@/lib/jobs/data";
import { ALL_LEADS, LEAD_STAGE_CONFIG, LEAD_SOURCE_LABELS } from "@/lib/leads/data";
import { ALL_QUOTES, ALL_INVOICES } from "@/lib/quotes/data";
import { getAllTasks } from "@/lib/tasks/data";
import { taskTypeLabel, getTaskTypes } from "@/lib/tasks/settings";
import type {
  DataSourceKey, FieldDef, CalculationType, VisualizationType,
  ContextBehavior, WidgetRole, WidgetStatus,
} from "./types";

// ─── Option label maps ────────────────────────────────────
export const DATA_SOURCE_LABELS: Record<DataSourceKey, string> = {
  customers: "Customers", leads: "Leads", jobs: "Jobs", work_orders: "Work Orders",
  quotes: "Quotes", invoices: "Invoices", payments: "Payments", agreements: "Agreements",
  tasks: "Tasks", photos: "Photos", properties: "Properties", equipment: "Equipment",
};

export const CALC_LABELS: Record<CalculationType, string> = {
  count: "Count", sum: "Sum", average: "Average", percentage: "Percentage",
  group_by: "Group By", trend: "Trend over time", list: "List records",
};

export const VIZ_LABELS: Record<VisualizationType, string> = {
  number_card: "Number Card", list: "List", table: "Table", bar: "Bar Chart",
  line: "Line Chart", pie: "Pie Chart", funnel: "Funnel", progress: "Progress Bar",
  leaderboard: "Leaderboard",
};

export const CONTEXT_LABELS: Record<ContextBehavior, string> = {
  follow: "Follow current context", org: "Organization-wide", company: "Company-wide",
  location: "Location-specific", user: "Current user only",
};

export const ROLE_LABELS: Record<WidgetRole, string> = {
  admin: "Owner / Admin", manager: "Manager", csr: "CSR", sales: "Sales",
  technician: "Technician", accounting: "Accounting", marketing: "Marketing",
};

export const STATUS_STYLE: Record<WidgetStatus, { label: string; bg: string; color: string }> = {
  draft:     { label: "Draft",     bg: "var(--bg-input)", color: "var(--text-secondary)" },
  published: { label: "Published", bg: "#d1fae5",         color: "#065f46" },
  disabled:  { label: "Disabled",  bg: "#fef3c7",         color: "#92400e" },
  archived:  { label: "Archived",  bg: "#fee2e2",         color: "#991b1b" },
};

// ─── Field definitions per data source ────────────────────
// Only the fields the evaluator can compute against. Sources with live mock
// data declare real fields; the rest declare a minimal set (preview shows
// "sample data not connected yet").
const jobStatusOptions = Object.values(JOB_STATUS_CONFIG).map(s => s.label);
const jobTypeOptions   = Object.keys(JOB_TYPE_CONFIG);
const leadStageOptions = Object.values(LEAD_STAGE_CONFIG).map(s => s.label);
const leadSourceOptions= Object.values(LEAD_SOURCE_LABELS);
const taskTypeOptions  = getTaskTypes().map(t => t.label);

export const SOURCE_FIELDS: Record<DataSourceKey, FieldDef[]> = {
  jobs: [
    { key: "status",     label: "Status",      type: "enum", options: jobStatusOptions },
    { key: "type",       label: "Job Type",    type: "enum", options: jobTypeOptions },
    { key: "assignedTo", label: "Assigned To", type: "string" },
  ],
  leads: [
    { key: "stage",      label: "Stage",       type: "enum", options: leadStageOptions },
    { key: "source",     label: "Source",      type: "enum", options: leadSourceOptions },
    { key: "assignedTo", label: "Assigned To", type: "string" },
  ],
  invoices: [
    { key: "status",     label: "Status",      type: "enum", options: ["draft","sent","partially_paid","paid","past_due","void"] },
    { key: "total",      label: "Total",       type: "number" },
    { key: "balanceDue", label: "Balance Due", type: "number" },
  ],
  quotes: [
    { key: "status",     label: "Status",      type: "enum", options: ["draft","sent","approved","rejected","expired","converted"] },
    { key: "total",      label: "Total",       type: "number" },
  ],
  tasks: [
    { key: "status",     label: "Status",      type: "enum", options: ["open","overdue","completed"] },
    { key: "type",       label: "Task Type",   type: "enum", options: taskTypeOptions },
    { key: "assignedTo", label: "Assigned To", type: "string" },
  ],
  // Sources without wired mock data yet — minimal fields, preview degrades gracefully.
  customers:   [{ key: "type",   label: "Type",   type: "enum", options: ["Residential","Commercial"] }],
  work_orders: [{ key: "status", label: "Status", type: "enum", options: ["pending","in_progress","completed"] }],
  payments:    [{ key: "method", label: "Method", type: "string" }],
  agreements:  [{ key: "status", label: "Status", type: "string" }],
  photos:      [{ key: "category", label: "Category", type: "string" }],
  properties:  [{ key: "type",   label: "Type",   type: "string" }],
  equipment:   [{ key: "status", label: "Status", type: "string" }],
};

// Whether a source has live mock data to compute from.
export const SOURCES_WITH_DATA: DataSourceKey[] = ["jobs", "leads", "invoices", "quotes", "tasks"];

// ─── Normalized record access ─────────────────────────────
type Row = Record<string, string | number>;

const STATUS_LABEL_BY_KEY: Record<string, string> =
  Object.fromEntries(Object.entries(JOB_STATUS_CONFIG).map(([k, v]) => [k, v.label]));
const TYPE_TITLE = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function getRows(source: DataSourceKey): Row[] {
  switch (source) {
    case "jobs":
      return ALL_JOBS.map(j => ({
        status: STATUS_LABEL_BY_KEY[j.status] ?? j.status,
        type: TYPE_TITLE(j.type), assignedTo: j.assignedTo,
        companyId: j.companyId, locationId: j.locationId,
        _label: j.title,
      }));
    case "leads":
      return ALL_LEADS.map(l => ({
        stage: LEAD_STAGE_CONFIG[l.stage].label,
        source: LEAD_SOURCE_LABELS[l.source], assignedTo: l.assignedTo,
        companyId: l.companyId, locationId: l.locationId,
        _label: l.title,
      }));
    case "invoices":
      return ALL_INVOICES.map(i => ({
        status: i.status, total: i.total, balanceDue: i.balanceDue,
        companyId: i.companyId, locationId: i.locationId,
        _label: i.invoiceNumber,
      }));
    case "quotes":
      return ALL_QUOTES.map(q => ({
        status: q.status, total: q.total,
        companyId: q.companyId, locationId: q.locationId,
        _label: q.quoteNumber,
      }));
    case "tasks":
      return getAllTasks().map(t => ({
        status: t.status, type: taskTypeLabel(t.type), assignedTo: t.assignedTo,
        companyId: t.companyId, locationId: t.locationId,
        _label: t.title,
      }));
    default:
      return [];
  }
}
