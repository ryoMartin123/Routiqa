"use client";

import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { getAllTasks } from "@/lib/tasks/data";
import { ALL_INVOICES, fmt } from "@/lib/quotes/data";
import { ALL_JOBS } from "@/lib/jobs/data";
import { useHierarchy } from "@/components/providers/HierarchyProvider";

export default function UrgentPanel() {
  const { effectiveCompanyId, effectiveLocationId } = useHierarchy();

  const overdueTasks = getAllTasks()
    .filter(t => t.status === "overdue")
    .filter(t => !effectiveCompanyId  || t.companyId  === effectiveCompanyId)
    .filter(t => !effectiveLocationId || t.locationId === effectiveLocationId);

  const overdueInvoices = ALL_INVOICES
    .filter(i => i.status === "past_due")
    .filter(i => !effectiveCompanyId  || i.companyId  === effectiveCompanyId)
    .filter(i => !effectiveLocationId || i.locationId === effectiveLocationId);

  const emergencyJobs = ALL_JOBS
    .filter(j => j.type === "emergency" && (j.status === "in_progress" || j.status === "en_route"))
    .filter(j => !effectiveCompanyId  || j.companyId  === effectiveCompanyId)
    .filter(j => !effectiveLocationId || j.locationId === effectiveLocationId);

  type UrgentItem = { label: string; detail: string; href: string; kind: "task" | "invoice" | "job" };

  const items: UrgentItem[] = [
    ...emergencyJobs.map(j => ({
      label: `Emergency: ${j.title}`,
      detail: `${j.customerName} · ${j.assignedTo}`,
      href:   `/jobs/${j.id}`,
      kind:   "job" as const,
    })),
    ...overdueTasks.map(t => ({
      label:  t.title,
      detail: `Due ${t.dueDate} · ${t.assignedTo}`,
      href:   t.linkedHref ?? "/tasks",
      kind:   "task" as const,
    })),
    ...overdueInvoices.map(i => ({
      label:  `${i.invoiceNumber} overdue`,
      detail: `${i.customerName} · ${fmt(i.balanceDue)} outstanding`,
      href:   `/invoices/${i.id}`,
      kind:   "invoice" as const,
    })),
  ];

  if (items.length === 0) return (
    <div className="rounded-xl p-4 h-full min-h-0 flex flex-col items-center justify-center"
      style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-subtle)", boxShadow: "var(--shadow-card)" }}>
      <p className="text-sm text-center py-4" style={{ color: "var(--text-muted)" }}>Nothing urgent right now.</p>
    </div>
  );

  return (
    <div className="rounded-xl overflow-hidden h-full min-h-0 flex flex-col"
      style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-subtle)", boxShadow: "var(--shadow-card)" }}>
      <div className="flex items-center justify-between px-4 py-3 shrink-0"
        style={{ backgroundColor: "var(--warning-soft-bg)", borderBottom: "1px solid var(--warning-soft-border)" }}>
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" style={{ color: "var(--warning-icon)" }} />
          <h2 className="text-sm font-semibold" style={{ color: "var(--warning-text)" }}>Urgent</h2>
        </div>
        <span className="text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center"
          style={{ backgroundColor: "var(--warning-soft-border)", color: "var(--warning-text)" }}>
          {items.length}
        </span>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto dashboard-widget-content">
        {items.map((item, i) => (
          <Link key={i} href={item.href}
            className="flex items-start gap-3 px-4 py-3 hover:bg-[var(--bg-surface-2)] transition-colors"
            style={{ borderBottom: i < items.length - 1 ? "1px solid var(--border-subtle)" : "none", textDecoration: "none" }}>
            <div className="w-2 h-2 rounded-full mt-1.5 shrink-0"
              style={{ backgroundColor: item.kind === "job" ? "#ef4444" : item.kind === "invoice" ? "#f59e0b" : "#ef4444" }} />
            <div>
              <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{item.label}</p>
              <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{item.detail}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
