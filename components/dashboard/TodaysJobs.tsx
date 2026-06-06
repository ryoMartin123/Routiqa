"use client";

import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { ALL_JOBS, JOB_STATUS_CONFIG } from "@/lib/jobs/data";
import { useHierarchy } from "@/components/providers/HierarchyProvider";
import StatusBadge from "@/components/shared/StatusBadge";

const TODAY = "May 30, 2026";

export default function TodaysJobs() {
  const { effectiveCompanyId, effectiveLocationId } = useHierarchy();

  const jobs = ALL_JOBS
    .filter(j => !effectiveCompanyId  || j.companyId  === effectiveCompanyId)
    .filter(j => !effectiveLocationId || j.locationId === effectiveLocationId)
    .filter(j => j.scheduledDate === TODAY || j.status === "in_progress" || j.status === "en_route")
    .sort((a, b) => a.scheduledTime.localeCompare(b.scheduledTime));

  return (
    <div className="rounded-xl overflow-hidden h-full min-h-0 flex flex-col"
      style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-subtle)", boxShadow: "var(--shadow-card)" }}>
      <div className="flex items-center justify-between px-5 py-4 shrink-0"
        style={{ borderBottom: "1px solid var(--border-subtle)" }}>
        <div>
          <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Today&apos;s Jobs</h2>
          <p className="text-[10px] mt-0.5" style={{ color: "var(--text-muted)" }}>{TODAY}</p>
        </div>
        <Link href="/jobs" className="flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-700">
          View all <ExternalLink className="w-3 h-3" />
        </Link>
      </div>

      {jobs.length === 0 ? (
        <div className="flex-1 min-h-0 flex items-center justify-center px-5 py-8 text-center">
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>No jobs scheduled today.</p>
        </div>
      ) : (
        <div className="flex-1 min-h-0 overflow-y-auto dashboard-widget-content">
          {jobs.map((job, i) => {
            const s = JOB_STATUS_CONFIG[job.status];
            return (
              <Link key={job.id} href={`/jobs/${job.id}`}
                className="flex items-center gap-4 px-5 py-3 hover:bg-[var(--bg-surface-2)] transition-colors"
                style={{ borderBottom: i < jobs.length - 1 ? "1px solid var(--border-subtle)" : "none", textDecoration: "none" }}>
                <div className="w-16 shrink-0">
                  <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{job.scheduledTime}</p>
                  <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>{job.durationMinutes}m</p>
                </div>
                <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center text-[10px] font-bold text-indigo-600 shrink-0">
                  {job.customerInitials}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>{job.customerName}</p>
                  <p className="text-xs truncate" style={{ color: "var(--text-muted)" }}>{job.title}</p>
                </div>
                <span className="text-xs shrink-0" style={{ color: "var(--text-secondary)" }}>{job.assignedTo}</span>
                <StatusBadge label={s.label} color={s.color} className="shrink-0" />
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
