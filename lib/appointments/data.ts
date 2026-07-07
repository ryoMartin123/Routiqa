// ─── Appointments (dispatch events) ───────────────────────
// An Appointment is the scheduled VISIT on the dispatch board: tech(s) + a time
// window, pointing at a Work Order (the field work) and its Job (the customer
// container). Separating it from the Work Order is what lets a visit be
// rescheduled or reassigned, span multiple days, or carry a crew — without
// disturbing the work record. See the Jobs → Work Orders → Appointments model.
//
// localStorage-backed for now (jobs are the only Supabase entity); swap to the
// backend later alongside work orders.

import { notifyDataChanged, invalidateOnStorage } from "@/lib/sync/liveData";

export type AppointmentStatus =
  | "scheduled" | "en_route" | "in_progress" | "completed" | "canceled" | "no_show";

// ─── Visit type ───────────────────────────────────────────
// The Appointment IS the Visit: it answers "what kind of field event is this?"
// (visitType) as well as "when / who" (schedule). We deliberately did NOT add a
// separate Visit entity — a reschedule edits this appointment's time; a return /
// callback / follow-up creates a NEW appointment (a new visit) on the same job.
export type VisitType =
  | "service" | "maintenance" | "diagnostic" | "estimate" | "install"
  | "return" | "callback" | "warranty" | "inspection" | "punch_list"
  | "startup" | "delivery" | "follow_up";

export const VISIT_TYPE_CONFIG: Record<VisitType, { label: string; short: string; color: string }> = {
  service:     { label: "Service Visit",     short: "Service",     color: "#0f8578" },
  maintenance: { label: "Maintenance Visit", short: "Maintenance", color: "#059669" },
  diagnostic:  { label: "Diagnostic Visit",  short: "Diagnostic",  color: "#0891b2" },
  estimate:    { label: "Estimate Visit",    short: "Estimate",    color: "#7c3aed" },
  install:     { label: "Install Visit",     short: "Install",     color: "#2563eb" },
  return:      { label: "Return Visit",      short: "Return",      color: "#f59e0b" },
  callback:    { label: "Callback Visit",    short: "Callback",    color: "#dc2626" },
  warranty:    { label: "Warranty Visit",    short: "Warranty",    color: "#db2777" },
  inspection:  { label: "Inspection Visit",  short: "Inspection",  color: "#0d9488" },
  punch_list:  { label: "Punch List Visit",  short: "Punch List",  color: "#9333ea" },
  startup:     { label: "Startup Visit",     short: "Startup",     color: "#0ea5e9" },
  delivery:    { label: "Delivery Visit",    short: "Delivery",    color: "#65a30d" },
  follow_up:   { label: "Follow-Up Visit",   short: "Follow-Up",   color: "#f97316" },
};

// The visit types a user can pick when scheduling a return/second trip. (A first
// visit's type usually comes from the job type; returns are these.)
export const RETURN_VISIT_TYPES: VisitType[] = ["return", "callback", "warranty", "follow_up", "punch_list", "startup"];

export interface Appointment {
  id: string;
  jobId: string;
  workOrderId: string;
  visitType?: VisitType;      // the field-event purpose (Appointment = Visit)
  techIds: string[];          // crew — primary first; [] = unassigned
  scheduledDate: string;      // YYYY-MM-DD ("" = unscheduled)
  scheduledTime: string;      // HH:MM
  durationMinutes: number;
  status: AppointmentStatus;
  handoffNote?: string;       // end-of-day crew note — shown on the NEXT day's visit
  createdAt: string;
}

const KEY = "crm-appointments";
let _appts: Appointment[] | null = null;

function store(): Appointment[] {
  if (_appts) return _appts;
  if (typeof window === "undefined") return [];
  try { _appts = JSON.parse(localStorage.getItem(KEY) || "[]"); }
  catch { _appts = []; }
  return _appts!;
}
function persist() { try { localStorage.setItem(KEY, JSON.stringify(_appts ?? [])); } catch { /* ignore */ } }
invalidateOnStorage([KEY], () => { _appts = null; });

export function getAllAppointments(): Appointment[] { return store().slice(); }
export function getAppointment(id: string): Appointment | undefined { return store().find(a => a.id === id); }
export function getAppointmentsForJob(jobId: string): Appointment[] { return store().filter(a => a.jobId === jobId); }
export function getAppointmentsForWorkOrder(workOrderId: string): Appointment[] { return store().filter(a => a.workOrderId === workOrderId); }

// The set of job ids that have at least one appointment — used by the calendar
// adapter to suppress the legacy job-derived item (so a job renders via its
// appointments, never both).
export function jobIdsWithAppointments(): Set<string> { return new Set(store().map(a => a.jobId)); }

export interface NewAppointmentInput {
  jobId: string;
  workOrderId: string;
  visitType?: VisitType;
  techIds?: string[];
  scheduledDate?: string;
  scheduledTime?: string;
  durationMinutes?: number;
  status?: AppointmentStatus;
}
export function createAppointment(input: NewAppointmentInput): Appointment {
  const appt: Appointment = {
    id: `appt-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
    jobId: input.jobId,
    workOrderId: input.workOrderId,
    visitType: input.visitType,
    techIds: input.techIds ?? [],
    scheduledDate: input.scheduledDate ?? "",
    scheduledTime: input.scheduledTime ?? "",
    durationMinutes: input.durationMinutes ?? 120,
    status: input.status ?? "scheduled",
    createdAt: new Date().toISOString(),
  };
  _appts = [appt, ...store()];
  persist();
  notifyDataChanged();
  return appt;
}

export function updateAppointment(id: string, patch: Partial<Appointment>): Appointment | undefined {
  let updated: Appointment | undefined;
  _appts = store().map(a => (a.id === id ? (updated = { ...a, ...patch }) : a));
  if (updated) { persist(); notifyDataChanged(); }
  return updated;
}

export function deleteAppointment(id: string): void {
  const before = store().length;
  _appts = store().filter(a => a.id !== id);
  if (_appts.length !== before) { persist(); notifyDataChanged(); }
}

// Remove every appointment under a job (job deletion cascade).
export function deleteAppointmentsForJob(jobId: string): void {
  const before = store().length;
  _appts = store().filter(a => a.jobId !== jobId);
  if (_appts.length !== before) { persist(); notifyDataChanged(); }
}
