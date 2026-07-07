"use client";

import Link from "next/link";
import { Briefcase } from "lucide-react";
import { ALL_JOBS, JOB_STATUS_CONFIG } from "@/lib/jobs/data";
import { serviceAreas } from "@/lib/hierarchy/data";
import { useHierarchy } from "@/components/providers/HierarchyProvider";
import StatusBadge from "@/components/shared/StatusBadge";

const TODAY = "May 30, 2026";

export default function JobsInTerritory() {
  const { effectiveServiceAreaId } = useHierarchy();

  const area = serviceAreas.find(s => s.id === effectiveServiceAreaId);
  const jobs = ALL_JOBS
    .filter(j => j.serviceAreaId === effectiveServiceAreaId)
    .filter(j => j.scheduledDate === TODAY || j.status === "in_progress" || j.status === "en_route")
    .sort((a, b) => a.scheduledTime.localeCompare(b.scheduledTime))
    .slice(0, 5);

  return (
    <div className="rounded-xl overflow-hidden h-full min-h-0 flex flex-col"
      style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)" }}>
      <div className="flex items-center gap-2 px-5 py-4 shrink-0"
        style={{ borderBottom: "1px solid var(--border)" }}>
        <Briefcase className="w-4 h-4" style={{ color: "#0f8578" }} />
        <div>
          <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Jobs in Territory</h2>
          {area && <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>{area.name} · Today</p>}
        </div>
      </div>

      {jobs.length === 0 ? (
        <div className="flex-1 min-h-0 flex items-center justify-center px-5 py-8 text-center">
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>No jobs scheduled today in this territory.</p>
        </div>
      ) : (
        <div className="flex-1 min-h-0 overflow-y-auto dashboard-widget-content">
          {jobs.map((job, i) => {
            const s = JOB_STATUS_CONFIG[job.status];
            return (
              <Link key={job.id} href={`/jobs/${job.id}`}
                className="flex items-center gap-3 px-5 py-3 hover:bg-[var(--bg-surface-2)] transition-colors"
                style={{ borderBottom: i < jobs.length - 1 ? "1px solid var(--border)" : "none", textDecoration: "none" }}>
                <div className="w-12 shrink-0">
                  <p className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>{job.scheduledTime}</p>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>{job.customerName}</p>
                  <p className="text-xs truncate" style={{ color: "var(--text-muted)" }}>{job.title}</p>
                </div>
                <StatusBadge label={s.label} color={s.color} className="shrink-0" />
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
