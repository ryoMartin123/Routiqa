"use client";

// ─── My Portal — dashboard ────────────────────────────────
// The always-available self-service home. Every user lands here regardless of
// app access. Self-service cards only (your own schedule/hours/pay/training/…).
// Mock numbers for now — the layout and access model are what matter.

import Link from "next/link";
import {
  CalendarDays, Clock, DollarSign, GraduationCap, FileText, Plane,
  CheckSquare, Megaphone, ArrowRight,
} from "lucide-react";
import { usePermissionContext } from "@/components/providers/PermissionProvider";
import { StatCard } from "@/components/platform/ui";

export default function PortalDashboard() {
  const { actingUser } = usePermissionContext();
  const firstName = actingUser.fullName.split(/\s+/)[0];

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-semibold" style={{ color: "var(--text-primary)" }}>
          Good to see you, {firstName}.
        </h1>
        <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
          Here&apos;s your day at a glance.
        </p>
      </div>

      {/* Self-service stat cards — fixed-fraction grid scales with the viewport */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Hours This Week" value="32.5" hint="of 40 scheduled" icon={Clock} accent="#0ea5e9" />
        <StatCard label="Next Pay Date" value="Jun 28" hint="Direct deposit" icon={DollarSign} accent="#10b981" />
        <StatCard label="Open Training" value="2" hint="1 due this week" icon={GraduationCap} accent="#f59e0b" />
        <StatCard label="Time Off Balance" value="48 hrs" hint="6 days available" icon={Plane} accent="#239c8d" />
      </div>

      {/* Quick panels */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <PortalPanel
          title="Today's Schedule"
          icon={CalendarDays}
          accent="#0ea5e9"
          href="/portal/schedule"
          lines={["8:00a — Team huddle", "9:30a — Service call · Evans, GA", "1:00p — Install · Augusta, GA"]}
        />
        <PortalPanel
          title="Assigned Tasks"
          icon={CheckSquare}
          accent="#ec4899"
          href="/portal/tasks"
          lines={["Submit weekly timesheet", "Complete safety quiz", "Confirm next week's availability"]}
        />
        <PortalPanel
          title="Documents to Review"
          icon={FileText}
          accent="#a855f7"
          href="/portal/documents"
          lines={["Updated PTO policy", "2026 employee handbook"]}
        />
        <PortalPanel
          title="Recent Announcements"
          icon={Megaphone}
          accent="#f59e0b"
          href="/portal/announcements"
          lines={["Summer schedule changes", "New tool inventory process", "Q3 all-hands on Jul 10"]}
        />
      </div>
    </div>
  );
}

function PortalPanel({
  title, icon: Icon, accent, href, lines,
}: {
  title: string;
  icon: typeof Clock;
  accent: string;
  href: string;
  lines: string[];
}) {
  return (
    <div className="rounded-xl p-5" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)" }}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <span className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: accent + "22" }}>
            <Icon className="w-4 h-4" style={{ color: accent }} />
          </span>
          <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{title}</h2>
        </div>
        <Link href={href} className="flex items-center gap-1 text-xs font-medium" style={{ color: "var(--accent-text)" }}>
          View <ArrowRight className="w-3.5 h-3.5" />
        </Link>
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
