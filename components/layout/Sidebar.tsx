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
  Megaphone,
  BarChart2,
  Settings,
  MapPin,
  ChevronDown,
  PanelLeftClose,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useHierarchy } from "@/components/providers/HierarchyProvider";

type NavItem = { name: string; href: string; icon: typeof LayoutDashboard };

// Quick-access shortcuts shown above the groups — always visible.
const PINNED: NavItem[] = [
  { name: "Dashboard",   href: "/dashboard",   icon: LayoutDashboard },
  { name: "Dispatching", href: "/dispatching", icon: Truck },
  { name: "Customers",   href: "/customers",   icon: Users },
  { name: "Jobs",        href: "/jobs",        icon: Briefcase },
];

const navigation: { section: string; items: NavItem[] }[] = [
  {
    section: "Work",
    items: [
      { name: "Dashboard",   href: "/dashboard",   icon: LayoutDashboard },
      { name: "Inbox",       href: "/inbox",       icon: Inbox },
      { name: "Dispatching", href: "/dispatching", icon: Truck },
      { name: "Tasks",       href: "/tasks",       icon: CheckSquare },
    ],
  },
  {
    section: "Sales",
    items: [
      { name: "Leads",            href: "/leads",  icon: TrendingUp },
      { name: "Quotes",           href: "/quotes", icon: FilePen },
      { name: "Items & Services", href: "/items",  icon: Package },
    ],
  },
  {
    section: "Operations",
    items: [
      { name: "Jobs",        href: "/jobs",        icon: Briefcase },
      { name: "Work Orders", href: "/work-orders", icon: ClipboardList },
      { name: "Projects",    href: "/projects",    icon: FolderKanban },
      { name: "Agreements",  href: "/agreements",  icon: FileText },
    ],
  },
  {
    section: "Customers",
    items: [
      { name: "Customers",      href: "/customers", icon: Users },
      { name: "Photos & Files", href: "/files",     icon: Images },
    ],
  },
  {
    section: "Financial",
    items: [
      { name: "Invoices", href: "/invoices", icon: Receipt },
    ],
  },
  {
    section: "Grow",
    items: [
      { name: "Marketing", href: "/marketing", icon: Megaphone },
      { name: "Reports",   href: "/reports",   icon: BarChart2 },
    ],
  },
];

const SETTINGS_ITEM: NavItem = { name: "Settings", href: "/settings", icon: Settings };

// Groups expanded by default; the rest start collapsed and the user's choice
// persists. The group holding the active route is always forced open.
const DEFAULT_OPEN: Record<string, boolean> = { Work: true, Sales: true };
const STORE_KEY = "crm-sidebar-groups";

export default function Sidebar() {
  const pathname = usePathname();
  const { organization, activeScopeLabel, userName, userInitials, userRole } = useHierarchy();

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

  const pinnedHrefs = new Set(PINNED.map(p => p.href));

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

  function NavRow({ item, active, onSelect }: { item: NavItem; active: boolean; onSelect?: () => void }) {
    return (
      <Link
        key={item.name}
        href={item.href}
        onClick={onSelect}
        className={cn("flex items-center gap-2.5 px-2 py-1.5 rounded-md text-sm mb-0.5 transition-colors")}
        style={{
          backgroundColor: active ? "var(--sidebar-item-active)" : "transparent",
          color: active ? "var(--sidebar-text-active)" : "var(--sidebar-text)",
        }}
      >
        <item.icon className="w-4 h-4 shrink-0" />
        <span className="truncate">{item.name}</span>
      </Link>
    );
  }

  return (
    <div className="flex flex-col w-56 shrink-0" style={{ backgroundColor: "var(--sidebar-bg)" }}>
      {/* Org / Location header */}
      <div className="flex items-center justify-between px-4 py-4" style={{ borderBottom: "1px solid var(--sidebar-border)" }}>
        <div className="min-w-0">
          <p className="text-sm font-semibold leading-tight truncate" style={{ color: "var(--sidebar-text-active)" }}>
            {organization.name}
          </p>
          <div className="flex items-center gap-1 mt-0.5">
            <MapPin className="w-3 h-3 shrink-0" style={{ color: "var(--sidebar-text)" }} />
            <span className="text-xs truncate" style={{ color: "var(--sidebar-text)" }}>{activeScopeLabel}</span>
            <ChevronDown className="w-3 h-3 shrink-0" style={{ color: "var(--sidebar-text)" }} />
          </div>
        </div>
        <button className="shrink-0 p-1 rounded" style={{ color: "var(--sidebar-text)" }}>
          <PanelLeftClose className="w-4 h-4" />
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto thin-scroll-y py-3 px-2">
        {/* Pinned shortcuts — always visible */}
        <div className="mb-4">
          <p className="text-[10px] font-semibold uppercase tracking-widest px-2 mb-1" style={{ color: "var(--sidebar-section-label)" }}>
            Pinned
          </p>
          {PINNED.map(item => (
            <NavRow key={item.name} item={item}
              active={isItemActive(item.href) && placeFor(item.href) === "pinned"}
              onSelect={() => go(item.href, "pinned")} />
          ))}
        </div>

        {/* Collapsible groups — a pinned page highlights here only when its
            in-group copy was the one clicked (placeFor === this section). */}
        {navigation.map(group => {
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
      </nav>

      {/* Settings — pinned at the bottom for quick access */}
      <div className="px-2 py-2" style={{ borderTop: "1px solid var(--sidebar-border)" }}>
        <NavRow item={SETTINGS_ITEM} active={isItemActive(SETTINGS_ITEM.href)} onSelect={() => go(SETTINGS_ITEM.href, "group")} />
      </div>

      {/* User */}
      <div className="px-3 py-3" style={{ borderTop: "1px solid var(--sidebar-border)" }}>
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white text-xs font-semibold shrink-0">
            {userInitials}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium truncate" style={{ color: "var(--sidebar-text-active)" }}>{userName}</p>
            <p className="text-xs truncate" style={{ color: "var(--sidebar-text)" }}>{userRole}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
