// Job Types & Statuses — settings model + localStorage CRUD.
// Future: lives at the Company layer; companies start from industry defaults.
// Will drive the Jobs page, Work Orders, scheduling, reports, and dashboards.

// ─── Job Types ────────────────────────────────────────────
export type JobTypeCategory =
  | "service" | "maintenance" | "install" | "sales" | "warranty" | "emergency" | "project";

// How a job of this type gets its work order (the field checklist/instructions doc).
//   auto     — materialize a WO from the matching template when the job is created
//   optional — no WO by default; office/field can add one (template or blank)
//   required — a completed WO is needed before the job can be marked complete
export type WorkOrderPolicy = "auto" | "optional" | "required";

export const WORK_ORDER_POLICY_LABELS: Record<WorkOrderPolicy, string> = {
  auto: "Auto-create", optional: "Optional", required: "Required",
};

export interface JobTypeDef {
  id:          string;
  name:        string;
  key:         string;
  description: string;
  duration:    number;            // default duration in minutes
  category:    JobTypeCategory;
  color:       string;            // drives the dispatch board card color
  active:      boolean;
  order:       number;
  // Core types are required by other modules (e.g. Agreements always schedule the
  // "agreement_visit" type). They can't be deleted/deactivated and their key — the
  // foreign key everything resolves against — is locked. Name/color/etc. stay editable.
  core?:       boolean;
  // ─── Work order behavior (see WorkOrderPolicy) ───
  // Which WO template auto-materializes for this type. When omitted, the template
  // whose jobTypeKey matches this type's key is used (suggestTemplateForJobType).
  defaultWorkOrderTemplateId?: string;
  // Defaults to "optional" when unset.
  workOrderPolicy?: WorkOrderPolicy;
}

export const JOB_TYPE_CATEGORY_LABELS: Record<JobTypeCategory, string> = {
  service: "Service", maintenance: "Maintenance", install: "Install", sales: "Sales",
  warranty: "Warranty", emergency: "Emergency", project: "Project",
};

// Keys match the JobType values jobs actually carry (lib/jobs/data → JOB_TYPE_CONFIG),
// so a job's type resolves straight to its configured color. Colors mirror the
// JOB_TYPE_CONFIG defaults and are editable in Settings → Job Types.
//
// "Maintenance" is keyed "agreement_visit" — the single canonical key for all
// maintenance work, whether a human books an ad-hoc tune-up or the agreement engine
// auto-generates a recurring visit. It's core because Agreements depend on the key
// always existing. (The legacy "maintenance" key still resolves for old data via
// JOB_TYPE_CONFIG, but it's no longer a configurable type.)
const DEFAULT_JOB_TYPES: JobTypeDef[] = [
  { id: "jt-agr", name: "Maintenance",  key: "agreement_visit", description: "Preventive maintenance — also used for recurring agreement visits", duration: 90,  category: "maintenance", color: "#239c8d", active: true, order: 1, core: true, workOrderPolicy: "auto" },
  { id: "jt-2", name: "Repair",       key: "repair",       description: "Diagnose and fix a problem",       duration: 60,  category: "service",     color: "#ef4444", active: true, order: 2, workOrderPolicy: "auto", core: true },
  { id: "jt-3", name: "Installation", key: "installation", description: "New equipment install",            duration: 240, category: "install",     color: "#10b981", active: true, order: 3, workOrderPolicy: "auto", core: true },
  { id: "jt-4", name: "Inspection",   key: "inspection",   description: "Site or equipment inspection",     duration: 60,  category: "service",     color: "#3b82f6", active: true, order: 4, workOrderPolicy: "auto", core: true },
  { id: "jt-5", name: "Emergency",    key: "emergency",    description: "Urgent / after-hours dispatch",    duration: 120, category: "emergency",   color: "#dc2626", active: true, order: 5, workOrderPolicy: "auto", core: true },
  { id: "jt-6", name: "Estimate",     key: "estimate",     description: "On-site estimate or consult",      duration: 45,  category: "sales",       color: "#c9703a", active: true, order: 6, workOrderPolicy: "optional", core: true },
  { id: "jt-7", name: "Warranty",     key: "warranty",     description: "Warranty-covered work",            duration: 90,  category: "warranty",    color: "#f59e0b", active: true, order: 7, workOrderPolicy: "auto", core: true },
  { id: "jt-8", name: "Replacement",  key: "replacement",  description: "Replace existing equipment",       duration: 240, category: "install",     color: "#0891b2", active: true, order: 8, workOrderPolicy: "auto", core: true },
  { id: "jt-9", name: "Other",        key: "other",        description: "Anything else",                    duration: 60,  category: "service",     color: "#6b7280", active: true, order: 9, workOrderPolicy: "optional", core: true },
];

// ─── Job Statuses ─────────────────────────────────────────
export type JobStatusCategory =
  | "open" | "scheduled" | "active" | "waiting" | "completed" | "canceled";

export interface JobStatusDef {
  id:       string;
  name:     string;
  key:      string;
  order:    number;
  color:    string;
  category: JobStatusCategory;
  active:   boolean;
  // Core statuses are referenced by the job lifecycle engine and dispatch lane
  // mapping (and the agreement visit↔job sync rides "completed"/"canceled"). They
  // can't be deleted/deactivated and their key is locked. See lib/jobs/lifecycle.ts.
  core?:    boolean;
}

export const JOB_STATUS_CATEGORY_LABELS: Record<JobStatusCategory, string> = {
  open: "Open", scheduled: "Scheduled", active: "Active",
  waiting: "Waiting", completed: "Completed", canceled: "Canceled",
};

export const STATUS_COLORS = [
  "#239c8d", "#3b82f6", "#0891b2", "#c9703a",
  "#f59e0b", "#ec4899", "#10b981", "#ef4444", "#6b7280",
];

const DEFAULT_JOB_STATUSES: JobStatusDef[] = [
  { id: "js-1",  name: "New",                 key: "new",                  order: 1,  color: "#6b7280", category: "open",      active: true, core: true },
  { id: "js-2",  name: "Scheduled",           key: "scheduled",            order: 2,  color: "#239c8d", category: "scheduled", active: true, core: true },
  { id: "js-3",  name: "Dispatched",          key: "dispatched",           order: 3,  color: "#3b82f6", category: "scheduled", active: true, core: true },
  { id: "js-4",  name: "En Route",            key: "en_route",             order: 4,  color: "#3b82f6", category: "active",    active: true, core: true },
  { id: "js-5",  name: "In Progress",         key: "in_progress",          order: 5,  color: "#0891b2", category: "active",    active: true, core: true },
  { id: "js-6",  name: "Waiting on Parts",    key: "waiting_on_parts",     order: 6,  color: "#f59e0b", category: "waiting",   active: true, core: true },
  { id: "js-7",  name: "Waiting on Customer", key: "waiting_on_customer",  order: 7,  color: "#f59e0b", category: "waiting",   active: true, core: true },
  { id: "js-8",  name: "Waiting on Approval", key: "waiting_on_approval",  order: 8,  color: "#f59e0b", category: "waiting",   active: true, core: true },
  { id: "js-9",  name: "Completed",           key: "completed",            order: 9,  color: "#10b981", category: "completed", active: true, core: true },
  { id: "js-10", name: "Invoiced",            key: "invoiced",             order: 10, color: "#c9703a", category: "completed", active: true, core: true },
  { id: "js-11", name: "Closed",              key: "closed",               order: 11, color: "#6b7280", category: "completed", active: true, core: true },
  { id: "js-12", name: "Canceled",            key: "canceled",             order: 12, color: "#ef4444", category: "canceled",  active: true, core: true },
  { id: "js-13", name: "No Show",             key: "no_show",              order: 13, color: "#ef4444", category: "canceled",  active: true },
];

// ─── Storage ──────────────────────────────────────────────
const TYPES_KEY    = "crm-job-types";
const STATUSES_KEY = "crm-job-statuses";

let _types: JobTypeDef[] | null = null;
let _statuses: JobStatusDef[] | null = null;

function load<T>(key: string, fallback: T[], cacheSetter: (v: T[]) => void): T[] {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    const v = raw ? (JSON.parse(raw) as T[]) : [...fallback];
    cacheSetter(v);
    return v;
  } catch {
    cacheSetter([...fallback]);
    return [...fallback];
  }
}

// Guarantee every core default exists in a loaded list. Saved data from before a
// core entry was introduced won't contain it, so we merge any missing ones back
// in (other modules depend on them always being present).
function withCore<T extends { key: string; core?: boolean }>(loaded: T[], defaults: T[]): T[] {
  const have = new Set(loaded.map(x => x.key));
  const missing = defaults.filter(d => d.core && !have.has(d.key));
  return missing.length ? [...loaded, ...missing] : loaded;
}

// Rebrand read-migration: configs saved before the teal/copper brand still carry
// indigo/violet hexes — remap them so persisted job types/statuses follow suit.
const LEGACY_COLOR: Record<string, string> = {
  "#8b5cf6": "#c9703a", "#6366f1": "#239c8d", "#4f46e5": "#0f8578", "#a855f7": "#c9703a",
};
const migrateColor = <T extends { color?: string }>(x: T): T =>
  x.color && LEGACY_COLOR[x.color.toLowerCase()] ? { ...x, color: LEGACY_COLOR[x.color.toLowerCase()] } : x;

export function getJobTypes(): JobTypeDef[] {
  if (!_types) _types = withCore(load(TYPES_KEY, DEFAULT_JOB_TYPES, v => { _types = v; }), DEFAULT_JOB_TYPES).map(migrateColor);
  return [..._types].sort((a, b) => a.order - b.order);
}
export function saveJobTypes(list: JobTypeDef[]): void {
  const ordered = [...list].sort((a, b) => a.order - b.order).map((t, i) => ({ ...t, order: i + 1 }));
  _types = ordered;
  try { localStorage.setItem(TYPES_KEY, JSON.stringify(ordered)); } catch { /* ignore */ }
}
export function resetJobTypes(): JobTypeDef[] {
  _types = [...DEFAULT_JOB_TYPES];
  try { localStorage.setItem(TYPES_KEY, JSON.stringify(_types)); } catch { /* ignore */ }
  return [...DEFAULT_JOB_TYPES];
}

export function getJobStatuses(): JobStatusDef[] {
  if (!_statuses) _statuses = withCore(load(STATUSES_KEY, DEFAULT_JOB_STATUSES, v => { _statuses = v; }), DEFAULT_JOB_STATUSES).map(migrateColor);
  return [..._statuses].sort((a, b) => a.order - b.order);
}
export function saveJobStatuses(list: JobStatusDef[]): void {
  const ordered = [...list].sort((a, b) => a.order - b.order).map((s, i) => ({ ...s, order: i + 1 }));
  _statuses = ordered;
  try { localStorage.setItem(STATUSES_KEY, JSON.stringify(ordered)); } catch { /* ignore */ }
}
export function resetJobStatuses(): JobStatusDef[] {
  _statuses = [...DEFAULT_JOB_STATUSES];
  try { localStorage.setItem(STATUSES_KEY, JSON.stringify(_statuses)); } catch { /* ignore */ }
  return [...DEFAULT_JOB_STATUSES];
}

export function jcId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`;
}
export function jcSlug(name: string): string {
  return name.toLowerCase().trim().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "").slice(0, 48);
}

// ─── Job-type key ⇄ label ─────────────────────────────────
// The KEY is the source of truth everywhere outside Settings — jobs carry it
// (job.type), agreements write it, and dispatch boards / queue views match on it.
// The label is for display only. These helpers convert in both directions so the
// UI can show names while everything stored/matched stays keyed.

// Humanize a key as a fallback when no configured type matches (e.g. a stale key
// from saved data): "agreement_visit" → "Agreement Visit".
function humanizeKey(key: string): string {
  return key.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

// Resolve a job-type key to its display label.
export function jobTypeLabel(key: string): string {
  if (!key) return "";
  return getJobTypes().find(t => t.key === key)?.name ?? humanizeKey(key);
}

// Resolve a job-type key to its full definition (undefined for stale keys).
export function getJobType(key: string): JobTypeDef | undefined {
  return getJobTypes().find(t => t.key === key);
}

// The work-order policy for a job type — defaults to "optional" when unset or
// the type is unknown.
export function workOrderPolicyForType(key: string): WorkOrderPolicy {
  return getJobType(key)?.workOrderPolicy ?? "optional";
}

// Normalize a value that may be a key OR a display name into the canonical key.
// Idempotent: a value that's already a key returns unchanged. Used to migrate
// saved boards / queue-view filters that stored names before keys were canonical.
export function toJobTypeKey(nameOrKey: string): string {
  if (!nameOrKey) return nameOrKey;
  const types = getJobTypes();
  if (types.some(t => t.key === nameOrKey)) return nameOrKey;            // already a key
  const byName = types.find(t => t.name.toLowerCase() === nameOrKey.toLowerCase());
  return byName ? byName.key : jcSlug(nameOrKey);                        // name → key, else slugify
}
