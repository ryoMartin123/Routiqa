// ─── Auto-creation orchestrators ──────────────────────────
// The UX rule: users never decide "job vs work order vs appointment." Creating a
// service call (or a return visit) spins up the right records behind the scenes:
//   service call  → Job + Work Order + Appointment
//   return visit  → new Work Order + Appointment under the SAME Job
// These compose the existing stores (createJob already auto-materializes a WO via
// the job type's policy); we just guarantee a WO + an Appointment exist.

import {
  createJob, createWorkOrder, getWorkOrder, getJob, materializeWorkOrderForJob,
  type Job, type JobStatus, type WorkOrder, type NewJobInput,
} from "@/lib/jobs/data";
import { createAppointment, getAppointmentsForJob, type Appointment, type VisitType } from "@/lib/appointments/data";

// ─── Return-visit guard ───────────────────────────────────
// Whether another visit can be booked on a job, and what booking one implies.
// Principle: a follow-up needs an ANCHORED first visit (the job must be
// scheduled — that anchor is either the job's own schedule or an existing
// appointment), and TERMINAL jobs can't take new visits (spin up a new job).
// Completed/invoiced jobs CAN take a visit, but doing so REOPENS them (that's a
// callback/warranty trip). Used by both entry points so the rule lives in one place.
const VISIT_TERMINAL = new Set<JobStatus>(["closed", "canceled", "no_show"]);
const VISIT_DONE     = new Set<JobStatus>(["completed", "invoiced"]);

export type VisitGuard =
  | { allowed: true; reopens: boolean }
  | { allowed: false; reason: string };

export function canAddVisit(job: Job): VisitGuard {
  if (VISIT_TERMINAL.has(job.status)) {
    return { allowed: false, reason: "This job is closed — create a new job for any further work." };
  }
  const anchored = !!job.scheduledDate
    || getAppointmentsForJob(job.id).some(a => a.scheduledDate && a.status !== "canceled");
  if (!anchored) {
    return { allowed: false, reason: "Schedule the first visit on the dispatch board before adding another." };
  }
  return { allowed: true, reopens: VISIT_DONE.has(job.status) };
}

// End time (ms) of the job's latest visit — its own schedule plus any live
// appointments — so a new visit can be required to start strictly after it.
export function latestVisitEndMs(job: Job): number {
  // Space separator (not "T") so it parses BOTH the job's display-format schedule
  // ("Jul 5, 2026" + "9:00 AM") and an appointment's ISO schedule ("2026-07-05" + "14:00").
  const toMs = (d?: string, t?: string) => { const ms = new Date(`${d} ${t || "00:00"}`).getTime(); return isNaN(ms) ? 0 : ms; };
  let end = 0;
  // Only contribute when the start actually parses — a bad date must not fall back
  // to epoch and produce a bogus anchor.
  if (job.scheduledDate) { const st = toMs(job.scheduledDate, job.scheduledTime); if (st) end = Math.max(end, st + (job.durationMinutes || 0) * 60_000); }
  for (const a of getAppointmentsForJob(job.id)) {
    if (a.scheduledDate && a.status !== "canceled") { const st = toMs(a.scheduledDate, a.scheduledTime); if (st) end = Math.max(end, st + a.durationMinutes * 60_000); }
  }
  return end;
}

export interface CreateServiceCallInput extends NewJobInput {
  techIds?: string[];        // crew (primary first); falls back to assignedTo
  workOrderTitle?: string;   // optional WO title override (defaults to job title)
  visitType?: VisitType;     // field-event purpose of the first visit (defaults to "service")
}

export function createServiceCall(input: CreateServiceCallInput): { job: Job; workOrder: WorkOrder; appointment: Appointment } {
  const techIds = input.techIds ?? (input.assignedTo ? [input.assignedTo] : []);
  // 1) Job — the container. createJob auto-materializes a WO per the type policy.
  const job = createJob({ ...input, assignedTo: techIds[0] ?? input.assignedTo });
  // 2) Guarantee a work order (every dispatched visit has one).
  let workOrder = getWorkOrder(job.id);
  if (!workOrder) workOrder = createWorkOrder({ jobId: job.id, title: input.workOrderTitle ?? input.title, checklist: [] });
  // 3) Appointment — the dispatch event (a "Visit").
  const appointment = createAppointment({
    jobId: job.id, workOrderId: workOrder.id, techIds, visitType: input.visitType ?? "service",
    scheduledDate: input.scheduledDate, scheduledTime: input.scheduledTime, durationMinutes: input.durationMinutes,
  });
  return { job, workOrder, appointment };
}

export interface ReturnVisitInput {
  workOrderTitle: string;
  instructions?: string;
  checklist?: { label: string; required?: boolean }[];
  scheduledDate?: string;
  scheduledTime?: string;
  durationMinutes?: number;
  techIds?: string[];
  visitType?: VisitType;     // return | callback | warranty | follow_up | … (defaults to "return")
}
// Convert an EXISTING job into the appointment model when it's scheduled (e.g.
// dragged from the unscheduled queue onto the board): ensure a work order exists
// and create the dispatch appointment. Idempotent-ish — only call for a job that
// has no appointment yet (the queue suppresses jobs that already do).
export function scheduleExistingJob(
  jobId: string,
  sched: { scheduledDate?: string; scheduledTime?: string; durationMinutes?: number; techIds?: string[] },
): { workOrder?: WorkOrder; appointment?: Appointment } {
  const job = getJob(jobId);
  if (!job) return {};
  const workOrder = getWorkOrder(jobId) ?? materializeWorkOrderForJob(job)
    ?? createWorkOrder({ jobId, title: job.title, checklist: [] });
  const appointment = createAppointment({
    jobId, workOrderId: workOrder.id, techIds: sched.techIds,
    scheduledDate: sched.scheduledDate, scheduledTime: sched.scheduledTime, durationMinutes: sched.durationMinutes,
  });
  return { workOrder, appointment };
}

// A second (or third…) visit on the SAME job — new work order + appointment, with
// the first visit's history left intact.
export function addReturnVisit(jobId: string, input: ReturnVisitInput): { workOrder: WorkOrder; appointment: Appointment } {
  const workOrder = createWorkOrder({
    jobId, title: input.workOrderTitle, instructions: input.instructions, checklist: input.checklist ?? [],
  });
  const appointment = createAppointment({
    jobId, workOrderId: workOrder.id, techIds: input.techIds, visitType: input.visitType ?? "return",
    scheduledDate: input.scheduledDate, scheduledTime: input.scheduledTime, durationMinutes: input.durationMinutes,
  });
  return { workOrder, appointment };
}
