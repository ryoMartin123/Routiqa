"use client";

// ─── Technician Today ─────────────────────────────────────
// The field home screen, built like a native app: greeting header with the
// day's progress, one clear CURRENT job with its next status action, a timeline
// of the day's stops, follow-ups and tasks, and permission-gated quick tiles.
// Everything reads from the same CRM stores the office uses.

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Clock, Navigation, CheckSquare, Briefcase, Play, AlarmClock, MapPin, Map,
  Camera, FileText, MessageSquare, CheckCircle2, Flag, ChevronRight,
} from "lucide-react";
import NotificationsBell from "@/components/mobile/NotificationsBell";
import MobileNavHome from "@/components/mobile/MobileNavHome";
import { getAllActivityEvents } from "@/lib/activity/data";
import { Section, Card, StatusChip, EmptyState, ACCENT, prettyType, areaOf } from "@/components/mobile/ui";
import {
  getCurrentTech, getMyJobsByBucket, getCurrentJob, getMyTasks, getClockState,
  toggleClock, getMobileExperience, getMobileCaps, primaryAction, setMyJobStatus,
  STATUS_META, type MobileExperience,
} from "@/lib/mobile/data";
import type { Job } from "@/lib/jobs/data";
import { useDataVersion } from "@/lib/sync/useDataVersion";

const PRIMARY_ICON: Record<string, React.ElementType> = {
  en_route: Flag, in_progress: Play, completed: CheckCircle2,
};

export default function TodayPage() {
  const rev = useDataVersion();
  const [tick, setTick] = useState(0);
  const me = useMemo(() => getCurrentTech(), []);
  const caps = useMemo(() => getMobileCaps(), []);
  /* eslint-disable react-hooks/exhaustive-deps -- rev/tick re-read the stores */
  const jobs = useMemo(() => getMyJobsByBucket("today"), [rev, tick]);
  const doneToday = useMemo(() => getMyJobsByBucket("completed").filter(j => j.scheduledDate === new Date().toISOString().slice(0, 10)), [rev, tick]);
  const followups = useMemo(() => getMyJobsByBucket("followup"), [rev, tick]);
  const current = useMemo(() => getCurrentJob(), [rev, tick]);
  const tasks = useMemo(() => getMyTasks().slice(0, 3), [rev, tick]);
  const activity = useMemo(() => getAllActivityEvents().slice(0, 10), [rev]);
  /* eslint-enable react-hooks/exhaustive-deps */
  const [clock, setClock] = useState<{ in: boolean; since?: string }>({ in: false });
  const [exp, setExp] = useState<MobileExperience>("field");
  useEffect(() => { setClock(getClockState()); setExp(getMobileExperience()); }, []);

  // Broad-access users: the Overview IS the navigation hub.
  if (exp === "full") return <MobileNavHome />;

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const firstName = me?.fullName?.split(" ")[0] ?? "there";
  const totalStops = jobs.length + doneToday.length;
  const onSiteHrs = Math.round(jobs.reduce((s, j) => s + (j.durationMinutes || 0), 0) / 60 * 10) / 10;
  const allDone = totalStops > 0 && jobs.length === 0;

  return (
    <div>
      {/* Native-style header: greeting + bell + avatar */}
      <header className="px-4 pb-1" style={{ paddingTop: "calc(env(safe-area-inset-top) + 1rem)" }}>
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-medium" style={{ color: "var(--text-muted)" }}>
              {new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
            </p>
            <h1 className="text-2xl font-bold tracking-tight leading-tight" style={{ color: "var(--text-primary)" }}>
              {greeting}, {firstName}
            </h1>
          </div>
          <NotificationsBell events={activity} />
          <Link href="/mobile/more/profile" className="relative shrink-0">
            <span className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white" style={{ backgroundColor: ACCENT }}>{me?.initials}</span>
            <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2" style={{ backgroundColor: clock.in ? "#16a34a" : "#6b7280", borderColor: "var(--bg-page)" }} />
          </Link>
        </div>
      </header>

      <div className="px-4 space-y-5 pt-3">
        {/* Day strip: clock + progress in one line */}
        <Card className="p-3.5">
          <div className="flex items-center gap-3">
            <button onClick={() => setClock(toggleClock())}
              className="shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-full text-[13px] font-semibold active:scale-95 transition-transform"
              style={{ backgroundColor: clock.in ? "#16a34a1c" : "var(--bg-surface-2)", color: clock.in ? "#16a34a" : "var(--text-secondary)", border: `1px solid ${clock.in ? "#16a34a44" : "var(--border-subtle)"}` }}>
              <Clock className="w-4 h-4" /> {clock.in ? "On the clock" : "Clock in"}
            </button>
            <div className="min-w-0 flex-1">
              <div className="flex justify-between text-[11px] font-semibold mb-1" style={{ color: "var(--text-muted)" }}>
                <span>{doneToday.length} of {totalStops || "—"} stops done</span>
                <span>~{onSiteHrs}h on site</span>
              </div>
              <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: "var(--bg-surface-2)" }}>
                <div className="h-full rounded-full transition-all duration-500" style={{ width: totalStops ? `${(doneToday.length / totalStops) * 100}%` : "0%", backgroundColor: allDone ? "#16a34a" : ACCENT }} />
              </div>
            </div>
          </div>
        </Card>

        {/* Current job hero with its NEXT status action */}
        {current ? (
          <Section title={current.status === "in_progress" || current.status === "en_route" ? "Current job" : "Next up"}>
            <CurrentJobCard job={current} onChanged={() => setTick(t => t + 1)} />
          </Section>
        ) : allDone ? (
          <Card className="p-5 text-center" style={{ border: "1px solid #16a34a44", backgroundColor: "#16a34a10" }}>
            <CheckCircle2 className="w-8 h-8 mx-auto mb-2" style={{ color: "#16a34a" }} />
            <p className="text-base font-bold" style={{ color: "var(--text-primary)" }}>Day complete</p>
            <p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>{doneToday.length} stop{doneToday.length === 1 ? "" : "s"} finished. Nice work.</p>
          </Card>
        ) : (
          <Card><EmptyState icon={Briefcase} title="No jobs scheduled today" hint="Enjoy the quiet — or check upcoming work." /></Card>
        )}

        {/* Schedule timeline */}
        {(jobs.length > 0 || doneToday.length > 0) && (
          <Section title="Today's schedule" action={<Link href="/mobile/jobs" className="text-xs font-semibold" style={{ color: ACCENT }}>All jobs</Link>}>
            <Card className="overflow-hidden">
              {[...doneToday, ...jobs].map((j, i, arr) => <TimelineRow key={j.id} job={j} last={i === arr.length - 1} />)}
            </Card>
          </Section>
        )}

        {/* Follow-ups that came back to the tech */}
        {followups.length > 0 && (
          <Section title="Needs follow-up">
            <Card className="overflow-hidden">
              {followups.map((j, i) => <TimelineRow key={j.id} job={j} last={i === followups.length - 1} plain />)}
            </Card>
          </Section>
        )}

        {/* Tasks */}
        {caps.tasks !== "none" && tasks.length > 0 && (
          <Section title="My tasks" action={<Link href="/mobile/tasks" className="text-xs font-semibold" style={{ color: ACCENT }}>All</Link>}>
            <Card>
              {tasks.map((t, i) => (
                <Link key={t.id} href="/mobile/tasks" className="flex items-center gap-3 px-4 py-3" style={{ borderTop: i ? "1px solid var(--border)" : "none" }}>
                  <CheckSquare className="w-4 h-4 shrink-0" style={{ color: "var(--text-muted)" }} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>{t.title}</p>
                    {t.dueDate && <p className="text-xs flex items-center gap-1" style={{ color: "var(--text-muted)" }}><AlarmClock className="w-3 h-3" /> Due {t.dueDate}</p>}
                  </div>
                  <ChevronRight className="w-4 h-4 shrink-0" style={{ color: "var(--text-muted)" }} />
                </Link>
              ))}
            </Card>
          </Section>
        )}

        {/* Quick tiles — only what this role can open */}
        <Section title="Quick access">
          <div className="grid grid-cols-4 gap-2">
            <Tile href="/mobile/map" icon={Map} label="Route" />
            {caps.photos && <Tile href="/mobile/photos" icon={Camera} label="Photos" />}
            {caps.messages && <Tile href="/mobile/messages" icon={MessageSquare} label="Messages" />}
            {caps.documents && <Tile href="/mobile/more/documents" icon={FileText} label="SOPs" />}
            <Tile href="/mobile/more/timecard" icon={Clock} label="Timecard" />
          </div>
        </Section>
      </div>
    </div>
  );
}

// The hero card: identity + address + the job's actual next status action.
function CurrentJobCard({ job, onChanged }: { job: Job; onChanged: () => void }) {
  const primary = primaryAction(job.status);
  const startRoute = (job.status === "scheduled" || job.status === "new") && !!job.propertyAddress;
  const PrimIcon = primary ? PRIMARY_ICON[primary.to] ?? Play : Play;
  const meta = STATUS_META[job.status];
  return (
    <Card className="overflow-hidden" style={{ border: `1px solid ${meta.color}33` }}>
      <div className="p-4 pb-3">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-semibold tabular-nums" style={{ color: "var(--text-secondary)" }}>{job.scheduledTime}</span>
          <StatusChip status={job.status} size="md" />
        </div>
        <p className="mt-1.5 text-xl font-bold leading-tight" style={{ color: "var(--text-primary)" }}>{job.customerName}</p>
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>{prettyType(job.type)} · {areaOf(job.propertyAddress) || "No address"}</p>
      </div>
      <div className="p-3 pt-0 space-y-2">
        {startRoute ? (
          <Link href={`/mobile/navigate/${job.id}`} className="min-h-[52px] rounded-xl flex items-center justify-center gap-2 text-base font-bold text-white active:scale-[0.99] transition-transform" style={{ backgroundColor: ACCENT, boxShadow: `0 8px 22px -8px ${ACCENT}` }}>
            <Navigation className="w-5 h-5" /> Start Route
          </Link>
        ) : primary ? (
          <button onClick={() => { setMyJobStatus(job.id, primary.to); onChanged(); }}
            className="w-full min-h-[52px] rounded-xl flex items-center justify-center gap-2 text-base font-bold text-white active:scale-[0.99] transition-transform"
            style={{ backgroundColor: ACCENT, boxShadow: `0 8px 22px -8px ${ACCENT}` }}>
            <PrimIcon className="w-5 h-5" /> {primary.label}
          </button>
        ) : null}
        <div className="grid grid-cols-2 gap-2">
          <a href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(job.propertyAddress || "")}`} target="_blank" rel="noreferrer"
            className="min-h-[46px] rounded-xl flex items-center justify-center gap-2 text-sm font-semibold active:scale-[0.99] transition-transform"
            style={{ border: "1px solid var(--border)", color: "var(--text-primary)" }}>
            <MapPin className="w-4 h-4" /> Directions
          </a>
          <Link href={`/mobile/jobs/${job.id}`} className="min-h-[46px] rounded-xl flex items-center justify-center gap-2 text-sm font-semibold active:scale-[0.99] transition-transform" style={{ border: "1px solid var(--border)", color: "var(--text-primary)" }}>
            <Briefcase className="w-4 h-4" /> Open job
          </Link>
        </div>
      </div>
    </Card>
  );
}

// One stop on the day's timeline: a time rail + status dot + tap-through.
function TimelineRow({ job, last, plain = false }: { job: Job; last: boolean; plain?: boolean }) {
  const meta = STATUS_META[job.status];
  const done = ["completed", "invoiced", "closed"].includes(job.status);
  return (
    <Link href={`/mobile/jobs/${job.id}`} className="flex gap-3 px-4 active:bg-[var(--bg-surface-2)]">
      {!plain && (
        <div className="flex flex-col items-center w-12 shrink-0 pt-3.5">
          <span className="text-[11px] font-semibold tabular-nums" style={{ color: done ? "var(--text-muted)" : "var(--text-secondary)" }}>
            {(job.scheduledTime || "—").replace(" ", "")}
          </span>
        </div>
      )}
      <div className="flex flex-col items-center shrink-0">
        <span className="w-2.5 h-2.5 rounded-full mt-[1.15rem]" style={{ backgroundColor: meta.color, boxShadow: done ? "none" : `0 0 0 4px ${meta.color}22` }} />
        {!last && <span className="w-px flex-1" style={{ backgroundColor: "var(--border-subtle)" }} />}
      </div>
      <div className="min-w-0 flex-1 py-3" style={{ opacity: done ? 0.6 : 1 }}>
        <div className="flex items-center justify-between gap-2">
          <p className="text-[15px] font-semibold truncate" style={{ color: "var(--text-primary)", textDecoration: done ? "line-through" : "none" }}>{job.customerName}</p>
          <StatusChip status={job.status} />
        </div>
        <p className="text-[13px] truncate" style={{ color: "var(--text-muted)" }}>{prettyType(job.type)} · {areaOf(job.propertyAddress) || "No address"}</p>
      </div>
    </Link>
  );
}

function Tile({ href, icon: Icon, label }: { href: string; icon: React.ElementType; label: string }) {
  return (
    <Link href={href} className="flex flex-col items-center gap-1.5 py-3 rounded-2xl active:scale-[0.97] transition-transform"
      style={{ border: "1px solid var(--border)", backgroundColor: "var(--bg-surface)", boxShadow: "var(--shadow-card)" }}>
      <Icon className="w-5 h-5" style={{ color: ACCENT }} />
      <span className="text-[11px] font-medium" style={{ color: "var(--text-secondary)" }}>{label}</span>
    </Link>
  );
}
