"use client";

import Link from "next/link";
import { Receipt, ExternalLink } from "lucide-react";
import { ALL_INVOICES, fmt } from "@/lib/quotes/data";
import { INVOICE_STATUS_STYLE } from "@/lib/quotes/types";
import { useHierarchy } from "@/components/providers/HierarchyProvider";

export default function InvoicesDue() {
  const { effectiveCompanyId, effectiveLocationId } = useHierarchy();

  const invoices = ALL_INVOICES
    .filter(i => !effectiveCompanyId  || i.companyId  === effectiveCompanyId)
    .filter(i => !effectiveLocationId || i.locationId === effectiveLocationId)
    .filter(i => i.balanceDue > 0 && i.status !== "void")
    .sort((a, b) => {
      // Overdue first, then by due date
      if (a.status === "past_due" && b.status !== "past_due") return -1;
      if (b.status === "past_due" && a.status !== "past_due") return 1;
      return a.dueDate.localeCompare(b.dueDate);
    })
    .slice(0, 5);

  const totalOutstanding = ALL_INVOICES
    .filter(i => !effectiveCompanyId || i.companyId === effectiveCompanyId)
    .filter(i => i.balanceDue > 0)
    .reduce((s, i) => s + i.balanceDue, 0);

  return (
    <div className="rounded-xl overflow-hidden h-full min-h-0 flex flex-col"
      style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-subtle)", boxShadow: "var(--shadow-card)" }}>
      <div className="flex items-center justify-between px-5 py-4 shrink-0"
        style={{ borderBottom: "1px solid var(--border-subtle)" }}>
        <div className="flex items-center gap-2">
          <Receipt className="w-4 h-4" style={{ color: "#4f46e5" }} />
          <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Invoices Due</h2>
          {totalOutstanding > 0 && (
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
              style={{ backgroundColor: "#fef3c7", color: "#92400e" }}>
              {fmt(totalOutstanding)} outstanding
            </span>
          )}
        </div>
        <Link href="/invoices" className="flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-700">
          View all <ExternalLink className="w-3 h-3" />
        </Link>
      </div>

      {invoices.length === 0 ? (
        <div className="flex-1 min-h-0 flex items-center justify-center px-5 py-8 text-center">
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>All invoices are paid up.</p>
        </div>
      ) : (
        <div className="flex-1 min-h-0 overflow-y-auto dashboard-widget-content">
          {invoices.map((inv, i) => {
            const s = INVOICE_STATUS_STYLE[inv.status];
            const isOverdue = inv.status === "past_due";
            return (
              <Link key={inv.id} href={`/invoices/${inv.id}`}
                className="flex items-center gap-3 px-5 py-3 hover:bg-[var(--bg-surface-2)] transition-colors"
                style={{ borderBottom: i < invoices.length - 1 ? "1px solid var(--border-subtle)" : "none", textDecoration: "none" }}>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>{inv.customerName}</p>
                  <p className="text-xs truncate" style={{ color: "var(--text-muted)" }}>{inv.invoiceNumber} · Due {inv.dueDate}</p>
                </div>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0"
                  style={{ backgroundColor: s.bg, color: s.color }}>{s.label}</span>
                <span className="text-sm font-semibold shrink-0"
                  style={{ color: isOverdue ? "#dc2626" : "var(--text-primary)" }}>
                  {fmt(inv.balanceDue)}
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
