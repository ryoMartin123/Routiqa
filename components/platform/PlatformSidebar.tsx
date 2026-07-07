"use client";

// ─── Platform app sidebar ─────────────────────────────────
// Generic, nav-driven sidebar used by every app on the PlatformShell (Portal, HR,
// Accounting, Documents, Admin, Team Workspace, Inventory). Collapsible to an
// icon rail (persisted per browser). The CRM keeps its own richer Sidebar. Active
// state is optimistic so the highlight doesn't lag the route transition.

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import { organization } from "@/lib/hierarchy/data";
import { usePermissionContext } from "@/components/providers/PermissionProvider";
import { getRoleLabel } from "@/lib/roles/store";
import { appById, type PlatformAppId } from "@/lib/platform/apps";
import { APP_NAV } from "@/lib/platform/nav";

const COLLAPSE_KEY = "platform-sidebar-collapsed";

export default function PlatformSidebar({ appId }: { appId: PlatformAppId }) {
  const pathname = usePathname();
  const { actingUser } = usePermissionContext();
  const app = appById(appId);
  const items = APP_NAV[appId] ?? [];

  const [pending, setPending] = useState<string | null>(null);
  useEffect(() => setPending(null), [pathname]);
  const activeHref = pending ?? pathname;

  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => { try { setCollapsed(localStorage.getItem(COLLAPSE_KEY) === "1"); } catch { /* ignore */ } }, []);
  function toggle() {
    setCollapsed((c) => { const n = !c; try { localStorage.setItem(COLLAPSE_KEY, n ? "1" : "0"); } catch { /* ignore */ } return n; });
  }

  // Exact match for the index; prefix match for sub-pages.
  const isActive = (href: string) =>
    href === app?.href ? activeHref === href : activeHref === href || activeHref.startsWith(href + "/");

  const role = actingUser.isOrgOwner
    ? "Owner"
    : actingUser.assignments[0]
      ? getRoleLabel(actingUser.assignments[0].role)
      : "Member";

  const Icon = app?.icon;

  return (
    <div className={cn("flex flex-col shrink-0 transition-[width] duration-300 ease-in-out", collapsed ? "w-16" : "w-60")} style={{ backgroundColor: "var(--sidebar-bg)" }}>
      {/* App identity header — [app icon] App Name / Organization. When collapsed
          the icon + text disappear and only the toggle remains (like the CRM). */}
      <div className={cn("flex items-center px-4 py-4", collapsed ? "justify-center" : "justify-between gap-2")} style={{ borderBottom: "1px solid var(--sidebar-border)" }}>
        {!collapsed && (
          <div className="flex items-center gap-2.5 min-w-0">
            {Icon && (
              <span className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: (app?.accent ?? "#239c8d") + "26" }}>
                <Icon className="w-5 h-5" style={{ color: app?.accent }} />
              </span>
            )}
            <div className="min-w-0">
              <p className="text-sm font-semibold leading-tight truncate" style={{ color: "var(--sidebar-text-active)" }}>{app?.name}</p>
              <p className="text-xs truncate" style={{ color: "var(--sidebar-text)" }}>{organization.name}</p>
            </div>
          </div>
        )}
        <button onClick={toggle} title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="shrink-0 p-1 rounded transition-colors hover:bg-[var(--sidebar-item-active)]" style={{ color: "var(--sidebar-text)" }}>
          {collapsed ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto thin-scroll-y py-3 px-2">
        {items.map((item) => {
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setPending(item.href)}
              title={collapsed ? item.name : undefined}
              className={cn("flex items-center gap-2.5 px-2 py-1.5 rounded-md text-sm mb-0.5 transition-colors", collapsed && "justify-center")}
              style={{
                backgroundColor: active ? "var(--sidebar-item-active)" : "transparent",
                color: active ? "var(--sidebar-text-active)" : "var(--sidebar-text)",
              }}
            >
              <item.icon className="w-4 h-4 shrink-0" />
              {!collapsed && <span className="truncate">{item.name}</span>}
            </Link>
          );
        })}
      </nav>

      {/* User */}
      <div className={cn("py-3", collapsed ? "px-2 flex justify-center" : "px-3")} style={{ borderTop: "1px solid var(--sidebar-border)" }}>
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-[var(--copper-soft-bg)] flex items-center justify-center text-[var(--copper-text)] text-xs font-semibold shrink-0" title={collapsed ? actingUser.fullName : undefined}>
            {actingUser.initials}
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <p className="text-sm font-medium truncate" style={{ color: "var(--sidebar-text-active)" }}>{actingUser.fullName}</p>
              <p className="text-xs truncate" style={{ color: "var(--sidebar-text)" }}>{role}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
