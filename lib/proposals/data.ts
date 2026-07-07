// Proposal Builder — reusable proposal/quote structures (Settings → Proposal
// Builder). localStorage-backed CRUD mirroring the agreements settings pattern.
//
// Concept:
//   Proposal Template = reusable structure (sections, order, visibility, layout).
//   Quote             = customer-specific document.
// When a quote is created from a template, the Quote Builder COPIES the template
// structure into the quote, so later template edits never change old quotes.
//
// Replace with Supabase queries when ready. No PDF/email/e-signature here.

// ─── Section catalog (the master list of section kinds) ───
export type SectionKey =
  | "cover_header" | "customer_info" | "property_info" | "problem_need"
  | "inspection_findings" | "recommended_solution" | "scope_of_work"
  | "line_items" | "gbb_options" | "optional_addons" | "photos"
  | "equipment_cards" | "warranty" | "financing_note" | "terms"
  | "approval" | "custom_text" | "internal_pricing_summary";

export const SECTION_CATALOG: { key: SectionKey; label: string }[] = [
  { key: "cover_header",        label: "Cover / Header" },
  { key: "customer_info",       label: "Customer Info" },
  { key: "property_info",       label: "Property Info" },
  { key: "problem_need",        label: "Problem / Need" },
  { key: "inspection_findings", label: "Inspection Findings" },
  { key: "recommended_solution",label: "Recommended Solution" },
  { key: "scope_of_work",       label: "Scope of Work" },
  { key: "line_items",          label: "Line Items" },
  { key: "gbb_options",         label: "Good / Better / Best Options" },
  { key: "optional_addons",     label: "Optional Add-ons" },
  { key: "photos",              label: "Photos" },
  { key: "equipment_cards",     label: "Equipment Cards" },
  { key: "warranty",            label: "Warranty" },
  { key: "financing_note",      label: "Financing" },
  { key: "terms",               label: "Terms & Conditions" },
  { key: "approval",            label: "Approval / Signature" },
  { key: "custom_text",         label: "Custom Text" },
  { key: "internal_pricing_summary", label: "Internal Pricing Summary" },
];

// Section types whose content lives on the quote record itself (line items,
// option cards, customer/property fields, pricing worksheet) rather than in the
// section body — the inspector edits those stores, not a free-text body.
export const STRUCTURAL_SECTION_KEYS: SectionKey[] = [
  "cover_header", "customer_info", "property_info", "line_items",
  "gbb_options", "optional_addons", "approval", "internal_pricing_summary",
];

// Internal-only section types — never rendered on the customer-facing proposal
// (preview / print / PDF). Shown in the workspace canvas with an internal badge.
export const INTERNAL_SECTION_KEYS: SectionKey[] = ["internal_pricing_summary"];

export const SECTION_LABELS: Record<SectionKey, string> =
  Object.fromEntries(SECTION_CATALOG.map(s => [s.key, s.label])) as Record<SectionKey, string>;

// ─── Types ────────────────────────────────────────────────
export type ProposalTemplateType =
  | "standard_service" | "good_better_best" | "project" | "agreement"
  | "repair_vs_replace" | "inspection" | "custom";

export const TEMPLATE_TYPE_LABELS: Record<ProposalTemplateType, string> = {
  standard_service: "Standard Service Quote",
  good_better_best: "Good / Better / Best Proposal",
  project: "Project Proposal",
  agreement: "Agreement Proposal",
  repair_vs_replace: "Repair vs Replace Proposal",
  inspection: "Inspection Proposal",
  custom: "Custom",
};

export type LineItemLayout = "itemized" | "grouped" | "summary";
export type OptionLayout = "stacked" | "columns";

export const LINE_ITEM_LAYOUT_LABELS: Record<LineItemLayout, string> = {
  itemized: "Itemized (qty × price)", grouped: "Grouped by category", summary: "Summary total only",
};
export const OPTION_LAYOUT_LABELS: Record<OptionLayout, string> = {
  stacked: "Stacked cards", columns: "Side-by-side columns",
};

// A section reference inside a template: the kind, whether it's visible.
// Order is the array index in template.sections.
export interface TemplateSectionRef { key: SectionKey; visible: boolean }

export interface ProposalTemplate {
  id: string; name: string; type: ProposalTemplateType; description: string;
  active: boolean; isDefault: boolean;
  defaultExpirationDays: number;
  defaultTermsBlockId?: string;
  sections: TemplateSectionRef[];
  lineItemLayout: LineItemLayout;
  optionLayout: OptionLayout;
  order: number;
}

// Reusable section block (default wording + merge fields) — Sections Library.
export interface ProposalSection {
  id: string; key: SectionKey; name: string;
  defaultBody: string;
  mergeFields: string[];
  active: boolean; order: number;
}

export interface ProposalTermsBlock {
  id: string; title: string; body: string;
  isDefault: boolean; active: boolean; order: number;
}

export interface ProposalBranding {
  logoUrl: string;
  accentColor: string;
  companyName: string;
  companyInfo: string;
  contactInfo: string;
  footer: string;
  licenseNumber: string;
}

export interface ProposalDefaults {
  defaultTemplateId: string;           // legacy proposal-template default (kept for back-compat)
  // Default Quote Design per quote type (ids from lib/quotes/quoteDesigns).
  defaultQuickQuoteDesignId: string;
  defaultSalesbookDesignId: string;
  defaultCustomDesignId: string;
  defaultExpirationDays: number;
  defaultTermsBlockId: string;         // default Terms block id (from getProposalTerms)
  financingNote: string;               // default financing note
  approvalLanguage: string;            // default approval / signature language
  showOptionalAddons: boolean;
  showPricingBreakdown: boolean;
  showTax: boolean;                    // show tax line on customer-facing quotes
  showMonthlyPayment: boolean;         // show estimated monthly payment
}

// ─── Common merge fields ──────────────────────────────────
export const MERGE_FIELDS = [
  "{{customer.name}}", "{{customer.contact}}", "{{property.address}}",
  "{{company.name}}", "{{company.phone}}", "{{rep.name}}",
  "{{quote.number}}", "{{quote.total}}", "{{quote.expiration}}",
];

// ─── Seed: Sections Library ───────────────────────────────
const sectionBlock = (key: SectionKey, name: string, defaultBody: string, mergeFields: string[], order: number): ProposalSection =>
  ({ id: `ps-${key}`, key, name, defaultBody, mergeFields, active: true, order });

const DEFAULT_SECTIONS: ProposalSection[] = [
  sectionBlock("cover_header", "Cover / Header", "Proposal prepared for {{customer.name}} by {{company.name}}.", ["{{customer.name}}", "{{company.name}}", "{{rep.name}}"], 1),
  sectionBlock("customer_info", "Customer Info", "{{customer.name}} · {{customer.contact}}", ["{{customer.name}}", "{{customer.contact}}"], 2),
  sectionBlock("property_info", "Property Info", "Service location: {{property.address}}", ["{{property.address}}"], 3),
  sectionBlock("problem_need", "Problem / Need", "Summarize the customer's problem or need here.", ["{{customer.name}}"], 4),
  sectionBlock("inspection_findings", "Inspection Findings", "Document what was found during inspection.", [], 5),
  sectionBlock("recommended_solution", "Recommended Solution", "Describe the recommended solution and why it fits.", [], 6),
  sectionBlock("scope_of_work", "Scope of Work", "List the work to be performed.", [], 7),
  sectionBlock("line_items", "Line Items", "Itemized pricing from the catalog appears here.", ["{{quote.total}}"], 8),
  sectionBlock("gbb_options", "Good / Better / Best Options", "Present tiered options for the customer to choose from.", [], 9),
  sectionBlock("optional_addons", "Optional Add-ons", "Optional upgrades the customer can add.", [], 10),
  sectionBlock("photos", "Photos", "Attach before/after or site photos.", [], 11),
  sectionBlock("equipment_cards", "Equipment Cards", "Highlight the equipment included in this proposal.", [], 12),
  sectionBlock("warranty", "Warranty", "Describe warranty coverage and duration.", [], 13),
  sectionBlock("financing_note", "Financing", "Financing is available. Ask {{rep.name}} for details.", ["{{rep.name}}"], 14),
  sectionBlock("terms", "Terms & Conditions", "Standard terms and conditions apply.", [], 15),
  sectionBlock("approval", "Approval / Signature", "By signing below, {{customer.name}} approves this proposal.", ["{{customer.name}}", "{{quote.total}}"], 16),
  sectionBlock("custom_text", "Custom Text", "", [], 17),
];

// ─── Seed: Terms Blocks ───────────────────────────────────
const DEFAULT_TERMS: ProposalTermsBlock[] = [
  { id: "pt-terms-1", title: "Standard Service Terms", body: "This proposal is valid for the expiration period noted. Work is warrantied per the warranty section. Payment is due on completion unless financing is arranged.", isDefault: true, active: true, order: 1 },
  { id: "pt-terms-2", title: "Installation Terms", body: "A deposit may be required to schedule installation. Permits and inspections are included where noted. Change orders are billed separately.", isDefault: false, active: true, order: 2 },
  { id: "pt-terms-3", title: "Inspection Terms", body: "This inspection reflects conditions observed on the inspection date. It is not a guarantee against future failure.", isDefault: false, active: true, order: 3 },
];

// ─── Seed: Branding & Defaults ────────────────────────────
const DEFAULT_BRANDING: ProposalBranding = {
  logoUrl: "",
  accentColor: "#0f8578",
  companyName: "Northstar Service Co.",
  companyInfo: "1200 Industrial Way, Augusta, GA 30901",
  contactInfo: "(706) 555-0100 · hello@northstar.example",
  footer: "Thank you for the opportunity to earn your business.",
  licenseNumber: "GA-HVAC-000000",
};

// ─── Seed: Proposal Templates ─────────────────────────────
const sec = (keys: SectionKey[]): TemplateSectionRef[] => keys.map(k => ({ key: k, visible: true }));

const DEFAULT_TEMPLATES: ProposalTemplate[] = [
  {
    id: "ptmpl-1", name: "Standard Service Quote", type: "standard_service",
    description: "A clean, itemized quote for everyday service and repair work.",
    active: true, isDefault: true, defaultExpirationDays: 30, defaultTermsBlockId: "pt-terms-1",
    sections: sec(["cover_header", "customer_info", "property_info", "problem_need", "recommended_solution", "line_items", "warranty", "terms", "approval"]),
    lineItemLayout: "itemized", optionLayout: "stacked", order: 1,
  },
  {
    id: "ptmpl-2", name: "Good / Better / Best Proposal", type: "good_better_best",
    description: "Three tiered options presented side by side to drive upgrades.",
    active: true, isDefault: false, defaultExpirationDays: 30, defaultTermsBlockId: "pt-terms-1",
    sections: sec(["cover_header", "customer_info", "problem_need", "recommended_solution", "gbb_options", "optional_addons", "warranty", "financing_note", "terms", "approval"]),
    lineItemLayout: "summary", optionLayout: "columns", order: 2,
  },
  {
    id: "ptmpl-3", name: "Project Proposal", type: "project",
    description: "A detailed proposal for larger multi-phase project work.",
    active: true, isDefault: false, defaultExpirationDays: 45, defaultTermsBlockId: "pt-terms-2",
    sections: sec(["cover_header", "customer_info", "property_info", "problem_need", "recommended_solution", "scope_of_work", "line_items", "photos", "warranty", "financing_note", "terms", "approval"]),
    lineItemLayout: "grouped", optionLayout: "stacked", order: 3,
  },
  {
    id: "ptmpl-4", name: "Agreement Proposal", type: "agreement",
    description: "Proposes a recurring service agreement or membership plan.",
    active: true, isDefault: false, defaultExpirationDays: 30, defaultTermsBlockId: "pt-terms-1",
    sections: sec(["cover_header", "customer_info", "recommended_solution", "scope_of_work", "line_items", "warranty", "terms", "approval"]),
    lineItemLayout: "summary", optionLayout: "stacked", order: 4,
  },
  {
    id: "ptmpl-5", name: "Repair vs Replace Proposal", type: "repair_vs_replace",
    description: "Compares repairing the existing equipment against replacing it.",
    active: true, isDefault: false, defaultExpirationDays: 30, defaultTermsBlockId: "pt-terms-1",
    sections: sec(["cover_header", "customer_info", "problem_need", "inspection_findings", "gbb_options", "recommended_solution", "warranty", "financing_note", "terms", "approval"]),
    lineItemLayout: "summary", optionLayout: "columns", order: 5,
  },
  {
    id: "ptmpl-6", name: "Inspection Proposal", type: "inspection",
    description: "Leads with inspection findings, then recommended follow-up work.",
    active: true, isDefault: false, defaultExpirationDays: 30, defaultTermsBlockId: "pt-terms-3",
    sections: sec(["cover_header", "customer_info", "property_info", "inspection_findings", "photos", "recommended_solution", "line_items", "terms", "approval"]),
    lineItemLayout: "itemized", optionLayout: "stacked", order: 6,
  },
  {
    id: "ptmpl-7", name: "Custom", type: "custom",
    description: "Start from a minimal structure and build the proposal yourself.",
    active: true, isDefault: false, defaultExpirationDays: 30,
    sections: sec(["cover_header", "customer_info", "line_items", "terms", "approval"]),
    lineItemLayout: "itemized", optionLayout: "stacked", order: 7,
  },
];

const DEFAULT_DEFAULTS: ProposalDefaults = {
  defaultTemplateId: "ptmpl-1",
  // Seed design ids match the curated Quote Designs in lib/quotes/quoteDesigns.
  defaultQuickQuoteDesignId: "classic-executive",
  defaultSalesbookDesignId: "package-stack-bold",
  defaultCustomDesignId: "classic-executive",
  defaultExpirationDays: 30,
  defaultTermsBlockId: "pt-terms-1",
  financingNote: "Financing available with approved credit. Ask your representative for current plans and estimated monthly payments.",
  approvalLanguage: "By signing below, you approve this proposal and authorize the work described.",
  showOptionalAddons: true,
  showPricingBreakdown: true,
  showTax: true,
  showMonthlyPayment: true,
};

// ─── Storage ──────────────────────────────────────────────
const TMPL_KEY  = "crm-proposal-templates";
const SEC_KEY   = "crm-proposal-sections";
const TERMS_KEY = "crm-proposal-terms";
const BRAND_KEY = "crm-proposal-branding";
const DEF_KEY   = "crm-proposal-defaults";

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

let _templates: ProposalTemplate[] | null = null;
let _sections: ProposalSection[] | null = null;
let _terms: ProposalTermsBlock[] | null = null;

const byOrder = <T extends { order: number }>(l: T[]) => [...l].sort((a, b) => a.order - b.order);
const reindex = <T extends { order: number }>(l: T[]) => byOrder(l).map((x, i) => ({ ...x, order: i + 1 }));

// Templates
export function getProposalTemplates(): ProposalTemplate[] { if (!_templates) _templates = read(TMPL_KEY, DEFAULT_TEMPLATES); return byOrder(_templates); }
export function getProposalTemplate(id: string): ProposalTemplate | undefined { return getProposalTemplates().find(t => t.id === id); }
export function getDefaultProposalTemplate(): ProposalTemplate | undefined {
  const list = getProposalTemplates().filter(t => t.active);
  return list.find(t => t.isDefault) ?? list[0];
}
export function saveProposalTemplates(list: ProposalTemplate[]): void {
  // Exactly one default among the saved set.
  let seenDefault = false;
  const norm = reindex(list).map(t => {
    if (t.isDefault && !seenDefault) { seenDefault = true; return t; }
    return { ...t, isDefault: false };
  });
  _templates = norm; write(TMPL_KEY, norm);
}

// Sections Library
export function getProposalSections(): ProposalSection[] { if (!_sections) _sections = read(SEC_KEY, DEFAULT_SECTIONS); return byOrder(_sections); }
export function getSectionBlock(key: SectionKey): ProposalSection | undefined { return getProposalSections().find(s => s.key === key); }
export function saveProposalSections(list: ProposalSection[]): void { _sections = reindex(list); write(SEC_KEY, _sections); }

// Terms Blocks
export function getProposalTerms(): ProposalTermsBlock[] { if (!_terms) _terms = read(TERMS_KEY, DEFAULT_TERMS); return byOrder(_terms); }
export function saveProposalTerms(list: ProposalTermsBlock[]): void {
  let seen = false;
  const norm = reindex(list).map(t => { if (t.isDefault && !seen) { seen = true; return t; } return { ...t, isDefault: false }; });
  _terms = norm; write(TERMS_KEY, norm);
}

// Branding
export function getProposalBranding(): ProposalBranding { return readObj(BRAND_KEY, DEFAULT_BRANDING); }
export function saveProposalBranding(b: ProposalBranding): void { writeObj(BRAND_KEY, b); }

// Defaults — merge over the seed so records saved before new fields existed still
// resolve every key.
export function getProposalDefaults(): ProposalDefaults { return { ...DEFAULT_DEFAULTS, ...readObj(DEF_KEY, DEFAULT_DEFAULTS) }; }
export function saveProposalDefaults(d: ProposalDefaults): void { writeObj(DEF_KEY, d); }

// ─── Helpers ──────────────────────────────────────────────
export function proposalId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`;
}
export function blankProposalTemplate(): ProposalTemplate {
  const max = getProposalTemplates().reduce((m, t) => Math.max(m, t.order), 0);
  return {
    id: proposalId("ptmpl"), name: "", type: "custom", description: "",
    active: true, isDefault: false, defaultExpirationDays: 30,
    sections: sec(["cover_header", "customer_info", "line_items", "terms", "approval"]),
    lineItemLayout: "itemized", optionLayout: "stacked", order: max + 1,
  };
}

// Resolve a template into the section snapshot a quote should copy. The Quote
// Builder (next increment) calls this so editing a template later never mutates
// existing quotes.
export interface ResolvedSection { key: SectionKey; label: string; body: string; visible: boolean }
export function resolveTemplateSections(template: ProposalTemplate): ResolvedSection[] {
  return template.sections.map(ref => {
    const block = getSectionBlock(ref.key);
    return { key: ref.key, label: SECTION_LABELS[ref.key], body: block?.defaultBody ?? "", visible: ref.visible };
  });
}

// Build a section snapshot from a bare list of keys (all visible). Used by the
// Quick Quote / Custom paths and Salesbooks, which carry section keys directly.
export function buildSectionsFromKeys(keys: SectionKey[]): ResolvedSection[] {
  return keys.map(key => {
    const block = getSectionBlock(key);
    return { key, label: SECTION_LABELS[key], body: block?.defaultBody ?? "", visible: true };
  });
}
