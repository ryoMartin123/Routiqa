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

// A reusable agreement service — the library you load into a template's
// "Included Services". Templates snapshot the name/description at build time.
export interface AgreementService {
  id: string; name: string; description?: string;
  active: boolean; order: number;
}

// A visit cadence. visitsPerYear drives how many visits the builder seeds.
export interface VisitRule {
  id: string; name: string; key: string;
  visitsPerYear: number;        // monthly 12 · quarterly 4 · semi-annual 2 · annual 1 · custom 0
  defaultDurationMin: number;
  active: boolean; order: number;
}

// A billing cadence. periodsPerYear drives the per-period amount display.
export interface BillingRule {
  id: string; name: string; key: string;
  periodsPerYear: number;       // monthly 12 · quarterly 4 · annual 1 · per-visit/upfront/custom 0
  active: boolean; order: number;
}

export type BenefitKind = "priority" | "discount" | "fee_waiver" | "diagnostic" | "custom";
export interface Benefit {
  id: string; label: string; kind: BenefitKind;
  value?: string;               // e.g. "15%", "$0 diagnostic"
  active: boolean; order: number;
}

export interface TermsBlock {
  id: string; title: string; body: string;
  active: boolean; order: number;
}

export interface RenewalRule {
  id: string; name: string;
  autoRenew: boolean;
  termMonths: number;           // length of each term
  noticeDays: number;           // cancellation/renewal notice window
  priceIncreasePct: number;     // applied on renewal
  active: boolean; order: number;
}

export interface NumberingSettings {
  prefix: string;               // e.g. "AGR"
  nextSeq: number;
  padding: number;              // zero-pad width
}

export const BENEFIT_KIND_LABELS: Record<BenefitKind, string> = {
  priority: "Priority Scheduling", discount: "Repair Discount",
  fee_waiver: "Fee Waiver", diagnostic: "Diagnostic", custom: "Custom",
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

const DEFAULT_SERVICES: AgreementService[] = [
  { id: "as-1", name: "Spring Tune-up",       description: "Seasonal inspection, cleaning, and performance check.", active: true, order: 1 },
  { id: "as-2", name: "Fall Tune-up",         description: "Pre-winter inspection, cleaning, and safety check.",    active: true, order: 2 },
  { id: "as-3", name: "Filter Replacement",   description: "Replace standard air filters.",                         active: true, order: 3 },
  { id: "as-4", name: "Quarterly Inspection", description: "Routine inspection of covered equipment/systems.",       active: true, order: 4 },
  { id: "as-5", name: "Coil Cleaning",        description: "Clean evaporator and condenser coils.",                  active: true, order: 5 },
  { id: "as-6", name: "Drain Cleaning",       description: "Clear and flush primary drain lines.",                   active: true, order: 6 },
  { id: "as-7", name: "Water Heater Check",   description: "Inspect and test water heater operation.",               active: true, order: 7 },
  { id: "as-8", name: "Gutter Cleaning",      description: "Clear gutters and downspouts; check flow.",              active: true, order: 8 },
  { id: "as-9", name: "Photo Report",         description: "Documented photo report of the visit.",                  active: true, order: 9 },
  { id: "as-10", name: "Priority Dispatch",   description: "Front-of-queue scheduling for service calls.",           active: true, order: 10 },
];

const DEFAULT_VISIT_RULES: VisitRule[] = [
  { id: "vr-1", name: "Monthly",      key: "monthly",      visitsPerYear: 12, defaultDurationMin: 60, active: true, order: 1 },
  { id: "vr-2", name: "Quarterly",    key: "quarterly",    visitsPerYear: 4,  defaultDurationMin: 90, active: true, order: 2 },
  { id: "vr-3", name: "Semi-annual",  key: "semi_annual",  visitsPerYear: 2,  defaultDurationMin: 90, active: true, order: 3 },
  { id: "vr-4", name: "Annual",       key: "annual",       visitsPerYear: 1,  defaultDurationMin: 120,active: true, order: 4 },
  { id: "vr-5", name: "Custom",       key: "custom",       visitsPerYear: 0,  defaultDurationMin: 90, active: true, order: 5 },
];

const DEFAULT_BILLING_RULES: BillingRule[] = [
  { id: "br-1", name: "Monthly",   key: "monthly",   periodsPerYear: 12, active: true, order: 1 },
  { id: "br-2", name: "Quarterly", key: "quarterly", periodsPerYear: 4,  active: true, order: 2 },
  { id: "br-3", name: "Annual",    key: "annual",    periodsPerYear: 1,  active: true, order: 3 },
  { id: "br-4", name: "Per Visit", key: "per_visit", periodsPerYear: 0,  active: true, order: 4 },
  { id: "br-5", name: "Upfront",   key: "upfront",   periodsPerYear: 0,  active: true, order: 5 },
  { id: "br-6", name: "Custom",    key: "custom",    periodsPerYear: 0,  active: true, order: 6 },
];

const DEFAULT_BENEFITS: Benefit[] = [
  { id: "bn-1", label: "Priority Scheduling",      kind: "priority",   value: "Front of queue", active: true, order: 1 },
  { id: "bn-2", label: "Repair Discount",          kind: "discount",   value: "15%",            active: true, order: 2 },
  { id: "bn-3", label: "No Overtime Fee",          kind: "fee_waiver", value: "Waived",         active: true, order: 3 },
  { id: "bn-4", label: "Free Diagnostic",          kind: "diagnostic", value: "$0",             active: true, order: 4 },
  { id: "bn-5", label: "Waived Trip Charge",       kind: "fee_waiver", value: "Waived",         active: true, order: 5 },
];

const DEFAULT_TERMS: TermsBlock[] = [
  { id: "tb-1", title: "Scope of Coverage",   body: "This agreement covers the services and visits listed herein for the covered equipment/systems at the service location identified above.", active: true, order: 1 },
  { id: "tb-2", title: "Exclusions",          body: "Parts, refrigerant, and repairs beyond the included scope are billed separately at the member discount rate. Pre-existing conditions are excluded.", active: true, order: 2 },
  { id: "tb-3", title: "Cancellation",        body: "Either party may cancel with 30 days written notice. Prepaid, unused visits are refundable on a pro-rata basis.", active: true, order: 3 },
  { id: "tb-4", title: "Renewal",             body: "This agreement renews automatically for successive terms unless canceled per the cancellation terms. Pricing may be adjusted at renewal.", active: true, order: 4 },
];

const DEFAULT_RENEWAL_RULES: RenewalRule[] = [
  { id: "rr-1", name: "Auto-renew Annually", autoRenew: true,  termMonths: 12, noticeDays: 30, priceIncreasePct: 0, active: true, order: 1 },
  { id: "rr-2", name: "Manual Renewal",      autoRenew: false, termMonths: 12, noticeDays: 30, priceIncreasePct: 0, active: true, order: 2 },
  { id: "rr-3", name: "Auto-renew + 5%",     autoRenew: true,  termMonths: 12, noticeDays: 30, priceIncreasePct: 5, active: true, order: 3 },
];

const DEFAULT_NUMBERING: NumberingSettings = { prefix: "AGR", nextSeq: 1001, padding: 4 };

// ─── Storage ──────────────────────────────────────────────
const TYPE_KEY    = "crm-agr-types";
const SERVICE_KEY = "crm-agr-services";
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
let _services: AgreementService[] | null = null;
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

// Services (the library loaded into template "Included Services")
export function getAgreementServices(): AgreementService[] { if (!_services) _services = read(SERVICE_KEY, DEFAULT_SERVICES); return sortOrder(_services); }
export function saveAgreementServices(list: AgreementService[]): void { _services = reorder(list); write(SERVICE_KEY, _services); }

// Visit rules
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
