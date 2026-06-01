// Quote templates — the *second layer* of the Quotes module.
//
// A template is the default structure/layout used to create a quote record. It
// seeds the title, tax rate, and a starting set of line items (which the user
// then edits). Templates are intentionally data-only so a future "custom quote
// designer" can add/edit them without touching the wizard.
//
// Replace with a Supabase `quote_templates` table when ready; the shape mirrors
// what a row + its `template_items` would hold.

import type { LineItemCategory } from "./types";

export interface QuoteTemplateSeedItem {
  name: string;
  description?: string;
  quantity: number;
  unitPrice: number;
  category: LineItemCategory;
  taxable?: boolean;
  optional?: boolean;     // seeded as an optional add-on (not in the base total)
}

export interface QuoteTemplate {
  key: string;
  name: string;
  description: string;
  badge?: string;                 // short tag shown on the picker card
  titlePlaceholder: string;       // suggested quote title
  defaultTaxRate?: number;        // percent, e.g. 7 = 7%
  items: QuoteTemplateSeedItem[];
}

// ─── Default templates ────────────────────────────────────
export const QUOTE_TEMPLATES: QuoteTemplate[] = [
  {
    key: "standard_service",
    name: "Standard Service Quote",
    description: "A straightforward estimate for a single service or repair.",
    badge: "Most used",
    titlePlaceholder: "Service / Repair Estimate",
    items: [
      { name: "Diagnostic / Service Call", description: "On-site assessment and diagnosis", quantity: 1, unitPrice: 89,  category: "Labor",     taxable: false },
      { name: "Labor",                     description: "Repair labor (per hour)",          quantity: 2, unitPrice: 120, category: "Labor",     taxable: false },
      { name: "Materials",                 description: "Parts and materials",              quantity: 1, unitPrice: 0,   category: "Materials", taxable: true  },
    ],
  },
  {
    key: "good_better_best",
    name: "Good / Better / Best Quote",
    description: "Three tiers so the customer can choose their level of service.",
    badge: "Tiered",
    titlePlaceholder: "System Replacement — Options",
    items: [
      { name: "Good — Standard System",  description: "Builder-grade equipment, standard warranty",          quantity: 1, unitPrice: 5200, category: "Equipment", taxable: true },
      { name: "Better — Mid-Tier System", description: "Higher efficiency, extended warranty",                quantity: 1, unitPrice: 7400, category: "Equipment", taxable: true, optional: true },
      { name: "Best — Premium System",    description: "Top efficiency, premium warranty, smart controls",   quantity: 1, unitPrice: 9800, category: "Equipment", taxable: true, optional: true },
      { name: "Installation Labor",       description: "Full installation and haul-away",                     quantity: 1, unitPrice: 1400, category: "Labor",     taxable: false },
    ],
  },
  {
    key: "project",
    name: "Project Quote",
    description: "A phased, multi-line estimate for larger project work.",
    badge: "Multi-phase",
    titlePlaceholder: "Project Estimate",
    items: [
      { name: "Materials & Equipment", description: "All materials for the project scope", quantity: 1, unitPrice: 0, category: "Materials",     taxable: true  },
      { name: "Labor",                 description: "Project labor",                        quantity: 1, unitPrice: 0, category: "Labor",         taxable: false },
      { name: "Permits & Inspections", description: "Permit fees and inspection coordination", quantity: 1, unitPrice: 0, category: "Permit",     taxable: false },
      { name: "Subcontractor",         description: "Specialty subcontractor work",         quantity: 1, unitPrice: 0, category: "Subcontractor", taxable: false, optional: true },
    ],
  },
  {
    key: "agreement",
    name: "Agreement Quote",
    description: "A recurring maintenance plan or service membership.",
    badge: "Recurring",
    titlePlaceholder: "Maintenance Plan",
    items: [
      { name: "Maintenance Plan",   description: "Annual maintenance agreement", quantity: 1, unitPrice: 240, category: "Maintenance Plan", taxable: false },
      { name: "Priority Service",   description: "Priority scheduling add-on",   quantity: 1, unitPrice: 60,  category: "Maintenance Plan", taxable: false, optional: true },
      { name: "Extended Warranty",  description: "Parts & labor warranty extension", quantity: 1, unitPrice: 120, category: "Warranty",    taxable: false, optional: true },
    ],
  },
  {
    key: "repair_replace",
    name: "Repair vs Replace Quote",
    description: "Present a repair option alongside a full replacement.",
    badge: "Comparison",
    titlePlaceholder: "Repair vs Replace",
    items: [
      { name: "Option A — Repair",       description: "Repair existing equipment", quantity: 1, unitPrice: 850,  category: "Labor",     taxable: false },
      { name: "Option B — Replace",      description: "Full equipment replacement", quantity: 1, unitPrice: 6200, category: "Equipment", taxable: true, optional: true },
      { name: "Replacement Labor",       description: "Installation labor for replacement", quantity: 1, unitPrice: 1200, category: "Labor", taxable: false, optional: true },
    ],
  },
];

export function getQuoteTemplate(key: string): QuoteTemplate | undefined {
  return QUOTE_TEMPLATES.find(t => t.key === key);
}

// ─── Template management config (Settings → Quote Templates) ──────
// The seed templates above are data-only. This overlay stores the editable
// management fields (type, expiration, terms, active, default, section toggles)
// in localStorage so the constant stays untouched.

export type TemplateType = "service" | "tiered" | "project" | "agreement" | "comparison" | "custom";

export const TEMPLATE_TYPE_LABELS: Record<TemplateType, string> = {
  service: "Service", tiered: "Tiered", project: "Project",
  agreement: "Agreement", comparison: "Comparison", custom: "Custom",
};

// The 13 toggleable sections a quote document can render.
export const TEMPLATE_SECTIONS: { key: string; label: string }[] = [
  { key: "companyHeader",       label: "Company Header" },
  { key: "customerInfo",        label: "Customer Info" },
  { key: "propertyInfo",        label: "Property Info" },
  { key: "problemNeed",         label: "Problem / Need" },
  { key: "recommendedSolution", label: "Recommended Solution" },
  { key: "scopeOfWork",         label: "Scope of Work" },
  { key: "lineItems",           label: "Line Items" },
  { key: "options",             label: "Options" },
  { key: "photos",              label: "Photos" },
  { key: "warranty",            label: "Warranty" },
  { key: "financingNote",       label: "Financing Note" },
  { key: "terms",               label: "Terms" },
  { key: "approval",            label: "Approval" },
];

export interface QuoteTemplateConfig {
  key: string;
  name: string;
  templateType: TemplateType;
  defaultExpirationDays: number;
  defaultTerms: string;
  active: boolean;
  isDefault: boolean;
  sections: Record<string, boolean>;
}

const TEMPLATE_DEFAULT_TYPE: Record<string, TemplateType> = {
  standard_service: "service", good_better_best: "tiered", project: "project",
  agreement: "agreement", repair_replace: "comparison",
};

// Sections enabled by default per template (others default on except a few).
function defaultSections(key: string): Record<string, boolean> {
  const on = Object.fromEntries(TEMPLATE_SECTIONS.map(s => [s.key, true]));
  // A few sections are off by default depending on template intent.
  on.photos = false;
  on.financingNote = key === "good_better_best" || key === "repair_replace";
  on.options = key === "good_better_best" || key === "repair_replace";
  on.problemNeed = key !== "agreement";
  return on;
}

function defaultTemplateConfigs(): QuoteTemplateConfig[] {
  return QUOTE_TEMPLATES.map((t, i) => ({
    key: t.key,
    name: t.name,
    templateType: TEMPLATE_DEFAULT_TYPE[t.key] ?? "custom",
    defaultExpirationDays: 30,
    defaultTerms: "terms-standard",
    active: true,
    isDefault: i === 0,
    sections: defaultSections(t.key),
  }));
}

const TC_KEY = "crm-quote-template-configs";

export function getTemplateConfigs(): QuoteTemplateConfig[] {
  if (typeof window === "undefined") return defaultTemplateConfigs();
  try {
    const r = localStorage.getItem(TC_KEY);
    if (!r) return defaultTemplateConfigs();
    // Merge stored configs over defaults so newly-added seed templates appear.
    const stored = JSON.parse(r) as QuoteTemplateConfig[];
    const byKey = new Map(stored.map(c => [c.key, c]));
    return defaultTemplateConfigs().map(d => byKey.get(d.key) ? { ...d, ...byKey.get(d.key)! } : d);
  } catch { return defaultTemplateConfigs(); }
}
export function saveTemplateConfigs(list: QuoteTemplateConfig[]): void {
  try { localStorage.setItem(TC_KEY, JSON.stringify(list)); } catch { /* ignore */ }
}
export function resetTemplateConfigs(): QuoteTemplateConfig[] {
  try { localStorage.removeItem(TC_KEY); } catch { /* ignore */ }
  return defaultTemplateConfigs();
}
