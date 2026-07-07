"use client";

import { useMemo, useState } from "react";
import UiSelect from "@/components/ui/Select";
import NumberStepper from "@/components/ui/NumberStepper";
import { getTemplates as getWorkOrderTemplates } from "@/lib/work-order-templates/data";
import { getBoardsForContext } from "@/lib/calendar/settings";
import { summarizeCustomVisit } from "@/lib/agreements/custom-rules";
import type { UseAgreementDraft } from "./useAgreementDraft";
import CustomVisitBuilder from "./CustomVisitBuilder";
import { SectionHead, SummaryCard, Empty, Field, Mini, TextInput, ToggleRow } from "./ui";

export default function VisitScheduleSection({ d }: { d: UseAgreementDraft }) {
  const [open, setOpen] = useState<string | null>(null);
  const woOptions = useMemo(() => [{ value: "", label: "None" }, ...getWorkOrderTemplates().filter(t => t.active).map(t => ({ value: t.id, label: t.name }))], []);
  const boardOptions = useMemo(() => [{ value: "", label: "Any board" }, ...getBoardsForContext().map(b => ({ value: b.id, label: b.name }))], []);
  const freqName = (key: string) => d.visitRules.find(r => r.key === key)?.name ?? key;

  // Valid window for explicit visit dates: no earlier than the agreement start
  // (and never in the past), no later than the term end.
  const visitBounds = useMemo(() => {
    const toYMD = (dt: Date) => `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
    const parse = (s: string) => { const [y, m, dd] = (s || "").split("-").map(Number); return (y && m && dd) ? new Date(y, m - 1, dd) : null; };
    const start = parse(d.startDate);
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const min = start ? (start > today ? start : today) : today;
    const end = start ? new Date(start.getFullYear(), start.getMonth() + (parseInt(d.termMonths) || 12), start.getDate()) : null;
    return { minDate: toYMD(min), maxDate: end ? toYMD(end) : undefined };
  }, [d.startDate, d.termMonths]);

  return (
    <div>
      <SectionHead title="Visit Schedule" subtitle="When we go — the recurring visits this agreement generates."
        action={
          d.scheduleTemplates.length > 0 ? (
            <div className="w-56">
              <UiSelect size="sm" value="" placeholder="+ Load a schedule…" onChange={(id) => { if (id) d.loadVisitSchedule(id); }}
                options={d.scheduleTemplates.map(t => ({ value: t.id, label: t.name }))} />
            </div>
          ) : undefined
        } />

      <button onClick={() => { d.addVisit(); }} className="text-xs font-medium mb-3" style={{ color: "#0f8578" }}>+ Add a custom visit</button>

      <p className="text-[11px] mb-3" style={{ color: "var(--text-muted)" }}>
        This plan generates <span style={{ color: "var(--accent-text)", fontWeight: 600 }}>{d.generatedVisits.length}</span> visit{d.generatedVisits.length === 1 ? "" : "s"} in the first year.
        Auto-generated visits appear in the dispatch Unscheduled Queue when due; scheduling one creates a single linked Job.
      </p>

      {d.visits.length === 0 ? (
        <Empty>No visits yet. Add the recurring visits this agreement schedules.</Empty>
      ) : (
        <div className="space-y-2.5">
          {d.visits.map(v => (
            <SummaryCard key={v.id} title={v.name || "New visit"}
              meta={v.frequencyKey === "custom" && v.customVisit ? summarizeCustomVisit(v.customVisit) : `${freqName(v.frequencyKey)} · ${v.durationMin}m${v.preferredWindow ? ` · ${v.preferredWindow}` : ""}`}
              badges={[
                { label: v.autoGenerate ? "Auto-generate" : "On-demand", tone: v.autoGenerate ? "accent" : "muted" },
                ...(v.requirePhotos ? [{ label: "Photos", tone: "default" as const }] : []),
                ...(v.requireChecklist ? [{ label: "Checklist", tone: "default" as const }] : []),
              ]}
              expanded={open === v.id} onToggle={() => setOpen(open === v.id ? null : v.id)} onRemove={() => { d.removeVisit(v.id); if (open === v.id) setOpen(null); }}>
              <div className="space-y-3">
                <Field label="Visit Name"><TextInput value={v.name} onChange={e => d.setVisit(v.id, { name: e.target.value })} placeholder="e.g. Spring Tune-up" /></Field>
                <div className="grid grid-cols-2 gap-3">
                  <Mini label="Frequency"><UiSelect size="sm" value={v.frequencyKey} onChange={k => d.setVisit(v.id, { frequencyKey: k })} options={d.visitRules.map(r => ({ value: r.key, label: r.name }))} /></Mini>
                  <Mini label="Job Type Created"><UiSelect size="sm" value={v.jobTypeKey} onChange={k => d.setVisit(v.id, { jobTypeKey: k })} placeholder="None" options={[{ value: "", label: "None" }, ...d.jobTypes.map(j => ({ value: j.key, label: j.name }))]} /></Mini>
                  <Mini label="Preferred Window"><TextInput value={v.preferredWindow} onChange={e => d.setVisit(v.id, { preferredWindow: e.target.value })} placeholder="e.g. Spring" /></Mini>
                  <Mini label="Due Window (± days)"><NumberStepper size="sm" min={0} value={v.dueWindowDays} onChange={v2 => d.setVisit(v.id, { dueWindowDays: v2 })} placeholder="e.g. 14" /></Mini>
                  <Mini label="Est. Duration (min)"><NumberStepper size="sm" min={15} step={15} value={v.durationMin} onChange={v2 => d.setVisit(v.id, { durationMin: v2 })} /></Mini>
                  <Mini label="Work Order Template"><UiSelect size="sm" value={v.workOrderTemplateId} onChange={k => d.setVisit(v.id, { workOrderTemplateId: k })} options={woOptions} /></Mini>
                  <Mini label="Dispatch Board (optional)"><UiSelect size="sm" value={v.dispatchBoardId} onChange={k => d.setVisit(v.id, { dispatchBoardId: k })} options={boardOptions} /></Mini>
                </div>
                {v.frequencyKey === "custom" && (
                  <CustomVisitBuilder config={v.customVisit} onChange={cfg => d.setVisit(v.id, { customVisit: cfg })} minDate={visitBounds.minDate} maxDate={visitBounds.maxDate} />
                )}
                <div className="grid grid-cols-1 gap-2">
                  <ToggleRow label="Auto-generate visit" hint="Create planned visits automatically (otherwise booked on demand)." on={v.autoGenerate} onChange={val => d.setVisit(v.id, { autoGenerate: val })} />
                  <ToggleRow label="Required photos" hint="Technician must capture photos on this visit." on={v.requirePhotos} onChange={val => d.setVisit(v.id, { requirePhotos: val })} />
                  <ToggleRow label="Required checklist" hint="Work-order checklist must be completed." on={v.requireChecklist} onChange={val => d.setVisit(v.id, { requireChecklist: val })} />
                </div>
              </div>
            </SummaryCard>
          ))}
        </div>
      )}
    </div>
  );
}
