"use client";

import { useMemo } from "react";
import { MessagesSquare, ListChecks, CalendarDays, Megaphone, Hash } from "lucide-react";
import MobileHeader from "@/components/mobile/MobileHeader";
import { Card, Section, EmptyState } from "@/components/mobile/ui";
import { getChannels, getOpenActionItems, getUpcomingMeetings, getAnnouncements } from "@/lib/team-workspace/data";

const TEAL = "#2563eb";

export default function MobileTeamPage() {
  const channels = useMemo(() => getChannels(), []);
  const actions = useMemo(() => getOpenActionItems(), []);
  const meetings = useMemo(() => getUpcomingMeetings(), []);
  const announcements = useMemo(() => getAnnouncements(), []);
  const unread = channels.reduce((s, c) => s + (c.unreadCount ?? 0), 0);

  return (
    <div>
      <MobileHeader title="Team Workspace" subtitle="Channels, meetings & action items" back />
      <div className="px-4 space-y-5">
        <div className="grid grid-cols-2 gap-3">
          <Kpi icon={MessagesSquare} label="Channels" value={String(channels.length)} color={TEAL} />
          <Kpi icon={Hash} label="Unread" value={String(unread)} color="#dc2626" />
          <Kpi icon={ListChecks} label="Open actions" value={String(actions.length)} color="#f59e0b" />
          <Kpi icon={CalendarDays} label="Meetings" value={String(meetings.length)} color="#16a34a" />
        </div>

        <Section title="Channels">
          <Card>
            {channels.slice(0, 8).map((c, i) => (
              <div key={c.id} className="flex items-center gap-3 px-4 py-3" style={{ borderTop: i ? "1px solid var(--border)" : "none" }}>
                <Hash className="w-4 h-4 shrink-0" style={{ color: "var(--text-muted)" }} />
                <div className="min-w-0 flex-1"><p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>{c.name}</p><p className="text-xs" style={{ color: "var(--text-muted)" }}>{c.membersCount} members</p></div>
                {c.unreadCount > 0 && <span className="text-[11px] font-bold px-1.5 py-0.5 rounded-md" style={{ backgroundColor: TEAL + "1f", color: TEAL }}>{c.unreadCount}</span>}
              </div>
            ))}
          </Card>
        </Section>

        <Section title="Open action items">
          {actions.length === 0 ? <Card className="px-4 py-6"><EmptyState icon={ListChecks} title="All clear" /></Card> : (
            <Card>
              {actions.slice(0, 6).map((a, i) => (
                <div key={a.id} className="flex items-center gap-3 px-4 py-3" style={{ borderTop: i ? "1px solid var(--border)" : "none" }}>
                  <ListChecks className="w-4 h-4 shrink-0" style={{ color: "#f59e0b" }} />
                  <p className="text-sm flex-1 truncate" style={{ color: "var(--text-primary)" }}>{a.title}</p>
                </div>
              ))}
            </Card>
          )}
        </Section>

        {announcements.length > 0 && (
          <Section title="Announcements">
            <Card>
              {announcements.slice(0, 4).map((a, i) => (
                <div key={a.id} className="flex items-start gap-3 px-4 py-3" style={{ borderTop: i ? "1px solid var(--border)" : "none" }}>
                  <Megaphone className="w-4 h-4 mt-0.5 shrink-0" style={{ color: "#a855f7" }} />
                  <div className="min-w-0"><p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>{a.title}</p><p className="text-xs" style={{ color: "var(--text-muted)" }}>{a.date}</p></div>
                </div>
              ))}
            </Card>
          </Section>
        )}
      </div>
    </div>
  );
}

function Kpi({ icon: Icon, label, value, color }: { icon: React.ElementType; label: string; value: string; color: string }) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-1.5"><Icon className="w-3.5 h-3.5" style={{ color }} /><p className="text-[11px] font-medium truncate" style={{ color: "var(--text-muted)" }}>{label}</p></div>
      <p className="text-xl font-bold mt-1 tabular-nums" style={{ color: "var(--text-primary)" }}>{value}</p>
    </Card>
  );
}
