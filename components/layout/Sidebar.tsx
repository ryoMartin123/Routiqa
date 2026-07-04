"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Inbox,
  Truck,
  CheckSquare,
  Users,
  FolderKanban,
  TrendingUp,
  Briefcase,
  ClipboardList,
  FilePen,
  Package,
  Receipt,
  FileText,
  Images,
  LineChart,
  Settings,
  ChevronDown,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useHierarchy } from "@/components/providers/HierarchyProvider";
import { usePermissions } from "@/components/providers/PermissionProvider";
import { appById } from "@/lib/platform/apps";
import type { Resource } from "@/lib/roles/types";

type NavItem = { name: string; href: string; icon: typeof LayoutDashboard; resource?: Resource };

// Quick-access shortcuts shown above the groups — always visible.
const PINNED: NavItem[] = [
  { name: "Dashboard",   href: "/dashboard",   icon: LayoutDashboard, resource: "dashboard" },
  { name: "Dispatching", href: "/dispatching", icon: Truck,           resource: "calendar"  },
  { name: "Customers",   href: "/customers",   icon: Users,           resource: "customers" },
  { name: "Jobs",        href: "/jobs",        icon: Briefcase,       resource: "jobs"      },
];

const navigation: { section: string; items: NavItem[] }[] = [
  {
    section: "Work",
    items: [
      { name: "Dashboard",   href: "/dashboard",   icon: LayoutDashboard, resource: "dashboard"      },
      { name: "Inbox",       href: "/inbox",       icon: Inbox,           resource: "communications" },
      { name: "Dispatching", href: "/dispatching", icon: Truck,           resource: "calendar"       },
      { name: "Tasks",       href: "/tasks",       icon: CheckSquare,     resource: "tasks"          },
    ],
  },
  {
    section: "Sales",
    items: [
      { name: "Leads",            href: "/leads",  icon: TrendingUp, resource: "leads"  },
      { name: "Quotes",           href: "/quotes", icon: FilePen,    resource: "quotes" },
      { name: "Items & Services", href: "/items",  icon: Package,    resource: "items"  },
    ],
  },
  {
    section: "Operations",
    items: [
      { name: "Jobs",        href: "/jobs",        icon: Briefcase,     resource: "jobs"       },
      { name: "Work Orders", href: "/work-orders", icon: ClipboardList, resource: "jobs"       },
      { name: "Projects",    href: "/projects",    icon: FolderKanban,  resource: "projects"   },
      { name: "Agreements",  href: "/agreements",  icon: FileText,      resource: "agreements" },
    ],
  },
  {
    section: "Customers",
    items: [
      { name: "Customers",      href: "/customers", icon: Users,  resource: "customers" },
      { name: "Photos & Files", href: "/files",     icon: Images, resource: "files"     },
    ],
  },
  {
    section: "Financial",
    items: [
      { name: "Invoices", href: "/invoices", icon: Receipt, resource: "invoices" },
    ],
  },
  {
    section: "Grow",
    items: [
      { name: "Analytics", href: "/analytics", icon: LineChart,  resource: "reports" },
    ],
  },
];

const SETTINGS_ITEM: NavItem = { name: "Settings", href: "/settings", icon: Settings, resource: "settings" };

// Groups expanded by default; the rest start collapsed and the user's choice
// persists. The group holding the active route is always forced open.
const DEFAULT_OPEN: Record<string, boolean> = { Work: true, Sales: true };
const STORE_KEY = "crm-sidebar-groups";
const COLLAPSE_KEY = "crm-sidebar-collapsed";

export default function Sidebar() {
  const pathname = usePathname();
  const { organization, userName, userInitials, userRole } = useHierarchy();
  const { can } = usePermissions();

  // CRM is one app inside the platform — its sidebar header mirrors the other
  // apps: [app icon] App Name / Organization. Company/location context lives in
  // the top bar selector, not here.
  const crmApp = appById("crm");
  const CrmIcon = crmApp?.icon;

  // A nav item is visible when the acting user can view its resource.
  const canSee = (item: NavItem) => !item.resource || can(item.resource, "view");
  const visiblePinned = PINNED.filter(canSee);
  const visibleGroups = navigation
    .map(g => ({ ...g, items: g.items.filter(canSee) }))
    .filter(g => g.items.length > 0);

  const [open, setOpen] = useState<Record<string, boolean>>(DEFAULT_OPEN);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (raw) setOpen(o => ({ ...o, ...JSON.parse(raw) }));
    } catch { /* ignore */ }
  }, []);

  function toggleGroup(section: string) {
    setOpen(prev => {
      const next = { ...prev, [section]: !(prev[section] ?? false) };
      try { localStorage.setItem(STORE_KEY, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  }

  // Collapsed = icon-only rail. Persisted across sessions.
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => {
    try { if (localStorage.getItem(COLLAPSE_KEY) === "1") setCollapsed(true); } catch { /* ignore */ }
  }, []);
  function toggleCollapsed() {
    setCollapsed(c => {
      const next = !c;
      try { localStorage.setItem(COLLAPSE_KEY, next ? "1" : "0"); } catch { /* ignore */ }
      return next;
    });
  }

  const pinnedHrefs = new Set(PINNED.map(p => p.href));

  // Flat, deduped list for the collapsed rail (pinned first, then the rest).
  const collapsedSeen = new Set<string>();
  const collapsedItems = [...visiblePinned, ...visibleGroups.flatMap(g => g.items)]
    .filter(i => (collapsedSeen.has(i.href) ? false : (collapsedSeen.add(i.href), true)));

  // `pendingHref` is the route just clicked. App Router only updates `pathname`
  // once the navigation settles, so without this the *previous* page stays
  // highlighted during the transition (e.g. Jobs lingers while opening Work
  // Orders). We optimistically treat the clicked target as active, then clear
  // it when `pathname` catches up. Back/forward set no pending, so the
  // highlight tracks the real path with no flicker.
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  useEffect(() => { setPendingHref(null); }, [pathname]);
  const activeHref = pendingHref ?? pathname;
  const isItemActive = (href: string) => activeHref === href || activeHref.startsWith(href + "/");

  // A pinned page lives in two spots (Pinned + its group). `source` remembers
  // which copy was last clicked so the highlight follows where you navigated
  // from. Defaults to "pinned" for pinned hrefs (e.g. on a fresh load).
  const [source, setSource] = useState<{ href: string; place: string } | null>(null);
  const placeFor = (href: string) =>
    source?.href === href ? source.place : (pinnedHrefs.has(href) ? "pinned" : "group");

  // Record the clicked copy (for the pinned/group highlight) and the optimistic target.
  const go = (href: string, place: string) => { setSource({ href, place }); setPendingHref(href); };

  function NavRow({ item, active, onSelect, iconOnly }: { item: NavItem; active: boolean; onSelect?: () => void; iconOnly?: boolean }) {
    return (
      <Link
        key={item.name}
        href={item.href}
        onClick={onSelect}
        title={iconOnly ? item.name : undefined}
        className={cn("flex items-center rounded-md text-sm mb-0.5 transition-colors", iconOnly ? "justify-center py-2" : "gap-2.5 px-2 py-1.5")}
        style={{
          backgroundColor: active ? "var(--sidebar-item-active)" : "transparent",
          color: active ? "var(--sidebar-text-active)" : "var(--sidebar-text)",
        }}
      >
        <item.icon className="w-4 h-4 shrink-0" />
        {!iconOnly && <span className="truncate">{item.name}</span>}
      </Link>
    );
  }

  return (
    <div data-app-nav className={cn("flex flex-col shrink-0 transition-[width] duration-300 ease-in-out", collapsed ? "w-16" : "w-56")} style={{ backgroundColor: "var(--sidebar-bg)" }}>
      {/* App identity header — [app icon] App Name / Organization */}
      <div className={cn("flex items-center px-4 py-4", collapsed ? "justify-center" : "justify-between gap-2")} style={{ borderBottom: "1px solid var(--sidebar-border)" }}>
        {!collapsed && (
          <div className="flex items-center gap-2.5 min-w-0">
            {CrmIcon && (
              <span className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: (crmApp?.accent ?? "#0ea5e9") + "26" }}>
                <CrmIcon className="w-5 h-5" style={{ color: crmApp?.accent }} />
              </span>
            )}
            <div className="min-w-0">
              <p className="text-sm font-semibold leading-tight truncate" style={{ color: "var(--sidebar-text-active)" }}>
                {crmApp?.name ?? "CRM"}
              </p>
              <p className="text-xs truncate" style={{ color: "var(--sidebar-text)" }}>{organization.name}</p>
            </div>
          </div>
        )}
        <button onClick={toggleCollapsed} title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="shrink-0 p-1 rounded transition-colors hover:bg-[var(--sidebar-item-active)]" style={{ color: "var(--sidebar-text)" }}>
          {collapsed ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto thin-scroll-y py-3 px-2">
        {collapsed ? (
          /* Icon-only rail — flat, deduped list with tooltips */
          collapsedItems.map(item => (
            <NavRow key={item.href} item={item} iconOnly
              active={isItemActive(item.href)}
              onSelect={() => go(item.href, pinnedHrefs.has(item.href) ? "pinned" : "group")} />
          ))
        ) : (
        <>
        {/* Pinned shortcuts */}
        {visiblePinned.length > 0 && (
        <div className="mb-4">
          <p className="text-[10px] font-semibold uppercase tracking-widest px-2 mb-1" style={{ color: "var(--sidebar-section-label)" }}>
            Pinned
          </p>
          {visiblePinned.map(item => (
            <NavRow key={item.name} item={item}
              active={isItemActive(item.href) && placeFor(item.href) === "pinned"}
              onSelect={() => go(item.href, "pinned")} />
          ))}
        </div>
        )}

        {/* Collapsible groups — a pinned page highlights here only when its
            in-group copy was the one clicked (placeFor === this section). */}
        {visibleGroups.map(group => {
          const itemActiveHere = (href: string) =>
            isItemActive(href) && (!pinnedHrefs.has(href) || placeFor(href) === group.section);
          const hasActive = group.items.some(i => itemActiveHere(i.href));
          const expanded = (open[group.section] ?? false) || hasActive;
          return (
            <div key={group.section} className="mb-1.5">
              <button
                onClick={() => toggleGroup(group.section)}
                className="w-full flex items-center justify-between px-2 py-1 rounded-md transition-colors group"
                style={{ color: "var(--sidebar-section-label)" }}
              >
                <span className="text-[10px] font-semibold uppercase tracking-widest">{group.section}</span>
                <ChevronDown
                  className="w-3 h-3 shrink-0 transition-transform"
                  style={{ transform: expanded ? "rotate(0deg)" : "rotate(-90deg)", opacity: 0.7 }}
                />
              </button>
              {expanded && (
                <div className="mt-0.5">
                  {group.items.map(item => (
                    <NavRow key={item.name} item={item}
                      active={itemActiveHere(item.href)}
                      onSelect={() => go(item.href, group.section)} />
                  ))}
                </div>
              )}
            </div>
          );
        })}
        </>
        )}
      </nav>

      {/* Settings — pinned at the bottom for quick access */}
      {canSee(SETTINGS_ITEM) && (
      <div className="px-2 py-2" style={{ borderTop: "1px solid var(--sidebar-border)" }}>
        <NavRow item={SETTINGS_ITEM} iconOnly={collapsed} active={isItemActive(SETTINGS_ITEM.href)} onSelect={() => go(SETTINGS_ITEM.href, "group")} />
      </div>
      )}

      {/* User */}
      <div className={cn("py-3", collapsed ? "px-2 flex justify-center" : "px-3")} style={{ borderTop: "1px solid var(--sidebar-border)" }}>
        {collapsed ? (
          <div title={`${userName} · ${userRole}`}
            className="w-8 h-8 rounded-full bg-[#e5e0db] flex items-center justify-center text-[#5c5545] text-xs font-semibold shrink-0">
            {userInitials}
          </div>
        ) : (
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-[#e5e0db] flex items-center justify-center text-[#5c5545] text-xs font-semibold shrink-0">
              {userInitials}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium truncate" style={{ color: "var(--sidebar-text-active)" }}>{userName}</p>
              <p className="text-xs truncate" style={{ color: "var(--sidebar-text)" }}>{userRole}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
