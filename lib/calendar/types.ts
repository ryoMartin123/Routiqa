// Calendar domain — a unified view-model over records that own their own
// scheduling (jobs, tasks, agreement visits, project milestones) plus native
// org events. The calendar renders CalendarItem[]; it never owns scheduling
// itself — scheduling writes back to the source record.

export type CalendarItemType =
  | "job"
  | "sales_appointment"
  | "agreement_visit"
  | "task"
  | "project_milestone"
  | "work_order_review"
  | "internal_event"
  | "blocked_time"
  | "pto"
  | "training";

export type CalendarLayer = CalendarItemType;

export type CalendarView = "dispatch" | "day" | "week";

export type ItemPriority = "low" | "normal" | "high" | "urgent";

// ─── Dispatch lane ────────────────────────────────────────
// Every dispatchable thing is a Job under one lifecycle (decision: one status
// model). The board collapses that ~11-state lifecycle into a handful of
// display "lanes" — color tells you WHAT it is (type), the lane tells you WHERE
// it is in its life (visual treatment: active glows, blocked is hatched, etc.).
export type DispatchLane = "scheduled" | "active" | "blocked" | "done" | "fell_through";

export const LANE_CONFIG: Record<DispatchLane, { label: string }> = {
  scheduled:    { label: "Scheduled" },
  active:       { label: "Active" },
  blocked:      { label: "Blocked" },
  done:         { label: "Done" },
  fell_through: { label: "Fell through" },
};

// Map a raw job status key → dispatch lane.
export function jobStatusToLane(status: string): DispatchLane {
  switch (status) {
    case "en_route":
    case "in_progress":         return "active";
    case "waiting_on_parts":
    case "waiting_on_customer":  return "blocked";
    case "completed":
    case "invoiced":
    case "closed":               return "done";
    case "canceled":
    case "no_show":              return "fell_through";
    default:                     return "scheduled";
  }
}

export interface CalendarItem {
  id: string;
  type: CalendarItemType;
  title: string;

  // Scheduling
  start: Date;
  end: Date;
  allDay: boolean;
  durationMinutes: number;

  // Assignment
  assignedTo?: string;
  assignedToInitials?: string;

  // Context
  companyId: string;
  locationId: string;
  serviceAreaId?: string;

  // Source linkage
  sourceId: string;
  sourceModule: "jobs" | "tasks" | "agreements" | "projects" | "quotes" | "calendar_events";

  // Display
  status?: string;
  lane?: DispatchLane;   // derived from status — drives board visual treatment
  color: string;
  customerName?: string;
  address?: string;
  city?: string;
  jobType?: string;
  priority?: ItemPriority;
  contact?: string;
}

// An item awaiting a slot (no start time yet).
export interface UnscheduledItem {
  id: string;
  type: CalendarItemType;
  // Origin of the queue item — drives the default queue tabs/views. Broader than
  // `type` (e.g. an approved quote produces a future "job" but queues distinctly).
  sourceType: import("./queueViews").QueueSourceType;
  title: string;
  reason: string;            // why it's in the queue (reason_unscheduled)
  companyId: string;
  locationId: string;
  serviceAreaId?: string;
  customerName?: string;
  accountId?: string;        // customer id, when known — used to spawn a Job on schedule
  value?: string;
  sourceId: string;
  sourceModule: CalendarItem["sourceModule"];
  color: string;
  priority: ItemPriority;
  status?: string;           // source record status (e.g. "needs_scheduling")
  city?: string;
  address?: string;
  durationMinutes: number;
  preferredDate?: string;
  dueDate?: string;          // due/target date used by date-range queue filters
  jobType?: string;
  dispatchBoardId?: string;  // optional board affinity for board-specific views
}

// ─── Priority config ──────────────────────────────────────
export const PRIORITY_CONFIG: Record<ItemPriority, { label: string; bg: string; color: string }> = {
  low:    { label: "Low",    bg: "var(--bg-input)", color: "var(--text-muted)" },
  normal: { label: "Normal", bg: "#e0e7ff",         color: "#3730a3" },
  high:   { label: "High",   bg: "#ffedd5",         color: "#9a3412" },
  urgent: { label: "Urgent", bg: "#fee2e2",         color: "#991b1b" },
};

// ─── Technician status ────────────────────────────────────
export type TechStatusKind = "available" | "on_job" | "off_today" | "on_call" | "late_shift";

export const TECH_STATUS_CONFIG: Record<TechStatusKind, { label: string; color: string }> = {
  available:  { label: "Available", color: "#10b981" },
  on_job:     { label: "On Job",    color: "#3b82f6" },
  off_today:  { label: "Off Today", color: "#9ca3af" },
  on_call:    { label: "On Call",   color: "#8b5cf6" },
  late_shift: { label: "Late Shift",color: "#f59e0b" },
};

// ─── Service blocks (alternative to the hourly grid) ──────
export type DispatchMode = "hourly" | "blocks";

export interface ServiceBlock { key: string; label: string; startHour: number; endHour: number; }

export const SERVICE_BLOCKS: ServiceBlock[] = [
  { key: "b1", label: "8–10",  startHour: 8,  endHour: 10 },
  { key: "b2", label: "10–12", startHour: 10, endHour: 12 },
  { key: "b3", label: "1–3",   startHour: 13, endHour: 15 },
  { key: "b4", label: "3–5",   startHour: 15, endHour: 17 },
];

// ─── Layer display config ─────────────────────────────────
export const LAYER_CONFIG: Record<CalendarItemType, { label: string; color: string }> = {
  job:                { label: "Jobs",              color: "#4f46e5" },
  sales_appointment:  { label: "Sales Appointments",color: "#0891b2" },
  agreement_visit:    { label: "Agreement Visits",  color: "#059669" },
  task:               { label: "Tasks / Follow-Ups",color: "#f59e0b" },
  project_milestone:  { label: "Project Milestones",color: "#7c3aed" },
  work_order_review:  { label: "Work Order Review", color: "#db2777" },
  internal_event:     { label: "Internal Events",   color: "#0d9488" },
  blocked_time:       { label: "Blocked Time",      color: "#6b7280" },
  pto:                { label: "PTO",               color: "#9ca3af" },
  training:           { label: "Training",          color: "#8b5cf6" },
};

// Layers shown in the legend (MVP order). Native event types come last.
export const CALENDAR_LAYERS: CalendarItemType[] = [
  "job", "agreement_visit", "task", "project_milestone",
  "work_order_review", "sales_appointment",
  "internal_event", "blocked_time", "pto", "training",
];

// Business-hours grid for day/dispatch views
export const DAY_START_HOUR = 7;   // 7 AM
export const DAY_END_HOUR   = 19;  // 7 PM
export const HOUR_PX        = 56;  // pixels per hour
