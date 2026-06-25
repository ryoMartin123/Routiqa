// ─── Global tasks — types + mock data ─────────────────────
// Aggregates tasks from customer, lead, job, and project contexts.
// Tasks created in the app persist to localStorage (mirroring the customers,
// leads, and jobs stores) until Supabase is connected:
//   supabase.from('tasks').select('*')
//     .eq('organization_id', orgId).order('due_date')

import { organization } from "@/lib/hierarchy/data";

export type TaskStatus = "open" | "overdue" | "completed";

// Built-in task type keys shipped out of the box. The calendar keys off
// "schedule"/"call" for triage, so those stay stable.
export type BuiltInTaskType =
  | "follow_up"
  | "call"
  | "schedule"
  | "send_estimate"
  | "send_agreement"
  | "review"
  | "inspection"
  | "other";

// Stored as a free string: admins can add custom task types in
// Settings → Tasks. The built-ins above are the defaults.
export type TaskType = string;

export interface Task {
  id: string;
  organizationId: string;
  companyId: string;
  locationId: string;

  title: string;
  type: TaskType;
  status: TaskStatus;
  dueDate: string;
  completedAt?: string;
  assignedTo: string;
  assignedToInitials: string;
  notes?: string;

  // Optional linked records
  customerId?: string;
  customerName?: string;
  leadId?: string;
  jobId?: string;
  projectId?: string;

  // Display
  linkedLabel?: string;
  linkedHref?: string;
  linkedType?: "customer" | "lead" | "job" | "project";

  createdAt: string;
}

// ─── Display config ───────────────────────────────────────
// Default labels for the built-in types. Settings → Tasks can override these
// and add custom types; use taskTypeLabel() from lib/tasks/settings to resolve
// a key to its current label.
export const TASK_TYPE_LABELS: Record<BuiltInTaskType, string> = {
  follow_up:      "Follow-Up",
  call:           "Call",
  schedule:       "Schedule",
  send_estimate:  "Send Estimate",
  send_agreement: "Send Agreement",
  review:         "Review",
  inspection:     "Inspection",
  other:          "Other",
};

// ─── Mock tasks (seed) ────────────────────────────────────
export const ALL_TASKS: Task[] = [];

// ─── Runtime store (pre-Supabase) ─────────────────────────
// Tasks created in the app persist to localStorage, mirroring the customers,
// leads, and jobs stores. Loaded lazily on first client-side access.
const TASKS_KEY = "crm-extra-tasks";
let _extra: Task[] | null = null;

function extraTasks(): Task[] {
  if (_extra) return _extra;
  if (typeof window === "undefined") return [];
  try { const raw = localStorage.getItem(TASKS_KEY); _extra = raw ? (JSON.parse(raw) as Task[]) : []; }
  catch { _extra = []; }
  return _extra!;
}
function persistTasks(): void {
  if (typeof window === "undefined" || !_extra) return;
  try { localStorage.setItem(TASKS_KEY, JSON.stringify(_extra)); } catch { /* ignore */ }
}

function initialsOf(name: string): string {
  const p = name.replace(/\(.*\)/, "").trim().split(/\s+/);
  return (p.length >= 2 ? p[0][0] + p[p.length - 1][0] : name.slice(0, 2)).toUpperCase();
}

// A non-completed task whose due date has passed is overdue. Computed at read
// time so "overdue" stays correct as the calendar rolls forward — created tasks
// only ever store "open" or "completed"; the overdue state is always derived.
export function taskIsOverdue(t: Task): boolean {
  if (t.status === "completed") return false;
  const due = new Date(t.dueDate);
  if (isNaN(due.getTime())) return t.status === "overdue";  // unparseable → trust stored
  due.setHours(0, 0, 0, 0);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return due.getTime() < today.getTime();
}

// Normalize a task's status to reflect the current date (open ⇄ overdue).
function withStatus(t: Task): Task {
  if (t.status === "completed") return t;
  const next: TaskStatus = taskIsOverdue(t) ? "overdue" : "open";
  return next === t.status ? t : { ...t, status: next };
}

// ─── Lookup helpers ───────────────────────────────────────
export function getAllTasks(): Task[] {
  return [...ALL_TASKS, ...extraTasks()].map(withStatus);
}

export function getTask(id: string): Task | undefined {
  return getAllTasks().find(t => t.id === id);
}

export function getTasksForCustomer(customerId: string): Task[] {
  return getAllTasks().filter(t => t.customerId === customerId && !t.leadId && !t.jobId);
}

export function getTasksForLead(leadId: string): Task[] {
  return getAllTasks().filter(t => t.leadId === leadId);
}

export function getTasksForJob(jobId: string): Task[] {
  return getAllTasks().filter(t => t.jobId === jobId);
}

export function getTasksForProject(projectId: string): Task[] {
  return getAllTasks().filter(t => t.projectId === projectId);
}

// ─── Create / update / delete ─────────────────────────────
export interface NewTaskInput {
  title: string;
  type: TaskType;
  dueDate: string;            // display + parseable, e.g. "Jun 12, 2026"
  assignedTo?: string;        // defaults to "Unassigned"
  notes?: string;

  companyId: string;
  locationId: string;

  // Optional linked record (any one of these)
  customerId?: string;
  customerName?: string;
  leadId?: string;
  jobId?: string;
  projectId?: string;
  linkedLabel?: string;
  linkedHref?: string;
  linkedType?: "customer" | "lead" | "job" | "project";
}

export function createTask(input: NewTaskInput): Task {
  const now = new Date();
  const assignedTo = input.assignedTo?.trim() || "Unassigned";
  const task: Task = {
    id: `task-${now.getTime()}-${Math.random().toString(36).slice(2, 6)}`,
    organizationId: organization.id,
    companyId: input.companyId,
    locationId: input.locationId,
    title: input.title.trim(),
    type: input.type,
    status: "open",
    dueDate: input.dueDate,
    assignedTo,
    assignedToInitials: assignedTo === "Unassigned" ? "—" : initialsOf(assignedTo),
    notes: input.notes?.trim() || undefined,
    customerId: input.customerId,
    customerName: input.customerName,
    leadId: input.leadId,
    jobId: input.jobId,
    projectId: input.projectId,
    linkedLabel: input.linkedLabel,
    linkedHref: input.linkedHref,
    linkedType: input.linkedType,
    createdAt: now.toISOString(),
  };
  _extra = [task, ...extraTasks()];
  persistTasks();
  return task;
}

// Patch a runtime task. Seed tasks (ALL_TASKS) aren't patched — the seed is empty.
export function updateTask(id: string, patch: Partial<Task>): Task | undefined {
  let updated: Task | undefined;
  _extra = extraTasks().map(t => {
    if (t.id !== id) return t;
    updated = { ...t, ...patch };
    return updated;
  });
  if (updated) persistTasks();
  return updated;
}

export function deleteTask(id: string): boolean {
  const before = extraTasks().length;
  _extra = extraTasks().filter(t => t.id !== id);
  const removed = _extra.length < before;
  if (removed) persistTasks();
  return removed;
}

// Flip a task between completed and open. Stamps completedAt on completion.
export function toggleTaskComplete(id: string): Task | undefined {
  const t = getTask(id);
  if (!t) return undefined;
  return t.status === "completed"
    ? updateTask(id, { status: "open", completedAt: undefined })
    : updateTask(id, {
        status: "completed",
        completedAt: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
      });
}
