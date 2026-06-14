// Agreement Settings — reusable defaults for Settings → Agreements.
// localStorage-backed CRUD mirroring the Work Order Templates pattern
// (seed defaults + a cached runtime list, merged on read). Replace with
// Supabase queries when ready.
//
// These are *defaults*: the Agreement Builder copies the relevant values into
// each customer agreement at creation time, so later edits here never change
// existing active/signed agreements.

import type { Industry } from "./data";

// ─── Types ────────────────────────────────────────────────
export interface AgreementType {
  id: string; name: string; key: string;
  industry: Industry; description: string;
  active: boolean; order: number;
}

// ─── Service Scope (engine: "what we do") ─────────────────
// The vocabulary for individual services. Reusable service *groups* live in
// lib/agreements/template-library.ts (ServiceScopeTemplate); the service line
// shape itself is TemplateService in lib/agreements/templates.ts.
export type ServiceScopeType =
  | "included" | "discounted" | "optional_addon"
  | "covered_item" | "excluded" | "allowance";
export type ServiceApplies = "per_visit" | "per_term";

// ─── Visit Schedule (engine: "when we go") ────────────────
export type VisitCadence =
  | "no_visits" | "one_time" | "monthly" | "quarterly" | "semi_annual"
  | "annual" | "seasonal" | "on_demand" | "custom";

// A visit cadence. visitsPerYear drives how many visits the builder seeds.
export interface VisitRule {
  id: string; name: string; key: string;
  cadenceKind?: VisitCadence;   // semantic cadence (no_visits/one_time/…/on_demand/custom)
  visitsPerYear: number;        // monthly 12 · quarterly 4 · semi-annual 2 · annual 1 · one-time 1 · none/on-demand 0
  defaultDurationMin: number;
  active: boolean; order: number;
}

// ─── Billing Rules (engine: "how customer pays") ──────────
// A billing cadence. periodsPerYear drives the per-period amount display.
export interface BillingRule {
  id: string; name: string; key: string;
  periodsPerYear: number;       // monthly 12 · quarterly 4 · annual 1 · per-visit/upfront/one-time/no-billing/custom 0
  active: boolean; order: number;
}

// Payment terms — a small fixed list (constant, not full CRUD yet).
export const PAYMENT_TERMS: { key: string; label: string }[] = [
  { key: "due_on_receipt", label: "Due on receipt" },
  { key: "net_15",         label: "Net 15" },
  { key: "net_30",         label: "Net 30" },
];

// ─── Benefits ─────────────────────────────────────────────
export type BenefitKind =
  | "discount" | "priority" | "fee_waiver" | "included_report"
  | "warranty" | "credit_allowance" | "access_membership" | "custom";
export interface Benefit {
  id: string; label: string; kind: BenefitKind;
  description?: string;
  value?: string;               // e.g. "15%", "$0 diagnostic"
  appliesTo?: string;           // e.g. "All visits", "Repairs"
  limit?: string;               // e.g. "2 per year"
  active: boolean; order: number;
}

// ─── Terms (engine: reusable legal/customer-facing blocks) ─
export type TermType =
  | "payment" | "renewal" | "cancellation" | "exclusions" | "warranty"
  | "access" | "scheduling" | "liability" | "customer_responsibility" | "custom";
export interface TermsBlock {
  id: string; title: string; body: string;
  termType?: TermType;
  appliesToTypeKeys?: string[]; // which agreement types this applies to (empty = all)
  required?: boolean;           // must appear on the agreement
  editable?: boolean;           // can be edited per-agreement (default true)
  active: boolean; order: number;
}

// ─── Renewals (engine: what happens at term end) ──────────
export type RenewalType =
  | "no_renewal" | "manual" | "auto_same"
  | "auto_increase" | "quote_required" | "month_to_month";
export interface RenewalRule {
  id: string; name: string;
  renewalType?: RenewalType;
  autoRenew: boolean;           // derived from renewalType (auto_same/auto_increase/month_to_month)
  termMonths: number;           // length of each term
  noticeDays: number;           // cancellation/renewal notice window
  reminderDays?: number;        // when to remind ahead of renewal
  priceIncreasePct: number;     // applied on renewal
  priceIncreaseType?: "pct" | "flat";
  approvalRequired?: boolean;
  generateTask?: boolean;       // create a renewal task
  generateQuote?: boolean;      // create a renewal quote/agreement
  active: boolean; order: number;
}

export interface NumberingSettings {
  prefix: string;               // e.g. "AGR"
  nextSeq: number;
  padding: number;              // zero-pad width
}

// ─── Label maps (shared by settings UI + builder) ─────────
export const BENEFIT_KIND_LABELS: Record<BenefitKind, string> = {
  discount: "Discount", priority: "Priority", fee_waiver: "Fee Waiver",
  included_report: "Included Report", warranty: "Warranty",
  credit_allowance: "Credit / Allowance", access_membership: "Access / Membership Perk",
  custom: "Custom",
};

export const SERVICE_SCOPE_LABELS: Record<ServiceScopeType, string> = {
  included: "Included Service", discounted: "Discounted Service",
  optional_addon: "Optional Add-on", covered_item: "Covered Item / System",
  excluded: "Excluded Service", allowance: "Allowance / Credit",
};

export const SERVICE_APPLIES_LABELS: Record<ServiceApplies, string> = {
  per_visit: "Per visit", per_term: "Per agreement term",
};

export const VISIT_CADENCE_LABELS: Record<VisitCadence, string> = {
  no_visits: "No Visits", one_time: "One-time", monthly: "Monthly",
  quarterly: "Quarterly", semi_annual: "Semi-annual", annual: "Annual",
  seasonal: "Seasonal", on_demand: "On-demand", custom: "Custom Schedule",
};

export const TERM_TYPE_LABELS: Record<TermType, string> = {
  payment: "Payment", renewal: "Renewal", cancellation: "Cancellation",
  exclusions: "Exclusions", warranty: "Warranty", access: "Access",
  scheduling: "Scheduling", liability: "Liability",
  customer_responsibility: "Customer Responsibility", custom: "Custom",
};

export const RENEWAL_TYPE_LABELS: Record<RenewalType, string> = {
  no_renewal: "No renewal / expires", manual: "Manual renewal",
  auto_same: "Auto-renew same terms", auto_increase: "Auto-renew with price increase",
  quote_required: "Renewal quote required", month_to_month: "Month-to-month after term",
};

// ─── Seed defaults ────────────────────────────────────────
const DEFAULT_TYPES: AgreementType[] = [
  { id: "at-1", name: "Residential Maintenance", key: "residential_maintenance", industry: "HVAC",                description: "Recurring tune-ups for residential systems.",        active: true, order: 1 },
  { id: "at-2", name: "Commercial PM",           key: "commercial_pm",           industry: "HVAC",                description: "Preventive maintenance for commercial sites.",        active: true, order: 2 },
  { id: "at-3", name: "Inspection Plan",          key: "inspection_plan",         industry: "Roofing",             description: "Scheduled inspection coverage.",                      active: true, order: 3 },
  { id: "at-4", name: "Membership",               key: "membership",              industry: "Plumbing",            description: "Recurring membership with priority access.",          active: true, order: 4 },
  { id: "at-5", name: "Maintenance Contract",     key: "maintenance_contract",    industry: "Property Maintenance",description: "Ongoing property maintenance coverage.",              active: true, order: 5 },
  { id: "at-6", name: "Service Agreement",        key: "service_agreement",       industry: "General",             description: "General recurring service agreement.",                active: true, order: 6 },
];

const DEFAULT_VISIT_RULES: VisitRule[] = [
  { id: "vr-1", name: "No Visits",    key: "no_visits",    cadenceKind: "no_visits",   visitsPerYear: 0,  defaultDurationMin: 0,  active: true, order: 1 },
  { id: "vr-2", name: "One-time",     key: "one_time",     cadenceKind: "one_time",    visitsPerYear: 1,  defaultDurationMin: 90, active: true, order: 2 },
  { id: "vr-3", name: "Monthly",      key: "monthly",      cadenceKind: "monthly",     visitsPerYear: 12, defaultDurationMin: 60, active: true, order: 3 },
  { id: "vr-4", name: "Quarterly",    key: "quarterly",    cadenceKind: "quarterly",   visitsPerYear: 4,  defaultDurationMin: 90, active: true, order: 4 },
  { id: "vr-5", name: "Semi-annual",  key: "semi_annual",  cadenceKind: "semi_annual", visitsPerYear: 2,  defaultDurationMin: 90, active: true, order: 5 },
  { id: "vr-6", name: "Annual",       key: "annual",       cadenceKind: "annual",      visitsPerYear: 1,  defaultDurationMin: 120,active: true, order: 6 },
  { id: "vr-7", name: "Seasonal",     key: "seasonal",     cadenceKind: "seasonal",    visitsPerYear: 2,  defaultDurationMin: 90, active: true, order: 7 },
  { id: "vr-8", name: "On-demand",    key: "on_demand",    cadenceKind: "on_demand",   visitsPerYear: 0,  defaultDurationMin: 90, active: true, order: 8 },
  { id: "vr-9", name: "Custom",       key: "custom",       cadenceKind: "custom",      visitsPerYear: 0,  defaultDurationMin: 90, active: true, order: 9 },
];

const DEFAULT_BILLING_RULES: BillingRule[] = [
  { id: "br-1", name: "No Billing", key: "no_billing", periodsPerYear: 0,  active: true, order: 1 },
  { id: "br-2", name: "One-time",   key: "one_time",   periodsPerYear: 0,  active: true, order: 2 },
  { id: "br-3", name: "Monthly",    key: "monthly",    periodsPerYear: 12, active: true, order: 3 },
  { id: "br-4", name: "Quarterly",  key: "quarterly",  periodsPerYear: 4,  active: true, order: 4 },
  { id: "br-5", name: "Annual",     key: "annual",     periodsPerYear: 1,  active: true, order: 5 },
  { id: "br-6", name: "Per Visit",  key: "per_visit",  periodsPerYear: 0,  active: true, order: 6 },
  { id: "br-7", name: "Upfront",    key: "upfront",    periodsPerYear: 0,  active: true, order: 7 },
  { id: "br-8", name: "Custom",     key: "custom",     periodsPerYear: 0,  active: true, order: 8 },
];

const DEFAULT_BENEFITS: Benefit[] = [
  { id: "bn-1", label: "Priority Scheduling",      kind: "priority",         value: "Front of queue", appliesTo: "All service calls", active: true, order: 1 },
  { id: "bn-2", label: "Repair Discount",          kind: "discount",         value: "15%",            appliesTo: "Repairs",            active: true, order: 2 },
  { id: "bn-3", label: "No Overtime Fee",          kind: "fee_waiver",       value: "Waived",         appliesTo: "After-hours",        active: true, order: 3 },
  { id: "bn-4", label: "Free Diagnostic",          kind: "fee_waiver",       value: "$0",             appliesTo: "Service calls",      active: true, order: 4 },
  { id: "bn-5", label: "Waived Trip Charge",       kind: "fee_waiver",       value: "Waived",         appliesTo: "Service calls",      active: true, order: 5 },
  { id: "bn-6", label: "Annual Inspection Report", kind: "included_report",  value: "Included",       appliesTo: "Annually",           active: true, order: 6 },
];

const DEFAULT_TERMS: TermsBlock[] = [
  { id: "tb-1", title: "Scope of Coverage",   termType: "custom",       required: true,  editable: true, body: "This agreement covers the services and visits listed herein for the covered equipment/systems at the service location identified above.", active: true, order: 1 },
  { id: "tb-2", title: "Exclusions",          termType: "exclusions",   required: false, editable: true, body: "Parts, refrigerant, and repairs beyond the included scope are billed separately at the member discount rate. Pre-existing conditions are excluded.", active: true, order: 2 },
  { id: "tb-3", title: "Cancellation",        termType: "cancellation", required: true,  editable: true, body: "Either party may cancel with 30 days written notice. Prepaid, unused visits are refundable on a pro-rata basis.", active: true, order: 3 },
  { id: "tb-4", title: "Renewal",             termType: "renewal",      required: true,  editable: true, body: "This agreement renews automatically for successive terms unless canceled per the cancellation terms. Pricing may be adjusted at renewal.", active: true, order: 4 },
];

const DEFAULT_RENEWAL_RULES: RenewalRule[] = [
  { id: "rr-1", name: "Auto-renew Annually", renewalType: "auto_same",     autoRenew: true,  termMonths: 12, noticeDays: 30, reminderDays: 45, priceIncreasePct: 0, priceIncreaseType: "pct", approvalRequired: false, generateTask: true,  generateQuote: false, active: true, order: 1 },
  { id: "rr-2", name: "Manual Renewal",      renewalType: "manual",        autoRenew: false, termMonths: 12, noticeDays: 30, reminderDays: 45, priceIncreasePct: 0, priceIncreaseType: "pct", approvalRequired: true,  generateTask: true,  generateQuote: false, active: true, order: 2 },
  { id: "rr-3", name: "Auto-renew + 5%",     renewalType: "auto_increase", autoRenew: true,  termMonths: 12, noticeDays: 30, reminderDays: 45, priceIncreasePct: 5, priceIncreaseType: "pct", approvalRequired: false, generateTask: true,  generateQuote: false, active: true, order: 3 },
];

const DEFAULT_NUMBERING: NumberingSettings = { prefix: "AGR", nextSeq: 1001, padding: 4 };

// ─── Storage ──────────────────────────────────────────────
const TYPE_KEY    = "crm-agr-types";
const VISIT_KEY   = "crm-agr-visit-rules";
const BILL_KEY    = "crm-agr-billing-rules";
const BENEFIT_KEY = "crm-agr-benefits";
const TERMS_KEY   = "crm-agr-terms";
const RENEWAL_KEY = "crm-agr-renewal-rules";
const NUMBER_KEY  = "crm-agr-numbering";

function read<T>(key: string, fallback: T[]): T[] {
  if (typeof window === "undefined") return [...fallback];
  try { const raw = localStorage.getItem(key); return raw ? (JSON.parse(raw) as T[]) : [...fallback]; }
  catch { return [...fallback]; }
}
function write<T>(key: string, value: T[]): void {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* ignore */ }
}
function readObj<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return { ...fallback };
  try { const raw = localStorage.getItem(key); return raw ? (JSON.parse(raw) as T) : { ...fallback }; }
  catch { return { ...fallback }; }
}
function writeObj<T>(key: string, value: T): void {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* ignore */ }
}

// Cached runtime lists
let _types: AgreementType[] | null = null;
let _visit: VisitRule[] | null = null;
let _bill: BillingRule[] | null = null;
let _benefits: Benefit[] | null = null;
let _terms: TermsBlock[] | null = null;
let _renewal: RenewalRule[] | null = null;

const sortOrder = <T extends { order: number }>(l: T[]) => [...l].sort((a, b) => a.order - b.order);
const reorder = <T extends { order: number }>(l: T[]) => sortOrder(l).map((x, i) => ({ ...x, order: i + 1 }));

// Types
export function getAgreementTypes(): AgreementType[] { if (!_types) _types = read(TYPE_KEY, DEFAULT_TYPES); return sortOrder(_types); }
export function saveAgreementTypes(list: AgreementType[]): void { _types = reorder(list); write(TYPE_KEY, _types); }

// Visit rules — the internal frequency-type list (cadence → visits/year) that
// powers visit generation. No longer a user-editable tab; surfaced as the
// "frequency" options inside Visit Schedule Templates and the Agreement Builder.
export function getVisitRules(): VisitRule[] { if (!_visit) _visit = read(VISIT_KEY, DEFAULT_VISIT_RULES); return sortOrder(_visit); }
export function saveVisitRules(list: VisitRule[]): void { _visit = reorder(list); write(VISIT_KEY, _visit); }

// Billing rules
export function getBillingRules(): BillingRule[] { if (!_bill) _bill = read(BILL_KEY, DEFAULT_BILLING_RULES); return sortOrder(_bill); }
export function saveBillingRules(list: BillingRule[]): void { _bill = reorder(list); write(BILL_KEY, _bill); }

// Benefits
export function getBenefits(): Benefit[] { if (!_benefits) _benefits = read(BENEFIT_KEY, DEFAULT_BENEFITS); return sortOrder(_benefits); }
export function saveBenefits(list: Benefit[]): void { _benefits = reorder(list); write(BENEFIT_KEY, _benefits); }

// Terms blocks
export function getTermsBlocks(): TermsBlock[] { if (!_terms) _terms = read(TERMS_KEY, DEFAULT_TERMS); return sortOrder(_terms); }
export function saveTermsBlocks(list: TermsBlock[]): void { _terms = reorder(list); write(TERMS_KEY, _terms); }

// Renewal rules
export function getRenewalRules(): RenewalRule[] { if (!_renewal) _renewal = read(RENEWAL_KEY, DEFAULT_RENEWAL_RULES); return sortOrder(_renewal); }
export function saveRenewalRules(list: RenewalRule[]): void { _renewal = reorder(list); write(RENEWAL_KEY, _renewal); }

// Numbering
export function getNumbering(): NumberingSettings { return readObj(NUMBER_KEY, DEFAULT_NUMBERING); }
export function saveNumbering(n: NumberingSettings): void { writeObj(NUMBER_KEY, n); }

// Generate the next agreement number and advance the sequence.
export function nextAgreementNumber(): string {
  const n = getNumbering();
  const num = `${n.prefix}-${String(n.nextSeq).padStart(n.padding, "0")}`;
  saveNumbering({ ...n, nextSeq: n.nextSeq + 1 });
  return num;
}

// ─── Helpers ──────────────────────────────────────────────
export function agrId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`;
}
export function agrSlug(name: string): string {
  return name.toLowerCase().trim().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "").slice(0, 48);
}
