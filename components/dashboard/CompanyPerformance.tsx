"use client";

import { Building2 } from "lucide-react";
import { companies } from "@/lib/hierarchy/data";
import { ALL_JOBS } from "@/lib/jobs/data";
import { ALL_LEADS } from "@/lib/leads/data";
import { ALL_INVOICES, fmt } from "@/lib/quotes/data";

export default function CompanyPerformance() {
  const stats = companies.filter(c => c.status === "active").map(co => {
    const activeJobs = ALL_JOBS.filter(j =>
      j.companyId === co.id &&
      (j.status === "in_progress" || j.status === "en_route" || j.status === "scheduled")
    ).length;
    const openLeads = ALL_LEADS.filter(l =>
      l.companyId === co.id && !["won", "lost"].includes(l.stage)
    ).length;
    const wonLeads = ALL_LEADS.filter(l => l.companyId === co.id && l.stage === "won").length;
    const outstanding = ALL_INVOICES
      .filter(i => i.companyId === co.id && i.balanceDue > 0)
      .reduce((s, i) => s + i.balanceDue, 0);

    return { co, activeJobs, openLeads, wonLeads, outstanding };
  });

  const industryColors: Record<string, string> = {
    hvac: "#6366f1", roofing: "#0891b2", plumbing: "#0d9488", electrical: "#d97706",
  };

  return (
    <div className="rounded-xl overflow-hidden h-full min-h-0 flex flex-col"
      style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-subtle)", boxShadow: "var(--shadow-card)" }}>
      <div className="flex items-center gap-2 px-5 py-4 shrink-0"
        style={{ borderBottom: "1px solid var(--border-subtle)" }}>
        <Building2 className="w-4 h-4" style={{ color: "#4f46e5" }} />
        <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Company Performance</h2>
      </div>

      <div className="grid px-5 py-2 text-[10px] font-semibold uppercase tracking-wider shrink-0"
        style={{ gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr", color: "var(--text-muted)", borderBottom: "1px solid var(--border-subtle)", backgroundColor: "var(--bg-surface-2)" }}>
        <span>Company</span>
        <span className="text-right">Active Jobs</span>
        <span className="text-right">Open Leads</span>
        <span className="text-right">Won</span>
        <span className="text-right">Outstanding</span>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto dashboard-widget-content">
        {stats.map((s, i) => {
          const color = industryColors[s.co.industry ?? ""] ?? "#6b7280";
          return (
            <div key={s.co.id}
              className="grid items-center px-5 py-3 hover:bg-[var(--bg-surface-2)] transition-colors"
              style={{ gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr", borderBottom: i < stats.length - 1 ? "1px solid var(--border-subtle)" : "none" }}>
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>{s.co.name}</p>
                  {s.co.industry && (
                    <p className="text-[10px] uppercase" style={{ color: "var(--text-muted)" }}>{s.co.industry}</p>
                  )}
                </div>
              </div>
              <p className="text-sm font-semibold text-right"
                style={{ color: s.activeJobs > 0 ? "#4f46e5" : "var(--text-muted)" }}>{s.activeJobs}</p>
              <p className="text-sm text-right" style={{ color: "var(--text-secondary)" }}>{s.openLeads}</p>
              <p className="text-sm font-semibold text-right text-emerald-600">{s.wonLeads}</p>
              <p className="text-sm font-semibold text-right"
                style={{ color: s.outstanding > 0 ? "#d97706" : "#10b981" }}>
                {s.outstanding > 0 ? fmt(s.outstanding) : "—"}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
