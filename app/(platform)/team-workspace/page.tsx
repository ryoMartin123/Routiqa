"use client";

// ─── Team Workspace — dashboard ───────────────────────────
// "How the team communicates and meets." Mock cards + sections for the shell;
// channels/meetings/action-items are nav-only placeholders for now.

import Link from "next/link";
import { CalendarDays, ListChecks, Megaphone, MessagesSquare, ArrowRight, Users } from "lucide-react";
import { PageHeader, StatCard } from "@/components/platform/ui";
import {
  getUpcomingMeetings, getAnnouncements, getChannels, getOpenActionItems,
  MEETING_STATUS_STYLE, ACTION_STATUS_STYLE,
} from "@/lib/team-workspace/data";

const ACCENT = "#2563eb";

export default function TeamWorkspaceDashboard() {
  const meetings = getUpcomingMeetings();
  const announcements = getAnnouncements();
  const channels = getChannels();
  const actionItems = getOpenActionItems();

  return (
    <div className="p-6 space-y-5">
      <PageHeader title="Dashboard" subtitle="Meetings, announcements, action items, and team channels — all in one place." />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Upcoming Meetings" value={String(meetings.length)} hint="This week" icon={CalendarDays} accent={ACCENT} />
        <StatCard label="Open Action Items" value={String(actionItems.length)} hint="Assigned across teams" icon={ListChecks} accent="#f59e0b" />
        <StatCard label="Announcements" value={String(announcements.length)} hint="Recent" icon={Megaphone} accent="#239c8d" />
        <StatCard label="Active Channels" value={String(channels.length)} hint="Team spaces" icon={MessagesSquare} accent="#0ea5e9" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Upcoming Meetings */}
        <Panel title="Upcoming Meetings" icon={CalendarDays} accent={ACCENT} href="/team-workspace/meetings">
          <ul className="space-y-2.5">
            {meetings.map(m => (
              <li key={m.id} className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>{m.title}</p>
                  <p className="text-xs truncate" style={{ color: "var(--text-muted)" }}>{m.when} · {m.attendees.join(", ")}</p>
                </div>
                <Dot style={MEETING_STATUS_STYLE[m.status]} />
              </li>
            ))}
          </ul>
        </Panel>

        {/* Recent Announcements */}
        <Panel title="Recent Announcements" icon={Megaphone} accent="#239c8d" href="/team-workspace/announcements">
          <ul className="space-y-2.5">
            {announcements.map(a => (
              <li key={a.id} className="min-w-0">
                <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>{a.title}</p>
                <p className="text-xs truncate" style={{ color: "var(--text-muted)" }}>{a.audience} · {a.date}</p>
              </li>
            ))}
          </ul>
        </Panel>

        {/* Action Items */}
        <Panel title="Action Items" icon={ListChecks} accent="#f59e0b" href="/team-workspace/action-items">
          <ul className="space-y-2.5">
            {actionItems.map(a => (
              <li key={a.id} className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>{a.title}</p>
                  <p className="text-xs truncate" style={{ color: "var(--text-muted)" }}>{a.owner} · due {a.due}</p>
                </div>
                <Dot style={ACTION_STATUS_STYLE[a.status]} />
              </li>
            ))}
          </ul>
        </Panel>

        {/* Channels preview */}
        <Panel title="Channels" icon={MessagesSquare} accent="#0ea5e9" href="/team-workspace/channels">
          <div className="grid grid-cols-2 gap-2">
            {channels.map(c => (
              <div key={c.id} className="flex items-center justify-between gap-2 rounded-lg px-2.5 py-2" style={{ backgroundColor: "var(--bg-surface-2)", border: "1px solid var(--border)" }}>
                <span className="flex items-center gap-1.5 min-w-0">
                  <MessagesSquare className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--text-muted)" }} />
                  <span className="text-xs font-medium truncate" style={{ color: "var(--text-primary)" }}>{c.name}</span>
                </span>
                <span className="flex items-center gap-0.5 text-[10px] shrink-0" style={{ color: "var(--text-muted)" }}>
                  <Users className="w-3 h-3" /> {c.membersCount}
                </span>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}

function Panel({ title, icon: Icon, accent, href, children }: {
  title: string; icon: typeof CalendarDays; accent: string; href: string; children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl p-5" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)" }}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <span className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: accent + "22" }}>
            <Icon className="w-4 h-4" style={{ color: accent }} />
          </span>
          <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{title}</h2>
        </div>
        <Link href={href} className="flex items-center gap-1 text-xs font-medium" style={{ color: "var(--accent-text)" }}>
          View <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
      {children}
    </div>
  );
}

function Dot({ style }: { style: { label: string; dot: string } }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] shrink-0 whitespace-nowrap" style={{ color: "var(--text-secondary)" }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: style.dot }} /> {style.label}
    </span>
  );
}
