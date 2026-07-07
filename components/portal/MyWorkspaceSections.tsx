"use client";

// ─── My Portal · Team Workspace slices ────────────────────
// Read-only personal views over the Team Workspace mock data — what's relevant
// to the CURRENT user, not company-wide management. My Portal never manages
// channels/meetings; it just surfaces meetings you're invited to, action items
// assigned to you, and announcements from your channels. Mock/local only.

import { useMemo } from "react";
import { Video, ListChecks, Megaphone, Building2, Clock, CheckCircle2, ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { usePermissionContext } from "@/components/providers/PermissionProvider";
import { PageHeader } from "@/components/platform/ui";
import {
  getUpcomingMeetings, getChannel, getActionItems, getAnnouncements,
  ACTION_STATUS_STYLE, MEETING_STATUS_STYLE,
} from "@/lib/team-workspace/data";

const ACCENT = "#2563eb";

// "Mine" matching is intentionally loose for the mock: an exact name match, or a
// group/team owner (e.g. "All Technicians") that a member would fall under.
function ownedByUser(owner: string, fullName: string): boolean {
  const o = owner.toLowerCase();
  return o === fullName.toLowerCase() || /team|all |technician|dispatch|crew|office/.test(o);
}

export function MyMeetings() {
  const { actingUser } = usePermissionContext();
  const meetings = useMemo(
    () => getUpcomingMeetings().filter(m => m.attendees.some(a => ownedByUser(a, actingUser.fullName))),
    [actingUser.fullName],
  );
  return (
    <div className="p-6 space-y-4">
      <PageHeader title="My Meetings" subtitle="Meetings you're invited to across your channels." accent={ACCENT} icon={Video} />
      {meetings.length === 0 ? (
        <Empty icon={Video} text="You have no upcoming meetings." />
      ) : (
        <div className="space-y-2.5 max-w-3xl">
          {meetings.map(m => {
            const ch = m.channelId ? getChannel(m.channelId) : undefined;
            const st = MEETING_STATUS_STYLE[m.status];
            return (
              <div key={m.id} className="rounded-xl p-4" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)" }}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold truncate" style={{ color: "var(--text-primary)" }}>{m.title}</p>
                    <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{m.when}{ch ? ` · ${ch.name}` : ""}</p>
                  </div>
                  <span className="inline-flex items-center gap-1.5 text-[11px] shrink-0" style={{ color: "var(--text-secondary)" }}><span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: st.dot }} /> {st.label}</span>
                </div>
                {m.agenda.length > 0 && <p className="text-xs mt-2" style={{ color: "var(--text-secondary)" }}>Agenda: {m.agenda.slice(0, 2).join(" · ")}{m.agenda.length > 2 ? " …" : ""}</p>}
              </div>
            );
          })}
        </div>
      )}
      <Footnote text="Meeting records live in Team Workspace → Meetings. This view shows the ones you're invited to." />
    </div>
  );
}

export function MyActionItems() {
  const { actingUser } = usePermissionContext();
  const items = useMemo(
    () => getActionItems().filter(a => a.status !== "completed" && ownedByUser(a.owner, actingUser.fullName)),
    [actingUser.fullName],
  );
  return (
    <div className="p-6 space-y-4">
      <PageHeader title="My Action Items" subtitle="Action items assigned to you and your team." accent="#f59e0b" icon={ListChecks} />
      {items.length === 0 ? (
        <Empty icon={CheckCircle2} text="You're all caught up — no open action items." />
      ) : (
        <div className="space-y-2.5 max-w-3xl">
          {items.map(a => {
            const ch = a.channelId ? getChannel(a.channelId) : undefined;
            const st = ACTION_STATUS_STYLE[a.status];
            return (
              <div key={a.id} className="rounded-xl p-3 flex items-center gap-3" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)" }}>
                <ListChecks className="w-4 h-4 shrink-0" style={{ color: "var(--text-muted)" }} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>{a.title}</p>
                  <p className="text-[11px] truncate" style={{ color: "var(--text-muted)" }}>due {a.due}{ch ? ` · ${ch.name}` : ""} · <span className="capitalize">{a.source}</span></p>
                </div>
                <span className="inline-flex items-center gap-1.5 text-[11px] shrink-0" style={{ color: "var(--text-secondary)" }}><span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: st.dot }} /> {st.label}</span>
              </div>
            );
          })}
        </div>
      )}
      <Footnote text="Action items are created in Team Workspace channels and meetings. Managing them happens there." />
    </div>
  );
}

export function MyAnnouncements() {
  const announcements = getAnnouncements();
  return (
    <div className="p-6 space-y-4">
      <PageHeader title="Announcements" subtitle="Announcements for your role, company, and channels." accent="#239c8d" icon={Megaphone} />
      {announcements.length === 0 ? (
        <Empty icon={Megaphone} text="No announcements right now." />
      ) : (
        <div className="space-y-2.5 max-w-3xl">
          {announcements.map(a => (
            <div key={a.id} className="rounded-xl p-4" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)" }}>
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold truncate" style={{ color: "var(--text-primary)" }}>{a.title}</p>
                <span className="flex items-center gap-1 text-[11px] shrink-0" style={{ color: "var(--text-muted)" }}><Building2 className="w-3 h-3" /> {a.audience}</span>
              </div>
              <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>{a.body}</p>
              <p className="text-[11px] mt-2 flex items-center gap-1" style={{ color: "var(--text-muted)" }}><Clock className="w-3 h-3" /> {a.date}</p>
            </div>
          ))}
        </div>
      )}
      <Link href="/team-workspace/announcements" className="inline-flex items-center gap-1 text-xs font-medium" style={{ color: "var(--accent-text)" }}>
        Open Team Workspace <ArrowUpRight className="w-3 h-3" />
      </Link>
    </div>
  );
}

function Empty({ icon: Icon, text }: { icon: typeof Video; text: string }) {
  return (
    <div className="rounded-xl p-10 text-center max-w-3xl" style={{ border: "1px dashed var(--border)", backgroundColor: "var(--bg-surface)" }}>
      <Icon className="w-6 h-6 mx-auto mb-2" style={{ color: "var(--text-muted)" }} />
      <p className="text-sm" style={{ color: "var(--text-muted)" }}>{text}</p>
    </div>
  );
}
function Footnote({ text }: { text: string }) {
  return <p className="text-[11px] max-w-3xl" style={{ color: "var(--text-muted)" }}>{text}</p>;
}
