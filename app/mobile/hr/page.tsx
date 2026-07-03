"use client";

import { useMemo } from "react";
import { UsersRound, UserCheck, Plane, GraduationCap } from "lucide-react";
import MobileHeader from "@/components/mobile/MobileHeader";
import { Card, Section } from "@/components/mobile/ui";
import { getStaffedUsers } from "@/lib/users/data";

const PINK = "#ec4899";

export default function MobileHRPage() {
  const employees = useMemo(() => getStaffedUsers(), []);
  const active = employees.filter(e => e.status === "active").length;

  return (
    <div>
      <MobileHeader title="HR" subtitle="People & employees" back />
      <div className="px-4 space-y-5">
        <div className="grid grid-cols-2 gap-3">
          <Kpi icon={UsersRound} label="Employees" value={String(employees.length)} color={PINK} />
          <Kpi icon={UserCheck} label="Active" value={String(active)} color="#16a34a" />
          <Kpi icon={Plane} label="On time off" value="2" color="#f59e0b" />
          <Kpi icon={GraduationCap} label="In training" value="4" color="#2563eb" />
        </div>

        <Section title="Team">
          <Card>
            {employees.slice(0, 20).map((e, i) => {
              const role = e.assignments?.[0]?.role?.replace(/_/g, " ") ?? "Team member";
              return (
                <div key={e.id} className="flex items-center gap-3 px-4 py-3" style={{ borderTop: i ? "1px solid var(--border)" : "none" }}>
                  <span className="w-9 h-9 rounded-full flex items-center justify-center text-[11px] font-bold text-white shrink-0" style={{ backgroundColor: PINK }}>{e.initials}</span>
                  <div className="min-w-0 flex-1"><p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>{e.fullName}</p><p className="text-xs capitalize truncate" style={{ color: "var(--text-muted)" }}>{role}</p></div>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize shrink-0" style={{ backgroundColor: e.status === "active" ? "#16a34a22" : "var(--bg-surface-2)", color: e.status === "active" ? "#16a34a" : "var(--text-muted)" }}>{e.status}</span>
                </div>
              );
            })}
          </Card>
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
