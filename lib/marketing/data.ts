// Marketing — campaigns, templates, and audience segments computed from live
// CRM data. Mock + localStorage store, mirroring the Quotes pattern. Replace
// with Supabase (campaigns, campaign_templates, campaign_sends) when ready.

import { getAllQuotes, getAllInvoices, fmt } from "@/lib/quotes/data";
import { getAllLeads } from "@/lib/leads/data";
import { getAllCustomers } from "@/lib/customers/data";
import { getAllJobs } from "@/lib/jobs/data";
import { AGREEMENTS } from "@/lib/agreements/data";
import { createTask } from "@/lib/tasks/data";
import type { DesignDoc } from "@/lib/design-studio/model";

// ─── Types ────────────────────────────────────────────────
export type CampaignChannel = "email" | "sms" | "task";
export type CampaignType =
  | "email" | "sms" | "review_request" | "estimate_followup"
  | "maintenance_renewal" | "seasonal" | "call_reminder" | "sequence";
export type CampaignStatus = "draft" | "scheduled" | "active" | "sent" | "paused";

export interface MarketingTemplate {
  id: string;
  name: string;
  type: CampaignType;
  channel: CampaignChannel;
  subject?: string;        // email only
  body: string;            // plain text — derived from `design` when one exists
  design?: DesignDoc;      // block design (Design Studio); emails only
  createdAt: string;
  deleted?: boolean;
}

export interface CampaignStats { delivered: number; opened: number; clicked: number; responded: number }

// A recipient captured at send time — a real CRM record (customer / lead /
// agreement holder), so "12 recipients" is 12 actual names.
export interface CampaignRecipient {
  id: string; name: string; detail?: string;
  // Sequence exit tracking — set when the audience re-check drops someone.
  exitedAtStep?: number;
  exitReason?: string;
}
export interface CampaignEvent { id: string; text: string; when: string }

// One step of a SEQUENCE campaign: a channel-specific touch that fires
// `waitDays` after the previous step. There's no background scheduler in this
// workspace, so at launch step 1 runs immediately and later steps get DUE
// DATES — you fire them from the campaign when they come due.
export type SequenceStepKind = "email" | "sms" | "task";
export interface SequenceStep {
  id: string;
  kind: SequenceStepKind;
  templateId?: string;
  // ── When this step fires ──
  scheduleMode?: "after" | "on"; // default "after" (relative to the previous step)
  waitDays: number;              // "after": days after the previous step (step 1: 0 = at launch)
  onDate?: string;               // "on": YYYY-MM-DD calendar date
  timeOfDay?: string;            // optional HH:MM send time (both modes)
  /** Optional narrowing — this step only goes to recipients ALSO in this set. */
  onlyIf?: CustomAudience;
  // Runtime (set at launch / when run):
  status?: "pending" | "sent";
  dueDate?: string;              // display date the step comes due
  sentAt?: string;
  sentTo?: number;               // how many actually received this step
  exited?: number;               // dropped by the audience re-check at this step
  skipped?: number;              // still in the sequence, but outside this step's onlyIf
}

// How a sequence treats its audience over time. "recheck" (default) re-resolves
// the audience rules before every step, so someone whose record changed (e.g.
// their estimate got approved) exits instead of getting a stale nudge.
// "frozen" sends every step to the launch snapshot regardless.
export type SequenceMembership = "recheck" | "frozen";

export interface Campaign {
  id: string;
  name: string;
  type: CampaignType;
  channel: CampaignChannel;
  audienceKey: string;
  templateId?: string;
  status: CampaignStatus;
  customAudience?: CustomAudience;       // set when audienceKey === "custom"
  sequence?: SequenceStep[];             // present ⇒ a multi-step sequence campaign
  sequenceMembership?: SequenceMembership; // default "recheck"
  recipients: number;       // live audience size until sent; snapshot after
  recipientList?: CampaignRecipient[];   // frozen at send time
  scheduledFor?: string;
  createdAt: string;
  sentAt?: string;
  stats?: CampaignStats;
  activity?: CampaignEvent[];
}

// ─── Type display config ──────────────────────────────────
export const CAMPAIGN_TYPE_CONFIG: Record<CampaignType, { label: string; channel: CampaignChannel; color: string }> = {
  email:               { label: "Email Blast",         channel: "email", color: "#0f8578" },
  sms:                 { label: "SMS Blast",           channel: "sms",   color: "#0891b2" },
  review_request:      { label: "Review Request",      channel: "email", color: "#f59e0b" },
  estimate_followup:   { label: "Estimate Follow-Up",  channel: "email", color: "#7c3aed" },
  maintenance_renewal: { label: "Maintenance Renewal", channel: "email", color: "#059669" },
  seasonal:            { label: "Seasonal Campaign",   channel: "email", color: "#db2777" },
  call_reminder:       { label: "Call / Task Reminder",channel: "task",  color: "#6b7280" },
  sequence:            { label: "Sequence",            channel: "email", color: "#7c3aed" },   // channel is nominal — steps carry their own
};

export const CAMPAIGN_STATUS_CONFIG: Record<CampaignStatus, { label: string; bg: string; color: string }> = {
  draft:     { label: "Draft",     bg: "var(--bg-input)", color: "var(--text-muted)" },
  scheduled: { label: "Scheduled", bg: "#d3ebe6",         color: "#0a5c53" },
  active:    { label: "Active",    bg: "#d1fae5",         color: "#065f46" },
  sent:      { label: "Sent",      bg: "#ecfdf5",         color: "#059669" },
  paused:    { label: "Paused",    bg: "#fef3c7",         color: "#92400e" },
};

// ─── Audience segments (live members from CRM data) ───────
// Every audience resolves to actual named records — the count is just
// members().length, so the number on the card and the people in the send can
// never disagree.
export interface AudienceMember { id: string; name: string; detail?: string }
export interface AudienceDef {
  key: string;
  name: string;
  description: string;
  defaultType: CampaignType;
  members: () => AudienceMember[];
  count: () => number;
}

function activeAgreementCustomers(): Set<string> {
  return new Set(AGREEMENTS.filter(a => a.status !== "canceled").map(a => a.customer.toLowerCase()));
}

const aud = (key: string, name: string, description: string, defaultType: CampaignType, members: () => AudienceMember[]): AudienceDef =>
  ({ key, name, description, defaultType, members, count: () => members().length });

const LEAD_STAGE_LABEL: Record<string, string> = { lost: "Lost lead", estimate_sent: "Estimate sent", follow_up: "Needs follow-up" };

export const AUDIENCES: AudienceDef[] = [
  aud("open_estimates", "Open Estimates", "Quotes sent or viewed, awaiting a response", "estimate_followup",
    () => getAllQuotes().filter(q => q.status === "sent" || q.status === "viewed")
      .map(q => ({ id: q.id, name: q.customerName, detail: `${q.quoteNumber} · ${fmt(q.total)}` }))),
  aud("approved_unscheduled", "Approved — Not Scheduled", "Approved quotes not yet converted to work", "email",
    () => getAllQuotes().filter(q => q.status === "approved")
      .map(q => ({ id: q.id, name: q.customerName, detail: `${q.quoteNumber} · ${fmt(q.total)}` }))),
  aud("lost_leads", "Lost Leads", "Leads marked lost — win-back candidates", "email",
    () => getAllLeads().filter(l => l.stage === "lost")
      .map(l => ({ id: l.id, name: l.customerName, detail: l.title }))),
  aud("hot_leads", "Needs Follow-Up", "Leads in estimate-sent or follow-up stage", "call_reminder",
    () => getAllLeads().filter(l => l.stage === "estimate_sent" || l.stage === "follow_up")
      .map(l => ({ id: l.id, name: l.customerName, detail: LEAD_STAGE_LABEL[l.stage] ?? l.title }))),
  aud("no_agreement", "Customers Without an Agreement", "Upsell a maintenance plan", "email",
    () => { const a = activeAgreementCustomers(); return getAllCustomers().filter(c => !a.has(c.name.toLowerCase()))
      .map(c => ({ id: c.id, name: c.name, detail: c.type })); }),
  aud("agreement_renewals", "Agreement Renewals Due", "Agreements due soon, overdue, or up for renewal", "maintenance_renewal",
    () => AGREEMENTS.filter(a => a.status === "due_soon" || a.status === "overdue" || a.status === "renewal_due")
      .map(a => ({ id: a.id, name: a.customer, detail: a.type }))),
  aud("recent_completed", "Recently Completed Jobs", "Ask happy customers for a review", "review_request",
    () => getAllJobs().filter(j => j.status === "completed")
      .map(j => ({ id: j.id, name: j.customerName, detail: j.title }))),
  aud("commercial", "Commercial Customers", "All commercial accounts", "seasonal",
    () => getAllCustomers().filter(c => c.type === "Commercial").map(c => ({ id: c.id, name: c.name }))),
  aud("residential", "Residential Customers", "All residential accounts", "seasonal",
    () => getAllCustomers().filter(c => c.type === "Residential").map(c => ({ id: c.id, name: c.name }))),
];

export function getAudience(key: string): AudienceDef | undefined { return AUDIENCES.find(a => a.key === key); }

// ─── Custom audiences (user-built filters) ────────────────
// Pick a base record type + stack rules. Fields are curated per base so every
// rule resolves against real data — no free-text queries that match nothing.
export type CustomBase = "customers" | "leads" | "quotes" | "jobs" | "invoices" | "agreements";
export interface CustomRule { field: string; op: "is" | "is_not" | "gte" | "lte"; value: string }
export interface CustomAudience {
  base: CustomBase;
  rules: CustomRule[];
  match?: "all" | "any";     // how include-rules combine (default: all)
  exclude?: CustomRule[];    // anyone matching ANY of these is dropped
}

export interface CustomFieldDef { key: string; label: string; kind: "select" | "number"; options?: { value: string; label: string }[] }
const opt = (v: string, l?: string) => ({ value: v, label: l ?? v });
export const CUSTOM_BASES: { key: CustomBase; label: string; fields: CustomFieldDef[] }[] = [
  { key: "customers", label: "Customers", fields: [
    { key: "type", label: "Customer type", kind: "select", options: [opt("Residential"), opt("Commercial")] },
    { key: "agreement", label: "Has active agreement", kind: "select", options: [opt("yes", "Yes"), opt("no", "No")] },
  ]},
  { key: "leads", label: "Leads", fields: [
    { key: "stage", label: "Stage", kind: "select", options: [
      opt("new_lead", "New lead"), opt("contacted", "Contacted"), opt("appointment_scheduled", "Appt scheduled"),
      opt("estimate_needed", "Estimate needed"), opt("estimate_sent", "Estimate sent"), opt("follow_up", "Follow-up"),
      opt("won", "Won"), opt("lost", "Lost"),
    ]},
  ]},
  { key: "quotes", label: "Quotes", fields: [
    { key: "status", label: "Status", kind: "select", options: [
      opt("draft", "Draft"), opt("sent", "Sent"), opt("viewed", "Viewed"), opt("approved", "Approved"),
      opt("rejected", "Rejected"), opt("expired", "Expired"), opt("converted", "Converted"),
    ]},
    { key: "total", label: "Quote total ($)", kind: "number" },
  ]},
  { key: "jobs", label: "Jobs", fields: [
    { key: "status", label: "Status", kind: "select", options: [
      opt("new", "New"), opt("scheduled", "Scheduled"), opt("in_progress", "In progress"),
      opt("completed", "Completed"), opt("invoiced", "Invoiced"), opt("closed", "Closed"),
    ]},
    { key: "type", label: "Job type", kind: "select", options: [
      opt("maintenance", "Maintenance"), opt("repair", "Repair"), opt("installation", "Installation"),
      opt("inspection", "Inspection"), opt("emergency", "Emergency"), opt("replacement", "Replacement"),
    ]},
  ]},
  { key: "invoices", label: "Invoices", fields: [
    { key: "status", label: "Status", kind: "select", options: [
      opt("draft", "Draft"), opt("sent", "Sent"), opt("viewed", "Viewed"), opt("partially_paid", "Partially paid"),
      opt("paid", "Paid"), opt("past_due", "Past due"),
    ]},
    { key: "total", label: "Invoice total ($)", kind: "number" },
  ]},
  { key: "agreements", label: "Agreements", fields: [
    { key: "status", label: "Status", kind: "select", options: [
      opt("active", "Active"), opt("due_soon", "Due soon"), opt("overdue", "Overdue"),
      opt("renewal_due", "Renewal due"), opt("canceled", "Canceled"),
    ]},
    { key: "billing", label: "Billing frequency", kind: "select", options: [
      opt("Monthly"), opt("Quarterly"), opt("Semi-annual"), opt("Annual"),
    ]},
  ]},
];

function ruleMatch(rule: CustomRule, actual: string | number | undefined): boolean {
  if (rule.op === "gte" || rule.op === "lte") {
    const a = Number(actual ?? NaN), b = Number(rule.value);
    if (isNaN(a) || isNaN(b)) return false;
    return rule.op === "gte" ? a >= b : a <= b;
  }
  const eq = String(actual ?? "").toLowerCase() === rule.value.toLowerCase();
  return rule.op === "is" ? eq : !eq;
}

export function customAudienceMembers(ca: CustomAudience): AudienceMember[] {
  // Include-rules combine by ALL (and) or ANY (or); exclusions always drop on
  // any match. No include-rules = the whole base.
  const pass = (get: (f: string) => string | number | undefined) => {
    const included = ca.rules.length === 0
      || (ca.match === "any" ? ca.rules.some(r => ruleMatch(r, get(r.field))) : ca.rules.every(r => ruleMatch(r, get(r.field))));
    const excluded = (ca.exclude ?? []).some(r => ruleMatch(r, get(r.field)));
    return included && !excluded;
  };
  switch (ca.base) {
    case "customers": {
      const withAgreement = activeAgreementCustomers();
      return getAllCustomers()
        .filter(c => pass(f => f === "type" ? c.type : f === "agreement" ? (withAgreement.has(c.name.toLowerCase()) ? "yes" : "no") : undefined))
        .map(c => ({ id: c.id, name: c.name, detail: c.type }));
    }
    case "leads":
      return getAllLeads()
        .filter(l => pass(f => f === "stage" ? l.stage : undefined))
        .map(l => ({ id: l.id, name: l.customerName, detail: LEAD_STAGE_LABEL[l.stage] ?? l.stage }));
    case "quotes":
      return getAllQuotes()
        .filter(q => pass(f => f === "status" ? q.status : f === "total" ? q.total : undefined))
        .map(q => ({ id: q.id, name: q.customerName, detail: `${q.quoteNumber} · ${fmt(q.total)}` }));
    case "jobs":
      return getAllJobs()
        .filter(j => pass(f => f === "status" ? j.status : f === "type" ? j.type : undefined))
        .map(j => ({ id: j.id, name: j.customerName, detail: j.title }));
    case "invoices":
      return getAllInvoices()
        .filter(inv => pass(f => f === "status" ? inv.status : f === "total" ? inv.total : undefined))
        .map(inv => ({ id: inv.id, name: inv.customerName, detail: `${inv.invoiceNumber} · ${fmt(inv.total)}` }));
    case "agreements":
      return AGREEMENTS
        .filter(a => pass(f => f === "status" ? a.status : f === "billing" ? a.billingFrequency : undefined))
        .map(a => ({ id: a.id, name: a.customer, detail: a.type }));
  }
}

// Human-readable summary of a custom audience — reads like the sentence the
// builder narrates: "Customers where type is Commercial or has agreement is No,
// excluding city is Aiken".
export function customAudienceLabel(ca: CustomAudience): string {
  const base = CUSTOM_BASES.find(b => b.key === ca.base);
  if (!base) return "Custom audience";
  const part = (r: CustomRule) => {
    const f = base.fields.find(x => x.key === r.field);
    const val = f?.options?.find(o => o.value === r.value)?.label ?? r.value;
    const op = r.op === "is" ? "is" : r.op === "is_not" ? "is not" : r.op === "gte" ? "≥" : "≤";
    return `${f?.label ?? r.field} ${op} ${val}`;
  };
  const joiner = ca.match === "any" ? " or " : " and ";
  const inc = ca.rules.map(part).join(joiner);
  const exc = (ca.exclude ?? []).map(part).join(" or ");
  let out = inc ? `${base.label} where ${inc}` : `All ${base.label.toLowerCase()}`;
  if (exc) out += `, excluding ${exc}`;
  return out;
}

const dedupe = (list: AudienceMember[]): AudienceMember[] => {
  const seen = new Set<string>();
  return list.filter(m => {
    const k = m.name.trim().toLowerCase();
    if (!k || seen.has(k)) return false;
    seen.add(k);
    return true;
  });
};

// ─── Saved audiences (the user's reusable segments) ───────
// A saved audience = a named CustomAudience that lives in the Audiences
// section, shows a live count, and is pickable in the Campaign Studio.
export interface SavedAudience { id: string; name: string; description?: string; custom: CustomAudience; createdAt: string }
const SAVED_AUD_KEY = "crm-saved-audiences";
let _savedAudiences: SavedAudience[] | null = null;
function savedAudiences(): SavedAudience[] {
  if (!_savedAudiences) _savedAudiences = read<SavedAudience[]>(SAVED_AUD_KEY, []);
  return _savedAudiences;
}
function persistSavedAudiences(): void {
  try { localStorage.setItem(SAVED_AUD_KEY, JSON.stringify(_savedAudiences ?? [])); } catch { /* ignore */ }
}
export function getSavedAudiences(): SavedAudience[] { return savedAudiences(); }
export function getSavedAudience(id: string): SavedAudience | undefined { return savedAudiences().find(a => a.id === id); }
export function createSavedAudience(input: { name: string; description?: string; custom: CustomAudience }): SavedAudience {
  const a: SavedAudience = {
    id: `aud-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
    name: input.name.trim() || "Untitled Audience",
    description: input.description?.trim() || undefined,
    custom: input.custom, createdAt: nowStamp(),
  };
  _savedAudiences = [a, ...savedAudiences()];
  persistSavedAudiences();
  return a;
}
export function updateSavedAudience(id: string, patch: Partial<Omit<SavedAudience, "id">>): SavedAudience | undefined {
  let out: SavedAudience | undefined;
  _savedAudiences = savedAudiences().map(a => (a.id === id ? (out = { ...a, ...patch, id: a.id }) : a));
  persistSavedAudiences();
  return out;
}
export function deleteSavedAudience(id: string): void {
  _savedAudiences = savedAudiences().filter(a => a.id !== id);
  persistSavedAudiences();
}

// The people a send would actually reach — deduped by name (one customer with
// three open quotes gets ONE email). Resolution order: system segment → saved
// audience (by id) → the campaign's own custom rules ("custom", or a snapshot
// kept after a saved audience was deleted).
export function audienceRecipients(key: string): AudienceMember[] {
  return dedupe(getAudience(key)?.members() ?? []);
}
export function resolveRecipients(audienceKey: string, custom?: CustomAudience): AudienceMember[] {
  if (getAudience(audienceKey)) return audienceRecipients(audienceKey);
  const saved = getSavedAudience(audienceKey);
  if (saved) return dedupe(customAudienceMembers(saved.custom));
  if (custom) return dedupe(customAudienceMembers(custom));
  return [];
}
// Display name for whatever an audienceKey points at.
export function audienceNameFor(audienceKey: string, custom?: CustomAudience): string {
  return getAudience(audienceKey)?.name
    ?? getSavedAudience(audienceKey)?.name
    ?? (custom ? customAudienceLabel(custom) : audienceKey);
}

// ─── Seed templates ───────────────────────────────────────
// Emails are user-authored in the Design Studio — no filler email seeds.
const T = "Apr 2026";
export const SEED_TEMPLATES: MarketingTemplate[] = [
  { id: "tpl-sms-otw", name: "On-the-Way SMS", type: "sms", channel: "sms",
    body: "Hi {{first_name}}, your {{company}} tech is on the way and will arrive around {{eta}}. Reply STOP to opt out.", createdAt: T },
];

// ─── Seed campaigns ───────────────────────────────────────
export const SEED_CAMPAIGNS: Campaign[] = [];

// ─── Runtime store ────────────────────────────────────────
const C_KEY = "crm-extra-campaigns";
const TPL_KEY = "crm-extra-templates";
const TPL_OV_KEY = "crm-template-overrides";
let _campaigns: Campaign[] | null = null;
let _templates: MarketingTemplate[] | null = null;
let _tplOverrides: Record<string, Partial<MarketingTemplate>> | null = null;

function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try { const r = localStorage.getItem(key); return r ? JSON.parse(r) as T : fallback; } catch { return fallback; }
}
function nowStamp(): string { return new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }); }
function sessionTemplates(): MarketingTemplate[] { if (!_templates) _templates = read<MarketingTemplate[]>(TPL_KEY, []); return _templates; }
function tplOverrides(): Record<string, Partial<MarketingTemplate>> { if (!_tplOverrides) _tplOverrides = read(TPL_OV_KEY, {}); return _tplOverrides; }
function applyTpl(t: MarketingTemplate): MarketingTemplate { const o = tplOverrides()[t.id]; return o ? { ...t, ...o } : t; }

export function getCampaigns(): Campaign[] {
  if (!_campaigns) _campaigns = read<Campaign[]>(C_KEY, []);
  return [..._campaigns, ...SEED_CAMPAIGNS];
}
export function getTemplates(): MarketingTemplate[] {
  return [...sessionTemplates(), ...SEED_TEMPLATES].map(applyTpl).filter(t => !t.deleted);
}
export function getCampaign(id: string): Campaign | undefined { return getCampaigns().find(c => c.id === id); }
export function getTemplate(id: string): MarketingTemplate | undefined { return getTemplates().find(t => t.id === id); }
// Templates strictly match the campaign's CHANNEL — an email campaign only
// ever offers email templates, SMS only SMS, task only call scripts.
export function getTemplatesForType(type: CampaignType): MarketingTemplate[] {
  const channel = CAMPAIGN_TYPE_CONFIG[type].channel;
  return getTemplates().filter(t => t.channel === channel);
}

// ─── Campaign lifecycle ───────────────────────────────────
// draft → scheduled → sent (paused sits between scheduled and sent). Sending
// snapshots the deduped audience as the recipient list; a task-channel send
// creates a REAL call task per recipient with the script attached. Opens and
// clicks stay at zero — engagement lands with a real send provider, and we
// don't fake numbers.
function ownCampaigns(): Campaign[] {
  if (!_campaigns) _campaigns = read<Campaign[]>(C_KEY, []);
  return _campaigns;
}
function persistCampaigns(): void {
  try { localStorage.setItem(C_KEY, JSON.stringify(_campaigns ?? [])); } catch { /* ignore */ }
}
const evt = (text: string): CampaignEvent => ({
  id: `ce-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
  text,
  when: new Date().toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }),
});

export function updateCampaign(id: string, patch: Partial<Campaign>): Campaign | undefined {
  let out: Campaign | undefined;
  _campaigns = ownCampaigns().map(c => (c.id === id ? (out = { ...c, ...patch, id: c.id }) : c));
  persistCampaigns();
  return out;
}
function logCampaign(id: string, text: string): void {
  const c = getCampaign(id);
  if (c) updateCampaign(id, { activity: [...(c.activity ?? []), evt(text)] });
}

export interface NewCampaignInput {
  name: string; type: CampaignType; audienceKey: string; customAudience?: CustomAudience;
  templateId?: string; sequence?: SequenceStep[]; sequenceMembership?: SequenceMembership;
  scheduledFor?: string; sendNow?: boolean;
}
export function createCampaign(input: NewCampaignInput): Campaign {
  const channel = CAMPAIGN_TYPE_CONFIG[input.type].channel;
  const c: Campaign = {
    id: `cmp-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
    name: input.name.trim() || "Untitled Campaign",
    type: input.type, channel, audienceKey: input.audienceKey, customAudience: input.customAudience,
    templateId: input.templateId, sequence: input.sequence, sequenceMembership: input.sequenceMembership,
    status: input.scheduledFor ? "scheduled" : "draft",
    recipients: resolveRecipients(input.audienceKey, input.customAudience).length,
    scheduledFor: input.scheduledFor, createdAt: nowStamp(),
    activity: [evt("Campaign created"), ...(input.scheduledFor ? [evt(`Scheduled for ${input.scheduledFor}`)] : [])],
  };
  _campaigns = [c, ...ownCampaigns()];
  persistCampaigns();
  return input.sendNow ? (sendCampaign(c.id) ?? c) : c;
}

// Reconfigure an existing (not-yet-sent) campaign from the studio.
export function reconfigureCampaign(id: string, input: NewCampaignInput): Campaign | undefined {
  const c = getCampaign(id);
  if (!c || c.status === "sent") return c;
  const updated = updateCampaign(id, {
    name: input.name.trim() || c.name,
    type: input.type, channel: CAMPAIGN_TYPE_CONFIG[input.type].channel,
    audienceKey: input.audienceKey, customAudience: input.customAudience,
    templateId: input.templateId, sequence: input.sequence, sequenceMembership: input.sequenceMembership,
    recipients: resolveRecipients(input.audienceKey, input.customAudience).length,
    scheduledFor: input.scheduledFor,
    status: input.scheduledFor ? "scheduled" : c.status === "paused" ? "paused" : "draft",
    activity: [...(c.activity ?? []), evt("Campaign updated")],
  });
  return input.sendNow ? (sendCampaign(id) ?? updated) : updated;
}

// Execute one channel touch against a recipient list. Task touches create
// REAL call tasks; email/SMS record the (simulated) send.
function executeTouch(c: Campaign, kind: SequenceStepKind, templateId: string | undefined, recipients: CampaignRecipient[]): string {
  const tpl = templateId ? getTemplate(templateId) : undefined;
  if (kind === "task") {
    for (const r of recipients) {
      createTask({
        title: `Call ${r.name} — ${c.name}`, type: "follow_up", dueDate: nowStamp(),
        notes: tpl?.body ? `Script:\n${tpl.body}` : `Campaign: ${c.name}`,
        companyId: "co_hvac", locationId: "loc_augusta",
      });
    }
    return `${recipients.length} call task${recipients.length === 1 ? "" : "s"} created`;
  }
  return `Sent to ${recipients.length} recipient${recipients.length === 1 ? "" : "s"} (${kind.toUpperCase()})`;
}

const stampInDays = (days: number): string => {
  const d = new Date(); d.setDate(d.getDate() + days);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};

// ── Sequence schedule — single source of truth ────────────
// Computes when each step lands (and catches impossible setups: a calendar
// date in the past, or earlier than the step before it). The wizard uses it
// for live validation; launch uses it to stamp the due dates.
export const fmtDue = (d: Date, withTime: boolean): string =>
  withTime
    ? d.toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })
    : d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

export function stepHasTime(s: SequenceStep): boolean {
  return Boolean(s.timeOfDay) || (s.scheduleMode ?? "after") === "on";
}

export interface StepSchedule { due: Date | null; error?: string }   // due null = fires at launch

export function sequenceSchedule(steps: SequenceStep[], from: Date = new Date()): StepSchedule[] {
  const out: StepSchedule[] = [];
  let cur = new Date(from);
  steps.forEach((s, i) => {
    const mode = s.scheduleMode ?? "after";
    if (i === 0 && mode === "after" && (s.waitDays ?? 0) === 0) { out.push({ due: null }); return; }
    if (mode === "on") {
      if (!s.onDate) { out.push({ due: null, error: "Pick a date" }); return; }
      const due = new Date(`${s.onDate}T${s.timeOfDay || "09:00"}`);
      if (isNaN(due.getTime())) { out.push({ due: null, error: "Pick a valid date" }); return; }
      if (due.getTime() < from.getTime()) { out.push({ due, error: "That's in the past" }); return; }
      if (due.getTime() < cur.getTime()) { out.push({ due, error: `Before step ${i} — earliest is ${fmtDue(cur, true)}` }); return; }
      out.push({ due });
      cur = due;
      return;
    }
    const due = new Date(cur);
    due.setDate(due.getDate() + Math.max(i === 0 ? 0 : 1, s.waitDays ?? 1));
    if (s.timeOfDay) {
      const [h, m] = s.timeOfDay.split(":").map(Number);
      due.setHours(h || 0, m || 0, 0, 0);
    }
    out.push({ due });
    cur = due;
  });
  return out;
}

// Fire ONE sequence step honestly:
//  1. membership re-check (unless frozen) — recipients whose records no longer
//     match the audience rules exit here, with the step number and reason,
//  2. the step's own onlyIf narrowing — still in the sequence, just not this
//     step's subset (skipped, not exited),
//  3. the touch runs against whoever is left.
// Returns the updated recipient list, the step's runtime numbers, and the
// activity-log line.
function fireSequenceStep(c: Campaign, idx: number, recipients: CampaignRecipient[]): {
  recipients: CampaignRecipient[]; runtime: Pick<SequenceStep, "sentTo" | "exited" | "skipped">; note: string;
} {
  const step = c.sequence![idx];
  const stepNo = idx + 1;
  const key = (n: string) => n.trim().toLowerCase();

  let list = recipients;
  let exitedNow = 0;
  if ((c.sequenceMembership ?? "recheck") === "recheck") {
    const current = new Set(resolveRecipients(c.audienceKey, c.customAudience).map(m => key(m.name)));
    list = list.map(r => {
      if (r.exitedAtStep != null || current.has(key(r.name))) return r;
      exitedNow += 1;
      return { ...r, exitedAtStep: stepNo, exitReason: "No longer matches the audience" };
    });
  }

  const active = list.filter(r => r.exitedAtStep == null);
  let sendTo = active;
  let skipped = 0;
  if (step.onlyIf) {
    const subset = new Set(customAudienceMembers(step.onlyIf).map(m => key(m.name)));
    sendTo = active.filter(r => subset.has(key(r.name)));
    skipped = active.length - sendTo.length;
  }

  const result = executeTouch(c, step.kind, step.templateId, sendTo);
  const note = `Step ${stepNo} — ${result}`
    + (exitedNow ? ` · ${exitedNow} exited (no longer match)` : "")
    + (skipped ? ` · ${skipped} skipped (outside this step's rule)` : "");
  return { recipients: list, runtime: { sentTo: sendTo.length, exited: exitedNow, skipped }, note };
}

// Send / run the campaign NOW. Recipients freeze at this moment. One-shots
// send everything; SEQUENCES run step 1 immediately, date the remaining steps
// (cumulative waits), and go "active" until every step has run.
export function sendCampaign(id: string): Campaign | undefined {
  const c = getCampaign(id);
  if (!c || c.status === "sent" || c.status === "active") return c;
  const recipients = resolveRecipients(c.audienceKey, c.customAudience);
  const events: CampaignEvent[] = [...(c.activity ?? [])];

  if (c.sequence?.length) {
    const sched = sequenceSchedule(c.sequence);
    let list: CampaignRecipient[] = recipients;
    const steps = c.sequence.map((s, i) => {
      if (i === 0 && !sched[0].due && !sched[0].error) {
        const fired = fireSequenceStep(c, 0, list);
        list = fired.recipients;
        events.push(evt(fired.note));
        return { ...s, status: "sent" as const, sentAt: nowStamp(), ...fired.runtime };
      }
      return { ...s, status: "pending" as const, dueDate: sched[i].due ? fmtDue(sched[i].due!, stepHasTime(s)) : stampInDays(1) };
    });
    const allDone = steps.every(s => s.status === "sent");
    events.push(evt(allDone ? "Sequence complete" : `Sequence started — ${steps.filter(s => s.status === "pending").length} step(s) scheduled`));
    return updateCampaign(id, {
      status: allDone ? "sent" : "active",
      sentAt: allDone ? nowStamp() : undefined,
      recipients: recipients.length, recipientList: list,
      stats: { delivered: recipients.length, opened: 0, clicked: 0, responded: 0 },
      sequence: steps, activity: events,
    });
  }

  events.push(evt(c.channel === "task" ? `Ran — ${executeTouch(c, "task", c.templateId, recipients)}` : executeTouch(c, c.channel === "sms" ? "sms" : "email", c.templateId, recipients)));
  return updateCampaign(id, {
    status: "sent", sentAt: nowStamp(),
    recipients: recipients.length, recipientList: recipients,
    stats: { delivered: recipients.length, opened: 0, clicked: 0, responded: 0 },
    activity: events,
  });
}

// Fire one pending sequence step now (they don't auto-fire — no scheduler).
// When the last step runs, the campaign completes.
export function runSequenceStep(campaignId: string, stepId: string): Campaign | undefined {
  const c = getCampaign(campaignId);
  if (!c?.sequence) return c;
  const recipients = c.recipientList ?? resolveRecipients(c.audienceKey, c.customAudience);
  const idx = c.sequence.findIndex(s => s.id === stepId);
  if (idx === -1 || c.sequence[idx].status === "sent") return c;
  const fired = fireSequenceStep(c, idx, recipients);
  const steps = c.sequence.map(s => (s.id === stepId ? { ...s, status: "sent" as const, sentAt: nowStamp(), ...fired.runtime } : s));
  const allDone = steps.every(s => s.status === "sent");
  const events = [...(c.activity ?? []), evt(fired.note), ...(allDone ? [evt("Sequence complete")] : [])];
  return updateCampaign(campaignId, {
    sequence: steps, activity: events, recipientList: fired.recipients,
    status: allDone ? "sent" : "active",
    sentAt: allDone ? nowStamp() : c.sentAt,
  });
}

export function pauseCampaign(id: string): void {
  const c = getCampaign(id);
  if (c?.status === "scheduled") { updateCampaign(id, { status: "paused" }); logCampaign(id, "Paused"); }
}
export function resumeCampaign(id: string): void {
  const c = getCampaign(id);
  if (c?.status === "paused") { updateCampaign(id, { status: "scheduled" }); logCampaign(id, "Resumed — back on schedule"); }
}
export function duplicateCampaign(id: string): Campaign | undefined {
  const src = getCampaign(id);
  if (!src) return undefined;
  const copy: Campaign = {
    ...src, id: `cmp-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
    name: `${src.name} (Copy)`, status: "draft", createdAt: nowStamp(),
    recipients: audienceRecipients(src.audienceKey).length,
    scheduledFor: undefined, sentAt: undefined, stats: undefined, recipientList: undefined,
    activity: [evt(`Duplicated from "${src.name}"`)],
  };
  _campaigns = [copy, ...ownCampaigns()];
  persistCampaigns();
  return copy;
}
export function deleteCampaign(id: string): void {
  _campaigns = ownCampaigns().filter(c => c.id !== id);
  persistCampaigns();
}

export interface NewTemplateInput { name: string; type: CampaignType; subject?: string; body: string; design?: DesignDoc }
export function createTemplate(input: NewTemplateInput): MarketingTemplate {
  const t: MarketingTemplate = {
    id: `tpl-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
    name: input.name.trim() || "Untitled Template", type: input.type,
    channel: CAMPAIGN_TYPE_CONFIG[input.type].channel,
    subject: input.subject?.trim() || undefined, body: input.body, design: input.design, createdAt: nowStamp(),
  };
  _templates = [t, ...sessionTemplates()];
  try { localStorage.setItem(TPL_KEY, JSON.stringify(_templates)); } catch { /* ignore */ }
  return t;
}

// Edit a template — session templates mutate in place; seed templates via overrides.
export function updateTemplate(id: string, patch: Partial<MarketingTemplate>): MarketingTemplate | undefined {
  if (sessionTemplates().some(t => t.id === id)) {
    _templates = sessionTemplates().map(t => t.id === id ? { ...t, ...patch } : t);
    try { localStorage.setItem(TPL_KEY, JSON.stringify(_templates)); } catch { /* ignore */ }
  } else {
    const all = { ...tplOverrides() };
    all[id] = { ...all[id], ...patch };
    if (patch.type) all[id].channel = CAMPAIGN_TYPE_CONFIG[patch.type].channel;
    _tplOverrides = all;
    try { localStorage.setItem(TPL_OV_KEY, JSON.stringify(all)); } catch { /* ignore */ }
  }
  return getTemplates().find(t => t.id === id);
}
export function deleteTemplate(id: string): void {
  if (sessionTemplates().some(t => t.id === id)) {
    _templates = sessionTemplates().filter(t => t.id !== id);
    try { localStorage.setItem(TPL_KEY, JSON.stringify(_templates)); } catch { /* ignore */ }
  } else {
    const all = { ...tplOverrides() }; all[id] = { ...all[id], deleted: true }; _tplOverrides = all;
    try { localStorage.setItem(TPL_OV_KEY, JSON.stringify(all)); } catch { /* ignore */ }
  }
}
