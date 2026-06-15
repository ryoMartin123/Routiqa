// ─── Job status lifecycle — the state machine ─────────────
// Single place that decides how a job moves between statuses and WHO may move it.
//
// Two actor tiers drive the graph:
//   • "field"  — the tech / installer / salesperson on their OWN job (jobs.edit own
//                or all). The real-world steps: en route, working, waiting, done.
//   • "office" — dispatch / managers (jobs.edit = all). Scheduling + billing steps.
//
// On top of the graph, anyone holding the `jobs_status_override` flag (dispatcher,
// managers, admins by default) can force ANY status, bypassing the graph and the
// checklist gate — that's the manual dispatch override. Every change is recorded
// in the job's statusHistory.
//
// Status keys are the canonical keys from Settings → Job Statuses
// (lib/job-config). Agreement visits reuse this exact engine once materialized
// into a job (see dispatchType "agreement_visit").

import {
  getJob, updateJob, getWorkOrder,
  type Job, type JobStatus, type JobStatusEvent,
} from "./data";
import { can, accessLevel, hasFlag, principalRoles } from "@/lib/roles/resolver";
import type { Principal, PermissionContext } from "@/lib/roles/types";
import { completeAgreementVisitForJob, revertAgreementVisitForJob, reopenAgreementVisitForJob } from "@/lib/agreements/data";

export type TransitionScope = "field" | "office";

interface Edge {
  to:    string;
  scope: TransitionScope;
  gate?: "checklist";   // blocked until required checklist items are done (override bypasses)
}

// ─── The transition graph ─────────────────────────────────
// from-status → the steps reachable from it. Anything not listed here is only
// reachable via an override.
export const STATUS_GRAPH: Record<string, Edge[]> = {
  new: [
    { to: "scheduled", scope: "office" },
    { to: "canceled",  scope: "office" },
  ],
  scheduled: [
    { to: "dispatched",  scope: "office" },
    { to: "en_route",    scope: "field"  },
    { to: "in_progress", scope: "field"  },
    { to: "no_show",     scope: "field"  },
    { to: "canceled",    scope: "office" },
  ],
  dispatched: [
    { to: "en_route",    scope: "field"  },
    { to: "in_progress", scope: "field"  },
    { to: "no_show",     scope: "field"  },
    { to: "canceled",    scope: "office" },
  ],
  en_route: [
    { to: "in_progress",        scope: "field"  },
    { to: "no_show",            scope: "field"  },
    { to: "waiting_on_parts",   scope: "field"  },
    { to: "waiting_on_customer",scope: "field"  },
    { to: "canceled",           scope: "office" },
  ],
  in_progress: [
    { to: "waiting_on_parts",    scope: "field" },
    { to: "waiting_on_customer", scope: "field" },
    { to: "waiting_on_approval", scope: "field" },
    { to: "completed",           scope: "field", gate: "checklist" },
    { to: "canceled",            scope: "office" },
  ],
  waiting_on_parts:    [ { to: "in_progress", scope: "field" }, { to: "completed", scope: "field", gate: "checklist" }, { to: "canceled", scope: "office" } ],
  waiting_on_customer: [ { to: "in_progress", scope: "field" }, { to: "completed", scope: "field", gate: "checklist" }, { to: "canceled", scope: "office" } ],
  waiting_on_approval: [ { to: "in_progress", scope: "field" }, { to: "completed", scope: "field", gate: "checklist" }, { to: "canceled", scope: "office" } ],
  completed: [
    { to: "invoiced",    scope: "office" },
    { to: "in_progress", scope: "office" },   // reopen
    { to: "closed",      scope: "office" },
  ],
  invoiced: [
    { to: "closed",    scope: "office" },
    { to: "completed", scope: "office" },      // reopen billing
  ],
  closed:   [],                                 // terminal (override to reopen)
  canceled: [ { to: "scheduled", scope: "office" }, { to: "new", scope: "office" } ],
  no_show:  [ { to: "scheduled", scope: "office" }, { to: "canceled", scope: "office" } ],
};

// ─── Actor ────────────────────────────────────────────────
export interface TransitionActor {
  principal: Principal;
  ownedByMe: boolean;   // is the principal the job's assignee? (drives "field" own-scope)
}

export interface TransitionCheck {
  ok:            boolean;   // allowed as a normal step (no override needed)
  needsOverride: boolean;   // would only succeed via the override flag
  reason?:       string;    // why it's blocked / needs override
}

function jobCtx(job: Job, ownedByMe: boolean): PermissionContext {
  return { companyId: job.companyId, locationId: job.locationId, ownedByMe };
}

// Are there required checklist items still open on the job's work order?
function hasOpenRequiredChecklist(jobId: string): boolean {
  const wo = getWorkOrder(jobId);
  if (!wo) return false;
  return wo.checklist.some(c => c.required && !c.isComplete);
}

// Can `actor` move `job` to `to`? Returns whether it's a normal step, an
// override-only step, or disallowed — with a human reason for the UI.
export function checkTransition(job: Job, to: string, actor: TransitionActor): TransitionCheck {
  const ctx = jobCtx(job, actor.ownedByMe);
  const canOverride = hasFlag(actor.principal, "jobs_status_override", ctx);

  if (to === job.status) return { ok: false, needsOverride: false, reason: "Already in this status." };

  const edge = (STATUS_GRAPH[job.status] ?? []).find(e => e.to === to);

  // Not a graphed step → only an override can make the jump.
  if (!edge) {
    return canOverride
      ? { ok: true, needsOverride: true }
      : { ok: false, needsOverride: true, reason: `Not a normal step from "${job.status}".` };
  }

  // Capability for the edge's tier.
  const capable = edge.scope === "office"
    ? accessLevel(actor.principal, "jobs", "edit", ctx) === "all"
    : can(actor.principal, "jobs", "edit", ctx);

  if (!capable) {
    const why = edge.scope === "office" ? "This is a dispatch/office step." : "You can only update jobs assigned to you.";
    return canOverride ? { ok: true, needsOverride: true, reason: why } : { ok: false, needsOverride: true, reason: why };
  }

  // Completion gate — required checklist must be done first (override bypasses).
  if (edge.gate === "checklist" && hasOpenRequiredChecklist(job.id)) {
    return canOverride
      ? { ok: true, needsOverride: true, reason: "Required checklist items aren't finished." }
      : { ok: false, needsOverride: true, reason: "Finish the required checklist items first." };
  }

  return { ok: true, needsOverride: false };
}

export interface NextStep {
  to:            string;
  scope:         TransitionScope;
  allowed:       boolean;   // can do it right now, no override
  needsOverride: boolean;   // only via override
  reason?:       string;
}

// The steps reachable from the job's current status, annotated for this actor —
// drives the "next step" buttons (field/sales) and the office status menu.
export function nextTransitions(job: Job, actor: TransitionActor): NextStep[] {
  return (STATUS_GRAPH[job.status] ?? []).map(e => {
    const c = checkTransition(job, e.to, actor);
    return { to: e.to, scope: e.scope, allowed: c.ok && !c.needsOverride, needsOverride: c.needsOverride, reason: c.reason };
  });
}

export interface TransitionResult { ok: boolean; job?: Job; error?: string }

// Perform a status change with full guarding + audit. Pass `override: true`
// (from a holder of jobs_status_override) to force a non-graph jump or bypass
// the checklist gate; a reason is recorded with it.
export function transitionJobStatus(
  jobId: string,
  to: string,
  opts: { actor: TransitionActor; override?: boolean; reason?: string },
): TransitionResult {
  const job = getJob(jobId);
  if (!job) return { ok: false, error: "Job not found." };

  const ctx = jobCtx(job, opts.actor.ownedByMe);
  const canOverride = !!opts.override && hasFlag(opts.actor.principal, "jobs_status_override", ctx);
  const check = checkTransition(job, to, opts.actor);

  // Allowed only if it's a normal step, OR an override-capable user opted to override.
  if (!check.ok) return { ok: false, error: check.reason ?? "That status change isn't allowed." };
  if (check.needsOverride && !canOverride) {
    return { ok: false, error: (check.reason ? check.reason + " " : "") + "Requires a status override." };
  }

  const usedOverride = check.needsOverride && canOverride;
  const now = new Date().toISOString();
  const event: JobStatusEvent = {
    id: `jse-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
    from: job.status, to, at: now,
    byName: opts.actor.principal.name, byUserId: opts.actor.principal.id,
    byRole: principalRoles(opts.actor.principal)[0]?.label,
    override: usedOverride,
    reason: opts.reason?.trim() || undefined,
  };

  const patch: Partial<Job> = {
    status: to as JobStatus,
    statusHistory: [...(job.statusHistory ?? []), event],
  };
  stampTimestamps(patch, to, now);

  const updated = updateJob(jobId, patch);
  // Agreement visits ride this same engine: mirror the job's lifecycle onto the
  // linked visit so the agreement's plan never drifts from reality.
  if (updated?.sourceModule === "agreements") {
    if (to === "completed") {
      completeAgreementVisitForJob(updated);                 // visit → completed
    } else if (to === "canceled") {
      revertAgreementVisitForJob(updated);                   // visit → planned (back in the queue)
    } else if (job.status === "completed" && to !== "invoiced" && to !== "closed") {
      reopenAgreementVisitForJob(updated);                   // reopened from completed → visit un-completes
    }
  }
  return { ok: true, job: updated };
}

// Stamp lifecycle timestamps as the job passes through key statuses.
function stampTimestamps(patch: Partial<Job>, to: string, nowIso: string): void {
  if (to === "dispatched")  patch.dispatchedAt = nowIso;
  if (to === "en_route")    patch.enRouteAt = nowIso;
  if (to === "in_progress") patch.startedAt = nowIso;
  if (to === "completed")   { patch.completedAt = nowIso; patch.completedDate = nowIso.slice(0, 10); }
}
