// ─── Platform app registry ────────────────────────────────
// The CRM is now ONE app inside a larger business platform. This registry is the
// single source of truth for the apps the platform ships with: their identity,
// entry route, icon, accent, and the app-access flag that gates them.
//
// The CRM keeps its existing root routes (/dashboard, /customers, …). The other
// apps live under their own route prefix (/portal, /hr, …). `currentAppFromPath`
// maps any pathname back to the app it belongs to so the app switcher and shell
// can highlight the active app.

import {
  LayoutDashboard,
  Headset,
  UsersRound,
  Calculator,
  FolderTree,
  ShieldCheck,
  MessagesSquare,
  Boxes,
  Megaphone,
  type LucideIcon,
} from "lucide-react";

export type PlatformAppId =
  | "portal"
  | "crm"
  | "marketing"
  | "team_workspace"
  | "inventory"
  | "hr"
  | "accounting"
  | "documents"
  | "admin";

export interface PlatformApp {
  id: PlatformAppId;
  name: string;
  /** Short blurb shown on the launcher card. */
  description: string;
  icon: LucideIcon;
  /** Where selecting the app takes you. */
  href: string;
  /** Route prefix used to detect the active app (CRM uses "" — the root). */
  routePrefix: string;
  /** Card / shell accent colour. */
  accent: string;
  /** Portal is granted to every user and can't be turned off. */
  always?: boolean;
}

export const PLATFORM_APPS: PlatformApp[] = [
  {
    id: "portal",
    name: "My Portal",
    description:
      "View your schedule, hours, pay, training, documents, tasks, announcements, and personal information.",
    icon: LayoutDashboard,
    href: "/portal",
    routePrefix: "/portal",
    accent: "#0ea5e9",
    always: true,
  },
  {
    id: "crm",
    name: "CRM",
    description:
      "Manage customers, leads, quotes, jobs, dispatching, agreements, invoices, and field operations.",
    icon: Headset,
    href: "/dashboard",
    routePrefix: "", // CRM lives at the root
    accent: "#239c8d",
  },
  {
    id: "marketing",
    name: "Marketing",
    description:
      "Build campaigns, audiences, and templates from your CRM data — email, SMS, review requests, and follow-up sequences.",
    icon: Megaphone,
    href: "/marketing",
    routePrefix: "/marketing",
    accent: "#e11d48",
  },
  {
    id: "team_workspace",
    name: "Team Workspace",
    description:
      "Internal collaboration, team meetings, announcements, action items, shared boards, and company communication.",
    icon: MessagesSquare,
    href: "/team-workspace",
    routePrefix: "/team-workspace",
    accent: "#2563eb",
  },
  {
    id: "inventory",
    name: "Inventory & Procurement",
    description:
      "Manage materials, truck stock, warehouses, purchase orders, vendors, subcontractors, and material requests.",
    icon: Boxes,
    href: "/inventory",
    routePrefix: "/inventory",
    accent: "#f97316",
  },
  {
    id: "hr",
    name: "HR",
    description:
      "Manage employees, hiring, onboarding, training, roles, reviews, time off, and HR documents.",
    icon: UsersRound,
    href: "/hr",
    routePrefix: "/hr",
    accent: "#ec4899",
  },
  {
    id: "accounting",
    name: "Accounting",
    description:
      "Review invoices, payments, expenses, reports, and financial activity connected to the CRM.",
    icon: Calculator,
    href: "/accounting",
    routePrefix: "/accounting",
    accent: "#4f46e5",
  },
  {
    id: "documents",
    name: "Documents",
    description:
      "Organize SOPs, policies, training files, templates, company information, and internal knowledge.",
    icon: FolderTree,
    href: "/documents",
    routePrefix: "/documents",
    accent: "#f59e0b",
  },
  {
    id: "admin",
    name: "Admin",
    description:
      "Manage platform settings, users, roles, permissions, companies, locations, and app access.",
    icon: ShieldCheck,
    href: "/admin",
    routePrefix: "/admin",
    accent: "#a855f7",
  },
];

export function appById(id: PlatformAppId): PlatformApp | undefined {
  return PLATFORM_APPS.find((a) => a.id === id);
}

// The non-CRM apps own a route prefix; everything else under the dashboard is
// CRM. Returns undefined for the launcher (/welcome) where no app is active.
export function currentAppFromPath(pathname: string): PlatformApp | undefined {
  if (pathname === "/welcome" || pathname.startsWith("/welcome/")) return undefined;
  const prefixed = PLATFORM_APPS.filter((a) => a.routePrefix).find(
    (a) => pathname === a.routePrefix || pathname.startsWith(a.routePrefix + "/"),
  );
  if (prefixed) return prefixed;
  return appById("crm");
}
