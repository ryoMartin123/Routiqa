"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { X, CalendarClock, FileText, Search, ChevronDown, Check } from "lucide-react";
import Select from "@/components/ui/Select";
import DatePicker from "@/components/ui/DatePicker";
import TimePicker from "@/components/ui/TimePicker";
import NumberStepper from "@/components/ui/NumberStepper";
import type { CustomerAgreement, AgreementVisit } from "@/lib/agreements/data";
import { isPastDateTime, isOutsideHours, formatHour, minTimeFor, minBookableYMD } from "@/lib/utils/schedule";

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
  visits, technicians, defaultDate, dayStart, dayEnd, increment = 30, onConfirm, onClose, checkOverlap, error,
}: {
  visits: SchedulableVisit[];
  technicians: string[];
  defaultDate: string;   // yyyy-mm-dd (board's focused day)
  dayStart: number;      // board opening hour (24h)
  dayEnd: number;        // board closing hour (24h)
  increment?: number;    // board slot size — durations step in this unit
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
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: "1px solid var(--border)" }}>
          <div className="flex items-center gap-2">
            <CalendarClock className="w-4 h-4" style={{ color: "#0f8578" }} />
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
              <AgreementPicker agreements={agreements} value={agreementId} onChange={chooseAgreement} />
            </Field>

            <Field label="Visit">
              <Select size="sm" value={visitId} onChange={setVisitId}
                options={visitsForAgr.map(v => ({ value: v.visit.id, label: `${v.visit.label} · planned ${v.visit.scheduled}` }))} />
            </Field>

            {/* Summary — confirms which visit + its plan/target date (booking can differ). */}
            {selected && (
              <div className="rounded-xl p-3" style={{ backgroundColor: "var(--bg-surface-2)", borderLeft: "3px solid #239c8d" }}>
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
                <DatePicker value={date} onChange={setDate} clearable={false} min={minBookableYMD(dayEnd)} />
              </Field>
              <Field label="Time">
                <TimePicker value={time} onChange={setTime} minTime={minTimeFor(date)} minuteStep={increment} />
              </Field>
            </div>

            <Field label="Duration (minutes)">
              <NumberStepper min={increment} step={increment} suffix="min" value={String(durationMinutes)} onChange={v => setDuration(parseInt(v, 10) || 90)} />
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

        <div className="px-5 py-4 flex justify-end gap-2" style={{ borderTop: "1px solid var(--border)" }}>
          <button onClick={onClose} className="px-3 py-1.5 rounded-lg text-sm" style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}>Cancel</button>
          {!empty && (
            <button onClick={() => valid && onConfirm({ agreementId, visitId, tech, date, time, durationMinutes })} disabled={!valid}
              className="px-4 py-1.5 rounded-lg text-sm font-medium text-white bg-[#0f8578] hover:bg-[#0c6b60] disabled:opacity-40 transition-colors">
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

// Searchable agreement picker — there can be many agreements, so type to filter by
// customer, type, or number rather than scrolling a long dropdown.
function AgreementPicker({ agreements, value, onChange }: {
  agreements: CustomerAgreement[];
  value: string;
  onChange: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const selected = agreements.find(a => a.id === value);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return agreements;
    return agreements.filter(a => {
      const hay = [a.customer, a.type, a.number ?? "", a.location].join(" ").toLowerCase();
      return q.split(/\s+/).every(t => hay.includes(t));
    });
  }, [agreements, query]);

  useEffect(() => {
    if (!open) { setQuery(""); return; }
    const id = requestAnimationFrame(() => inputRef.current?.focus());
    const onDoc = (e: MouseEvent) => { if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    return () => { cancelAnimationFrame(id); document.removeEventListener("mousedown", onDoc); };
  }, [open]);

  return (
    <div ref={wrapRef} className="relative w-full">
      <button type="button" onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between gap-2 rounded-lg outline-none transition-colors px-3 py-2"
        style={{ border: `1px solid ${open ? "#8ed0c6" : "var(--border)"}`, backgroundColor: "var(--bg-surface)", boxShadow: open ? "0 0 0 3px rgba(35,156,141,0.12)" : "none" }}>
        <span className="min-w-0 text-left">
          {selected
            ? <span className="text-sm font-medium truncate block" style={{ color: "var(--text-primary)" }}>{selected.customer} — {selected.type}</span>
            : <span className="text-sm" style={{ color: "var(--text-muted)" }}>Select an agreement…</span>}
        </span>
        <ChevronDown className="w-3.5 h-3.5 shrink-0 transition-transform" style={{ color: "var(--text-muted)", transform: open ? "rotate(180deg)" : "none" }} />
      </button>

      {open && (
        <div className="absolute left-0 right-0 z-50 mt-1.5 rounded-xl overflow-hidden"
          style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "0 12px 32px rgba(0,0,0,0.16)" }}>
          <div className="flex items-center gap-2 px-3 py-2.5" style={{ borderBottom: "1px solid var(--border)" }}>
            <Search className="w-4 h-4 shrink-0" style={{ color: "var(--text-muted)" }} />
            <input ref={inputRef} value={query} onChange={e => setQuery(e.target.value)}
              placeholder="Search by customer, type, or number…"
              className="flex-1 bg-transparent outline-none text-sm" style={{ color: "var(--text-primary)" }} />
            {query && <button type="button" onClick={() => { setQuery(""); inputRef.current?.focus(); }} style={{ color: "var(--text-muted)" }}><X className="w-3.5 h-3.5" /></button>}
          </div>
          <div className="p-1 overflow-y-auto thin-scroll-y" style={{ maxHeight: "240px" }}>
            {results.length === 0 ? (
              <div className="px-3 py-6 text-center text-xs" style={{ color: "var(--text-muted)" }}>No agreements match “{query}”.</div>
            ) : results.map(a => {
              const isSel = a.id === value;
              return (
                <button key={a.id} type="button" onClick={() => { onChange(a.id); setOpen(false); }}
                  className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left transition-colors hover:bg-[var(--bg-surface-2)]">
                  <span className="flex flex-col min-w-0 flex-1">
                    <span className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>{a.customer}</span>
                    <span className="text-[11px] truncate" style={{ color: "var(--text-muted)" }}>{a.type}{a.number ? ` · ${a.number}` : ""}{a.location ? ` · ${a.location}` : ""}</span>
                  </span>
                  {isSel && <Check className="w-3.5 h-3.5 shrink-0" style={{ color: "#0f8578" }} />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
