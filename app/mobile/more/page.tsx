"use client";

import { useMemo } from "react";
import Link from "next/link";
import {
  LayoutDashboard, Clock, GraduationCap, FileText, User, Settings, LifeBuoy, LogOut,
  Monitor, ChevronRight, Radio, Users, ClipboardCheck, LayoutGrid,
} from "lucide-react";
import MobileHeader from "@/components/mobile/MobileHeader";
import { Section, Card, ACCENT } from "@/components/mobile/ui";
import { getCurrentTech, isFieldManager, setMobileExperience } from "@/lib/mobile/data";

type Item = { icon: React.ElementType; label: string; href?: string; danger?: boolean };

export default function MorePage() {
  const me = useMemo(() => getCurrentTech(), []);
  const manager = me ? isFieldManager(me) : false;
  const role = me?.assignments?.[0]?.role?.replace(/_/g, " ") ?? "Field user";

  const work: Item[] = [
    { icon: LayoutDashboard, label: "My Portal", href: "/mobile/more/portal" },
    { icon: Clock, label: "Time Card", href: "/mobile/more/timecard" },
    { icon: GraduationCap, label: "Training", href: "/mobile/more/training" },
    { icon: FileText, label: "Documents & SOPs", href: "/mobile/more/documents" },
  ];
  const managerItems: Item[] = [
    { icon: Radio, label: "Dispatch Overview", href: "/dispatching" },
    { icon: Users, label: "Team Status", href: "/dispatching" },
    { icon: ClipboardCheck, label: "Approvals", href: "/portal/action-items" },
  ];
  const account: Item[] = [
    { icon: User, label: "Profile", href: "/mobile/more/profile" },
    { icon: Settings, label: "Settings", href: "/mobile/more/settings" },
    { icon: LifeBuoy, label: "Help & Support" },
    { icon: Monitor, label: "Switch to desktop", href: "/dashboard" },
    { icon: LogOut, label: "Log out", href: "/login", danger: true },
  ];

  const List = ({ items }: { items: Item[] }) => (
    <Card>
      {items.map((it, i) => {
        const inner = (
          <div className="flex items-center gap-3 px-4 py-3.5" style={{ borderTop: i ? "1px solid var(--border)" : "none" }}>
            <it.icon className="w-5 h-5 shrink-0" style={{ color: it.danger ? "#dc2626" : "var(--text-secondary)" }} />
            <span className="text-[15px] flex-1" style={{ color: it.danger ? "#dc2626" : "var(--text-primary)" }}>{it.label}</span>
            {!it.danger && <ChevronRight className="w-4 h-4 shrink-0" style={{ color: "var(--text-muted)" }} />}
          </div>
        );
        return it.href
          ? <Link key={it.label} href={it.href} className="block active:bg-[var(--bg-surface-2)]">{inner}</Link>
          : <button key={it.label} className="w-full text-left active:bg-[var(--bg-surface-2)]">{inner}</button>;
      })}
    </Card>
  );

  return (
    <div>
      <MobileHeader title="More" />
      <div className="px-4 space-y-5">
        {/* Identity */}
        <Card className="p-4 flex items-center gap-3">
          <span className="w-12 h-12 rounded-full flex items-center justify-center text-base font-bold text-white" style={{ backgroundColor: ACCENT }}>{me?.initials}</span>
          <div className="min-w-0">
            <p className="text-base font-bold truncate" style={{ color: "var(--text-primary)" }}>{me?.fullName}</p>
            <p className="text-sm capitalize" style={{ color: "var(--text-muted)" }}>{role}</p>
          </div>
        </Card>

        <Section title="Work"><List items={work} /></Section>
        {manager && <Section title="Manager"><List items={managerItems} /></Section>}
        <Section title="Account"><List items={account} /></Section>

        {/* Broad-access users can switch to the full app-drawer navigation. */}
        <button onClick={() => { setMobileExperience("full"); window.location.href = "/mobile/today"; }}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-semibold"
          style={{ border: `1px solid ${ACCENT}55`, color: ACCENT, backgroundColor: ACCENT + "0d" }}>
          <LayoutGrid className="w-4 h-4" /> Switch to full menu
        </button>

        <p className="text-center text-xs pt-1" style={{ color: "var(--text-muted)" }}>Routiqa Mobile · Field</p>
      </div>
    </div>
  );
}
