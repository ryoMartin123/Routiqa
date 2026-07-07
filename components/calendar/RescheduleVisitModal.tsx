"use client";

// ─── Reschedule a visit (from the Visit Details panel) ───────────────────────
// Moves ONE visit to a new date/time/duration, with the job's other visits kept
// honest: a visit can't move into the past, can't start before an earlier visit
// of the same job ends, and if it would run into a LATER visit the dispatcher
// can shift the later visits by the same amount instead of being blocked.

import { useMemo, useState } from "react";
import { X, CalendarClock, Link2 } from "lucide-react";
import DatePicker from "@/components/ui/DatePicker";
import TimePicker from "@/components/ui/TimePicker";
import NumberStepper from "@/components/ui/NumberStepper";
import { getAppointmentsForJob, getAllAppointments, updateAppointment, type Appointment } from "@/lib/appointments/data";
import { getWorkOrderById, getJob, updateJob } from "@/lib/jobs/data";
import { isPastDateTime } from "@/lib/utils/schedule";

function toDate(dateStr: string, timeStr: string): Date | null {
  if (!dateStr) return null;
  const d = new Date(`${dateStr}T${timeStr || "00:00"}`);
  return isNaN(d.getTime()) ? null : d;
}
function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function hm(d: Date): string { return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`; }
function fmtDT(d: Date): string {
  return `${d.toLocaleDateString("en-US", { month: "short", day: "numeric" })} · ${d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`;
}
function jobDateStr(d: Date): string { return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }); }
function jobTimeStr(d: Date): string { return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }); }

export default function RescheduleVisitModal({ jobId, appointmentId, increment = 30, onClose, onSaved }: {
  jobId: string;
  appointmentId?: string;    // undefined = legacy job (no appointment record)
  increment?: number;        // board slot size — durations step in this unit
  onClose: () => void;
  onSaved: () => void;
}) {
  const job = getJob(jobId);
  const siblings = useMemo(() => getAppointmentsForJob(jobId).filter(a => a.status !== "canceled"), [jobId]);
  const idx = appointmentId ? siblings.findIndex(a => a.id === appointmentId) : -1;
  const appt = idx >= 0 ? siblings[idx] : undefined;
  const earlier = idx >= 0 ? siblings.slice(0, idx) : [];
  const later   = idx >= 0 ? siblings.slice(idx + 1) : [];

  // Initial values — appointment fields, else the legacy job's display strings.
  const init = (() => {
    if (appt) return { date: appt.scheduledDate, time: appt.scheduledTime || "09:00", dur: appt.durationMinutes };
    const d = job?.scheduledDate ? new Date(`${job.scheduledDate} ${job.scheduledTime || "9:00 AM"}`) : null;
    return d && !isNaN(d.getTime())
      ? { date: ymd(d), time: hm(d), dur: job?.durationMinutes || 60 }
      : { date: "", time: "09:00", dur: job?.durationMinutes || 60 };
  })();
  const [date, setDate] = useState(init.date);
  const [time, setTime] = useState(init.time);
  const [dur, setDur]   = useState(init.dur);
  const [shiftLater, setShiftLater] = useState(false);

  const newStart = toDate(date, time);
  const newEnd = newStart ? new Date(newStart.getTime() + dur * 60_000) : null;
  const oldStart = toDate(init.date, init.time);
  const deltaMs = newStart && oldStart ? newStart.getTime() - oldStart.getTime() : 0;

  const isPast = !!date && !!time && isPastDateTime(date, time);

  // Order guards against the job's OTHER visits (full datetimes, so they hold
  // across days — the board only checks within one day).
  const earlierEnd = earlier
    .map(a => { const s = toDate(a.scheduledDate, a.scheduledTime); return s ? s.getTime() + a.durationMinutes * 60_000 : null; })
    .filter((t): t is number => t !== null)
    .reduce((m, t) => Math.max(m, t), 0);
  const laterStarts = later
    .map(a => toDate(a.scheduledDate, a.scheduledTime)?.getTime())
    .filter((t): t is number => t != null);
  const earlierViolation = !!newStart && earlierEnd > 0 && newStart.getTime() < earlierEnd;
  const laterViolation = !!newEnd && laterStarts.some(t => newEnd.getTime() > t);

  // Tech double-booking on the target day (other jobs sharing this visit's crew).
  const techConflict = !!newStart && !!newEnd && !!appt && appt.techIds.length > 0 && getAllAppointments().some(a => {
    if (a.id === appt.id || a.jobId === jobId || a.status === "canceled") return false;
    if (a.scheduledDate !== date || !a.techIds.some(t => appt.techIds.includes(t))) return false;
    const s = toDate(a.scheduledDate, a.scheduledTime); if (!s) return false;
    return newStart.getTime() < s.getTime() + a.durationMinutes * 60_000 && newEnd.getTime() > s.getTime();
  });

  const blocked = !date || !time || isPast || earlierViolation || (laterViolation && !shiftLater) || techConflict;

  function save() {
    if (blocked || !newStart) return;
    if (appt) {
      updateAppointment(appt.id, { scheduledDate: date, scheduledTime: time, durationMinutes: dur });
      // Shift each later visit by the same delta so the sequence keeps its shape.
      if (shiftLater && laterViolation && deltaMs !== 0) {
        later.forEach(a => {
          const s = toDate(a.scheduledDate, a.scheduledTime);
          if (!s) return;
          const ns = new Date(s.getTime() + deltaMs);
          updateAppointment(a.id, { scheduledDate: ymd(ns), scheduledTime: hm(ns) });
        });
      }
      // Mirror the schedule onto the job for job-centric views (same as board moves).
      updateJob(jobId, { scheduledDate: jobDateStr(newStart), scheduledTime: jobTimeStr(newStart), durationMinutes: dur });
    } else {
      updateJob(jobId, { scheduledDate: jobDateStr(newStart), scheduledTime: jobTimeStr(newStart), durationMinutes: dur });
    }
    onSaved();
  }

  const visitTitle = (a: Appointment, i: number) => getWorkOrderById(a.workOrderId)?.title || `Visit ${i + 1}`;

  return (
    <div className="fixed inset-0 z-[70] bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl overflow-hidden" onClick={e => e.stopPropagation()}
        style={{ backgroundColor: "var(--bg-surface)", boxShadow: "0 16px 48px rgba(0,0,0,0.24)" }}>
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: "1px solid var(--border)" }}>
          <div className="flex items-center gap-2">
            <CalendarClock className="w-4 h-4" style={{ color: "#0f8578" }} />
            <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Reschedule Visit</p>
          </div>
          <button onClick={onClose} style={{ color: "var(--text-muted)" }}><X className="w-4 h-4" /></button>
        </div>

        <div className="p-5 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Date</label>
              <DatePicker value={date} onChange={setDate} clearable={false} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Time</label>
              <TimePicker value={time} onChange={setTime} minuteStep={increment} />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Duration (minutes)</label>
            <NumberStepper min={increment} step={increment} suffix="min" value={String(dur)} onChange={v => setDur(parseInt(v, 10) || 60)} />
          </div>

          {/* The job's other visits — so the sequence is visible while moving one. */}
          {siblings.length > 1 && (
            <div className="rounded-lg px-3 py-2.5 space-y-1.5" style={{ backgroundColor: "var(--bg-surface-2)", border: "1px solid var(--border)" }}>
              <p className="text-[10px] font-semibold uppercase tracking-wider inline-flex items-center gap-1" style={{ color: "var(--text-muted)" }}>
                <Link2 className="w-3 h-3" /> Visits on this job
              </p>
              {siblings.map((a, i) => {
                const s = toDate(a.scheduledDate, a.scheduledTime);
                const isThis = a.id === appointmentId;
                return (
                  <div key={a.id} className="flex items-center justify-between gap-2 text-xs">
                    <span className="truncate" style={{ color: isThis ? "var(--accent-text)" : "var(--text-secondary)", fontWeight: isThis ? 600 : 400 }}>
                      {i + 1}. {visitTitle(a, i)}{isThis ? " (this visit)" : ""}
                    </span>
                    <span className="shrink-0 tabular-nums" style={{ color: "var(--text-muted)" }}>{s ? fmtDT(s) : "Unscheduled"}</span>
                  </div>
                );
              })}
            </div>
          )}

          {isPast && <p className="text-xs" style={{ color: "#dc2626" }}>That time is in the past — pick a current or future time.</p>}
          {earlierViolation && (
            <p className="text-xs" style={{ color: "#dc2626" }}>
              This visit must start after the earlier visit ends ({fmtDT(new Date(earlierEnd))}).
            </p>
          )}
          {laterViolation && (
            <label className="flex items-start gap-2 text-xs cursor-pointer rounded-lg px-3 py-2.5" style={{ backgroundColor: "#fffbeb", border: "1px solid #fde68a", color: "#92400e" }}>
              <input type="checkbox" checked={shiftLater} onChange={e => setShiftLater(e.target.checked)} className="mt-0.5" />
              <span>
                This runs into the job&apos;s later visit{later.length > 1 ? "s" : ""}. Shift {later.length > 1 ? `all ${later.length} later visits` : "it"} by the same amount to keep the sequence.
              </span>
            </label>
          )}
          {techConflict && <p className="text-xs" style={{ color: "#dc2626" }}>The assigned technician already has a job during this time.</p>}
        </div>

        <div className="px-5 py-4 flex justify-end gap-2" style={{ borderTop: "1px solid var(--border)" }}>
          <button onClick={onClose} className="px-3 py-1.5 rounded-lg text-sm" style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}>Cancel</button>
          <button onClick={save} disabled={blocked}
            className="px-4 py-1.5 rounded-lg text-sm font-medium text-white bg-[#0f8578] hover:bg-[#0c6b60] disabled:opacity-40 transition-colors">
            Reschedule{shiftLater && laterViolation ? ` + shift ${later.length}` : ""}
          </button>
        </div>
      </div>
    </div>
  );
}
