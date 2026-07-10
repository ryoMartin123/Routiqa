// ─── Per-app sidebar navigation ───────────────────────────
// Nav configs for the platform apps that use the shared PlatformShell (every app
// except the CRM, which keeps its own richer Sidebar). Each item routes to a real
// page; non-dashboard pages render a placeholder section for now.

import {
  LayoutDashboard,
  Plug,
  CalendarDays,
  Clock,
  DollarSign,
  CheckSquare,
  GraduationCap,
  FileText,
  Plane,
  User,
  Megaphone,
  UsersRound,
  UserPlus,
  ClipboardCheck,
  ShieldCheck,
  Star,
  Settings,
  Globe,
  Database,
  Puzzle,
  Receipt,
  CreditCard,
  Wallet,
  BarChart3,
  Building2,
  FileBadge,
  FolderTree,
  BookOpen,
  ScrollText,
  FileBox,
  HardHat,
  Archive,
  Users,
  KeyRound,
  MessagesSquare,
  Video,
  ListChecks,
  LayoutGrid,
  Boxes,
  Warehouse,
  Truck,
  ShoppingCart,
  ClipboardList,
  PackageCheck,
  SlidersHorizontal,
  Zap,
  Radio,
  type LucideIcon,
} from "lucide-react";
import type { PlatformAppId } from "./apps";

export interface AppNavItem {
  name: string;
  href: string;
  icon: LucideIcon;
}

// Keyed by app id. The first item is always the app's dashboard/index.
export const APP_NAV: Partial<Record<PlatformAppId, AppNavItem[]>> = {
  portal: [
    { name: "Dashboard", href: "/portal", icon: LayoutDashboard },
    { name: "My Schedule", href: "/portal/schedule", icon: CalendarDays },
    { name: "My Hours", href: "/portal/hours", icon: Clock },
    { name: "My Pay", href: "/portal/pay", icon: DollarSign },
    { name: "My Tasks", href: "/portal/tasks", icon: CheckSquare },
    { name: "My Training", href: "/portal/training", icon: GraduationCap },
    { name: "My Documents", href: "/portal/documents", icon: FileText },
    { name: "My Meetings", href: "/portal/meetings", icon: Video },
    { name: "My Action Items", href: "/portal/action-items", icon: ListChecks },
    { name: "My Time Off", href: "/portal/time-off", icon: Plane },
    { name: "My Profile", href: "/portal/profile", icon: User },
    { name: "Announcements", href: "/portal/announcements", icon: Megaphone },
  ],
  marketing: [
    { name: "Dashboard", href: "/marketing", icon: LayoutDashboard },
    { name: "Campaigns", href: "/marketing/campaigns", icon: Megaphone },
    { name: "Audiences", href: "/marketing/audiences", icon: UsersRound },
    { name: "Templates", href: "/marketing/templates", icon: FileText },
    { name: "Automations", href: "/marketing/automations", icon: Zap },
    { name: "Lead Sources", href: "/marketing/lead-sources", icon: Radio },
    { name: "Integrations", href: "/marketing/integrations", icon: Plug },
    { name: "Performance", href: "/marketing/performance", icon: BarChart3 },
    { name: "Settings", href: "/marketing/settings", icon: Settings },
  ],
  team_workspace: [
    { name: "Dashboard", href: "/team-workspace", icon: LayoutDashboard },
    { name: "Channels", href: "/team-workspace/channels", icon: MessagesSquare },
    { name: "Announcements", href: "/team-workspace/announcements", icon: Megaphone },
    { name: "Meetings", href: "/team-workspace/meetings", icon: CalendarDays },
    { name: "Live Meetings", href: "/team-workspace/live-meetings", icon: Video },
    { name: "Action Items", href: "/team-workspace/action-items", icon: ListChecks },
    { name: "Shared Boards", href: "/team-workspace/boards", icon: LayoutGrid },
    { name: "Team Calendar", href: "/team-workspace/calendar", icon: CalendarDays },
    { name: "Settings", href: "/team-workspace/settings", icon: Settings },
  ],
  inventory: [
    { name: "Dashboard", href: "/inventory", icon: LayoutDashboard },
    { name: "Inventory Items", href: "/inventory/items", icon: Boxes },
    { name: "Warehouses", href: "/inventory/warehouses", icon: Warehouse },
    { name: "Truck Stock", href: "/inventory/truck-stock", icon: Truck },
    { name: "Purchase Orders", href: "/inventory/purchase-orders", icon: ShoppingCart },
    { name: "Vendors", href: "/inventory/vendors", icon: Building2 },
    { name: "Subcontractors", href: "/inventory/subcontractors", icon: HardHat },
    { name: "Material Requests", href: "/inventory/material-requests", icon: ClipboardList },
    { name: "Receiving", href: "/inventory/receiving", icon: PackageCheck },
    { name: "Adjustments", href: "/inventory/adjustments", icon: SlidersHorizontal },
    { name: "Settings", href: "/inventory/settings", icon: Settings },
  ],
  hr: [
    { name: "Dashboard", href: "/hr", icon: LayoutDashboard },
    { name: "Employees", href: "/hr/employees", icon: UsersRound },
    { name: "Hiring", href: "/hr/hiring", icon: UserPlus },
    { name: "Onboarding", href: "/hr/onboarding", icon: ClipboardCheck },
    { name: "Training", href: "/hr/training", icon: GraduationCap },
    { name: "Roles & Permissions", href: "/hr/roles", icon: ShieldCheck },
    { name: "Time Off", href: "/hr/time-off", icon: Plane },
    { name: "Reviews", href: "/hr/reviews", icon: Star },
    { name: "HR Documents", href: "/hr/documents", icon: FileText },
    { name: "Settings", href: "/hr/settings", icon: Settings },
  ],
  accounting: [
    { name: "Dashboard", href: "/accounting", icon: LayoutDashboard },
    { name: "Invoices", href: "/accounting/invoices", icon: Receipt },
    { name: "Payments", href: "/accounting/payments", icon: CreditCard },
    { name: "Expenses", href: "/accounting/expenses", icon: Wallet },
    { name: "Customers", href: "/accounting/customers", icon: Users },
    { name: "Vendors", href: "/accounting/vendors", icon: Building2 },
    { name: "Reports", href: "/accounting/reports", icon: BarChart3 },
    { name: "Tax / 1099", href: "/accounting/tax", icon: FileBadge },
    { name: "Settings", href: "/accounting/settings", icon: Settings },
  ],
  documents: [
    { name: "Overview", href: "/documents", icon: LayoutDashboard },
    { name: "Company Library", href: "/documents/library", icon: FolderTree },
    { name: "SOPs", href: "/documents/sops", icon: BookOpen },
    { name: "Policies", href: "/documents/policies", icon: ScrollText },
    { name: "Training", href: "/documents/training", icon: GraduationCap },
    { name: "Templates", href: "/documents/templates", icon: FileBox },
    { name: "HR Documents", href: "/documents/hr", icon: FileText },
    { name: "Sales Documents", href: "/documents/sales", icon: FileBadge },
    { name: "Safety", href: "/documents/safety", icon: HardHat },
    { name: "System Management", href: "/documents/system", icon: Settings },
    { name: "Vendor Documents", href: "/documents/vendor-documents", icon: Building2 },
    { name: "Subcontractor Documents", href: "/documents/subcontractor-documents", icon: HardHat },
    { name: "Archived", href: "/documents/archived", icon: Archive },
  ],
  admin: [
    { name: "Dashboard", href: "/admin", icon: LayoutDashboard },
    { name: "Organization", href: "/admin/organization", icon: Globe },
    { name: "Business Structure", href: "/admin/companies", icon: Building2 },
    { name: "Users & Access", href: "/admin/users", icon: Users },
    { name: "Roles & Permissions", href: "/admin/roles", icon: ShieldCheck },
    { name: "Security", href: "/admin/security", icon: KeyRound },
    { name: "Billing & Plan", href: "/admin/billing", icon: CreditCard },
    { name: "Integrations", href: "/admin/integrations", icon: Puzzle },
    { name: "Data Management", href: "/admin/data", icon: Database },
    { name: "Audit Log", href: "/admin/audit", icon: ScrollText },
    { name: "Platform Settings", href: "/admin/settings", icon: Settings },
  ],
};

// Look up the display name for a section slug (used by placeholder pages).
export function sectionLabel(appId: PlatformAppId, slug: string): string | undefined {
  const items = APP_NAV[appId];
  if (!items) return undefined;
  const match = items.find((i) => i.href.endsWith("/" + slug));
  return match?.name;
}
