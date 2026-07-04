"use client";

// ─── Billable-items ledger ────────────────────────────────
// The "job tab." Techs capture parts/labor on a work order (wo.lineItems); this
// module tracks which of those captured lines have been consumed by an invoice,
// so a job can span multiple visits/work orders and bill in pieces (deposit →
// progress → final) without ever double-billing.
//
// We don't move line items into a separate store — the work order stays the
// capture surface. Instead we key a small "billed" record by line-item id, then
// expose the annotated ledger (each captured line + its billed status).

import { getWorkOrderById, getWorkOrdersForJob, type WorkOrder, type WorkOrderLineItem } from "@/lib/jobs/data";
import { notifyDataChanged } from "@/lib/sync/liveData";

const KEY = "crm-billed-lines";

// One record per captured line that has been billed onto an invoice.
export interface BilledEntry {
  lineItemId: string;
  invoiceId: string;
  jobId: string;
  workOrderId: string;
  billedAt: string;   // ISO
  paidAt?: string;    // ISO — set when the invoice it's on is paid in full
}

// A captured work-order line annotated with provenance + billing status.
export interface LedgerLine extends WorkOrderLineItem {
  workOrderId: string;
  workOrderTitle: string;
  billed: boolean;
  paid: boolean;
  invoiceId?: string;
}

let _cache: Record<string, BilledEntry> | null = null;

function load(): Record<string, BilledEntry> {
  if (_cache) return _cache;
  if (typeof window === "undefined") return (_cache = {});
  try { const raw = localStorage.getItem(KEY); _cache = raw ? JSON.parse(raw) : {}; }
  catch { _cache = {}; }
  return _cache!;
}

function persist(map: Record<string, BilledEntry>): void {
  _cache = map;
  try { localStorage.setItem(KEY, JSON.stringify(map)); } catch { /* ignore */ }
  notifyDataChanged();
}

export function isBilled(lineItemId: string): boolean {
  return Boolean(load()[lineItemId]);
}

export function billedEntry(lineItemId: string): BilledEntry | undefined {
  return load()[lineItemId];
}

// Consume a set of captured lines onto an invoice (called after the invoice is made).
export function markLinesBilled(lineItemIds: string[], ctx: { invoiceId: string; jobId: string; workOrderId: string }): void {
  if (!lineItemIds.length) return;
  const map = { ...load() };
  const at = new Date().toISOString();
  for (const id of lineItemIds) {
    map[id] = { lineItemId: id, invoiceId: ctx.invoiceId, jobId: ctx.jobId, workOrderId: ctx.workOrderId, billedAt: at };
  }
  persist(map);
}

// Like markLinesBilled, but each line keeps its OWN work-order provenance — used
// when a single job-level invoice bills lines drawn from several work orders.
export function markLedgerLinesBilled(lines: { id: string; workOrderId: string }[], ctx: { invoiceId: string; jobId: string }): void {
  if (!lines.length) return;
  const map = { ...load() };
  const at = new Date().toISOString();
  for (const l of lines) {
    map[l.id] = { lineItemId: l.id, invoiceId: ctx.invoiceId, jobId: ctx.jobId, workOrderId: l.workOrderId, billedAt: at };
  }
  persist(map);
}

// Release every line billed to an invoice — e.g. the invoice was deleted/voided,
// so its items return to the unbilled pool.
export function releaseInvoiceLines(invoiceId: string): void {
  const map = { ...load() };
  let changed = false;
  for (const [id, e] of Object.entries(map)) {
    if (e.invoiceId === invoiceId) { delete map[id]; changed = true; }
  }
  if (changed) persist(map);
}

// Flip every line on an invoice to paid — called when the invoice settles in full.
export function markInvoicePaid(invoiceId: string): void {
  const map = { ...load() };
  let changed = false;
  const at = new Date().toISOString();
  for (const [id, e] of Object.entries(map)) {
    if (e.invoiceId === invoiceId && !e.paidAt) { map[id] = { ...e, paidAt: at }; changed = true; }
  }
  if (changed) persist(map);
}

function annotate(wo: WorkOrder): LedgerLine[] {
  const map = load();
  return (wo.lineItems ?? []).map(li => {
    const e = map[li.id];
    return { ...li, workOrderId: wo.id, workOrderTitle: wo.title, billed: Boolean(e), paid: Boolean(e?.paidAt), invoiceId: e?.invoiceId };
  });
}

// The tab for a single work order.
export function getWorkOrderLedger(workOrderId: string): LedgerLine[] {
  const wo = getWorkOrderById(workOrderId);
  return wo ? annotate(wo) : [];
}

// The tab for the whole job — every captured line across its work orders.
export function getJobLedger(jobId: string): LedgerLine[] {
  return getWorkOrdersForJob(jobId).flatMap(annotate);
}

export function sumUnbilled(lines: LedgerLine[]): number {
  return lines.filter(l => !l.billed).reduce((s, l) => s + l.qty * l.unitPrice, 0);
}
