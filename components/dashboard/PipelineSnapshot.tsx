"use client";

import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { ALL_LEADS, LEAD_STAGE_CONFIG } from "@/lib/leads/data";
import { useHierarchy } from "@/components/providers/HierarchyProvider";

const ACTIVE_STAGES = [
  "new_lead", "contacted", "appointment_scheduled",
  "estimate_needed", "estimate_sent", "follow_up",
] as const;

export default function PipelineSnapshot() {
  const { effectiveCompanyId, effectiveLocationId } = useHierarchy();

  const leads = ALL_LEADS.filter(l =>
    (!effectiveCompanyId  || l.companyId  === effectiveCompanyId) &&
    (!effectiveLocationId || l.locationId === effectiveLocationId)
  );

  const active = leads.filter(l => !["won", "lost"].includes(l.stage));
  const won    = leads.filter(l => l.stage === "won").length;

  const counts = ACTIVE_STAGES.map(stage => ({
    stage,
    config: LEAD_STAGE_CONFIG[stage],
    count:  leads.filter(l => l.stage === stage).length,
  }));
  const maxCount = Math.max(...counts.map(c => c.count), 1);

  return (
    <div className="rounded-xl p-4 h-full min-h-0 flex flex-col"
      style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-subtle)", boxShadow: "var(--shadow-card)" }}>
      <div className="flex items-center justify-between mb-3 shrink-0">
        <div>
          <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Pipeline</h2>
          <p className="text-[10px] mt-0.5" style={{ color: "var(--text-muted)" }}>{active.length} active · {won} won</p>
        </div>
        <Link href="/leads?view=pipeline" className="flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-700">
          Full view <ExternalLink className="w-3 h-3" />
        </Link>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto dashboard-widget-content space-y-2">
        {counts.map(({ stage, config, count }) => (
          <div key={stage} className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: config.color }} />
            <span className="text-xs w-28 truncate shrink-0" style={{ color: "var(--text-secondary)" }}>
              {config.label}
            </span>
            <div className="flex-1 h-1.5 rounded-full" style={{ backgroundColor: "var(--bg-input)" }}>
              {count > 0 && (
                <div className="h-1.5 rounded-full"
                  style={{ width: `${(count / maxCount) * 100}%`, backgroundColor: config.color + "99" }} />
              )}
            </div>
            <span className="text-xs font-semibold w-4 text-right shrink-0"
              style={{ color: count > 0 ? "var(--text-primary)" : "var(--text-muted)" }}>
              {count}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
