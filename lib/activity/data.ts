// Activity Events — mock data.
// Sorted newest-first per customer. Replace with Supabase query when ready:
//   supabase.from('activity_events').select('*')
//     .eq('account_id', customerId).order('created_at', { ascending: false })

import type { ActivityEvent } from "./types";
import {
  getQuotesForCustomer, getInvoicesForCustomer, ALL_QUOTES, ALL_INVOICES, fmt,
} from "@/lib/quotes/data";
import { ALL_JOBS } from "@/lib/jobs/data";

const EVENTS: Record<string, ActivityEvent[]> = {};

// ─── Derived events ───────────────────────────────────────
// The static EVENTS above are the seeded historical narrative. Real records
// (quotes, invoices, jobs) created or changed in the app live in their own
// stores, so we derive timeline events from them too — that's how a quote you
// just created for a client shows up here. To avoid double-listing the demo
// customers whose history is already hand-written, derived events for *seed*
// records are skipped when the customer already has a seeded timeline; records
// created in-session (and all records for customers without a seed timeline)
// are always included.
const SEED_QUOTE_IDS   = new Set(ALL_QUOTES.map(q => q.id));
const SEED_INVOICE_IDS = new Set(ALL_INVOICES.map(i => i.id));

function humanDate(d: string): string {
  const dt = new Date(d);
  return isNaN(dt.getTime()) ? d : dt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
function sortKey(d: string): string {
  const dt = new Date(d);
  return isNaN(dt.getTime()) ? d : dt.toISOString().slice(0, 19);
}

function deriveCustomerEvents(customerId: string, includeSeedRecords: boolean): ActivityEvent[] {
  const out: ActivityEvent[] = [];

  // Quotes — created, plus sent/approved milestones.
  for (const q of getQuotesForCustomer(customerId)) {
    if (!includeSeedRecords && SEED_QUOTE_IDS.has(q.id)) continue;
    const amount = q.total > 0 ? ` · ${fmt(q.total)}` : "";
    out.push({
      id: `derived-quote-${q.id}`, customerId, eventType: "quote_created",
      title: `Quote created: ${q.title}`, description: `${q.quoteNumber}${amount}`,
      createdBy: q.createdBy, createdAt: sortKey(q.createdAt), displayDate: humanDate(q.createdAt),
    });
    if (q.status === "sent" || q.status === "viewed") {
      out.push({
        id: `derived-quote-${q.id}-sent`, customerId, eventType: "quote_sent",
        title: `Quote sent: ${q.title}`, description: `${q.quoteNumber}${amount}`,
        createdBy: q.assignedTo ?? q.createdBy, createdAt: sortKey(q.updatedAt), displayDate: humanDate(q.updatedAt),
      });
    }
    if (q.status === "approved" || q.status === "converted") {
      const when = q.approvedAt ?? q.updatedAt;
      out.push({
        id: `derived-quote-${q.id}-approved`, customerId, eventType: "quote_accepted",
        title: `Quote approved: ${q.title}`, description: `${q.quoteNumber}${amount}`,
        createdBy: q.assignedTo ?? q.createdBy, createdAt: sortKey(when), displayDate: humanDate(when),
      });
    }
  }

  // Invoices — created, plus payment.
  for (const inv of getInvoicesForCustomer(customerId)) {
    if (!includeSeedRecords && SEED_INVOICE_IDS.has(inv.id)) continue;
    out.push({
      id: `derived-invoice-${inv.id}`, customerId, eventType: "invoice_created",
      title: `Invoice created: ${inv.title}`, description: `${inv.invoiceNumber} · ${fmt(inv.total)}`,
      createdBy: inv.createdBy, createdAt: sortKey(inv.createdAt), displayDate: humanDate(inv.createdAt),
    });
    if (inv.status === "paid") {
      const when = inv.paidAt ?? inv.updatedAt;
      out.push({
        id: `derived-invoice-${inv.id}-paid`, customerId, eventType: "payment_received",
        title: `Payment received: ${inv.invoiceNumber}`, description: fmt(inv.total),
        createdBy: inv.createdBy, createdAt: sortKey(when), displayDate: humanDate(when),
      });
    }
  }

  // Jobs (by account) — only for customers without a seeded timeline, since
  // demo customers already have hand-written job history and jobs aren't
  // created in-session.
  if (includeSeedRecords) {
    for (const j of ALL_JOBS.filter(j => j.accountId === customerId)) {
      const done = j.status === "completed" || j.status === "invoiced" || j.status === "closed";
      const when = j.completedDate ?? j.scheduledDate;
      out.push({
        id: `derived-job-${j.id}`, customerId, eventType: done ? "job_completed" : "job_scheduled",
        title: `Job ${done ? "completed" : "scheduled"}: ${j.title}`,
        description: `${humanDate(j.scheduledDate)}${j.assignedTo ? ` · ${j.assignedTo}` : ""}`,
        createdBy: j.assignedTo, createdAt: sortKey(when), displayDate: humanDate(when),
      });
    }
  }

  return out;
}

export function getActivityEvents(customerId: string): ActivityEvent[] {
  const seed = EVENTS[customerId] ?? [];
  const derived = deriveCustomerEvents(customerId, seed.length === 0);
  return [...seed, ...derived].sort((a, b) => sortKey(b.createdAt).localeCompare(sortKey(a.createdAt)));
}

export function getAllActivityEvents(): ActivityEvent[] {
  return Object.values(EVENTS)
    .flat()
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
