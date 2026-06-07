// ─── Jobs domain — types + mock data ─────────────────────
// jobs.project_id is nullable: standalone jobs have no project.
// work_orders belong to jobs. checklist_items belong to work_orders.
//
// Maps to future DB tables:
//   projects, jobs, work_orders, checklist_items, job_notes

// ─── Types ────────────────────────────────────────────────
export type JobStatus      = "new" | "scheduled" | "en_route" | "in_progress" | "waiting_on_parts" | "waiting_on_customer" | "completed" | "invoiced" | "closed" | "canceled" | "no_show";
export type JobType        = "maintenance" | "repair" | "installation" | "inspection" | "emergency" | "estimate" | "warranty" | "replacement" | "other";
export type JobPriority    = "low" | "normal" | "high" | "urgent";
export type WorkOrderStatus = "pending" | "in_progress" | "completed";
export type JobNoteType    = "note" | "call" | "email" | "visit";

export interface Job {
  id: string;
  companyId: string;
  locationId: string;
  serviceAreaId?: string;
  projectId?: string;          // undefined = standalone job
  accountId: string;
  propertyAddress?: string;
  agreementId?: string;
  title: string;
  description?: string;
  type: JobType;
  status: JobStatus;
  priority: JobPriority;
  scheduledDate: string;
  scheduledTime: string;
  durationMinutes: number;
  completedDate?: string;
  assignedTo: string;
  assignedToInitials: string;
  estimatedAmount?: string;
  actualAmount?: string;
  // Denormalized for list display
  customerName: string;
  customerInitials: string;
  locationName: string;
  // Dispatch: the Job is the one dispatchable unit. dispatchType is a visual
  // label/layer (a maintenance visit or sales appointment is still a Job, just
  // tagged so the board colors it correctly). source* links back to the record
  // that spawned it (an approved quote, an agreement visit, a follow-up task).
  dispatchType?: "job" | "sales_appointment" | "agreement_visit" | "task";
  sourceModule?: "quotes" | "agreements" | "tasks" | "projects";
  sourceRefId?: string;
}

export interface ChecklistItem {
  id: string;
  label: string;
  isComplete: boolean;
  completedBy?: string;
  sortOrder: number;
}

export interface WorkOrder {
  id: string;
  jobId: string;
  title: string;
  instructions: string;
  status: WorkOrderStatus;
  checklist: ChecklistItem[];
}

export interface JobNote {
  id: string;
  jobId: string;
  date: string;
  user: string;
  userInitials: string;
  text: string;
  type: JobNoteType;
}

// ─── Status display config ────────────────────────────────
export const JOB_STATUS_CONFIG: Record<JobStatus, { label: string; bg: string; color: string }> = {
  new:                  { label: "New",                  bg: "var(--bg-input)", color: "var(--text-secondary)" },
  scheduled:            { label: "Scheduled",            bg: "#e0e7ff",         color: "#3730a3" },
  en_route:             { label: "En Route",             bg: "#fef3c7",         color: "#92400e" },
  in_progress:          { label: "In Progress",          bg: "#dbeafe",         color: "#1e40af" },
  waiting_on_parts:     { label: "Waiting on Parts",     bg: "#fef3c7",         color: "#92400e" },
  waiting_on_customer:  { label: "Waiting on Customer",  bg: "#fef3c7",         color: "#92400e" },
  completed:            { label: "Completed",            bg: "#d1fae5",         color: "#065f46" },
  invoiced:             { label: "Invoiced",             bg: "#ecfdf5",         color: "#059669" },
  closed:               { label: "Closed",               bg: "var(--bg-input)", color: "var(--text-muted)" },
  canceled:             { label: "Canceled",             bg: "var(--bg-input)", color: "var(--text-muted)" },
  no_show:              { label: "No Show",              bg: "#fee2e2",         color: "#991b1b" },
};

// Resolves a job's status to display config from the company's configured
// Job Statuses (Settings → Job Types & Statuses), falling back to the built-in
// JOB_STATUS_CONFIG for any status key not present in settings.
// Call from a client component with the array from getJobStatuses().
export interface StatusDisplay { label: string; bg: string; color: string }

export function resolveJobStatus(
  statusKey: string,
  configured: { key: string; name: string; color: string }[],
): StatusDisplay {
  const match = configured.find(s => s.key === statusKey);
  if (match) return { label: match.name, color: match.color, bg: match.color + "22" };
  const legacy = JOB_STATUS_CONFIG[statusKey as JobStatus];
  if (legacy) return legacy;
  return { label: statusKey, bg: "var(--bg-input)", color: "var(--text-secondary)" };
}

export const JOB_TYPE_CONFIG: Record<JobType, string> = {
  maintenance:  "#6366f1", repair:      "#ef4444",
  installation: "#10b981", inspection:  "#3b82f6",
  emergency:    "#dc2626", estimate:    "#8b5cf6",
  warranty:     "#f59e0b", replacement: "#0891b2",
  other:        "#6b7280",
};

// ─── Mock jobs ────────────────────────────────────────────
export const ALL_JOBS: Job[] = [];

// ─── Work orders ──────────────────────────────────────────
export const WORK_ORDERS: Record<string, WorkOrder> = {};

// ─── Job notes ────────────────────────────────────────────
export const JOB_NOTES: Record<string, JobNote[]> = {};

// ─── Runtime store (seed + jobs created in-session, e.g. from a quote) ────
const JOBS_KEY = "crm-extra-jobs";
let _extraJobs: Job[] | null = null;
function extraJobs(): Job[] {
  if (_extraJobs) return _extraJobs;
  if (typeof window === "undefined") return [];
  try { const r = localStorage.getItem(JOBS_KEY); _extraJobs = r ? JSON.parse(r) : []; }
  catch { _extraJobs = []; }
  return _extraJobs!;
}

// Overrides persist edits (status changes, reschedules) to *seed* jobs without
// mutating the constant array.
const JOBS_OV_KEY = "crm-job-overrides";
let _jobOverrides: Record<string, Partial<Job>> | null = null;
function jobOverrides(): Record<string, Partial<Job>> {
  if (_jobOverrides) return _jobOverrides;
  if (typeof window === "undefined") return {};
  try { const r = localStorage.getItem(JOBS_OV_KEY); _jobOverrides = r ? JSON.parse(r) : {}; }
  catch { _jobOverrides = {}; }
  return _jobOverrides!;
}
function applyJobOverride(j: Job): Job { const o = jobOverrides()[j.id]; return o ? { ...j, ...o } : j; }

// Session-created jobs only (for hydration-safe merging in client lists).
export function getSessionJobs(): Job[] { return extraJobs().map(applyJobOverride); }
// All jobs (seed + session). Server-side returns seed only.
export function getAllJobs(): Job[] { return [...extraJobs(), ...ALL_JOBS].map(applyJobOverride); }

// Update a job (e.g. status progression). Session jobs mutate in place; seed jobs via overrides.
export function updateJob(id: string, patch: Partial<Job>): Job | undefined {
  if (extraJobs().some(j => j.id === id)) {
    _extraJobs = extraJobs().map(j => j.id === id ? { ...j, ...patch } : j);
    try { localStorage.setItem(JOBS_KEY, JSON.stringify(_extraJobs)); } catch { /* ignore */ }
  } else {
    const all = { ...jobOverrides() };
    all[id] = { ...all[id], ...patch };
    _jobOverrides = all;
    try { localStorage.setItem(JOBS_OV_KEY, JSON.stringify(all)); } catch { /* ignore */ }
  }
  return getJob(id);
}

// Permanently remove a job (session record + any override). Used by the
// "Delete" action — distinct from "Cancel" (a reversible status change).
export function deleteJob(id: string): void {
  if (extraJobs().some(j => j.id === id)) {
    _extraJobs = extraJobs().filter(j => j.id !== id);
    try { localStorage.setItem(JOBS_KEY, JSON.stringify(_extraJobs)); } catch { /* ignore */ }
  }
  if (jobOverrides()[id]) {
    const all = { ...jobOverrides() }; delete all[id];
    _jobOverrides = all;
    try { localStorage.setItem(JOBS_OV_KEY, JSON.stringify(all)); } catch { /* ignore */ }
  }
}

// Delete every job under a company (hierarchy cascade).
export function deleteJobsByCompany(companyId: string): void {
  getAllJobs().filter(j => j.companyId === companyId).forEach(j => deleteJob(j.id));
}

export interface NewJobInput {
  companyId: string; locationId: string; serviceAreaId?: string;
  accountId: string; customerName: string; customerInitials: string; locationName: string;
  title: string; description?: string; type?: JobType; priority?: JobPriority;
  propertyAddress?: string; estimatedAmount?: string; projectId?: string;
  scheduledDate?: string; scheduledTime?: string; durationMinutes?: number;
  assignedTo?: string; assignedToInitials?: string;
  dispatchType?: Job["dispatchType"]; sourceModule?: Job["sourceModule"]; sourceRefId?: string;
}

// Create a job (e.g. converted from a quote). Unscheduled by default — status
// "new" with no date until dispatched.
export function createJob(input: NewJobInput): Job {
  const job: Job = {
    id: `job-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
    companyId: input.companyId, locationId: input.locationId, serviceAreaId: input.serviceAreaId,
    projectId: input.projectId, accountId: input.accountId,
    propertyAddress: input.propertyAddress,
    title: input.title, description: input.description, type: input.type ?? "installation",
    status: input.scheduledDate ? "scheduled" : "new",
    priority: input.priority ?? "normal",
    scheduledDate: input.scheduledDate ?? "", scheduledTime: input.scheduledTime ?? "",
    durationMinutes: input.durationMinutes ?? 120,
    assignedTo: input.assignedTo ?? "", assignedToInitials: input.assignedToInitials ?? "",
    estimatedAmount: input.estimatedAmount,
    customerName: input.customerName, customerInitials: input.customerInitials, locationName: input.locationName,
    dispatchType: input.dispatchType, sourceModule: input.sourceModule, sourceRefId: input.sourceRefId,
  };
  _extraJobs = [job, ...extraJobs()];
  try { localStorage.setItem(JOBS_KEY, JSON.stringify(_extraJobs)); } catch { /* ignore */ }
  return job;
}

// ─── Lookup helpers ───────────────────────────────────────
export const JOBS_MAP: Record<string, Job> = Object.fromEntries(ALL_JOBS.map(j => [j.id, j]));

export function getJob(id: string): Job | undefined {
  const base = JOBS_MAP[id] ?? extraJobs().find(j => j.id === id);
  return base ? applyJobOverride(base) : undefined;
}

export function getJobsForProject(projectId: string): Job[] {
  return getAllJobs().filter(j => j.projectId === projectId);
}

// ─── Work order runtime store (created via the Work Order wizard) ─────
// One work order per job, keyed by jobId. Session records persist to
// localStorage and merge over the seed WORK_ORDERS map.
const WO_KEY = "crm-work-orders";
let _woByJob: Record<string, WorkOrder> | null = null;
function woStore(): Record<string, WorkOrder> {
  if (_woByJob) return _woByJob;
  if (typeof window === "undefined") return {};
  try { const r = localStorage.getItem(WO_KEY); _woByJob = r ? JSON.parse(r) : {}; }
  catch { _woByJob = {}; }
  return _woByJob!;
}
function persistWO() { try { localStorage.setItem(WO_KEY, JSON.stringify(_woByJob ?? {})); } catch { /* ignore */ } }

export interface NewWorkOrderInput {
  jobId: string;
  title: string;
  instructions?: string;
  templateId?: string;
  // Checklist labels snapshotted from the chosen template (in order).
  checklist: string[];
}
export function createWorkOrder(input: NewWorkOrderInput): WorkOrder {
  const wo: WorkOrder = {
    id: `wo-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
    jobId: input.jobId,
    title: input.title,
    instructions: input.instructions ?? "",
    status: "pending",
    checklist: input.checklist.map((label, i) => ({
      id: `ci-${Date.now()}-${i}`, label, isComplete: false, sortOrder: i + 1,
    })),
  };
  _woByJob = { ...woStore(), [input.jobId]: wo };
  persistWO();
  return wo;
}
export function updateWorkOrder(jobId: string, patch: Partial<WorkOrder>): WorkOrder | undefined {
  const existing = woStore()[jobId] ?? WORK_ORDERS[jobId];
  if (!existing) return undefined;
  const updated = { ...existing, ...patch };
  _woByJob = { ...woStore(), [jobId]: updated };
  persistWO();
  return updated;
}

// All work orders (seed + session) as [jobId, WorkOrder] entries.
export function getAllWorkOrders(): { jobId: string; wo: WorkOrder }[] {
  const merged = { ...WORK_ORDERS, ...woStore() };
  return Object.entries(merged).map(([jobId, wo]) => ({ jobId, wo }));
}

export function getWorkOrder(jobId: string): WorkOrder | undefined {
  return woStore()[jobId] ?? WORK_ORDERS[jobId];
}

export function getJobNotes(jobId: string): JobNote[] {
  return JOB_NOTES[jobId] ?? [];
}
