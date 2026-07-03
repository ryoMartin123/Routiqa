"use client";

// ─── Team Calendar ────────────────────────────────────────
// A shared month view of the team's meetings, time off, deadlines, and shifts.
// Month navigation, event chips per day, a click-to-inspect day panel, and an
// upcoming list. Mock events seeded around the current month.

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, CalendarDays, Video, Plane, Flag, Megaphone, Clock } from "lucide-react";

const ACCENT = "#2563eb"; // Team Workspace blue

type EventType = "meeting" | "pto" | "deadline" | "announcement" | "shift";
const TYPE: Record<EventType, { label: string; color: string; icon: React.ElementType }> = {
  meeting:      { label: "Meeting",      color: "#2563eb", icon: Video },
  pto:          { label: "Time off",     color: "#f59e0b", icon: Plane },
  deadline:     { label: "Deadline",     color: "#dc2626", icon: Flag },
  announcement: { label: "Announcement", color: "#a855f7", icon: Megaphone },
  shift:        { label: "On-call",      color: "#16a34a", icon: Clock },
};

interface TeamEvent { id: string; day: number; title: string; type: EventType; time?: string; who?: string }

const pad = (n: number) => String(n).padStart(2, "0");
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// Deterministic mock events spread across whichever month is shown.
function eventsFor(year: number, month: number): Record<string, TeamEvent[]> {
  const dim = new Date(year, month + 1, 0).getDate();
  const at = (frac: number) => Math.min(dim, Math.max(1, Math.round(frac * dim)));
  const raw: TeamEvent[] = [
    { id: "e1", day: at(0.07), title: "Weekly standup", type: "meeting", time: "9:00 AM", who: "Whole team" },
    { id: "e2", day: at(0.1), title: "Spring promo launch", type: "deadline", who: "Marketing" },
    { id: "e3", day: at(0.18), title: "Marcus — PTO", type: "pto", who: "Marcus D." },
    { id: "e4", day: at(0.25), title: "Ops sync", type: "meeting", time: "2:00 PM", who: "Dispatch + Office" },
    { id: "e5", day: at(0.33), title: "On-call: Tucker", type: "shift", who: "Tucker R." },
    { id: "e6", day: at(0.4), title: "All-hands", type: "announcement", time: "11:00 AM", who: "Company" },
    { id: "e7", day: at(0.5), title: "Inventory count", type: "deadline", who: "Warehouse" },
    { id: "e8", day: at(0.55), title: "Sales training", type: "meeting", time: "3:30 PM", who: "Sales" },
    { id: "e9", day: at(0.63), title: "Priya — PTO", type: "pto", who: "Priya S." },
    { id: "e10", day: at(0.72), title: "On-call: Elena", type: "shift", who: "Elena V." },
    { id: "e11", day: at(0.8), title: "Quarterly review", type: "meeting", time: "10:00 AM", who: "Leadership" },
    { id: "e12", day: at(0.88), title: "Payroll cutoff", type: "deadline", who: "HR" },
    { id: "e13", day: at(0.93), title: "Team lunch 🎉", type: "announcement", time: "12:00 PM", who: "Company" },
  ];
  const map: Record<string, TeamEvent[]> = {};
  for (const e of raw) { const k = `${year}-${pad(month + 1)}-${pad(e.day)}`; (map[k] ??= []).push(e); }
  return map;
}

export default function TeamCalendar() {
  const today = new Date();
  const [cursor, setCursor] = useState({ y: today.getFullYear(), m: today.getMonth() });
  const [selected, setSelected] = useState<string>(ymd(today));

  const events = useMemo(() => eventsFor(cursor.y, cursor.m), [cursor]);
  const weeks = useMemo(() => {
    const first = new Date(cursor.y, cursor.m, 1);
    const start = new Date(first); start.setDate(1 - first.getDay());
    return Array.from({ length: 6 }, (_, w) => Array.from({ length: 7 }, (_, d) => { const dt = new Date(start); dt.setDate(start.getDate() + w * 7 + d); return dt; }));
  }, [cursor]);

  const move = (delta: number) => { const d = new Date(cursor.y, cursor.m + delta, 1); setCursor({ y: d.getFullYear(), m: d.getMonth() }); };
  const goToday = () => { setCursor({ y: today.getFullYear(), m: today.getMonth() }); setSelected(ymd(today)); };

  const upcoming = Object.entries(events).flatMap(([k, evs]) => evs.map(e => ({ k, e }))).sort((a, b) => a.k.localeCompare(b.k)).filter(x => x.k >= ymd(today)).slice(0, 6);
  const selEvents = events[selected] ?? [];
  const todayKey = ymd(today);

  return (
    <div className="p-6">
      <div className="flex items-center justify-between gap-3 flex-wrap mb-5">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>Team Calendar</h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-muted)" }}>Meetings, time off, deadlines, and on-call across the team.</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={goToday} className="px-3 py-1.5 rounded-lg text-sm font-medium" style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}>Today</button>
          <div className="flex items-center rounded-lg overflow-hidden" style={{ border: "1px solid var(--border)" }}>
            <button onClick={() => move(-1)} className="px-2 py-1.5 hover:bg-[var(--bg-surface-2)]"><ChevronLeft className="w-4 h-4" style={{ color: "var(--text-secondary)" }} /></button>
            <span className="px-3 py-1.5 text-sm font-semibold min-w-[140px] text-center" style={{ color: "var(--text-primary)" }}>{MONTHS[cursor.m]} {cursor.y}</span>
            <button onClick={() => move(1)} className="px-2 py-1.5 hover:bg-[var(--bg-surface-2)]"><ChevronRight className="w-4 h-4" style={{ color: "var(--text-secondary)" }} /></button>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-[1fr_300px] gap-5 items-start">
        {/* Month grid */}
        <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid var(--border)", backgroundColor: "var(--bg-surface)", boxShadow: "var(--shadow-card)" }}>
          <div className="grid grid-cols-7" style={{ borderBottom: "1px solid var(--border)" }}>
            {DOW.map(d => <div key={d} className="text-center text-[11px] font-semibold uppercase tracking-wider py-2" style={{ color: "var(--text-muted)" }}>{d}</div>)}
          </div>
          <div className="grid grid-cols-7">
            {weeks.flat().map((dt, i) => {
              const key = ymd(dt); const inMonth = dt.getMonth() === cursor.m; const isToday = key === todayKey; const isSel = key === selected;
              const evs = events[key] ?? [];
              return (
                <button key={i} onClick={() => setSelected(key)} className="text-left p-1.5 min-h-[88px] align-top transition-colors hover:bg-[var(--bg-surface-2)]"
                  style={{ borderRight: (i + 1) % 7 ? "1px solid var(--border)" : "none", borderBottom: "1px solid var(--border)", backgroundColor: isSel ? ACCENT + "0d" : "transparent", opacity: inMonth ? 1 : 0.4 }}>
                  <div className="flex justify-end">
                    <span className={`text-xs font-semibold w-6 h-6 flex items-center justify-center rounded-full ${isToday ? "text-white" : ""}`} style={{ backgroundColor: isToday ? ACCENT : "transparent", color: isToday ? "#fff" : "var(--text-secondary)" }}>{dt.getDate()}</span>
                  </div>
                  <div className="space-y-1 mt-0.5">
                    {evs.slice(0, 3).map(e => (
                      <div key={e.id} className="flex items-center gap-1 rounded px-1 py-0.5 truncate" style={{ backgroundColor: TYPE[e.type].color + "1a" }}>
                        <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: TYPE[e.type].color }} />
                        <span className="text-[10px] truncate" style={{ color: "var(--text-secondary)" }}>{e.title}</span>
                      </div>
                    ))}
                    {evs.length > 3 && <span className="text-[10px] pl-1" style={{ color: "var(--text-muted)" }}>+{evs.length - 3} more</span>}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Side: selected day + upcoming */}
        <div className="space-y-4">
          <div className="rounded-2xl p-4" style={{ border: "1px solid var(--border)", backgroundColor: "var(--bg-surface)", boxShadow: "var(--shadow-card)" }}>
            <p className="text-sm font-semibold mb-2.5" style={{ color: "var(--text-primary)" }}>{new Date(selected).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}</p>
            {selEvents.length === 0 ? <p className="text-xs" style={{ color: "var(--text-muted)" }}>Nothing scheduled.</p> : (
              <div className="space-y-2">{selEvents.map(e => <EventRow key={e.id} e={e} />)}</div>
            )}
          </div>
          <div className="rounded-2xl p-4" style={{ border: "1px solid var(--border)", backgroundColor: "var(--bg-surface)", boxShadow: "var(--shadow-card)" }}>
            <p className="text-[11px] font-semibold uppercase tracking-wider mb-2.5" style={{ color: "var(--text-muted)" }}>Upcoming</p>
            <div className="space-y-2.5">
              {upcoming.map(({ k, e }) => (
                <button key={e.id} onClick={() => setSelected(k)} className="w-full text-left flex items-center gap-2.5">
                  <span className="w-9 text-center shrink-0">
                    <span className="block text-[9px] uppercase" style={{ color: "var(--text-muted)" }}>{MONTHS[Number(k.slice(5, 7)) - 1].slice(0, 3)}</span>
                    <span className="block text-sm font-bold" style={{ color: "var(--text-primary)" }}>{k.slice(8)}</span>
                  </span>
                  <span className="w-1 h-7 rounded-full shrink-0" style={{ backgroundColor: TYPE[e.type].color }} />
                  <span className="min-w-0">
                    <span className="block text-xs font-medium truncate" style={{ color: "var(--text-primary)" }}>{e.title}</span>
                    <span className="block text-[10px] truncate" style={{ color: "var(--text-muted)" }}>{e.time ? `${e.time} · ` : ""}{e.who}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>
          {/* Legend */}
          <div className="flex flex-wrap gap-x-3 gap-y-1.5 px-1">
            {(Object.keys(TYPE) as EventType[]).map(t => (
              <span key={t} className="flex items-center gap-1.5 text-[11px]" style={{ color: "var(--text-muted)" }}>
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: TYPE[t].color }} />{TYPE[t].label}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function EventRow({ e }: { e: TeamEvent }) {
  const cfg = TYPE[e.type]; const Icon = cfg.icon;
  return (
    <div className="flex items-start gap-2.5">
      <span className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: cfg.color + "1a" }}><Icon className="w-3.5 h-3.5" style={{ color: cfg.color }} /></span>
      <div className="min-w-0">
        <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>{e.title}</p>
        <p className="text-xs truncate" style={{ color: "var(--text-muted)" }}>{e.time ? `${e.time} · ` : ""}{e.who}</p>
      </div>
    </div>
  );
}
