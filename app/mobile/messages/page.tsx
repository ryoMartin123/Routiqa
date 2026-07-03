"use client";

import { useMemo, useState } from "react";
import { MessageSquare, Users, Search } from "lucide-react";
import MobileHeader from "@/components/mobile/MobileHeader";
import { Card, EmptyState, ACCENT } from "@/components/mobile/ui";
import { getMyJobs } from "@/lib/mobile/data";

// Foundation: conversation list derived from my jobs' customers + a team channel.
// Structured to swap onto a real messaging store later (same row shape).
const SNIPPETS = ["On my way — see you shortly.", "Thanks, that works!", "Can we push to the afternoon?", "Gate code is 4821.", "Job photos look great 👍", "I'll have the part by Thursday."];

export default function MessagesPage() {
  const [tab, setTab] = useState<"customers" | "team">("customers");
  const [q, setQ] = useState("");

  const customerThreads = useMemo(() => {
    const seen = new Set<string>();
    return getMyJobs().filter(j => { if (seen.has(j.accountId)) return false; seen.add(j.accountId); return true; })
      .slice(0, 12)
      .map((j, i) => ({ id: j.accountId, name: j.customerName, initials: j.customerInitials, last: SNIPPETS[i % SNIPPETS.length], time: `${(i % 11) + 1}h`, unread: i % 4 === 0, accent: ACCENT }));
  }, []);

  const teamThreads = [
    { id: "dispatch", name: "Dispatch", initials: "DI", last: "New emergency added to your route.", time: "12m", unread: true, accent: "#0891b2" },
    { id: "crew", name: "Field Crew", initials: "FC", last: "Anyone have a spare capacitor?", time: "2h", unread: false, accent: "#16a34a" },
    { id: "office", name: "Office", initials: "OF", last: "Timesheets due Friday.", time: "1d", unread: false, accent: "#a855f7" },
  ];

  const threads = (tab === "customers" ? customerThreads : teamThreads).filter(t => t.name.toLowerCase().includes(q.toLowerCase()));

  return (
    <div>
      <MobileHeader title="Messages" />
      <div className="px-4 space-y-3">
        <div className="flex items-center gap-2 rounded-xl px-3 py-2.5" style={{ border: "1px solid var(--border)", backgroundColor: "var(--bg-surface)" }}>
          <Search className="w-4 h-4" style={{ color: "var(--text-muted)" }} />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search messages" className="bg-transparent text-sm outline-none w-full" style={{ color: "var(--text-primary)" }} />
        </div>

        <div className="flex items-center rounded-xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
          {([["customers", "Customers", MessageSquare], ["team", "Team", Users]] as const).map(([k, label, Icon]) => (
            <button key={k} onClick={() => setTab(k)} className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-semibold transition-colors"
              style={{ backgroundColor: tab === k ? ACCENT : "var(--bg-surface)", color: tab === k ? "#fff" : "var(--text-secondary)" }}>
              <Icon className="w-4 h-4" /> {label}
            </button>
          ))}
        </div>

        {threads.length === 0 ? (
          <EmptyState icon={MessageSquare} title="No conversations" hint="Messages with customers and your team show up here." />
        ) : (
          <Card>
            {threads.map((t, i) => (
              <button key={t.id} className="w-full flex items-center gap-3 px-4 py-3 text-left active:bg-[var(--bg-surface-2)]" style={{ borderTop: i ? "1px solid var(--border)" : "none" }}>
                <span className="w-11 h-11 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0" style={{ backgroundColor: t.accent }}>{t.initials}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[15px] font-semibold truncate" style={{ color: "var(--text-primary)" }}>{t.name}</p>
                    <span className="text-xs shrink-0" style={{ color: "var(--text-muted)" }}>{t.time}</span>
                  </div>
                  <p className="text-sm truncate" style={{ color: t.unread ? "var(--text-primary)" : "var(--text-muted)", fontWeight: t.unread ? 600 : 400 }}>{t.last}</p>
                </div>
                {t.unread && <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: ACCENT }} />}
              </button>
            ))}
          </Card>
        )}
      </div>
    </div>
  );
}
