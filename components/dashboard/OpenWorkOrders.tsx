"use client";

import Link from "next/link";
import { ClipboardList, ExternalLink } from "lucide-react";
import { ALL_JOBS, WORK_ORDERS } from "@/lib/jobs/data";
import { useHierarchy } from "@/components/providers/HierarchyProvider";

const WO_STATUS_STYLE = {
  pending:     { bg: "var(--bg-input)", color: "var(--text-muted)" },
  in_progress: { bg: "#fef3c7",         color: "#92400e"           },
  completed:   { bg: "#d1fae5",         color: "#065f46"           },
};

export default function OpenWorkOrders() {
  const { effectiveCompanyId, effectiveLocationId } = useHierarchy();

  const openWOs = Object.entries(WORK_ORDERS)
    .filter(([, wo]) => wo.status !== "completed")
    .map(([jobId, wo]) => ({ wo, job: ALL_JOBS.find(j => j.id === jobId) }))
    .filter(({ job }) =>
      job &&
      (!effectiveCompanyId  || job.companyId  === effectiveCompanyId) &&
      (!effectiveLocationId || job.locationId === effectiveLocationId)
    )
    .slice(0, 4);

  return (
    <div className="rounded-xl overflow-hidden h-full min-h-0 flex flex-col"
      style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)" }}>
      <div className="flex items-center justify-between px-4 py-3 shrink-0"
        style={{ borderBottom: "1px solid var(--border)" }}>
        <div className="flex items-center gap-2">
          <ClipboardList className="w-4 h-4" style={{ color: "#4f46e5" }} />
          <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Open Work Orders</h2>
          {openWOs.length > 0 && (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
              style={{ backgroundColor: "var(--bg-input)", color: "var(--text-muted)" }}>{openWOs.length}</span>
          )}
        </div>
        <Link href="/work-orders" className="flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-700">
          View all <ExternalLink className="w-3 h-3" />
        </Link>
      </div>

      {openWOs.length === 0 ? (
        <div className="flex-1 min-h-0 flex items-center justify-center px-4 py-6 text-center">
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>No open work orders.</p>
        </div>
      ) : (
        <div className="flex-1 min-h-0 overflow-y-auto dashboard-widget-content">
          {openWOs.map(({ wo, job }, i) => {
            const done  = wo.checklist.filter(c => c.isComplete).length;
            const total = wo.checklist.length;
            const pct   = total > 0 ? Math.round((done / total) * 100) : 0;
            const style = WO_STATUS_STYLE[wo.status];
            return (
              <Link key={wo.id} href={`/jobs/${wo.jobId}`}
                className="flex items-center gap-3 px-4 py-3 hover:bg-[var(--bg-surface-2)] transition-colors"
                style={{ borderBottom: i < openWOs.length - 1 ? "1px solid var(--border)" : "none", textDecoration: "none" }}>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate" style={{ color: "var(--text-primary)" }}>{wo.title}</p>
                  <p className="text-[10px] truncate" style={{ color: "var(--text-muted)" }}>
                    {job?.customerName} · {job?.assignedTo}
                  </p>
                  {total > 0 && (
                    <div className="flex items-center gap-1.5 mt-1">
                      <div className="flex-1 max-w-20 h-1 rounded-full" style={{ backgroundColor: "var(--bg-input)" }}>
                        <div className="h-1 rounded-full"
                          style={{ width: `${pct}%`, backgroundColor: pct === 100 ? "#10b981" : "#4f46e5" }} />
                      </div>
                      <span className="text-[9px]" style={{ color: "var(--text-muted)" }}>{done}/{total}</span>
                    </div>
                  )}
                </div>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0"
                  style={{ backgroundColor: style.bg, color: style.color }}>
                  {wo.status === "in_progress" ? "In Progress" : "Pending"}
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
