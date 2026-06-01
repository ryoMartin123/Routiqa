"use client";

import Link from "next/link";
import { MapPin } from "lucide-react";
import { companies, locations } from "@/lib/hierarchy/data";
import { ALL_JOBS } from "@/lib/jobs/data";
import { ALL_LEADS } from "@/lib/leads/data";
import { ALL_INVOICES, fmt } from "@/lib/quotes/data";
import { useHierarchy } from "@/components/providers/HierarchyProvider";

export default function LocationPerformance() {
  const { effectiveCompanyId } = useHierarchy();

  const visibleLocations = locations.filter(l =>
    l.status === "active" &&
    (!effectiveCompanyId || l.companyId === effectiveCompanyId)
  );

  const stats = visibleLocations.map(loc => {
    const co = companies.find(c => c.id === loc.companyId);
    const jobs = ALL_JOBS.filter(j => j.locationId === loc.id);
    const openLeads = ALL_LEADS.filter(l =>
      l.locationId === loc.id && !["won", "lost"].includes(l.stage)
    ).length;
    const outstanding = ALL_INVOICES
      .filter(i => i.locationId === loc.id && i.balanceDue > 0)
      .reduce((s, i) => s + i.balanceDue, 0);
    const activeJobs = jobs.filter(j =>
      j.status === "in_progress" || j.status === "en_route" || j.status === "scheduled"
    ).length;
    return { loc, co, activeJobs, openLeads, outstanding };
  });

  return (
    <div className="rounded-xl overflow-hidden h-full min-h-0 flex flex-col"
      style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-subtle)", boxShadow: "var(--shadow-card)" }}>
      <div className="flex items-center gap-2 px-5 py-4 shrink-0"
        style={{ borderBottom: "1px solid var(--border-subtle)" }}>
        <MapPin className="w-4 h-4" style={{ color: "#4f46e5" }} />
        <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Location Performance</h2>
      </div>

      {/* Column headers */}
      <div className="grid px-5 py-2 text-[10px] font-semibold uppercase tracking-wider shrink-0"
        style={{ gridTemplateColumns: "2fr 1fr 1fr 1fr", color: "var(--text-muted)", borderBottom: "1px solid var(--border-subtle)", backgroundColor: "var(--bg-surface-2)" }}>
        <span>Location</span>
        <span className="text-right">Active Jobs</span>
        <span className="text-right">Open Leads</span>
        <span className="text-right">Outstanding</span>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto dashboard-widget-content">
        {stats.map((s, i) => (
          <div key={s.loc.id}
            className="grid items-center px-5 py-3 hover:bg-[var(--bg-surface-2)] transition-colors"
            style={{ gridTemplateColumns: "2fr 1fr 1fr 1fr", borderBottom: i < stats.length - 1 ? "1px solid var(--border-subtle)" : "none" }}>
            <div>
              <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{s.loc.name}</p>
              {!effectiveCompanyId && (
                <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>{s.co?.name}</p>
              )}
            </div>
            <p className="text-sm font-semibold text-right"
              style={{ color: s.activeJobs > 0 ? "#4f46e5" : "var(--text-muted)" }}>
              {s.activeJobs}
            </p>
            <p className="text-sm font-semibold text-right"
              style={{ color: s.openLeads > 0 ? "var(--text-primary)" : "var(--text-muted)" }}>
              {s.openLeads}
            </p>
            <p className="text-sm font-semibold text-right"
              style={{ color: s.outstanding > 0 ? "#d97706" : "#10b981" }}>
              {s.outstanding > 0 ? fmt(s.outstanding) : "Paid"}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
