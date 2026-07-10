// Salesbook Library — CRM-provided proposal content libraries the user can copy
// into their own company workspace.
//
// Concept:
//   Salesbook Template  = polished master library WE provide (read-only master).
//   Company Salesbook   = a copy installed into the user's company. Editing the
//                         copy never changes the master template.
//
// A Salesbook bundles the proposal SECTIONS (reusing the Proposal Builder section
// keys) plus reusable OPTION CARDS (Good/Better/Best tiers, equipment, pricing,
// financing) for a specific kind of sale. The "Proposal From Template" quote path
// lets a rep pick one of their installed company salesbooks.
//
// Phase 1: mock master templates + localStorage-backed installs. No spreadsheet
// import yet (that lands later in Settings → Salesbook Library → Import).
// Replace with Supabase queries when ready.

import { SECTION_LABELS, getSectionBlock, type SectionKey } from "@/lib/proposals/data";
import {
  getQuoteDesign, resolveQuoteDesign, defaultQuoteDesignId,
  type QuoteDesign, type ResolvedQuoteDesign,
} from "@/lib/quotes/quoteDesigns";

// ─── Taxonomy ─────────────────────────────────────────────
export type SalesbookIndustry =
  | "hvac" | "roofing" | "plumbing" | "electrical" | "property_maintenance" | "general";

export type SalesbookProposalType =
  | "good_better_best" | "repair" | "replacement" | "maintenance_plan"
  | "commercial_pm" | "inspection" | "custom";

export type SalesbookComplexity = "simple" | "standard" | "premium";

export const INDUSTRY_LABELS: Record<SalesbookIndustry, string> = {
  hvac: "HVAC", roofing: "Roofing", plumbing: "Plumbing",
  electrical: "Electrical", property_maintenance: "Property Maintenance", general: "General Service",
};

export const PROPOSAL_TYPE_LABELS: Record<SalesbookProposalType, string> = {
  good_better_best: "Good / Better / Best", repair: "Repair", replacement: "Replacement",
  maintenance_plan: "Maintenance Plan", commercial_pm: "Commercial PM",
  inspection: "Inspection", custom: "Custom",
};

export const COMPLEXITY_LABELS: Record<SalesbookComplexity, string> = {
  simple: "Simple", standard: "Standard", premium: "Premium",
};

// Accent per industry — drives the card/preview color treatment.
export const INDUSTRY_ACCENT: Record<SalesbookIndustry, string> = {
  hvac: "#0f8578", roofing: "#0891b2", plumbing: "#0d9488",
  electrical: "#d97706", property_maintenance: "#059669", general: "#7c3aed",
};

// ─── Option / equipment cards ─────────────────────────────
export type OptionTier = "good" | "better" | "best";

export interface SalesbookOption {
  id: string;
  tier?: OptionTier;          // for Good/Better/Best salesbooks
  name: string;
  brand?: string;
  model?: string;
  description?: string;
  price: number;
  monthlyPrice?: number;      // financed monthly estimate
  efficiency?: string;        // e.g. "16 SEER2"
  warranty?: string;          // e.g. "10-yr parts + labor"
  category?: string;          // option group name
  includes?: string[];        // bundled items
  notes?: string;
  image?: string;             // image URL or data-URL (equipment/product photo)
  featured?: boolean;         // recommended / highlighted option
}

// ─── Template style, status, media, rich sections ─────────
export type SalesbookStatus = "draft" | "published";

export type SalesbookMediaCategory =
  | "equipment" | "cover" | "before_after" | "section" | "brand_logo" | "benefit";

export const MEDIA_CATEGORY_LABELS: Record<SalesbookMediaCategory, string> = {
  equipment: "Equipment image", cover: "Cover image", before_after: "Before / after photo",
  section: "Section image", brand_logo: "Brand / manufacturer logo", benefit: "Warranty / benefit image",
};

export interface SalesbookMedia {
  id: string;
  url: string;                // data-URL or remote URL
  category: SalesbookMediaCategory;
  caption?: string;
}

// A configurable proposal section on a salesbook: supports rename, custom default
// wording, show/hide, required, and duplication. The flat `sections: SectionKey[]`
// (which quote creation reads) is kept in sync from the visible entries here.
export interface SalesbookSection {
  id: string;
  key: SectionKey;
  label: string;              // display name (rename)
  body?: string;              // custom default wording (overrides catalog default)
  visible: boolean;
  required: boolean;
  contentBlockId?: string;    // Content Block this section was inserted from (reference; body is a copy)
}

// ─── Salesbook shape (shared by master template + company copy) ──
interface SalesbookBase {
  name: string;
  industry: SalesbookIndustry;
  proposalType: SalesbookProposalType;
  complexity: SalesbookComplexity;
  bestFor: string;
  styleBadge: string;          // short premium-style label, e.g. "Tiered Cards"
  sections: SectionKey[];      // proposal section keys, in order
  options: SalesbookOption[];  // sample option cards
  financingNote?: string;
  warranty?: string;
  terms?: string;
}

export interface SalesbookTemplate extends SalesbookBase {
  id: string;
  proposalTemplateId?: string; // links to a Proposal Builder template structure
}

export interface CompanySalesbook extends SalesbookBase {
  id: string;
  companyId: string;
  locationId?: string;
  copiedFromTemplateId?: string;
  active: boolean;            // not-deleted flag (install/uninstall). NOT the publish state.
  installedAt: string;
  // ── Editor-managed (all optional / additive so existing copies keep working) ──
  status?: SalesbookStatus;          // draft vs published (Preview & Publish)
  quoteDesignId?: string;            // chosen Quote Design — the complete customer-facing layout + style
  quoteTemplateKey?: string;         // legacy Quote Template (superseded by quoteDesignId)
  familyId?: string;                 // legacy direct family (superseded by quoteDesignId)
  variantId?: string;                // legacy direct variant (superseded by quoteDesignId)
  styleId?: string;                  // legacy skin id (superseded)
  sectionLayout?: SalesbookSection[];// rich section config; mirrors `sections`
  offerGroupIds?: string[];          // Offer Library groups added to this salesbook (for usage tracking)
  media?: SalesbookMedia[];          // media library
  coverImageId?: string;             // media id used as cover
  fallbackImageId?: string;          // media id used when an option has no image
  // Financing
  showMonthly?: boolean;             // show a monthly payment on the proposal
  monthlyEnabled?: boolean;          // allow per-option monthly price field
  financingDisclaimer?: string;
  // Warranty & terms
  workmanship?: string;              // workmanship guarantee wording
  validityDays?: number;             // proposal validity period
  depositTerms?: string;             // deposit wording
  exclusions?: string;               // what's excluded
  updatedAt?: string;                // last edited stamp
}

// ─── Master templates (CRM-provided) ──────────────────────
const opt = (o: Omit<SalesbookOption, "id"> & { id?: string }): SalesbookOption =>
  ({ id: o.id ?? `opt-${Math.random().toString(36).slice(2, 8)}`, ...o });

// Stock equipment/product photos (Unsplash CDN, sized for option cards).
const img = (id: string) => `https://images.unsplash.com/photo-${id}?w=800&q=70&auto=format&fit=crop`;

export const SALESBOOK_TEMPLATES: SalesbookTemplate[] = [
  {
    id: "sb-hvac-gbb",
    name: "HVAC Good / Better / Best Replacement",
    industry: "hvac", proposalType: "good_better_best", complexity: "premium",
    bestFor: "Full system replacement proposals with tiered options.",
    styleBadge: "Tiered Cards",
    proposalTemplateId: "ptmpl-2",
    sections: ["cover_header", "customer_info", "problem_need", "recommended_solution", "gbb_options", "optional_addons", "warranty", "financing_note", "terms", "approval"],
    options: [
      opt({ tier: "good",   name: "Builder Series 14.3 SEER2", image: img("1614447413576-b346c641c128"), brand: "Goodman", model: "GLXS3BA", description: "Reliable, budget-friendly comfort.", price: 7800,  monthlyPrice: 119, efficiency: "14.3 SEER2", warranty: "10-yr parts", category: "System Replacement", includes: ["New condenser & coil", "Standard thermostat", "Permit & inspection"] }),
      opt({ tier: "better", name: "Comfort Series 16 SEER2",   image: img("1615309662243-70f6df917b59"), brand: "Carrier", model: "CA16NA",  description: "Quieter, more efficient, smart thermostat.", price: 10400, monthlyPrice: 159, efficiency: "16 SEER2", warranty: "10-yr parts + 2-yr labor", category: "System Replacement", includes: ["2-stage condenser", "Smart thermostat", "Media air cleaner", "Permit & inspection"] }),
      opt({ tier: "best",   name: "Infinity Series 19 SEER2",  image: img("1550998251-1e18917c975c"), brand: "Carrier", model: "24VNA9",  description: "Top efficiency, variable speed, whole-home IAQ.", price: 14900, monthlyPrice: 224, efficiency: "19 SEER2", warranty: "10-yr parts + labor", category: "System Replacement", includes: ["Variable-speed system", "Wi-Fi smart control", "Whole-home air purifier", "10-yr labor warranty", "Permit & inspection"] }),
    ],
    financingNote: "Financing available — as low as $119/mo with approved credit.",
    warranty: "Manufacturer parts warranty plus our workmanship guarantee.",
    terms: "Proposal valid 30 days. Deposit required to schedule installation.",
  },
  {
    id: "sb-hvac-replace",
    name: "HVAC System Replacement",
    industry: "hvac", proposalType: "replacement", complexity: "standard",
    bestFor: "Single recommended-system replacement quotes.",
    styleBadge: "Single Solution",
    proposalTemplateId: "ptmpl-1",
    sections: ["cover_header", "customer_info", "property_info", "problem_need", "recommended_solution", "line_items", "warranty", "financing_note", "terms", "approval"],
    options: [
      opt({ name: "3 Ton 16 SEER2 Heat Pump System", image: img("1698479603408-1a66a6d9e80f"), brand: "Trane", model: "XR16", description: "Recommended replacement for the failed unit.", price: 11200, monthlyPrice: 169, efficiency: "16 SEER2", warranty: "10-yr parts + labor", category: "System Replacement", includes: ["New heat pump & air handler", "Smart thermostat", "New line set", "Permit & inspection"] }),
    ],
    financingNote: "Ask about 0% for 18 months on qualifying systems.",
    warranty: "10-year manufacturer warranty with registration.",
    terms: "Proposal valid 30 days.",
  },
  {
    id: "sb-hvac-minisplit",
    name: "Mini-Split Options",
    industry: "hvac", proposalType: "good_better_best", complexity: "standard",
    bestFor: "Ductless zones, additions, and garages.",
    styleBadge: "Zone Options",
    proposalTemplateId: "ptmpl-2",
    sections: ["cover_header", "customer_info", "property_info", "recommended_solution", "gbb_options", "warranty", "financing_note", "terms", "approval"],
    options: [
      opt({ tier: "good",   name: "Single-Zone 12k BTU", image: img("1762341123870-d706f257a12e"), brand: "Mitsubishi", model: "MSZ-FS12", description: "One indoor head, one room.", price: 4200, monthlyPrice: 69, efficiency: "20 SEER2", warranty: "12-yr compressor", category: "Mini Splits", includes: ["1 indoor head", "Outdoor condenser", "Line set & install"] }),
      opt({ tier: "better", name: "Dual-Zone 18k BTU",   image: img("1654880821975-681bd2ff42ae"), brand: "Mitsubishi", model: "MXZ-2C20", description: "Two rooms, independent control.", price: 6800, monthlyPrice: 105, efficiency: "19 SEER2", warranty: "12-yr compressor", category: "Mini Splits", includes: ["2 indoor heads", "Multi-zone condenser", "Line sets & install"] }),
      opt({ tier: "best",   name: "Tri-Zone 24k BTU",     image: img("1759772238012-9d5ad59ae637"), brand: "Mitsubishi", model: "MXZ-3C24", description: "Three zones, hyper-heat capable.", price: 9600, monthlyPrice: 149, efficiency: "18 SEER2", warranty: "12-yr compressor", category: "Mini Splits", includes: ["3 indoor heads", "Hyper-heat condenser", "Line sets & install", "Wireless controllers"] }),
    ],
    financingNote: "Low monthly financing available on multi-zone systems.",
    terms: "Proposal valid 30 days.",
  },
  {
    id: "sb-hvac-commercial-pm",
    name: "Commercial HVAC PM",
    industry: "hvac", proposalType: "commercial_pm", complexity: "premium",
    bestFor: "Commercial preventive-maintenance agreements.",
    styleBadge: "Service Contract",
    proposalTemplateId: "ptmpl-4",
    sections: ["cover_header", "customer_info", "property_info", "scope_of_work", "recommended_solution", "line_items", "terms", "approval"],
    options: [
      opt({ name: "Quarterly PM — Up to 10 RTUs", image: img("1704022632400-79aab2ddb9f6"), description: "4 visits/yr, filter changes, full inspection.", price: 4800, monthlyPrice: 400, category: "Maintenance", includes: ["Quarterly inspections", "Filter changes", "Coil cleaning", "Priority response", "15% repair discount"] }),
    ],
    terms: "12-month agreement, auto-renewing. Billed monthly.",
  },
  {
    id: "sb-hvac-membership",
    name: "Residential Maintenance Membership",
    industry: "hvac", proposalType: "maintenance_plan", complexity: "standard",
    bestFor: "Recurring residential tune-up memberships with tiered plans.",
    styleBadge: "Membership",
    proposalTemplateId: "ptmpl-4",
    sections: ["cover_header", "customer_info", "recommended_solution", "gbb_options", "scope_of_work", "warranty", "terms", "approval"],
    options: [
      opt({ tier: "good",   name: "Comfort Club Basic", image: img("1614447413576-b346c641c128"), description: "One seasonal tune-up a year.", price: 149, monthlyPrice: 12, category: "Membership", includes: ["1 precision tune-up / yr", "Standard filter included", "Priority scheduling", "10% repair discount"] }),
      opt({ tier: "better", name: "Comfort Club Plus",  image: img("1615309662243-70f6df917b59"), description: "Heating + cooling tune-ups with repair perks.", price: 249, monthlyPrice: 21, category: "Membership", includes: ["2 tune-ups / yr (heat + cool)", "Standard filters included", "Priority scheduling", "15% repair discount", "Waived diagnostic fees"] }),
      opt({ tier: "best",   name: "Comfort Club Total", image: img("1550998251-1e18917c975c"), description: "Full coverage: both tune-ups, same-day priority, top discounts.", price: 349, monthlyPrice: 29, category: "Membership", includes: ["2 tune-ups / yr (heat + cool)", "Filters + condensate treatment", "Same-day priority service", "20% repair discount", "Waived diagnostic fees", "No overtime charges"] }),
    ],
    warranty: "Tune-up workmanship guaranteed between visits.",
    terms: "Membership renews annually. Billed monthly or annually. Cancel anytime.",
  },
  {
    id: "sb-hvac-repair",
    name: "HVAC Repair / Diagnostic",
    industry: "hvac", proposalType: "repair", complexity: "simple",
    bestFor: "Same-visit repair quotes after a diagnostic.",
    styleBadge: "Quick Repair",
    proposalTemplateId: "ptmpl-1",
    sections: ["cover_header", "customer_info", "property_info", "problem_need", "line_items", "optional_addons", "warranty", "terms", "approval"],
    options: [
      opt({ name: "Diagnostic & Repair", image: img("1698479603408-1a66a6d9e80f"), description: "Restore cooling — replace the failed component found in diagnosis.", price: 389, category: "Repair", includes: ["Full system diagnostic", "Replace failed capacitor", "Refrigerant level check", "Test & verify operation"] }),
    ],
    warranty: "Repairs warrantied 1 year, parts and labor.",
    terms: "Diagnostic fee waived with completed repair. Proposal valid 30 days.",
  },
];

// ─── Storage (company-installed copies) ───────────────────
const CS_KEY = "crm-company-salesbooks";
let _company: CompanySalesbook[] | null = null;

function read(): CompanySalesbook[] {
  if (_company) return _company;
  if (typeof window === "undefined") return [];
  try { const r = localStorage.getItem(CS_KEY); _company = r ? JSON.parse(r) : []; }
  catch { _company = []; }
  return _company!;
}
function write(list: CompanySalesbook[]): void {
  _company = list;
  try { localStorage.setItem(CS_KEY, JSON.stringify(list)); } catch { /* ignore */ }
}

function nowStamp(): string {
  return new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

// ─── Master template reads ────────────────────────────────
export function getSalesbookTemplates(): SalesbookTemplate[] { return SALESBOOK_TEMPLATES; }
export function getSalesbookTemplate(id: string): SalesbookTemplate | undefined {
  return SALESBOOK_TEMPLATES.find(t => t.id === id);
}

// ─── Company salesbook reads ──────────────────────────────
export function getCompanySalesbooks(): CompanySalesbook[] { return read().filter(s => s.active); }
export function getCompanySalesbook(id: string): CompanySalesbook | undefined {
  return read().find(s => s.id === id);
}
export function getInstalledForCompany(companyId?: string): CompanySalesbook[] {
  return getCompanySalesbooks().filter(s => !companyId || s.companyId === companyId);
}

// A master template is "installed" if any active company copy points back to it.
export function isTemplateInstalled(templateId: string, companyId?: string): boolean {
  return getCompanySalesbooks().some(s =>
    s.copiedFromTemplateId === templateId && (!companyId || s.companyId === companyId));
}

// ─── Install / uninstall ──────────────────────────────────
export interface InstallSalesbookOptions {
  companyId: string;
  locationId?: string;
  name?: string;              // optional rename
  includeOptions?: boolean;   // include sample option cards (default true)
  includeImages?: boolean;    // include sample option images (default true)
  includeTerms?: boolean;     // include default terms (default true)
}

// Copy a master template into the company workspace. The copy is independent —
// editing it never changes the master template.
export function installSalesbook(templateId: string, opts: InstallSalesbookOptions): CompanySalesbook | undefined {
  const tmpl = getSalesbookTemplate(templateId);
  if (!tmpl) return;
  const includeOptions = opts.includeOptions ?? true;
  const includeImages = opts.includeImages ?? true;
  const includeTerms = opts.includeTerms ?? true;
  const copy: CompanySalesbook = {
    id: `csb-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
    companyId: opts.companyId,
    locationId: opts.locationId,
    copiedFromTemplateId: tmpl.id,
    active: true,
    installedAt: nowStamp(),
    name: opts.name?.trim() || tmpl.name,
    industry: tmpl.industry,
    proposalType: tmpl.proposalType,
    complexity: tmpl.complexity,
    bestFor: tmpl.bestFor,
    styleBadge: tmpl.styleBadge,
    sections: [...tmpl.sections],
    options: includeOptions ? tmpl.options.map((o, i) => ({ ...o, id: `${o.id}-c${i}`, image: includeImages ? o.image : undefined })) : [],
    financingNote: tmpl.financingNote,
    warranty: tmpl.warranty,
    terms: includeTerms ? tmpl.terms : undefined,
    // Editor defaults so a freshly installed copy is complete & ready to tune.
    status: "published",
    quoteDesignId: defaultQuoteDesignId(tmpl.proposalType),
    sectionLayout: defaultSectionLayout(tmpl.sections),
    media: [],
    showMonthly: !!tmpl.financingNote,
    monthlyEnabled: true,
    validityDays: 30,
    updatedAt: nowStamp(),
  };
  write([copy, ...read()]);
  return copy;
}

// Start-from-scratch: a draft company template with no sample content. The
// section skeleton comes from the proposal type's default Quote Design — the
// design is the source of layout (the studio has no Sections step).
export function createBlankSalesbook(opts: { companyId: string; locationId?: string; name?: string; proposalType?: SalesbookProposalType }): CompanySalesbook {
  const proposalType = opts.proposalType ?? "custom";
  const BLANK_SECTIONS = [...getQuoteDesign(defaultQuoteDesignId(proposalType)).defaultSections];
  const blank: CompanySalesbook = {
    id: rid("csb"),
    companyId: opts.companyId,
    locationId: opts.locationId,
    active: true,
    installedAt: nowStamp(),
    name: opts.name?.trim() || "Untitled Proposal Template",
    industry: "hvac",
    proposalType,
    complexity: "standard",
    bestFor: "",
    styleBadge: "Custom",
    sections: [...BLANK_SECTIONS],
    options: [],
    status: "draft",
    quoteDesignId: defaultQuoteDesignId(proposalType),
    sectionLayout: defaultSectionLayout(BLANK_SECTIONS),
    media: [],
    showMonthly: false,
    monthlyEnabled: true,
    validityDays: 30,
    updatedAt: nowStamp(),
  };
  write([blank, ...read()]);
  return blank;
}

export function renameCompanySalesbook(id: string, name: string): void {
  write(read().map(s => s.id === id ? { ...s, name: name.trim() || s.name } : s));
}

// Save edits to a company salesbook (sections, options, terms, etc.). Never
// touches the CRM master template the copy came from.
export function updateCompanySalesbook(id: string, patch: Partial<CompanySalesbook>): CompanySalesbook | undefined {
  let updated: CompanySalesbook | undefined;
  write(read().map(s => {
    if (s.id !== id) return s;
    updated = { ...s, ...patch, id: s.id, copiedFromTemplateId: s.copiedFromTemplateId };
    return updated;
  }));
  return updated;
}

// Fresh blank option for the company-salesbook editor.
export function blankSalesbookOption(): SalesbookOption {
  return { id: `opt-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`, name: "New option", price: 0 };
}

function rid(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

// ─── Quote Design (the customer-facing layout + style) ────
// A salesbook chooses one Quote Design — the complete customer-facing proposal
// (layout family + visual variant + sections + pricing presentation). The user
// never picks family and variant separately; they pick a design.

// The Quote Design a salesbook uses. Source of truth is quoteDesignId; falls back
// to the proposal-type default for copies installed before the design system.
export function salesbookDesignId(sb: { quoteDesignId?: string; proposalType: SalesbookProposalType }): string {
  return sb.quoteDesignId ? getQuoteDesign(sb.quoteDesignId).id : defaultQuoteDesignId(sb.proposalType);
}

export function salesbookQuoteDesign(sb: { quoteDesignId?: string; proposalType: SalesbookProposalType }): QuoteDesign {
  return getQuoteDesign(salesbookDesignId(sb));
}

// Resolve the salesbook's design → renderer inputs (family + variant skin).
export function resolveSalesbookDesign(sb: { quoteDesignId?: string; proposalType: SalesbookProposalType }): ResolvedQuoteDesign {
  return resolveQuoteDesign(salesbookDesignId(sb));
}

// ─── Rich section layout ──────────────────────────────────
// Build a configurable section layout from a bare list of section keys. Used when
// a salesbook predates the editor redesign (no sectionLayout yet) and when adding
// a fresh section. Default wording comes from the Sections Library.
const ALWAYS_REQUIRED: SectionKey[] = ["cover_header", "terms"];

export function defaultSectionLayout(keys: SectionKey[]): SalesbookSection[] {
  return keys.map((key, i) => ({
    id: `sbsec-${key}-${i}-${Math.random().toString(36).slice(2, 5)}`,
    key,
    label: SECTION_LABELS[key] ?? key,
    body: getSectionBlock(key)?.defaultBody || undefined,
    visible: true,
    required: ALWAYS_REQUIRED.includes(key),
  }));
}

export function blankSalesbookSection(key: SectionKey): SalesbookSection {
  return {
    id: rid("sbsec"), key, label: SECTION_LABELS[key] ?? key,
    body: getSectionBlock(key)?.defaultBody || undefined, visible: true,
    required: ALWAYS_REQUIRED.includes(key),
  };
}

// The flat key list quote creation reads, derived from the visible sections.
export function sectionsFromLayout(layout: SalesbookSection[]): SectionKey[] {
  return layout.filter(s => s.visible).map(s => s.key);
}

// Ensure a salesbook has a usable section layout (older copies stored only keys).
export function ensureSectionLayout(sb: CompanySalesbook): SalesbookSection[] {
  return sb.sectionLayout && sb.sectionLayout.length
    ? sb.sectionLayout
    : defaultSectionLayout(sb.sections);
}

// ─── Media ────────────────────────────────────────────────
export function blankSalesbookMedia(url: string, category: SalesbookMediaCategory = "equipment"): SalesbookMedia {
  return { id: rid("media"), url, category };
}

// ─── Status ───────────────────────────────────────────────
export function salesbookStatus(sb: { status?: SalesbookStatus }): SalesbookStatus {
  return sb.status ?? "published";
}

// ─── Publish validation ───────────────────────────────────
export interface PublishCheck { ok: boolean; issues: string[] }

// Minimum requirements to publish a salesbook (mirrors the editor's checklist).
// Accepts a draft-shaped object so the editor can validate live, unsaved state.
export interface SalesbookDraftLike {
  name: string;
  industry: SalesbookIndustry;
  proposalType: SalesbookProposalType;
  quoteDesignId?: string;
  sectionLayout: SalesbookSection[];
  terms?: string;
  options: SalesbookOption[];
}

export function validateSalesbookForPublish(d: SalesbookDraftLike): PublishCheck {
  const issues: string[] = [];
  if (!d.name.trim())                               issues.push("Add a salesbook name.");
  if (!d.industry)                                  issues.push("Choose an industry.");
  if (!d.proposalType)                              issues.push("Choose a proposal type.");
  if (!d.quoteDesignId)                             issues.push("Choose a quote design.");
  if (!d.sectionLayout.some(s => s.visible))        issues.push("Add at least one visible proposal section.");
  if (!(d.terms ?? "").trim())                      issues.push("Add default terms & conditions.");

  if (d.proposalType === "good_better_best") {
    if (d.options.length < 2)                       issues.push("Good / Better / Best needs at least two options.");
    if (d.options.some(o => !o.name.trim()))        issues.push("Every option needs a title / name.");
    if (d.options.some(o => !(o.price > 0)))        issues.push("Every option needs a price.");
    if (d.options.some(o => !(o.description ?? "").trim())) issues.push("Every option should have a description.");
  }
  return { ok: issues.length === 0, issues };
}

// Soft-remove (active=false) so it drops out of lists without losing the record.
export function uninstallSalesbook(id: string): void {
  write(read().map(s => s.id === id ? { ...s, active: false } : s));
}
