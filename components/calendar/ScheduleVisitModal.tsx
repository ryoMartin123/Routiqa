"use client";

import { useState, useMemo } from "react";
import { X, CalendarClock, FileText } from "lucide-react";
import Select from "@/components/ui/Select";
import DatePicker from "@/components/ui/DatePicker";
import TimePicker from "@/components/ui/TimePicker";
import type { CustomerAgreement, AgreementVisit } from "@/lib/agreements/data";
import { todayYMD, isPastDateTime, isOutsideHours, formatHour } from "@/lib/utils/schedule";

export interface VisitScheduleDraft {
  agreementId: string;
  visitId: string;
  tech: string;
  date: string;   // yyyy-mm-dd
  time: string;   // HH:MM (24h)
  durationMinutes: number;
}

type SchedulableVisit = { agreement: CustomerAgreement; visit: AgreementVisit };

// Book a planned agreement visit straight from the dispatch board. The visit is only
// a plan entry until confirmed here; on confirm it materializes into a Job (one
// lifecycle) and counts against the agreement. Any planned visit can be scheduled at
// any time, regardless of its target date.
export default function ScheduleVisitModal({
  visits, technicians, defaultDate, dayStart, dayEnd, onConfirm, onClose, checkOverlap, error,
}: {
  visits: SchedulableVisit[];
  technicians: string[];
  defaultDate: string;   // yyyy-mm-dd (board's focused day)
  dayStart: number;      // board opening hour (24h)
  dayEnd: number;        // board closing hour (24h)
  onConfirm: (d: VisitScheduleDraft) => void;
  onClose: () => void;
  checkOverlap?: (d: { tech: string; date: string; time: string; durationMinutes: number }) => boolean;
  error?: string | null;   // surfaced from the materialize step (rare)
}) {
  // Distinct agreements (preserve order), each carrying its schedulable visits.
  const agreements = useMemo(() => {
    const map = new Map<string, CustomerAgreement>();
    for (const { agreement } of visits) if (!map.has(agreement.id)) map.set(agreement.id, agreement);
    return [...map.values()];
  }, [visits]);

  const firstTech = (a?: CustomerAgreement) =>
    a && a.assignedTo && a.assignedTo !== "Unassigned" && technicians.includes(a.assignedTo) ? a.assignedTo : "";

  const [agreementId, setAgreementId] = useState(agreements[0]?.id ?? "");
  const visitsForAgr = visits.filter(v => v.agreement.id === agreementId);
  const [visitId, setVisitId] = useState(visitsForAgr[0]?.visit.id ?? "");
  const [tech, setTech] = useState(firstTech(agreements[0]));
  const [date, setDate] = useState(defaultDate);
  const [time, setTime] = useState("09:00");
  const [durationMinutes, setDuration] = useState(90);

  const selected = visits.find(v => v.visit.id === visitId && v.agreement.id === agreementId);

  function chooseAgreement(id: string) {
    setAgreementId(id);
    const next = visits.filter(v => v.agreement.id === id);
    setVisitId(next[0]?.visit.id ?? "");
    setTech(firstTech(agreements.find(a => a.id === id)));
  }

  const isPast = isPastDateTime(date, time);
  const outsideHours = isOutsideHours(time, durationMinutes, dayStart, dayEnd);
  const conflict = !isPast && !outsideHours && !!tech && !!checkOverlap?.({ tech, date, time, durationMinutes });
  const valid = !!agreementId && !!visitId && !!date && !!time && !isPast && !outsideHours && !conflict;

  const empty = visits.length === 0;

  return (
    <div className="fixed inset-0 z-[60] bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl overflow-hidden" onClick={e => e.stopPropagation()}
        style={{ backgroundColor: "var(--bg-surface)", boxShadow: "0 16px 48px rgba(0,0,0,0.24)" }}>
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
          <div className="flex items-center gap-2">
            <CalendarClock className="w-4 h-4" style={{ color: "#4f46e5" }} />
            <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Schedule Agreement Visit</p>
          </div>
          <button onClick={onClose} style={{ color: "var(--text-muted)" }}><X className="w-4 h-4" /></button>
        </div>

        {empty ? (
          <div className="px-5 py-10 text-center">
            <FileText className="w-6 h-6 mx-auto mb-2" style={{ color: "var(--text-muted)" }} />
            <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>No planned visits to schedule</p>
            <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
              Every agreement visit in this view is already booked.
            </p>
          </div>
        ) : (
          <div className="p-5 space-y-3">
            <Field label="Agreement">
              <Select size="sm" value={agreementId} onChange={chooseAgreement}
                options={agreements.map(a => ({ value: a.id, label: `${a.customer} — ${a.type}` }))} />
            </Field>

            <Field label="Visit">
              <Select size="sm" value={visitId} onChange={setVisitId}
                options={visitsForAgr.map(v => ({ value: v.visit.id, label: `${v.visit.label} · planned ${v.visit.scheduled}` }))} />
            </Field>

            {/* Summary — confirms which visit + its plan/target date (booking can differ). */}
            {selected && (
              <div className="rounded-xl p-3" style={{ backgroundColor: "var(--bg-surface-2)", borderLeft: "3px solid #6366f1" }}>
                <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{selected.visit.label}</p>
                <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>
                  {selected.agreement.customer} · target {selected.visit.scheduled}
                </p>
              </div>
            )}

            <Field label="Technician">
              <Select size="sm" value={tech} onChange={setTech}
                options={[{ value: "", label: "Unassigned" }, ...technicians.map(t => ({ value: t, label: t }))]} />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Date">
                <DatePicker value={date} onChange={setDate} clearable={false} min={todayYMD()} />
              </Field>
              <Field label="Time">
                <TimePicker value={time} onChange={setTime} />
              </Field>
            </div>

            <Field label="Duration (minutes)">
              <input type="number" min={15} step={15} value={durationMinutes} onChange={e => setDuration(parseInt(e.target.value) || 90)}
                className="w-full rounded-lg px-3 py-2 text-sm outline-none" style={{ border: "1px solid var(--border)", backgroundColor: "var(--bg-surface)", color: "var(--text-primary)" }} />
            </Field>

            {isPast && (
              <p className="text-xs" style={{ color: "#dc2626" }}>
                That time is in the past — pick a current or future date and time.
              </p>
            )}
            {outsideHours && !isPast && (
              <p className="text-xs" style={{ color: "#dc2626" }}>
                Outside the board&apos;s hours ({formatHour(dayStart)}–{formatHour(dayEnd)}). Move the start earlier or shorten the duration so it ends by {formatHour(dayEnd)}.
              </p>
            )}
            {conflict && (
              <p className="text-xs" style={{ color: "#dc2626" }}>
                {tech} already has a job during this time. Pick a different time or technician so jobs don&apos;t overlap.
              </p>
            )}
            {error && <p className="text-xs" style={{ color: "#dc2626" }}>{error}</p>}
          </div>
        )}

        <div className="px-5 py-4 flex justify-end gap-2" style={{ borderTop: "1px solid var(--border-subtle)" }}>
          <button onClick={onClose} className="px-3 py-1.5 rounded-lg text-sm" style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}>Cancel</button>
          {!empty && (
            <button onClick={() => valid && onConfirm({ agreementId, visitId, tech, date, time, durationMinutes })} disabled={!valid}
              className="px-4 py-1.5 rounded-lg text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 transition-colors">
              Confirm &amp; Schedule
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>{label}</label>
      {children}
    </div>
  );
}
