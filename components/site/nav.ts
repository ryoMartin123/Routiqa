// ─── Marketing site navigation + content data ─────────────
// Single source of truth for the mega nav, homepage sections, and footer so
// the menu and the page never drift apart. Everything links to homepage
// anchors — the site is one confident, continuous story.

import type { LucideIcon } from "lucide-react";
import {
  LayoutGrid, Users, CalendarRange, Briefcase, MessageSquare, CreditCard,
  Megaphone, UsersRound, BarChart3, Sparkles, Smartphone, FolderKanban,
  PhoneCall, TrendingUp, CalendarClock, Radio, ClipboardList, Camera,
  History, MapPinned, FilePen, ListChecks, Receipt, Wallet, Calculator,
  Boxes, PieChart, FileBarChart, Star, RefreshCw, BadgePercent, Landmark,
  Bot, AudioLines, FileText, BellRing, SearchCheck, Route, PenLine,
  Home, Building2, HardHat, KeyRound, Rocket, Layers,
} from "lucide-react";

export const APP_LOGIN_HREF = "/login";
export const DEMO_HREF = "#demo";

// ── Platform (mega menu + platform grid) ──
export interface NavItem { title: string; blurb: string; icon: LucideIcon; href: string }

export const PLATFORM_ITEMS: NavItem[] = [
  { title: "Overview",               blurb: "One connected system, first call to final payment", icon: LayoutGrid,    href: "#platform" },
  { title: "CRM",                    blurb: "Every customer, property, and conversation in one record", icon: Users,  href: "#platform" },
  { title: "Dispatch & Scheduling",  blurb: "A live board your dispatcher can actually run",     icon: CalendarRange, href: "#front-office" },
  { title: "Jobs & Projects",        blurb: "From single visits to multi-phase projects",        icon: Briefcase,     href: "#segments" },
  { title: "Customer Communication", blurb: "Two-way texting, email, and reminders built in",    icon: MessageSquare, href: "#customer-experience" },
  { title: "Accounting & Billing",   blurb: "Invoices, payments, and clean books",               icon: CreditCard,    href: "#financial" },
  { title: "Marketing",              blurb: "Campaigns that run off your real customer data",    icon: Megaphone,     href: "#growth" },
  { title: "HR & Team Workspace",    blurb: "People, roles, time, and training in one place",    icon: UsersRound,    href: "#team" },
  { title: "Reporting",              blurb: "The numbers behind every job and every crew",       icon: BarChart3,     href: "#financial" },
  { title: "Riq AI Assistant",       blurb: "The built-in assistant that keeps work moving",     icon: Sparkles,      href: "#riq" },
];

// ── Solutions ──
export const SOLUTION_ITEMS: NavItem[] = [
  { title: "Residential Service",     blurb: "Book, dispatch, sell, and collect in the home", icon: Home,        href: "#segments" },
  { title: "Commercial Service",      blurb: "Locations, assets, agreements, and terms billing", icon: Building2, href: "#segments" },
  { title: "Construction & Projects", blurb: "Stages, crews, budgets, and progress billing",  icon: HardHat,      href: "#segments" },
  { title: "Maintenance Agreements",  blurb: "Recurring visits that schedule and bill themselves", icon: RefreshCw, href: "#segments" },
  { title: "Multi-Location Businesses", blurb: "Every branch on one platform, one rollup",    icon: Layers,       href: "#segments" },
  { title: "Property Management",     blurb: "Tenants, owners, vendors, and work orders",     icon: KeyRound,     href: "#segments" },
  { title: "Startups & Growing Shops", blurb: "Strong defaults now, deep control later",      icon: Rocket,       href: "#packages" },
];

// ── Features (grouped) ──
export interface FeatureGroup { title: string; anchor: string; items: { title: string; icon: LucideIcon }[] }

export const FEATURE_GROUPS: FeatureGroup[] = [
  {
    title: "Front Office", anchor: "#front-office",
    items: [
      { title: "Call Booking",       icon: PhoneCall },
      { title: "Lead Management",    icon: TrendingUp },
      { title: "Scheduling",         icon: CalendarClock },
      { title: "Dispatch",           icon: Radio },
      { title: "Customer Profiles",  icon: Users },
      { title: "Two-Way Messaging",  icon: MessageSquare },
    ],
  },
  {
    title: "Field Operations", anchor: "#field-ops",
    items: [
      { title: "Mobile App",          icon: Smartphone },
      { title: "Job Forms",           icon: ClipboardList },
      { title: "Photos & Files",      icon: Camera },
      { title: "Equipment History",   icon: History },
      { title: "Technician Tracking", icon: MapPinned },
      { title: "Estimates",           icon: FilePen },
      { title: "Checklists",          icon: ListChecks },
    ],
  },
  {
    title: "Business Management", anchor: "#financial",
    items: [
      { title: "Invoicing",            icon: Receipt },
      { title: "Payments",             icon: Wallet },
      { title: "Accounting",           icon: Calculator },
      { title: "Payroll",              icon: UsersRound },
      { title: "Inventory",            icon: Boxes },
      { title: "Job Costing",          icon: PieChart },
      { title: "Reports & Dashboards", icon: FileBarChart },
    ],
  },
  {
    title: "Growth", anchor: "#growth",
    items: [
      { title: "Marketing Campaigns", icon: Megaphone },
      { title: "Review Requests",     icon: Star },
      { title: "Customer Follow-Up",  icon: BellRing },
      { title: "Memberships",         icon: RefreshCw },
      { title: "Lead Attribution",    icon: BadgePercent },
      { title: "Financing",           icon: Landmark },
    ],
  },
  {
    title: "AI & Automation", anchor: "#riq",
    items: [
      { title: "Riq Assistant",          icon: Bot },
      { title: "Call Summaries",         icon: AudioLines },
      { title: "Job Summaries",          icon: FileText },
      { title: "Smart Follow-Ups",       icon: BellRing },
      { title: "Missing Info Detection", icon: SearchCheck },
      { title: "Dispatch Suggestions",   icon: Route },
      { title: "Estimate Drafting",      icon: PenLine },
    ],
  },
];

// ── Industries ──
export interface Industry { name: string; blurb: string }
export const INDUSTRIES: Industry[] = [
  { name: "HVAC",                 blurb: "Seasonal demand, maintenance plans, and same-day dispatch without the whiteboard." },
  { name: "Plumbing",             blurb: "Emergency routing, service memberships, and options techs can sell at the door." },
  { name: "Electrical",           blurb: "Clean documentation from panel swap to full-project work." },
  { name: "Roofing",              blurb: "Inspections, photo reports, insurance paperwork, and multi-crew production." },
  { name: "Garage Door",          blurb: "Fast in-and-out calls with parts, pricing, and payment on the truck." },
  { name: "Pest Control",         blurb: "Recurring routes, treatment history, and renewals that don't slip." },
  { name: "Landscaping",          blurb: "Crews, recurring visits, and property-by-property billing." },
  { name: "Restoration",          blurb: "Multi-day losses with photos, equipment, and documentation that holds up." },
  { name: "Property Maintenance", blurb: "Work orders across hundreds of units — tenants, owners, and vendors coordinated." },
  { name: "Construction",         blurb: "Stages, budgets, change orders, and progress billing on one timeline." },
  { name: "Commercial Facilities", blurb: "Assets, agreements, and multi-site service with terms billing." },
];

// ── Resources (placeholder destinations for now) ──
export const RESOURCE_ITEMS: NavItem[] = [
  { title: "Product Tour",   blurb: "Walk the platform section by section", icon: LayoutGrid, href: "#platform" },
  { title: "Feature Library", blurb: "Everything Routiqa does, in one list", icon: ListChecks, href: "#front-office" },
  { title: "Industry Fit",   blurb: "How Routiqa maps to your trade",       icon: HardHat,     href: "#industries" },
  { title: "Meet Riq",       blurb: "What the built-in assistant handles",  icon: Sparkles,    href: "#riq" },
];

// ── Top-level nav ──
export const NAV: { label: string; type: "platform" | "solutions" | "features" | "industries" | "resources" | "link"; href?: string }[] = [
  { label: "Platform",   type: "platform" },
  { label: "Solutions",  type: "solutions" },
  { label: "Features",   type: "features" },
  { label: "Industries", type: "industries" },
  { label: "Resources",  type: "resources" },
  { label: "Pricing",    type: "link", href: "#packages" },
];
