// Quote / Proposal DESIGNS — the visual layout & typography theme of the
// client-facing proposal document (distinct from a Salesbook, which is the
// CONTENT, and from Proposal Branding, which is the logo/accent/company info).
//
// A design is a theme: how the letterhead is laid out, the font family, how
// section labels read, and how the totals block looks. The company's brand
// ACCENT color (from Proposal Branding) flows through every design.
//
// One design is "active" at a time — installing/using a design just sets it as
// active. localStorage-backed singleton (mirrors getProposalBranding).

export type DesignHeader = "band" | "centered" | "bold" | "serif" | "minimal" | "none";
export type DesignLabel = "caps" | "bar" | "rule";
export type DesignTotals = "box" | "accentbar" | "plain";

export interface ProposalDesignStyle {
  header: DesignHeader;       // letterhead layout
  fontFamily: string;         // body font stack
  headingFamily: string;      // heading font stack
  label: DesignLabel;         // section-label treatment
  totals: DesignTotals;       // totals block treatment
}

export interface ProposalDesign {
  id: string;
  name: string;
  description: string;
  badge: string;              // short style descriptor for the gallery chip
  style: ProposalDesignStyle;
}

const SANS = "'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";
const SERIF = "Georgia, 'Times New Roman', 'Iowan Old Style', serif";

export const DESIGN_LIBRARY: ProposalDesign[] = [
  {
    id: "classic",
    name: "Classic Band",
    description: "A confident accent bar across the top with a left-aligned logo and right-aligned proposal details. The dependable default.",
    badge: "Default",
    style: { header: "band", fontFamily: SANS, headingFamily: SANS, label: "caps", totals: "box" },
  },
  {
    id: "centered",
    name: "Centered Modern",
    description: "A clean, symmetrical letterhead — logo and title centered over a slim accent rule. Calm and contemporary.",
    badge: "Clean",
    style: { header: "centered", fontFamily: SANS, headingFamily: SANS, label: "rule", totals: "plain" },
  },
  {
    id: "bold",
    name: "Bold Header",
    description: "A full-width accent color block at the top with reversed white type. High-impact and unmistakably branded.",
    badge: "Bold",
    style: { header: "bold", fontFamily: SANS, headingFamily: SANS, label: "bar", totals: "accentbar" },
  },
  {
    id: "serif",
    name: "Elegant Serif",
    description: "Refined serif typography with a double hairline rule. Reads premium — great for high-ticket and commercial proposals.",
    badge: "Premium",
    style: { header: "serif", fontFamily: SERIF, headingFamily: SERIF, label: "rule", totals: "box" },
  },
  {
    id: "minimal",
    name: "Minimal",
    description: "Maximum whitespace, hairline rules, and small uppercase labels. Quiet, modern, and gets out of the way.",
    badge: "Minimal",
    style: { header: "minimal", fontFamily: SANS, headingFamily: SANS, label: "caps", totals: "plain" },
  },
  {
    id: "executive",
    name: "Executive",
    description: "A classic accent-bar letterhead paired with serif type, underlined section titles, and a bold accent total bar. Polished and corporate.",
    badge: "Corporate",
    style: { header: "band", fontFamily: SERIF, headingFamily: SERIF, label: "rule", totals: "accentbar" },
  },
  {
    id: "studio",
    name: "Studio",
    description: "A centered, gallery-style header with accent-bar section markers and a tidy boxed total. Clean and creative.",
    badge: "Creative",
    style: { header: "centered", fontFamily: SANS, headingFamily: SANS, label: "bar", totals: "box" },
  },
  {
    id: "noir",
    name: "Noir",
    description: "A dramatic full-width accent header over refined serif body text and underlined titles. High-end and confident.",
    badge: "Dramatic",
    style: { header: "bold", fontFamily: SERIF, headingFamily: SERIF, label: "rule", totals: "box" },
  },
  {
    id: "ledger",
    name: "Ledger",
    description: "A double-rule serif masthead with uppercase labels and an accent total bar — reads like a formal statement of work.",
    badge: "Formal",
    style: { header: "serif", fontFamily: SERIF, headingFamily: SERIF, label: "caps", totals: "accentbar" },
  },
  {
    id: "essential",
    name: "Essential",
    description: "A whisper-quiet hairline header with underlined section titles and a softly boxed total. Modern and understated.",
    badge: "Understated",
    style: { header: "minimal", fontFamily: SANS, headingFamily: SANS, label: "rule", totals: "box" },
  },
];

export const DEFAULT_DESIGN = DESIGN_LIBRARY[0];

export function getDesign(id: string): ProposalDesign {
  return DESIGN_LIBRARY.find(d => d.id === id) ?? DEFAULT_DESIGN;
}

// ─── Active design (localStorage singleton) ───────────────
const KEY = "crm-proposal-design";

export function getActiveDesignId(): string {
  if (typeof window === "undefined") return DEFAULT_DESIGN.id;
  try { return localStorage.getItem(KEY) || DEFAULT_DESIGN.id; }
  catch { return DEFAULT_DESIGN.id; }
}
export function getActiveDesign(): ProposalDesign {
  return getDesign(getActiveDesignId());
}
export function setActiveDesign(id: string): void {
  try { localStorage.setItem(KEY, id); } catch { /* ignore */ }
}
