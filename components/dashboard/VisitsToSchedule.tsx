"use client";

// Dashboard widget — planned agreement visits awaiting scheduling. Clicking
// "Schedule" materializes the visit into a dispatchable job (lazy scheduling)
// and routes to it, where time/tech are finalized and it rides the job lifecycle.

import { useMemo, useState } from "react";
import { CalendarClock, ChevronRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { useHierarchy } from "@/components/providers/HierarchyProvider";
import { getVisitsToSchedule, materializeVisitJob } from "@/lib/agreements/data";

export default function VisitsToSchedule() {
  const router = useRouter();
  const { effectiveCompanyId, effectiveLocationId, effectiveServiceAreaId } = useHierarchy();
  const [bump, setBump] = useState(0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const items = useMemo(() => getVisitsToSchedule(), [bump]);

  function schedule(agreementId: string, visitId: string) {
    const res = materializeVisitJob(agreementId, visitId, {
      companyId: effectiveCompanyId ?? "co_hvac",
      locationId: effectiveLocationId ?? "loc_augusta",
      serviceAreaId: effectiveServiceAreaId ?? undefined,
    });
    if (res.job) router.push(`/jobs/${res.job.id}`);
    else setBump(b => b + 1);
  }

  if (items.length === 0) {
    return (
      <div className="rounded-xl p-4 h-full min-h-0 flex flex-col items-center justify-center"
        style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)" }}>
        <CalendarClock className="w-6 h-6 mb-2 opacity-30" style={{ color: "var(--text-muted)" }} />
        <p className="text-sm text-center" style={{ color: "var(--text-muted)" }}>No agreement visits to schedule.</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl overflow-hidden h-full min-h-0 flex flex-col"
      style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)" }}>
      <div className="flex items-center justify-between px-4 py-3 shrink-0" style={{ borderBottom: "1px solid var(--border)" }}>
        <div className="flex items-center gap-2">
          <CalendarClock className="w-4 h-4" style={{ color: "#059669" }} />
          <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Visits to Schedule</h2>
        </div>
        <span className="text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center" style={{ backgroundColor: "#ecfdf5", color: "#059669" }}>{items.length}</span>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto dashboard-widget-content">
        {items.map(({ agreement, visit }) => (
          <div key={visit.id} className="flex items-center gap-3 px-4 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>{agreement.customer}</p>
              <p className="text-xs mt-0.5 truncate" style={{ color: "var(--text-muted)" }}>{visit.label} · {visit.scheduled}</p>
            </div>
            <button onClick={() => schedule(agreement.id, visit.id)}
              className="shrink-0 inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-lg text-white bg-indigo-600 hover:bg-indigo-700 transition-colors">
              Schedule <ChevronRight className="w-3 h-3" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
