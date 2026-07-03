// ─── The Routiqa app ecosystem ────────────────────────────
// Single source of truth for the ten connected apps the marketing site
// presents. Order matters: the hero's workflow loop walks this list, so it
// reads as work flowing through the platform (lead → field → cash → team).

import {
  Users, CalendarRange, Smartphone, MessagesSquare, Megaphone,
  BarChart3, Hash, FileText, CreditCard, UsersRound, type LucideIcon,
} from "lucide-react";
import type { ShotKey } from "@/components/site/screenshots";

export interface EcosystemApp {
  id: string;
  name: string;
  short: string;     // compact label for the hero's orbital nodes
  role: string;      // positioning line ("Field operations")
  blurb: string;     // one sentence for the grid card
  caption: string;   // workflow status line shown while active in the hero loop
  icon: LucideIcon;
  shot?: ShotKey;    // real capture used as a treated snippet/backdrop
  /** The hero's magnifier: which region of the capture to enlarge (crisp) while
   *  the rest stays as the blurred backdrop. x/y = focal point in % of the
   *  image; zoom = magnification; label names what you're looking at. */
  focus?: { x: number; y: number; zoom: number; label: string };
}

export const ECOSYSTEM_APPS: EcosystemApp[] = [
  {
    id: "crm", name: "CRM", short: "CRM", role: "Customers & jobs", icon: Users, shot: "customers",
    focus: { x: 30, y: 34, zoom: 1.9, label: "Every account, one record" },
    blurb: "Every customer, lead, estimate, and job in one connected record",
    caption: "New lead converted to a job",
  },
  {
    id: "dispatch", name: "Dispatch & Routing", short: "Dispatch", role: "Field operations", icon: CalendarRange, shot: "dispatchMap",
    focus: { x: 62, y: 46, zoom: 1.5, label: "Live technician routing" },
    blurb: "A live board and map to schedule the day and route the trucks",
    caption: "Job routed to the closest technician",
  },
  {
    id: "mobile", name: "Technician Mobile", short: "Mobile", role: "Field execution", icon: Smartphone, shot: "mobileToday",
    focus: { x: 50, y: 21, zoom: 1.05, label: "The next stop, front and center" },
    blurb: "The day's route, job details, photos, and checklists in the truck",
    caption: "Tech en route — customer notified",
  },
  {
    id: "communications", name: "Communications", short: "Comms", role: "Customer messaging", icon: MessagesSquare, shot: "inbox",
    focus: { x: 44, y: 34, zoom: 1.8, label: "AI-drafted replies" },
    blurb: "Calls, texts, and email in one command center with AI drafts",
    caption: "Customer reply answered from an AI draft",
  },
  {
    id: "marketing", name: "Marketing", short: "Marketing", role: "Automation & growth", icon: Megaphone, shot: "marketing",
    focus: { x: 22, y: 30, zoom: 2.1, label: "Trigger → conditions → action" },
    blurb: "Follow-ups, renewals, and review requests that run themselves",
    caption: "Review request queued on completion",
  },
  {
    id: "analytics", name: "Analytics", short: "Analytics", role: "Visibility & performance", icon: BarChart3, shot: "analytics",
    focus: { x: 20, y: 28, zoom: 1.9, label: "Paid revenue by month" },
    blurb: "Owner dashboards and reports over live operational data",
    caption: "Revenue dashboard updated live",
  },
  {
    id: "workspace", name: "Team Workspace", short: "Workspace", role: "Internal collaboration", icon: Hash,
    blurb: "Company communication and coordination next to the work",
    caption: "Install crew aligned in #operations",
  },
  {
    id: "documents", name: "Documents & SOPs", short: "Documents", role: "Knowledge & process", icon: FileText, shot: "documents",
    focus: { x: 30, y: 44, zoom: 1.8, label: "A living SOP library" },
    blurb: "Standard work, policies, and training in one living library",
    caption: "Tech opens the install SOP on site",
  },
  {
    id: "accounting", name: "Accounting", short: "Accounting", role: "Payments & financial control", icon: CreditCard, shot: "accounting",
    focus: { x: 35, y: 18, zoom: 1.9, label: "Cash position at a glance" },
    blurb: "Invoices, payments, and financial health tied to every job",
    caption: "Invoice paid — books up to date",
  },
  {
    id: "hr", name: "HR & Team", short: "HR & Team", role: "People & teams", icon: UsersRound, shot: "hr",
    focus: { x: 35, y: 18, zoom: 1.9, label: "The whole team at a glance" },
    blurb: "Employees, onboarding, time, and reviews in the same platform",
    caption: "New hire onboarding on track",
  },
];
