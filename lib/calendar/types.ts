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
  color: string;
  customerName?: string;
  address?: string;
}

// An item awaiting a slot (no start time yet).
export interface UnscheduledItem {
  id: string;
  type: CalendarItemType;
  title: string;
  reason: string;            // why it's in the queue
  companyId: string;
  locationId: string;
  customerName?: string;
  value?: string;
  sourceId: string;
  sourceModule: CalendarItem["sourceModule"];
  color: string;
}

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
