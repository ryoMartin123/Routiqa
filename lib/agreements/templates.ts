// Agreement (Plan) Templates — the rich, reusable template model that the
// Agreement Builder copies into each customer agreement. localStorage-backed
// CRUD mirroring the rest of the agreements settings.
//
// Templates are DEFAULTS. createAgreement() snapshots the relevant fields onto
// the customer agreement, so editing a template later never mutates existing
// active/signed agreements.

import type { Industry } from "./data";
import { agrId, agrSlug } from "./settings";
import type { ServiceScopeType, ServiceApplies, RenewalType } from "./settings";
import type { CustomVisitConfig, CustomBillingConfig } from "./custom-rules";

// ─── Document sections (Step 7 — customer-facing) ─────────
export type SectionKey =
  | "header" | "customer" | "coverage" | "included_services"
  | "visit_schedule" | "billing_terms" | "benefits"
  | "exclusions" | "cancellation" | "renewal" | "signature";

export const ALL_SECTIONS: { key: SectionKey; label: string }[] = [
  { key: "header",            label: "Header" },
  { key: "customer",          label: "Customer Info" },
  { key: "coverage",          label: "Coverage" },
  { key: "included_services", label: "Included Services" },
  { key: "visit_schedule",    label: "Visit Schedule" },
  { key: "billing_terms",     label: "Billing Terms" },
  { key: "benefits",          label: "Benefits" },
  { key: "exclusions",        label: "Exclusions" },
  { key: "cancellation",      label: "Cancellation Terms" },
  { key: "renewal",           label: "Renewal Terms" },
  { key: "signature",         label: "Approval / Signature" },
];

// ─── Building blocks ──────────────────────────────────────
// Service Scope item ("what we do"). `included`/`discountPct` are kept for the
// existing document preview and are derived from `scopeType` on new templates.
export interface TemplateService {
  id: string; name: string; description?: string;
  quantity: number;
  included: boolean;            // included vs. discounted add-on (legacy/preview)
  discountPct?: number;        // when not fully included
  scopeType?: ServiceScopeType; // included / discounted / add-on / covered / excluded / allowance
  applies?: ServiceApplies;     // per visit or per agreement term
  limit?: number;               // usage cap (allowances / add-ons)
  itemId?: string;              // linked catalog item (lib/items)
  workOrderTemplateId?: string; // linked checklist / work-order item
}

// Visit Schedule item ("when we go").
export interface TemplateVisit {
  id: string; name: string;
  frequencyKey: string;        // → VisitRule.key (lib/agreements/settings)
  preferredWindow?: string;    // e.g. "Spring", "March", "Q1"
  dueWindowDays?: number;      // ± window the visit is due within
  durationMin: number;
  jobTypeKey?: string;         // job type created when scheduled
  workOrderTemplateId?: string;// work-order template applied to the created job
  dispatchBoardId?: string;    // optional preferred dispatch board
  requirePhotos?: boolean;     // required photos on the visit
  requireChecklist?: boolean;  // required checklist on the visit
  autoGenerate?: boolean;      // auto-create planned visits (default true)
  customVisit?: CustomVisitConfig; // structured config when frequencyKey === "custom"
}

// Billing Rules item ("how customer pays"). Templates carry an array; the legacy
// single `billing` mirrors billingRules[0] so existing list/detail views work.
export interface TemplateBillingRule {
  id?: string;
  frequencyKey: string;        // → BillingRule.key
  amount: number;              // amount per billing period
  taxable: boolean;
  startDate?: string;          // billing start (defaults to agreement start)
  endDate?: string;            // optional billing end
  autoRenew?: boolean;
  paymentTermsKey?: string;    // → PAYMENT_TERMS.key
  deposit?: number;            // optional upfront deposit
  customBilling?: CustomBillingConfig; // structured config when frequencyKey === "custom"
}

// Legacy single-billing shape (kept; mirrors billingRules[0]).
export interface TemplateBilling {
  frequencyKey: string;
  amount: number;
  taxable: boolean;
}

export interface TemplateTerm {
  title: string; body: string;
  termType?: string;           // → TermType (lib/agreements/settings)
  required?: boolean;
  editable?: boolean;
}

export interface TemplateRenewal {
  renewalType?: RenewalType;
  autoRenew: boolean;
  termMonths: number;
  noticeDays: number;
  reminderDays?: number;
  priceIncreasePct: number;
  priceIncreaseType?: "pct" | "flat";
  approvalRequired?: boolean;
  generateTask?: boolean;
  generateQuote?: boolean;
}

export interface PlanTemplate {
  id: string; name: string; key: string;
  industry: Industry; typeKey: string;
  description: string;
  planLevel?: string;          // e.g. "Silver" / "Gold" (optional)
  services: TemplateService[];
  visits: TemplateVisit[];
  billing: TemplateBilling;        // legacy primary (mirrors billingRules[0])
  billingRules?: TemplateBillingRule[];
  benefits: string[];          // benefit labels (snapshot-friendly)
  terms: TemplateTerm[];       // snapshot of terms blocks
  renewal: TemplateRenewal;
  exclusions?: string;
  sections: SectionKey[];      // enabled customer-facing sections (in order)
  status: "active" | "draft" | "archived";
  active: boolean;
  order: number;
}

const DEFAULT_SECTIONS: SectionKey[] = ALL_SECTIONS.map(s => s.key);
const svc = (name: string, included = true, quantity = 1, discountPct?: number): TemplateService =>
  ({ id: agrId("ts"), name, quantity, included, discountPct,
     scopeType: included ? "included" : "discounted", applies: "per_visit" });
const vis = (name: string, frequencyKey: string, durationMin: number, preferredWindow?: string, jobTypeKey = "maintenance"): TemplateVisit =>
  ({ id: agrId("tv"), name, frequencyKey, durationMin, preferredWindow, jobTypeKey, autoGenerate: true });

const STD_TERMS: TemplateTerm[] = [
  { title: "Scope of Coverage", body: "This agreement covers the services and visits listed for the covered equipment/systems at the service location." },
  { title: "Exclusions",        body: "Parts and repairs beyond the included scope are billed at the member discount rate. Pre-existing conditions excluded." },
  { title: "Cancellation",      body: "Either party may cancel with 30 days written notice. Prepaid unused visits are refunded pro-rata." },
  { title: "Renewal",           body: "Renews automatically for successive terms unless canceled. Pricing may be adjusted at renewal." },
];
const STD_RENEWAL: TemplateRenewal = {
  renewalType: "auto_same", autoRenew: true, termMonths: 12, noticeDays: 30,
  reminderDays: 45, priceIncreasePct: 0, priceIncreaseType: "pct",
  approvalRequired: false, generateTask: true, generateQuote: false,
};

// Mirror a template's legacy single `billing` into the billingRules[] array
// (and back-fill the legacy field from rules[0]). Also ensures renewal carries a
// renewalType. Run on every read so old localStorage templates upgrade in place.
function normalizeTemplate(t: PlanTemplate): PlanTemplate {
  const billingRules: TemplateBillingRule[] =
    t.billingRules && t.billingRules.length
      ? t.billingRules
      : [{ id: agrId("tbr"), frequencyKey: t.billing.frequencyKey, amount: t.billing.amount, taxable: t.billing.taxable }];
  const primary = billingRules[0];
  const renewal: TemplateRenewal = {
    ...t.renewal,
    renewalType: t.renewal.renewalType ?? (t.renewal.autoRenew ? (t.renewal.priceIncreasePct ? "auto_increase" : "auto_same") : "manual"),
  };
  return {
    ...t,
    billingRules,
    billing: { frequencyKey: primary.frequencyKey, amount: primary.amount, taxable: primary.taxable },
    renewal,
  };
}

// ─── 7 industry seed templates ────────────────────────────
export const DEFAULT_PLAN_TEMPLATES: PlanTemplate[] = [
  {
    id: "pt-1", name: "HVAC Residential Maintenance", key: "hvac_residential_maintenance",
    industry: "HVAC", typeKey: "residential_maintenance",
    description: "Spring and fall tune-ups with filter changes and priority dispatch for residential HVAC systems.",
    services: [svc("Spring tune-up"), svc("Fall tune-up"), svc("Filter replacement"), svc("Repair discount", false, 1, 15)],
    visits: [vis("Spring Tune-up", "semi_annual", 90, "Spring"), vis("Fall Tune-up", "semi_annual", 90, "Fall")],
    billing: { frequencyKey: "annual", amount: 349, taxable: false },
    benefits: ["Priority Scheduling", "Repair Discount", "No Overtime Fee"],
    terms: STD_TERMS, renewal: STD_RENEWAL,
    exclusions: "Refrigerant, parts, and major repairs are billed separately at the member rate.",
    sections: DEFAULT_SECTIONS, status: "active", active: true, order: 1,
  },
  {
    id: "pt-2", name: "HVAC Commercial Quarterly PM", key: "hvac_commercial_quarterly_pm",
    industry: "HVAC", typeKey: "commercial_pm",
    description: "Quarterly preventive maintenance for commercial HVAC systems with detailed service reports.",
    services: [svc("Quarterly inspection"), svc("Filter changes"), svc("Coil cleaning"), svc("Refrigerant check"), svc("Service reporting")],
    visits: [vis("Quarterly PM", "quarterly", 120, "Each quarter")],
    billing: { frequencyKey: "quarterly", amount: 300, taxable: false },
    benefits: ["Priority Scheduling", "No Overtime Fee", "Repair Discount"],
    terms: STD_TERMS, renewal: STD_RENEWAL,
    exclusions: "Compressor and major component replacement billed separately.",
    sections: DEFAULT_SECTIONS, status: "active", active: true, order: 2,
  },
  {
    id: "pt-3", name: "Roofing Annual Inspection", key: "roofing_annual_inspection",
    industry: "Roofing", typeKey: "inspection_plan",
    description: "Annual roof inspection with gutter cleaning, a photo report, and minor repair coverage.",
    services: [svc("Annual inspection"), svc("Gutter cleaning"), svc("Photo report"), svc("Minor repairs (1 hr)")],
    visits: [vis("Annual Inspection", "annual", 120, "Spring", "inspection")],
    billing: { frequencyKey: "annual", amount: 599, taxable: false },
    benefits: ["Storm Damage Priority", "Repair Discount"],
    terms: STD_TERMS, renewal: STD_RENEWAL,
    exclusions: "Full roof replacement and structural repairs are excluded.",
    sections: DEFAULT_SECTIONS, status: "active", active: true, order: 3,
  },
  {
    id: "pt-4", name: "Plumbing Membership", key: "plumbing_membership",
    industry: "Plumbing", typeKey: "membership",
    description: "Quarterly plumbing inspections, drain cleaning, and water-heater checks with emergency priority.",
    services: [svc("Quarterly inspection"), svc("Drain cleaning"), svc("Water heater check"), svc("Repair discount", false, 1, 15)],
    visits: [vis("Quarterly Inspection", "quarterly", 60, "Each quarter", "inspection")],
    billing: { frequencyKey: "quarterly", amount: 75, taxable: false },
    benefits: ["Emergency Priority", "Repair Discount", "Waived Trip Charge"],
    terms: STD_TERMS, renewal: STD_RENEWAL,
    sections: DEFAULT_SECTIONS, status: "active", active: true, order: 4,
  },
  {
    id: "pt-5", name: "Property Maintenance Agreement", key: "property_maintenance_agreement",
    industry: "Property Maintenance", typeKey: "maintenance_contract",
    description: "Monthly property walkthroughs, minor repairs, seasonal prep, and a 24-hour emergency line.",
    services: [svc("Monthly walkthrough"), svc("Minor repairs included"), svc("Seasonal prep"), svc("Quarterly property report")],
    visits: [vis("Monthly Walkthrough", "monthly", 60, "Each month")],
    billing: { frequencyKey: "monthly", amount: 200, taxable: false },
    benefits: ["24hr Emergency Line", "Dedicated Account Manager", "Priority Scheduling"],
    terms: STD_TERMS, renewal: STD_RENEWAL,
    sections: DEFAULT_SECTIONS, status: "active", active: true, order: 5,
  },
  {
    id: "pt-6", name: "General Service Agreement", key: "general_service_agreement",
    industry: "General", typeKey: "service_agreement",
    description: "A flexible recurring service agreement for any trade — configure visits, billing, and benefits.",
    services: [svc("Scheduled service visit")],
    visits: [vis("Service Visit", "quarterly", 90, "Each quarter", "maintenance")],
    billing: { frequencyKey: "quarterly", amount: 150, taxable: false },
    benefits: ["Priority Scheduling", "Repair Discount"],
    terms: STD_TERMS, renewal: STD_RENEWAL,
    sections: DEFAULT_SECTIONS, status: "active", active: true, order: 6,
  },
  {
    id: "pt-7", name: "Custom Agreement", key: "custom_agreement",
    industry: "General", typeKey: "service_agreement",
    description: "Start from a blank structure and build the agreement from scratch.",
    services: [], visits: [],
    billing: { frequencyKey: "annual", amount: 0, taxable: false },
    benefits: [], terms: STD_TERMS, renewal: STD_RENEWAL,
    sections: DEFAULT_SECTIONS, status: "active", active: true, order: 7,
  },
];

// ─── Storage ──────────────────────────────────────────────
const PT_KEY = "crm-agr-plan-templates";
let _templates: PlanTemplate[] | null = null;

function read(): PlanTemplate[] {
  if (typeof window === "undefined") return [...DEFAULT_PLAN_TEMPLATES];
  try { const raw = localStorage.getItem(PT_KEY); return raw ? (JSON.parse(raw) as PlanTemplate[]) : [...DEFAULT_PLAN_TEMPLATES]; }
  catch { return [...DEFAULT_PLAN_TEMPLATES]; }
}
function write(list: PlanTemplate[]): void {
  try { localStorage.setItem(PT_KEY, JSON.stringify(list)); } catch { /* ignore */ }
}

export function getPlanTemplates(): PlanTemplate[] {
  if (!_templates) _templates = read().map(normalizeTemplate);
  return [..._templates].sort((a, b) => a.order - b.order);
}
export function getPlanTemplate(id: string): PlanTemplate | undefined {
  return getPlanTemplates().find(t => t.id === id);
}
export function savePlanTemplates(list: PlanTemplate[]): void {
  const ordered = [...list].sort((a, b) => a.order - b.order).map((t, i) => ({ ...t, order: i + 1 }));
  _templates = ordered; write(ordered);
}
export function upsertPlanTemplate(t: PlanTemplate): void {
  const list = getPlanTemplates();
  const idx = list.findIndex(x => x.id === t.id);
  if (idx >= 0) { list[idx] = t; savePlanTemplates(list); }
  else { savePlanTemplates([...list, t]); }
}

export function blankPlanTemplate(): PlanTemplate {
  const max = getPlanTemplates().reduce((m, t) => Math.max(m, t.order), 0);
  return {
    id: agrId("pt"), name: "", key: "", industry: "General", typeKey: "service_agreement",
    description: "", services: [], visits: [],
    billing: { frequencyKey: "annual", amount: 0, taxable: false },
    billingRules: [{ id: agrId("tbr"), frequencyKey: "annual", amount: 0, taxable: false }],
    benefits: [], terms: STD_TERMS, renewal: STD_RENEWAL,
    sections: DEFAULT_SECTIONS, status: "draft", active: true, order: max + 1,
  };
}

export { agrId, agrSlug };
