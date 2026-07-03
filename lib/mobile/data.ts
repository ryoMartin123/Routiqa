// ─── Mobile / field data layer ────────────────────────────
// The mobile PWA is the SAME Routiqa data, scoped to one field user: "my" jobs,
// "my" route, "my" day. It reuses the CRM job/customer/task stores so anything a
// dispatcher schedules on desktop shows up here. No new source of truth.

import { getAllJobs, updateJob, type Job, type JobStatus } from "@/lib/jobs/data";
import { getStaffedUsers, type AppUser } from "@/lib/users/data";
import { getAllTasks, type Task } from "@/lib/tasks/data";
import { todayYMD } from "@/lib/utils/schedule";
import { capsFor, type MobileCaps } from "./permissions";

const TECH_ROLES = new Set(["field_technician", "installer"]);
const ACTING_KEY = "routiqa-mobile-acting-user"; // lets us pin a tech for the demo

// The signed-in user. Until a real login page lands, default to the org owner /
// admin (Ryo Martin) so it matches the desktop's current user — overridable via
// setActingTech for the demo. Falls back to the busiest technician only if no
// owner exists (so the demo is never empty).
export function getCurrentTech(): AppUser {
  const staffed = getStaffedUsers();
  if (typeof window !== "undefined") {
    const pinned = localStorage.getItem(ACTING_KEY);
    const found = pinned && staffed.find(u => u.id === pinned);
    if (found) return found;
  }
  const owner = staffed.find(u => u.isOrgOwner);
  if (owner) return owner;
  const jobs = getAllJobs();
  const techs = staffed.filter(u => u.assignments.some(a => TECH_ROLES.has(a.role)));
  const pool = techs.length ? techs : staffed;
  return [...pool]
    .map(t => ({ t, n: jobs.filter(j => j.assignedTo === t.fullName).length }))
    .sort((a, b) => b.n - a.n)[0]?.t ?? staffed[0];
}

export function setActingTech(userId: string) {
  if (typeof window !== "undefined") localStorage.setItem(ACTING_KEY, userId);
}

// True when the user can see manager surfaces (dispatch overview, team, approvals).
export function isFieldManager(u: AppUser): boolean {
  return !!u.isOrgOwner || u.assignments.some(a =>
    ["org_owner", "org_admin", "branch_manager", "location_manager", "dispatcher"].includes(a.role));
}
// Broad-access users get the full-permissions drawer navigation; field staff get
// the simple bottom nav.
export const isFullAccess = isFieldManager;

// Which mobile navigation experience to show. Derived from the acting user, but
// overridable so both can be previewed.
const EXP_KEY = "routiqa-mobile-experience";
export type MobileExperience = "field" | "full";
export function getMobileExperience(): MobileExperience {
  if (typeof window !== "undefined") {
    const o = localStorage.getItem(EXP_KEY);
    if (o === "field" || o === "full") return o;
  }
  const u = getCurrentTech();
  return u && isFullAccess(u) ? "full" : "field";
}
export function setMobileExperience(e: MobileExperience) {
  if (typeof window !== "undefined") localStorage.setItem(EXP_KEY, e);
}
// The user shown in the active experience (a manager/owner for the full drawer).
export function getMobileUser(): AppUser {
  if (getMobileExperience() === "full") {
    const mgr = getStaffedUsers().find(isFullAccess);
    if (mgr) return mgr;
  }
  return getCurrentTech();
}

// ── Capabilities ──────────────────────────────────────────
// What the acting user can see/do, resolved from the SAME roles the CRM
// declares (lib/roles). The whole mobile app gates off this.
export function getMobileCaps(): MobileCaps {
  return capsFor(getCurrentTech());
}

// ── My jobs ───────────────────────────────────────────────
const DONE: JobStatus[] = ["completed", "invoiced", "closed"];
// 12-hour times don't sort as strings ("1:00 PM" < "11:00 AM") — parse to minutes.
function timeVal(t?: string): number {
  const m = t?.match(/(\d+):(\d+)\s*(AM|PM)/i);
  if (!m) return 24 * 60;   // unscheduled sinks to the end
  const h = (parseInt(m[1], 10) % 12) + (m[3].toUpperCase() === "PM" ? 12 : 0);
  return h * 60 + parseInt(m[2], 10);
}
const sortByTime = (a: Job, b: Job) => timeVal(a.scheduledTime) - timeVal(b.scheduledTime);

// Scoped exactly like the CRM: jobs.view "all" (owner/manager/dispatcher) sees
// every open job; "own" (field tech, installer) sees only their assignments.
export function getMyJobs(): Job[] {
  const caps = getMobileCaps();
  if (caps.jobs === "none") return [];
  const open = getAllJobs().filter(j => j.status !== "canceled");
  if (caps.jobs === "all") return open;
  const me = getCurrentTech();
  return open.filter(j => j.assignedTo === me?.fullName);
}

export type JobBucket = "today" | "upcoming" | "completed" | "followup";

export function getMyJobsByBucket(bucket: JobBucket): Job[] {
  const today = todayYMD();
  const mine = getMyJobs();
  switch (bucket) {
    case "today":     return mine.filter(j => j.scheduledDate === today && !DONE.includes(j.status)).sort(sortByTime);
    case "upcoming":  return mine.filter(j => j.scheduledDate > today && !DONE.includes(j.status)).sort((a, b) => (a.scheduledDate + a.scheduledTime).localeCompare(b.scheduledDate + b.scheduledTime));
    case "completed": return mine.filter(j => DONE.includes(j.status)).sort((a, b) => (b.completedDate || "").localeCompare(a.completedDate || ""));
    case "followup":  return mine.filter(j => j.status === "waiting_on_customer" || j.status === "waiting_on_parts").sort(sortByTime);
  }
}

// The job to surface as "current" — an in-progress/en-route job wins, else the
// next scheduled one today.
export function getCurrentJob(): Job | undefined {
  const today = getMyJobsByBucket("today");
  return today.find(j => j.status === "in_progress" || j.status === "en_route") ?? today[0];
}

export function getMyTasks(): Task[] {
  const me = getCurrentTech();
  return getAllTasks().filter(t => t.status !== "completed" && (t.assignedTo === me?.fullName))
    .sort((a, b) => (a.dueDate || "").localeCompare(b.dueDate || ""));
}

// ── Status system (shared visual language with the CRM) ───
export const STATUS_META: Record<JobStatus, { label: string; color: string }> = {
  new:                 { label: "New",            color: "#6b7280" },
  scheduled:           { label: "Scheduled",      color: "#2563eb" },
  en_route:            { label: "En route",       color: "#0891b2" },
  in_progress:         { label: "In progress",    color: "#f59e0b" },
  waiting_on_parts:    { label: "On hold · parts", color: "#a855f7" },
  waiting_on_customer: { label: "Needs follow-up", color: "#a855f7" },
  waiting_on_approval: { label: "Needs approval",  color: "#a855f7" },
  completed:           { label: "Completed",      color: "#16a34a" },
  invoiced:            { label: "Invoiced",       color: "#16a34a" },
  closed:              { label: "Closed",         color: "#6b7280" },
  canceled:            { label: "Canceled",       color: "#dc2626" },
  no_show:             { label: "No show",        color: "#dc2626" },
};

export interface StatusAction { label: string; to: JobStatus; tone: "primary" | "neutral" | "warn" }

// The big thumb-friendly buttons on job detail, by current status.
export function primaryAction(status: JobStatus): StatusAction | null {
  switch (status) {
    case "new":
    case "scheduled":           return { label: "Start driving · En route", to: "en_route", tone: "primary" };
    case "en_route":            return { label: "Arrived · Start job", to: "in_progress", tone: "primary" };
    case "in_progress":         return { label: "Complete job", to: "completed", tone: "primary" };
    case "waiting_on_parts":
    case "waiting_on_customer":  return { label: "Resume job", to: "in_progress", tone: "primary" };
    default:                    return null;
  }
}

export function secondaryActions(status: JobStatus): StatusAction[] {
  switch (status) {
    case "en_route":    return [{ label: "Back to scheduled", to: "scheduled", tone: "neutral" }];
    case "in_progress": return [
      { label: "Pause · waiting on parts", to: "waiting_on_parts", tone: "warn" },
      { label: "Needs follow-up", to: "waiting_on_customer", tone: "warn" },
    ];
    default:            return [];
  }
}

// Apply a status change as the assigned field user, stamping lifecycle times.
export function setMyJobStatus(jobId: string, to: JobStatus): Job | undefined {
  const now = new Date().toISOString();
  const stamp: Partial<Job> =
    to === "en_route"    ? { enRouteAt: now } :
    to === "in_progress" ? { startedAt: now } :
    to === "completed"   ? { completedAt: now, completedDate: todayYMD() } : {};
  return updateJob(jobId, { status: to, ...stamp });
}

// ── Clock in/out (mock, per-day) ──────────────────────────
const CLOCK_KEY = "routiqa-mobile-clock";
export function getClockState(): { in: boolean; since?: string } {
  if (typeof window === "undefined") return { in: false };
  try { return JSON.parse(localStorage.getItem(CLOCK_KEY) || "") || { in: false }; }
  catch { return { in: false }; }
}
export function toggleClock(): { in: boolean; since?: string } {
  const cur = getClockState();
  const next = cur.in ? { in: false } : { in: true, since: new Date().toISOString() };
  if (typeof window !== "undefined") localStorage.setItem(CLOCK_KEY, JSON.stringify(next));
  return next;
}
