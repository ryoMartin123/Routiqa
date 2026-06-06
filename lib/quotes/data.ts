// ─── Quotes & Invoices — mock data ────────────────────────
// Extends the base types in lib/quotes/types.ts with line items,
// display-only fields, and linked-record labels for list/detail views.
//
// Replace with Supabase queries when ready:
//   supabase.from('quotes').select('*, line_items(*)')
//     .eq('organization_id', orgId).order('created_at', { ascending: false })

import type { Quote, Invoice, QuoteStatus, InvoiceStatus, LineItemCategory } from "./types";
import { QUOTE_STATUS_STYLE } from "./types";
import { createJob, getJob, type Job } from "@/lib/jobs/data";
import { createProject, type Project } from "@/lib/projects/data";

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
// Snapshot of a template section on the quote. Editing the template later does
// not change existing quotes — each quote owns its section copy.
export interface QuoteSection {
  key: string;          // proposal SectionKey (e.g. "recommended_solution")
  label: string;
  body: string;         // editable customer-facing wording
  visible: boolean;
}

// ─── Activity log (per quote) ─────────────────────────────
export type QuoteActivityKind =
  | "created" | "duplicated" | "status" | "sent" | "approved"
  | "rejected" | "converted" | "note" | "edited";

export interface QuoteActivity {
  id: string;
  at: string;          // display date/time
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
  proposalTemplateId?: string;     // proposal template the quote was built from
  sections?: QuoteSection[];       // ordered, snapshot-copied proposal sections
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
function newActivity(kind: QuoteActivityKind, message: string, actor = "Marcus Reyes"): QuoteActivity {
  return { id: `qa-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`, at: nowStamp(), actor, kind, message };
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
export function updateQuoteStatus(id: string, status: QuoteStatus, actor = "Marcus Reyes"): QuoteRecord | undefined {
  const q = getQuote(id);
  if (!q) return;
  const patch: Partial<QuoteRecord> = { status };
  if (status === "approved") patch.approvedAt = nowStamp();
  const kind = STATUS_VERB[status] ?? "status";
  const label = STATUS_LABEL[status];
  persistEdit(id, patch, newActivity(kind, `Marked ${label}`, actor));
  return getQuote(id);
}

export function setQuoteNotes(id: string, notes: { internalNotes?: string; customerNotes?: string }, actor = "Marcus Reyes"): void {
  persistEdit(id, notes, newActivity("note", "Notes updated", actor));
}

// Edit a quote's contents (title, line items, totals, notes, links). Used by the
// edit flow; logs an "edited" activity entry.
export function updateQuote(id: string, patch: Partial<QuoteRecord>, actor = "Marcus Reyes"): QuoteRecord | undefined {
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
export function convertQuoteToJob(id: string, actor = "Marcus Reyes"): Job | undefined {
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
export function convertQuoteToProject(id: string, actor = "Marcus Reyes"): Project | undefined {
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
export function reopenQuote(id: string, actor = "Marcus Reyes"): QuoteRecord | undefined {
  const q = getQuote(id);
  if (!q) return;
  persistEdit(id, { status: "draft", approvedAt: undefined }, newActivity("status", "Reopened as draft", actor));
  return getQuote(id);
}

// Resend a sent quote (logs activity; status unchanged).
export function resendQuote(id: string, actor = "Marcus Reyes"): void {
  persistEdit(id, {}, newActivity("sent", "Quote re-sent to customer", actor));
}

// Archive — removes the quote from active lists without hard-deleting it.
export function archiveQuote(id: string, actor = "Marcus Reyes"): void {
  persistEdit(id, { archived: true }, newActivity("status", "Quote archived", actor));
}

// Unarchive — restores an archived quote to the active lists.
export function unarchiveQuote(id: string, actor = "Marcus Reyes"): void {
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
  leadId?: string; jobId?: string; projectId?: string; agreementId?: string; propertyId?: string;
  propertyLabel?: string;
  linkedLabel?: string; linkedType?: QuoteRecord["linkedType"]; linkedId?: string;
  // Metadata
  templateKey?: string; assignedTo?: string; customerNotes?: string; internalNotes?: string;
  // Proposal template structure (snapshot-copied into the quote)
  proposalTemplateId?: string; sections?: QuoteSection[];
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
    propertyId: input.propertyId, leadId: input.leadId, jobId: input.jobId,
    projectId: input.projectId, agreementId: input.agreementId,
    quoteNumber: number, title: input.title, status,
    ...totals, expiresAt: input.expiresAt,
    assignedUserId: undefined,
    createdBy: "Marcus Reyes",
    createdAt: nowStamp(), updatedAt: nowStamp(),
    lineItems: input.lineItems,
    customerName: input.customerName, customerInitials: input.customerInitials, locationName: input.locationName,
    propertyLabel: input.propertyLabel,
    templateKey: input.templateKey, assignedTo: input.assignedTo ?? "Marcus Reyes",
    proposalTemplateId: input.proposalTemplateId, sections: input.sections,
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
  quoteId?: string; quoteNumber?: string; jobId?: string; projectId?: string; agreementId?: string; propertyId?: string;
  linkedLabel?: string; linkedType?: InvoiceRecord["linkedType"]; linkedId?: string;
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

export function createInvoice(input: NewInvoiceInput): InvoiceRecord {
  const totals = computeTotals(input.lineItems, input.taxRate ?? 0);
  const all = getAllInvoices();
  const inv: InvoiceRecord = {
    id: `inv-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
    organizationId: "org_northstar",
    companyId: input.companyId ?? "co_hvac", locationId: input.locationId ?? "loc_augusta", serviceAreaId: input.serviceAreaId,
    customerId: input.customerId,
    propertyId: input.propertyId, jobId: input.jobId, projectId: input.projectId, agreementId: input.agreementId,
    quoteId: input.quoteId,
    invoiceNumber: nextNumber("INV", all), title: input.title, status: "draft",
    ...totals, balanceDue: totals.total, dueDate: input.dueDate,
    createdBy: "Marcus Reyes",
    createdAt: nowStamp(), updatedAt: nowStamp(),
    lineItems: input.lineItems,
    customerName: input.customerName, customerInitials: input.customerInitials, locationName: input.locationName,
    customerNotes: input.customerNotes, internalNotes: input.internalNotes,
    linkedLabel: input.linkedLabel, linkedType: input.linkedType, linkedId: input.linkedId,
    quoteNumber: input.quoteNumber,
  };
  _extraInvoices = [inv, ...extraInvoices()];
  try { localStorage.setItem(I_KEY, JSON.stringify(_extraInvoices)); } catch { /* ignore */ }
  return inv;
}
