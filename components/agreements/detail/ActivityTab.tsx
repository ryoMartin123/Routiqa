"use client";

// Activity: a system-history timeline derived from the agreement snapshot. This
// is system events (not internal notes — those live in the Notes tab). Layout:
// date column on the left, a small tinted icon on the connector line, then a clean
// surface container with a category pill and detail. Amber is the default accent;
// completions are green.

import { useMemo } from "react";
import { FilePlus2, PlayCircle, CalendarPlus, CalendarCheck, CheckCircle2, RefreshCw, Ban, User } from "lucide-react";
import { type CustomerAgreement } from "@/lib/agreements/data";

interface Entry { icon: typeof FilePlus2; color: string; label: string; detail?: string; date?: string; }

export default function ActivityTab({ agreement }: { agreement: CustomerAgreement }) {
  const entries = useMemo<Entry[]>(() => {
    const out: Entry[] = [];
    out.push({ icon: FilePlus2, color: "#d97706", label: "Agreement Created", date: agreement.startDate });
    out.push({ icon: PlayCircle, color: "#059669", label: "Agreement Activated", date: agreement.startDate });
    if ((agreement.visits ?? []).length) out.push({ icon: CalendarPlus, color: "#d97706", label: "Visits Generated", detail: `${agreement.visits.length} visit(s) added to the schedule`, date: agreement.startDate });
    for (const v of agreement.visits ?? []) {
      if (v.status === "scheduled") out.push({ icon: CalendarCheck, color: "#d97706", label: "Visit Scheduled", detail: v.label, date: v.scheduled });
      if (v.status === "completed") out.push({ icon: CheckCircle2, color: "#059669", label: "Visit Completed", detail: v.label, date: v.completedDate ?? v.scheduled });
    }
    if (agreement.renewalDate) out.push({ icon: RefreshCw, color: "#d97706", label: "Renewal Date Set", date: agreement.renewalDate });
    if (agreement.status === "canceled") out.push({ icon: Ban, color: "#b91c1c", label: "Agreement Canceled" });
    return out;
  }, [agreement]);

  if (entries.length === 0) {
    return (
      <div className="py-12 text-center rounded-xl" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)" }}>
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>No activity yet</p>
      </div>
    );
  }

  return (
    <div>
      {entries.map((e, i) => {
        const Icon = e.icon;
        const last = i === entries.length - 1;
        return (
          <div key={i} className="flex gap-3">
            {/* Icon + connector */}
            <div className="flex flex-col items-center shrink-0">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center z-10"
                style={{ backgroundColor: e.color + "1a", border: `1px solid ${e.color}33` }}>
                <Icon className="w-3.5 h-3.5" style={{ color: e.color }} />
              </div>
              {!last && <div className="w-px flex-1 my-1" style={{ backgroundColor: "var(--border-subtle)" }} />}
            </div>

            {/* Content container — uniform regardless of content */}
            <div className="flex-1 min-w-0 rounded-xl px-4 py-3 mb-3 flex flex-col"
              style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-card)", minHeight: 80 }}>
              <div className="flex items-start justify-between gap-3">
                <span className="inline-block text-[10px] font-semibold px-2 py-0.5 rounded-md shrink-0"
                  style={{ backgroundColor: e.color + "1a", color: e.color }}>{e.label}</span>
                {e.date && <span className="text-xs shrink-0" style={{ color: "var(--text-muted)" }}>{e.date}</span>}
              </div>
              {e.detail && <p className="text-sm font-medium mt-1.5 break-words leading-relaxed" style={{ color: "var(--text-primary)" }}>{e.detail}</p>}
              <div className="flex items-center gap-1.5 mt-auto pt-1.5">
                <User className="w-3 h-3 shrink-0" style={{ color: "var(--text-muted)" }} />
                <span className="text-[11px] truncate" style={{ color: "var(--text-muted)" }}>System</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
