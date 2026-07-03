"use client";

import { useMemo } from "react";
import Link from "next/link";
import { DollarSign, Receipt, AlertTriangle, FileText } from "lucide-react";
import MobileHeader from "@/components/mobile/MobileHeader";
import { Card, Section, EmptyState } from "@/components/mobile/ui";
import { getAllInvoices, getAllQuotes, fmt } from "@/lib/quotes/data";
import { INVOICE_STATUS_STYLE } from "@/lib/quotes/types";

export default function MobileAccountingPage() {
  const invoices = useMemo(() => getAllInvoices(), []);
  const quotes = useMemo(() => getAllQuotes(), []);
  const collected = invoices.reduce((s, i) => s + (i.total - i.balanceDue), 0);
  const outstanding = invoices.reduce((s, i) => s + i.balanceDue, 0);
  const overdue = invoices.filter(i => i.status === "past_due" || (i.balanceDue > 0 && new Date(i.dueDate) < new Date()));
  const openQuoteValue = quotes.filter(q => ["draft", "sent", "viewed"].includes(q.status)).reduce((s, q) => s + q.total, 0);
  const recent = [...invoices].sort((a, b) => (b.dueDate || "").localeCompare(a.dueDate || "")).slice(0, 8);

  return (
    <div>
      <MobileHeader title="Accounting" subtitle="Invoices, payments & AR" back />
      <div className="px-4 space-y-5">
        <div className="grid grid-cols-2 gap-3">
          <Kpi icon={DollarSign} label="Collected" value={fmt(collected)} color="#16a34a" />
          <Kpi icon={Receipt} label="Outstanding AR" value={fmt(outstanding)} color="#dc2626" />
          <Kpi icon={AlertTriangle} label="Overdue" value={String(overdue.length)} color="#f59e0b" />
          <Kpi icon={FileText} label="Open quotes" value={fmt(openQuoteValue)} color="#4f46e5" />
        </div>

        <Section title="Recent invoices">
          {recent.length === 0 ? <Card className="px-4 py-6"><EmptyState icon={Receipt} title="No invoices" /></Card> : (
            <Card>
              {recent.map((i, idx) => {
                const st = INVOICE_STATUS_STYLE[i.status];
                return (
                  <div key={i.id} className="flex items-center gap-3 px-4 py-3" style={{ borderTop: idx ? "1px solid var(--border)" : "none" }}>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold truncate" style={{ color: "var(--text-primary)" }}>{i.customerName}</p>
                      <p className="text-xs truncate" style={{ color: "var(--text-muted)" }}>{i.invoiceNumber} · due {i.dueDate}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-semibold tabular-nums" style={{ color: "var(--text-primary)" }}>{fmt(i.total)}</p>
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded" style={{ backgroundColor: (st?.bg ?? "var(--bg-surface-2)"), color: (st?.color ?? "var(--text-muted)") }}>{st?.label ?? i.status}</span>
                    </div>
                  </div>
                );
              })}
            </Card>
          )}
        </Section>
        <Link href="/dashboard" className="block text-center text-xs py-2" style={{ color: "var(--text-muted)" }}>Full accounting tools on desktop</Link>
      </div>
    </div>
  );
}

function Kpi({ icon: Icon, label, value, color }: { icon: React.ElementType; label: string; value: string; color: string }) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-1.5"><Icon className="w-3.5 h-3.5" style={{ color }} /><p className="text-[11px] font-medium truncate" style={{ color: "var(--text-muted)" }}>{label}</p></div>
      <p className="text-xl font-bold mt-1 tabular-nums" style={{ color: "var(--text-primary)" }}>{value}</p>
    </Card>
  );
}
