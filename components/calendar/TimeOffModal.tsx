"use client";

// Add a technician availability event (PTO / time off / training / on-call /
// blocked) from the dispatch board. Writes through onSave → createAvailability.

import { useState } from "react";
import { X, CalendarClock } from "lucide-react";
import UiSelect from "@/components/ui/Select";
import DatePicker from "@/components/ui/DatePicker";
import { AVAILABILITY_CONFIG, type AvailabilityKind, type NewAvailabilityInput } from "@/lib/calendar/availability";

const KINDS = Object.keys(AVAILABILITY_CONFIG) as AvailabilityKind[];
const HOURS = Array.from({ length: 15 }, (_, i) => i + 6); // 6 AM – 8 PM
const hourLabel = (h: number) => `${h > 12 ? h - 12 : h}:00 ${h >= 12 ? "PM" : "AM"}`;

function toYmd(v: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  const d = new Date(v);
  if (isNaN(d.getTime())) return v;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function TimeOffModal({ technicians, defaultDate, onClose, onSave }: {
  technicians: string[];
  defaultDate: string;             // yyyy-mm-dd
  onClose: () => void;
  onSave: (input: NewAvailabilityInput) => void;
}) {
  const [techName, setTechName] = useState(technicians[0] ?? "");
  const [kind, setKind]         = useState<AvailabilityKind>("pto");
  const [date, setDate]         = useState(defaultDate);
  const [allDay, setAllDay]     = useState(true);
  const [startHour, setStartHour] = useState(9);
  const [endHour, setEndHour]     = useState(12);
  const [note, setNote]         = useState("");

  const canSave = Boolean(techName && date && (allDay || endHour > startHour));

  function save() {
    if (!canSave) return;
    onSave({
      techName, kind, date: toYmd(date), allDay,
      startHour: allDay ? undefined : startHour,
      endHour:   allDay ? undefined : endHour,
      note: note.trim() || undefined,
    });
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl overflow-hidden" onClick={e => e.stopPropagation()}
        style={{ backgroundColor: "var(--bg-surface)", boxShadow: "0 16px 48px rgba(0,0,0,0.24)" }}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
          <div className="flex items-center gap-2">
            <CalendarClock className="w-4 h-4" style={{ color: "#4f46e5" }} />
            <p className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>Add Time Off</p>
          </div>
          <button onClick={onClose} style={{ color: "var(--text-muted)" }}><X className="w-4 h-4" /></button>
        </div>

        {/* Body */}
        <div className="px-6 py-4 space-y-4">
          {technicians.length === 0 ? (
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              No technicians on the roster yet. Add a user with a Technician role in Settings → Users first.
            </p>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Technician">
                  <UiSelect value={techName} onChange={setTechName} options={technicians.map(t => ({ value: t, label: t }))} />
                </Field>
                <Field label="Type">
                  <UiSelect value={kind} onChange={v => setKind(v as AvailabilityKind)}
                    options={KINDS.map(k => ({ value: k, label: AVAILABILITY_CONFIG[k].label }))} />
                </Field>
              </div>

              <Field label="Date">
                <DatePicker value={date} onChange={setDate} placeholder="Pick a date" />
              </Field>

              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input type="checkbox" checked={allDay} onChange={e => setAllDay(e.target.checked)} className="accent-indigo-600" />
                <span className="text-sm" style={{ color: "var(--text-secondary)" }}>All day</span>
              </label>

              {!allDay && (
                <div className="grid grid-cols-2 gap-3">
                  <Field label="From">
                    <UiSelect value={String(startHour)} onChange={v => setStartHour(Number(v))}
                      options={HOURS.map(h => ({ value: String(h), label: hourLabel(h) }))} />
                  </Field>
                  <Field label="To">
                    <UiSelect value={String(endHour)} onChange={v => setEndHour(Number(v))}
                      options={HOURS.map(h => ({ value: String(h), label: hourLabel(h) }))} />
                  </Field>
                </div>
              )}

              <Field label="Note (optional)">
                <input value={note} onChange={e => setNote(e.target.value)} placeholder="e.g. Vacation, dentist…"
                  className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                  style={{ border: "1px solid var(--border)", backgroundColor: "var(--bg-surface)", color: "var(--text-primary)" }} />
              </Field>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 flex justify-end gap-2" style={{ borderTop: "1px solid var(--border-subtle)" }}>
          <button onClick={onClose} className="px-3 py-2 rounded-lg text-sm" style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}>Cancel</button>
          <button onClick={save} disabled={!canSave}
            className="px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-40" style={{ backgroundColor: "#4f46e5" }}>
            Add Time Off
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
