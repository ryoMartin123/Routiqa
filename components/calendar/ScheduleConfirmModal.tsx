"use client";

import { useState } from "react";
import { X, CalendarClock } from "lucide-react";
import Select from "@/components/ui/Select";
import type { UnscheduledItem } from "@/lib/calendar/types";

export interface ScheduleDraft {
  tech: string;
  date: string;   // yyyy-mm-dd
  time: string;   // HH:MM (24h)
  durationMinutes: number;
}

// Confirmation before an unscheduled item becomes a scheduled job — never schedule silently.
export default function ScheduleConfirmModal({
  item, draft, technicians, onConfirm, onClose,
}: {
  item: UnscheduledItem;
  draft: ScheduleDraft;
  technicians: string[];
  onConfirm: (d: ScheduleDraft) => void;
  onClose: () => void;
}) {
  const [d, setD] = useState<ScheduleDraft>(draft);
  const set = <K extends keyof ScheduleDraft>(k: K, v: ScheduleDraft[K]) => setD(p => ({ ...p, [k]: v }));

  return (
    <div className="fixed inset-0 z-[60] bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl overflow-hidden" onClick={e => e.stopPropagation()}
        style={{ backgroundColor: "var(--bg-surface)", boxShadow: "0 16px 48px rgba(0,0,0,0.24)" }}>
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
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
              <input type="date" value={d.date} onChange={e => set("date", e.target.value)}
                className="w-full rounded-lg px-3 py-2 text-sm outline-none" style={{ border: "1px solid var(--border)", backgroundColor: "var(--bg-surface)", color: "var(--text-primary)" }} />
            </Field>
            <Field label="Time">
              <input type="time" value={d.time} onChange={e => set("time", e.target.value)}
                className="w-full rounded-lg px-3 py-2 text-sm outline-none" style={{ border: "1px solid var(--border)", backgroundColor: "var(--bg-surface)", color: "var(--text-primary)" }} />
            </Field>
          </div>

          <Field label="Duration (minutes)">
            <input type="number" min={15} step={15} value={d.durationMinutes} onChange={e => set("durationMinutes", parseInt(e.target.value) || 60)}
              className="w-full rounded-lg px-3 py-2 text-sm outline-none" style={{ border: "1px solid var(--border)", backgroundColor: "var(--bg-surface)", color: "var(--text-primary)" }} />
          </Field>
        </div>

        <div className="px-5 py-4 flex justify-end gap-2" style={{ borderTop: "1px solid var(--border-subtle)" }}>
          <button onClick={onClose} className="px-3 py-1.5 rounded-lg text-sm" style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}>Cancel</button>
          <button onClick={() => onConfirm(d)} disabled={!d.date || !d.time}
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
