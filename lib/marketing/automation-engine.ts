// ─── Automation engine — real execution on real events ────
// CRM stores call emitAutomationEvent() when something actually happens (a lead
// is created, a job completes, a quote is approved…). Active automations with a
// matching trigger fire HERE, synchronously in the browser session:
//   · task actions create real Tasks (due-dated by the chain's waits)
//   · message actions are logged honestly as simulated (no provider yet)
//   · gates evaluate against the event's facts when possible; conditions that
//     can't be known at trigger time are carried into the task notes instead
//     of silently pretending
// Every firing is appended to the runs log in lib/marketing/automations —
// automation stats in the UI are derived from those entries and nothing else.

import {
  getAutomations, getTrigger, getAction, recordRun, getRuns,
  type MarketingAutomation, type ConditionRow, type AutomationRun,
  conditionPhrase,
} from "@/lib/marketing/automations";
import { createTask } from "@/lib/tasks/data";

export interface AutomationEventCtx {
  /** Who/what the event is about — shows in the runs log and task titles. */
  subject: string;
  companyId?: string;
  locationId?: string;
  customerId?: string;
  customerName?: string;
  /** Facts conditions can check, keyed by CONDITION_FIELDS keys (e.g. estimate_amount: 4200). */
  fields?: Record<string, string | number>;
}

// true/false when checkable against the event's facts, undefined when the fact
// isn't available at trigger time.
function evalCondition(c: ConditionRow, fields?: Record<string, string | number>): boolean | undefined {
  const v = fields?.[c.field];
  if (v === undefined) return undefined;
  // Option values are snake_case ("property_manager") while event facts may be
  // display-cased ("Property Manager") — normalize both for equality checks.
  const norm = (x: string | number) => String(x).toLowerCase().replace(/\s+/g, "_");
  switch (c.op) {
    case "is":           return norm(v) === norm(c.value);
    case "is_not":       return norm(v) !== norm(c.value);
    case "gt":           return Number(v) > Number(c.value);
    case "lt":           return Number(v) < Number(c.value);
    case "gte":          return Number(v) >= Number(c.value);
    case "lte":          return Number(v) <= Number(c.value);
    case "contains":     return String(v).toLowerCase().includes(c.value.toLowerCase());
    case "not_contains": return !String(v).toLowerCase().includes(c.value.toLowerCase());
    case "is_true":      return Boolean(v) && v !== "false";
    case "is_false":     return !v || v === "false";
  }
}

const stampInDays = (days: number): string => {
  const d = new Date(); d.setDate(d.getDate() + Math.round(days));
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};

function runOne(a: MarketingAutomation, ctx: AutomationEventCtx): AutomationRun {
  const t = getTrigger(a.triggerKey);
  const run: AutomationRun = {
    id: `run-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
    automationId: a.id,
    at: new Date().toISOString(),
    atLabel: new Date().toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }),
    subject: ctx.subject,
    trigger: t ? t.clause(a.triggerParam ?? t.param?.default) : a.triggerKey,
    notes: [],
    tasksCreated: 0,
    status: "executed",
  };

  // Dedupe safeguard is real: skip if this automation already ran for the same
  // subject within the window.
  if (a.safety.includes("dedupe")) {
    const windowDays = a.dedupeDays ?? 7;
    const cutoff = Date.now() - windowDays * 86400000;
    const recent = getRuns(a.id).find(r => r.subject === ctx.subject && r.status === "executed" && new Date(r.at).getTime() > cutoff);
    if (recent) {
      run.status = "stopped";
      run.notes.push(`Skipped — already ran for ${ctx.subject} within ${windowDays} days (${recent.atLabel}).`);
      return run;
    }
  }

  // Entry conditions — evaluate what the event lets us check.
  for (const c of a.conditions) {
    const ok = evalCondition(c, ctx.fields);
    if (ok === false) {
      run.status = "stopped";
      run.notes.push(`Stopped — condition not met: ${conditionPhrase(c)}.`);
      return run;
    }
    if (ok === undefined) run.notes.push(`Condition "${conditionPhrase(c)}" isn't checkable from this event — continued.`);
  }

  // Walk the chain. Waits accumulate into due dates; gates that can't be
  // checked now are carried onto the next task as a written condition.
  let delayDays = a.timing.kind === "after"
    ? (a.timing.unit === "days" ? a.timing.amount ?? 1 : 0)
    : 0;
  let pendingGate: string | null = null;

  for (const s of a.steps) {
    if (s.kind === "wait") { delayDays += s.unit === "hours" ? 0 : (s.amount ?? 1); continue; }
    if (s.kind === "gate") {
      const conds = s.conditions ?? [];
      const results = conds.map(c => evalCondition(c, ctx.fields));
      if (results.some(r => r === false)) {
        run.notes.push(`Stopped at gate: ${conds.map(conditionPhrase).join(" and ")} — not met.`);
        return run;
      }
      const unknown = conds.filter((_, i) => results[i] === undefined);
      if (unknown.length) pendingGate = unknown.map(conditionPhrase).join(" and ");
      continue;
    }
    // action
    const act = getAction(s.actionKey ?? "");
    if (!act) continue;
    const gateNote = pendingGate ? ` Only if: ${pendingGate}.` : "";

    if (act.key === "create_task" || act.key === "create_call_task") {
      createTask({
        title: `${act.key === "create_call_task" ? "Call" : "Follow up"} ${ctx.customerName ?? ctx.subject} — ${a.name}`,
        type: act.key === "create_call_task" ? "call" : "follow_up",
        dueDate: stampInDays(delayDays),
        notes: `${s.actionValue ? s.actionValue + "\n" : ""}Created by automation "${a.name}" (${run.trigger}).${gateNote}`,
        companyId: ctx.companyId ?? "co_hvac",
        locationId: ctx.locationId ?? "loc_augusta",
        customerId: ctx.customerId,
        customerName: ctx.customerName,
      });
      run.tasksCreated += 1;
      run.notes.push(`Created ${act.key === "create_call_task" ? "call" : "follow-up"} task for ${ctx.subject}, due ${stampInDays(delayDays)}.${gateNote}`);
    } else if (act.group === "message") {
      const when = delayDays > 0 ? ` for ${stampInDays(delayDays)}` : "";
      run.notes.push(`Queued: ${act.clause(s.actionValue)}${when} — simulated until a provider is connected.${gateNote}`);
    } else {
      run.notes.push(`Recorded: would ${act.clause(s.actionValue)} — this action isn't executable in the prototype yet.${gateNote}`);
    }
    pendingGate = null;
  }

  return run;
}

// Fire-and-forget: stores call this after a real mutation. Never throws back
// into the calling store.
export function emitAutomationEvent(triggerKey: string, ctx: AutomationEventCtx): void {
  if (typeof window === "undefined") return;
  try {
    for (const a of getAutomations()) {
      if (a.status !== "active" || a.triggerKey !== triggerKey) continue;
      recordRun(runOne(a, ctx));
    }
  } catch { /* an automation bug must never break the CRM action that triggered it */ }
}
