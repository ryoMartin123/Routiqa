"use client";

// Guided rule builder shown when a visit's frequency is "Custom". Pick a rule
// type (card/radio), then only the fields for that type appear. Writes a
// structured CustomVisitConfig (never free text) and shows a plain-English summary.

import UiSelect from "@/components/ui/Select";
import NumberStepper from "@/components/ui/NumberStepper";
import DatePicker from "@/components/ui/DatePicker";
import { Plus, Trash2 } from "lucide-react";
import {
  CUSTOM_VISIT_RULE_TYPES, INTERVAL_UNIT_OPTIONS, MONTH_LABELS,
  defaultCustomVisit, newVisitWindow, summarizeCustomVisit,
  type CustomVisitConfig, type CustomVisitWindow, type IntervalUnit,
} from "@/lib/agreements/custom-rules";
import { Mini, TextInput, RuleCard, RuleSummary, cardStyle } from "./ui";

const MONTH_OPTIONS = MONTH_LABELS.map((m, i) => ({ value: String(i + 1), label: m }));

export default function CustomVisitBuilder({ config, onChange, minDate, maxDate }: {
  config?: CustomVisitConfig; onChange: (c: CustomVisitConfig) => void;
  minDate?: string;   // earliest valid visit date (agreement start / today)
  maxDate?: string;   // latest valid visit date (agreement term end)
}) {
  const c = config;
  const set = (patch: Partial<CustomVisitConfig>) => { if (c) onChange({ ...c, ...patch }); };

  return (
    <div className="rounded-xl p-3 space-y-3" style={cardStyle}>
      <p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>
        What kind of custom visit schedule do you need?
      </p>
      <div className="grid grid-cols-2 gap-2">
        {CUSTOM_VISIT_RULE_TYPES.map(rt => (
          <RuleCard key={rt.type} selected={c?.ruleType === rt.type} title={rt.title} desc={rt.desc}
            onClick={() => onChange(defaultCustomVisit(rt.type))} />
        ))}
      </div>

      {c && (
        <div className="space-y-3 pt-1">
          {c.ruleType === "fixed_per_year" && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <Mini label="Visits per year"><NumberStepper size="sm" min={1} value={String(c.visitsPerYear ?? 1)} onChange={v => set({ visitsPerYear: parseInt(v) || 1 })} /></Mini>
              </div>
              <WindowEditor windows={c.windows ?? []} onChange={w => set({ windows: w })} />
            </>
          )}

          {c.ruleType === "every_x" && (
            <div className="grid grid-cols-2 gap-3">
              <Mini label="Repeat every"><NumberStepper size="sm" min={1} value={String(c.intervalCount ?? 1)} onChange={v => set({ intervalCount: parseInt(v) || 1 })} /></Mini>
              <Mini label="Unit"><UiSelect size="sm" value={c.intervalUnit ?? "weeks"} onChange={u => set({ intervalUnit: u as IntervalUnit })} options={INTERVAL_UNIT_OPTIONS} /></Mini>
            </div>
          )}

          {c.ruleType === "specific_months" && (
            <Mini label="Visit months">
              <div className="flex flex-wrap gap-1.5">
                {MONTH_LABELS.map((m, i) => {
                  const mo = i + 1;
                  const on = c.months?.includes(mo);
                  return (
                    <button key={m} type="button"
                      onClick={() => set({ months: on ? (c.months ?? []).filter(x => x !== mo) : [...(c.months ?? []), mo] })}
                      className="px-2.5 py-1 rounded-lg text-xs font-medium transition-colors"
                      style={{
                        border: `1px solid ${on ? "#0f8578" : "var(--border)"}`,
                        backgroundColor: on ? "var(--accent-soft-bg)" : "var(--bg-surface)",
                        color: on ? "var(--accent-text-strong)" : "var(--text-secondary)",
                      }}>{m}</button>
                  );
                })}
              </div>
            </Mini>
          )}

          {c.ruleType === "specific_dates" && (
            <DateEditor dates={c.dates ?? []} onChange={d => set({ dates: d })} minDate={minDate} maxDate={maxDate} />
          )}

          {c.ruleType === "on_demand_allowance" && (
            <div className="grid grid-cols-2 gap-3">
              <Mini label="Max visits per year"><NumberStepper size="sm" min={1} value={String(c.visitsPerYear ?? 1)} onChange={v => set({ visitsPerYear: parseInt(v) || 1 })} /></Mini>
            </div>
          )}

          <RuleSummary text={summarizeCustomVisit(c)} />
        </div>
      )}
    </div>
  );
}

// Optional named seasonal windows (e.g. "Spring Tune-Up" spanning Mar–May).
function WindowEditor({ windows, onChange }: { windows: CustomVisitWindow[]; onChange: (w: CustomVisitWindow[]) => void }) {
  const upd = (id: string, patch: Partial<CustomVisitWindow>) => onChange(windows.map(w => w.id === id ? { ...w, ...patch } : w));
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Seasonal windows (optional)</span>
        <button type="button" onClick={() => onChange([...windows, newVisitWindow(`Window ${windows.length + 1}`)])}
          className="flex items-center gap-1 text-xs font-medium" style={{ color: "var(--accent-text)" }}><Plus className="w-3.5 h-3.5" /> Add window</button>
      </div>
      {windows.map(w => (
        <div key={w.id} className="flex items-end gap-2">
          <div className="flex-1 min-w-0"><Mini label="Name"><TextInput value={w.label} onChange={e => upd(w.id, { label: e.target.value })} placeholder="e.g. Spring Tune-Up" /></Mini></div>
          <div className="w-24 shrink-0"><Mini label="From"><UiSelect size="sm" value={String(w.startMonth)} onChange={v => upd(w.id, { startMonth: parseInt(v) })} options={MONTH_OPTIONS} /></Mini></div>
          <div className="w-24 shrink-0"><Mini label="To"><UiSelect size="sm" value={String(w.endMonth)} onChange={v => upd(w.id, { endMonth: parseInt(v) })} options={MONTH_OPTIONS} /></Mini></div>
          <button type="button" onClick={() => onChange(windows.filter(x => x.id !== w.id))} className="p-1.5 mb-0.5 rounded-lg hover:bg-red-50 shrink-0" style={{ color: "#9ca3af" }} title="Remove"><Trash2 className="w-3.5 h-3.5" /></button>
        </div>
      ))}
    </div>
  );
}

function DateEditor({ dates, onChange, minDate, maxDate }: { dates: string[]; onChange: (d: string[]) => void; minDate?: string; maxDate?: string }) {
  const outOfRange = (d: string) => !!d && ((minDate && d < minDate) || (maxDate && d > maxDate));
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Visit dates</span>
        <button type="button" onClick={() => onChange([...dates, ""])}
          className="flex items-center gap-1 text-xs font-medium" style={{ color: "var(--accent-text)" }}><Plus className="w-3.5 h-3.5" /> Add date</button>
      </div>
      {dates.length === 0 && <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>No dates yet.</p>}
      {dates.map((d, i) => (
        <div key={i}>
          <div className="flex items-center gap-2">
            <div className="flex-1"><DatePicker value={d} onChange={v => onChange(dates.map((x, j) => j === i ? v : x))} placeholder="Pick a date" min={minDate} max={maxDate} /></div>
            <button type="button" onClick={() => onChange(dates.filter((_, j) => j !== i))} className="p-1.5 rounded-lg hover:bg-red-50 shrink-0" style={{ color: "#9ca3af" }} title="Remove"><Trash2 className="w-3.5 h-3.5" /></button>
          </div>
          {outOfRange(d) && <p className="text-[11px] mt-1" style={{ color: "#dc2626" }}>Date must be within the agreement term (no past dates).</p>}
        </div>
      ))}
      {(minDate || maxDate) && <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>Dates are limited to the agreement term — past dates and dates after the term aren&apos;t allowed.</p>}
    </div>
  );
}
