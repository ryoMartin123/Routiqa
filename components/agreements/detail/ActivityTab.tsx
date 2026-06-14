"use client";

// Activity: a system-history timeline derived from the agreement snapshot. This
// is system events (not internal notes — those live in the Notes tab).

import { useMemo } from "react";
import { FilePlus2, PlayCircle, CalendarPlus, CalendarCheck, CheckCircle2, RefreshCw, Ban } from "lucide-react";
import { type CustomerAgreement } from "@/lib/agreements/data";
import { Card, SectionLabel } from "./shared";

interface Entry { icon: typeof FilePlus2; color: string; label: string; date?: string; }

export default function ActivityTab({ agreement }: { agreement: CustomerAgreement }) {
  const entries = useMemo<Entry[]>(() => {
    const out: Entry[] = [];
    out.push({ icon: FilePlus2, color: "#6366f1", label: "Agreement created", date: agreement.startDate });
    out.push({ icon: PlayCircle, color: "#10b981", label: "Agreement activated", date: agreement.startDate });
    if ((agreement.visits ?? []).length) out.push({ icon: CalendarPlus, color: "#6366f1", label: `${agreement.visits.length} visit(s) generated`, date: agreement.startDate });
    for (const v of agreement.visits ?? []) {
      if (v.status === "scheduled") out.push({ icon: CalendarCheck, color: "#6366f1", label: `Visit scheduled — ${v.label}`, date: v.scheduled });
      if (v.status === "completed") out.push({ icon: CheckCircle2, color: "#10b981", label: `Visit completed — ${v.label}`, date: v.completedDate ?? v.scheduled });
    }
    if (agreement.renewalDate) out.push({ icon: RefreshCw, color: "#f59e0b", label: "Renewal date set", date: agreement.renewalDate });
    if (agreement.status === "canceled") out.push({ icon: Ban, color: "#ef4444", label: "Agreement canceled" });
    return out;
  }, [agreement]);

  return (
    <Card className="p-5" style={{ maxWidth: 720 }}>
      <SectionLabel>Activity</SectionLabel>
      <div className="mt-4 space-y-0">
        {entries.map((e, i) => {
          const Icon = e.icon;
          return (
            <div key={i} className="flex gap-3">
              <div className="flex flex-col items-center">
                <span className="w-7 h-7 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: e.color + "20" }}>
                  <Icon className="w-3.5 h-3.5" style={{ color: e.color }} />
                </span>
                {i < entries.length - 1 && <span className="w-px flex-1 my-1" style={{ backgroundColor: "var(--border-subtle)" }} />}
              </div>
              <div className="pb-4 min-w-0">
                <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{e.label}</p>
                {e.date && <p className="text-[11px] mt-0.5" style={{ color: "var(--text-muted)" }}>{e.date}</p>}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
