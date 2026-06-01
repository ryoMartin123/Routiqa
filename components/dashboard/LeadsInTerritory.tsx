"use client";

import Link from "next/link";
import { Map, ExternalLink } from "lucide-react";
import { ALL_LEADS, LEAD_STAGE_CONFIG } from "@/lib/leads/data";
import { serviceAreas } from "@/lib/hierarchy/data";
import { useHierarchy } from "@/components/providers/HierarchyProvider";

export default function LeadsInTerritory() {
  const { effectiveServiceAreaId } = useHierarchy();

  const area = serviceAreas.find(s => s.id === effectiveServiceAreaId);
  const leads = ALL_LEADS.filter(l =>
    l.serviceAreaId === effectiveServiceAreaId && !["won", "lost"].includes(l.stage)
  );

  const stages = Object.entries(LEAD_STAGE_CONFIG)
    .sort((a, b) => a[1].order - b[1].order)
    .map(([key, cfg]) => ({
      key, cfg, count: leads.filter(l => l.stage === key).length,
    }))
    .filter(s => s.count > 0);

  return (
    <div className="rounded-xl overflow-hidden h-full min-h-0 flex flex-col"
      style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-subtle)", boxShadow: "var(--shadow-card)" }}>
      <div className="flex items-center justify-between px-5 py-4 shrink-0"
        style={{ borderBottom: "1px solid var(--border-subtle)" }}>
        <div className="flex items-center gap-2">
          <Map className="w-4 h-4" style={{ color: "#4f46e5" }} />
          <div>
            <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Leads in Territory</h2>
            {area && <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>{area.name}</p>}
          </div>
        </div>
        <Link href="/leads" className="flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-700">
          View all <ExternalLink className="w-3 h-3" />
        </Link>
      </div>

      {leads.length === 0 ? (
        <div className="flex-1 min-h-0 flex items-center justify-center px-5 py-8 text-center">
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>No open leads in this territory.</p>
        </div>
      ) : (
        <div className="flex-1 min-h-0 overflow-y-auto dashboard-widget-content p-4 space-y-2">
          <p className="text-xs font-semibold mb-3" style={{ color: "var(--text-muted)" }}>
            {leads.length} open lead{leads.length !== 1 ? "s" : ""}
          </p>
          {stages.map(({ key, cfg, count }) => (
            <div key={key} className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: cfg.color }} />
              <span className="text-xs flex-1" style={{ color: "var(--text-secondary)" }}>{cfg.label}</span>
              <div className="w-20 h-1.5 rounded-full" style={{ backgroundColor: "var(--bg-input)" }}>
                <div className="h-1.5 rounded-full"
                  style={{ width: `${(count / leads.length) * 100}%`, backgroundColor: cfg.color + "99" }} />
              </div>
              <span className="text-xs font-semibold w-4 text-right" style={{ color: "var(--text-primary)" }}>{count}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
