"use client";

// ─── Visit details panel ──────────────────────────────────
// What opens when a dispatcher clicks a card on the dispatch board. The card is
// a VISIT (appointment) tied to a work order and job — so the panel leads with
// the visit, then walks the chain: blocker → appointment → customer → technician
// → visit scope → work order progress → related job → activity → notes.
// Laid out as scannable container blocks (same language as the inbox right rail).
// One status-based primary action at the bottom; destructive actions live in a
// "More" menu with Cancel Visit vs Cancel Job clearly separated.

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  X, Clock, MapPin, CheckCircle, Circle, Briefcase, User, Tag,
  AlertTriangle, FileText, Link2, Phone, MessageSquare, Mail, Navigation,
  Camera, Package, Truck, Send, Ban,
} from "lucide-react";
import StatusBadge from "@/components/shared/StatusBadge";
import ActionsMenu, { type ActionItem } from "@/components/shared/ActionsMenu";
import {
  getWorkOrder, getWorkOrderById, getJob, updateJob, resolveJobStatus,
  type Job, type JobStatus,
} from "@/lib/jobs/data";
import { getCustomer } from "@/lib/customers/data";
import { getQuotesForJob, getAllInvoices } from "@/lib/quotes/data";
import { getActivityEvents } from "@/lib/activity/data";
import { getJobPhotoChecklist, checklistProgress } from "@/lib/files/checklist";
import { getJobMaterials } from "@/lib/mobile/materials";
import { getAppointment, updateAppointment } from "@/lib/appointments/data";
import { getLiveLocation, trackStateFor, TRACK_STATE_META } from "@/lib/tech-tracking/data";
import { getJobStatuses, jobTypeLabel } from "@/lib/job-config/data";
import { todayYMD } from "@/lib/utils/schedule";
import {
  jobStatusToLane,
  type CalendarItem, type UnscheduledItem,
} from "@/lib/calendar/types";

function fmtTime(d: Date): string { return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }); }
function fmtDate(d: Date): string { return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }); }
function fmtDuration(min: number): string { return min >= 60 ? `${Math.floor(min / 60)}h${min % 60 ? ` ${min % 60}m` : ""}` : `${min}m`; }

// Blocker explanations per blocked status.
const BLOCKERS: Partial<Record<JobStatus, { label: string; body: string; resume: string; to: JobStatus }>> = {
  waiting_on_parts: {
    label: "Waiting on parts",
    body: "This visit can't be completed until the required parts are available.",
    resume: "Mark parts received", to: "scheduled",
  },
  waiting_on_customer: {
    label: "Waiting on customer",
    body: "Progress is blocked until the customer responds or approves.",
    resume: "Customer responded — resume", to: "scheduled",
  },
  waiting_on_approval: {
    label: "Waiting on approval",
    body: "Work is on hold until the estimate or change is approved.",
    resume: "Approved — resume", to: "scheduled",
  },
};

// The dispatcher's one clear next step per job status.
function dispatchPrimary(status: JobStatus): { label: string; to?: JobStatus; icon: React.ElementType } | null {
  switch (status) {
    case "new":
    case "scheduled":   return { label: "Dispatch · send tech en route", to: "en_route", icon: Truck };
    case "en_route":    return { label: "Arrived · start work", to: "in_progress", icon: Navigation };
    case "in_progress": return { label: "Complete visit", to: "completed", icon: CheckCircle };
    case "waiting_on_parts":    return { label: "Mark parts received", to: "scheduled", icon: Package };
    case "waiting_on_customer": return { label: "Resume visit", to: "scheduled", icon: Send };
    case "waiting_on_approval": return { label: "Approved — resume", to: "scheduled", icon: Send };
    case "completed":   return { label: "Create invoice", icon: FileText };
    default:            return null;
  }
}

export default function CalendarItemDrawer({
  scheduled, unscheduled, onClose, onSchedule,
}: {
  scheduled?: CalendarItem;
  unscheduled?: UnscheduledItem;
  /** Kept for API compatibility with the board; reassignment now happens on the
   *  board itself (drag between lanes), not in this panel. */
  technicians?: string[];
  onClose: () => void;
  onReassign?: (tech: string) => void;
  onSchedule?: () => void;
}) {
  const [tick, setTick] = useState(0);
  const item = scheduled ?? unscheduled!;
  const isScheduled = !!scheduled;

  // Enter/exit animation: mount hidden → rAF flips `visible` on (slide in); close
  // slides out first, then unmounts via onClose after the transition.
  const [visible, setVisible] = useState(false);
  const reduce = useRef(false);
  useEffect(() => {
    reduce.current = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const id = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(id);
  }, []);
  const requestClose = () => {
    if (reduce.current) { onClose(); return; }
    setVisible(false);
    setTimeout(onClose, 300);
  };

  // ── Resolve the chain: visit → work order → job → customer ──
  const jobId = scheduled?.jobId ?? (scheduled?.sourceModule === "jobs" ? scheduled.sourceId : undefined);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- tick re-reads after status changes
  const job = useMemo(() => (isScheduled && jobId ? getJob(jobId) : undefined), [jobId, isScheduled, tick]);
  const appointment = scheduled?.sourceModule === "appointments" ? getAppointment(scheduled.sourceId) : undefined;
  const wo = isScheduled
    ? (scheduled!.workOrderId ? getWorkOrderById(scheduled!.workOrderId)
       : (scheduled!.sourceModule === "jobs" && scheduled!.type === "job" ? getWorkOrder(scheduled!.sourceId) : undefined))
    : undefined;
  const customer = job ? getCustomer(job.accountId) : undefined;
  const jobStatus = job ? resolveJobStatus(job.status, getJobStatuses().filter(s => s.active)) : null;
  const lane = job ? jobStatusToLane(job.status) : undefined;
  const blocker = job ? BLOCKERS[job.status] : undefined;

  // Work-order signals (only rendered when they exist — never "0% · 0/0").
  const checklistDone = wo?.checklist.filter(c => c.isComplete).length ?? 0;
  const checklistTotal = wo?.checklist.length ?? 0;
  const photoChecklist = job ? getJobPhotoChecklist(job.id, job.type) : [];
  const photoProg = checklistProgress(photoChecklist);
  const materials = job ? getJobMaterials(job.id) : [];

  // Related-job billing context.
  const quotes = jobId ? getQuotesForJob(jobId) : [];
  const invoices = jobId ? getAllInvoices().filter(i => i.jobId === jobId) : [];
  const activity = job ? getActivityEvents(job.accountId).slice(0, 5) : [];

  const mapsHref = (scheduled?.address ?? unscheduled?.address)
    ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent((scheduled?.address ?? unscheduled?.address)!)}`
    : undefined;

  // Status transitions stamp the same lifecycle times the mobile app writes.
  function setStatus(to: JobStatus) {
    if (!job) return;
    const now = new Date().toISOString();
    const stamp: Partial<Job> =
      to === "en_route"    ? { enRouteAt: now } :
      to === "in_progress" ? { startedAt: now } :
      to === "completed"   ? { completedAt: now, completedDate: todayYMD() } : {};
    updateJob(job.id, { status: to, ...stamp });
    setTick(t => t + 1);
  }

  function cancelVisit() {
    if (appointment) updateAppointment(appointment.id, { status: "canceled" });
    else if (job) updateJob(job.id, { status: "canceled" });
    requestClose();
  }
  function cancelJob() {
    if (job) updateJob(job.id, { status: "canceled" });
    requestClose();
  }

  const primary = job ? dispatchPrimary(job.status) : null;
  const techName = scheduled?.assignedTo;
  const techLoc = techName ? getLiveLocation(techName) : undefined;
  const track = trackStateFor(techLoc);

  // Every secondary/nav + destructive action lives in the top-right 4-dot menu,
  // so the cards stay pure information and the bottom is a single clear CTA.
  const menuActions: (ActionItem | false)[] = [
    !!job && { label: "Open Job", icon: Briefcase, href: `/jobs/${job.id}` },
    !!wo && { label: "Open Work Order", icon: FileText, href: `/work-orders/${wo.id}` },
    !!customer && { label: "Open Customer", icon: User, href: `/customers/${customer.id}` },
    !!customer?.phone && { label: "Message Customer", icon: MessageSquare, href: `sms:${customer.phone}` },
    !!appointment && { label: "Cancel Visit", icon: Ban, danger: true, separated: true, onClick: cancelVisit },
    !!job && { label: "Cancel Job", icon: Ban, danger: true, separated: !appointment, onClick: cancelJob },
  ];

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40" onClick={requestClose}
        style={{ opacity: visible ? 1 : 0, transition: "opacity 0.3s ease" }} />
      <div className="fixed inset-y-0 right-0 z-50 flex flex-col w-[460px] max-w-full"
        style={{
          backgroundColor: "var(--bg-page)", borderLeft: "1px solid var(--border)", boxShadow: "-4px 0 24px rgba(0,0,0,0.18)",
          transform: visible ? "translateX(0)" : "translateX(100%)",
          transition: "transform 0.34s cubic-bezier(0.22, 1, 0.36, 1)",
        }}>

        {/* ── Header: visit summary ── */}
        <div className="shrink-0 px-5 pt-4 pb-4" style={{ backgroundColor: "var(--bg-surface)", borderBottom: "1px solid var(--border)" }}>
          <div className="flex items-center justify-between mb-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
              {isScheduled ? "Visit Details" : "Unscheduled Item"}
            </p>
            <button onClick={requestClose} aria-label="Close" className="w-9 h-9 rounded-lg flex items-center justify-center transition-colors hover:bg-[var(--bg-surface-2)]" style={{ color: "var(--text-muted)" }}><X className="w-4 h-4" /></button>
          </div>
          <h2 className="text-base font-semibold leading-snug" style={{ color: "var(--text-primary)" }}>
            {scheduled?.workOrderTitle ?? item.title}
          </h2>
          {item.customerName && <p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>{item.customerName}</p>}
          {scheduled?.visitCount && scheduled.visitCount > 1 && (
            <p className="inline-flex items-center gap-1 text-xs mt-1.5" style={{ color: "var(--accent-text)" }}>
              <Link2 className="w-3 h-3" /> Visit {scheduled.visitIndex} of {scheduled.visitCount} · same job
            </p>
          )}
          {/* Status chip (left, in line) + the 4-dot menu (right, below the X). */}
          <div className="mt-3 flex items-center justify-between gap-2 min-h-[36px]">
            <div>
              {jobStatus ? (
                <StatusPill label={jobStatus.label} color={jobStatus.color} />
              ) : !isScheduled ? (
                <StatusPill label="Unscheduled" color="#f59e0b" />
              ) : null}
            </div>
            {isScheduled && menuActions.some(Boolean) && <ActionsMenu actions={menuActions} />}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3.5">
          {/* ── Blocker — never buried ── */}
          {blocker && lane === "blocked" && (
            <div className="rounded-xl p-4" style={{ backgroundColor: "#78350f1e", border: "1px solid #b4530966" }}>
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" style={{ color: "#f59e0b" }} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>Blocked · {blocker.label}</p>
                  <p className="text-xs mt-1 leading-relaxed" style={{ color: "var(--text-secondary)" }}>{blocker.body}</p>
                </div>
              </div>
            </div>
          )}

          {/* ── Appointment ── */}
          {isScheduled ? (
            <Block title="Appointment">
              <Row icon={Clock} label="Scheduled" value={scheduled!.allDay ? `${fmtDate(scheduled!.start)} · All day` : `${fmtDate(scheduled!.start)} · ${fmtTime(scheduled!.start)}–${fmtTime(scheduled!.end)}`} />
              <Row icon={Tag} label="Duration" value={fmtDuration(scheduled!.durationMinutes)} />
              {(scheduled!.address ?? scheduled!.city) && (
                <Row icon={MapPin} label="Location"
                  value={mapsHref
                    ? <a href={mapsHref} target="_blank" rel="noreferrer" style={{ color: "var(--accent-text)" }}>{scheduled!.address ?? scheduled!.city!}</a>
                    : (scheduled!.address ?? scheduled!.city!)} />
              )}
            </Block>
          ) : (
            <Block title="Scheduling">
              <Row icon={Clock} label="Preferred" value={unscheduled!.preferredDate ?? "No preference"} />
              <Row icon={Clock} label="Est. duration" value={fmtDuration(unscheduled!.durationMinutes)} />
              <Row icon={AlertTriangle} label="In queue because" value={unscheduled!.reason} />
              {unscheduled!.value && <Row icon={FileText} label="Value" value={unscheduled!.value} />}
              {(unscheduled!.address ?? unscheduled!.city) && <Row icon={MapPin} label="Location" value={unscheduled!.address ?? unscheduled!.city!} />}
            </Block>
          )}

          {/* ── Customer contact ── */}
          {(customer || item.customerName) && (
            <Block title="Customer">
              <Row icon={User} label="Name" value={customer?.name ?? item.customerName!} />
              {customer?.phone && <Row icon={Phone} label="Phone" value={customer.phone} />}
              {customer?.email && <Row icon={Mail} label="Email" value={customer.email} />}
            </Block>
          )}

          {/* ── Technician + visit scope (combined) ── */}
          {isScheduled && (
            <Block title="Technician & scope">
              {techName ? (
                <div className="flex items-center gap-2.5">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: TRACK_STATE_META[track].color }} />
                  <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{techName}</span>
                  <span className="ml-auto text-[11px]" style={{ color: TRACK_STATE_META[track].color }}>{TRACK_STATE_META[track].label}</span>
                </div>
              ) : (
                <p className="text-sm" style={{ color: "var(--text-muted)" }}>Unassigned</p>
              )}

              <div className="pt-1 space-y-2.5" style={{ borderTop: "1px solid var(--border)" }}>
                <p className="text-[10px] font-semibold uppercase tracking-wider pt-2.5" style={{ color: "var(--text-muted)" }}>Visit scope</p>
                {wo?.instructions ? (
                  <p className="text-sm leading-relaxed whitespace-pre-line" style={{ color: "var(--text-primary)" }}>{wo.instructions}</p>
                ) : scheduled?.description ? (
                  <p className="text-sm leading-relaxed whitespace-pre-line" style={{ color: "var(--text-primary)" }}>{scheduled.description}</p>
                ) : (
                  <p className="text-sm" style={{ color: "var(--text-muted)" }}>No scope written for this visit yet.</p>
                )}
                {wo && wo.checklist.length > 0 && (
                  <div className="space-y-1.5">
                    {wo.checklist.slice(0, 6).map(c => (
                      <div key={c.id} className="flex items-center gap-2">
                        {c.isComplete ? <CheckCircle className="w-3.5 h-3.5 shrink-0 text-emerald-500" /> : <Circle className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--text-muted)" }} />}
                        <span className="text-xs" style={{ color: c.isComplete ? "var(--text-muted)" : "var(--text-primary)", textDecoration: c.isComplete ? "line-through" : "none" }}>{c.label}</span>
                      </div>
                    ))}
                    {wo.checklist.length > 6 && <p className="text-xs pl-5" style={{ color: "var(--text-muted)" }}>+{wo.checklist.length - 6} more</p>}
                  </div>
                )}
              </div>
            </Block>
          )}

          {/* ── Work order progress — only meaningful numbers ── */}
          {wo && (
            <Block title="Work order">
              <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{wo.title}</p>
              {checklistTotal > 0 ? (
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs" style={{ color: "var(--text-secondary)" }}>Checklist</span>
                    <span className="text-xs font-bold" style={{ color: checklistDone === checklistTotal ? "#10b981" : "var(--text-secondary)" }}>{checklistDone} of {checklistTotal} complete</span>
                  </div>
                  <div className="h-1.5 rounded-full" style={{ backgroundColor: "var(--bg-input)" }}>
                    <div className="h-1.5 rounded-full" style={{ width: `${Math.round((checklistDone / checklistTotal) * 100)}%`, backgroundColor: checklistDone === checklistTotal ? "#10b981" : "#4f46e5" }} />
                  </div>
                </div>
              ) : (
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>No checklist assigned yet</p>
              )}
              {photoProg.total > 0 && (
                <p className="text-xs flex items-center gap-1.5" style={{ color: "var(--text-secondary)" }}>
                  <Camera className="w-3.5 h-3.5" style={{ color: "var(--text-muted)" }} /> Required photos: {photoProg.done} of {photoProg.total} uploaded
                </p>
              )}
              <p className="text-xs flex items-center gap-1.5" style={{ color: "var(--text-secondary)" }}>
                <Package className="w-3.5 h-3.5" style={{ color: "var(--text-muted)" }} />
                {materials.length > 0 ? `Materials: ${materials.length} logged` : "Materials: none added"}
              </p>
            </Block>
          )}

          {/* ── Related job — context, not the full record ── */}
          {job && (
            <Block title="Related job">
              <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{job.title}</p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                <Mini label="Status" value={jobStatus ? <StatusBadge label={jobStatus.label} color={jobStatus.color} /> : "—"} />
                <Mini label="Type" value={jobTypeLabel(job.type)} />
                {scheduled?.visitCount && <Mini label="Visits" value={`${scheduled.visitIndex ?? 1} of ${scheduled.visitCount}`} />}
                <Mini label="Estimate" value={quotes.length ? `${quotes.length} · ${quotes[0].status.replace(/_/g, " ")}` : "Not sent"} />
                <Mini label="Invoice" value={invoices.length ? `${invoices.length} · ${invoices[0].status.replace(/_/g, " ")}` : "Not created"} />
              </div>
            </Block>
          )}

          {/* ── Recent activity ── */}
          {activity.length > 0 && (
            <Block title="Recent activity">
              <div className="space-y-2">
                {activity.map(e => (
                  <div key={e.id} className="flex items-start gap-2.5">
                    <span className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0" style={{ backgroundColor: "var(--accent-icon)" }} />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium truncate" style={{ color: "var(--text-primary)" }}>{e.title}</p>
                      <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>{e.displayDate}</p>
                    </div>
                  </div>
                ))}
              </div>
            </Block>
          )}

          {/* ── Notes — internal clearly marked ── */}
          {(customer?.notes || job?.description || (!isScheduled && unscheduled?.description)) && (
            <Block title="Notes">
              {customer?.notes && (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider mb-1 flex items-center gap-1.5" style={{ color: "var(--text-muted)" }}>
                    Internal <span className="px-1.5 py-0.5 rounded-full normal-case tracking-normal" style={{ backgroundColor: "#78350f2e", color: "#f59e0b" }}>Team only</span>
                  </p>
                  <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>{customer.notes}</p>
                </div>
              )}
              {job?.description && (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: "var(--text-muted)" }}>Job notes</p>
                  <p className="text-sm leading-relaxed whitespace-pre-line" style={{ color: "var(--text-primary)" }}>{job.description}</p>
                </div>
              )}
              {!isScheduled && unscheduled?.description && (
                <p className="text-sm leading-relaxed whitespace-pre-line" style={{ color: "var(--text-primary)" }}>{unscheduled.description}</p>
              )}
            </Block>
          )}
        </div>

        {/* ── Bottom action bar: one clear primary action ── */}
        {(( !isScheduled && onSchedule) || primary) && (
          <div className="px-4 py-3.5 shrink-0" style={{ backgroundColor: "var(--bg-surface)", borderTop: "1px solid var(--border)" }}>
            {!isScheduled && onSchedule ? (
              <button onClick={onSchedule} className="w-full px-3 py-2.5 rounded-lg text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors">
                Schedule
              </button>
            ) : primary ? (
              primary.to ? (
                <button onClick={() => setStatus(primary.to!)} className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors">
                  <primary.icon className="w-4 h-4" /> {primary.label}
                </button>
              ) : (
                <Link href="/invoices" className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors">
                  <primary.icon className="w-4 h-4" /> {primary.label}
                </Link>
              )
            ) : null}
          </div>
        )}
      </div>
    </>
  );
}

// ─── Building blocks ──────────────────────────────────────
// A titled container card — icon-less header, generous spacing, dashboard outline.
function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)" }}>
      <p className="px-4 pt-3.5 pb-1 text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>{title}</p>
      <div className="px-4 pb-4 pt-1.5 space-y-3">{children}</div>
    </div>
  );
}

// The contained status chip with an inner dot — the jobs-section pill style.
function StatusPill({ label, color }: { label: string; color: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-md" style={{ backgroundColor: color + "22", color }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />{label}
    </span>
  );
}

function Row({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2.5">
      <Icon className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: "var(--text-muted)" }} />
      <div className="min-w-0">
        <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>{label}</p>
        <div className="text-sm" style={{ color: "var(--text-primary)" }}>{value}</div>
      </div>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>{label}</p>
      <div className="text-xs mt-0.5 capitalize" style={{ color: "var(--text-primary)" }}>{value}</div>
    </div>
  );
}

