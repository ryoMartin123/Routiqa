"use client";

// ─── HR — placeholder dashboard ───────────────────────────
// The ADMINISTRATIVE people app (manage employees), distinct from My Portal
// (employee self-service). Layout + access wired; functionality lands later.

import { UsersRound, UserPlus, ClipboardCheck, Plane, Star, GraduationCap } from "lucide-react";
import { PageHeader, StatCard } from "@/components/platform/ui";

export default function HrDashboard() {
  return (
    <div className="p-6 space-y-4">
      <PageHeader title="HR Dashboard" subtitle="Manage your people — employees, hiring, onboarding, and reviews." accent="#ec4899" />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Active Employees" value="24" hint="3 locations" icon={UsersRound} accent="#ec4899" />
        <StatCard label="Open Roles" value="3" hint="2 in interview" icon={UserPlus} accent="#0ea5e9" />
        <StatCard label="In Onboarding" value="2" hint="Starting this month" icon={ClipboardCheck} accent="#f59e0b" />
        <StatCard label="Time Off Requests" value="5" hint="2 pending approval" icon={Plane} accent="#239c8d" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Panel title="Upcoming Reviews" icon={Star} accent="#f59e0b" lines={["Tucker Hayes — 90-day · Jun 30", "Kylie Brooks — Annual · Jul 12"]} />
        <Panel title="Training Compliance" icon={GraduationCap} accent="#10b981" lines={["Safety certification — 88% complete", "Equipment handling — 4 outstanding"]} />
      </div>
    </div>
  );
}

function Panel({ title, icon: Icon, accent, lines }: { title: string; icon: typeof Star; accent: string; lines: string[] }) {
  return (
    <div className="rounded-xl p-5" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)" }}>
      <div className="flex items-center gap-2.5 mb-3">
        <span className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: accent + "22" }}>
          <Icon className="w-4 h-4" style={{ color: accent }} />
        </span>
        <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{title}</h2>
      </div>
      <ul className="space-y-2">
        {lines.map((l, i) => (
          <li key={i} className="text-sm flex items-center gap-2" style={{ color: "var(--text-secondary)" }}>
            <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: accent }} />
            <span className="truncate">{l}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
