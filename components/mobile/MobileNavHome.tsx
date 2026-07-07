"use client";

// ─── Full-permissions overview = navigation ───────────────
// For broad-access users the Overview screen IS the navigation: a minimal header
// (name left · glossy inbox + profile bubble right), a recent-activity scroll,
// today's route cards, and grouped destinations with live activity counts.
// Tapping the profile opens My Portal in a swipe-down sheet.

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Briefcase, Users, Image as ImageIcon, CheckSquare,
  Map, MessageSquare, FileText,
  Radio, Megaphone, Calculator, MessagesSquare, Boxes, UsersRound, ShieldCheck,
} from "lucide-react";
import NotificationsBell from "@/components/mobile/NotificationsBell";
import { getMobileUser, getMyJobsByBucket, getMyTasks, getCurrentJob } from "@/lib/mobile/data";
import { getAllCustomers } from "@/lib/customers/data";
import { getActivityEvents } from "@/lib/activity/data";
import { getAllJobs } from "@/lib/jobs/data";
import { getCampaigns } from "@/lib/marketing/data";
import { getAllQuotes, getAllInvoices } from "@/lib/quotes/data";
import { getChannels } from "@/lib/team-workspace/data";
import { appAccessForUser } from "@/lib/platform/access";
import type { PlatformAppId } from "@/lib/platform/apps";
import { prettyType } from "@/components/mobile/ui";
import { activityMeta, activityLabel } from "@/lib/mobile/activityMeta";
import { useDataVersion } from "@/lib/sync/useDataVersion";
import BottomSheet from "@/components/mobile/BottomSheet";
import MyPortalContent from "@/components/mobile/MyPortalContent";

const ACCENT = "#0f8578";
const GLASS: React.CSSProperties = {
  backgroundColor: "color-mix(in srgb, var(--bg-surface) 80%, transparent)",
  backdropFilter: "blur(18px)", WebkitBackdropFilter: "blur(18px)",
  border: "1px solid var(--border)", boxShadow: "0 8px 24px -8px rgba(0,0,0,0.35)",
};

export default function MobileNavHome() {
  const [portalOpen, setPortalOpen] = useState(false);
  const rev = useDataVersion();
  const user = useMemo(() => getMobileUser(), []);
  const role = user?.assignments?.[0]?.role?.replace(/_/g, " ") ?? "Team member";
  const firstName = user?.fullName?.split(" ")[0] ?? "there";
  const firstLetter = (user?.fullName?.trim()?.[0] ?? "?").toUpperCase();

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const todayJobs = useMemo(() => getMyJobsByBucket("today"), [rev]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const current = useMemo(() => getCurrentJob(), [rev]);
  // Activity is derived per customer from their jobs/quotes/invoices. The
  // customer store needs a provider (absent in mobile), so collect customer ids
  // straight from those records — which DO lazy-load from storage — and derive.
  const recent = useMemo(() => {
    const ids = new Set<string>();
    getAllJobs().forEach(j => { if (j.accountId) ids.add(j.accountId); });
    getAllQuotes().forEach(q => { if (q.customerId) ids.add(q.customerId); });
    getAllInvoices().forEach(i => { if (i.customerId) ids.add(i.customerId); });
    return [...ids]
      .flatMap(id => getActivityEvents(id))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 12);
  }, []);
  const a = useMemo(() => ({
    jobs: todayJobs.length,
    customers: getAllCustomers().length,
    tasks: getMyTasks().length,
    campaigns: getCampaigns().filter(c => c.status === "active" || c.status === "scheduled").length,
    overdue: getAllInvoices().filter(i => i.status === "past_due" || (i.balanceDue > 0 && new Date(i.dueDate) < new Date())).length,
    teamUnread: getChannels().reduce((s, c) => s + (c.unreadCount ?? 0), 0),
  }), [todayJobs]);
  const access = useMemo(() => (user ? appAccessForUser(user) : null), [user]);

  const primary = [
    { label: "Jobs", href: "/mobile/jobs", icon: Briefcase, badge: a.jobs },
    { label: "Customers", href: "/mobile/customers", icon: Users, badge: a.customers },
    { label: "Photos", href: "/mobile/photos", icon: ImageIcon },
    { label: "Tasks", href: "/mobile/tasks", icon: CheckSquare, badge: a.tasks },
    { label: "Map & Route", href: "/mobile/map", icon: Map },
  ];
  const secondary = [
    { label: "Messages", href: "/mobile/messages", icon: MessageSquare },
    { label: "Documents", href: "/mobile/more/documents", icon: FileText },
  ];
  const APP_ITEMS: { label: string; href: string; icon: React.ElementType; app: PlatformAppId; badge?: number }[] = [
    { label: "Dispatch", href: "/mobile/dispatch", icon: Radio, app: "crm", badge: a.jobs },
    { label: "Marketing", href: "/mobile/marketing", icon: Megaphone, app: "marketing", badge: a.campaigns },
    { label: "Accounting", href: "/mobile/accounting", icon: Calculator, app: "accounting", badge: a.overdue },
    { label: "Team Workspace", href: "/mobile/team", icon: MessagesSquare, app: "team_workspace", badge: a.teamUnread },
    { label: "Inventory", href: "/mobile/inventory", icon: Boxes, app: "inventory", badge: 5 },
    { label: "HR", href: "/mobile/hr", icon: UsersRound, app: "hr" },
    { label: "Admin", href: "/mobile/admin", icon: ShieldCheck, app: "admin" },
  ];
  const apps = APP_ITEMS.filter(it => access?.[it.app] ?? false);

  return (
    <div style={{ paddingTop: "max(env(safe-area-inset-top), 0.5rem)" }}>
      {/* Header — name (left) · glossy inbox + profile bubble (right).
          relative z-50 so the notifications popup sits above the activity cards
          below (otherwise the later cards paint over it). */}
      <div className="relative z-50 flex items-center justify-between gap-3 px-4 pt-2 pb-4">
        <div className="min-w-0">
          <p className="text-xl font-bold truncate" style={{ color: "var(--text-primary)" }}>{user?.fullName}</p>
          <p className="text-xs capitalize truncate" style={{ color: "var(--text-muted)" }}>{role}</p>
        </div>
        <div className="flex items-center gap-1 rounded-full p-1 shrink-0" style={GLASS}>
          <NotificationsBell events={recent} />
          <button onClick={() => setPortalOpen(true)} aria-label="My Portal" aria-expanded={portalOpen} className="relative w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white active:scale-95 transition-transform" style={{ backgroundColor: ACCENT }}>
            {firstLetter}
            <span className="absolute -bottom-0 -right-0 w-2.5 h-2.5 rounded-full border-2" style={{ backgroundColor: "#16a34a", borderColor: "var(--bg-page)" }} />
          </button>
        </div>
      </div>

      {/* Recent activity — horizontal scroll (the overview) */}
      {recent.length > 0 && (
        <div className="pb-2">
          <p className="text-xs mb-2 px-4" style={{ color: "var(--text-muted)" }}>Recent activity</p>
          <div className="flex gap-2.5 overflow-x-auto thin-scroll-x pb-1 px-4">
            {recent.map(e => {
              const m = activityMeta(e.eventType); const Icon = m.icon;
              return (
                <Link key={e.id} href={`/mobile/customers/${e.customerId}`} className="shrink-0 w-[15rem] rounded-2xl p-3.5 active:scale-[0.99] transition-transform" style={{ border: "1px solid var(--border)", backgroundColor: "var(--bg-surface)", boxShadow: "var(--shadow-card)" }}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: m.color + "1a" }}><Icon className="w-3.5 h-3.5" style={{ color: m.color }} /></span>
                    <span className="text-[11px] font-semibold truncate" style={{ color: m.color }}>{activityLabel(e.eventType)}</span>
                    <span className="ml-auto text-[10px] shrink-0" style={{ color: "var(--text-muted)" }}>{e.displayDate}</span>
                  </div>
                  <p className="text-sm font-semibold leading-snug line-clamp-2" style={{ color: "var(--text-primary)" }}>{e.title}</p>
                  <p className="text-[11px] mt-1 truncate" style={{ color: "var(--text-muted)" }}>by {e.createdBy}</p>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Today's route cards */}
      {todayJobs.length > 0 && (
        <div className="pb-2">
          <p className="text-xs mb-2 px-4" style={{ color: "var(--text-muted)" }}>Today’s route</p>
          <div className="flex gap-2.5 overflow-x-auto thin-scroll-x pb-1 px-4">
            {todayJobs.slice(0, 6).map(j => (
              <Link key={j.id} href={`/mobile/jobs/${j.id}`} className="shrink-0 w-44 rounded-2xl p-3" style={{ border: "1px solid var(--border)", backgroundColor: "var(--bg-surface)", boxShadow: "var(--shadow-card)" }}>
                <p className="text-[11px] mb-1" style={{ color: "var(--text-muted)" }}>{prettyType(j.type)} · {j.scheduledTime || "—"}{current?.id === j.id ? " · now" : ""}</p>
                <p className="text-sm font-semibold leading-snug truncate" style={{ color: "var(--text-primary)" }}>{j.customerName}</p>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="px-3 pt-2">{primary.map(it => <NavRow key={it.href} {...it} />)}</div>
      <div className="mx-5 my-2" style={{ borderTop: "1px solid var(--border)" }} />
      <div className="px-3">{secondary.map(it => <NavRow key={it.href} {...it} />)}</div>
      {apps.length > 0 && (
        <>
          <p className="text-[10px] font-semibold uppercase tracking-wider px-5 mt-3 mb-1" style={{ color: "var(--text-muted)" }}>Apps</p>
          <div className="px-3">{apps.map(it => <NavRow key={it.href} {...it} />)}</div>
        </>
      )}

      <BottomSheet open={portalOpen} onClose={() => setPortalOpen(false)} title="My Portal" subtitle={`Hi ${firstName} — your self-service hub`}>
        <MyPortalContent onNavigate={() => setPortalOpen(false)} />
      </BottomSheet>
    </div>
  );
}

function NavRow({ label, href, icon: Icon, badge }: { label: string; href: string; icon: React.ElementType; badge?: number }) {
  return (
    <Link href={href} className="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors active:bg-[var(--bg-surface-2)]">
      <Icon className="w-5 h-5 shrink-0" style={{ color: "var(--text-secondary)" }} />
      <span className="text-[15px] flex-1 truncate" style={{ color: "var(--text-primary)" }}>{label}</span>
      {badge !== undefined && badge > 0 && (
        <span className="text-[11px] font-bold px-1.5 py-0.5 rounded-md tabular-nums" style={{ backgroundColor: ACCENT + "1f", color: ACCENT }}>{badge}</span>
      )}
    </Link>
  );
}
