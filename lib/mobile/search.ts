// ─── Global search across Routiqa ─────────────────────────
// One query over the core CRM stores — customers, jobs, leads, quotes, invoices,
// tasks — for the mobile command search. Results link to the mobile destination
// for that record where one exists.

import { getAllCustomers } from "@/lib/customers/data";
import { getAllJobs } from "@/lib/jobs/data";
import { getAllLeads } from "@/lib/leads/data";
import { getAllQuotes, getAllInvoices } from "@/lib/quotes/data";
import { getAllTasks } from "@/lib/tasks/data";

export type SearchType = "customer" | "job" | "lead" | "quote" | "invoice" | "task";

export interface SearchResult {
  id: string;
  type: SearchType;
  title: string;
  subtitle: string;
  href: string;
}

export const SEARCH_TYPE_META: Record<SearchType, { label: string; color: string }> = {
  customer: { label: "Customer", color: "#0f8578" },
  job:      { label: "Job",      color: "#0891b2" },
  lead:     { label: "Lead",     color: "#f59e0b" },
  quote:    { label: "Quote",    color: "#a855f7" },
  invoice:  { label: "Invoice",  color: "#16a34a" },
  task:     { label: "Task",     color: "#6b7280" },
};

const has = (hay: string, q: string) => hay.toLowerCase().includes(q);

export function searchRoutiqa(query: string): SearchResult[] {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];
  const out: SearchResult[] = [];

  for (const c of getAllCustomers()) {
    if (has(`${c.name} ${c.phone} ${c.email ?? ""} ${c.address} ${c.city}`, q))
      out.push({ id: c.id, type: "customer", title: c.name, subtitle: `${c.type} · ${c.phone || c.city}`, href: `/mobile/customers/${c.id}` });
    if (out.length >= 8) break;
  }
  for (const j of getAllJobs()) {
    if (has(`${j.customerName} ${j.title} ${j.propertyAddress ?? ""}`, q))
      out.push({ id: j.id, type: "job", title: j.customerName, subtitle: `${j.title} · ${j.scheduledDate}`, href: `/mobile/jobs/${j.id}` });
    if (out.filter(r => r.type === "job").length >= 8) break;
  }
  for (const l of getAllLeads()) {
    if (has(`${l.customerName} ${l.title}`, q))
      out.push({ id: l.id, type: "lead", title: l.customerName, subtitle: l.title, href: `/mobile/customers/${l.accountId ?? ""}` });
    if (out.filter(r => r.type === "lead").length >= 6) break;
  }
  for (const qr of getAllQuotes()) {
    if (has(`${qr.customerName} ${qr.title} ${qr.quoteNumber}`, q))
      out.push({ id: qr.id, type: "quote", title: `${qr.quoteNumber} · ${qr.customerName}`, subtitle: qr.title, href: `/mobile/customers/${qr.customerId}` });
    if (out.filter(r => r.type === "quote").length >= 6) break;
  }
  for (const i of getAllInvoices()) {
    if (has(`${i.customerName} ${i.title} ${i.invoiceNumber}`, q))
      out.push({ id: i.id, type: "invoice", title: `${i.invoiceNumber} · ${i.customerName}`, subtitle: i.title, href: `/mobile/customers/${i.customerId}` });
    if (out.filter(r => r.type === "invoice").length >= 6) break;
  }
  for (const t of getAllTasks()) {
    if (has(`${t.title} ${t.customerName ?? ""}`, q))
      out.push({ id: t.id, type: "task", title: t.title, subtitle: t.customerName || "Task", href: `/mobile/tasks` });
    if (out.filter(r => r.type === "task").length >= 6) break;
  }
  return out;
}
