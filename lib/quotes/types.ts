// Quotes and Invoices — TypeScript types.
// These mirror supabase/migrations/0003_quotes_invoices.sql.
// No mock data here — these types are imported by future UI components
// and Supabase query helpers.

export type QuoteStatus =
  | "draft"
  | "sent"
  | "viewed"
  | "approved"
  | "rejected"
  | "expired"
  | "converted";

// How a quote was created — drives which editing experience it opens.
//   quick    = simple catalog line-item quote (Quick Quote page)
//   template = polished proposal from a salesbook/template (Proposal Builder)
//   custom   = advanced pricing wizard → custom Proposal Builder
export type QuoteMode = "quick" | "template" | "custom";

export const QUOTE_MODE_LABELS: Record<QuoteMode, string> = {
  quick:    "Quick Quote",
  template: "Proposal From Template",
  custom:   "Custom Proposal",
};

// How much content the Quote Design renders for this quote (chosen by quote
// type/content, resolved against the design's supported modes). Mirrors
// QuoteDesignMode in lib/quotes/quoteDesigns; kept here so the quote record stays
// decoupled from the design library.
export type QuoteRenderMode = "quick_quote" | "single_offer" | "multi_option" | "salesbook" | "custom";

// Pricing-wizard worksheet + computed results, stored on a custom-mode quote.
// Internal (rep-only) — not shown to the customer on the proposal.
export interface QuotePricing {
  // Cost inputs
  equipmentCost: number;
  materialCost: number;
  laborHours: number;
  laborRate: number;
  laborBurdenPct: number;
  subcontractorCost: number;
  permitCost: number;
  craneCost: number;
  disposalCost: number;
  miscCost: number;
  // Margin / target inputs
  overheadPct: number;
  commissionPct: number;
  financingPct: number;
  targetGrossMarginPct: number;
  targetNetProfitPct: number;
  financeMonths: number;
  // Computed results
  totalCost: number;
  recommendedSellPrice: number;
  sellPrice: number;
  grossProfit: number;
  grossMargin: number;       // 0–1
  netProfit: number;
  netMargin: number;         // 0–1
  monthly: number;           // financing estimate
}

export type InvoiceStatus =
  | "draft"
  | "sent"
  | "viewed"
  | "partially_paid"
  | "paid"
  | "past_due"
  | "void"
  | "canceled";

// Line item categories (Quotes & Invoices)
export type LineItemCategory =
  | "Labor" | "Materials" | "Equipment" | "Permit" | "Subcontractor"
  | "Discount" | "Warranty" | "Maintenance Plan" | "Other";

export const LINE_ITEM_CATEGORIES: LineItemCategory[] = [
  "Labor", "Materials", "Equipment", "Permit", "Subcontractor",
  "Discount", "Warranty", "Maintenance Plan", "Other",
];

export interface Quote {
  id: string;
  organizationId: string;
  companyId: string;
  locationId: string;
  serviceAreaId?: string;

  // Master owner
  customerId: string;

  // Optional context links
  propertyId?: string;
  leadId?: string;
  projectId?: string;
  jobId?: string;
  workOrderId?: string;    // set when the quote was raised from a field work order (upsell)
  agreementId?: string;

  quoteNumber: string;
  title: string;
  status: QuoteStatus;
  quoteMode?: QuoteMode;   // how the quote was created (defaults to "custom" for legacy records)
  renderMode?: QuoteRenderMode;  // how the Quote Design renders this quote's content

  subtotal: number;
  tax: number;
  total: number;

  expiresAt?: string;
  approvedAt?: string;
  assignedUserId?: string;

  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

// ─── Proposal section (copied from a proposal template) ──
// Snapshot of a template section on the quote. Editing the template later does
// not change existing quotes — each quote owns its section copy. Lives here (a
// leaf module) so both lib/quotes/data.ts and lib/quotes/blocks.ts can reference
// it without forming an import cycle.
export interface QuoteSection {
  id?: string;          // stable unique identity (lets a quote hold duplicates of a type)
  key: string;          // section TYPE — proposal SectionKey (e.g. "recommended_solution")
  label: string;        // editable display title (renaming a section edits this)
  body: string;         // editable customer-facing wording
  visible: boolean;
  locked?: boolean;     // structural section that shouldn't be deleted (e.g. cover)
}

export interface Invoice {
  id: string;
  organizationId: string;
  companyId: string;
  locationId: string;
  serviceAreaId?: string;

  // Master owner
  customerId: string;

  // Optional context links
  propertyId?: string;
  projectId?: string;
  jobId?: string;
  workOrderId?: string;    // set when the invoice was built from a field work order
  agreementId?: string;

  // Set if converted from a quote
  quoteId?: string;

  invoiceNumber: string;
  title: string;
  status: InvoiceStatus;

  subtotal: number;
  tax: number;
  total: number;
  balanceDue: number;

  dueDate: string;
  paidAt?: string;

  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

// ─── Display helpers ──────────────────────────────────────

export const QUOTE_STATUS_STYLE: Record<QuoteStatus, { label: string; bg: string; color: string }> = {
  draft:     { label: "Draft",     bg: "var(--bg-input)", color: "var(--text-muted)" },
  sent:      { label: "Sent",      bg: "#e0e7ff",         color: "#3730a3" },
  viewed:    { label: "Viewed",    bg: "#dbeafe",         color: "#1e40af" },
  approved:  { label: "Approved",  bg: "#d1fae5",         color: "#065f46" },
  rejected:  { label: "Rejected",  bg: "#fee2e2",         color: "#991b1b" },
  expired:   { label: "Expired",   bg: "#fef3c7",         color: "#92400e" },
  converted: { label: "Converted", bg: "#d1fae5",         color: "#065f46" },
};

export const INVOICE_STATUS_STYLE: Record<InvoiceStatus, { label: string; bg: string; color: string }> = {
  draft:          { label: "Draft",          bg: "var(--bg-input)", color: "var(--text-muted)" },
  sent:           { label: "Sent",           bg: "#e0e7ff",         color: "#3730a3" },
  viewed:         { label: "Viewed",         bg: "#dbeafe",         color: "#1e40af" },
  partially_paid: { label: "Partially Paid", bg: "#fef3c7",         color: "#92400e" },
  paid:           { label: "Paid",           bg: "#d1fae5",         color: "#065f46" },
  past_due:       { label: "Past Due",       bg: "#fee2e2",         color: "#991b1b" },
  void:           { label: "Void",           bg: "var(--bg-input)", color: "var(--text-muted)" },
  canceled:       { label: "Canceled",       bg: "var(--bg-input)", color: "var(--text-muted)" },
};
