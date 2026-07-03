"use client";

import { useMemo } from "react";
import Link from "next/link";
import { Users, ShieldCheck, Building2, Globe, ChevronRight } from "lucide-react";
import MobileHeader from "@/components/mobile/MobileHeader";
import { Card, Section } from "@/components/mobile/ui";
import { getStaffedUsers } from "@/lib/users/data";

const PURPLE = "#a855f7";

export default function MobileAdminPage() {
  const users = useMemo(() => getStaffedUsers(), []);
  const roles = useMemo(() => new Set(users.flatMap(u => u.assignments.map(a => a.role))).size, [users]);

  const links = [
    { icon: Users, label: "Users & Access", sub: `${users.length} users`, href: "/dashboard" },
    { icon: ShieldCheck, label: "Roles & Permissions", sub: `${roles} roles`, href: "/dashboard" },
    { icon: Building2, label: "Business Structure", sub: "Companies & locations", href: "/dashboard" },
    { icon: Globe, label: "Organization", sub: "Org settings & billing", href: "/dashboard" },
  ];

  return (
    <div>
      <MobileHeader title="Admin" subtitle="Platform management" back />
      <div className="px-4 space-y-5">
        <div className="grid grid-cols-2 gap-3">
          <Kpi icon={Users} label="Users" value={String(users.length)} color={PURPLE} />
          <Kpi icon={ShieldCheck} label="Roles" value={String(roles)} color="#2563eb" />
        </div>

        <Section title="Manage">
          <Card>
            {links.map((l, i) => (
              <Link key={l.label} href={l.href} className="flex items-center gap-3 px-4 py-3.5 active:bg-[var(--bg-surface-2)]" style={{ borderTop: i ? "1px solid var(--border)" : "none" }}>
                <span className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: PURPLE + "1a" }}><l.icon className="w-4 h-4" style={{ color: PURPLE }} /></span>
                <div className="min-w-0 flex-1"><p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{l.label}</p><p className="text-xs" style={{ color: "var(--text-muted)" }}>{l.sub}</p></div>
                <ChevronRight className="w-4 h-4 shrink-0" style={{ color: "var(--text-muted)" }} />
              </Link>
            ))}
          </Card>
        </Section>

        <Section title="Recent users">
          <Card>
            {users.slice(0, 8).map((u, i) => (
              <div key={u.id} className="flex items-center gap-3 px-4 py-3" style={{ borderTop: i ? "1px solid var(--border)" : "none" }}>
                <span className="w-9 h-9 rounded-full flex items-center justify-center text-[11px] font-bold text-white shrink-0" style={{ backgroundColor: PURPLE }}>{u.initials}</span>
                <div className="min-w-0 flex-1"><p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>{u.fullName}</p><p className="text-xs truncate" style={{ color: "var(--text-muted)" }}>{u.email}</p></div>
              </div>
            ))}
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
