"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Inbox,
  Calendar,
  CheckSquare,
  Users,
  FolderKanban,
  TrendingUp,
  Briefcase,
  ClipboardList,
  FilePen,
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

const navigation = [
  {
    section: "Work",
    items: [
      { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
      { name: "Inbox", href: "/inbox", icon: Inbox },
      { name: "Dispatching", href: "/dispatching", icon: Calendar },
      { name: "Tasks", href: "/tasks", icon: CheckSquare },
    ],
  },
  {
    section: "Records",
    items: [
      { name: "Customers",      href: "/customers",   icon: Users },
      { name: "Leads",          href: "/leads",        icon: TrendingUp },
      { name: "Quotes",         href: "/quotes",       icon: FilePen },
      { name: "Jobs",           href: "/jobs",         icon: Briefcase },
      { name: "Work Orders",    href: "/work-orders",  icon: ClipboardList },
      { name: "Projects",       href: "/projects",     icon: FolderKanban },
      { name: "Invoices",       href: "/invoices",     icon: Receipt },
      { name: "Agreements",     href: "/agreements",   icon: FileText },
      { name: "Photos & Files", href: "/files",        icon: Images },
    ],
  },
  {
    section: "Grow",
    items: [
      { name: "Marketing", href: "/marketing", icon: Megaphone },
      { name: "Reports", href: "/reports", icon: BarChart2 },
    ],
  },
  {
    section: "Account",
    items: [{ name: "Settings", href: "/settings", icon: Settings }],
  },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { organization, activeScopeLabel, userName, userInitials, userRole } =
    useHierarchy();

  return (
    <div
      className="flex flex-col w-56 shrink-0"
      style={{ backgroundColor: "var(--sidebar-bg)" }}
    >
      {/* Org / Location header */}
      <div
        className="flex items-center justify-between px-4 py-4"
        style={{ borderBottom: "1px solid var(--sidebar-border)" }}
      >
        <div className="min-w-0">
          <p
            className="text-sm font-semibold leading-tight truncate"
            style={{ color: "var(--sidebar-text-active)" }}
          >
            {organization.name}
          </p>
          <div className="flex items-center gap-1 mt-0.5">
            <MapPin className="w-3 h-3 shrink-0" style={{ color: "var(--sidebar-text)" }} />
            <span className="text-xs truncate" style={{ color: "var(--sidebar-text)" }}>
              {activeScopeLabel}
            </span>
            <ChevronDown className="w-3 h-3 shrink-0" style={{ color: "var(--sidebar-text)" }} />
          </div>
        </div>
        <button className="shrink-0 p-1 rounded" style={{ color: "var(--sidebar-text)" }}>
          <PanelLeftClose className="w-4 h-4" />
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-3 px-2">
        {navigation.map((group) => (
          <div key={group.section} className="mb-5">
            <p
              className="text-[10px] font-semibold uppercase tracking-widest px-2 mb-1"
              style={{ color: "var(--sidebar-section-label)" }}
            >
              {group.section}
            </p>
            {group.items.map((item) => {
              const isActive =
                pathname === item.href || pathname.startsWith(item.href + "/");
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-2.5 px-2 py-1.5 rounded-md text-sm mb-0.5 transition-colors"
                  )}
                  style={{
                    backgroundColor: isActive ? "var(--sidebar-item-active)" : "transparent",
                    color: isActive
                      ? "var(--sidebar-text-active)"
                      : "var(--sidebar-text)",
                  }}
                >
                  <item.icon className="w-4 h-4 shrink-0" />
                  <span className="truncate">{item.name}</span>
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* User */}
      <div
        className="px-3 py-3"
        style={{ borderTop: "1px solid var(--sidebar-border)" }}
      >
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white text-xs font-semibold shrink-0">
            {userInitials}
          </div>
          <div className="min-w-0">
            <p
              className="text-sm font-medium truncate"
              style={{ color: "var(--sidebar-text-active)" }}
            >
              {userName}
            </p>
            <p className="text-xs truncate" style={{ color: "var(--sidebar-text)" }}>
              {userRole}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
