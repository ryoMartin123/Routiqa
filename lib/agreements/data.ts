// ─── Agreements domain types + mock data ─────────────────
// Supports any service industry: HVAC, Roofing, Plumbing,
// Property Maintenance, Consulting, and more.
//
// Maps to future DB tables:
//   agreement_templates, customer_agreements,
//   agreement_visits, agreement_billing_events

import { createJob, updateJob, getJob, type Job } from "@/lib/jobs/data";

export type AgreementStatus =
  | "active"
  | "due_soon"
  | "overdue"
  | "renewal_due"
  | "canceled";

export type BillingFrequency =
  | "Monthly"
  | "Quarterly"
  | "Semi-annual"
  | "Annual";

export type VisitFrequency =
  | "Monthly"
  | "Quarterly"
  | "2x per year"
  | "1x per year"
  | "As needed";

// "planned" = part of the agreement plan but not yet a job; "scheduled" = a real
// job has been materialized for it (visit.jobId set) and rides the job lifecycle.
export type VisitStatus = "planned" | "scheduled" | "completed" | "missed";

export type Industry =
  | "HVAC"
  | "Roofing"
  | "Plumbing"
  | "Property Maintenance"
  | "Consulting"
  | "General";

// ─── Visit ───────────────────────────────────────────────
export interface AgreementVisit {
  id: string;
  label: string;
  scheduled: string;
  status: VisitStatus;
  tech: string;
  completedDate?: string;
  notes?: string;
  jobId?: string;        // set once the visit is materialized into a dispatchable job
}

// ─── Customer Agreement ───────────────────────────────────
export interface CustomerAgreement {
  id: string;
  templateId: string;
  customer: string;
  customerInitials: string;
  type: string;
  industry: Industry;
  status: AgreementStatus;
  location: string;
  assignedTo: string;
  startDate: string;
  renewalDate: string;
  nextVisit: string | null;
  billingFrequency: BillingFrequency;
  visitFrequency: VisitFrequency;
  annualValue: number;
  services: string[];
  notes: string;
  visits: AgreementVisit[];
}

// ─── Agreement Template ───────────────────────────────────
export interface AgreementTemplate {
  id: string;
  name: string;
  industry: Industry;
  description: string;
  billingFrequency: BillingFrequency;
  visitFrequency: VisitFrequency;
  annualValue: number;
  priceLabel: string;
  services: string[];
  status: "active" | "draft" | "archived";
  activeCount: number;
}

// ─── Templates ────────────────────────────────────────────
export const TEMPLATES: AgreementTemplate[] = [
  {
    id: "t1", name: "HVAC Residential Maintenance Plan", industry: "HVAC",
    description: "Spring and fall tune-ups, filter replacements, and priority dispatch for residential HVAC systems.",
    billingFrequency: "Annual", visitFrequency: "2x per year",
    annualValue: 349, priceLabel: "$349/yr",
    services: ["Spring tune-up", "Fall tune-up", "Filter replacement", "Priority dispatch", "10% repair discount"],
    status: "active", activeCount: 5,
  },
  {
    id: "t2", name: "Commercial HVAC Quarterly Plan", industry: "HVAC",
    description: "Quarterly preventive maintenance for commercial HVAC systems with detailed service reports.",
    billingFrequency: "Quarterly", visitFrequency: "Quarterly",
    annualValue: 1200, priceLabel: "$300/qtr",
    services: ["Quarterly inspection", "Filter changes", "Coil cleaning", "Refrigerant check", "Priority scheduling", "Monthly reporting"],
    status: "active", activeCount: 2,
  },
  {
    id: "t3", name: "Roofing Annual Inspection Plan", industry: "Roofing",
    description: "Annual roof inspection with gutter cleaning and minor repair coverage for residential and commercial properties.",
    billingFrequency: "Annual", visitFrequency: "1x per year",
    annualValue: 599, priceLabel: "$599/yr",
    services: ["Annual inspection", "Gutter cleaning", "Photo report", "Minor repairs (1hr)", "Storm damage priority"],
    status: "active", activeCount: 1,
  },
  {
    id: "t4", name: "Plumbing Membership", industry: "Plumbing",
    description: "Quarterly plumbing inspections, drain cleaning, and water heater checks with emergency priority access.",
    billingFrequency: "Quarterly", visitFrequency: "Quarterly",
    annualValue: 299, priceLabel: "$75/qtr",
    services: ["Quarterly inspection", "Drain cleaning", "Water heater check", "Emergency priority", "15% repair discount"],
    status: "active", activeCount: 2,
  },
  {
    id: "t5", name: "Property Maintenance Contract", industry: "Property Maintenance",
    description: "Monthly property walkthroughs, minor repairs, seasonal preparation, and 24hr emergency line for commercial and multi-unit properties.",
    billingFrequency: "Monthly", visitFrequency: "Monthly",
    annualValue: 2400, priceLabel: "$200/mo",
    services: ["Monthly walkthrough", "Minor repairs included", "Seasonal prep", "24hr emergency line", "Dedicated account manager", "Quarterly property report"],
    status: "active", activeCount: 2,
  },
  {
    id: "t6", name: "Consulting Retainer", industry: "Consulting",
    description: "Monthly retainer for ongoing consulting, operations support, and strategic advisory services.",
    billingFrequency: "Monthly", visitFrequency: "As needed",
    annualValue: 36000, priceLabel: "$3,000/mo",
    services: ["Weekly check-in calls", "Strategy sessions", "Process documentation", "Team training", "Priority support"],
    status: "active", activeCount: 1,
  },
  {
    id: "t7", name: "HVAC Commercial Semi-annual Plan", industry: "HVAC",
    description: "Semi-annual HVAC maintenance for light commercial buildings.",
    billingFrequency: "Semi-annual", visitFrequency: "2x per year",
    annualValue: 799, priceLabel: "$399.50/6mo",
    services: ["Spring inspection", "Fall inspection", "Filter replacement", "Priority dispatch"],
    status: "draft", activeCount: 0,
  },
];

// ─── Customer Agreements ──────────────────────────────────
export const AGREEMENTS: CustomerAgreement[] = [];

// ─── Derived summary stats ────────────────────────────────
export const AGREEMENT_STATS = {
  active:          AGREEMENTS.filter((a) => a.status === "active" || a.status === "due_soon").length,
  visitsDueMonth:  AGREEMENTS.filter((a) => a.nextVisit?.includes("Jun") || a.nextVisit?.includes("May")).length,
  renewalsDueSoon: AGREEMENTS.filter((a) => a.status === "renewal_due").length,
  annualRevenue:   AGREEMENTS.filter((a) => a.status !== "canceled").reduce((sum, a) => sum + a.annualValue, 0),
};

// ─── Helpers ──────────────────────────────────────────────
// ─── Hero-card helpers (customer profile breakdown) ───────
// Status label + accent color, shared by the summary card and detail page.
export const AGREEMENT_STATUS_META: Record<AgreementStatus, { label: string; color: string }> = {
  active:      { label: "Active",      color: "#10b981" },
  due_soon:    { label: "Due Soon",    color: "#f59e0b" },
  overdue:     { label: "Overdue",     color: "#ef4444" },
  renewal_due: { label: "Renewal Due", color: "#f97316" },
  canceled:    { label: "Canceled",    color: "#6b7280" },
};

export function agreementVisitProgress(a: CustomerAgreement): { done: number; total: number } {
  return { done: a.visits.filter(v => v.status === "completed").length, total: a.visits.length };
}

// Renew an agreement for another term: advance the renewal date by the term
// (default 12 months) and set it back to Active. Renews from the later of today
// or the current renewal date so an overdue renewal still lands in the future.
export function renewAgreement(id: string): CustomerAgreement | undefined {
  const a = getAgreement(id);
  if (!a) return undefined;
  const months = a.renewal?.termMonths ?? 12;
  const current = new Date(a.renewalDate);
  const from = !isNaN(current.getTime()) && current.getTime() > Date.now() ? current : new Date();
  from.setMonth(from.getMonth() + months);
  const renewalDate = from.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  return updateAgreement(id, { renewalDate, status: "active" });
}

const BILLING_MONTHS: Record<BillingFrequency, number> = {
  Monthly: 1, Quarterly: 3, "Semi-annual": 6, Annual: 12,
};

// Next charge date — stepped from the first bill (or start date) by the cadence
// until it lands in the future. We track this for display; no invoices yet.
export function nextBillingDate(a: CustomerAgreement): Date | null {
  const anchor = new Date(a.firstBillingDate || a.startDate);
  if (isNaN(anchor.getTime())) return null;
  const step = BILLING_MONTHS[a.billingFrequency] ?? 12;
  const now = new Date();
  const d = new Date(anchor);
  let guard = 0;
  while (d.getTime() < now.getTime() && guard++ < 240) d.setMonth(d.getMonth() + step);
  return d;
}

// Amount charged each billing period (explicit amount wins; else annualValue split).
export function billingAmountPerPeriod(a: CustomerAgreement): number {
  if (a.billingAmount != null) return a.billingAmount;
  const step = BILLING_MONTHS[a.billingFrequency] ?? 12;
  return Math.round(a.annualValue / (12 / step));
}

export function formatValue(a: CustomerAgreement): string {
  if (a.billingLabel) {
    const per = a.billingLabel.toLowerCase();
    if (per === "monthly")   return `$${(a.annualValue / 12).toLocaleString()}/mo`;
    if (per === "quarterly") return `$${(a.annualValue / 4).toLocaleString()}/qtr`;
    if (per === "per visit") return `$${(a.billingAmount ?? a.annualValue).toLocaleString()}/visit`;
    if (per === "upfront")   return `$${a.annualValue.toLocaleString()} upfront`;
  }
  if (a.billingFrequency === "Monthly")   return `$${(a.annualValue / 12).toLocaleString()}/mo`;
  if (a.billingFrequency === "Quarterly") return `$${(a.annualValue / 4).toLocaleString()}/qtr`;
  return `$${a.annualValue.toLocaleString()}/yr`;
}

// ════════════════════════════════════════════════════════════
// Builder snapshot fields + runtime store (created agreements)
// ════════════════════════════════════════════════════════════
// Built agreements snapshot the template data at creation time, so later
// template edits never change an existing active/signed agreement.

import { nextAgreementNumber } from "./settings";
import type { TemplateService, TemplateVisit, TemplateTerm, SectionKey } from "./templates";

// Optional, additive fields populated by the Agreement Builder. Existing seed
// records (and the list/detail/calendar views) keep working without them.
export interface AgreementBuilderSnapshot {
  number?: string;
  customerId?: string;
  propertyId?: string;                 // the linked service location/property
  propertyLabel?: string;
  contactName?: string;
  endDate?: string;
  coverage?: string[];                 // covered equipment/systems
  planLevel?: string;
  templateKey?: string;
  servicesDetailed?: TemplateService[];
  visitPlan?: TemplateVisit[];
  benefits?: string[];
  terms?: TemplateTerm[];
  exclusions?: string;
  sections?: SectionKey[];
  billingLabel?: string;               // true billing cadence label (e.g. "Per Visit")
  billingAmount?: number;              // amount per billing period
  billingTaxable?: boolean;
  firstBillingDate?: string;
  renewal?: { autoRenew: boolean; termMonths: number; noticeDays: number; priceIncreasePct: number };
}

// Augment the record type with the optional snapshot fields.
export interface CustomerAgreement extends AgreementBuilderSnapshot {}

const AGR_KEY = "crm-agreements-extra";
let _extra: CustomerAgreement[] | null = null;

function extraAgreements(): CustomerAgreement[] {
  if (_extra) return _extra;
  if (typeof window === "undefined") return [];
  try { const raw = localStorage.getItem(AGR_KEY); _extra = raw ? (JSON.parse(raw) as CustomerAgreement[]) : []; }
  catch { _extra = []; }
  return _extra;
}
function persistExtra(): void {
  try { localStorage.setItem(AGR_KEY, JSON.stringify(_extra ?? [])); } catch { /* ignore */ }
}

// Session-created agreements only (client-side). Server render returns [].
export function getSessionAgreements(): CustomerAgreement[] { return extraAgreements(); }
// All agreements (session-created first, then seed). Use in lists/calendar so
// built agreements surface everywhere.
export function getAllAgreements(): CustomerAgreement[] { return [...extraAgreements(), ...AGREEMENTS]; }
export function getAgreement(id: string): CustomerAgreement | undefined {
  return getAllAgreements().find(a => a.id === id);
}

// Delete a session agreement; delete all agreements for a set of customers
// (used when a company — and therefore its customers — is deleted).
export function deleteAgreement(id: string): void {
  _extra = extraAgreements().filter(a => a.id !== id);
  persistExtra();
}

// Patch a session agreement (e.g. customizing a template-created agreement for
// one customer). Seed agreements aren't patched here (the prototype seed is empty).
export function updateAgreement(id: string, patch: Partial<CustomerAgreement>): CustomerAgreement | undefined {
  let updated: CustomerAgreement | undefined;
  _extra = extraAgreements().map(a => {
    if (a.id !== id) return a;
    updated = { ...a, ...patch };
    return updated;
  });
  if (updated) persistExtra();
  return updated;
}
export function deleteAgreementsForCustomers(customerIds: string[]): number {
  const set = new Set(customerIds);
  const matched = extraAgreements().filter(a => a.customerId && set.has(a.customerId));
  if (matched.length) {
    _extra = extraAgreements().filter(a => !(a.customerId && set.has(a.customerId)));
    persistExtra();
  }
  return matched.length;
}

// Agreements for an account — matches the linked customerId (set by the
// builder) and falls back to the denormalized customer name for seed records.
export function getAgreementsForCustomer(customerId: string, customerName?: string): CustomerAgreement[] {
  return getAllAgreements().filter(
    a => a.customerId === customerId || (!!customerName && a.customer === customerName),
  );
}

export interface NewAgreementInput {
  customerId: string;
  customer: string; customerInitials: string;
  location: string; assignedTo?: string;
  type: string; industry: Industry; templateId: string; templateKey?: string;
  planLevel?: string;
  startDate: string; endDate?: string; renewalDate: string;
  propertyId: string; propertyLabel?: string; contactName?: string;
  coverage?: string[];
  services: string[];                  // short labels (legacy display)
  servicesDetailed?: TemplateService[];
  visitPlan?: TemplateVisit[];
  visits?: AgreementVisit[];           // generated visits
  visitFrequency: VisitFrequency;
  billingFrequency: BillingFrequency;  // nearest legacy union member
  billingLabel?: string;               // true cadence label
  billingAmount?: number;
  billingTaxable?: boolean;
  firstBillingDate?: string;
  annualValue: number;
  benefits?: string[];
  terms?: TemplateTerm[];
  exclusions?: string;
  sections?: SectionKey[];
  renewal?: { autoRenew: boolean; termMonths: number; noticeDays: number; priceIncreasePct: number };
  status?: AgreementStatus;
  notes?: string;
}

// Create a customer agreement from builder output (snapshots template data).
export function createAgreement(input: NewAgreementInput): CustomerAgreement {
  const visits = input.visits ?? [];
  const nextVisit = nextPlannedDate(visits);
  const agreement: CustomerAgreement = {
    id: `agr-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
    number: nextAgreementNumber(),
    templateId: input.templateId, templateKey: input.templateKey,
    customerId: input.customerId,
    customer: input.customer, customerInitials: input.customerInitials,
    type: input.type, industry: input.industry,
    status: input.status ?? "active",
    location: input.location, assignedTo: input.assignedTo || "Unassigned",
    startDate: input.startDate, endDate: input.endDate, renewalDate: input.renewalDate,
    nextVisit,
    billingFrequency: input.billingFrequency, visitFrequency: input.visitFrequency,
    billingLabel: input.billingLabel, billingAmount: input.billingAmount, billingTaxable: input.billingTaxable,
    firstBillingDate: input.firstBillingDate,
    annualValue: input.annualValue,
    services: input.services,
    servicesDetailed: input.servicesDetailed,
    visitPlan: input.visitPlan,
    propertyId: input.propertyId, propertyLabel: input.propertyLabel, contactName: input.contactName,
    coverage: input.coverage, planLevel: input.planLevel,
    benefits: input.benefits, terms: input.terms, exclusions: input.exclusions,
    sections: input.sections, renewal: input.renewal,
    notes: input.notes ?? "",
    visits,
  };
  _extra = [agreement, ...extraAgreements()];
  persistExtra();
  return agreement;
}

// ─── Visit → job materialization (lazy scheduling) ────────
// An agreement holds the visit PLAN; a visit becomes a real, dispatchable job
// only when it's scheduled. The job then rides the standard job lifecycle, and
// on completion writes back to the visit (completeAgreementVisitForJob, called
// from lib/jobs/lifecycle). NOTE: write-backs persist for session-created
// agreements (the seed array isn't patched — see updateAgreement).

function visitInitials(name: string): string {
  const p = name.replace(/\(.*\)/, "").trim().split(/\s+/);
  return (p.length >= 2 ? p[0][0] + p[p.length - 1][0] : name.slice(0, 2)).toUpperCase();
}

function nextPlannedDate(visits: AgreementVisit[]): string | null {
  return visits.find(v => v.status === "planned" || v.status === "scheduled")?.scheduled ?? null;
}

export interface MaterializeVisitCtx {
  companyId: string; locationId: string; serviceAreaId?: string;
  scheduledDate?: string; scheduledTime?: string; assignedTo?: string;
  durationMinutes?: number;
}

// Turn a planned visit into a dispatchable job and link the two.
export function materializeVisitJob(agreementId: string, visitId: string, ctx: MaterializeVisitCtx): { job?: Job; error?: string } {
  const agreement = getAgreement(agreementId);
  if (!agreement) return { error: "Agreement not found." };
  const visit = agreement.visits.find(v => v.id === visitId);
  if (!visit) return { error: "Visit not found." };
  if (visit.jobId && getJob(visit.jobId)) return { error: "This visit already has a job." };

  const tech = (ctx.assignedTo ?? (agreement.assignedTo && agreement.assignedTo !== "Unassigned" ? agreement.assignedTo : "")) || "";
  const date = ctx.scheduledDate ?? visit.scheduled ?? "";

  const job = createJob({
    companyId: ctx.companyId, locationId: ctx.locationId, serviceAreaId: ctx.serviceAreaId,
    accountId: agreement.customerId ?? "",
    customerName: agreement.customer, customerInitials: agreement.customerInitials,
    locationName: agreement.location,
    title: `${agreement.type} — ${visit.label}`,
    type: "maintenance",
    scheduledDate: date, scheduledTime: ctx.scheduledTime, durationMinutes: ctx.durationMinutes,
    assignedTo: tech, assignedToInitials: tech ? visitInitials(tech) : "",
    dispatchType: "agreement_visit", sourceModule: "agreements", sourceRefId: visitId,
  });
  // createJob doesn't carry agreementId — link it so completion can write back.
  updateJob(job.id, { agreementId });

  const visits = agreement.visits.map(v =>
    v.id === visitId
      ? { ...v, status: "scheduled" as VisitStatus, jobId: job.id, scheduled: date || v.scheduled, tech: tech || v.tech }
      : v,
  );
  updateAgreement(agreementId, { visits, nextVisit: nextPlannedDate(visits) });
  return { job };
}

// Keep a booked visit's plan date in step with its job. When an agreement-sourced
// job is moved or reassigned on the dispatch board, mirror the new date + tech onto
// the linked visit (only while it's still open/scheduled — completed/missed visits
// are historical). No-op for plain jobs (no agreementId/sourceRefId), so callers can
// fire it after any updateJob unconditionally.
export function syncAgreementVisitFromJob(job: { agreementId?: string; sourceRefId?: string; scheduledDate?: string; assignedTo?: string }): void {
  if (!job.agreementId || !job.sourceRefId) return;
  const agreement = getAgreement(job.agreementId);
  if (!agreement) return;
  let changed = false;
  const visits = agreement.visits.map(v => {
    if (v.id !== job.sourceRefId || v.status !== "scheduled") return v;
    const scheduled = job.scheduledDate || v.scheduled;
    const tech = job.assignedTo || v.tech;
    if (scheduled === v.scheduled && tech === v.tech) return v;
    changed = true;
    return { ...v, scheduled, tech };
  });
  if (changed) updateAgreement(job.agreementId, { visits, nextVisit: nextPlannedDate(visits) });
}

// Called by the job lifecycle when an agreement-sourced job completes: flips the
// linked visit to completed and advances the agreement's nextVisit.
export function completeAgreementVisitForJob(job: { agreementId?: string; sourceRefId?: string; completedDate?: string }): void {
  if (!job.agreementId || !job.sourceRefId) return;
  const agreement = getAgreement(job.agreementId);
  if (!agreement) return;
  const done = job.completedDate ?? new Date().toISOString().slice(0, 10);
  const visits = agreement.visits.map(v =>
    v.id === job.sourceRefId ? { ...v, status: "completed" as VisitStatus, completedDate: done } : v,
  );
  updateAgreement(job.agreementId, { visits, nextVisit: nextPlannedDate(visits) });
}

// Planned visits still needing a job — the dispatcher's "Visits to schedule"
// queue. Skips canceled agreements and already-materialized visits.
export function getVisitsToSchedule(): { agreement: CustomerAgreement; visit: AgreementVisit }[] {
  const out: { agreement: CustomerAgreement; visit: AgreementVisit }[] = [];
  for (const a of getAllAgreements()) {
    if (a.status === "canceled") continue;
    for (const v of a.visits) {
      if (v.status === "planned" && !v.jobId) out.push({ agreement: a, visit: v });
    }
  }
  return out;
}
