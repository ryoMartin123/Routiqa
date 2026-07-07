"use client";

// ─── Multi-day crew booking ───────────────────────────────
// One action instead of N drags: pick the crew, a start date, how many working
// days, and the daily window — one visit per day is created on the chosen work
// order (same "more time on the same scope = another visit" rule). Times and
// durations follow the dispatch increment for the job's scope.

import { useMemo, useState } from "react";
import { X, CalendarRange, Users } from "lucide-react";
import { getJob, getWorkOrdersForJob } from "@/lib/jobs/data";
import { createAppointment, getAllAppointments } from "@/lib/appointments/data";
import { getBoardCandidates } from "@/lib/users/data";
import { resolveDispatchSettings } from "@/lib/calendar/settings";
import DatePicker from "@/components/ui/DatePicker";
import TimePicker from "@/components/ui/TimePicker";
import NumberStepper from "@/components/ui/NumberStepper";
import UiSelect from "@/components/ui/Select";
import { pingSaved, pingError } from "@/components/shared/SavedPill";

const fmtDay = (ymd: string) =>
  new Date(`${ymd}T12:00:00`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });

// The run of working days: from `start`, `count` days, optionally skipping weekends.
function workingDays(start: string, count: number, skipWeekends: boolean): string[] {
  const out: string[] = [];
  const d = new Date(`${start}T12:00:00`);
  if (isNaN(d.getTime())) return out;
  while (out.length < count) {
    const dow = d.getDay();
    if (!skipWeekends || (dow !== 0 && dow !== 6)) out.push(d.toISOString().slice(0, 10));
    d.setDate(d.getDate() + 1);
  }
  return out;
}

export default function MultiDayBookModal({ jobId, onClose, onBooked }: {
  jobId: string;
  onClose: () => void;
  onBooked?: () => void;
}) {
  const job = getJob(jobId);
  const wos = useMemo(() => getWorkOrdersForJob(jobId), [jobId]);
  const board = resolveDispatchSettings(job?.companyId, job?.locationId).hourly;
  const candidates = useMemo(
    () => getBoardCandidates(job?.companyId, job?.locationId).map(u => u.fullName),
    [job?.companyId, job?.locationId],
  );

  const [woId, setWoId] = useState(wos[0]?.id ?? "");
  const [techs, setTechs] = useState<string[]>(job?.assignedTo ? [job.assignedTo] : []);
  const [start, setStart] = useState("");
  const [days, setDays] = useState("5");
  const [skipWeekends, setSkipWeekends] = useState(true);
  const [time, setTime] = useState("08:00");
  // Default day length: the board's working window, rounded to the increment.
  const [duration, setDuration] = useState(String(Math.max(board.increment, Math.round(((board.endHour - board.startHour) * 60) / board.increment) * board.increment)));

  if (!job) return null;

  const dayCount = Math.max(1, Math.min(14, parseInt(days, 10) || 1));
  const dates = start ? workingDays(start, dayCount, skipWeekends) : [];
  const canBook = !!woId && techs.length > 0 && dates.length > 0 && !!time;

  // Days where a selected tech already has an overlapping visit — warned, not
  // blocked (the dispatcher may be intentionally double-crewing).
  const toMin = (t: string) => { const [h, m] = t.split(":").map(Number); return (h || 0) * 60 + (m || 0); };
  const conflicts = useMemo(() => {
    const out = new Set<string>();
    if (!time || dates.length === 0 || techs.length === 0) return out;
    const s0 = toMin(time), e0 = s0 + (parseInt(duration, 10) || 0);
    const dateSet = new Set(dates);
    for (const a of getAllAppointments()) {
      if (!a.scheduledDate || !a.scheduledTime || a.status === "canceled") continue;
      if (!dateSet.has(a.scheduledDate)) continue;
      if (!a.techIds.some(t2 => techs.includes(t2))) continue;
      const as = toMin(a.scheduledTime), ae = as + a.durationMinutes;
      if (as < e0 && ae > s0) out.add(a.scheduledDate);
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dates.join(","), techs.join(","), time, duration]);

  const toggleTech = (name: string) =>
    setTechs(prev => prev.includes(name) ? prev.filter(t => t !== name) : [...prev, name]);

  function book() {
    if (!canBook) { pingError("Pick a crew, start date, and time first."); return; }
    for (const date of dates) {
      createAppointment({
        jobId, workOrderId: woId, techIds: techs,
        scheduledDate: date, scheduledTime: time,
        durationMinutes: parseInt(duration, 10) || board.increment,
      });
    }
    pingSaved(`Booked ${dates.length} visit${dates.length === 1 ? "" : "s"} — ${fmtDay(dates[0])} to ${fmtDay(dates[dates.length - 1])}`);
    onBooked?.();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-lg max-h-[90vh] flex flex-col rounded-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
        style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "0 16px 48px rgba(0,0,0,0.24)" }}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 shrink-0" style={{ borderBottom: "1px solid var(--border)" }}>
          <div className="flex items-center gap-2.5 min-w-0">
            <CalendarRange className="w-4 h-4 shrink-0" style={{ color: "var(--accent-text)" }} />
            <div className="min-w-0">
              <h2 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>Book multi-day visits</h2>
              <p className="text-xs mt-0.5 truncate" style={{ color: "var(--text-muted)" }}>{job.title} · one visit per working day</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg" style={{ color: "var(--text-muted)" }}><X className="w-4 h-4" /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          {wos.length > 1 && (
            <Field label="Work order">
              <UiSelect value={woId} onChange={setWoId} options={wos.map(w => ({ value: w.id, label: w.title }))} />
            </Field>
          )}

          <Field label="Crew" required>
            {candidates.length === 0 ? (
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>No technicians available for this branch.</p>
            ) : (
              <div className="flex flex-wrap gap-2 pt-1">
                {candidates.map(name => {
                  const on = techs.includes(name);
                  return (
                    <button key={name} onClick={() => toggleTech(name)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                      style={{
                        border: `1.5px solid ${on ? "var(--copper-soft-border)" : "var(--border)"}`,
                        backgroundColor: on ? "var(--copper-soft-bg)" : "var(--bg-surface-2)",
                        color: on ? "var(--copper-text)" : "var(--text-secondary)",
                      }}>
                      <Users className="w-3 h-3" /> {name}
                    </button>
                  );
                })}
              </div>
            )}
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="First day" required>
              <DatePicker value={start} onChange={setStart} min={new Date().toISOString().slice(0, 10)} />
            </Field>
            <Field label="Working days">
              <NumberStepper min={1} step={1} value={days} onChange={setDays} />
            </Field>
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={skipWeekends} onChange={e => setSkipWeekends(e.target.checked)} className="accent-[#0f8578]" />
            <span className="text-sm" style={{ color: "var(--text-secondary)" }}>Skip weekends</span>
          </label>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Start time each day" required>
              <TimePicker value={time} onChange={setTime} minuteStep={board.increment}
                startHour={Math.floor(board.startHour)} endHour={Math.ceil(board.endHour)} />
            </Field>
            <Field label="Duration / day (min)">
              <NumberStepper min={board.increment} step={board.increment} value={duration} onChange={setDuration} />
            </Field>
          </div>

          {/* The exact days about to be booked — no surprises */}
          {dates.length > 0 && (
            <div className="rounded-lg p-3" style={{ backgroundColor: "var(--bg-surface-2)", border: "1px solid var(--border)" }}>
              <p className="text-[11px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: "var(--text-muted)" }}>
                {dates.length} visit{dates.length === 1 ? "" : "s"}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {dates.map((d, i) => {
                  const busy = conflicts.has(d);
                  return (
                    <span key={d} className="text-[11px] px-2 py-0.5 rounded"
                      title={busy ? "A selected tech already has a visit in this window" : undefined}
                      style={{ backgroundColor: busy ? "#fee2e2" : "var(--accent-soft-bg)", color: busy ? "#991b1b" : "var(--accent-text)" }}>
                      Day {i + 1} · {fmtDay(d)}{busy ? " · busy" : ""}
                    </span>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div className="px-6 py-4 flex justify-end gap-2 shrink-0" style={{ borderTop: "1px solid var(--border)" }}>
          <button onClick={onClose} className="px-3 py-2 rounded-lg text-sm" style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}>Cancel</button>
          <button onClick={book} disabled={!canBook}
            className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-[#0f8578] hover:bg-[#0c6b60] disabled:opacity-40 transition-colors">
            {conflicts.size > 0
              ? `Book anyway — ${conflicts.size} day${conflicts.size === 1 ? "" : "s"} conflict`
              : `Book ${dates.length > 0 ? `${dates.length} visits` : "visits"}`}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>
        {label} {required && <span style={{ color: "#ef4444" }}>*</span>}
      </label>
      {children}
    </div>
  );
}
