// Unscheduled Queue — saved views (a.k.a. queue tabs).
//
// A "queue view" is a named, saved filter over the Unscheduled Queue. The
// dispatch board renders one tab per active+visible view instead of a hardcoded
// list, so admins can add/edit/reorder custom tabs (e.g. "Today", "Emergency",
// "Install Ready") without code changes.
//
// Views are persisted inside the DispatchStore (see settings.ts) so they save
// alongside the rest of the Calendar / Dispatch settings. This module owns only
// the shape, the system defaults, and the filter engine — no persistence, to
// keep it free of import cycles with settings.ts.

import type { CalendarItemType, ItemPriority, UnscheduledItem } from "./types";

// Where a queue item ultimately comes from. Broader than CalendarItemType so a
// "job" sourced from an approved quote can be told apart from a field job.
export type QueueSourceType =
  | "job"
  | "agreement_visit"
  | "approved_quote"
  | "task_follow_up"
  | "project_milestone";

export const SOURCE_TYPE_LABELS: Record<QueueSourceType, string> = {
  job: "Job",
  agreement_visit: "Agreement Visit",
  approved_quote: "Approved Quote",
  task_follow_up: "Task / Follow-Up",
  project_milestone: "Project Milestone",
};

// A view's filter set. Every present key must match (AND across keys); within a
// key, the array is an OR. An empty/omitted filter matches everything — that's
// what makes the "All" view show the whole queue.
export interface QueueFilters {
  sourceTypes?: QueueSourceType[];
  itemTypes?: CalendarItemType[];
  jobTypes?: string[];
  priorities?: ItemPriority[];
  statuses?: string[];
  reasonContains?: string;
  dispatchBoardId?: string;
  locationIds?: string[];
  serviceAreaIds?: string[];
  // Items whose due/preferred date falls within N days from today (0 = today).
  // "ASAP"/no-date items are treated as always-due so they never hide.
  dueWithinDays?: number;
}

// A saved queue tab/view.
export interface QueueView {
  id: string;
  name: string;
  key: string;            // stable slug used for selection
  color?: string;         // optional accent for the tab
  order: number;
  active: boolean;        // available at all
  defaultVisible: boolean;// shown as a tab on first load
  system?: boolean;       // built-in default (can be hidden/edited, not deleted)
  filters: QueueFilters;
}

// ─── System default views ─────────────────────────────────
// Kept as the out-of-the-box tabs. Admins can deactivate, reorder, or add to
// these; only custom (non-system) views can be deleted.
export function defaultQueueViews(): QueueView[] {
  return [
    { id: "qv-all",      key: "all",      name: "All",                order: 0, active: true, defaultVisible: true, system: true, filters: {} },
    { id: "qv-urgent",   key: "urgent",   name: "Urgent",             order: 1, active: true, defaultVisible: true, system: true, color: "#dc2626", filters: { priorities: ["urgent"] } },
    { id: "qv-jobs",     key: "jobs",     name: "Jobs",               order: 2, active: true, defaultVisible: true, system: true, filters: { sourceTypes: ["job"] } },
    { id: "qv-agr",      key: "agreement_visits", name: "Agreement Visits", order: 3, active: true, defaultVisible: true, system: true, filters: { sourceTypes: ["agreement_visit"] } },
    { id: "qv-tasks",    key: "tasks",    name: "Tasks / Follow-Ups", order: 4, active: true, defaultVisible: true, system: true, filters: { sourceTypes: ["task_follow_up"] } },
    { id: "qv-quotes",   key: "approved_quotes", name: "Approved Quotes", order: 5, active: true, defaultVisible: true, system: true, filters: { sourceTypes: ["approved_quote"] } },
    { id: "qv-projects", key: "project_items", name: "Project Items",  order: 6, active: true, defaultVisible: true, system: true, filters: { sourceTypes: ["project_milestone"] } },
  ];
}

// ─── Filter engine ────────────────────────────────────────
function parseDue(item: UnscheduledItem): Date | null {
  const raw = item.dueDate ?? item.preferredDate;
  if (!raw) return null;
  const d = new Date(raw);
  return isNaN(d.getTime()) ? null : d;
}

function dueWithin(item: UnscheduledItem, days: number): boolean {
  const due = parseDue(item);
  if (!due) return true; // "ASAP"/undated items always qualify as due
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const limit = new Date(today); limit.setDate(limit.getDate() + days); limit.setHours(23, 59, 59, 999);
  return due.getTime() <= limit.getTime();
}

// Does an unscheduled item satisfy a view's filters?
export function matchesQueueView(item: UnscheduledItem, view: QueueView): boolean {
  const f = view.filters;
  if (f.sourceTypes?.length   && !f.sourceTypes.includes(item.sourceType)) return false;
  if (f.itemTypes?.length     && !f.itemTypes.includes(item.type)) return false;
  if (f.jobTypes?.length      && !(item.jobType && f.jobTypes.includes(item.jobType))) return false;
  if (f.priorities?.length    && !f.priorities.includes(item.priority)) return false;
  if (f.statuses?.length      && !(item.status && f.statuses.includes(item.status))) return false;
  if (f.locationIds?.length   && !f.locationIds.includes(item.locationId)) return false;
  if (f.serviceAreaIds?.length && !(item.serviceAreaId && f.serviceAreaIds.includes(item.serviceAreaId))) return false;
  if (f.dispatchBoardId       && item.dispatchBoardId !== f.dispatchBoardId) return false;
  if (f.reasonContains        && !item.reason.toLowerCase().includes(f.reasonContains.toLowerCase())) return false;
  if (f.dueWithinDays != null && !dueWithin(item, f.dueWithinDays)) return false;
  return true;
}

// Count items matching a view (for the tab badge).
export function countForView(items: UnscheduledItem[], view: QueueView): number {
  return items.reduce((n, i) => n + (matchesQueueView(i, view) ? 1 : 0), 0);
}

export function newQueueViewId(): string { return `qv-${Math.random().toString(36).slice(2, 8)}`; }

export function slugify(name: string): string {
  return name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "view";
}
