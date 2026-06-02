// Activity Events — mock data.
// Sorted newest-first per customer. Replace with Supabase query when ready:
//   supabase.from('activity_events').select('*')
//     .eq('account_id', customerId).order('created_at', { ascending: false })

import type { ActivityEvent } from "./types";
import {
  getQuotesForCustomer, getInvoicesForCustomer, ALL_QUOTES, ALL_INVOICES, fmt,
} from "@/lib/quotes/data";
import { ALL_JOBS } from "@/lib/jobs/data";

const EVENTS: Record<string, ActivityEvent[]> = {
  // ── Sarah Mitchell ─────────────────────────────────────
  "1": [
    {
      id: "ae1-1",
      customerId: "1",
      eventType: "task_created",
      title: "Task created: Follow up on water heater quote",
      description: "Follow up with Sarah about the water heater replacement estimate.",
      createdBy: "Sara (CSR)",
      createdAt: "2026-06-05",
      displayDate: "Jun 5, 2026",
    },
    {
      id: "ae1-2",
      customerId: "1",
      eventType: "job_scheduled",
      title: "Job scheduled: Water Heater Install",
      description: "Scheduled for Jun 15, 2026 — $1,200 installed.",
      createdBy: "Sara (CSR)",
      createdAt: "2026-05-25",
      displayDate: "May 25, 2026",
    },
    {
      id: "ae1-3",
      customerId: "1",
      eventType: "quote_sent",
      title: "Quote sent: Water Heater Replacement",
      description: "$1,200 installed — sent via email. Customer will discuss and follow up.",
      createdBy: "J. Patel",
      createdAt: "2026-05-20",
      displayDate: "May 20, 2026",
    },
    {
      id: "ae1-4",
      customerId: "1",
      eventType: "note_added",
      title: "Visit note added",
      description: "Completed spring tune-up. Carrier unit running well. Recommended air quality testing next visit.",
      createdBy: "J. Patel",
      createdAt: "2026-04-03T10:30",
      displayDate: "Apr 3, 2026",
    },
    {
      id: "ae1-5",
      customerId: "1",
      eventType: "job_completed",
      title: "Job completed: HVAC Tune-up (Spring)",
      description: "$0 — covered under agreement.",
      createdBy: "J. Patel",
      createdAt: "2026-04-03T10:00",
      displayDate: "Apr 3, 2026",
    },
    {
      id: "ae1-6",
      customerId: "1",
      eventType: "call_logged",
      title: "Call logged",
      description: "Customer called to schedule spring appointment. Booked for April 3 at 8am.",
      createdBy: "Sara (CSR)",
      createdAt: "2026-03-12",
      displayDate: "Mar 12, 2026",
    },
    {
      id: "ae1-7",
      customerId: "1",
      eventType: "job_completed",
      title: "Job completed: Filter Replacement",
      description: "$0 — covered under agreement.",
      createdBy: "J. Patel",
      createdAt: "2025-10-12",
      displayDate: "Oct 12, 2025",
    },
    {
      id: "ae1-8",
      customerId: "1",
      eventType: "job_completed",
      title: "Job completed: HVAC Tune-up (Fall 2024)",
      description: "$0 — covered under agreement.",
      createdBy: "J. Patel",
      createdAt: "2024-10-08",
      displayDate: "Oct 8, 2024",
    },
    {
      id: "ae1-9",
      customerId: "1",
      eventType: "agreement_created",
      title: "Agreement created: HVAC Residential Maintenance Plan",
      description: "Annual plan — 2× yearly visits, filter replacements, priority dispatch.",
      createdBy: "Sara (CSR)",
      createdAt: "2022-01-15",
      displayDate: "Jan 2022",
    },
    {
      id: "ae1-10",
      customerId: "1",
      eventType: "account_created",
      title: "Account created",
      description: "Sarah Mitchell added as a new customer.",
      createdBy: "System",
      createdAt: "2022-01-10",
      displayDate: "Jan 2022",
    },
  ],

  // ── Hammond LLC ────────────────────────────────────────
  "2": [
    {
      id: "ae2-1",
      customerId: "2",
      eventType: "note_added",
      title: "Visit note added",
      description: "Annual roof inspection completed. Found 2 areas of concern near HVAC units. Sent detailed photo report.",
      createdBy: "D. Nguyen",
      createdAt: "2026-05-28",
      displayDate: "May 28, 2026",
    },
    {
      id: "ae2-2",
      customerId: "2",
      eventType: "job_completed",
      title: "Job completed: Roof Inspection",
      description: "$0 — covered under agreement.",
      createdBy: "D. Nguyen",
      createdAt: "2026-05-28T09:00",
      displayDate: "May 28, 2026",
    },
    {
      id: "ae2-3",
      customerId: "2",
      eventType: "lead_created",
      title: "Lead created: Building 2 HVAC Upgrade",
      description: "Customer requested evaluation for Building 2 HVAC system.",
      createdBy: "Sara (CSR)",
      createdAt: "2026-05-15",
      displayDate: "May 15, 2026",
    },
    {
      id: "ae2-4",
      customerId: "2",
      eventType: "quote_created",
      title: "Quote created: Full Roof Replacement",
      description: "$48,000 — generated from inspection findings.",
      createdBy: "D. Nguyen",
      createdAt: "2026-03-20",
      displayDate: "Mar 20, 2026",
    },
    {
      id: "ae2-5",
      customerId: "2",
      eventType: "note_added",
      title: "Visit note added",
      description: "Emergency HVAC call. Capacitor failed on unit 3. Replaced on-site. System back online.",
      createdBy: "M. Cole",
      createdAt: "2026-03-10",
      displayDate: "Mar 10, 2026",
    },
    {
      id: "ae2-6",
      customerId: "2",
      eventType: "job_completed",
      title: "Job completed: HVAC Emergency Call",
      description: "$840 — capacitor replacement on Trane unit 3.",
      createdBy: "M. Cole",
      createdAt: "2026-03-10T08:00",
      displayDate: "Mar 10, 2026",
    },
    {
      id: "ae2-7",
      customerId: "2",
      eventType: "call_logged",
      title: "Call logged",
      description: "D. Webb confirmed billing change to Net-30. Account terms updated.",
      createdBy: "Sara (CSR)",
      createdAt: "2026-03-01",
      displayDate: "Mar 1, 2026",
    },
    {
      id: "ae2-8",
      customerId: "2",
      eventType: "job_completed",
      title: "Job completed: Commercial HVAC Q4",
      description: "$0 — quarterly agreement visit.",
      createdBy: "M. Cole",
      createdAt: "2025-12-10",
      displayDate: "Dec 10, 2025",
    },
    {
      id: "ae2-9",
      customerId: "2",
      eventType: "account_created",
      title: "Account created",
      description: "Hammond LLC added as a commercial customer.",
      createdBy: "System",
      createdAt: "2021-03-01",
      displayDate: "Mar 2021",
    },
  ],

  // ── Lakeside Apartments ────────────────────────────────
  "4": [
    {
      id: "ae4-1",
      customerId: "4",
      eventType: "note_added",
      title: "Visit note added",
      description: "Q2 plumbing inspection done. Unit 14 slow drain cleared. Unit 8 water heater showing age — recommend replacement.",
      createdBy: "M. Cole",
      createdAt: "2026-05-05",
      displayDate: "May 5, 2026",
    },
    {
      id: "ae4-2",
      customerId: "4",
      eventType: "job_completed",
      title: "Job completed: Plumbing Q2 Inspection",
      description: "$0 — covered under plumbing membership.",
      createdBy: "M. Cole",
      createdAt: "2026-05-05T09:00",
      displayDate: "May 5, 2026",
    },
    {
      id: "ae4-3",
      customerId: "4",
      eventType: "note_added",
      title: "Note added",
      description: "Mike Torres reported drain issue in unit 14. Dispatched M. Cole same day.",
      createdBy: "Sara (CSR)",
      createdAt: "2026-04-12T08:00",
      displayDate: "Apr 12, 2026",
    },
    {
      id: "ae4-4",
      customerId: "4",
      eventType: "job_completed",
      title: "Job completed: Drain Cleaning — Unit 14",
      description: "$185.",
      createdBy: "M. Cole",
      createdAt: "2026-04-12",
      displayDate: "Apr 12, 2026",
    },
    {
      id: "ae4-5",
      customerId: "4",
      eventType: "job_scheduled",
      title: "Job scheduled: Plumbing Q3 Inspection",
      description: "Scheduled for Aug 1, 2026 — covered under agreement.",
      createdBy: "Sara (CSR)",
      createdAt: "2026-04-10",
      displayDate: "Apr 10, 2026",
    },
    {
      id: "ae4-6",
      customerId: "4",
      eventType: "account_created",
      title: "Account created",
      description: "Lakeside Apartments added as a property management account.",
      createdBy: "System",
      createdAt: "2020-02-01",
      displayDate: "Feb 2020",
    },
  ],

  // ── Alvarez Residence ──────────────────────────────────
  "7": [
    {
      id: "ae7-1",
      customerId: "7",
      eventType: "task_created",
      title: "Task created: Confirm spring HVAC appointment",
      description: "Reach out to confirm Jun 5 appointment — customer was previously out of town.",
      createdBy: "Sara (CSR)",
      createdAt: "2026-06-03",
      displayDate: "Jun 3, 2026",
    },
    {
      id: "ae7-2",
      customerId: "7",
      eventType: "job_scheduled",
      title: "Job scheduled: HVAC Tune-up (Spring)",
      description: "Scheduled for Jun 5, 2026.",
      createdBy: "Sara (CSR)",
      createdAt: "2026-05-20",
      displayDate: "May 20, 2026",
    },
    {
      id: "ae7-3",
      customerId: "7",
      eventType: "job_completed",
      title: "Job completed: HVAC Tune-up (Fall 2025)",
      description: "$0 — covered under agreement.",
      createdBy: "J. Patel",
      createdAt: "2025-09-18",
      displayDate: "Sep 18, 2025",
    },
    {
      id: "ae7-4",
      customerId: "7",
      eventType: "agreement_created",
      title: "Agreement created: HVAC Residential Maintenance Plan",
      description: "Annual plan — 2× yearly visits.",
      createdBy: "Sara (CSR)",
      createdAt: "2021-06-01",
      displayDate: "Jun 2021",
    },
    {
      id: "ae7-5",
      customerId: "7",
      eventType: "account_created",
      title: "Account created",
      description: "Alvarez Residence added as a new customer.",
      createdBy: "System",
      createdAt: "2021-06-01",
      displayDate: "Jun 2021",
    },
  ],

  // ── ABC Property Group ─────────────────────────────────
  "8": [
    {
      id: "ae8-1",
      customerId: "8",
      eventType: "task_created",
      title: "Task created: Renewal pricing discussion",
      description: "Discuss agreement renewal pricing with Robert Chen before Jun 15.",
      createdBy: "Marcus Reyes",
      createdAt: "2026-06-01",
      displayDate: "Jun 1, 2026",
    },
    {
      id: "ae8-2",
      customerId: "8",
      eventType: "task_created",
      title: "Task overdue: Send monthly property summary",
      description: "Monthly summary was due May 31 — not yet sent.",
      createdBy: "Sara (CSR)",
      createdAt: "2026-05-31",
      displayDate: "May 31, 2026",
    },
    {
      id: "ae8-3",
      customerId: "8",
      eventType: "contact_added",
      title: "Contact added: Lisa Park",
      description: "Billing Contact — billing@abcproperty.com",
      createdBy: "Sara (CSR)",
      createdAt: "2022-03-10",
      displayDate: "Mar 2022",
    },
    {
      id: "ae8-4",
      customerId: "8",
      eventType: "contact_added",
      title: "Contact added: Robert Chen",
      description: "Facility Manager — primary contact for operations.",
      createdBy: "Sara (CSR)",
      createdAt: "2019-11-05",
      displayDate: "Nov 2019",
    },
    {
      id: "ae8-5",
      customerId: "8",
      eventType: "property_added",
      title: "Property added: Storage Annex",
      description: "211 Warehouse Blvd, Augusta, GA — Industrial.",
      createdBy: "Sara (CSR)",
      createdAt: "2019-11-03",
      displayDate: "Nov 2019",
    },
    {
      id: "ae8-6",
      customerId: "8",
      eventType: "account_created",
      title: "Account created",
      description: "ABC Property Group added as a property management account.",
      createdBy: "System",
      createdAt: "2019-11-01",
      displayDate: "Nov 2019",
    },
  ],
};

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
