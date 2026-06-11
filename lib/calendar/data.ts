// Calendar aggregator — normalizes scheduled records from many modules into
// CalendarItem[]. Filtering by hierarchy scope happens here so views stay dumb.

import { ALL_JOBS, getAllJobs, getSessionJobs, WORK_ORDERS, JOB_STATUS_CONFIG, type Job } from "@/lib/jobs/data";
import { getAllTasks } from "@/lib/tasks/data";
import { getAllAgreements, getVisitsToSchedule, type CustomerAgreement, type AgreementVisit } from "@/lib/agreements/data";
import { ALL_PROJECTS } from "@/lib/projects/data";
import { getAllQuotes } from "@/lib/quotes/data";
import { getTechnicianUsers, getStaffedUsers } from "@/lib/users/data";
import { locations as HIER_LOCATIONS } from "@/lib/hierarchy/data";
import {
  LAYER_CONFIG, jobStatusToLane, type CalendarItem, type CalendarItemType, type UnscheduledItem,
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
  // Canceled jobs leave the active board/calendar — they live in the Jobs
  // "Canceled" tab until reactivated or deleted.
  if (job.status === "canceled") return null;
  const start = parseDateTime(job.scheduledDate, job.scheduledTime);
  if (!start) return null;
  const end = new Date(start.getTime() + job.durationMinutes * 60_000);
  const cfg = JOB_STATUS_CONFIG[job.status];
  // dispatchType is the visual layer (job / agreement_visit / sales_appointment /
  // task) — the lifecycle/status is always the Job's.
  const type = (job.dispatchType ?? "job") as CalendarItemType;
  return {
    id: `job-${job.id}`,
    type,
    title: job.title,
    start, end, allDay: false, durationMinutes: job.durationMinutes,
    assignedTo: job.assignedTo, assignedToInitials: job.assignedToInitials,
    companyId: job.companyId, locationId: job.locationId, serviceAreaId: job.serviceAreaId,
    sourceId: job.id, sourceModule: "jobs",
    status: cfg?.label ?? job.status,
    lane: jobStatusToLane(job.status),
    color: (LAYER_CONFIG[type] ?? LAYER_CONFIG.job).color,
    customerName: job.customerName, address: job.propertyAddress,
    city: cityFromAddress(job.propertyAddress),
    jobType: job.type.charAt(0).toUpperCase() + job.type.slice(1),
    priority: job.priority,
    description: job.description,
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
  for (const t of getAllTasks()) {
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
  for (const a of getAllAgreements()) {
    const loc = resolveAgreementLocation(a.location);
    for (const v of a.visits) {
      if (v.status !== "scheduled") continue;
      // A booked visit is materialized into a Job and already renders via jobToItem;
      // skip it here so it isn't drawn twice (and so the Job stays its single source
      // of truth — moving the job is what reschedules the visit).
      if (v.jobId) continue;
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

// ─── Converted-source guard ───────────────────────────────
// When a queue source (approved quote, agreement visit, follow-up task) is
// scheduled, it spawns a Job. We persist the source key here so it stops
// appearing in the queue — without it, the source would re-surface on reload
// alongside the new Job (a duplicate).
const CONVERTED_KEY = "crm-dispatch-converted";
let _converted: Set<string> | null = null;
function convertedSet(): Set<string> {
  if (_converted) return _converted;
  if (typeof window === "undefined") return new Set();
  try { const r = localStorage.getItem(CONVERTED_KEY); _converted = new Set<string>(r ? JSON.parse(r) : []); }
  catch { _converted = new Set(); }
  return _converted!;
}
export function markSourceScheduled(sourceModule: string, sourceId: string): void {
  const s = convertedSet(); s.add(`${sourceModule}:${sourceId}`);
  try { localStorage.setItem(CONVERTED_KEY, JSON.stringify([...s])); } catch { /* ignore */ }
}
function isConverted(sourceModule: string, sourceId: string): boolean {
  return convertedSet().has(`${sourceModule}:${sourceId}`);
}

// ─── Unscheduled queue (triage) ───────────────────────────
export function getUnscheduledItems(scope: CalendarScope): UnscheduledItem[] {
  const out: UnscheduledItem[] = [];

  // Approved quotes waiting to be scheduled into a job
  for (const q of getAllQuotes()) {
    if (q.status !== "approved") continue;
    if (isConverted("quotes", q.id)) continue;
    if (!inScope({ companyId: q.companyId, locationId: q.locationId }, scope)) continue;
    out.push({
      id: `uq-quote-${q.id}`, type: "job", sourceType: "approved_quote", title: q.title,
      reason: "Approved quote not scheduled", status: "approved",
      companyId: q.companyId, locationId: q.locationId,
      customerName: q.customerName, accountId: q.customerId, value: `$${q.total.toLocaleString()}`,
      sourceId: q.id, sourceModule: "quotes", color: LAYER_CONFIG.job.color,
      priority: "high", durationMinutes: 240, jobType: "Installation",
    });
  }

  // Open "schedule"/"call" tasks needing an appointment
  for (const t of getAllTasks()) {
    if (t.status === "completed") continue;
    if (t.type !== "schedule" && t.type !== "call") continue;
    if (isConverted("tasks", t.id)) continue;
    if (!inScope({ companyId: t.companyId, locationId: t.locationId }, scope)) continue;
    out.push({
      id: `uq-task-${t.id}`, type: "task", sourceType: "task_follow_up", title: t.title,
      reason: "Follow-up needs scheduling", status: t.status,
      companyId: t.companyId, locationId: t.locationId,
      customerName: t.customerName, accountId: t.customerId,
      sourceId: t.id, sourceModule: "tasks", color: LAYER_CONFIG.task.color,
      priority: t.status === "overdue" ? "urgent" : "normal",
      durationMinutes: 30, preferredDate: t.dueDate, dueDate: t.dueDate,
    });
  }

  // Agreement visits due
  for (const a of getAllAgreements()) {
    if (a.status !== "due_soon" && a.status !== "overdue") continue;
    if (isConverted("agreements", a.id)) continue;
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

// Planned agreement visits awaiting a job, scoped to the viewing context. Feeds the
// dispatch board's "Schedule Agreement Visit" picker — each is still a plan entry and
// becomes a Job only when scheduled (materializeVisitJob). Unlike the due-soon queue
// above, this lists EVERY planned visit regardless of date, so a visit can be booked
// early/ad-hoc whenever the customer wants it.
export interface SchedulableVisit { agreement: CustomerAgreement; visit: AgreementVisit; companyId: string; locationId: string }
export function getSchedulableVisits(scope: CalendarScope): SchedulableVisit[] {
  const out: SchedulableVisit[] = [];
  for (const { agreement, visit } of getVisitsToSchedule()) {
    const loc = resolveAgreementLocation(agreement.location);
    if (!inScope({ companyId: loc.companyId, locationId: loc.locationId }, scope)) continue;
    out.push({ agreement, visit, companyId: loc.companyId, locationId: loc.locationId });
  }
  return out;
}

// Scheduled jobs created in-session (e.g. via the New Job form). The board/
// calendar build their seed items from ALL_JOBS during render; these are merged
// in client-side via an effect so they appear without a hydration mismatch.
export function getSessionCalendarItems(scope: CalendarScope): CalendarItem[] {
  const out: CalendarItem[] = [];
  for (const job of getSessionJobs()) {
    const item = jobToItem(job);          // null when the job has no scheduled date
    if (item && inScope(item, scope)) out.push(item);
  }
  return out;
}

// Jobs that exist but have no scheduled slot yet (e.g. created by converting a
// quote). Loaded client-side (reads the session job store), so the dispatch
// page merges these in via an effect rather than during render.
const JOB_DONE = new Set(["completed", "invoiced", "closed", "canceled", "no_show"]);
export function getUnscheduledJobs(scope: CalendarScope): UnscheduledItem[] {
  const out: UnscheduledItem[] = [];
  for (const job of getAllJobs()) {
    if (JOB_DONE.has(job.status)) continue;
    if (parseDateTime(job.scheduledDate, job.scheduledTime)) continue;  // already scheduled
    if (!inScope({ companyId: job.companyId, locationId: job.locationId, serviceAreaId: job.serviceAreaId }, scope)) continue;
    out.push({
      id: `uq-job-${job.id}`, type: "job", sourceType: "job", title: job.title,
      reason: "New job — needs scheduling", status: job.status,
      companyId: job.companyId, locationId: job.locationId, serviceAreaId: job.serviceAreaId,
      customerName: job.customerName, address: job.propertyAddress, city: cityFromAddress(job.propertyAddress),
      sourceId: job.id, sourceModule: "jobs", color: LAYER_CONFIG.job.color,
      priority: job.priority, durationMinutes: job.durationMinutes,
      jobType: job.type.charAt(0).toUpperCase() + job.type.slice(1),
      value: job.estimatedAmount,
      description: job.description,
    });
  }
  return out;
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
// Derived from the user directory: active users holding a Technician role. Daily
// dispatch status isn't modeled on the user yet, so everyone shows "available".
// NOTE: reads the (localStorage-backed) user store, so callers must load this
// client-side via effect — not during SSR render — to avoid hydration mismatch.
export interface TechRosterEntry { name: string; initials: string; status: TechStatusKind }

export function getTechRoster(): TechRosterEntry[] {
  return getTechnicianUsers().map(u => ({
    name: u.fullName, initials: u.initials, status: "available" as const,
  }));
}

// Everyone on the team — used as the board roster (anyone can be scheduled) and
// the job-assignee list. A board narrows this via its members/roles.
export function getStaffRoster(): TechRosterEntry[] {
  return getStaffedUsers().map(u => ({
    name: u.fullName, initials: u.initials, status: "available" as const,
  }));
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

export const DISPATCH_BOARDS: DispatchBoardDef[] = [];

export function getDispatchBoards(): DispatchBoardDef[] {
  return DISPATCH_BOARDS;
}
