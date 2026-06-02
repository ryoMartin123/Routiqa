// Calendar aggregator — normalizes scheduled records from many modules into
// CalendarItem[]. Filtering by hierarchy scope happens here so views stay dumb.

import { ALL_JOBS, WORK_ORDERS, JOB_STATUS_CONFIG, type Job } from "@/lib/jobs/data";
import { ALL_TASKS } from "@/lib/tasks/data";
import { AGREEMENTS } from "@/lib/agreements/data";
import { ALL_PROJECTS } from "@/lib/projects/data";
import { getAllQuotes } from "@/lib/quotes/data";
import { locations as HIER_LOCATIONS } from "@/lib/hierarchy/data";
import {
  LAYER_CONFIG, type CalendarItem, type CalendarItemType, type UnscheduledItem,
  type ItemPriority, type TechStatusKind,
} from "./types";

// City from an address string ("412 Oak St, Augusta, GA" → "Augusta").
function cityFromAddress(addr?: string): string | undefined {
  if (!addr) return undefined;
  const parts = addr.split(",").map(s => s.trim());
  return parts.length >= 2 ? parts[1] : undefined;
}

export interface CalendarScope {
  companyId?: string;
  locationId?: string;
  serviceAreaId?: string;
}

// ─── Date parsing ─────────────────────────────────────────
// Mock data stores human strings ("Jun 12, 2026", "8:00 AM"). Real data will use
// ISO timestamps; this helper is the only place that needs to change then.
function parseDateTime(dateStr: string, timeStr?: string): Date | null {
  const d = new Date(timeStr ? `${dateStr} ${timeStr}` : dateStr);
  return isNaN(d.getTime()) ? null : d;
}

// Map an agreement's location label ("Augusta") to a hierarchy location.
const LOC_BY_LABEL = new Map(
  HIER_LOCATIONS.map(l => [l.name.replace(/ Branch$/, "").toLowerCase(), l]),
);
function resolveAgreementLocation(label: string): { companyId: string; locationId: string } {
  const loc = LOC_BY_LABEL.get(label.toLowerCase());
  return loc ? { companyId: loc.companyId, locationId: loc.id } : { companyId: "", locationId: "" };
}

function inScope(item: { companyId: string; locationId: string; serviceAreaId?: string }, scope: CalendarScope): boolean {
  if (scope.companyId     && item.companyId     !== scope.companyId)     return false;
  if (scope.locationId    && item.locationId    !== scope.locationId)    return false;
  if (scope.serviceAreaId && item.serviceAreaId !== scope.serviceAreaId) return false;
  return true;
}

// ─── Source → CalendarItem ────────────────────────────────
function jobToItem(job: Job): CalendarItem | null {
  const start = parseDateTime(job.scheduledDate, job.scheduledTime);
  if (!start) return null;
  const end = new Date(start.getTime() + job.durationMinutes * 60_000);
  const cfg = JOB_STATUS_CONFIG[job.status];
  return {
    id: `job-${job.id}`,
    type: "job",
    title: job.title,
    start, end, allDay: false, durationMinutes: job.durationMinutes,
    assignedTo: job.assignedTo, assignedToInitials: job.assignedToInitials,
    companyId: job.companyId, locationId: job.locationId, serviceAreaId: job.serviceAreaId,
    sourceId: job.id, sourceModule: "jobs",
    status: cfg?.label ?? job.status,
    color: LAYER_CONFIG.job.color,
    customerName: job.customerName, address: job.propertyAddress,
    city: cityFromAddress(job.propertyAddress),
    jobType: job.type.charAt(0).toUpperCase() + job.type.slice(1),
    priority: job.priority,
  };
}

// ─── Public API ───────────────────────────────────────────
export function getCalendarItems(scope: CalendarScope): CalendarItem[] {
  const items: CalendarItem[] = [];

  // Jobs
  for (const job of ALL_JOBS) {
    const item = jobToItem(job);
    if (item && inScope(item, scope)) items.push(item);
  }

  // Tasks / follow-ups (all-day)
  for (const t of ALL_TASKS) {
    if (t.status === "completed") continue;
    const day = parseDateTime(t.dueDate);
    if (!day) continue;
    const start = new Date(day); start.setHours(0, 0, 0, 0);
    const end = new Date(start); end.setHours(23, 59, 59);
    const item: CalendarItem = {
      id: `task-${t.id}`, type: "task", title: t.title,
      start, end, allDay: true, durationMinutes: 0,
      assignedTo: t.assignedTo, assignedToInitials: t.assignedToInitials,
      companyId: t.companyId, locationId: t.locationId,
      sourceId: t.id, sourceModule: "tasks",
      status: t.status, color: LAYER_CONFIG.task.color,
      customerName: t.customerName,
    };
    if (inScope(item, scope)) items.push(item);
  }

  // Agreement visits (scheduled, not completed)
  for (const a of AGREEMENTS) {
    const loc = resolveAgreementLocation(a.location);
    for (const v of a.visits) {
      if (v.status !== "scheduled") continue;
      const day = parseDateTime(v.scheduled);
      if (!day) continue;
      const start = new Date(day); start.setHours(9, 0, 0, 0); // default morning slot
      const end = new Date(start.getTime() + 90 * 60_000);
      const item: CalendarItem = {
        id: `visit-${v.id}`, type: "agreement_visit",
        title: `${v.label} — ${a.customer}`,
        start, end, allDay: false, durationMinutes: 90,
        assignedTo: v.tech, assignedToInitials: initials(v.tech),
        companyId: loc.companyId, locationId: loc.locationId,
        sourceId: a.id, sourceModule: "agreements",
        status: "Scheduled", color: LAYER_CONFIG.agreement_visit.color,
        customerName: a.customer,
      };
      if (inScope(item, scope)) items.push(item);
    }
  }

  // Project milestones (target dates, all-day)
  for (const p of ALL_PROJECTS) {
    if (!p.targetDate) continue;
    const day = parseDateTime(p.targetDate);
    if (!day) continue;
    const start = new Date(day); start.setHours(0, 0, 0, 0);
    const end = new Date(start); end.setHours(23, 59, 59);
    const item: CalendarItem = {
      id: `milestone-${p.id}`, type: "project_milestone",
      title: `${p.name} — target`,
      start, end, allDay: true, durationMinutes: 0,
      assignedTo: p.assignedTo, assignedToInitials: p.assignedToInitials,
      companyId: p.companyId, locationId: p.locationId, serviceAreaId: p.serviceAreaId,
      sourceId: p.id, sourceModule: "projects",
      status: p.status, color: LAYER_CONFIG.project_milestone.color,
      customerName: p.customerName,
    };
    if (inScope(item, scope)) items.push(item);
  }

  // Work order review (completed WOs awaiting sign-off, all-day reminder)
  for (const [jobId, wo] of Object.entries(WORK_ORDERS)) {
    if (wo.status !== "completed") continue;
    const job = ALL_JOBS.find(j => j.id === jobId);
    if (!job) continue;
    const day = parseDateTime(job.completedDate ?? job.scheduledDate);
    if (!day) continue;
    const start = new Date(day); start.setHours(0, 0, 0, 0);
    const end = new Date(start); end.setHours(23, 59, 59);
    const item: CalendarItem = {
      id: `wo-review-${wo.id}`, type: "work_order_review",
      title: `Review: ${wo.title}`,
      start, end, allDay: true, durationMinutes: 0,
      assignedTo: job.assignedTo, assignedToInitials: job.assignedToInitials,
      companyId: job.companyId, locationId: job.locationId, serviceAreaId: job.serviceAreaId,
      sourceId: jobId, sourceModule: "jobs",
      status: "Awaiting review", color: LAYER_CONFIG.work_order_review.color,
      customerName: job.customerName,
    };
    if (inScope(item, scope)) items.push(item);
  }

  return items.sort((a, b) => a.start.getTime() - b.start.getTime());
}

// ─── Unscheduled queue (triage) ───────────────────────────
export function getUnscheduledItems(scope: CalendarScope): UnscheduledItem[] {
  const out: UnscheduledItem[] = [];

  // Approved quotes waiting to be scheduled into a job
  for (const q of getAllQuotes()) {
    if (q.status !== "approved") continue;
    if (!inScope({ companyId: q.companyId, locationId: q.locationId }, scope)) continue;
    out.push({
      id: `uq-quote-${q.id}`, type: "job", sourceType: "approved_quote", title: q.title,
      reason: "Approved quote not scheduled", status: "approved",
      companyId: q.companyId, locationId: q.locationId,
      customerName: q.customerName, value: `$${q.total.toLocaleString()}`,
      sourceId: q.id, sourceModule: "quotes", color: LAYER_CONFIG.job.color,
      priority: "high", durationMinutes: 240, jobType: "Installation",
    });
  }

  // Synthetic field-work waiting on dispatch (callbacks / reschedules)
  const synthetic: UnscheduledItem[] = [
    {
      id: "uq-callback-1", type: "job", sourceType: "job", title: "Callback: AC not cooling",
      reason: "Needs tech assigned", status: "needs_scheduling", companyId: "co_hvac", locationId: "loc_augusta",
      customerName: "Alvarez Residence", city: "Augusta", address: "1840 Peach Orchard Rd, Augusta, GA",
      sourceId: "7", sourceModule: "jobs", color: LAYER_CONFIG.job.color,
      priority: "urgent", durationMinutes: 120, jobType: "Repair", preferredDate: "ASAP",
    },
    {
      id: "uq-reschedule-1", type: "job", sourceType: "job", title: "Reschedule: Water heater install",
      reason: "Waiting for customer confirmation", status: "waiting_on_customer", companyId: "co_hvac", locationId: "loc_augusta",
      customerName: "K. Brennan", city: "Augusta", address: "27 Maple Ct, Augusta, GA",
      sourceId: "3", sourceModule: "jobs", color: LAYER_CONFIG.job.color,
      priority: "normal", durationMinutes: 120, jobType: "Installation",
    },
  ];
  for (const s of synthetic) if (inScope(s, scope)) out.push(s);

  // Open "schedule"/"call" tasks needing an appointment
  for (const t of ALL_TASKS) {
    if (t.status === "completed") continue;
    if (t.type !== "schedule" && t.type !== "call") continue;
    if (!inScope({ companyId: t.companyId, locationId: t.locationId }, scope)) continue;
    out.push({
      id: `uq-task-${t.id}`, type: "task", sourceType: "task_follow_up", title: t.title,
      reason: "Follow-up needs scheduling", status: t.status,
      companyId: t.companyId, locationId: t.locationId,
      customerName: t.customerName,
      sourceId: t.id, sourceModule: "tasks", color: LAYER_CONFIG.task.color,
      priority: t.status === "overdue" ? "urgent" : "normal",
      durationMinutes: 30, preferredDate: t.dueDate, dueDate: t.dueDate,
    });
  }

  // Agreement visits due
  for (const a of AGREEMENTS) {
    if (a.status !== "due_soon" && a.status !== "overdue") continue;
    const loc = resolveAgreementLocation(a.location);
    if (!inScope({ companyId: loc.companyId, locationId: loc.locationId }, scope)) continue;
    out.push({
      id: `uq-agr-${a.id}`, type: "agreement_visit", sourceType: "agreement_visit",
      title: `${a.type} — ${a.customer}`,
      reason: "Agreement visit due", status: a.status,
      companyId: loc.companyId, locationId: loc.locationId,
      customerName: a.customer,
      sourceId: a.id, sourceModule: "agreements", color: LAYER_CONFIG.agreement_visit.color,
      priority: a.status === "overdue" ? "urgent" : "normal",
      durationMinutes: 90, preferredDate: a.nextVisit ?? undefined, dueDate: a.nextVisit ?? undefined,
    });
  }

  // Priority sort: urgent → high → normal → low
  const rank: Record<ItemPriority, number> = { urgent: 0, high: 1, normal: 2, low: 3 };
  return out.sort((x, y) => rank[x.priority] - rank[y.priority]);
}

// ─── Helpers ──────────────────────────────────────────────
function initials(name: string): string {
  const parts = name.replace(/\(.*\)/, "").trim().split(/\s+/);
  return (parts.length >= 2 ? parts[0][0] + parts[parts.length - 1][0] : name.slice(0, 2)).toUpperCase();
}

// Distinct technicians appearing in scheduled items (for reassign dropdown).
export function getTechnicians(items: CalendarItem[]): string[] {
  return Array.from(new Set(items.filter(i => i.assignedTo).map(i => i.assignedTo!))).sort();
}

// ─── Technician roster (dispatch rows) ────────────────────
// Mock field-tech roster with daily status. Includes the techs referenced by
// jobs plus a couple extra to show status variety. Replace with a users query.
export interface TechRosterEntry { name: string; initials: string; status: TechStatusKind }

export const TECH_ROSTER: TechRosterEntry[] = [
  { name: "J. Patel",  initials: "JP", status: "on_job" },
  { name: "M. Cole",   initials: "MC", status: "available" },
  { name: "D. Nguyen", initials: "DN", status: "on_call" },
  { name: "T. Brooks", initials: "TB", status: "late_shift" },
  { name: "R. Avery",  initials: "RA", status: "off_today" },
];

export function getTechRoster(): TechRosterEntry[] {
  return TECH_ROSTER;
}

// ─── Dispatch boards / teams ──────────────────────────────
// Placeholder concept. In production these are configured per location in
// Settings → Dispatch Settings (board name, type, dispatcher, techs/crews,
// job types, location, service area, active). Mock data shows the UI concept.
export interface DispatchBoardDef {
  id: string;
  name: string;
  dispatcher?: string;
  techNames: string[];   // empty = all technicians
}

export const DISPATCH_BOARDS: DispatchBoardDef[] = [
  { id: "all",        name: "All Boards" ,    techNames: [] },
  { id: "service",    name: "Service Board",    dispatcher: "Sara",   techNames: ["M. Cole", "T. Brooks"] },
  { id: "install",    name: "Install Board",    dispatcher: "Kylie",  techNames: ["J. Patel", "D. Nguyen"] },
  { id: "commercial", name: "Commercial Board", dispatcher: "Ernest", techNames: ["D. Nguyen", "R. Avery"] },
];

export function getDispatchBoards(): DispatchBoardDef[] {
  return DISPATCH_BOARDS;
}
