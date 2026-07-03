"use client";

import { useState } from "react";
import { X, CalendarClock } from "lucide-react";
import Select from "@/components/ui/Select";
import DatePicker from "@/components/ui/DatePicker";
import TimePicker from "@/components/ui/TimePicker";
import NumberStepper from "@/components/ui/NumberStepper";
import type { UnscheduledItem } from "@/lib/calendar/types";
import { isPastDateTime, isOutsideHours, formatHour, minTimeFor, minBookableYMD } from "@/lib/utils/schedule";

export interface ScheduleDraft {
  tech: string;
  date: string;   // yyyy-mm-dd
  time: string;   // HH:MM (24h)
  durationMinutes: number;
}

// Confirmation before an unscheduled item becomes a scheduled job — never schedule silently.
export default function ScheduleConfirmModal({
  item, draft, technicians, dayStart, dayEnd, onConfirm, onClose, checkOverlap,
}: {
  item: UnscheduledItem;
  draft: ScheduleDraft;
  technicians: string[];
  dayStart: number;   // board opening hour (24h)
  dayEnd: number;     // board closing hour (24h)
  onConfirm: (d: ScheduleDraft) => void;
  onClose: () => void;
  checkOverlap?: (d: ScheduleDraft) => boolean;   // true = clashes with another job in the lane
}) {
  const [d, setD] = useState<ScheduleDraft>(draft);
  const set = <K extends keyof ScheduleDraft>(k: K, v: ScheduleDraft[K]) => setD(p => ({ ...p, [k]: v }));
  const isPast = isPastDateTime(d.date, d.time);
  const outsideHours = isOutsideHours(d.time, d.durationMinutes, dayStart, dayEnd);
  // Only meaningful once a tech is assigned and the time is valid.
  const conflict = !isPast && !outsideHours && !!d.tech && !!checkOverlap?.(d);

  return (
    <div className="fixed inset-0 z-[60] bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl overflow-hidden" onClick={e => e.stopPropagation()}
        style={{ backgroundColor: "var(--bg-surface)", boxShadow: "0 16px 48px rgba(0,0,0,0.24)" }}>
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: "1px solid var(--border)" }}>
          <div className="flex items-center gap-2">
            <CalendarClock className="w-4 h-4" style={{ color: "#4f46e5" }} />
            <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Schedule Job</p>
          </div>
          <button onClick={onClose} style={{ color: "var(--text-muted)" }}><X className="w-4 h-4" /></button>
        </div>

        <div className="p-5 space-y-3">
          {/* Summary */}
          <div className="rounded-xl p-3" style={{ backgroundColor: "var(--bg-surface-2)", borderLeft: `3px solid ${item.color}` }}>
            <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{item.title}</p>
            {item.customerName && <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>{item.customerName}{item.city ? ` · ${item.city}` : ""}</p>}
          </div>

          <Field label="Technician">
            <Select size="sm" value={d.tech} onChange={v => set("tech", v)}
              options={[{ value: "", label: "Unassigned" }, ...technicians.map(t => ({ value: t, label: t }))]} />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Date">
              <DatePicker value={d.date} onChange={v => set("date", v)} clearable={false} min={minBookableYMD(dayEnd)} />
            </Field>
            <Field label="Time">
              <TimePicker value={d.time} onChange={v => set("time", v)} minTime={minTimeFor(d.date)} />
            </Field>
          </div>

          {isPast && (
            <p className="text-xs" style={{ color: "#dc2626" }}>
              That time is in the past — pick a current or future date and time.
            </p>
          )}

          <Field label="Duration (minutes)">
            <NumberStepper min={15} step={15} suffix="min" value={String(d.durationMinutes)} onChange={v => set("durationMinutes", parseInt(v, 10) || 60)} />
          </Field>

          {outsideHours && !isPast && (
            <p className="text-xs" style={{ color: "#dc2626" }}>
              Outside the board&apos;s hours ({formatHour(dayStart)}–{formatHour(dayEnd)}). Move the start earlier or shorten the duration so it ends by {formatHour(dayEnd)}.
            </p>
          )}

          {conflict && (
            <p className="text-xs" style={{ color: "#dc2626" }}>
              {d.tech} already has a job during this time. Pick a different time or technician so jobs don&apos;t overlap.
            </p>
          )}
        </div>

        <div className="px-5 py-4 flex justify-end gap-2" style={{ borderTop: "1px solid var(--border)" }}>
          <button onClick={onClose} className="px-3 py-1.5 rounded-lg text-sm" style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}>Cancel</button>
          <button onClick={() => onConfirm(d)} disabled={!d.date || !d.time || isPast || outsideHours || conflict}
            className="px-4 py-1.5 rounded-lg text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 transition-colors">
            Confirm &amp; Schedule
          </button>
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
