"use client";

// ─── Schedule a return visit ──────────────────────────────
// A second (or third…) visit on the SAME job — e.g. a part was back-ordered.
// Creates a NEW work order + a NEW appointment under the job (addReturnVisit),
// leaving the first visit's record intact, and reflects the upcoming visit on
// the job. The job's status is left as-is (it stays "on hold" until the tech
// starts the return).
//
// Two entry points:
//   • From a job detail — `job` is passed, so it's pre-tied to that job.
//   • From the dispatch board "+" — no `job`, so a picker requires you to tie
//     the return to an existing job (and it always creates the work order).

import { resolveDispatchSettings } from "@/lib/calendar/settings";
import { useMemo, useState, type CSSProperties } from "react";
import { X, AlertTriangle, Info } from "lucide-react";
import DatePicker from "@/components/ui/DatePicker";
import TimePicker from "@/components/ui/TimePicker";
import Select from "@/components/ui/Select";
import SearchSelect from "@/components/ui/SearchSelect";
import NumberStepper from "@/components/ui/NumberStepper";
import { getTechnicianNames, initialsOf } from "@/lib/users/data";
import { getAllJobs, getJob, updateJob, type Job } from "@/lib/jobs/data";
import { jobTypeLabel } from "@/lib/job-config/data";
import { VISIT_TYPE_CONFIG, RETURN_VISIT_TYPES, type VisitType } from "@/lib/appointments/data";
import { addReturnVisit, canAddVisit, latestVisitEndMs } from "@/lib/jobs/serviceCall";
import { minTimeFor, minBookableYMD } from "@/lib/utils/schedule";

const HOLD = new Set(["waiting_on_parts", "waiting_on_customer", "waiting_on_approval"]);
const pad = (n: number) => String(n).padStart(2, "0");

export default function ReturnVisitModal({ job: jobProp, onClose, onScheduled }: {
  job?: Job | null;
  onClose: () => void;
  onScheduled?: (jobId: string) => void;
}) {
  const techs = getTechnicianNames();
  // Board flow: only ELIGIBLE jobs (guarded) — on-hold jobs first (likely returns).
  const pickable = useMemo(() => jobProp ? [] : getAllJobs()
    .filter(j => canAddVisit(j).allowed)
    .sort((a, b) => (HOLD.has(b.status) ? 1 : 0) - (HOLD.has(a.status) ? 1 : 0) || a.customerName.localeCompare(b.customerName)),
    [jobProp]);
  const [jobId, setJobId] = useState(jobProp?.id ?? "");
  const job = jobProp ?? (jobId ? getJob(jobId) : undefined);
  const guard = job ? canAddVisit(job) : null;
  // Completed/invoiced jobs reopen as a callback — default the type accordingly.
  const jobPropGuard = jobProp ? canAddVisit(jobProp) : null;

  const [visitType, setVisitType] = useState<VisitType>(jobPropGuard && jobPropGuard.allowed && jobPropGuard.reopens ? "callback" : "return");
  const [title, setTitle] = useState("Return visit");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [duration, setDuration] = useState(jobProp?.durationMinutes || 120);
  // Times/durations step in the dispatch-board slot size for this job's scope.
  const increment = resolveDispatchSettings(job?.companyId, job?.locationId).hourly.increment;
  const [tech, setTech] = useState(jobProp?.assignedTo || techs[0] || "");
  const [instructions, setInstructions] = useState("");

  // A new visit must start strictly AFTER the job's latest visit ends. The anchor
  // is the job's own schedule OR its latest appointment — so this holds whether
  // the first visit is a plain job schedule or a materialized appointment, and it
  // naturally supports planning ahead (schedule visit 1, then book visit 2).
  // Space separator parses both the job's display-format schedule and ISO dates.
  const toMs = (d: string, t: string) => new Date(`${d} ${t || "00:00"}`).getTime();
  const anchorEnd = useMemo(() => (job ? latestVisitEndMs(job) : 0), [job?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const startMs = date && time ? toMs(date, time) : NaN;
  const fmtWhen = (ms: number) => new Date(ms).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

  // Block out unselectable times: today's past slots AND (when the previous visit
  // ends on the SAME day being booked) any slot at/before that end.
  const minTime = useMemo(() => {
    const floors = [minTimeFor(date)];
    if (date && anchorEnd) {
      const a = new Date(anchorEnd);
      const aymd = `${a.getFullYear()}-${pad(a.getMonth() + 1)}-${pad(a.getDate())}`;
      if (aymd === date) floors.push(`${pad(a.getHours())}:${pad(a.getMinutes())}`);
    }
    return floors.filter(Boolean).sort().pop() as string | undefined;
  }, [date, anchorEnd]);

  let timeError: string | null = null;
  if (date && time) {
    if (!Number.isFinite(startMs)) timeError = "Pick a valid date and time.";
    else if (startMs < Date.now() - 60_000) timeError = "That time is in the past.";
    else if (anchorEnd && startMs < anchorEnd) timeError = `Must start after the previous visit ends (${fmtWhen(anchorEnd)}).`;
  }
  const valid = !!job && !!guard?.allowed && !!title.trim() && !!date && !!time && !timeError;

  const schedule = () => {
    if (!job || !guard || !guard.allowed || !valid) return;
    addReturnVisit(job.id, {
      workOrderTitle: title.trim(),
      instructions: instructions.trim() || undefined,
      visitType,
      scheduledDate: date, scheduledTime: time, durationMinutes: duration,
      techIds: tech ? [tech] : [],
    });
    // Keep the job's headline schedule on the EARLIEST upcoming visit: if the job
    // already has a future primary visit (planned-ahead case), leave it; otherwise
    // this return becomes the next visit. A completed/invoiced job reopens.
    const curMs = job.scheduledDate ? toMs(job.scheduledDate, job.scheduledTime) : NaN;
    const keepHeadline = Number.isFinite(curMs) && curMs > Date.now();
    updateJob(job.id, {
      ...(keepHeadline ? {} : { scheduledDate: date, scheduledTime: time, assignedTo: tech, assignedToInitials: tech ? initialsOf(tech) : "" }),
      ...(guard.reopens ? { status: "scheduled" as const } : {}),
    });
    onScheduled?.(job.id);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl overflow-hidden" onClick={e => e.stopPropagation()} style={{ backgroundColor: "var(--bg-surface)", boxShadow: "0 24px 64px rgba(0,0,0,0.4)" }}>
        <div className="flex items-center gap-2.5 px-5 py-4" style={{ borderBottom: "1px solid var(--border)" }}>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Schedule return visit</p>
            <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>Creates a new work order + appointment on the job — the first visit stays intact.</p>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-md flex items-center justify-center hover:bg-[var(--bg-surface-2)]" style={{ color: "var(--text-muted)" }}><X className="w-4 h-4" /></button>
        </div>

        <div className="p-5 space-y-3">
          {/* Board flow: tie the return to an existing job — searchable, since a
              busy shop can have hundreds of open jobs. */}
          {!jobProp && (
            <Field label="Job">
              <SearchSelect size="sm" value={jobId} onChange={setJobId}
                placeholder="Select the job this is a return for…"
                searchPlaceholder="Search jobs by customer or title…"
                emptyText="No open jobs match."
                options={pickable.map(j => ({
                  value: j.id,
                  label: `${j.customerName} — ${j.title}`,
                  sublabel: `${jobTypeLabel(j.type)}${HOLD.has(j.status) ? " · on hold" : ""}${j.propertyAddress ? ` · ${j.propertyAddress}` : ""}`,
                  keywords: `${j.status} ${j.propertyAddress ?? ""}`,
                }))} />
            </Field>
          )}
          {jobProp && <p className="text-xs" style={{ color: "var(--text-muted)" }}>Return for <span className="font-medium" style={{ color: "var(--text-secondary)" }}>{jobProp.customerName} — {jobProp.title}</span></p>}

          {/* Guard feedback: blocked (can't add), or a heads-up that a done job reopens. */}
          {job && guard && !guard.allowed && (
            <div className="flex items-start gap-2 rounded-lg px-3 py-2" style={{ backgroundColor: "#fef2f2", border: "1px solid #fecaca" }}>
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: "#dc2626" }} />
              <p className="text-[11px]" style={{ color: "#991b1b" }}>{guard.reason}</p>
            </div>
          )}
          {job && guard && guard.allowed && guard.reopens && (
            <div className="flex items-start gap-2 rounded-lg px-3 py-2" style={{ backgroundColor: "#eff6ff", border: "1px solid #bfdbfe" }}>
              <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: "#2563eb" }} />
              <p className="text-[11px]" style={{ color: "#1e40af" }}>This job is completed — scheduling a visit will <span className="font-medium">reopen</span> it as a callback.</p>
            </div>
          )}

          <Field label="Visit type">
            <Select size="sm" value={visitType} onChange={v => setVisitType(v as VisitType)}
              options={RETURN_VISIT_TYPES.map(t => ({ value: t, label: VISIT_TYPE_CONFIG[t].label }))} />
          </Field>
          <Field label="Work order for this visit">
            <input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Install compressor (back-ordered part)" className={inp} style={inpStyle} autoFocus={!!jobProp} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Date"><DatePicker value={date} onChange={v => setDate(v || "")} min={minBookableYMD()} clearable={false} /></Field>
            <Field label="Time"><TimePicker value={time} onChange={setTime} minTime={minTime} minuteStep={increment} /></Field>
          </div>
          {timeError
            ? <p className="text-xs" style={{ color: "#dc2626" }}>{timeError}</p>
            : (anchorEnd > 0 && <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>Earliest available: after {fmtWhen(anchorEnd)} (the previous visit).</p>)}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Technician">
              <Select size="sm" value={tech} onChange={setTech}
                options={techs.length === 0 ? [{ value: "", label: "Unassigned" }] : [{ value: "", label: "Unassigned" }, ...techs.map(t => ({ value: t, label: t }))]} />
            </Field>
            <Field label="Duration (min)"><NumberStepper size="sm" min={increment} step={increment} value={String(duration)} onChange={v => setDuration(parseInt(v, 10) || 0)} /></Field>
          </div>
          <Field label="Instructions (optional)"><textarea value={instructions} onChange={e => setInstructions(e.target.value)} rows={2} placeholder="e.g. Bring the ordered compressor; customer prefers mornings." className={`${inp} resize-none`} style={inpStyle} /></Field>
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-3" style={{ borderTop: "1px solid var(--border)" }}>
          <button onClick={onClose} className="text-sm font-medium px-3 py-2 rounded-lg" style={{ color: "var(--text-secondary)" }}>Cancel</button>
          <button onClick={schedule} disabled={!valid} className="text-sm font-semibold px-4 py-2 rounded-lg text-white disabled:opacity-40" style={{ backgroundColor: "#0f8578" }}>Schedule visit</button>
        </div>
      </div>
    </div>
  );
}

const inp = "w-full rounded-lg px-2.5 py-1.5 text-sm outline-none";
const inpStyle: CSSProperties = { border: "1px solid var(--border)", backgroundColor: "var(--bg-surface)", color: "var(--text-primary)" };
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="block text-[11px] font-medium mb-1" style={{ color: "var(--text-secondary)" }}>{label}</label>{children}</div>;
}
