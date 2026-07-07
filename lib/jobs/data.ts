// ─── Jobs domain — types + mock data ─────────────────────
// jobs.project_id is nullable: standalone jobs have no project.
// work_orders belong to jobs. checklist_items belong to work_orders.
//
// Maps to future DB tables:
//   projects, jobs, work_orders, checklist_items, job_notes

import { getJobTypes, getJobType, workOrderPolicyForType } from "@/lib/job-config/data";
import {
  getTemplates, getChecklist, getInstructions, suggestTemplateForJobType,
  type ChecklistItemType,
} from "@/lib/work-order-templates/data";
export type { ChecklistItemType } from "@/lib/work-order-templates/data";
import { notifyDataChanged, invalidateOnStorage } from "@/lib/sync/liveData";
import { getSupabase } from "@/lib/supabase/client";

// ─── Agreement-visit revert hook ──────────────────────────
// deleteJob must return a materialized agreement visit to the schedule queue,
// but importing lib/agreements/data here would close a jobs⇄agreements import
// cycle (agreements already imports createJob/updateJob/getJob from this file).
// That cycle destabilizes the dev compiler/HMR worker. Instead, agreements/data
// REGISTERS its revert handler at load time and deleteJob calls it if present.
type JobDeletedHandler = (job: { agreementId?: string; sourceRefId?: string; sourceModule?: string }) => void;
let _onAgreementJobDeleted: JobDeletedHandler | null = null;
export function registerAgreementJobDeletedHandler(fn: JobDeletedHandler): void {
  _onAgreementJobDeleted = fn;
}

// ─── Types ────────────────────────────────────────────────
export type JobStatus      = "new" | "scheduled" | "en_route" | "in_progress" | "waiting_on_parts" | "waiting_on_customer" | "waiting_on_approval" | "completed" | "invoiced" | "closed" | "canceled" | "no_show";
export type JobType        = "agreement_visit" | "maintenance" | "repair" | "installation" | "inspection" | "emergency" | "estimate" | "warranty" | "replacement" | "other";
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

  // ─── Lifecycle (see lib/jobs/lifecycle.ts) ───
  // Stamped automatically as the job moves through the status graph; the
  // history is the audit trail of every status change (who, when, override).
  dispatchedAt?: string;
  enRouteAt?:    string;
  startedAt?:    string;
  completedAt?:  string;
  statusHistory?: JobStatusEvent[];
}

// One entry in a job's status audit trail.
export interface JobStatusEvent {
  id:       string;
  from:     string;       // status key before
  to:       string;       // status key after
  at:       string;       // ISO timestamp
  byName:   string;       // who made the change
  byUserId?: string;
  byRole?:  string;       // their role label at the time
  override: boolean;      // true = dispatch override that bypassed the graph
  reason?:  string;       // required-ish on overrides
}

export interface ChecklistItem {
  id: string;
  label: string;
  isComplete: boolean;
  completedBy?: string;
  sortOrder: number;
  required?: boolean;     // blocks job completion until done (unless overridden)
  // Typed steps (snapshotted from the template builder): how the tech answers,
  // and their answer. Absent type = plain checkbox.
  type?: ChecklistItemType;
  options?: string[];        // dropdown / multi_select choices
  unit?: string;             // number unit, e.g. "PSI"
  value?: string | string[]; // the tech's entry (multi_select = array)
}

// A part/labor/fee captured on a work order — the line items the invoice is
// built from (the field→billing bridge).
export interface WorkOrderLineItem {
  id: string;
  kind: "part" | "labor" | "fee";
  description: string;
  qty: number;
  unitPrice: number;        // dollars
  itemId?: string;          // catalog item (lib/items) this line was pulled from — snapshot + back-ref
  taxable?: boolean;        // carried onto the invoice line (defaults by kind if unset)
  unitCost?: number;        // snapshotted internal cost for margin (masked from field techs)
}

export interface WorkOrder {
  id: string;
  jobId: string;
  title: string;
  instructions: string;
  status: WorkOrderStatus;
  checklist: ChecklistItem[];
  // ─── Field-execution record (Phase 0 — all optional, additive) ───
  findings?: string;            // what the tech diagnosed on site
  recommendations?: string;     // upsell / follow-up notes
  equipment?: string[];         // units/assets serviced
  lineItems?: WorkOrderLineItem[]; // parts + labor + fees → invoice source
  photos?: string[];            // storage paths / ids
  signatureName?: string;       // customer sign-off name
  signatureDataUrl?: string;    // sign-on-glass image (PNG data URL)
  signedAt?: string;            // ISO when the customer signed
  completedAt?: string;         // ISO when the WO was completed
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
  scheduled:            { label: "Scheduled",            bg: "#d3ebe6",         color: "#0a5c53" },
  en_route:             { label: "En Route",             bg: "#fef3c7",         color: "#92400e" },
  in_progress:          { label: "In Progress",          bg: "#dbeafe",         color: "#1e40af" },
  waiting_on_parts:     { label: "Waiting on Parts",     bg: "#fef3c7",         color: "#92400e" },
  waiting_on_customer:  { label: "Waiting on Customer",  bg: "#fef3c7",         color: "#92400e" },
  waiting_on_approval:  { label: "Waiting on Approval",  bg: "#fef3c7",         color: "#92400e" },
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

// Built-in fallback colors. The editable source of truth is the configured Job
// Types (Settings → Job Types); these only cover jobs whose type isn't configured.
export const JOB_TYPE_CONFIG: Record<JobType, string> = {
  agreement_visit: "#ec4899",
  maintenance:  "#239c8d", repair:      "#ef4444",
  installation: "#10b981", inspection:  "#3b82f6",
  emergency:    "#dc2626", estimate:    "#c9703a",
  warranty:     "#f59e0b", replacement: "#0891b2",
  other:        "#6b7280",
};

// A job type's color, resolved from the configured (editable) Job Types first,
// then the built-in defaults. Drives the dispatch board card color.
export function resolveJobTypeColor(type: string): string {
  return getJobTypes().find(t => t.key === type)?.color ?? JOB_TYPE_CONFIG[type as JobType] ?? "#6b7280";
}

// ─── Mock jobs ────────────────────────────────────────────
export const ALL_JOBS: Job[] = [];

// ─── Work orders ──────────────────────────────────────────
export const WORK_ORDERS: Record<string, WorkOrder> = {};

// ─── Job notes ────────────────────────────────────────────
export const JOB_NOTES: Record<string, JobNote[]> = {};

// ─── Runtime store (Supabase-backed, synchronous reads) ───────────────────
// Jobs now live in Postgres (table `jobs`), shared across every device. To avoid
// rewriting the ~50 components that read jobs synchronously in render, we keep the
// read API synchronous and back it with an in-memory cache that is HYDRATED from
// Supabase on boot (see hydrateJobs / JobsHydrator) and kept fresh via Realtime.
// Writes are optimistic: mutate the cache + notifyDataChanged() for an instant UI,
// then write through to Supabase in the background.
//   • server / pre-hydration → cache is empty (same as the old behavior)
//   • cross-device / cross-tab → Supabase Realtime updates the cache + notifies
//
// Warm cache: we mirror the last-known jobs into localStorage and read them back
// SYNCHRONOUSLY on first access (exactly the timing the app's localStorage stores
// had). That makes the first paint instant — no empty→filled flicker on refresh
// while Supabase re-hydrates in the background. Supabase stays the source of truth;
// this is just a stale-while-revalidate read cache, refreshed on every change.
const JOBS_CACHE_KEY = "crm-jobs-cache";
let _jobs: Job[] = [];
let _cacheLoaded = false;
let _hydrated = false;
let _realtimeStarted = false;

// Lazily seed the in-memory cache from localStorage on first read (client only).
function ensureCacheLoaded(): void {
  if (_cacheLoaded) return;
  _cacheLoaded = true;
  if (typeof window === "undefined") return;
  try { const r = localStorage.getItem(JOBS_CACHE_KEY); if (r) _jobs = JSON.parse(r); }
  catch { /* ignore corrupt cache */ }
}
// Persist the current cache so the next first paint is instant.
function writeCache(): void {
  if (typeof window === "undefined") return;
  try { localStorage.setItem(JOBS_CACHE_KEY, JSON.stringify(_jobs)); } catch { /* ignore quota */ }
}

// ── Row ⇄ Job mapping (snake_case DB columns ⇄ camelCase Job) ──
// Plain scalar fields share a 1:1 name map; status_history (jsonb) and
// duration_minutes (integer) are handled specially in the mappers below.
const JOB_COLS: [keyof Job, string][] = [
  ["id", "id"], ["companyId", "company_id"], ["locationId", "location_id"],
  ["serviceAreaId", "service_area_id"], ["projectId", "project_id"], ["accountId", "account_id"],
  ["agreementId", "agreement_id"], ["propertyAddress", "property_address"],
  ["title", "title"], ["description", "description"], ["type", "type"], ["status", "status"],
  ["priority", "priority"], ["scheduledDate", "scheduled_date"], ["scheduledTime", "scheduled_time"],
  ["completedDate", "completed_date"], ["assignedTo", "assigned_to"],
  ["assignedToInitials", "assigned_to_initials"], ["estimatedAmount", "estimated_amount"],
  ["actualAmount", "actual_amount"], ["customerName", "customer_name"],
  ["customerInitials", "customer_initials"], ["locationName", "location_name"],
  ["dispatchType", "dispatch_type"], ["sourceModule", "source_module"], ["sourceRefId", "source_ref_id"],
  ["dispatchedAt", "dispatched_at"], ["enRouteAt", "en_route_at"], ["startedAt", "started_at"],
  ["completedAt", "completed_at"],
];

// Build a DB row (snake_case) from a full or partial Job. Only keys present on the
// input are included, so it works for both inserts and patch updates.
function rowFromJob(job: Partial<Job>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  for (const [camel, snake] of JOB_COLS) {
    if (camel in job) row[snake] = job[camel] ?? null;
  }
  if ("durationMinutes" in job) row.duration_minutes = job.durationMinutes;
  if ("statusHistory" in job) row.status_history = job.statusHistory ?? null;
  return row;
}

// Build a Job from a DB row, dropping nulls back to undefined for optional fields.
function jobFromRow(row: Record<string, unknown>): Job {
  const job = {} as Job;
  for (const [camel, snake] of JOB_COLS) {
    const v = row[snake];
    if (v !== null && v !== undefined) (job as unknown as Record<string, unknown>)[camel] = v;
  }
  job.durationMinutes = (row.duration_minutes as number) ?? 120;
  const hist = row.status_history;
  if (hist) job.statusHistory = hist as Job["statusHistory"];
  return job;
}

// Hydrate the cache from Supabase, then start Realtime. Safe to call repeatedly
// (re-reads on focus/visibility); the JobsHydrator wires it into the app lifecycle.
export async function hydrateJobs(): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;
  await maybeBackfillLegacyJobs(supabase);
  const { data, error } = await supabase.from("jobs").select("*");
  if (error) { console.error("[jobs] hydrate failed:", error.message); return; }
  _jobs = (data ?? []).map(jobFromRow);
  _cacheLoaded = true;
  _hydrated = true;
  writeCache();
  notifyDataChanged();
  startJobsRealtime();
}

function startJobsRealtime(): void {
  if (_realtimeStarted) return;
  const supabase = getSupabase();
  if (!supabase) return;
  _realtimeStarted = true;
  supabase
    .channel("jobs-changes")
    .on("postgres_changes", { event: "*", schema: "public", table: "jobs" }, (payload) => {
      if (payload.eventType === "DELETE") {
        const id = (payload.old as { id?: string })?.id;
        if (id) _jobs = _jobs.filter(j => j.id !== id);
      } else {
        const job = jobFromRow(payload.new as Record<string, unknown>);
        _jobs = _jobs.some(j => j.id === job.id)
          ? _jobs.map(j => j.id === job.id ? job : j)
          : [job, ..._jobs];
      }
      writeCache();
      notifyDataChanged();
    })
    .subscribe();
}

// One-time bridge: if the remote table is empty but this browser still has jobs in
// the old localStorage store, push them up so existing demo data isn't lost and
// shows on every device. Guarded by a flag so it only runs once per browser.
const MIGRATED_FLAG = "crm-jobs-migrated-to-supabase";
async function maybeBackfillLegacyJobs(supabase: NonNullable<ReturnType<typeof getSupabase>>): Promise<void> {
  if (typeof window === "undefined") return;
  if (localStorage.getItem(MIGRATED_FLAG)) return;
  let legacy: Job[] = [];
  try { legacy = JSON.parse(localStorage.getItem("crm-extra-jobs") || "[]"); } catch { legacy = []; }
  if (!legacy.length) { localStorage.setItem(MIGRATED_FLAG, "1"); return; }
  const { count } = await supabase.from("jobs").select("id", { count: "exact", head: true });
  if ((count ?? 0) === 0) {
    const { error } = await supabase.from("jobs").insert(legacy.map(rowFromJob));
    if (error) { console.error("[jobs] legacy backfill failed:", error.message); return; } // retry next boot
  }
  localStorage.setItem(MIGRATED_FLAG, "1");
}

// Background write-through helpers. No-op without a client (server / missing env).
function persistJobInsert(job: Job): void {
  const supabase = getSupabase(); if (!supabase) return;
  supabase.from("jobs").insert(rowFromJob(job)).then(({ error }) => {
    if (error) console.error("[jobs] insert failed:", error.message);
  });
}
function persistJobUpdate(id: string, patch: Partial<Job>): void {
  const supabase = getSupabase(); if (!supabase) return;
  supabase.from("jobs").update(rowFromJob(patch)).eq("id", id).then(({ error }) => {
    if (error) console.error("[jobs] update failed:", error.message);
  });
}
function persistJobDelete(id: string): void {
  const supabase = getSupabase(); if (!supabase) return;
  supabase.from("jobs").delete().eq("id", id).then(({ error }) => {
    if (error) console.error("[jobs] delete failed:", error.message);
  });
}

// Whether the cache has been hydrated from Supabase at least once.
export function jobsHydrated(): boolean { return _hydrated; }

// Session/local jobs (kept for API compatibility — every job is now a row).
export function getSessionJobs(): Job[] { ensureCacheLoaded(); return _jobs.slice(); }
// All jobs. Empty on the server; on the client returns the warm cache instantly,
// refreshed from Supabase by hydrateJobs().
export function getAllJobs(): Job[] { ensureCacheLoaded(); return _jobs.slice(); }

// When a customer's primary address changes, jobs that were using THAT address
// (it's denormalized onto each job) should follow. Matches leniently — ignoring
// punctuation/format/spacing — so it only updates jobs on the OLD address; jobs
// with a custom service address are left untouched. Returns the count updated.
export function syncJobsAddressForAccount(accountId: string, oldAddress: string, newAddress: string): number {
  const norm = (s?: string) => (s ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const oldN = norm(oldAddress);
  if (!oldN || norm(newAddress) === oldN) return 0;
  let count = 0;
  for (const j of getAllJobs()) {
    if (j.accountId === accountId && norm(j.propertyAddress) === oldN) {
      updateJob(j.id, { propertyAddress: newAddress });
      count++;
    }
  }
  return count;
}

// Update a job (e.g. status progression). Optimistic: patch the cache + notify
// immediately, then write through to Supabase in the background.
export function updateJob(id: string, patch: Partial<Job>): Job | undefined {
  ensureCacheLoaded();
  const existing = _jobs.find(j => j.id === id);
  if (!existing) return undefined;
  const updated = { ...existing, ...patch };
  _jobs = _jobs.map(j => j.id === id ? updated : j);
  writeCache();
  notifyDataChanged();
  persistJobUpdate(id, patch);
  return updated;
}

// Permanently remove a job (session record + any override). Used by the
// "Delete" action — distinct from "Cancel" (a reversible status change).
export function deleteJob(id: string): void {
  // Capture the job first — if it was a materialized agreement visit we need its
  // agreementId/sourceRefId to return the visit to the schedule queue.
  const job = getJob(id);
  _jobs = _jobs.filter(j => j.id !== id);
  writeCache();
  // Don't leave the job's work order behind.
  deleteWorkOrder(id);
  // Don't orphan the agreement visit when its job is deleted. Routed through the
  // registered handler (see registerAgreementJobDeletedHandler) to avoid a static
  // jobs⇄agreements import cycle.
  if (job?.sourceModule === "agreements") _onAgreementJobDeleted?.(job);
  notifyDataChanged();
  persistJobDelete(id);
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
  ensureCacheLoaded();
  _jobs = [job, ..._jobs];
  writeCache();
  // Auto-create the work order if the job type's policy calls for it.
  materializeWorkOrderForJob(job);
  notifyDataChanged();
  persistJobInsert(job);
  return job;
}

// ─── Lookup helpers ───────────────────────────────────────
export const JOBS_MAP: Record<string, Job> = Object.fromEntries(ALL_JOBS.map(j => [j.id, j]));

export function getJob(id: string): Job | undefined {
  ensureCacheLoaded();
  return _jobs.find(j => j.id === id);
}

export function getJobsForProject(projectId: string): Job[] {
  return getAllJobs().filter(j => j.projectId === projectId);
}

// ─── Work order runtime store ─────────────────────────────────────────
// A job can have MANY work orders (return visits, multi-WO installs), so the
// store is keyed by WORK-ORDER id and each WO carries its jobId. Back-compat:
// getWorkOrder(jobId) returns the PRIMARY (first) WO so all 1:1 callers keep
// working; getWorkOrdersForJob lists them all. Session records persist to
// localStorage; the seed WORK_ORDERS map stays jobId-keyed (legacy).
const WO_KEY = "crm-work-orders";
let _woById: Record<string, WorkOrder> | null = null;
function woStore(): Record<string, WorkOrder> {
  if (_woById) return _woById;
  if (typeof window === "undefined") return {};
  _woById = {};
  try {
    const parsed = JSON.parse(localStorage.getItem(WO_KEY) || "{}");
    // Re-key by WO id — transparently migrates the old jobId-keyed shape.
    for (const wo of Object.values(parsed) as WorkOrder[]) if (wo && wo.id) _woById[wo.id] = wo;
  } catch { _woById = {}; }
  return _woById!;
}
function persistWO() { try { localStorage.setItem(WO_KEY, JSON.stringify(_woById ?? {})); } catch { /* ignore */ } }
invalidateOnStorage([WO_KEY], () => { _woById = null; });

export interface NewWorkOrderInput {
  jobId: string;
  title: string;
  instructions?: string;
  templateId?: string;
  // Checklist items snapshotted from the chosen template (in order). `required`
  // items gate job completion (see lib/jobs/lifecycle).
  checklist: { label: string; required?: boolean; type?: ChecklistItemType; options?: string[]; unit?: string }[];
}
export function createWorkOrder(input: NewWorkOrderInput): WorkOrder {
  const wo: WorkOrder = {
    id: `wo-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
    jobId: input.jobId,
    title: input.title,
    instructions: input.instructions ?? "",
    status: "pending",
    checklist: input.checklist.map((c, i) => ({
      id: `ci-${Date.now()}-${i}`, label: c.label, isComplete: false, sortOrder: i + 1, required: c.required,
      type: c.type, options: c.options, unit: c.unit,
    })),
  };
  _woById = { ...woStore(), [wo.id]: wo };
  persistWO();
  notifyDataChanged();
  return wo;
}

// ─── Auto-materialize a work order from the job type's policy ──────────
// auto/required types get a WO created from their template the moment the job is
// created; optional types (and types with no matching template) get none — the
// office/field adds one later. See lib/job-config workOrderPolicy.
function resolveTemplateForJobType(type: string) {
  const jt = getJobType(type);
  if (jt?.defaultWorkOrderTemplateId) {
    const explicit = getTemplates().find(t => t.id === jt.defaultWorkOrderTemplateId && t.active);
    if (explicit) return explicit;
  }
  return suggestTemplateForJobType(type);
}

export function materializeWorkOrderForJob(job: Job): WorkOrder | undefined {
  const existing = getWorkOrder(job.id);
  if (existing) return existing;
  if (workOrderPolicyForType(job.type) === "optional") return undefined;
  const tmpl = resolveTemplateForJobType(job.type);
  if (!tmpl) return undefined;
  const items = getChecklist(tmpl.id).filter(c => c.active);
  if (items.length === 0) return undefined;
  const instr = getInstructions(tmpl.id);
  return createWorkOrder({
    jobId: job.id,
    title: tmpl.name,
    instructions: instr.customerFacing || instr.internal || tmpl.description,
    templateId: tmpl.id,
    checklist: items.map(c => ({ label: c.label, required: c.required, type: c.type, options: c.options, unit: c.unit })),
  });
}

// Update a specific work order by its id (multi-WO precise).
export function updateWorkOrderById(id: string, patch: Partial<WorkOrder>): WorkOrder | undefined {
  const existing = woStore()[id];
  if (!existing) return undefined;
  const updated = { ...existing, ...patch };
  _woById = { ...woStore(), [id]: updated };
  persistWO();
  notifyDataChanged();
  return updated;
}
// Legacy: update the PRIMARY work order for a job (kept for 1:1 callers).
export function updateWorkOrder(jobId: string, patch: Partial<WorkOrder>): WorkOrder | undefined {
  const primary = getWorkOrder(jobId);
  return primary ? updateWorkOrderById(primary.id, patch) : undefined;
}

// Remove a single work order by id.
export function deleteWorkOrderById(id: string): void {
  if (!woStore()[id]) return;
  const next = { ...woStore() }; delete next[id];
  _woById = next;
  persistWO();
  notifyDataChanged();
}
// Remove ALL work orders for a job (used when deleting a job / unloading samples).
export function deleteWorkOrder(jobId: string): void {
  const ids = Object.values(woStore()).filter(w => w.jobId === jobId).map(w => w.id);
  if (!ids.length) return;
  const next = { ...woStore() }; for (const id of ids) delete next[id];
  _woById = next;
  persistWO();
  notifyDataChanged();
}

// All work orders (seed + session) as [jobId, WorkOrder] entries.
export function getAllWorkOrders(): { jobId: string; wo: WorkOrder }[] {
  const session = Object.values(woStore());
  const out = session.map(wo => ({ jobId: wo.jobId, wo }));
  for (const [jobId, wo] of Object.entries(WORK_ORDERS)) {
    if (!session.some(s => s.jobId === jobId)) out.push({ jobId, wo });
  }
  return out;
}

// All work orders for a job, oldest first (the id embeds a timestamp).
export function getWorkOrdersForJob(jobId: string): WorkOrder[] {
  const session = Object.values(woStore()).filter(w => w.jobId === jobId).sort((a, b) => a.id.localeCompare(b.id));
  if (session.length) return session;
  return WORK_ORDERS[jobId] ? [WORK_ORDERS[jobId]] : [];
}
export function getWorkOrderById(id: string): WorkOrder | undefined { return woStore()[id]; }
// The job's primary (first) work order — back-compat for 1:1 callers.
export function getWorkOrder(jobId: string): WorkOrder | undefined { return getWorkOrdersForJob(jobId)[0]; }

export function getJobNotes(jobId: string): JobNote[] {
  return JOB_NOTES[jobId] ?? [];
}
