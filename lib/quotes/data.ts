// ─── Quotes & Invoices — mock data ────────────────────────
// Extends the base types in lib/quotes/types.ts with line items,
// display-only fields, and linked-record labels for list/detail views.
//
// Replace with Supabase queries when ready:
//   supabase.from('quotes').select('*, line_items(*)')
//     .eq('organization_id', orgId).order('created_at', { ascending: false })

import type { Quote, Invoice, QuoteStatus, QuoteMode, QuoteRenderMode, QuotePricing, InvoiceStatus, LineItemCategory, QuoteSection } from "./types";
import type { QuoteBlock } from "./blocks";
import { QUOTE_STATUS_STYLE } from "./types";
import { createJob, getJob, getWorkOrderById, type Job, type WorkOrderLineItem } from "@/lib/jobs/data";
import { isBilled, markLinesBilled, markLedgerLinesBilled, releaseInvoiceLines, markInvoicePaid, getJobLedger } from "@/lib/billing/ledger";
import { createProject, type Project } from "@/lib/projects/data";
import { currentUser } from "@/lib/hierarchy/data";   // signed-in user (org admin) — drives createdBy / assignedTo / activity actor

const STATUS_LABEL: Record<QuoteStatus, string> =
  Object.fromEntries(Object.entries(QUOTE_STATUS_STYLE).map(([k, v]) => [k, v.label])) as Record<QuoteStatus, string>;

// ─── Line items ───────────────────────────────────────────
export interface LineItem {
  id: string;
  name?: string;                  // short label (falls back to description)
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
  category?: LineItemCategory;
  taxable?: boolean;
  optional?: boolean;             // optional add-on line (not in base total)
  notes?: string;
  itemId?: string;                // catalog item this line was added from (snapshot + back-ref)
  unitCost?: number;              // snapshotted cost for margin display (rep-only)
}

// ─── Proposal section (copied from a proposal template) ──
// The QuoteSection type now lives in ./types (a leaf module) so blocks.ts can
// reference it without an import cycle; re-exported here for existing consumers.
export type { QuoteSection } from "./types";

// Stable per-section id generator + a migration helper so legacy quotes (whose
// sections were saved before `id` existed) get ids on load. Identity matters for
// React keys, selection, drag-reorder, and duplicating a section.
let _secSeq = 0;
export function quoteSectionId(): string { return `qsec-${Date.now().toString(36)}-${(_secSeq++).toString(36)}`; }
export function ensureSectionIds(sections: QuoteSection[]): QuoteSection[] {
  return sections.map(s => (s.id ? s : { ...s, id: quoteSectionId() }));
}

// ─── Proposal option card (copied from a salesbook) ──────
// Snapshot of a salesbook option on the quote. Editing the quote never changes
// the master salesbook — each quote owns its option copies.
export interface QuoteOption {
  id: string;
  tier?: "good" | "better" | "best";
  name: string;
  brand?: string;
  model?: string;
  description?: string;
  price: number;
  monthlyPrice?: number;
  efficiency?: string;
  warranty?: string;
  category?: string;
  includes?: string[];
  notes?: string;
  image?: string;            // image URL or data-URL (equipment/product photo)
  selected?: boolean;        // customer-chosen tier
  featured?: boolean;        // recommended / highlighted option
}

// ─── Activity log (per quote) ─────────────────────────────
export type QuoteActivityKind =
  | "created" | "duplicated" | "status" | "sent" | "approved"
  | "rejected" | "converted" | "note" | "edited";

export interface QuoteActivity {
  id: string;
  at: string;          // display date (e.g. "Jun 12, 2026")
  iso?: string;        // precise ISO timestamp for ordering + time-of-day display
  actor: string;
  kind: QuoteActivityKind;
  message: string;
}

// ─── Extended record types ────────────────────────────────
export interface QuoteRecord extends Quote {
  lineItems: LineItem[];
  internalNotes?: string;
  customerNotes?: string;          // customer-facing notes shown on the quote
  templateKey?: string;            // template the quote was created from
  quoteDesignId?: string;          // customer-facing Quote Design (copied from the salesbook at creation; overridable)
  salesbookId?: string;            // company salesbook the quote was started from (template path)
  proposalTemplateId?: string;     // proposal template the quote was built from
  sections?: QuoteSection[];       // ordered, snapshot-copied proposal sections (template path)
  blocks?: QuoteBlock[];           // ordered content blocks (Custom Proposal document builder)
  options?: QuoteOption[];         // snapshot-copied option cards (template/salesbook quotes)
  pricing?: QuotePricing;          // pricing-wizard worksheet + results (custom quotes)
  assignedTo?: string;             // salesperson (falls back to createdBy)
  activity?: QuoteActivity[];      // status/notes history
  // Denormalized for list display
  customerName: string;
  customerInitials: string;
  locationName: string;
  propertyLabel?: string;          // denormalized property for list/detail
  // Linked record display
  linkedLabel?: string;
  linkedType?: "lead" | "job" | "project" | "agreement";
  linkedId?: string;
  // Lifecycle flags — hidden from active lists (kept for audit, not hard-removed).
  archived?: boolean;
  deleted?: boolean;
}

export interface InvoicePayment { id: string; amount: number; at: string; method?: string }

export interface InvoiceRecord extends Invoice {
  lineItems: LineItem[];
  internalNotes?: string;
  customerNotes?: string;          // customer-facing notes / terms shown on the invoice
  payments?: InvoicePayment[];     // recorded payments (history)
  // Denormalized
  customerName: string;
  customerInitials: string;
  locationName: string;
  linkedLabel?: string;
  linkedType?: "quote" | "job" | "project" | "agreement";
  linkedId?: string;
  quoteNumber?: string;
  deleted?: boolean;
  // ─── Deposits ───
  isDeposit?: boolean;          // a job-level deposit / down-payment (not tied to captured lines)
  depositAppliedTo?: string;    // the final invoice id that credited this deposit (once consumed)
}

// ─── Currency helper ──────────────────────────────────────
export const fmt = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 });

// ─── Mock quotes ──────────────────────────────────────────
export const ALL_QUOTES: QuoteRecord[] = [];

// ─── Mock invoices ────────────────────────────────────────
export const ALL_INVOICES: InvoiceRecord[] = [];

// ─── Runtime store (seed + records created in-session) ────
const Q_KEY = "crm-extra-quotes";
const I_KEY = "crm-extra-invoices";
const QO_KEY = "crm-quote-overrides";   // per-quote field overrides (status, notes, activity…)
const IO_KEY = "crm-invoice-overrides"; // per-invoice field overrides (status, payment…)

let _extraQuotes:   QuoteRecord[] | null = null;
let _extraInvoices: InvoiceRecord[] | null = null;
let _quoteOverrides: Record<string, Partial<QuoteRecord>> | null = null;
let _invoiceOverrides: Record<string, Partial<InvoiceRecord>> | null = null;

function extraQuotes(): QuoteRecord[] {
  if (_extraQuotes) return _extraQuotes;
  if (typeof window === "undefined") return [];
  try { const r = localStorage.getItem(Q_KEY); _extraQuotes = r ? JSON.parse(r) : []; }
  catch { _extraQuotes = []; }
  return _extraQuotes!;
}
function extraInvoices(): InvoiceRecord[] {
  if (_extraInvoices) return _extraInvoices;
  if (typeof window === "undefined") return [];
  try { const r = localStorage.getItem(I_KEY); _extraInvoices = r ? JSON.parse(r) : []; }
  catch { _extraInvoices = []; }
  return _extraInvoices!;
}

// Overrides let us persist edits (status changes, notes, activity) to *seed*
// quotes without mutating the constant array — every page reads them back so a
// single quote stays consistent everywhere it surfaces.
function quoteOverrides(): Record<string, Partial<QuoteRecord>> {
  if (_quoteOverrides) return _quoteOverrides;
  if (typeof window === "undefined") return {};
  try { const r = localStorage.getItem(QO_KEY); _quoteOverrides = r ? JSON.parse(r) : {}; }
  catch { _quoteOverrides = {}; }
  return _quoteOverrides!;
}
function saveOverride(id: string, patch: Partial<QuoteRecord>) {
  const all = { ...quoteOverrides() };
  all[id] = { ...all[id], ...patch };
  _quoteOverrides = all;
  try { localStorage.setItem(QO_KEY, JSON.stringify(all)); } catch { /* ignore */ }
}
function applyOverride(q: QuoteRecord): QuoteRecord {
  const o = quoteOverrides()[q.id];
  return o ? { ...q, ...o } : q;
}

// Same override pattern for invoices (status changes, payments) on seed records.
function invoiceOverrides(): Record<string, Partial<InvoiceRecord>> {
  if (_invoiceOverrides) return _invoiceOverrides;
  if (typeof window === "undefined") return {};
  try { const r = localStorage.getItem(IO_KEY); _invoiceOverrides = r ? JSON.parse(r) : {}; }
  catch { _invoiceOverrides = {}; }
  return _invoiceOverrides!;
}
function saveInvoiceOverride(id: string, patch: Partial<InvoiceRecord>) {
  const all = { ...invoiceOverrides() };
  all[id] = { ...all[id], ...patch };
  _invoiceOverrides = all;
  try { localStorage.setItem(IO_KEY, JSON.stringify(all)); } catch { /* ignore */ }
}
function applyInvoiceOverride(inv: InvoiceRecord): InvoiceRecord {
  const o = invoiceOverrides()[inv.id];
  return o ? { ...inv, ...o } : inv;
}

export function getAllQuotes(): QuoteRecord[]   { return [...extraQuotes(), ...ALL_QUOTES].map(applyOverride).filter(q => !q.archived && !q.deleted); }
export function getArchivedQuotes(): QuoteRecord[] { return [...extraQuotes(), ...ALL_QUOTES].map(applyOverride).filter(q => q.archived && !q.deleted); }
export function getAllInvoices(): InvoiceRecord[] { return [...extraInvoices(), ...ALL_INVOICES].map(applyInvoiceOverride).filter(i => !i.deleted); }

// Persist an invoice edit — session invoices mutate in place; seed invoices via overrides.
function persistInvoiceEdit(id: string, patch: Partial<InvoiceRecord>) {
  if (extraInvoices().some(i => i.id === id)) {
    _extraInvoices = extraInvoices().map(i => i.id === id ? { ...i, ...patch, updatedAt: nowStamp() } : i);
    try { localStorage.setItem(I_KEY, JSON.stringify(_extraInvoices)); } catch { /* ignore */ }
  } else {
    saveInvoiceOverride(id, { ...patch, updatedAt: nowStamp() });
  }
}

export function updateInvoiceStatus(id: string, status: InvoiceStatus): InvoiceRecord | undefined {
  const inv = getInvoice(id);
  if (!inv) return;
  const patch: Partial<InvoiceRecord> = { status };
  if (status === "paid") { patch.balanceDue = 0; patch.paidAt = nowStamp(); }
  if (status === "void" || status === "canceled") patch.balanceDue = 0;
  persistInvoiceEdit(id, patch);
  if (status === "paid") markInvoicePaid(id);            // flip its ledger lines to paid
  if (status === "void" || status === "canceled") releaseInvoiceLines(id);  // return lines to unbilled
  return getInvoice(id);
}

// Record a payment against an invoice. Reduces the balance; flips status to
// paid / partially_paid and stamps paidAt when settled in full.
export function recordPayment(id: string, amount: number): InvoiceRecord | undefined {
  const inv = getInvoice(id);
  if (!inv) return;
  const balance = Math.max(0, Math.round((inv.balanceDue - amount) * 100) / 100);
  const patch: Partial<InvoiceRecord> = {
    balanceDue: balance,
    payments: [...(inv.payments ?? []), { id: `pay-${Date.now()}`, amount, at: nowStamp() }],
  };
  if (balance <= 0) { patch.status = "paid"; patch.paidAt = nowStamp(); }
  else patch.status = "partially_paid";
  persistInvoiceEdit(id, patch);
  if (balance <= 0) markInvoicePaid(id);   // settled in full → mark its ledger lines paid
  return getInvoice(id);
}

export function updateInvoice(id: string, patch: Partial<InvoiceRecord>): InvoiceRecord | undefined {
  persistInvoiceEdit(id, patch);
  return getInvoice(id);
}

export function voidInvoice(id: string): void { persistInvoiceEdit(id, { status: "void", balanceDue: 0 }); }
export function deleteInvoice(id: string): void {
  if (extraInvoices().some(i => i.id === id)) {
    _extraInvoices = extraInvoices().filter(i => i.id !== id);
    try { localStorage.setItem(I_KEY, JSON.stringify(_extraInvoices)); } catch { /* ignore */ }
  } else {
    saveInvoiceOverride(id, { deleted: true });
  }
  // Return this invoice's captured lines to the unbilled pool on the job ledger.
  releaseInvoiceLines(id);
}
export function duplicateInvoice(id: string): InvoiceRecord | undefined {
  const src = getInvoice(id);
  if (!src) return;
  const copy: InvoiceRecord = {
    ...src,
    id: `inv-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
    invoiceNumber: nextNumber("INV", getAllInvoices()),
    status: "draft", balanceDue: src.total, paidAt: undefined,
    createdAt: nowStamp(), updatedAt: nowStamp(),
    lineItems: src.lineItems.map((li, i) => ({ ...li, id: `li-invdup-${Date.now()}-${i}` })),
  };
  _extraInvoices = [copy, ...extraInvoices()];
  try { localStorage.setItem(I_KEY, JSON.stringify(_extraInvoices)); } catch { /* ignore */ }
  return copy;
}

// ─── Activity helpers ─────────────────────────────────────
function nowStamp(): string {
  return new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
function newActivity(kind: QuoteActivityKind, message: string, actor = currentUser.fullName): QuoteActivity {
  return { id: `qa-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`, at: nowStamp(), iso: new Date().toISOString(), actor, kind, message };
}

// Activity for a quote, synthesizing a baseline "created" entry for seed quotes.
export function getQuoteActivity(q: QuoteRecord): QuoteActivity[] {
  if (q.activity && q.activity.length) return q.activity;
  return [{ id: `qa-seed-${q.id}`, at: q.createdAt, actor: q.createdBy, kind: "created", message: `Quote ${q.quoteNumber} created` }];
}

function persistEdit(id: string, patch: Partial<QuoteRecord>, activityEntry?: QuoteActivity) {
  const current = getQuote(id);
  if (!current) return;
  const nextActivity = activityEntry ? [...getQuoteActivity(current), activityEntry] : current.activity;
  // Seed quotes persist via overrides; session-created quotes mutate in place.
  const isExtra = extraQuotes().some(q => q.id === id);
  if (isExtra) {
    _extraQuotes = extraQuotes().map(q => q.id === id ? { ...q, ...patch, activity: nextActivity, updatedAt: nowStamp() } : q);
    try { localStorage.setItem(Q_KEY, JSON.stringify(_extraQuotes)); } catch { /* ignore */ }
  } else {
    saveOverride(id, { ...patch, activity: nextActivity, updatedAt: nowStamp() });
  }
}

const STATUS_VERB: Partial<Record<QuoteStatus, QuoteActivityKind>> = {
  sent: "sent", approved: "approved", rejected: "rejected", converted: "converted",
};

// Update status (+ append matching activity). Used by Mark Sent/Approved/etc.
export function updateQuoteStatus(id: string, status: QuoteStatus, actor = currentUser.fullName): QuoteRecord | undefined {
  const q = getQuote(id);
  if (!q) return;
  const patch: Partial<QuoteRecord> = { status };
  if (status === "approved") patch.approvedAt = nowStamp();
  const kind = STATUS_VERB[status] ?? "status";
  const label = STATUS_LABEL[status];
  persistEdit(id, patch, newActivity(kind, `Marked ${label}`, actor));
  return getQuote(id);
}

export function setQuoteNotes(id: string, notes: { internalNotes?: string; customerNotes?: string }, actor = currentUser.fullName): void {
  persistEdit(id, notes, newActivity("note", "Notes updated", actor));
}

// Edit a quote's contents (title, line items, totals, notes, links). Used by the
// edit flow; logs an "edited" activity entry.
export function updateQuote(id: string, patch: Partial<QuoteRecord>, actor = currentUser.fullName): QuoteRecord | undefined {
  persistEdit(id, patch, newActivity("edited", "Quote edited", actor));
  return getQuote(id);
}

// Quiet persist for the Quote Builder autosave — writes without logging an
// activity entry on every keystroke (the builder logs one "edited" on exit).
export function autosaveQuote(id: string, patch: Partial<QuoteRecord>): QuoteRecord | undefined {
  persistEdit(id, patch);
  return getQuote(id);
}

// Convert to a job — creates a real (unscheduled) job, links it on the quote,
// marks the quote converted, and logs activity. Returns the new job.
export function convertQuoteToJob(id: string, actor = currentUser.fullName): Job | undefined {
  const q = getQuote(id);
  if (!q) return;
  const job = createJob({
    companyId: q.companyId, locationId: q.locationId, serviceAreaId: q.serviceAreaId,
    accountId: q.customerId, customerName: q.customerName, customerInitials: q.customerInitials,
    locationName: q.locationName, title: q.title,
    estimatedAmount: q.total > 0 ? fmt(q.total) : undefined,
    propertyAddress: q.propertyLabel,
  });
  persistEdit(id,
    { status: "converted", jobId: job.id, linkedType: "job", linkedId: job.id, linkedLabel: `Job: ${q.title}` },
    newActivity("converted", `Converted to a job from ${q.quoteNumber}`, actor));
  return job;
}

// Convert to a project — creates a real draft project, links it, marks the
// quote converted, and logs activity. Returns the new project.
export function convertQuoteToProject(id: string, actor = currentUser.fullName): Project | undefined {
  const q = getQuote(id);
  if (!q) return;
  const project = createProject({
    companyId: q.companyId, locationId: q.locationId, serviceAreaId: q.serviceAreaId,
    accountId: q.customerId, customerName: q.customerName, customerInitials: q.customerInitials,
    locationName: q.locationName, name: q.title,
    description: `Created from quote ${q.quoteNumber}.`,
    estimatedValue: q.total > 0 ? fmt(q.total) : undefined,
    propertyAddress: q.propertyLabel,
  });
  persistEdit(id,
    { status: "converted", projectId: project.id, linkedType: "project", linkedId: project.id, linkedLabel: `Project: ${q.title}` },
    newActivity("converted", `Converted to a project from ${q.quoteNumber}`, actor));
  return project;
}

// Duplicate a quote into a fresh draft (new number, cleared status/approval).
export function duplicateQuote(id: string): QuoteRecord | undefined {
  const src = getQuote(id);
  if (!src) return;
  const all = getAllQuotes();
  const copy: QuoteRecord = {
    ...src,
    id: `q-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
    quoteNumber: nextNumber("Q", all),
    title: `${src.title} (Copy)`,
    status: "draft",
    approvedAt: undefined,
    createdAt: nowStamp(), updatedAt: nowStamp(),
    lineItems: src.lineItems.map((li, i) => ({ ...li, id: `li-dup-${Date.now()}-${i}` })),
    activity: [newActivity("duplicated", `Duplicated from ${src.quoteNumber}`)],
  };
  _extraQuotes = [copy, ...extraQuotes()];
  try { localStorage.setItem(Q_KEY, JSON.stringify(_extraQuotes)); } catch { /* ignore */ }
  return copy;
}

// Reopen a rejected/expired quote back to an editable draft.
export function reopenQuote(id: string, actor = currentUser.fullName): QuoteRecord | undefined {
  const q = getQuote(id);
  if (!q) return;
  persistEdit(id, { status: "draft", approvedAt: undefined }, newActivity("status", "Reopened as draft", actor));
  return getQuote(id);
}

// Resend a sent quote (logs activity; status unchanged).
export function resendQuote(id: string, actor = currentUser.fullName): void {
  persistEdit(id, {}, newActivity("sent", "Quote re-sent to customer", actor));
}

// Archive — removes the quote from active lists without hard-deleting it.
export function archiveQuote(id: string, actor = currentUser.fullName): void {
  persistEdit(id, { archived: true }, newActivity("status", "Quote archived", actor));
}

// Unarchive — restores an archived quote to the active lists.
export function unarchiveQuote(id: string, actor = currentUser.fullName): void {
  persistEdit(id, { archived: false }, newActivity("status", "Quote unarchived", actor));
}

// Delete — session quotes are removed outright; seed quotes get a deleted flag.
export function deleteQuote(id: string): void {
  if (extraQuotes().some(q => q.id === id)) {
    _extraQuotes = extraQuotes().filter(q => q.id !== id);
    try { localStorage.setItem(Q_KEY, JSON.stringify(_extraQuotes)); } catch { /* ignore */ }
  } else {
    saveOverride(id, { deleted: true });
  }
}

// Create a draft invoice from an approved quote (Net-30) and log it on the quote.
export function createInvoiceFromQuote(id: string): InvoiceRecord | undefined {
  const q = getQuote(id);
  if (!q) return;
  const due = new Date(); due.setDate(due.getDate() + 30);
  const dueDate = due.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  const inv = createInvoice({
    customerId: q.customerId, customerName: q.customerName, customerInitials: q.customerInitials, locationName: q.locationName,
    title: q.title, dueDate,
    lineItems: q.lineItems.filter(li => !li.optional).map((li, i) => ({ ...li, id: `li-inv-${Date.now()}-${i}` })),
    quoteId: q.id, quoteNumber: q.quoteNumber,
    jobId: q.jobId, projectId: q.projectId, agreementId: q.agreementId, propertyId: q.propertyId,
    linkedLabel: `Quote: ${q.quoteNumber}`, linkedType: "quote", linkedId: q.id,
  });
  persistEdit(id, {}, newActivity("converted", `Invoice ${inv.invoiceNumber} created from ${q.quoteNumber}`));
  return inv;
}

// Map captured work-order lines → billing LineItems. Shared by the invoice and
// quote bridges so both carry the same tax flag, catalog ref, and cost.
function linesToLineItems(lines: WorkOrderLineItem[]): LineItem[] {
  const catFor = (k: "part" | "labor" | "fee"): LineItemCategory =>
    k === "part" ? "Materials" : k === "labor" ? "Labor" : "Other";
  return lines.map((li, i) => ({
    id: `li-wo-${Date.now()}-${i}`,
    name: li.description,
    description: li.description,
    quantity: li.qty,
    unitPrice: li.unitPrice,
    total: li.qty * li.unitPrice,
    category: catFor(li.kind),
    // Carry the field-captured tax flag + catalog ref forward; fall back to a
    // kind-based default when the work order line didn't specify taxability.
    taxable: li.taxable ?? li.kind !== "labor",
    itemId: li.itemId,
    unitCost: li.unitCost,
  }));
}

// Which captured lines a billing action should use: the explicitly-selected ids
// when provided, otherwise every line still unbilled (the "bill what's left" path).
function billableLines(wo: { lineItems?: WorkOrderLineItem[] }, lineItemIds?: string[]): WorkOrderLineItem[] {
  const all = wo.lineItems ?? [];
  if (lineItemIds) return all.filter(li => lineItemIds.includes(li.id));
  return all.filter(li => !isBilled(li.id));
}

// Build an invoice from a Work Order's captured parts/labor/fees — the field→billing
// bridge. Bills the selected lines (or every unbilled line when none are given),
// then marks them billed on the job ledger so they can't be billed again. The
// invoice links back to the work order's Job for context.
export function createInvoiceFromWorkOrder(workOrderId: string, lineItemIds?: string[]): InvoiceRecord | undefined {
  const wo = getWorkOrderById(workOrderId);
  if (!wo) return;
  const job = getJob(wo.jobId);
  if (!job) return;
  const lines = billableLines(wo, lineItemIds);
  if (lines.length === 0) return;
  const due = new Date(); due.setDate(due.getDate() + 30);
  const dueDate = due.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  const inv = createInvoice({
    customerId: job.accountId, customerName: job.customerName, customerInitials: job.customerInitials, locationName: job.locationName,
    companyId: job.companyId, locationId: job.locationId, serviceAreaId: job.serviceAreaId,
    title: wo.title || job.title, dueDate, lineItems: linesToLineItems(lines),
    jobId: job.id, workOrderId: wo.id, projectId: job.projectId,
    linkedLabel: `Work Order: ${wo.title}`, linkedType: "job", linkedId: job.id,
  });
  markLinesBilled(lines.map(l => l.id), { invoiceId: inv.id, jobId: job.id, workOrderId: wo.id });
  return inv;
}

// Build a quote from a Work Order — the field-upsell path ("your blower's also
// failing, here's the price"). A quote is a PROPOSAL, so it does NOT consume the
// ledger (nothing is marked billed). Seeds from the selected/unbilled captured
// lines and links back to the work order + its Job. Starts as a draft custom quote.
export function createQuoteFromWorkOrder(workOrderId: string, lineItemIds?: string[]): QuoteRecord | undefined {
  const wo = getWorkOrderById(workOrderId);
  if (!wo) return;
  const job = getJob(wo.jobId);
  if (!job) return;
  const lines = billableLines(wo, lineItemIds);
  if (lines.length === 0) return;
  return createQuote({
    customerId: job.accountId, customerName: job.customerName, customerInitials: job.customerInitials, locationName: job.locationName,
    companyId: job.companyId, locationId: job.locationId, serviceAreaId: job.serviceAreaId,
    title: wo.title || job.title, lineItems: linesToLineItems(lines),
    jobId: job.id, workOrderId: wo.id, projectId: job.projectId,
    linkedLabel: `Work Order: ${wo.title}`, linkedType: "job", linkedId: job.id,
  });
}

// ─── Lookup helpers ───────────────────────────────────────
// Resolves any non-deleted quote (incl. archived) so the detail page still
// opens an archived quote from the Archived tab; lists use getAllQuotes.
export function getQuote(id: string): QuoteRecord | undefined {
  return [...extraQuotes(), ...ALL_QUOTES].map(applyOverride).find(q => q.id === id && !q.deleted);
}
export { QUOTE_TEMPLATES, getQuoteTemplate } from "./templates";
export function getInvoice(id: string): InvoiceRecord | undefined { return getAllInvoices().find(i => i.id === id); }

// Delete every quote/invoice under a company (hierarchy cascade). Includes
// archived quotes so nothing for the company lingers.
export function deleteQuotesByCompany(companyId: string): void {
  [...getAllQuotes(), ...getArchivedQuotes()]
    .filter(q => q.companyId === companyId)
    .forEach(q => deleteQuote(q.id));
}
export function deleteInvoicesByCompany(companyId: string): void {
  getAllInvoices().filter(i => i.companyId === companyId).forEach(i => deleteInvoice(i.id));
}

export function getQuotesForCustomer(customerId: string): QuoteRecord[] {
  return getAllQuotes().filter(q => q.customerId === customerId);
}
export function getInvoicesForCustomer(customerId: string): InvoiceRecord[] {
  return getAllInvoices().filter(i => i.customerId === customerId);
}
export function getQuotesForJob(jobId: string): QuoteRecord[] {
  return getAllQuotes().filter(q => q.jobId === jobId);
}
export function getInvoicesForJob(jobId: string): InvoiceRecord[] {
  return getAllInvoices().filter(i => i.jobId === jobId);
}
export function getQuotesForWorkOrder(workOrderId: string): QuoteRecord[] {
  return getAllQuotes().filter(q => q.workOrderId === workOrderId);
}
export function getInvoicesForWorkOrder(workOrderId: string): InvoiceRecord[] {
  return getAllInvoices().filter(i => i.workOrderId === workOrderId);
}
export function getQuotesForLead(leadId: string): QuoteRecord[] {
  return getAllQuotes().filter(q => q.leadId === leadId);
}
export function getQuotesForProject(projectId: string): QuoteRecord[] {
  return getAllQuotes().filter(q => q.projectId === projectId);
}
export function getInvoicesForProject(projectId: string): InvoiceRecord[] {
  return getAllInvoices().filter(i => i.projectId === projectId);
}

// ─── Totals + numbering ───────────────────────────────────
export function computeTotals(items: LineItem[], taxRate = 0): { subtotal: number; tax: number; total: number } {
  const base = items.filter(i => !i.optional);
  const subtotal = base.reduce((s, i) => s + i.total, 0);
  const taxable  = base.filter(i => i.taxable).reduce((s, i) => s + i.total, 0);
  const tax = Math.round(taxable * taxRate * 100) / 100;
  return { subtotal, tax, total: subtotal + tax };
}

function nextNumber(prefix: string, existing: { quoteNumber?: string; invoiceNumber?: string }[]): string {
  const year = 2026;
  const n = existing.length + 1;
  return `${prefix}-${year}-${String(n).padStart(4, "0")}`;
}

export interface NewQuoteInput {
  customerId: string; customerName: string; customerInitials: string; locationName: string;
  title: string; lineItems: LineItem[]; taxRate?: number; expiresAt?: string;
  // Hierarchy (derived from the customer by the caller; defaults applied if absent)
  companyId?: string; locationId?: string; serviceAreaId?: string;
  // Context links
  leadId?: string; jobId?: string; workOrderId?: string; projectId?: string; agreementId?: string; propertyId?: string;
  propertyLabel?: string;
  linkedLabel?: string; linkedType?: QuoteRecord["linkedType"]; linkedId?: string;
  // Metadata
  templateKey?: string; quoteDesignId?: string; assignedTo?: string; customerNotes?: string; internalNotes?: string;
  // How the quote was created (drives which editor it opens). Defaults to "custom".
  quoteMode?: QuoteMode;
  // How the Quote Design renders this quote's content (quick/single/multi/etc.).
  renderMode?: QuoteRenderMode;
  // Salesbook this quote was started from (template path)
  salesbookId?: string;
  // Proposal template structure (snapshot-copied into the quote)
  proposalTemplateId?: string; sections?: QuoteSection[];
  // Option cards (snapshot-copied from a salesbook) + pricing-wizard results
  options?: QuoteOption[]; pricing?: QuotePricing;
  // Create as sent rather than draft (logs a "sent" activity entry)
  markSent?: boolean;
}

export function createQuote(input: NewQuoteInput): QuoteRecord {
  const totals = computeTotals(input.lineItems, input.taxRate ?? 0);
  const all = getAllQuotes();
  const id = `q-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`;
  const number = nextNumber("Q", all);
  const status: QuoteStatus = input.markSent ? "sent" : "draft";
  const activity: QuoteActivity[] = [newActivity("created", `Quote ${number} created`)];
  if (input.markSent) activity.push(newActivity("sent", "Marked Sent"));

  const q: QuoteRecord = {
    id,
    organizationId: "org_northstar",
    companyId: input.companyId ?? "co_hvac",
    locationId: input.locationId ?? "loc_augusta",
    serviceAreaId: input.serviceAreaId,
    customerId: input.customerId,
    propertyId: input.propertyId, leadId: input.leadId, jobId: input.jobId, workOrderId: input.workOrderId,
    projectId: input.projectId, agreementId: input.agreementId,
    quoteNumber: number, title: input.title, status,
    quoteMode: input.quoteMode ?? "custom",
    renderMode: input.renderMode,
    ...totals, expiresAt: input.expiresAt,
    assignedUserId: undefined,
    createdBy: currentUser.fullName,
    createdAt: nowStamp(), updatedAt: nowStamp(),
    lineItems: input.lineItems,
    customerName: input.customerName, customerInitials: input.customerInitials, locationName: input.locationName,
    propertyLabel: input.propertyLabel,
    templateKey: input.templateKey, quoteDesignId: input.quoteDesignId, assignedTo: input.assignedTo ?? currentUser.fullName,
    salesbookId: input.salesbookId,
    proposalTemplateId: input.proposalTemplateId, sections: input.sections,
    options: input.options, pricing: input.pricing,
    customerNotes: input.customerNotes, internalNotes: input.internalNotes,
    activity,
    linkedLabel: input.linkedLabel, linkedType: input.linkedType, linkedId: input.linkedId,
  };
  _extraQuotes = [q, ...extraQuotes()];
  try { localStorage.setItem(Q_KEY, JSON.stringify(_extraQuotes)); } catch { /* ignore */ }
  return q;
}

export interface NewInvoiceInput {
  customerId: string; customerName: string; customerInitials: string; locationName: string;
  title: string; lineItems: LineItem[]; taxRate?: number; dueDate: string;
  companyId?: string; locationId?: string; serviceAreaId?: string;
  propertyLabel?: string; customerNotes?: string; internalNotes?: string;
  quoteId?: string; quoteNumber?: string; jobId?: string; workOrderId?: string; projectId?: string; agreementId?: string; propertyId?: string;
  linkedLabel?: string; linkedType?: InvoiceRecord["linkedType"]; linkedId?: string;
  isDeposit?: boolean;
}

// Create a draft invoice from a (typically completed) job. Uses the job's
// actual/estimated amount as a single line item; Net-30 due date.
export function createInvoiceFromJob(jobId: string): InvoiceRecord | undefined {
  const job = getJob(jobId);
  if (!job) return;
  const amount = parseFloat(String(job.actualAmount ?? job.estimatedAmount ?? "0").replace(/[^0-9.]/g, "")) || 0;
  const due = new Date(); due.setDate(due.getDate() + 30);
  const dueDate = due.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  return createInvoice({
    customerId: job.accountId, customerName: job.customerName, customerInitials: job.customerInitials, locationName: job.locationName,
    title: job.title, dueDate,
    lineItems: [{ id: `li-job-${Date.now()}`, description: job.title, quantity: 1, unitPrice: amount, total: amount }],
    jobId: job.id, projectId: job.projectId,
    linkedLabel: `Job: ${job.title}`, linkedType: "job", linkedId: job.id,
  });
}

// Paid deposits on a job that haven't yet been credited to a final invoice.
export function getUnappliedDeposits(jobId: string): InvoiceRecord[] {
  return getInvoicesForJob(jobId).filter(i => i.isDeposit && i.status === "paid" && !i.depositAppliedTo);
}

// Create a job-level deposit / down-payment invoice — a single "Deposit" line for
// a fixed amount, NOT tied to any captured work. Once paid, the final ledger
// invoice credits it automatically (see createInvoiceFromJobLedger).
export function createDepositInvoice(jobId: string, amount: number, label = "Deposit"): InvoiceRecord | undefined {
  const job = getJob(jobId);
  if (!job || amount <= 0) return;
  const due = new Date(); due.setDate(due.getDate() + 7);
  const dueDate = due.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  return createInvoice({
    customerId: job.accountId, customerName: job.customerName, customerInitials: job.customerInitials, locationName: job.locationName,
    companyId: job.companyId, locationId: job.locationId, serviceAreaId: job.serviceAreaId,
    title: `${label} — ${job.title}`, dueDate,
    lineItems: [{ id: `li-dep-${Date.now()}`, name: label, description: label, quantity: 1, unitPrice: amount, total: amount, taxable: false, category: "Other" }],
    jobId: job.id, projectId: job.projectId, isDeposit: true,
    linkedLabel: `Job: ${job.title}`, linkedType: "job", linkedId: job.id,
  });
}

// Bill a Job from its billable-items ledger — the cross-work-order path. Draws
// the selected captured lines (or every unbilled line across all the job's work
// orders when none are given), credits any paid-but-unapplied deposits, makes one
// invoice, and marks the lines billed. This is how a multi-visit job settles its
// running tab in one document.
export function createInvoiceFromJobLedger(jobId: string, lineItemIds?: string[]): InvoiceRecord | undefined {
  const job = getJob(jobId);
  if (!job) return;
  const ledger = getJobLedger(jobId);
  const lines = lineItemIds
    ? ledger.filter(l => lineItemIds.includes(l.id) && !l.billed)
    : ledger.filter(l => !l.billed);
  if (lines.length === 0) return;
  const due = new Date(); due.setDate(due.getDate() + 30);
  const dueDate = due.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  // Credit paid deposits as negative lines so the final invoice nets them out.
  const deposits = getUnappliedDeposits(jobId);
  const depositLines: LineItem[] = deposits.map((d, i) => ({
    id: `li-depcr-${Date.now()}-${i}`, name: "Deposit applied", description: `Deposit applied (${d.invoiceNumber})`,
    quantity: 1, unitPrice: -d.total, total: -d.total, taxable: false, category: "Other",
  }));
  const inv = createInvoice({
    customerId: job.accountId, customerName: job.customerName, customerInitials: job.customerInitials, locationName: job.locationName,
    companyId: job.companyId, locationId: job.locationId, serviceAreaId: job.serviceAreaId,
    title: job.title, dueDate, lineItems: [...linesToLineItems(lines), ...depositLines],
    jobId: job.id, projectId: job.projectId,
    linkedLabel: `Job: ${job.title}`, linkedType: "job", linkedId: job.id,
  });
  markLedgerLinesBilled(lines.map(l => ({ id: l.id, workOrderId: l.workOrderId })), { invoiceId: inv.id, jobId: job.id });
  deposits.forEach(d => persistInvoiceEdit(d.id, { depositAppliedTo: inv.id }));
  return inv;
}

export function createInvoice(input: NewInvoiceInput): InvoiceRecord {
  const totals = computeTotals(input.lineItems, input.taxRate ?? 0);
  const all = getAllInvoices();
  const inv: InvoiceRecord = {
    id: `inv-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
    organizationId: "org_northstar",
    companyId: input.companyId ?? "co_hvac", locationId: input.locationId ?? "loc_augusta", serviceAreaId: input.serviceAreaId,
    customerId: input.customerId,
    propertyId: input.propertyId, jobId: input.jobId, workOrderId: input.workOrderId, projectId: input.projectId, agreementId: input.agreementId,
    quoteId: input.quoteId,
    invoiceNumber: nextNumber("INV", all), title: input.title, status: "draft",
    ...totals, balanceDue: totals.total, dueDate: input.dueDate,
    createdBy: currentUser.fullName,
    createdAt: nowStamp(), updatedAt: nowStamp(),
    lineItems: input.lineItems,
    customerName: input.customerName, customerInitials: input.customerInitials, locationName: input.locationName,
    customerNotes: input.customerNotes, internalNotes: input.internalNotes,
    linkedLabel: input.linkedLabel, linkedType: input.linkedType, linkedId: input.linkedId,
    quoteNumber: input.quoteNumber,
    isDeposit: input.isDeposit,
  };
  _extraInvoices = [inv, ...extraInvoices()];
  try { localStorage.setItem(I_KEY, JSON.stringify(_extraInvoices)); } catch { /* ignore */ }
  return inv;
}
