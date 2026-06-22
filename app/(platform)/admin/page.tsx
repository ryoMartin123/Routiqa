"use client";

// ─── Admin · Dashboard ────────────────────────────────────
// Platform overview. Stats are pulled from the live mock stores (users +
// hierarchy) so they track the real directory and structure.

import Link from "next/link";
import {
  Users, UserCheck, AppWindow, Building2, MapPin,
  MailPlus, ShieldAlert, CreditCard, ArrowRight,
} from "lucide-react";
import { usePermissionContext } from "@/components/providers/PermissionProvider";
import { useHierarchy } from "@/components/providers/HierarchyProvider";
import { PageHeader, StatCard } from "@/components/platform/ui";
import { PLATFORM_APPS } from "@/lib/platform/apps";

export default function AdminDashboard() {
  const { users } = usePermissionContext();
  const { allCompanies, allLocations } = useHierarchy();

  const activeUsers = users.filter((u) => u.status === "active").length;
  const invited = users.filter((u) => u.status === "invited").length;
  const activeCompanies = allCompanies.filter((c) => c.status === "active").length;
  const activeLocations = allLocations.filter((l) => l.status === "active").length;

  return (
    <div className="p-6 space-y-4">
      <PageHeader title="Dashboard" subtitle="Platform control center — users, access, structure, security, and billing." accent="#a855f7" />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Users" value={String(users.length)} hint={`${activeUsers} active`} icon={Users} accent="#a855f7" />
        <StatCard label="Active Users" value={String(activeUsers)} hint="Signed-in accounts" icon={UserCheck} accent="#10b981" />
        <StatCard label="Pending Invites" value={String(invited)} hint="Awaiting acceptance" icon={MailPlus} accent="#f59e0b" />
        <StatCard label="Active Apps" value={String(PLATFORM_APPS.length)} hint="Across the platform" icon={AppWindow} accent="#0ea5e9" />
        <StatCard label="Companies" value={String(activeCompanies)} hint="Active business units" icon={Building2} accent="#6366f1" />
        <StatCard label="Locations" value={String(activeLocations)} hint="Active branches" icon={MapPin} accent="#ec4899" />
        <StatCard label="Security Alerts" value="0" hint="No issues detected" icon={ShieldAlert} accent="#10b981" />
        <StatCard label="Billing" value="Active" hint="Pro plan · mock" icon={CreditCard} accent="#10b981" />
      </div>

      <div className="rounded-xl p-5" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)" }}>
        <h2 className="text-sm font-semibold mb-3" style={{ color: "var(--text-primary)" }}>Recent admin activity</h2>
        <ul className="space-y-2.5">
          {[
            "Ryo Martin invited Dana Whitfield (HR Manager)",
            "App access granted: Accounting → Nicole Adams",
            "Role updated: Dispatcher permissions changed",
            "Tucker Hayes accepted invite",
          ].map((a, i) => (
            <li key={i} className="flex items-center gap-2 text-sm" style={{ color: "var(--text-secondary)" }}>
              <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: "#a855f7" }} />
              <span className="truncate">{a}</span>
            </li>
          ))}
        </ul>
        <Link href="/admin/audit" className="inline-flex items-center gap-1 text-xs font-medium mt-4" style={{ color: "var(--accent-text)" }}>
          View full audit log <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    </div>
  );
}
