"use client";

// Visits: the schedule rules (why work is due) + the generated agreement visits.
//
//   Agreement Visit = the reason work is due.
//   Job             = the scheduled work event (created lazily on Schedule).
//   Work Order      = the checklist/instructions on that job.
// Scheduling materializes a single job and routes to it — we never show the same
// work as both an agreement visit and a dispatch job.

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight, MinusCircle } from "lucide-react";
import { materializeVisitJob, type CustomerAgreement } from "@/lib/agreements/data";
import { getVisitRules } from "@/lib/agreements/settings";
import { getTemplates as getWorkOrderTemplates } from "@/lib/work-order-templates/data";
import { getJobTypes } from "@/lib/job-config/data";
import { useHierarchy } from "@/components/providers/HierarchyProvider";
import { Card, SectionLabel, VISIT_DISPLAY, deriveVisitDisplay } from "./shared";

export default function VisitsTab({ agreement, onRefresh }: { agreement: CustomerAgreement; onRefresh: () => void }) {
  const router = useRouter();
  const { effectiveCompanyId, effectiveLocationId, effectiveServiceAreaId } = useHierarchy();
  const [err, setErr] = useState<string | null>(null);
  const [skipped, setSkipped] = useState<Set<string>>(new Set());

  const visitRuleName = useMemo(() => {
    const map = new Map(getVisitRules().map(r => [r.key, r.name]));
    return (key: string) => map.get(key) ?? key;
  }, []);
  const woName = useMemo(() => {
    const map = new Map(getWorkOrderTemplates().map(t => [t.id, t.name]));
    return (id?: string) => (id ? map.get(id) ?? "—" : "—");
  }, []);
  const jobTypeName = useMemo(() => {
    const map = new Map(getJobTypes().map(j => [j.key, j.name]));
    return (key?: string) => (key ? map.get(key) ?? key : "—");
  }, []);

  function scheduleVisit(visitId: string) {
    const res = materializeVisitJob(agreement.id, visitId, {
      companyId: effectiveCompanyId ?? "co_hvac",
      locationId: effectiveLocationId ?? "loc_augusta",
      serviceAreaId: effectiveServiceAreaId ?? undefined,
    });
    if (res.error || !res.job) { setErr(res.error ?? "Could not schedule visit."); return; }
    router.push(`/jobs/${res.job.id}`);
  }
  function toggleSkip(id: string) {
    setSkipped(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
    onRefresh();
  }

  const rules = agreement.visitPlan ?? [];
  // How many generated visits each schedule rule produced — labels are
  // "<rule name>" or "<rule name> N of M", so match by name/prefix. Makes it
  // clear that one visit type with a frequency of N yields N visits.
  const genCountFor = (name: string) =>
    agreement.visits.filter(x => x.label === name || x.label.startsWith(`${name} `)).length;

  return (
    <div className="space-y-4">
      {err && <p className="text-xs" style={{ color: "#dc2626" }}>{err}</p>}

      {/* Schedule rules */}
      <Card className="overflow-hidden">
        <div className="px-4 py-3" style={{ borderBottom: "1px solid var(--border)", backgroundColor: "var(--bg-surface-2)" }}>
          <SectionLabel>Visit Schedule Rules — when we go</SectionLabel>
        </div>
        {rules.length === 0 ? (
          <div className="px-4 py-6 text-center"><p className="text-sm" style={{ color: "var(--text-muted)" }}>No schedule rules on this agreement.</p></div>
        ) : (
          <div className="grid px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider"
            style={{ gridTemplateColumns: "2fr 1fr 1.2fr 0.8fr 1fr 1.4fr", gap: "0.75rem", color: "var(--text-muted)", borderBottom: "1px solid var(--border)" }}>
            <span>Visit</span><span>Frequency</span><span>Window</span><span>Duration</span><span>Job Type</span><span>Work Order</span>
          </div>
        )}
        {rules.map((v, i) => (
          <div key={v.id} className="grid px-4 py-3 items-center" style={{ gridTemplateColumns: "2fr 1fr 1.2fr 0.8fr 1fr 1.4fr", gap: "0.75rem", borderBottom: i < rules.length - 1 ? "1px solid var(--border)" : "none" }}>
            <div className="min-w-0">
              <span className="text-sm font-medium truncate block" style={{ color: "var(--text-primary)" }}>{v.name}</span>
              {(() => { const n = genCountFor(v.name); return n > 0 ? (
                <span className="text-[10px] font-semibold mt-0.5 inline-block px-1.5 py-0.5 rounded" style={{ backgroundColor: "var(--accent-soft-bg)", color: "var(--accent-text)" }}>{n} visit{n === 1 ? "" : "s"} / term</span>
              ) : null; })()}
            </div>
            <span className="text-xs" style={{ color: "var(--text-secondary)" }}>{visitRuleName(v.frequencyKey)}</span>
            <span className="text-xs truncate" style={{ color: "var(--text-secondary)" }}>{v.preferredWindow ?? "—"}</span>
            <span className="text-xs" style={{ color: "var(--text-secondary)" }}>{v.durationMin}m</span>
            <span className="text-xs" style={{ color: "var(--text-secondary)" }}>{jobTypeName(v.jobTypeKey)}</span>
            <span className="text-xs truncate" style={{ color: "var(--text-secondary)" }}>{woName(v.workOrderTemplateId)}</span>
          </div>
        ))}
      </Card>

      {/* Generated visits */}
      <Card className="overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: "1px solid var(--border)", backgroundColor: "var(--bg-surface-2)" }}>
          <SectionLabel>Generated Visits ({agreement.visits.length})</SectionLabel>
        </div>
        <div className="grid px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider"
          style={{ gridTemplateColumns: "1fr 2fr 1.2fr 1fr 1.6fr", gap: "0.75rem", color: "var(--text-muted)", borderBottom: "1px solid var(--border)" }}>
          <span>Status</span><span>Visit</span><span>Scheduled</span><span>Tech</span><span>Action</span>
        </div>
        {agreement.visits.length === 0 ? (
          <div className="py-10 text-center"><p className="text-sm" style={{ color: "var(--text-muted)" }}>No visits generated yet.</p></div>
        ) : (
          agreement.visits.map((v, i) => {
            const disp = deriveVisitDisplay(v, skipped.has(v.id));
            const meta = VISIT_DISPLAY[disp];
            const Icon = meta.icon;
            const isSkipped = skipped.has(v.id);
            return (
              <div key={v.id} className="grid px-4 py-3 items-center" style={{ gridTemplateColumns: "1fr 2fr 1.2fr 1fr 1.6fr", gap: "0.75rem", borderBottom: i < agreement.visits.length - 1 ? "1px solid var(--border)" : "none", opacity: isSkipped ? 0.6 : 1 }}>
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full w-fit" style={{ backgroundColor: meta.color + "20", color: meta.color }}>
                  <Icon className="w-3 h-3" /> {disp}
                </span>
                <span className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>{v.label}</span>
                <span className="text-sm" style={{ color: "var(--text-secondary)" }}>{v.scheduled}</span>
                <span className="text-sm truncate" style={{ color: "var(--text-secondary)" }}>{v.tech}</span>
                <div className="flex items-center gap-1.5">
                  {v.jobId ? (
                    <Link href={`/jobs/${v.jobId}`} className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-lg transition-colors text-[#0f8578] cursor-pointer" style={{ border: "1px solid #b9dfd8" }}>
                      Open job <ChevronRight className="w-3 h-3" />
                    </Link>
                  ) : v.status === "completed" || isSkipped ? (
                    <span className="text-xs" style={{ color: "var(--text-muted)" }}>—</span>
                  ) : (
                    <button onClick={() => scheduleVisit(v.id)} className="text-xs px-2 py-1 rounded-lg text-white bg-[#0f8578] hover:bg-[#0c6b60] cursor-pointer transition-colors">
                      {v.status === "missed" ? "Reschedule" : "Schedule"}
                    </button>
                  )}
                  {v.status !== "completed" && !v.jobId && (
                    <button onClick={() => toggleSkip(v.id)} title={isSkipped ? "Un-skip" : "Mark skipped"}
                      className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-lg cursor-pointer transition-colors hover:bg-[var(--bg-surface-2)]" style={{ border: "1px solid var(--border)", color: "var(--text-muted)" }}>
                      <MinusCircle className="w-3 h-3" /> {isSkipped ? "Undo" : "Skip"}
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </Card>
    </div>
  );
}
