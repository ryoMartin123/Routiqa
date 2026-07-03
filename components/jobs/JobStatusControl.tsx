"use client";

// ─── Job status history (read-only) ───────────────────────
// The job's status is changed only from the dispatch board stage icon (or the
// mobile app, later) — never from here. This renders the read-only audit trail
// of every status change for the job's History tab.

import { useMemo } from "react";
import { ArrowRight } from "lucide-react";
import { type Job } from "@/lib/jobs/data";
import { getJobStatuses } from "@/lib/job-config/data";
import StatusBadge from "@/components/shared/StatusBadge";

function fmtDateTime(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export function JobHistoryList({ job }: { job: Job }) {
  const statuses = useMemo(() => getJobStatuses(), []);
  const labelOf  = (k: string) => statuses.find(s => s.key === k)?.name ?? k;
  const colorOf  = (k: string) => statuses.find(s => s.key === k)?.color ?? "#6b7280";
  const events = [...(job.statusHistory ?? [])].reverse();

  if (events.length === 0) {
    return (
      <div className="rounded-xl py-12 text-center" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)" }}>
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>No status changes recorded yet.</p>
        <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>Every status update — by a tech, salesperson, or dispatcher — will be logged here.</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-2">
      {events.map(e => (
        <div key={e.id} className="rounded-xl p-3.5" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" }}>
          <div className="flex items-center gap-2 flex-wrap">
            <StatusBadge label={labelOf(e.from)} color={colorOf(e.from)} />
            <ArrowRight className="w-3.5 h-3.5" style={{ color: "var(--text-muted)" }} />
            <StatusBadge label={labelOf(e.to)} color={colorOf(e.to)} />
            {e.override && (
              <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full"
                style={{ backgroundColor: "var(--warning-soft-bg)", color: "var(--warning-text)" }}>Override</span>
            )}
            <span className="ml-auto text-[11px]" style={{ color: "var(--text-muted)" }}>{fmtDateTime(e.at)}</span>
          </div>
          <p className="text-xs mt-1.5" style={{ color: "var(--text-secondary)" }}>
            {e.byName}{e.byRole ? ` · ${e.byRole}` : ""}
          </p>
          {e.reason && <p className="text-xs mt-1 italic" style={{ color: "var(--text-muted)" }}>&ldquo;{e.reason}&rdquo;</p>}
        </div>
      ))}
    </div>
  );
}
