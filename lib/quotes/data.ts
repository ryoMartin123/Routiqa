// ─── Quotes & Invoices — mock data ────────────────────────
// Extends the base types in lib/quotes/types.ts with line items,
// display-only fields, and linked-record labels for list/detail views.
//
// Replace with Supabase queries when ready:
//   supabase.from('quotes').select('*, line_items(*)')
//     .eq('organization_id', orgId).order('created_at', { ascending: false })

import type { Quote, Invoice, QuoteStatus, InvoiceStatus, LineItemCategory } from "./types";
import { QUOTE_STATUS_STYLE } from "./types";

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
}

export interface InvoiceRecord extends Invoice {
  lineItems: LineItem[];
  internalNotes?: string;
  // Denormalized
  customerName: string;
  customerInitials: string;
  locationName: string;
  linkedLabel?: string;
  linkedType?: "quote" | "job" | "project" | "agreement";
  linkedId?: string;
  quoteNumber?: string;
}

// ─── Currency helper ──────────────────────────────────────
export const fmt = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 });

// ─── Mock quotes ──────────────────────────────────────────
export const ALL_QUOTES: QuoteRecord[] = [
  {
    id: "q001",
    organizationId: "org_northstar", companyId: "co_hvac",
    locationId: "loc_augusta", serviceAreaId: "sa_augusta",
    customerId: "1",
    leadId: "l1",
    quoteNumber: "Q-2026-0001", title: "Water Heater Replacement",
    status: "sent", subtotal: 1200, tax: 0, total: 1200,
    expiresAt: "Jun 20, 2026",
    createdBy: "J. Patel", createdAt: "2026-05-20", updatedAt: "2026-05-20",
    customerName: "Sarah Mitchell", customerInitials: "SM",
    locationName: "Augusta Branch",
    linkedLabel: "Lead: Water Heater Replacement", linkedType: "lead", linkedId: "l1",
    lineItems: [
      { id: "li-q001-1", description: "Bradford White RE250S6-1NCWW 50-gal Electric Water Heater", quantity: 1, unitPrice: 850, total: 850 },
      { id: "li-q001-2", description: "Installation Labor (3 hrs)",                                quantity: 1, unitPrice: 285, total: 285 },
      { id: "li-q001-3", description: "Old Unit Disposal & Haul Away",                            quantity: 1, unitPrice: 65,  total: 65  },
    ],
  },
  {
    id: "q002",
    organizationId: "org_northstar", companyId: "co_roofing",
    locationId: "loc_columbia", serviceAreaId: "sa_columbia",
    customerId: "2",
    projectId: "p2",
    quoteNumber: "Q-2026-0002", title: "Full Roof Replacement",
    status: "approved", subtotal: 48000, tax: 0, total: 48000,
    approvedAt: "Apr 5, 2026",
    createdBy: "D. Nguyen", createdAt: "2026-03-20", updatedAt: "2026-04-05",
    customerName: "Hammond LLC", customerInitials: "HL",
    locationName: "Columbia Branch",
    linkedLabel: "Project: Hammond Roof Replacement", linkedType: "project", linkedId: "p2",
    lineItems: [
      { id: "li-q002-1", description: "Tear-Off & Debris Removal (12,000 sqft)",          quantity: 1, unitPrice: 8400,  total: 8400  },
      { id: "li-q002-2", description: "30-Year Architectural Shingles (materials)",        quantity: 1, unitPrice: 24000, total: 24000 },
      { id: "li-q002-3", description: "Underlayment, Ice & Water Shield",                  quantity: 1, unitPrice: 6200,  total: 6200  },
      { id: "li-q002-4", description: "Flashing, Drip Edge & Penetration Work",           quantity: 1, unitPrice: 3800,  total: 3800  },
      { id: "li-q002-5", description: "Cleanup, Dumpster & Haul-Off",                     quantity: 1, unitPrice: 5600,  total: 5600  },
    ],
  },
  {
    id: "q003",
    organizationId: "org_northstar", companyId: "co_hvac",
    locationId: "loc_augusta", serviceAreaId: "sa_augusta",
    customerId: "2",
    leadId: "l2",
    quoteNumber: "Q-2026-0003", title: "Building 2 HVAC Upgrade — Assessment",
    status: "draft", subtotal: 0, tax: 0, total: 0,
    createdBy: "M. Cole", createdAt: "2026-05-15", updatedAt: "2026-05-15",
    customerName: "Hammond LLC", customerInitials: "HL",
    locationName: "Augusta Branch",
    linkedLabel: "Lead: Building 2 HVAC Upgrade", linkedType: "lead", linkedId: "l2",
    lineItems: [],
    internalNotes: "Pending site assessment Jun 3. Line items to be added after visit.",
  },
  {
    id: "q004",
    organizationId: "org_northstar", companyId: "co_hvac",
    locationId: "loc_augusta", serviceAreaId: "sa_augusta",
    customerId: "999", // prospect, not yet a customer
    leadId: "l5",
    quoteNumber: "Q-2026-0004", title: "3-Property Commercial Maintenance Agreement",
    status: "sent", subtotal: 3600, tax: 0, total: 3600,
    expiresAt: "Jun 15, 2026",
    createdBy: "Sara (CSR)", createdAt: "2026-05-22", updatedAt: "2026-05-22",
    customerName: "Peach State Properties", customerInitials: "PS",
    locationName: "Augusta Branch",
    linkedLabel: "Lead: Commercial Maintenance Agreement", linkedType: "lead", linkedId: "l5",
    lineItems: [
      { id: "li-q004-1", description: "Annual HVAC Maintenance — 1100 Gordon Hwy (Property A)", quantity: 1, unitPrice: 1200, total: 1200 },
      { id: "li-q004-2", description: "Annual HVAC Maintenance — Property B",                    quantity: 1, unitPrice: 1200, total: 1200 },
      { id: "li-q004-3", description: "Annual HVAC Maintenance — Property C",                    quantity: 1, unitPrice: 1200, total: 1200 },
    ],
  },
  {
    id: "q005",
    organizationId: "org_northstar", companyId: "co_hvac",
    locationId: "loc_augusta", serviceAreaId: "sa_grovetown",
    customerId: "998", // prospect
    leadId: "l4",
    quoteNumber: "Q-2026-0005", title: "Heat Pump Replacement — Holloway Residence",
    status: "draft", subtotal: 6800, tax: 0, total: 6800,
    expiresAt: "Jun 30, 2026",
    createdBy: "J. Patel", createdAt: "2026-05-29", updatedAt: "2026-05-29",
    customerName: "Patricia Holloway", customerInitials: "PH",
    locationName: "Augusta Branch",
    linkedLabel: "Lead: Heat Pump Replacement", linkedType: "lead", linkedId: "l4",
    lineItems: [
      { id: "li-q005-1", description: "Carrier 3-ton Heat Pump (24ACC636A003)",     quantity: 1, unitPrice: 3200, total: 3200 },
      { id: "li-q005-2", description: "Carrier Air Handler (FE4ANF003)",            quantity: 1, unitPrice: 1800, total: 1800 },
      { id: "li-q005-3", description: "Refrigerant Lines, Fittings & Disconnect",   quantity: 1, unitPrice: 450,  total: 450  },
      { id: "li-q005-4", description: "Installation Labor (8 hrs)",                 quantity: 1, unitPrice: 960,  total: 960  },
      { id: "li-q005-5", description: "Electrical Whip & Wiring",                   quantity: 1, unitPrice: 390,  total: 390  },
    ],
  },
  {
    id: "q006",
    organizationId: "org_northstar", companyId: "co_roofing",
    locationId: "loc_columbia", serviceAreaId: "sa_columbia",
    customerId: "6",
    leadId: "l11",
    quoteNumber: "Q-2026-0006", title: "Consulting Retainer — Southeast Restoration",
    status: "sent", subtotal: 9000, tax: 0, total: 9000,
    expiresAt: "Jun 30, 2026",
    createdBy: "Marcus Reyes", createdAt: "2026-05-18", updatedAt: "2026-05-18",
    customerName: "Southeast Restoration", customerInitials: "SR",
    locationName: "Columbia Branch",
    linkedLabel: "Lead: Consulting Retainer", linkedType: "lead", linkedId: "l11",
    lineItems: [
      { id: "li-q006-1", description: "Monthly Consulting Retainer", quantity: 3, unitPrice: 3000, total: 9000, notes: "3-month initial term" },
    ],
  },
  {
    id: "q007",
    organizationId: "org_northstar", companyId: "co_hvac",
    locationId: "loc_evans", serviceAreaId: "sa_evans",
    customerId: "11",
    leadId: "l8",
    quoteNumber: "Q-2026-0007", title: "New Construction HVAC — Dunbar Residence",
    status: "sent", subtotal: 10950, tax: 0, total: 10950,
    expiresAt: "Jul 15, 2026",
    createdBy: "J. Patel", createdAt: "2026-05-28", updatedAt: "2026-05-28",
    customerName: "Michael Dunbar", customerInitials: "MD",
    locationName: "Evans Branch",
    linkedLabel: "Lead: New Construction HVAC Install", linkedType: "lead", linkedId: "l8",
    lineItems: [
      { id: "li-q007-1", description: "Carrier 4-ton Heat Pump System",              quantity: 1, unitPrice: 4200, total: 4200 },
      { id: "li-q007-2", description: "Ductwork Installation (new construction)",    quantity: 1, unitPrice: 3800, total: 3800 },
      { id: "li-q007-3", description: "Air Handler Install & Attic Platform",        quantity: 1, unitPrice: 1600, total: 1600 },
      { id: "li-q007-4", description: "Electrical, Controls & Thermostat",           quantity: 1, unitPrice: 900,  total: 900  },
      { id: "li-q007-5", description: "Permit & Inspection Coordination",            quantity: 1, unitPrice: 450,  total: 450  },
    ],
  },
  {
    id: "q008",
    organizationId: "org_northstar", companyId: "co_hvac",
    locationId: "loc_augusta", serviceAreaId: "sa_augusta",
    customerId: "7",
    projectId: "p1",
    quoteNumber: "Q-2026-0008", title: "Carrier Heat Pump System — Alvarez Residence",
    status: "converted", subtotal: 7400, tax: 0, total: 7400,
    approvedAt: "May 15, 2026",
    createdBy: "J. Patel", createdAt: "2026-05-10", updatedAt: "2026-05-15",
    customerName: "Alvarez Residence", customerInitials: "AR",
    locationName: "Augusta Branch",
    linkedLabel: "Project: Alvarez HVAC Replacement", linkedType: "project", linkedId: "p1",
    lineItems: [
      { id: "li-q008-1", description: "Carrier 4-ton Heat Pump (24ACC648A003)",    quantity: 1, unitPrice: 3800, total: 3800 },
      { id: "li-q008-2", description: "Carrier Air Handler (FE4ANF005)",           quantity: 1, unitPrice: 2100, total: 2100 },
      { id: "li-q008-3", description: "Refrigerant Lines & Accessories",           quantity: 1, unitPrice: 480,  total: 480  },
      { id: "li-q008-4", description: "Equipment Removal & Disposal",              quantity: 1, unitPrice: 320,  total: 320  },
      { id: "li-q008-5", description: "Installation Labor (8 hrs)",                quantity: 1, unitPrice: 700,  total: 700  },
    ],
  },
];

// ─── Mock invoices ────────────────────────────────────────
export const ALL_INVOICES: InvoiceRecord[] = [
  {
    id: "inv001",
    organizationId: "org_northstar", companyId: "co_hvac",
    locationId: "loc_augusta", serviceAreaId: "sa_augusta",
    customerId: "3",
    jobId: "j2",
    invoiceNumber: "INV-2026-0001", title: "Water Heater Emergency Repair — K. Brennan",
    status: "paid", subtotal: 285, tax: 0, total: 285, balanceDue: 0,
    dueDate: "May 27, 2026", paidAt: "May 20, 2026",
    createdBy: "J. Patel", createdAt: "2026-05-20", updatedAt: "2026-05-20",
    customerName: "K. Brennan", customerInitials: "KB",
    locationName: "Augusta Branch",
    linkedLabel: "Job: Water Heater Emergency Repair", linkedType: "job", linkedId: "j2",
    lineItems: [
      { id: "li-inv001-1", description: "T&P Valve Replacement (Watts 100XL)",    quantity: 1, unitPrice: 180, total: 180 },
      { id: "li-inv001-2", description: "Upper Thermostat Replacement",           quantity: 1, unitPrice: 85,  total: 85  },
      { id: "li-inv001-3", description: "Service Call & Labor (1 hr)",            quantity: 1, unitPrice: 20,  total: 20  },
    ],
  },
  {
    id: "inv002",
    organizationId: "org_northstar", companyId: "co_hvac",
    locationId: "loc_augusta", serviceAreaId: "sa_augusta",
    customerId: "13",
    jobId: "j6",
    invoiceNumber: "INV-2026-0002", title: "Filter Replacement — Donna Reeves",
    status: "paid", subtotal: 45, tax: 0, total: 45, balanceDue: 0,
    dueDate: "May 22, 2026", paidAt: "May 15, 2026",
    createdBy: "J. Patel", createdAt: "2026-05-15", updatedAt: "2026-05-15",
    customerName: "Donna Reeves", customerInitials: "DR",
    locationName: "Augusta Branch",
    linkedLabel: "Job: Filter Replacement", linkedType: "job", linkedId: "j6",
    lineItems: [
      { id: "li-inv002-1", description: "Air Filter 20x25x1 MERV-8",   quantity: 1, unitPrice: 28, total: 28 },
      { id: "li-inv002-2", description: "Labor (30 min)",               quantity: 1, unitPrice: 17, total: 17 },
    ],
  },
  {
    id: "inv003",
    organizationId: "org_northstar", companyId: "co_hvac",
    locationId: "loc_evans", serviceAreaId: "sa_evans",
    customerId: "12",
    jobId: "j12",
    invoiceNumber: "INV-2026-0003", title: "HVAC Emergency Repair — Evans Professional Park",
    status: "paid", subtotal: 650, tax: 0, total: 650, balanceDue: 0,
    dueDate: "Jun 1, 2026", paidAt: "May 28, 2026",
    createdBy: "M. Cole", createdAt: "2026-05-25", updatedAt: "2026-05-28",
    customerName: "Evans Professional Park", customerInitials: "EP",
    locationName: "Evans Branch",
    linkedLabel: "Job: Commercial HVAC Emergency Repair", linkedType: "job", linkedId: "j12",
    lineItems: [
      { id: "li-inv003-1", description: "Blower Motor Replacement — Unit A",    quantity: 1, unitPrice: 380, total: 380 },
      { id: "li-inv003-2", description: "Emergency Dispatch Fee",               quantity: 1, unitPrice: 150, total: 150 },
      { id: "li-inv003-3", description: "Labor (2.5 hrs)",                      quantity: 1, unitPrice: 120, total: 120 },
    ],
  },
  {
    id: "inv004",
    organizationId: "org_northstar", companyId: "co_roofing",
    locationId: "loc_columbia", serviceAreaId: "sa_columbia",
    customerId: "2",
    projectId: "p2",
    quoteId: "q002",
    invoiceNumber: "INV-2026-0004", title: "Roof Replacement — 50% Deposit",
    status: "sent", subtotal: 24000, tax: 0, total: 24000, balanceDue: 24000,
    dueDate: "Jun 10, 2026",
    createdBy: "D. Nguyen", createdAt: "2026-05-01", updatedAt: "2026-05-01",
    customerName: "Hammond LLC", customerInitials: "HL",
    locationName: "Columbia Branch",
    linkedLabel: "Project: Hammond Roof Replacement", linkedType: "project", linkedId: "p2",
    quoteNumber: "Q-2026-0002",
    lineItems: [
      { id: "li-inv004-1", description: "Progress Invoice — 50% Project Deposit", quantity: 1, unitPrice: 24000, total: 24000, notes: "Balance of $24,000 due on project completion" },
    ],
  },
  {
    id: "inv005",
    organizationId: "org_northstar", companyId: "co_hvac",
    locationId: "loc_augusta", serviceAreaId: "sa_augusta",
    customerId: "7",
    projectId: "p1",
    jobId: "pj1-2",
    quoteId: "q008",
    invoiceNumber: "INV-2026-0005", title: "Carrier Heat Pump System Installation — Alvarez",
    status: "sent", subtotal: 7400, tax: 0, total: 7400, balanceDue: 7400,
    dueDate: "Jun 5, 2026",
    createdBy: "J. Patel", createdAt: "2026-05-28", updatedAt: "2026-05-28",
    customerName: "Alvarez Residence", customerInitials: "AR",
    locationName: "Augusta Branch",
    linkedLabel: "Project: Alvarez HVAC Replacement", linkedType: "project", linkedId: "p1",
    quoteNumber: "Q-2026-0008",
    lineItems: [
      { id: "li-inv005-1", description: "Carrier 4-ton Heat Pump (24ACC648A003)", quantity: 1, unitPrice: 3800, total: 3800 },
      { id: "li-inv005-2", description: "Carrier Air Handler (FE4ANF005)",        quantity: 1, unitPrice: 2100, total: 2100 },
      { id: "li-inv005-3", description: "Refrigerant Lines & Accessories",        quantity: 1, unitPrice: 480,  total: 480  },
      { id: "li-inv005-4", description: "Equipment Removal & Disposal",           quantity: 1, unitPrice: 320,  total: 320  },
      { id: "li-inv005-5", description: "Installation Labor (8 hrs)",             quantity: 1, unitPrice: 700,  total: 700  },
    ],
  },
  {
    id: "inv006",
    organizationId: "org_northstar", companyId: "co_hvac",
    locationId: "loc_augusta", serviceAreaId: "sa_grovetown",
    customerId: "10",
    jobId: "j7",
    invoiceNumber: "INV-2026-0006", title: "Monthly Property Walkthrough — Grovetown Storage",
    status: "past_due", subtotal: 225, tax: 0, total: 225, balanceDue: 225,
    dueDate: "May 15, 2026",
    createdBy: "D. Nguyen", createdAt: "2026-05-01", updatedAt: "2026-05-01",
    customerName: "Grovetown Storage LLC", customerInitials: "GS",
    locationName: "Augusta Branch",
    linkedLabel: "Job: Monthly Property Walkthrough", linkedType: "job", linkedId: "j7",
    lineItems: [
      { id: "li-inv006-1", description: "Monthly Property Walkthrough Service", quantity: 1, unitPrice: 185, total: 185 },
      { id: "li-inv006-2", description: "Written Report Preparation",           quantity: 1, unitPrice: 40,  total: 40  },
    ],
  },
];

// ─── Runtime store (seed + records created in-session) ────
const Q_KEY = "crm-extra-quotes";
const I_KEY = "crm-extra-invoices";
const QO_KEY = "crm-quote-overrides";   // per-quote field overrides (status, notes, activity…)

let _extraQuotes:   QuoteRecord[] | null = null;
let _extraInvoices: InvoiceRecord[] | null = null;
let _quoteOverrides: Record<string, Partial<QuoteRecord>> | null = null;

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

export function getAllQuotes(): QuoteRecord[]   { return [...extraQuotes(), ...ALL_QUOTES].map(applyOverride); }
export function getAllInvoices(): InvoiceRecord[] { return [...extraInvoices(), ...ALL_INVOICES]; }

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

// Convert to a job/project. Foundation only: marks the quote converted, links a
// placeholder id, and logs activity. Real job/project creation lands later.
export function convertQuoteToJob(id: string, actor = "Marcus Reyes"): QuoteRecord | undefined {
  const q = getQuote(id);
  if (!q) return;
  persistEdit(id, { status: "converted" }, newActivity("converted", `Converted to a job from ${q.quoteNumber}`, actor));
  return getQuote(id);
}
export function convertQuoteToProject(id: string, actor = "Marcus Reyes"): QuoteRecord | undefined {
  const q = getQuote(id);
  if (!q) return;
  persistEdit(id, { status: "converted" }, newActivity("converted", `Converted to a project from ${q.quoteNumber}`, actor));
  return getQuote(id);
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

// ─── Lookup helpers ───────────────────────────────────────
export function getQuote(id: string): QuoteRecord | undefined   { return getAllQuotes().find(q => q.id === id); }
export { QUOTE_TEMPLATES, getQuoteTemplate } from "./templates";
export function getInvoice(id: string): InvoiceRecord | undefined { return getAllInvoices().find(i => i.id === id); }

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
  quoteId?: string; quoteNumber?: string; jobId?: string; projectId?: string; agreementId?: string; propertyId?: string;
  linkedLabel?: string; linkedType?: InvoiceRecord["linkedType"]; linkedId?: string;
}

export function createInvoice(input: NewInvoiceInput): InvoiceRecord {
  const totals = computeTotals(input.lineItems, input.taxRate ?? 0);
  const all = getAllInvoices();
  const inv: InvoiceRecord = {
    id: `inv-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
    organizationId: "org_northstar", companyId: "co_hvac", locationId: "loc_augusta",
    customerId: input.customerId,
    propertyId: input.propertyId, jobId: input.jobId, projectId: input.projectId, agreementId: input.agreementId,
    quoteId: input.quoteId,
    invoiceNumber: nextNumber("INV", all), title: input.title, status: "draft",
    ...totals, balanceDue: totals.total, dueDate: input.dueDate,
    createdBy: "Marcus Reyes",
    createdAt: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
    updatedAt: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
    lineItems: input.lineItems,
    customerName: input.customerName, customerInitials: input.customerInitials, locationName: input.locationName,
    linkedLabel: input.linkedLabel, linkedType: input.linkedType, linkedId: input.linkedId,
    quoteNumber: input.quoteNumber,
  };
  _extraInvoices = [inv, ...extraInvoices()];
  try { localStorage.setItem(I_KEY, JSON.stringify(_extraInvoices)); } catch { /* ignore */ }
  return inv;
}
