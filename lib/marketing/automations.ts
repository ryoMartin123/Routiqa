// ─── Marketing automations — rule engine model ────────────
// A marketing automation reads like a sentence:
//   WHEN <trigger> happens, IF <conditions> are true, THEN <action>,
//   WITH <timing>, AND <stop/safety rules>.
//
// Triggers can come from almost any CRM object/event (leads, customers, jobs,
// estimates, invoices, payments, maintenance plans, equipment, forms, calls,
// messages). Actions stay marketing-focused (messages, campaigns, tasks, tags,
// audiences, reviews, reactivation). This file is the single source of truth for
// the catalogs + a localStorage-backed store (mirrors lib/marketing/data.ts) and
// a plain-English summarizer the builder + list both use. Swap for Supabase
// (marketing_automations) when real execution lands.

import type { LucideIcon } from "lucide-react";
import {
  UserPlus, Users, Wrench, FileText, Receipt, CreditCard, ShieldCheck,
  HardHat, ClipboardList, Phone, MessageSquare,
} from "lucide-react";

// ─── Trigger catalog (grouped by CRM object) ──────────────
export type TriggerObject =
  | "lead" | "customer" | "job" | "estimate" | "invoice" | "payment"
  | "maintenance_plan" | "equipment" | "form" | "call" | "message";

export interface TriggerParam { kind: "days" | "months" | "years"; label: string; default: number }

export interface TriggerDef {
  key: string;
  object: TriggerObject;
  label: string;        // shown in the picker, e.g. "Not approved after X days"
  /** Reads as a clause in the preview sentence, e.g. "an estimate is not approved after {n} days". */
  clause: (n?: number) => string;
  param?: TriggerParam;
}

export const TRIGGER_OBJECTS: Record<TriggerObject, { label: string; icon: LucideIcon; color: string }> = {
  lead:             { label: "Lead",             icon: UserPlus,      color: "#2563eb" },
  customer:         { label: "Customer",         icon: Users,         color: "#0891b2" },
  job:              { label: "Job",              icon: Wrench,        color: "#0f8578" },
  estimate:         { label: "Estimate",         icon: FileText,      color: "#059669" },
  invoice:          { label: "Invoice",          icon: Receipt,       color: "#16a34a" },
  payment:          { label: "Payment",          icon: CreditCard,    color: "#db2777" },
  maintenance_plan: { label: "Maintenance Plan", icon: ShieldCheck,   color: "#7c3aed" },
  equipment:        { label: "Equipment",        icon: HardHat,       color: "#ea580c" },
  form:             { label: "Form",             icon: ClipboardList, color: "#0d9488" },
  call:             { label: "Call",             icon: Phone,         color: "#f59e0b" },
  message:          { label: "Message",          icon: MessageSquare, color: "#e11d48" },
};

export const TRIGGERS: TriggerDef[] = [
  // Lead
  { key: "lead_created",        object: "lead",     label: "Lead created",            clause: () => "a new lead is created" },
  { key: "lead_source_changed", object: "lead",     label: "Lead source changes",     clause: () => "a lead's source changes" },
  // Customer
  { key: "customer_created",    object: "customer", label: "Customer created",        clause: () => "a new customer is created" },
  { key: "customer_tag_added",  object: "customer", label: "Tag added",               clause: () => "a tag is added to a customer" },
  { key: "customer_not_booked", object: "customer", label: "Hasn't booked in X months", clause: n => `a customer hasn't booked in ${n} months`, param: { kind: "months", label: "Months", default: 12 } },
  // Job
  { key: "job_created",         object: "job",      label: "Job created",             clause: () => "a job is created" },
  { key: "job_completed",       object: "job",      label: "Job completed",           clause: () => "a job is completed" },
  { key: "job_canceled",        object: "job",      label: "Job canceled",            clause: () => "a job is canceled" },
  // Estimate
  { key: "estimate_created",    object: "estimate", label: "Estimate created",        clause: () => "an estimate is created" },
  { key: "estimate_sent",       object: "estimate", label: "Estimate sent",           clause: () => "an estimate is sent" },
  { key: "estimate_approved",   object: "estimate", label: "Estimate approved",       clause: () => "an estimate is approved" },
  { key: "estimate_declined",   object: "estimate", label: "Estimate declined",       clause: () => "an estimate is declined" },
  { key: "estimate_not_approved", object: "estimate", label: "Not approved after X days", clause: n => `an estimate is not approved after ${n} days`, param: { kind: "days", label: "Days", default: 3 } },
  // Invoice
  { key: "invoice_created",     object: "invoice",  label: "Invoice created",         clause: () => "an invoice is created" },
  { key: "invoice_paid",        object: "invoice",  label: "Invoice paid",            clause: () => "an invoice is paid" },
  { key: "invoice_overdue",     object: "invoice",  label: "Invoice overdue",         clause: () => "an invoice becomes overdue" },
  // Payment
  { key: "payment_failed",      object: "payment",  label: "Payment failed",          clause: () => "a payment fails" },
  // Maintenance plan
  { key: "plan_created",        object: "maintenance_plan", label: "Plan created",     clause: () => "a maintenance plan is created" },
  { key: "plan_expiring",       object: "maintenance_plan", label: "Plan expiring soon", clause: n => `a maintenance plan expires within ${n} days`, param: { kind: "days", label: "Days", default: 30 } },
  { key: "visit_completed",     object: "maintenance_plan", label: "Maintenance visit completed", clause: () => "a maintenance visit is completed" },
  // Equipment
  { key: "equipment_age",       object: "equipment", label: "Reaches X years old",    clause: n => `a system reaches ${n} years old`, param: { kind: "years", label: "Years", default: 12 } },
  // Form / Call / Message
  { key: "form_submitted",      object: "form",     label: "Form submitted",          clause: () => "a form is submitted" },
  { key: "call_completed",      object: "call",     label: "Call completed",          clause: () => "a call is completed" },
  { key: "message_received",    object: "message",  label: "Message received",        clause: () => "a message is received" },
  { key: "review_needed",       object: "message",  label: "Review request needed",   clause: () => "a customer is due for a review request" },
];

export function getTrigger(key: string): TriggerDef | undefined { return TRIGGERS.find(t => t.key === key); }

// ─── Condition catalog ────────────────────────────────────
export type ConditionOp = "is" | "is_not" | "gt" | "lt" | "gte" | "lte" | "contains" | "not_contains" | "is_true" | "is_false";
export type ConditionType = "select" | "multiselect" | "number" | "boolean";

export const OP_LABEL: Record<ConditionOp, string> = {
  is: "is", is_not: "is not", gt: "is more than", lt: "is less than",
  gte: "is at least", lte: "is at most", contains: "includes", not_contains: "excludes",
  is_true: "is set", is_false: "is not set",
};

const OPS_BY_TYPE: Record<ConditionType, ConditionOp[]> = {
  select: ["is", "is_not"],
  multiselect: ["contains", "not_contains"],
  number: ["gt", "lt", "gte", "lte", "is"],
  boolean: ["is_true", "is_false"],
};

export interface ConditionFieldDef {
  key: string;
  label: string;
  type: ConditionType;
  unit?: string;                          // "$", "years", "days"
  options?: { value: string; label: string }[];
}

const opt = (...labels: string[]) => labels.map(l => ({ value: l.toLowerCase().replace(/\s+/g, "_"), label: l }));

export const CONDITION_FIELDS: ConditionFieldDef[] = [
  { key: "customer_type", label: "Customer type", type: "select", options: opt("Residential", "Commercial", "Property Manager") },
  { key: "tags",          label: "Tags",           type: "multiselect", options: opt("VIP", "Repeat", "Financing", "Cold", "Do Not Contact", "Past Duct Cleaning") },
  { key: "service_area",  label: "Location / service area", type: "select", options: opt("Augusta", "Evans", "Martinez", "Grovetown", "North Augusta", "Aiken") },
  { key: "lead_source",   label: "Lead source",    type: "select", options: opt("Website", "Google Ads", "Facebook", "Referral", "Google Business Profile", "Direct Mail", "Yard Sign", "Existing Customer") },
  { key: "job_type",      label: "Job type",       type: "select", options: opt("Installation", "Repair", "Maintenance", "Estimate", "Inspection") },
  { key: "estimate_amount", label: "Estimate amount", type: "number", unit: "$" },
  { key: "estimate_status", label: "Estimate status", type: "select", options: opt("Draft", "Sent", "Viewed", "Approved", "Declined") },
  { key: "invoice_status",  label: "Invoice status",  type: "select", options: opt("Draft", "Sent", "Paid", "Overdue") },
  { key: "plan_status",     label: "Maintenance plan status", type: "select", options: opt("Active", "Due Soon", "Expired", "None") },
  { key: "last_service",    label: "Last service (days ago)", type: "number", unit: "days" },
  { key: "equipment_age",   label: "Equipment age",  type: "number", unit: "years" },
  { key: "system_type",     label: "System type",    type: "select", options: opt("AC", "Furnace", "Heat Pump", "Water Heater", "Ductwork") },
  { key: "campaign_history", label: "Campaign history", type: "select", options: opt("In a campaign", "Not in a campaign") },
  { key: "recent_message",  label: "Recent message",  type: "boolean" },
  { key: "has_replied",     label: "Has replied",     type: "boolean" },
  { key: "do_not_contact",  label: "Do-not-contact flag", type: "boolean" },
];

export function getConditionField(key: string): ConditionFieldDef | undefined { return CONDITION_FIELDS.find(f => f.key === key); }
export function opsForField(f: ConditionFieldDef): ConditionOp[] { return OPS_BY_TYPE[f.type]; }

export interface ConditionRow { id: string; field: string; op: ConditionOp; value: string }

// ─── Action catalog ───────────────────────────────────────
export type ActionGroup = "message" | "campaign" | "task" | "tag" | "audience" | "notify";
export type ActionValueKind = "template" | "campaign" | "audience" | "tag" | "user" | "text" | "none";

export interface ActionDef {
  key: string;
  label: string;
  group: ActionGroup;
  /** Reads as a clause in the preview, e.g. "send the {value} template". */
  clause: (value?: string) => string;
  value?: { kind: ActionValueKind; label: string };
}

export const ACTION_GROUPS: Record<ActionGroup, { label: string; color: string }> = {
  message:  { label: "Messaging",  color: "#e11d48" },
  campaign: { label: "Campaigns",  color: "#7c3aed" },
  task:     { label: "Tasks",      color: "#f59e0b" },
  tag:      { label: "Tags",       color: "#0891b2" },
  audience: { label: "Audiences",  color: "#059669" },
  notify:   { label: "Team",       color: "#2563eb" },
};

export const ACTIONS: ActionDef[] = [
  { key: "send_sms",         label: "Send SMS",                group: "message",  value: { kind: "template", label: "SMS template" },   clause: v => `send the ${v || "selected"} SMS` },
  { key: "send_email",       label: "Send email",              group: "message",  value: { kind: "template", label: "Email template" }, clause: v => `send the ${v || "selected"} email` },
  { key: "send_review",      label: "Send review request",     group: "message",  value: { kind: "template", label: "Review template" }, clause: v => `send a review request${v ? ` (${v})` : ""}` },
  { key: "send_estimate_fu", label: "Send estimate follow-up", group: "message",  value: { kind: "template", label: "Template" },        clause: v => `send the ${v || "estimate follow-up"}` },
  { key: "send_maint_remind",label: "Send maintenance reminder", group: "message", value: { kind: "template", label: "Template" },       clause: v => `send the ${v || "maintenance reminder"}` },
  { key: "send_financing_fu",label: "Send financing follow-up", group: "message", value: { kind: "template", label: "Template" },        clause: v => `send the ${v || "financing follow-up"}` },
  { key: "send_reactivation",label: "Send reactivation message", group: "message", value: { kind: "template", label: "Template" },       clause: v => `send the ${v || "reactivation message"}` },
  { key: "add_to_campaign",  label: "Add to campaign",         group: "campaign", value: { kind: "campaign", label: "Campaign" },        clause: v => `add them to the ${v || "selected"} campaign` },
  { key: "remove_campaign",  label: "Pause / remove from campaign", group: "campaign", value: { kind: "campaign", label: "Campaign" },   clause: v => `remove them from the ${v || "selected"} campaign` },
  { key: "add_to_audience",  label: "Add to saved audience",   group: "audience", value: { kind: "audience", label: "Audience" },        clause: v => `add them to the ${v || "selected"} audience` },
  { key: "add_tag",          label: "Add tag",                 group: "tag",      value: { kind: "tag", label: "Tag" },                  clause: v => `add the "${v || "tag"}" tag` },
  { key: "remove_tag",       label: "Remove tag",              group: "tag",      value: { kind: "tag", label: "Tag" },                  clause: v => `remove the "${v || "tag"}" tag` },
  { key: "create_task",      label: "Create follow-up task",   group: "task",     value: { kind: "text", label: "Task title" },          clause: v => `create a follow-up task${v ? `: "${v}"` : ""}` },
  { key: "create_call_task", label: "Create call task",        group: "task",     value: { kind: "text", label: "Call note" },           clause: v => `add a call task${v ? `: "${v}"` : ""}` },
  { key: "notify_team",      label: "Notify team member",      group: "notify",   value: { kind: "user", label: "Team member" },         clause: v => `notify ${v || "the team"}` },
];

export function getAction(key: string): ActionDef | undefined { return ACTIONS.find(a => a.key === key); }

// ─── Timing ───────────────────────────────────────────────
export type TimingKind = "immediately" | "after" | "on_date" | "before_due" | "after_due" | "wait_no_reply";
export interface Timing {
  kind: TimingKind;
  amount?: number;
  unit?: "minutes" | "hours" | "days";
  date?: string;
  businessHoursOnly?: boolean;
}
export const TIMING_KINDS: { value: TimingKind; label: string }[] = [
  { value: "immediately",  label: "Immediately" },
  { value: "after",        label: "After a delay" },
  { value: "on_date",      label: "On a specific date" },
  { value: "before_due",   label: "Before a due date" },
  { value: "after_due",    label: "After a due date" },
  { value: "wait_no_reply",label: "Wait until no reply for…" },
];

export function timingClause(t: Timing): string {
  switch (t.kind) {
    case "immediately":  return "immediately";
    case "after":        return `after ${t.amount ?? 1} ${t.unit ?? "days"}`;
    case "on_date":      return t.date ? `on ${t.date}` : "on a set date";
    case "before_due":   return `${t.amount ?? 1} ${t.unit ?? "days"} before the due date`;
    case "after_due":    return `${t.amount ?? 1} ${t.unit ?? "days"} after the due date`;
    case "wait_no_reply":return `once there's been no reply for ${t.amount ?? 2} ${t.unit ?? "days"}`;
  }
}

// ─── Safety / stop rules ──────────────────────────────────
export interface SafetyRuleDef { key: string; label: string; clause: string; param?: { label: string; default: number } }
export const SAFETY_RULES: SafetyRuleDef[] = [
  { key: "opted_out",          label: "Don't send if opted out",            clause: "they've opted out" },
  { key: "invoice_paid",       label: "Don't send if invoice is paid",      clause: "the invoice is paid" },
  { key: "estimate_approved",  label: "Don't send if estimate is approved", clause: "the estimate is approved" },
  { key: "already_replied",    label: "Don't send if they already replied", clause: "the customer replies" },
  { key: "stop_after_booking", label: "Stop after they book",               clause: "they book" },
  { key: "stop_after_payment", label: "Stop after payment",                 clause: "they pay" },
  { key: "dedupe",             label: "No duplicate messages within X days", clause: "a message was already sent recently", param: { label: "Days", default: 7 } },
  { key: "require_approval",   label: "Require manual approval before sending", clause: "" },
];
export function getSafetyRule(key: string): SafetyRuleDef | undefined { return SAFETY_RULES.find(r => r.key === key); }

// ─── Automation record ────────────────────────────────────
export type AutomationStatus = "active" | "draft" | "paused";

export interface AutomationStats { contacts: number; sent: number; replies: number; booked: number; revenue?: number }

export interface MarketingAutomation {
  id: string;
  name: string;
  status: AutomationStatus;
  triggerKey: string;
  triggerParam?: number;
  conditions: ConditionRow[];
  timing: Timing;
  actionKey: string;
  actionValue?: string;
  safety: string[];        // enabled safety-rule keys
  dedupeDays?: number;
  createdAt: string;
  lastRun?: string;
  stats?: AutomationStats;
  /** Explicit health issue for the needs-attention surface (e.g. "Last run failed"). */
  issue?: string;
}

export const STATUS_CONFIG: Record<AutomationStatus, { label: string; bg: string; color: string }> = {
  active: { label: "Active", bg: "#d1fae5", color: "#065f46" },
  draft:  { label: "Draft",  bg: "var(--bg-input)", color: "var(--text-muted)" },
  paused: { label: "Paused", bg: "#fef3c7", color: "#92400e" },
};

// ─── Category + channel (derived for badges & filtering) ──
export type AutomationCategoryKey =
  | "review_request" | "estimate_followup" | "maintenance" | "reactivation" | "campaign" | "other";

export const CATEGORY_CONFIG: Record<AutomationCategoryKey, { label: string; color: string }> = {
  review_request:    { label: "Review Request",     color: "#f59e0b" },
  estimate_followup: { label: "Estimate Follow-Up", color: "#7c3aed" },
  maintenance:       { label: "Maintenance",        color: "#059669" },
  reactivation:      { label: "Reactivation",       color: "#0891b2" },
  campaign:          { label: "Campaign",           color: "#e11d48" },
  other:             { label: "Automation",         color: "#6b7280" },
};

export function automationCategory(a: MarketingAutomation): AutomationCategoryKey {
  switch (a.actionKey) {
    case "send_review":                          return "review_request";
    case "send_estimate_fu": case "send_financing_fu": return "estimate_followup";
    case "send_maint_remind":                    return "maintenance";
    case "send_reactivation":                    return "reactivation";
    case "add_to_campaign": case "remove_campaign": return "campaign";
  }
  const t = getTrigger(a.triggerKey);
  if (t?.object === "estimate") return "estimate_followup";
  if (t?.object === "maintenance_plan") return "maintenance";
  if (a.triggerKey === "customer_not_booked") return "reactivation";
  return "other";
}

// SMS / Email / Campaign / Task / Team / Tag / Audience — the action's channel.
export function automationChannel(a: MarketingAutomation): string {
  switch (a.actionKey) {
    case "send_sms": return "SMS";
    case "send_email": case "send_review": case "send_estimate_fu":
    case "send_maint_remind": case "send_financing_fu": case "send_reactivation": return "Email";
    case "add_to_campaign": case "remove_campaign": return "Campaign";
    case "create_task": case "create_call_task": return "Task";
    case "notify_team": return "Team";
    case "add_tag": case "remove_tag": return "Tag";
    case "add_to_audience": return "Audience";
    default: return "—";
  }
}

// ─── Needs-attention heuristics ───────────────────────────
// Lightweight checks now; richer signals (failed sends, unsubscribe rate, missing
// audience) connect when real execution lands.
export function automationWarnings(a: MarketingAutomation): string[] {
  const w: string[] = [];
  if (a.issue) w.push(a.issue);
  const act = getAction(a.actionKey);
  if (act?.value && act.value.kind !== "none" && !a.actionValue) w.push(`${act.value.label} missing`);
  if (a.status === "active" && a.stats && a.stats.sent > 20 && a.stats.replies / a.stats.sent < 0.03) w.push("Low reply rate");
  return Array.from(new Set(w));
}
export function needsAttention(a: MarketingAutomation): boolean { return automationWarnings(a).length > 0; }

// ─── Summaries (plain English) ────────────────────────────
function valueLabel(field: ConditionFieldDef | undefined, v: string): string {
  if (!field) return v;
  if (field.options) return field.options.find(o => o.value === v)?.label ?? v;
  if (field.unit === "$") return `$${Number(v || 0).toLocaleString()}`;
  if (field.unit) return `${v} ${field.unit}`;
  return v;
}

export function conditionPhrase(c: ConditionRow): string {
  const f = getConditionField(c.field);
  if (!f) return "";
  if (f.type === "boolean") return `${f.label.toLowerCase()} ${OP_LABEL[c.op]}`;
  return `${f.label.toLowerCase()} ${OP_LABEL[c.op]} ${valueLabel(f, c.value)}`;
}

export function triggerSummary(a: MarketingAutomation): string {
  const t = getTrigger(a.triggerKey);
  if (!t) return "—";
  const s = t.clause(a.triggerParam ?? t.param?.default);
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function actionSummary(a: MarketingAutomation): string {
  const act = getAction(a.actionKey);
  if (!act) return "—";
  const s = act.clause(a.actionValue);
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// The full sentence shown in the builder's Preview card and on hover in the list.
export function summarize(a: MarketingAutomation): string {
  const t = getTrigger(a.triggerKey);
  const act = getAction(a.actionKey);
  if (!t || !act) return "Finish the trigger and action to see the summary.";

  const parts: string[] = [`When ${t.clause(a.triggerParam ?? t.param?.default)}`];
  if (a.conditions.length) {
    parts.push(`if ${a.conditions.map(conditionPhrase).filter(Boolean).join(" and ")}`);
  }
  let then = `then ${act.clause(a.actionValue)}`;
  if (a.timing.kind !== "immediately") then += ` ${timingClause(a.timing)}`;
  if (a.timing.businessHoursOnly) then += " (business hours only)";
  parts.push(then);

  let sentence = parts.join(", ") + ".";

  const stops = a.safety
    .map(k => getSafetyRule(k))
    .filter((r): r is SafetyRuleDef => Boolean(r && r.clause))
    .map(r => r.key === "dedupe" ? `a message was sent in the last ${a.dedupeDays ?? r.param?.default} days` : r.clause);
  if (stops.length) sentence += ` Stop if ${stops.join(" or ")}.`;
  if (a.safety.includes("require_approval")) sentence += " Requires manual approval before sending.";
  return sentence;
}

// ─── Store (localStorage, seeded with examples) ───────────
const A_KEY = "crm-marketing-automations";
let _autos: MarketingAutomation[] | null = null;

function readStore<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try { const r = localStorage.getItem(key); return r ? (JSON.parse(r) as T) : fallback; } catch { return fallback; }
}
function persist() { try { localStorage.setItem(A_KEY, JSON.stringify(_autos)); } catch { /* ignore */ } }

const SEED_AUTOMATIONS: MarketingAutomation[] = [
  {
    id: "auto-financing", name: "Financing follow-up on stalled estimates",
    status: "active", triggerKey: "estimate_not_approved", triggerParam: 3,
    conditions: [{ id: "c1", field: "estimate_amount", op: "gt", value: "3000" }],
    timing: { kind: "immediately", businessHoursOnly: true },
    actionKey: "send_financing_fu", actionValue: "Financing Follow-Up",
    safety: ["estimate_approved", "already_replied", "opted_out"],
    createdAt: "Apr 2026", lastRun: "2 days ago",
    stats: { contacts: 42, sent: 38, replies: 9, booked: 4, revenue: 18400 },
  },
  {
    id: "auto-review", name: "Review request after completed jobs",
    status: "active", triggerKey: "job_completed", triggerParam: undefined,
    conditions: [], timing: { kind: "after", amount: 1, unit: "days", businessHoursOnly: true },
    actionKey: "send_review", actionValue: "Review Request",
    safety: ["opted_out", "dedupe"], dedupeDays: 30,
    createdAt: "Apr 2026", lastRun: "Today",
    stats: { contacts: 120, sent: 118, replies: 31, booked: 0, revenue: 0 },
  },
  {
    id: "auto-reactivation", name: "Win back customers with no recent service",
    status: "active", triggerKey: "customer_not_booked", triggerParam: 12,
    conditions: [{ id: "c1", field: "do_not_contact", op: "is_false", value: "" }],
    timing: { kind: "immediately", businessHoursOnly: true },
    actionKey: "send_reactivation", actionValue: "",   // ← no template selected → needs attention
    safety: ["opted_out", "dedupe"], dedupeDays: 45,
    createdAt: "Apr 2026", issue: "Last run failed",
    stats: { contacts: 64, sent: 0, replies: 0, booked: 0, revenue: 0 },
  },
  {
    id: "auto-renewal", name: "Maintenance plan renewal reminder",
    status: "draft", triggerKey: "plan_expiring", triggerParam: 30,
    conditions: [{ id: "c1", field: "plan_status", op: "is", value: "due_soon" }],
    timing: { kind: "immediately" },
    actionKey: "add_to_campaign", actionValue: "Maintenance Renewal",
    safety: ["opted_out", "stop_after_payment"],
    createdAt: "Apr 2026",
    stats: { contacts: 0, sent: 0, replies: 0, booked: 0, revenue: 0 },
  },
];

function load(): MarketingAutomation[] {
  if (_autos) return _autos;
  const stored = readStore<MarketingAutomation[] | null>(A_KEY, null);
  _autos = stored ?? SEED_AUTOMATIONS.map(a => ({ ...a }));
  return _autos;
}

export function getAutomations(): MarketingAutomation[] { return [...load()]; }
export function getAutomationById(id: string): MarketingAutomation | undefined { return load().find(a => a.id === id); }

export function blankAutomation(): MarketingAutomation {
  return {
    id: `auto-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
    name: "", status: "draft", triggerKey: "", conditions: [],
    timing: { kind: "immediately" }, actionKey: "", safety: ["opted_out"],
    createdAt: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
  };
}

export function saveAutomation(a: MarketingAutomation): MarketingAutomation {
  const list = load();
  const i = list.findIndex(x => x.id === a.id);
  if (i >= 0) list[i] = a; else list.unshift(a);
  _autos = list;
  persist();
  return a;
}
export function deleteAutomation(id: string): void {
  _autos = load().filter(a => a.id !== id);
  persist();
}
export function setAutomationStatus(id: string, status: AutomationStatus): void {
  const a = load().find(x => x.id === id);
  if (a) { a.status = status; persist(); }
}
export function duplicateAutomation(id: string): MarketingAutomation | undefined {
  const a = getAutomationById(id);
  if (!a) return;
  const copy: MarketingAutomation = {
    ...a,
    id: `auto-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
    name: `${a.name} (copy)`,
    status: "draft",
    lastRun: undefined,
    stats: undefined,
    issue: undefined,
  };
  return saveAutomation(copy);
}
