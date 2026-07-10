// Quote Designs — the ONE user-facing way to choose what a customer-facing quote
// looks like. A Quote Design is the complete proposal layout + visual style +
// structure, so the user never has to pick a "layout family" and a "style variant"
// separately. Each design still resolves, behind the scenes, to:
//
//   layoutFamily      → the structural layout (lib/proposals/families)
//   visualVariant     → the visual skin (fonts / accent / dividers)
//   defaultSections   → the proposal sections the design leads with
//   pricingPresentation → how money is shown (table / cards / monthly / summary)
//   styleSettings     → small design-level toggles (e.g. emphasize monthly)
//
// Replace the localStorage active-design singleton with a Supabase
// `quote_designs` table + a per-company `active_quote_design_id` when ready; the
// shape here mirrors a row.

import {
  getFamily, getVariant, VARIANTS,
  type FamilyId, type VariantId, type TemplateFamily, type VariantSkin,
} from "@/lib/proposals/families";
import { getProposalDefaults, type SectionKey } from "@/lib/proposals/data";
import { getDesign as getLegacyDesign, type ProposalDesign } from "@/lib/proposals/designs";
import type { SalesbookProposalType } from "@/lib/salesbooks/data";

// ─── Design modes (quote situations a design can render) ──
// A Quote Design is the customer-facing PRESENTATION (header, typography, spacing,
// section styling, pricing presentation, signature, terms). The MODE is how much
// content is being rendered — a design can support several. The render mode is
// chosen by the quote type/content, not by the design.
export type QuoteDesignMode =
  | "quick_quote"    // customer info + line items + total + terms + approval
  | "single_offer"   // one recommended option / package
  | "multi_option"   // Good / Better / Best — multiple option cards
  | "salesbook"      // full salesbook proposal (rich sections)
  | "custom";        // custom proposal sections

export const QUOTE_DESIGN_MODES: QuoteDesignMode[] = [
  "quick_quote", "single_offer", "multi_option", "salesbook", "custom",
];

export const QUOTE_DESIGN_MODE_LABELS: Record<QuoteDesignMode, string> = {
  quick_quote:  "Quick Quote",
  single_offer: "Single Offer",
  multi_option: "Multi-Option",
  salesbook:    "Salesbook",
  custom:       "Custom",
};

// ─── Pricing presentation ─────────────────────────────────
export type PricingPresentation =
  | "line_item_table"      // itemized table with an inline total
  | "stacked_packages"     // full-width package cards + total & monthly
  | "comparison_cards"     // side-by-side option cards
  | "investment_summary"   // a single boxed "your investment" card
  | "spec_table"           // structured table + spec/data blocks
  | "monthly_first";       // monthly payment emphasized near the top

export const PRICING_PRESENTATION_LABELS: Record<PricingPresentation, string> = {
  line_item_table:    "Line-item table",
  stacked_packages:   "Stacked package cards + total & monthly",
  comparison_cards:   "Side-by-side comparison cards",
  investment_summary: "Investment summary card",
  spec_table:         "Structured table & spec blocks",
  monthly_first:      "Monthly payment emphasized",
};

// Short label for the card chip.
export const PRICING_PRESENTATION_SHORT: Record<PricingPresentation, string> = {
  line_item_table: "Line-item table", stacked_packages: "Package cards",
  comparison_cards: "Comparison cards", investment_summary: "Investment card",
  spec_table: "Spec table", monthly_first: "Monthly-first",
};

// ─── Design-level style settings ──────────────────────────
export interface QuoteDesignStyleSettings {
  emphasizeMonthly?: boolean;   // lead with / highlight the monthly payment
  showImages?: boolean;         // image-forward presentation
}

// ─── Quote Design ─────────────────────────────────────────
export interface QuoteDesign {
  id: string;
  name: string;
  description: string;            // the "best for" line
  layoutFamily: FamilyId;        // engine family (drives structure + the family badge)
  visualVariant: VariantId;      // engine variant (drives the skin)
  familyLabel: string;           // customer-friendly layout-family badge
  variantLabel: string;          // customer-friendly style/variant badge
  thumbnail?: string;            // optional stored thumbnail (cards render a live preview when absent)
  previewTitle: string;          // sample proposal title used in the preview
  defaultSections: SectionKey[]; // sections this design leads with
  pricingPresentation: PricingPresentation;
  styleSettings: QuoteDesignStyleSettings;
  supportedModes: QuoteDesignMode[];  // quote situations this design can render
  fallbackMode: QuoteDesignMode;      // mode to drop to when the requested one isn't supported / lacks content
  active: boolean;               // available for selection
  isDefault: boolean;            // the out-of-the-box default (company-wide)
  isDefaultForQuickQuote?: boolean;   // seed default for the Quick Quote flow
  isDefaultForSalesbook?: boolean;    // seed default for the Salesbook Proposal flow
  isDefaultForCustom?: boolean;       // seed default for the Custom Proposal flow
  custom?: boolean;              // user-built in the Quote Design Studio (editable/deletable)
}

// ─── Curated library ──────────────────────────────────────
export const QUOTE_DESIGNS: QuoteDesign[] = [
  {
    id: "classic-executive",
    name: "Classic Executive",
    description: "Best for standard service quotes and formal proposals.",
    layoutFamily: "classic", visualVariant: "executive",
    familyLabel: "Classic Proposal", variantLabel: "Executive",
    previewTitle: "Service Agreement Proposal",
    defaultSections: ["cover_header", "customer_info", "property_info", "problem_need", "recommended_solution", "line_items", "warranty", "terms", "approval"],
    pricingPresentation: "line_item_table",
    styleSettings: {},
    supportedModes: ["quick_quote", "single_offer", "custom", "salesbook"],
    fallbackMode: "single_offer",
    active: true, isDefault: true,
    isDefaultForQuickQuote: true, isDefaultForCustom: true,
  },
  {
    id: "package-stack-bold",
    name: "Package Stack Bold",
    description: "Best for HVAC replacement packages with Good / Better / Best / Budget options.",
    layoutFamily: "package", visualVariant: "bold",
    familyLabel: "Package Stack Proposal", variantLabel: "Bold",
    previewTitle: "Comfort System Replacement",
    defaultSections: ["cover_header", "customer_info", "recommended_solution", "gbb_options", "line_items", "financing_note", "warranty", "terms", "approval"],
    pricingPresentation: "stacked_packages",
    styleSettings: { showImages: true, emphasizeMonthly: true },
    supportedModes: ["single_offer", "multi_option", "salesbook", "custom"],
    fallbackMode: "single_offer",
    active: true, isDefault: false,
    isDefaultForSalesbook: true,
  },
  {
    id: "comparison-modern",
    name: "Comparison Modern",
    description: "Best for option-based replacement proposals.",
    layoutFamily: "comparison", visualVariant: "clean",
    familyLabel: "Good / Better / Best Comparison", variantLabel: "Modern",
    previewTitle: "Choose Your System",
    defaultSections: ["cover_header", "customer_info", "problem_need", "recommended_solution", "gbb_options", "line_items", "financing_note", "warranty", "terms", "approval"],
    pricingPresentation: "comparison_cards",
    styleSettings: { showImages: true },
    // Comparison needs ≥2 options; with only one it falls back to a single offer.
    supportedModes: ["multi_option", "salesbook"],
    fallbackMode: "single_offer",
    active: true, isDefault: false,
  },
  {
    id: "visual-sales-warm",
    name: "Visual Sales Warm",
    description: "Best for residential sales presentations with images.",
    layoutFamily: "visual", visualVariant: "warm",
    familyLabel: "Visual Sales Proposal", variantLabel: "Warm",
    previewTitle: "Your Home Comfort Proposal",
    defaultSections: ["cover_header", "customer_info", "property_info", "recommended_solution", "photos", "gbb_options", "line_items", "warranty", "terms", "approval"],
    pricingPresentation: "investment_summary",
    styleSettings: { showImages: true },
    supportedModes: ["single_offer", "salesbook", "custom"],
    fallbackMode: "single_offer",
    active: true, isDefault: false,
  },
  {
    id: "technical-spec-clean",
    name: "Technical Spec Clean",
    description: "Best for commercial and equipment-heavy proposals.",
    layoutFamily: "technical", visualVariant: "clean",
    familyLabel: "Technical Spec Proposal", variantLabel: "Clean",
    previewTitle: "Commercial Equipment Proposal",
    defaultSections: ["cover_header", "customer_info", "property_info", "scope_of_work", "recommended_solution", "line_items", "warranty", "terms", "approval"],
    pricingPresentation: "spec_table",
    styleSettings: {},
    supportedModes: ["quick_quote", "single_offer", "custom"],
    fallbackMode: "single_offer",
    active: true, isDefault: false,
  },
  {
    id: "financing-first",
    name: "Financing First",
    description: "Best for monthly-payment-driven sales.",
    layoutFamily: "offer", visualVariant: "bold",
    familyLabel: "Financing-First Proposal", variantLabel: "Bold",
    previewTitle: "Low Monthly Comfort Plan",
    defaultSections: ["cover_header", "customer_info", "recommended_solution", "gbb_options", "financing_note", "line_items", "warranty", "terms", "approval"],
    pricingPresentation: "monthly_first",
    styleSettings: { emphasizeMonthly: true, showImages: true },
    supportedModes: ["single_offer", "multi_option", "salesbook"],
    fallbackMode: "single_offer",
    active: true, isDefault: false,
  },
];

export const DEFAULT_QUOTE_DESIGN = QUOTE_DESIGNS.find(d => d.isDefault) ?? QUOTE_DESIGNS[0];

// ─── Custom designs (built in the Quote Design Studio) ────
// User-authored designs live beside the curated library: same QuoteDesign shape,
// stored in localStorage (Supabase `quote_designs` rows later). Structure is an
// ordered list of section keys; supportedModes and the pricing presentation are
// DERIVED from that structure so custom designs obey the same design↔content
// correlation rules as curated ones.
const CUSTOM_KEY = "crm-custom-quote-designs";
let _custom: QuoteDesign[] | null = null;

function readCustom(): QuoteDesign[] {
  if (_custom) return _custom;
  if (typeof window === "undefined") return [];
  try { const r = localStorage.getItem(CUSTOM_KEY); _custom = r ? JSON.parse(r) : []; }
  catch { _custom = []; }
  return _custom!;
}
function writeCustom(list: QuoteDesign[]): void {
  _custom = list;
  try { localStorage.setItem(CUSTOM_KEY, JSON.stringify(list)); } catch { /* ignore */ }
}

export function getCustomQuoteDesigns(): QuoteDesign[] { return readCustom().filter(d => d.active); }

export interface CustomQuoteDesignInput {
  id?: string;                   // present = update
  name: string;
  description?: string;
  layoutFamily: FamilyId;        // document vs comparison presentation
  visualVariant: VariantId;      // visual skin
  defaultSections: SectionKey[]; // the ordered structure built on the canvas
  styleSettings?: QuoteDesignStyleSettings;
}

export function saveCustomQuoteDesign(input: CustomQuoteDesignInput): QuoteDesign {
  const hasOptions = input.defaultSections.includes("gbb_options");
  const family = getFamily(input.layoutFamily);
  const design: QuoteDesign = {
    id: input.id ?? `custom-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    name: input.name.trim() || "Untitled Design",
    description: input.description?.trim() || "Custom quote design.",
    layoutFamily: input.layoutFamily,
    visualVariant: input.visualVariant,
    familyLabel: family.name,
    variantLabel: VARIANTS[input.visualVariant].name,
    previewTitle: input.name.trim() || "Custom Proposal",
    defaultSections: [...input.defaultSections],
    pricingPresentation: family.optionTreatment === "comparison-cards"
      ? "comparison_cards"
      : hasOptions ? "stacked_packages" : "line_item_table",
    styleSettings: input.styleSettings ?? {},
    supportedModes: hasOptions
      ? ["single_offer", "multi_option", "salesbook", "custom"]
      : ["quick_quote", "single_offer", "salesbook", "custom"],
    fallbackMode: "single_offer",
    active: true,
    isDefault: false,
    custom: true,
  };
  const list = readCustom();
  const i = list.findIndex(d => d.id === design.id);
  writeCustom(i >= 0 ? list.map(d => (d.id === design.id ? design : d)) : [...list, design]);
  return design;
}

export function deleteCustomQuoteDesign(id: string): void {
  writeCustom(readCustom().filter(d => d.id !== id));
}

// ─── Reads / resolution ───────────────────────────────────
export function getQuoteDesigns(): QuoteDesign[] {
  return [...QUOTE_DESIGNS.filter(d => d.active), ...getCustomQuoteDesigns()];
}

export function getQuoteDesign(id?: string): QuoteDesign {
  return QUOTE_DESIGNS.find(d => d.id === id) ?? readCustom().find(d => d.id === id) ?? DEFAULT_QUOTE_DESIGN;
}

export interface ResolvedQuoteDesign {
  design: QuoteDesign;
  family: TemplateFamily;
  variant: VariantSkin;
}

// Resolve a design id → the renderer inputs (family + variant skin).
export function resolveQuoteDesign(id?: string): ResolvedQuoteDesign {
  const design = getQuoteDesign(id);
  const family = getFamily(design.layoutFamily);
  const variant = getVariant(family, design.visualVariant);
  return { design, family, variant };
}

// Display badges (fall back to the engine names if a design omits a friendly label).
export function designFamilyLabel(d: QuoteDesign): string { return d.familyLabel || getFamily(d.layoutFamily).name; }
export function designVariantLabel(d: QuoteDesign): string { return d.variantLabel || VARIANTS[d.visualVariant].name; }

// ─── PDF bridge ───────────────────────────────────────────
// The PDF generator (lib/quotes/proposalPdf) renders from a legacy ProposalDesign
// skin. Map a Quote Design's visual variant onto the closest legacy skin so the
// downloaded PDF stays in the same spirit as the on-screen family document.
const VARIANT_TO_LEGACY: Record<VariantId, string> = {
  clean: "centered", bold: "bold", warm: "serif", executive: "executive",
};
export function legacyDesignForQuoteDesign(quoteDesignId?: string): ProposalDesign {
  const d = getQuoteDesign(quoteDesignId);
  return getLegacyDesign(VARIANT_TO_LEGACY[d.visualVariant] ?? "classic");
}

// ─── Default design per proposal type ─────────────────────
// Used when a salesbook is installed so a fresh copy gets a sensible design.
const PROPOSAL_TYPE_DESIGN: Record<SalesbookProposalType, string> = {
  good_better_best: "comparison-modern",
  repair:           "classic-executive",
  replacement:      "package-stack-bold",
  maintenance_plan: "classic-executive",
  commercial_pm:    "technical-spec-clean",
  inspection:       "classic-executive",
  custom:           "classic-executive",
};

export function defaultQuoteDesignId(proposalType: SalesbookProposalType): string {
  const want = PROPOSAL_TYPE_DESIGN[proposalType] ?? DEFAULT_QUOTE_DESIGN.id;
  return getQuoteDesign(want).id;
}

// ─── Design ↔ mode compatibility ──────────────────────────
export function designSupportsMode(d: QuoteDesign, mode: QuoteDesignMode): boolean {
  return d.supportedModes.includes(mode);
}

// Active designs that can render a given quote situation — used to filter the
// design picker so a rep only sees designs that fit the quote being built.
export function getDesignsForMode(mode: QuoteDesignMode): QuoteDesign[] {
  return getQuoteDesigns().filter(d => designSupportsMode(d, mode));
}

// Pick the mode a design will actually render in. If it supports the requested
// mode, use it; otherwise drop to its declared fallback (e.g. a comparison design
// asked to render a single option falls back to single_offer).
export function resolveRenderMode(d: QuoteDesign, requested: QuoteDesignMode): QuoteDesignMode {
  return designSupportsMode(d, requested) ? requested : d.fallbackMode;
}

// ─── Defaults by quote type (Settings → Salesbook Library → Defaults) ──
// The editable per-type default lives in ProposalDefaults; if it's unset or points
// at a missing/incompatible design we fall back to the design flagged in the
// curated library, then to the company default.
function flaggedDefault(pick: (d: QuoteDesign) => boolean | undefined): QuoteDesign {
  return QUOTE_DESIGNS.find(d => d.active && pick(d)) ?? DEFAULT_QUOTE_DESIGN;
}
function resolveTypeDefault(storedId: string | undefined, mode: QuoteDesignMode, fallback: QuoteDesign): string {
  if (storedId) {
    const d = QUOTE_DESIGNS.find(x => x.id === storedId && x.active);
    if (d && designSupportsMode(d, mode)) return d.id;
  }
  return fallback.id;
}

export function getDefaultDesignIdForQuickQuote(): string {
  return resolveTypeDefault(getProposalDefaults().defaultQuickQuoteDesignId, "quick_quote", flaggedDefault(d => d.isDefaultForQuickQuote));
}
export function getDefaultDesignIdForSalesbook(): string {
  return resolveTypeDefault(getProposalDefaults().defaultSalesbookDesignId, "salesbook", flaggedDefault(d => d.isDefaultForSalesbook));
}
export function getDefaultDesignIdForCustom(): string {
  return resolveTypeDefault(getProposalDefaults().defaultCustomDesignId, "custom", flaggedDefault(d => d.isDefaultForCustom));
}

// ─── Active design (company default, localStorage singleton) ──
const KEY = "crm-quote-design";

export function getActiveQuoteDesignId(): string {
  if (typeof window === "undefined") return DEFAULT_QUOTE_DESIGN.id;
  try {
    const id = localStorage.getItem(KEY);
    return id && QUOTE_DESIGNS.some(d => d.id === id) ? id : DEFAULT_QUOTE_DESIGN.id;
  } catch { return DEFAULT_QUOTE_DESIGN.id; }
}
export function getActiveQuoteDesign(): QuoteDesign { return getQuoteDesign(getActiveQuoteDesignId()); }
export function setActiveQuoteDesign(id: string): void {
  try { localStorage.setItem(KEY, id); } catch { /* ignore */ }
}
