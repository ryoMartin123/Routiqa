// ─── Agreements domain types + mock data ─────────────────
// Supports any service industry: HVAC, Roofing, Plumbing,
// Property Maintenance, Consulting, and more.
//
// Maps to future DB tables:
//   agreement_templates, customer_agreements,
//   agreement_visits, agreement_billing_events

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

export type VisitStatus = "scheduled" | "completed" | "missed";

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
  propertyLabel?: string; contactName?: string;
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
  const nextVisit = visits.find(v => v.status === "scheduled")?.scheduled ?? null;
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
    propertyLabel: input.propertyLabel, contactName: input.contactName,
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
