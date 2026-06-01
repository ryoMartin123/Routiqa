"use client";

import Link from "next/link";
import { ALL_INVOICES, fmt } from "@/lib/quotes/data";
import { useHierarchy } from "@/components/providers/HierarchyProvider";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun"];

export default function RevenueSnapshot() {
  const { effectiveCompanyId } = useHierarchy();

  const paid = ALL_INVOICES
    .filter(i => i.status === "paid" && (!effectiveCompanyId || i.companyId === effectiveCompanyId));

  // Group paid invoices by month (using paidAt field — mock data has "Month Day, Year" format)
  const byMonth: Record<string, number> = { Jan: 0, Feb: 0, Mar: 0, Apr: 0, May: 0, Jun: 0 };
  paid.forEach(inv => {
    if (!inv.paidAt) return;
    const m = inv.paidAt.slice(0, 3);
    if (m in byMonth) byMonth[m] += inv.total;
  });

  // Add realistic historical totals for the bar chart context
  const chartData = [
    { month: "Jan", value: 38200 },
    { month: "Feb", value: 31800 },
    { month: "Mar", value: 44600 },
    { month: "Apr", value: 39100 },
    { month: "May", value: byMonth.May > 0 ? byMonth.May : 980 },
    { month: "Jun", value: byMonth.Jun > 0 ? byMonth.Jun : 0 },
  ];

  const max = Math.max(...chartData.map(d => d.value), 1);
  const mtd = chartData[4].value; // May

  const outstanding = ALL_INVOICES
    .filter(i => i.balanceDue > 0 && (!effectiveCompanyId || i.companyId === effectiveCompanyId))
    .reduce((s, i) => s + i.balanceDue, 0);

  const avgTicket = paid.length > 0
    ? Math.round(paid.reduce((s, i) => s + i.total, 0) / paid.length)
    : 0;

  return (
    <div className="rounded-xl p-4 h-full min-h-0 flex flex-col overflow-y-auto dashboard-widget-content"
      style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-subtle)", boxShadow: "var(--shadow-card)" }}>
      <div className="flex items-center justify-between mb-1 shrink-0">
        <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Revenue</h2>
        <Link href="/invoices" className="text-xs font-medium text-indigo-600 hover:text-indigo-700">
          Invoices →
        </Link>
      </div>
      <p className="text-2xl font-bold shrink-0" style={{ color: "var(--text-primary)" }}>
        {fmt(mtd)}
      </p>
      <p className="text-xs shrink-0" style={{ color: "var(--text-muted)" }}>May month-to-date</p>

      <div className="flex items-end gap-1.5 mt-4 flex-1 min-h-[64px]">
        {chartData.map((d, i) => (
          <div key={i} className="flex-1 flex flex-col items-center gap-1 h-full justify-end">
            <div className="w-full rounded-t-sm transition-all"
              style={{
                height: `${(d.value / max) * 100}%`,
                backgroundColor: i === 4 ? "#6366f1" : i === 5 ? "var(--bg-input)" : "#e0e7ff",
                minHeight: d.value > 0 ? "3px" : "0",
              }} />
            <span className="text-[9px]" style={{ color: "var(--text-muted)" }}>{d.month}</span>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2 mt-3 pt-3 shrink-0"
        style={{ borderTop: "1px solid var(--border-subtle)" }}>
        <div>
          <p className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: "var(--text-muted)" }}>Outstanding</p>
          <p className="text-sm font-semibold mt-0.5" style={{ color: outstanding > 0 ? "#d97706" : "#10b981" }}>
            {outstanding > 0 ? fmt(outstanding) : "None"}
          </p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: "var(--text-muted)" }}>Avg. Ticket</p>
          <p className="text-sm font-semibold mt-0.5" style={{ color: "var(--text-primary)" }}>
            {avgTicket > 0 ? fmt(avgTicket) : "—"}
          </p>
        </div>
      </div>
    </div>
  );
}
