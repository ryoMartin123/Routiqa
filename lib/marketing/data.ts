// Marketing — campaigns, templates, and audience segments computed from live
// CRM data. Mock + localStorage store, mirroring the Quotes pattern. Replace
// with Supabase (campaigns, campaign_templates, campaign_sends) when ready.

import { getAllQuotes } from "@/lib/quotes/data";
import { getAllLeads } from "@/lib/leads/data";
import { getAllCustomers } from "@/lib/customers/data";
import { getAllJobs } from "@/lib/jobs/data";
import { AGREEMENTS } from "@/lib/agreements/data";

// ─── Types ────────────────────────────────────────────────
export type CampaignChannel = "email" | "sms" | "task";
export type CampaignType =
  | "email" | "sms" | "review_request" | "estimate_followup"
  | "maintenance_renewal" | "seasonal" | "call_reminder";
export type CampaignStatus = "draft" | "scheduled" | "active" | "sent" | "paused";

export interface MarketingTemplate {
  id: string;
  name: string;
  type: CampaignType;
  channel: CampaignChannel;
  subject?: string;        // email only
  body: string;
  createdAt: string;
  deleted?: boolean;
}

export interface CampaignStats { delivered: number; opened: number; clicked: number; responded: number }

export interface Campaign {
  id: string;
  name: string;
  type: CampaignType;
  channel: CampaignChannel;
  audienceKey: string;
  templateId?: string;
  status: CampaignStatus;
  recipients: number;       // snapshot at create/send time
  scheduledFor?: string;
  createdAt: string;
  sentAt?: string;
  stats?: CampaignStats;
}

// ─── Type display config ──────────────────────────────────
export const CAMPAIGN_TYPE_CONFIG: Record<CampaignType, { label: string; channel: CampaignChannel; color: string }> = {
  email:               { label: "Email Blast",         channel: "email", color: "#4f46e5" },
  sms:                 { label: "SMS Blast",           channel: "sms",   color: "#0891b2" },
  review_request:      { label: "Review Request",      channel: "email", color: "#f59e0b" },
  estimate_followup:   { label: "Estimate Follow-Up",  channel: "email", color: "#7c3aed" },
  maintenance_renewal: { label: "Maintenance Renewal", channel: "email", color: "#059669" },
  seasonal:            { label: "Seasonal Campaign",   channel: "email", color: "#db2777" },
  call_reminder:       { label: "Call / Task Reminder",channel: "task",  color: "#6b7280" },
};

export const CAMPAIGN_STATUS_CONFIG: Record<CampaignStatus, { label: string; bg: string; color: string }> = {
  draft:     { label: "Draft",     bg: "var(--bg-input)", color: "var(--text-muted)" },
  scheduled: { label: "Scheduled", bg: "#e0e7ff",         color: "#3730a3" },
  active:    { label: "Active",    bg: "#d1fae5",         color: "#065f46" },
  sent:      { label: "Sent",      bg: "#ecfdf5",         color: "#059669" },
  paused:    { label: "Paused",    bg: "#fef3c7",         color: "#92400e" },
};

// ─── Audience segments (live counts from CRM data) ────────
export interface AudienceDef {
  key: string;
  name: string;
  description: string;
  defaultType: CampaignType;
  count: () => number;
}

function activeAgreementCustomers(): Set<string> {
  return new Set(AGREEMENTS.filter(a => a.status !== "canceled").map(a => a.customer.toLowerCase()));
}

export const AUDIENCES: AudienceDef[] = [
  { key: "open_estimates", name: "Open Estimates", description: "Quotes sent or viewed, awaiting a response", defaultType: "estimate_followup",
    count: () => getAllQuotes().filter(q => q.status === "sent" || q.status === "viewed").length },
  { key: "approved_unscheduled", name: "Approved — Not Scheduled", description: "Approved quotes not yet converted to work", defaultType: "email",
    count: () => getAllQuotes().filter(q => q.status === "approved").length },
  { key: "lost_leads", name: "Lost Leads", description: "Leads marked lost — win-back candidates", defaultType: "email",
    count: () => getAllLeads().filter(l => l.stage === "lost").length },
  { key: "hot_leads", name: "Needs Follow-Up", description: "Leads in estimate-sent or follow-up stage", defaultType: "call_reminder",
    count: () => getAllLeads().filter(l => l.stage === "estimate_sent" || l.stage === "follow_up").length },
  { key: "no_agreement", name: "Customers Without an Agreement", description: "Upsell a maintenance plan", defaultType: "email",
    count: () => { const a = activeAgreementCustomers(); return getAllCustomers().filter(c => !a.has(c.name.toLowerCase())).length; } },
  { key: "agreement_renewals", name: "Agreement Renewals Due", description: "Agreements due soon, overdue, or up for renewal", defaultType: "maintenance_renewal",
    count: () => AGREEMENTS.filter(a => a.status === "due_soon" || a.status === "overdue" || a.status === "renewal_due").length },
  { key: "recent_completed", name: "Recently Completed Jobs", description: "Ask happy customers for a review", defaultType: "review_request",
    count: () => getAllJobs().filter(j => j.status === "completed").length },
  { key: "commercial", name: "Commercial Customers", description: "All commercial accounts", defaultType: "seasonal",
    count: () => getAllCustomers().filter(c => c.type === "Commercial").length },
  { key: "residential", name: "Residential Customers", description: "All residential accounts", defaultType: "seasonal",
    count: () => getAllCustomers().filter(c => c.type === "Residential").length },
];

export function getAudience(key: string): AudienceDef | undefined { return AUDIENCES.find(a => a.key === key); }

// ─── Seed templates ───────────────────────────────────────
const T = "Apr 2026";
export const SEED_TEMPLATES: MarketingTemplate[] = [
  { id: "tpl-est-fu", name: "Estimate Follow-Up", type: "estimate_followup", channel: "email", subject: "Still thinking it over, {{first_name}}?",
    body: "Hi {{first_name}},\n\nJust following up on the estimate we sent for {{job_title}}. Happy to answer any questions or adjust the scope. This quote is valid until {{expires}}.\n\n— {{company}}", createdAt: T },
  { id: "tpl-review", name: "Review Request", type: "review_request", channel: "email", subject: "How did we do, {{first_name}}?",
    body: "Hi {{first_name}},\n\nThanks for trusting {{company}} with your recent service. If you have a moment, a quick review would mean a lot: {{review_link}}", createdAt: T },
  { id: "tpl-renewal", name: "Maintenance Renewal", type: "maintenance_renewal", channel: "email", subject: "Your maintenance plan is due for renewal",
    body: "Hi {{first_name}},\n\nYour {{plan_name}} is coming up for renewal on {{renewal_date}}. Renew now to keep priority service and your repair discount.\n\n— {{company}}", createdAt: T },
  { id: "tpl-winback", name: "Win-Back Offer", type: "email", channel: "email", subject: "We'd love to earn your business",
    body: "Hi {{first_name}},\n\nIt's been a while! Here's 10% off your next service with {{company}}. Reply or call us to book.", createdAt: T },
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
export function getTemplatesForType(type: CampaignType): MarketingTemplate[] {
  const channel = CAMPAIGN_TYPE_CONFIG[type].channel;
  return getTemplates().filter(t => t.type === type || t.channel === channel);
}

export interface NewCampaignInput {
  name: string; type: CampaignType; audienceKey: string; templateId?: string;
  recipients: number; scheduledFor?: string; sendNow?: boolean;
}
export function createCampaign(input: NewCampaignInput): Campaign {
  const channel = CAMPAIGN_TYPE_CONFIG[input.type].channel;
  const status: CampaignStatus = input.sendNow ? "active" : input.scheduledFor ? "scheduled" : "draft";
  const c: Campaign = {
    id: `cmp-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
    name: input.name.trim() || "Untitled Campaign",
    type: input.type, channel, audienceKey: input.audienceKey, templateId: input.templateId,
    status, recipients: input.recipients,
    scheduledFor: input.scheduledFor, createdAt: nowStamp(),
    sentAt: input.sendNow ? nowStamp() : undefined,
    stats: input.sendNow ? { delivered: input.recipients, opened: 0, clicked: 0, responded: 0 } : undefined,
  };
  _campaigns = [c, ...(_campaigns ?? read<Campaign[]>(C_KEY, []))];
  try { localStorage.setItem(C_KEY, JSON.stringify(_campaigns)); } catch { /* ignore */ }
  return c;
}

export interface NewTemplateInput { name: string; type: CampaignType; subject?: string; body: string }
export function createTemplate(input: NewTemplateInput): MarketingTemplate {
  const t: MarketingTemplate = {
    id: `tpl-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
    name: input.name.trim() || "Untitled Template", type: input.type,
    channel: CAMPAIGN_TYPE_CONFIG[input.type].channel,
    subject: input.subject?.trim() || undefined, body: input.body, createdAt: nowStamp(),
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
