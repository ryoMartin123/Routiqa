"use client";

import { useMemo } from "react";
import Link from "next/link";
import { Briefcase, UserX, Flame, HardHat, Map } from "lucide-react";
import MobileHeader from "@/components/mobile/MobileHeader";
import { Card, Section, EmptyState, ACCENT } from "@/components/mobile/ui";
import { getMapJobs, getMapTechnicians, MARKER_CONFIG, TECH_STATUS_CONFIG } from "@/lib/dispatch-map/data";
import { todayYMD } from "@/lib/utils/schedule";

export default function MobileDispatchPage() {
  const jobs = useMemo(() => getMapJobs(), []);
  const techs = useMemo(() => getMapTechnicians(), []);
  const today = todayYMD();
  const todayJobs = jobs.filter(j => j.scheduledDate === today);
  const unassigned = jobs.filter(j => j.kind === "unassigned").length;
  const emergencies = todayJobs.filter(j => j.kind === "emergency").length;
  const available = techs.filter(t => t.status === "available").length;
  const jobCount = (name: string) => jobs.filter(j => j.assignedTo === name).length;

  return (
    <div>
      <MobileHeader title="Dispatch" subtitle={`${todayJobs.length} jobs today`} back
        right={<Link href="/mobile/map" className="w-9 h-9 rounded-full flex items-center justify-center" style={{ backgroundColor: ACCENT }}><Map className="w-5 h-5 text-white" /></Link>} />
      <div className="px-4 space-y-5">
        <div className="grid grid-cols-2 gap-3">
          <Kpi icon={Briefcase} label="Jobs today" value={String(todayJobs.length)} color={ACCENT} />
          <Kpi icon={UserX} label="Unassigned" value={String(unassigned)} color="#6b7280" />
          <Kpi icon={Flame} label="Emergencies" value={String(emergencies)} color="#dc2626" />
          <Kpi icon={HardHat} label="Available techs" value={String(available)} color="#16a34a" />
        </div>

        <Section title="Technicians">
          <Card>
            {techs.map((t, i) => {
              const sc = TECH_STATUS_CONFIG[t.status];
              return (
                <div key={t.name} className="flex items-center gap-3 px-4 py-3" style={{ borderTop: i ? "1px solid var(--border)" : "none" }}>
                  <span className="w-9 h-9 rounded-lg flex items-center justify-center text-[11px] font-bold text-white shrink-0" style={{ backgroundColor: sc.color }}>{t.initials}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>{t.name}</p>
                    <p className="text-xs truncate" style={{ color: "var(--text-muted)" }}>{jobCount(t.name)} jobs · {t.truck}</p>
                  </div>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0" style={{ backgroundColor: sc.color + "22", color: sc.color }}>{sc.label}</span>
                </div>
              );
            })}
          </Card>
        </Section>

        <Section title="Today's jobs">
          {todayJobs.length === 0 ? <Card className="px-4 py-6"><EmptyState icon={Briefcase} title="Nothing scheduled today" /></Card> : (
            <div className="space-y-2.5">
              {todayJobs.slice(0, 12).map(j => {
                const m = MARKER_CONFIG[j.kind];
                return (
                  <Link key={j.id} href={`/mobile/jobs/${j.id}`} className="flex items-center gap-3 rounded-2xl p-3" style={{ border: "1px solid var(--border)", backgroundColor: "var(--bg-surface)" }}>
                    <span className="w-1 h-9 rounded-full shrink-0" style={{ backgroundColor: m.color }} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold truncate" style={{ color: "var(--text-primary)" }}>{j.customerName}</p>
                      <p className="text-xs truncate" style={{ color: "var(--text-muted)" }}>{j.scheduledTime || "—"} · {j.assignedTo || "Unassigned"}</p>
                    </div>
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded shrink-0" style={{ backgroundColor: m.color + "22", color: m.color }}>{m.label}</span>
                  </Link>
                );
              })}
            </div>
          )}
        </Section>
      </div>
    </div>
  );
}

function Kpi({ icon: Icon, label, value, color }: { icon: React.ElementType; label: string; value: string; color: string }) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-1.5"><Icon className="w-3.5 h-3.5" style={{ color }} /><p className="text-[11px] font-medium truncate" style={{ color: "var(--text-muted)" }}>{label}</p></div>
      <p className="text-xl font-bold mt-1 tabular-nums" style={{ color: "var(--text-primary)" }}>{value}</p>
    </Card>
  );
}
