// Global "search anything" — a flat search across the operational records an
// org owner can reach. Runs client-side over the (localStorage-backed) stores;
// results carry a route so the command bar can navigate straight to the record.

import { getAllCustomers, getCustomer } from "@/lib/customers/data";
import { getAllJobs } from "@/lib/jobs/data";
import { getAllQuotes, getAllInvoices } from "@/lib/quotes/data";
import { getAllLeads } from "@/lib/leads/data";
import { getAllProjects } from "@/lib/projects/data";
import { getAllAgreements } from "@/lib/agreements/data";
import { getAllThreads, anchorHref, anchorLabel } from "@/lib/comments/data";

export type SearchGroup =
  | "Customers" | "Jobs" | "Leads" | "Quotes" | "Invoices" | "Projects" | "Agreements" | "Comments";

export interface SearchResult {
  id: string;
  group: SearchGroup;
  title: string;
  subtitle?: string;
  href: string;
  initials?: string;
}

const has = (q: string, ...vals: (string | undefined | null)[]) =>
  vals.some(v => v != null && v.toLowerCase().includes(q));

const sub = (...parts: (string | undefined | null)[]) =>
  parts.filter(Boolean).join(" · ");

// Returns results in group order, capped per group so the dropdown stays tight.
export function searchAll(query: string, perGroup = 5): SearchResult[] {
  const q = query.trim().toLowerCase();
  if (q.length < 1) return [];
  const out: SearchResult[] = [];

  const customers = getAllCustomers().filter(c => has(q, c.name, c.city, c.state, c.phone, c.email, c.address)).slice(0, perGroup);
  for (const c of customers) out.push({ id: c.id, group: "Customers", title: c.name, subtitle: sub(c.city && c.state ? `${c.city}, ${c.state}` : c.city, c.phone), href: `/customers/${c.id}`, initials: c.initials });

  const jobs = getAllJobs().filter(j => has(q, j.title, j.customerName, j.assignedTo, j.propertyAddress)).slice(0, perGroup);
  for (const j of jobs) out.push({ id: j.id, group: "Jobs", title: j.title, subtitle: sub(j.customerName, j.scheduledDate || "Unscheduled"), href: `/jobs/${j.id}`, initials: j.customerInitials });

  const leads = getAllLeads().filter(l => has(q, l.title, l.customerName, l.customerPhone)).slice(0, perGroup);
  for (const l of leads) out.push({ id: l.id, group: "Leads", title: l.title, subtitle: sub(l.customerName, l.stage), href: `/leads/${l.id}`, initials: l.customerInitials });

  const quotes = getAllQuotes().filter(qr => { const cust = getCustomer(qr.customerId); return has(q, qr.quoteNumber, qr.title, cust?.name); }).slice(0, perGroup);
  for (const qr of quotes) { const cust = getCustomer(qr.customerId); out.push({ id: qr.id, group: "Quotes", title: qr.title || qr.quoteNumber, subtitle: sub(qr.quoteNumber, cust?.name), href: `/quotes/${qr.id}` }); }

  const invoices = getAllInvoices().filter(inv => { const cust = getCustomer(inv.customerId); return has(q, inv.invoiceNumber, inv.title, cust?.name); }).slice(0, perGroup);
  for (const inv of invoices) { const cust = getCustomer(inv.customerId); out.push({ id: inv.id, group: "Invoices", title: inv.title || inv.invoiceNumber, subtitle: sub(inv.invoiceNumber, cust?.name), href: `/invoices/${inv.id}` }); }

  const projects = getAllProjects().filter(p => has(q, p.name, p.customerName)).slice(0, perGroup);
  for (const p of projects) out.push({ id: p.id, group: "Projects", title: p.name, subtitle: sub(p.customerName, p.status), href: `/projects/${p.id}`, initials: p.customerInitials });

  const agreements = getAllAgreements().filter(a => has(q, a.type, a.customer, a.location)).slice(0, perGroup);
  for (const a of agreements) out.push({ id: a.id, group: "Agreements", title: a.type, subtitle: sub(a.customer, a.location), href: `/agreements/${a.id}`, initials: a.customerInitials });

  const threads = getAllThreads().filter(t => has(q, t.root.body, t.root.authorName, anchorLabel(t.root.anchor))).slice(0, perGroup);
  for (const t of threads) out.push({ id: t.root.id, group: "Comments", title: t.root.body, subtitle: sub(t.root.authorName, anchorLabel(t.root.anchor)), href: anchorHref(t.root.anchor, t.root.threadId), initials: t.root.authorInitials });

  return out;
}
