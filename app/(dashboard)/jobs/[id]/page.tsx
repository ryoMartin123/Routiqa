"use client";

import React, { use, useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, CheckCircle, Circle, ChevronRight, Phone, MapPin, User, Clock, Calendar, DollarSign, Briefcase, AlertTriangle, ListChecks, Plus, Trash2, Ban, RotateCcw, Info, Repeat, Users, Check, Receipt, CircleDollarSign, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";
import { getJob, updateJob, deleteJob, getWorkOrder, getWorkOrderById, getWorkOrdersForJob, getJobNotes, resolveJobStatus, type JobNoteType, type WorkOrderStatus } from "@/lib/jobs/data";
import { getAppointmentsForJob, VISIT_TYPE_CONFIG, type AppointmentStatus } from "@/lib/appointments/data";
import { useDataVersion } from "@/lib/sync/useDataVersion";
import ReturnVisitModal from "@/components/jobs/ReturnVisitModal";
import { canAddVisit } from "@/lib/jobs/serviceCall";
import WorkOrderWizard from "@/components/jobs/WorkOrderWizard";
import JobPartsCard from "@/components/jobs/JobPartsCard";
import NumberStepper from "@/components/ui/NumberStepper";
import { getJobStatuses, jobTypeLabel } from "@/lib/job-config/data";
import StatusBadge from "@/components/shared/StatusBadge";
import ActionsMenu from "@/components/shared/ActionsMenu";
import DetailActionButton from "@/components/shared/DetailActionButton";
import { getProject } from "@/lib/projects/data";
import { getCustomer } from "@/lib/customers/data";
import { getQuotesForJob, getInvoicesForJob, createInvoiceFromJob, createInvoiceFromJobLedger, createDepositInvoice, getUnappliedDeposits, fmt } from "@/lib/quotes/data";
import { getJobLedger, sumUnbilled } from "@/lib/billing/ledger";
import { usePermissions } from "@/components/providers/PermissionProvider";
import { QUOTE_STATUS_STYLE, INVOICE_STATUS_STYLE } from "@/lib/quotes/types";
import PhotoGallery from "@/components/files/PhotoGallery";
import QuoteTypeChooser from "@/components/quotes/create/QuoteTypeChooser";
import DetailTabs from "@/components/shared/DetailTabs";
import RecordTasks from "@/components/tasks/RecordTasks";
import { JobHistoryList } from "@/components/jobs/JobStatusControl";

const TABS = ["Overview", "Billing", "Work Order", "Visits", "Tasks", "Photos & Files", "Notes", "Customer", "History"];

const WO_STATUS_META: Record<WorkOrderStatus, { label: string; color: string }> = {
  pending:     { label: "Pending",     color: "#9ca3af" },
  in_progress: { label: "In Progress", color: "#f59e0b" },
  completed:   { label: "Completed",   color: "#16a34a" },
};

const HOLD_STATUSES = new Set(["waiting_on_parts", "waiting_on_customer", "waiting_on_approval"]);

const APPT_STATUS_META: Record<AppointmentStatus, { label: string; color: string }> = {
  scheduled:   { label: "Scheduled",   color: "#0891b2" },
  en_route:    { label: "En route",    color: "#2563eb" },
  in_progress: { label: "In progress", color: "#f59e0b" },
  completed:   { label: "Completed",   color: "#16a34a" },
  canceled:    { label: "Canceled",    color: "#9ca3af" },
  no_show:     { label: "No show",     color: "#dc2626" },
};

// ─── Visits tab — every scheduled visit (appointment) on this job ─────────
function VisitsTab({ jobId, onSchedule }: { jobId: string; onSchedule: () => void }) {
  const rev = useDataVersion();
  // Ordered by creation so the numbering is stable (original = 1, return = 2).
  const visits = React.useMemo(
    () => getAppointmentsForJob(jobId).slice().sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id)),
    [jobId, rev],
  );
  // eslint-disable-next-line react-hooks/exhaustive-deps -- rev re-reads after changes
  const canVisit = React.useMemo(() => { const j = getJob(jobId); return j ? canAddVisit(j).allowed : false; }, [jobId, rev]);
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Visits</p>
          <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>Each visit is its own appointment + work order — schedule the next when a job needs another trip.</p>
        </div>
        {canVisit && (
          <button onClick={onSchedule} className="group inline-flex items-center gap-1.5 text-xs font-medium shrink-0 transition-colors" style={{ color: "#4f46e5" }}>
            <span className="w-4 h-4 rounded-full flex items-center justify-center transition-all group-hover:brightness-95" style={{ backgroundColor: "#4f46e51a" }}><Repeat className="w-3 h-3" /></span>
            Schedule return visit
          </button>
        )}
      </div>
      {visits.length === 0 ? (
        <div className="rounded-xl p-8 text-center" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)" }}>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>No visits scheduled yet.</p>
        </div>
      ) : visits.map((v, i) => {
        const wo = getWorkOrderById(v.workOrderId);
        const m = APPT_STATUS_META[v.status];
        const vt = v.visitType ? VISIT_TYPE_CONFIG[v.visitType] : undefined;
        return (
          <div key={v.id} className="rounded-xl p-3.5 flex items-start gap-3" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)" }}>
            <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-[11px] font-bold" style={{ backgroundColor: "var(--accent-soft-bg)", color: "var(--accent-text)" }}>{i + 1}</div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <Link href={`/work-orders/${v.workOrderId}`} className="text-sm font-semibold truncate hover:underline" style={{ color: "var(--text-primary)" }}>{wo?.title || `Visit ${i + 1}`}</Link>
                {vt && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full" style={{ backgroundColor: vt.color + "22", color: vt.color }}>{vt.short}</span>}
                <StatusBadge label={m.label} color={m.color} size="sm" />
              </div>
              <div className="flex items-center gap-3 mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
                <span className="inline-flex items-center gap-1"><Calendar className="w-3 h-3" /> {v.scheduledDate || "Unscheduled"}{v.scheduledTime ? ` · ${v.scheduledTime}` : ""}</span>
                <span className="inline-flex items-center gap-1"><Clock className="w-3 h-3" /> {v.durationMinutes} min</span>
                <span className="inline-flex items-center gap-1"><Users className="w-3 h-3" /> {v.techIds.length ? v.techIds.join(", ") : "Unassigned"}</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

const NOTE_COLORS: Record<JobNoteType, string> = { note: "#6366f1", call: "#10b981", email: "#3b82f6", visit: "#f59e0b" };

// ─── Overview tab ─────────────────────────────────────────
// Same shape as the Agreement / Customer overview tabs: a row of compact summary
// cards, then a snapshot grid — a wide "Job Details" card plus a right column of
// Work Order + Financials cards, with Notes below.
function OverviewTab({ jobId }: { jobId: string }) {
  const job      = getJob(jobId)!;
  const project  = job.projectId ? getProject(job.projectId) : null;
  const wo       = getWorkOrder(jobId);
  const notes    = getJobNotes(jobId);
  const customer = getCustomer(job.accountId);
  const quotes   = getQuotesForJob(jobId);
  const invoices = getInvoicesForJob(jobId);
  const s        = resolveJobStatus(job.status, getJobStatuses().filter(st => st.active));

  const doneItems  = wo?.checklist.filter(i => i.isComplete).length ?? 0;
  const totalItems = wo?.checklist.length ?? 0;
  const pct        = totalItems > 0 ? Math.round((doneItems / totalItems) * 100) : 0;
  const prio       = job.priority === "urgent" || job.priority === "high" ? job.priority : null;
  const mapsHref   = job.propertyAddress
    ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(job.propertyAddress)}`
    : undefined;

  const workOrders = getWorkOrdersForJob(jobId);
  // Visits ordered by creation so numbering is stable (original = 1, return = 2).
  const visits = getAppointmentsForJob(jobId).slice()
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
  const jobStatuses = getJobStatuses();
  const labelOf = (k: string) => jobStatuses.find(st => st.key === k)?.name ?? k;
  const colorOf = (k: string) => jobStatuses.find(st => st.key === k)?.color ?? "#6b7280";
  const activity = [...(job.statusHistory ?? [])].reverse().slice(0, 6);
  const fmtWhen = (iso: string) => { const d = new Date(iso); return isNaN(d.getTime()) ? iso : d.toLocaleDateString("en-US", { month: "short", day: "numeric" }); };

  // Reusable list-card header (title + count) for the fill cards.
  const listHead = (title: string, count: number) => (
    <div className="flex items-center justify-between px-4 py-3 shrink-0" style={{ borderBottom: "1px solid var(--border)" }}>
      <SectionLabel>{title}</SectionLabel>
      {count > 0 && <span className="text-[11px] font-semibold tabular-nums" style={{ color: "var(--text-muted)" }}>{count}</span>}
    </div>
  );

  return (
    <div className="min-h-full flex flex-col gap-4">
      {/* Status + billing summary — replaces the old operational cards (which
          repeated the Job Details card below) with a financial snapshot. */}
      <div className="shrink-0"><JobBillingKpis jobId={jobId} status={{ label: s.label, color: s.color }} /></div>

      {/* Main grid — fills the page; the two columns stay equal height and the
          list cards (Work Orders / Visits) grow to fill, scrolling if long. */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-4 min-h-0">
        {/* Left (2/3): Job Details + Work Orders */}
        <div className="lg:col-span-2 flex flex-col gap-4 min-h-0">
          <Card className="p-4 shrink-0">
            <SectionLabel>Job Details</SectionLabel>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 mt-3">
              <InfoRow icon={Briefcase} label="Type" value={jobTypeLabel(job.type)} />
              <InfoRow icon={Info} label="Status" value={<span style={{ color: s.color, fontWeight: 600 }}>{s.label}</span>} />
              <InfoRow icon={Calendar} label="Scheduled" value={job.scheduledDate ? `${job.scheduledDate}${job.scheduledTime ? ` · ${job.scheduledTime}` : ""}` : "Unscheduled"} />
              <InfoRow icon={Clock} label="Duration" value={`${job.durationMinutes} min`} />
              <InfoRow icon={User} label="Assigned Technician" value={job.assignedTo || "Unassigned"} />
              <InfoRow icon={MapPin} label="Location" value={job.propertyAddress
                ? (mapsHref ? <a href={mapsHref} target="_blank" rel="noreferrer" style={{ color: "var(--accent-text)" }}>{job.propertyAddress}</a> : job.propertyAddress)
                : "—"} />
              {prio && <InfoRow icon={AlertTriangle} label="Priority" value={<span className="capitalize" style={{ color: prio === "urgent" ? "#dc2626" : "#c2410c", fontWeight: 600 }}>{prio}</span>} />}
              <InfoRow icon={User} label="Customer" value={customer
                ? <Link href={`/customers/${customer.id}`} style={{ color: "var(--accent-text)" }}>{customer.name}</Link>
                : job.customerName} />
              {project && <InfoRow icon={Briefcase} label="Project" value={<Link href={`/projects/${project.id}`} style={{ color: "var(--accent-text)" }}>{project.name}</Link>} />}
            </div>
          </Card>

          <Card className="flex-1 min-h-0 flex flex-col overflow-hidden">
            {listHead("Work Orders", workOrders.length)}
            <div className="flex-1 overflow-y-auto thin-scroll-y">
              {workOrders.length === 0 ? (
                <p className="px-4 py-6 text-center text-sm" style={{ color: "var(--text-muted)" }}>No work order created for this job yet.</p>
              ) : workOrders.map((w, i) => (
                <Link key={w.id} href={`/work-orders/${w.id}`} className="flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-[var(--bg-surface-2)]"
                  style={{ borderTop: i > 0 ? "1px solid var(--border)" : "none" }}>
                  <div className="flex items-center gap-2 min-w-0">
                    <ListChecks className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--text-muted)" }} />
                    <span className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>{w.title}</span>
                  </div>
                  <span className="text-xs shrink-0 capitalize" style={{ color: "var(--text-muted)" }}>{w.checklist.filter(c => c.isComplete).length}/{w.checklist.length} · {w.status.replace(/_/g, " ")}</span>
                </Link>
              ))}
            </div>
          </Card>
        </div>

        {/* Right (1/3): Parts on order (when waiting) + Recent Activity + Visits */}
        <div className="flex flex-col gap-4 min-h-0">
          <JobPartsCard jobId={jobId} />
          <Card className="p-4 shrink-0">
            <SectionLabel>Recent Activity</SectionLabel>
            <div className="mt-3">
              {activity.length === 0 ? (
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>No activity recorded yet.</p>
              ) : (
                <div className="space-y-3">
                  {activity.map(e => (
                    <div key={e.id} className="flex items-start gap-2.5">
                      <span className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0" style={{ backgroundColor: colorOf(e.to) }} />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium" style={{ color: "var(--text-primary)" }}>{labelOf(e.from)} → {labelOf(e.to)}</p>
                        <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>{e.byName}{e.byRole ? ` · ${e.byRole}` : ""} · {fmtWhen(e.at)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Card>

          <Card className="flex-1 min-h-0 flex flex-col overflow-hidden">
            {listHead("Visits", visits.length)}
            <div className="flex-1 overflow-y-auto thin-scroll-y px-4 py-3">
              {visits.length === 0 ? (
                <p className="text-xs text-center py-3" style={{ color: "var(--text-muted)" }}>No visits scheduled yet.</p>
              ) : (
                <div className="space-y-2.5">
                  {visits.map((v, i) => {
                    const vwo = getWorkOrderById(v.workOrderId);
                    const m = APPT_STATUS_META[v.status];
                    return (
                      <Link key={v.id} href={`/work-orders/${v.workOrderId}`} className="flex items-start gap-2.5 group">
                        <span className="w-5 h-5 rounded-md flex items-center justify-center shrink-0 text-[10px] font-bold" style={{ backgroundColor: "var(--accent-soft-bg)", color: "var(--accent-text)" }}>{i + 1}</span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate group-hover:underline" style={{ color: "var(--text-primary)" }}>{vwo?.title || `Visit ${i + 1}`}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>{v.scheduledDate || "Unscheduled"}{v.scheduledTime ? ` · ${v.scheduledTime}` : ""}</span>
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold" style={{ color: m.color }}><span className="w-1 h-1 rounded-full" style={{ backgroundColor: m.color }} />{m.label}</span>
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>

      {/* Bottom: Quotes + Invoices (aligned, equal width) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 shrink-0">
        <Card className="overflow-hidden">
          {listHead("Quotes", quotes.length)}
          {quotes.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm" style={{ color: "var(--text-muted)" }}>No quotes for this job.</p>
          ) : quotes.map((q, i) => {
            const qs = QUOTE_STATUS_STYLE[q.status];
            return (
              <Link key={q.id} href={`/quotes/${q.id}`} className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-[var(--bg-surface-2)]"
                style={{ borderTop: i > 0 ? "1px solid var(--border)" : "none", textDecoration: "none" }}>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-mono font-medium" style={{ color: "var(--text-primary)" }}>{q.quoteNumber}</p>
                  <p className="text-xs mt-0.5 truncate" style={{ color: "var(--text-muted)" }}>{q.title}</p>
                </div>
                <StatusBadge label={qs.label} color={qs.color} className="shrink-0" />
                <span className="text-sm font-semibold shrink-0" style={{ color: "var(--text-primary)" }}>{q.total > 0 ? fmt(q.total) : "TBD"}</span>
              </Link>
            );
          })}
        </Card>

        <Card className="overflow-hidden">
          {listHead("Invoices", invoices.length)}
          {invoices.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm" style={{ color: "var(--text-muted)" }}>No invoices for this job.</p>
          ) : invoices.map((inv, i) => {
            const is = INVOICE_STATUS_STYLE[inv.status];
            return (
              <Link key={inv.id} href={`/invoices/${inv.id}`} className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-[var(--bg-surface-2)]"
                style={{ borderTop: i > 0 ? "1px solid var(--border)" : "none", textDecoration: "none" }}>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-mono font-medium" style={{ color: "var(--text-primary)" }}>{inv.invoiceNumber}</p>
                  <p className="text-xs mt-0.5 truncate" style={{ color: "var(--text-muted)" }}>{inv.title}</p>
                </div>
                <StatusBadge label={is.label} color={is.color} className="shrink-0" />
                <div className="text-right shrink-0">
                  <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{fmt(inv.total)}</p>
                  {inv.balanceDue > 0 && <p className="text-[10px]" style={{ color: inv.status === "past_due" ? "#dc2626" : "var(--text-muted)" }}>{fmt(inv.balanceDue)} due</p>}
                </div>
              </Link>
            );
          })}
        </Card>
      </div>

      {/* Notes */}
      {notes.length > 0 && (
        <Card className="p-4 shrink-0">
          <SectionLabel>Notes</SectionLabel>
          <div className="space-y-3 mt-3">
            {notes.map(note => (
              <div key={note.id} className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-[9px] font-bold text-white mt-0.5" style={{ backgroundColor: NOTE_COLORS[note.type] }}>
                  {note.userInitials}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm" style={{ color: "var(--text-secondary)" }}>{note.text}</p>
                  <p className="text-[10px] mt-0.5" style={{ color: "var(--text-muted)" }}>{note.user} · {note.date}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

// ─── Work Order tab ───────────────────────────────────────
// The job's work orders — a lean directory. Each work order owns its scope,
// checklist, materials, photos, and completion on its OWN detail page; the job
// just points at them.
function WorkOrderTab({ jobId }: { jobId: string }) {
  const [wizard, setWizard] = useState(false);
  const [woVersion, setWoVersion] = useState(0);
  const allWos = React.useMemo(() => getWorkOrdersForJob(jobId), [jobId, woVersion]);

  return (
    <div className="space-y-3">
      {wizard && <WorkOrderWizard preset={{ jobId }} onClose={() => setWizard(false)} onCreated={() => { setWizard(false); setWoVersion(v => v + 1); }} />}

      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Work Orders</p>
          <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>The field-execution packets for this job — scope, checklist, materials &amp; photos live inside each one.</p>
        </div>
        <button onClick={() => setWizard(true)} className="group inline-flex items-center gap-1.5 text-xs font-medium shrink-0 transition-colors" style={{ color: "#4f46e5" }}>
          <span className="w-4 h-4 rounded-full flex items-center justify-center transition-all group-hover:brightness-95" style={{ backgroundColor: "#4f46e51a" }}><Plus className="w-3 h-3" /></span>
          New work order
        </button>
      </div>

      {allWos.length === 0 ? (
        <div className="rounded-xl p-8 text-center" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)" }}>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>No work order yet — create one to give the tech their scope &amp; checklist.</p>
        </div>
      ) : allWos.map(w => {
        const st = WO_STATUS_META[w.status];
        const done = w.checklist.filter(c => c.isComplete).length;
        const lines = w.lineItems?.length ?? 0;
        return (
          <Link key={w.id} href={`/work-orders/${w.id}`} className="rounded-xl p-3.5 flex items-center gap-3 hover:bg-[var(--bg-surface-2)] transition-colors" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)" }}>
            <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: "var(--accent-soft-bg)" }}>
              <ListChecks className="w-4 h-4" style={{ color: "var(--accent-text)" }} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold truncate" style={{ color: "var(--text-primary)" }}>{w.title}</p>
                <StatusBadge label={st.label} color={st.color} size="sm" />
              </div>
              <div className="flex items-center gap-3 mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
                <span className="inline-flex items-center gap-1"><ListChecks className="w-3 h-3" /> {w.checklist.length ? `${done}/${w.checklist.length} checklist` : "No checklist"}</span>
                {lines > 0 && <span className="inline-flex items-center gap-1"><DollarSign className="w-3 h-3" /> {lines} line item{lines === 1 ? "" : "s"}</span>}
              </div>
            </div>
            <ChevronRight className="w-4 h-4 shrink-0" style={{ color: "var(--text-muted)" }} />
          </Link>
        );
      })}
    </div>
  );
}

// ─── Notes tab ────────────────────────────────────────────
function NotesTab({ jobId }: { jobId: string }) {
  const [draft, setDraft] = useState("");
  const notes = getJobNotes(jobId);

  return (
    <div className="max-w-2xl space-y-4">
      <div className="rounded-xl p-4" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)" }}>
        <textarea value={draft} onChange={e => setDraft(e.target.value)}
          placeholder="Add a note..." rows={3}
          className="w-full resize-none text-sm outline-none bg-transparent"
          style={{ color: "var(--text-primary)" }} />
        <div className="flex justify-end mt-3 pt-3" style={{ borderTop: "1px solid var(--border)" }}>
          <button disabled={!draft.trim()}
            className="px-3 py-1.5 rounded-lg text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 transition-colors">
            Save Note
          </button>
        </div>
      </div>
      {notes.length === 0
        ? <p className="text-sm text-center py-8" style={{ color: "var(--text-muted)" }}>No notes yet</p>
        : notes.map(note => (
          <div key={note.id} className="rounded-xl p-4" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)" }}>
            <div className="flex items-start gap-3">
              <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold text-white"
                style={{ backgroundColor: NOTE_COLORS[note.type] }}>
                {note.userInitials}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>{note.user}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded capitalize" style={{ backgroundColor: "var(--bg-input)", color: "var(--text-muted)" }}>{note.type}</span>
                  <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>{note.date}</span>
                </div>
                <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>{note.text}</p>
              </div>
            </div>
          </div>
        ))
      }
    </div>
  );
}

// ─── Customer tab ─────────────────────────────────────────
function CustomerTab({ jobId }: { jobId: string }) {
  const job      = getJob(jobId)!;
  const customer = getCustomer(job.accountId);
  if (!customer) return <StubContent label="Customer record not found." />;
  return (
    <div className="max-w-sm">
      <div className="rounded-xl p-5" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" }}>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-[#e5e0db] flex items-center justify-center text-[#5c5545] text-sm font-bold">{customer.initials}</div>
          <div>
            <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{customer.name}</p>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>{customer.locationName}</p>
          </div>
        </div>
        <div className="space-y-2.5">
          <InfoRow icon={Phone} label="Phone" value={customer.phone} />
          {customer.email && <InfoRow icon={Phone} label="Email" value={customer.email} />}
          <InfoRow icon={MapPin} label="Address" value={`${customer.address}, ${customer.city}, ${customer.state}`} />
        </div>
        <div className="mt-4 pt-4" style={{ borderTop: "1px solid var(--border)" }}>
          <Link href={`/customers/${customer.id}`} className="flex items-center justify-between text-sm font-medium text-indigo-600 hover:text-indigo-700">
            Open customer record <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}

// ─── Stub content ─────────────────────────────────────────
function StubContent({ label }: { label: string }) {
  return (
    <div className="rounded-xl p-10 text-center" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)" }}>
      <p className="text-sm" style={{ color: "var(--text-muted)" }}>{label}</p>
    </div>
  );
}

// ─── Job financials tab ───────────────────────────────────
// ─── Deposit control ──────────────────────────────────────
// Collect a down payment up front — a job-level deposit invoice not tied to any
// captured work. Once paid, the final ledger invoice credits it automatically.
function JobDepositControl({ jobId }: { jobId: string }) {
  const router = useRouter();
  const rev = useDataVersion();
  const { fieldVisible } = usePermissions();
  const [amt, setAmt] = useState("");
  const deposits = React.useMemo(() => getUnappliedDeposits(jobId), [jobId, rev]);

  if (!fieldVisible("finance_field_pricing") || !fieldVisible("finance_field_billing")) return null;

  const onFile = deposits.reduce((s, d) => s + d.total, 0);
  function request() {
    const n = parseFloat(amt);
    if (!n || n <= 0) return;
    const inv = createDepositInvoice(jobId, n);
    if (inv) router.push(`/invoices/${inv.id}`);
  }

  return (
    <div className="rounded-xl px-4 py-3 flex flex-wrap items-center gap-3" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" }}>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Deposit</p>
        <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
          {onFile > 0 ? `${fmt(onFile)} paid deposit on file — credited on the final invoice.` : "Collect a down payment before work begins."}
        </p>
      </div>
      <div onKeyDown={e => e.key === "Enter" && request()}>
        <NumberStepper size="sm" min={0} step={50} prefix="$" placeholder="0.00" value={amt} onChange={setAmt} className="w-32" />
      </div>
      <DetailActionButton icon={Receipt} onClick={request} disabled={!parseFloat(amt)}>Request deposit</DetailActionButton>
    </div>
  );
}

// ─── Job billable-items ledger ────────────────────────────
// The job "tab": every captured parts/labor line across all the job's work
// orders, shown as billed vs unbilled. Select which unbilled lines to bill and
// raise one invoice — the cross-work-order billing path for multi-visit jobs.
function JobLedgerCard({ jobId }: { jobId: string }) {
  const router = useRouter();
  const rev = useDataVersion();
  const { fieldVisible } = usePermissions();
  const showPricing = fieldVisible("finance_field_pricing");
  const canBill = fieldVisible("finance_field_billing");
  const ledger = React.useMemo(() => getJobLedger(jobId), [jobId, rev]);
  const [deselected, setDeselected] = useState<Set<string>>(new Set());

  if (!showPricing) return null;
  if (ledger.length === 0) {
    return (
      <div className="rounded-xl px-4 py-6 text-center" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" }}>
        <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Billable work</p>
        <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>No parts or labor captured yet — add them on the work order and they'll show here to bill.</p>
      </div>
    );
  }

  const unbilled = ledger.filter(l => !l.billed);
  const billed = ledger.filter(l => l.billed);
  const isSel = (id: string) => !deselected.has(id);
  const selected = unbilled.filter(l => isSel(l.id));
  const selectedTotal = selected.reduce((s, l) => s + l.qty * l.unitPrice, 0);
  const billedTotal = billed.reduce((s, l) => s + l.qty * l.unitPrice, 0);
  const toggle = (id: string) => setDeselected(d => { const n = new Set(d); n.has(id) ? n.delete(id) : n.add(id); return n; });

  // Group unbilled lines by work order for provenance (only labeled when >1 WO).
  const woIds = Array.from(new Set(unbilled.map(l => l.workOrderId)));
  const multiWo = woIds.length > 1;

  function bill() {
    const inv = createInvoiceFromJobLedger(jobId, selected.map(l => l.id));
    if (inv) router.push(`/invoices/${inv.id}`);
  }

  return (
    <div className="rounded-xl overflow-hidden" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" }}>
      <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
        <div>
          <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Billable work</p>
          <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
            {unbilled.length ? `${fmt(sumUnbilled(ledger))} unbilled across ${woIds.length} work order${woIds.length === 1 ? "" : "s"}` : "All captured work billed"}
            {billed.length > 0 && ` · ${fmt(billedTotal)} billed`}
          </p>
        </div>
        {unbilled.length > 0 && canBill && (
          <DetailActionButton icon={Receipt} onClick={bill} disabled={selected.length === 0}>
            {selected.length < unbilled.length ? "Bill selected" : "Bill unbilled"}
          </DetailActionButton>
        )}
      </div>

      {woIds.map(woId => {
        const rows = unbilled.filter(l => l.workOrderId === woId);
        return (
          <div key={woId}>
            {multiWo && <p className="px-4 pt-2.5 pb-1 text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>{rows[0]?.workOrderTitle || "Work order"}</p>}
            {rows.map((l, i) => {
              const sel = isSel(l.id);
              return (
                <div key={l.id} className="flex items-center gap-2.5 px-4 py-2" style={{ borderTop: (i || multiWo) ? "1px solid var(--border-subtle)" : "1px solid var(--border)" }}>
                  <button onClick={() => toggle(l.id)} aria-label={sel ? "Exclude" : "Include"}
                    className="w-5 h-5 rounded flex items-center justify-center shrink-0 transition-colors"
                    style={{ border: `1.5px solid ${sel ? "#c9c0b2" : "var(--border)"}`, backgroundColor: sel ? "#E5E0DB" : "transparent" }}>
                    {sel && <Check className="w-3 h-3" style={{ color: "#5c5545" }} />}
                  </button>
                  <span className="text-sm truncate flex-1 min-w-0" style={{ color: "var(--text-primary)" }}>{l.description}</span>
                  <span className="text-xs tabular-nums shrink-0" style={{ color: "var(--text-muted)" }}>{l.qty} × {fmt(l.unitPrice)}</span>
                  <span className="text-sm font-semibold tabular-nums shrink-0 w-20 text-right" style={{ color: "var(--text-primary)" }}>{fmt(l.qty * l.unitPrice)}</span>
                </div>
              );
            })}
          </div>
        );
      })}

      {/* Already-billed lines — locked, muted, linked to their invoice. */}
      {billed.map((l, i) => (
        <div key={l.id} className="flex items-center gap-2.5 px-4 py-2" style={{ borderTop: "1px solid var(--border-subtle)", opacity: 0.6, ...(i === 0 && unbilled.length ? { borderTop: "1px solid var(--border)" } : {}) }}>
          <span className="w-5 h-5 shrink-0" />
          <span className="text-sm truncate flex-1 min-w-0" style={{ color: "var(--text-primary)" }}>{l.description}</span>
          {l.invoiceId && <Link href={`/invoices/${l.invoiceId}`} className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0 hover:brightness-95"
            style={l.paid ? { backgroundColor: "#dcfce7", color: "#16a34a", border: "1px solid #bbf7d0" } : { backgroundColor: "var(--bg-surface-2)", color: "var(--text-muted)", border: "1px solid var(--border)" }}>{l.paid ? "Paid" : "Billed"}</Link>}
          <span className="text-sm font-semibold tabular-nums shrink-0 w-20 text-right" style={{ color: "var(--text-primary)" }}>{fmt(l.qty * l.unitPrice)}</span>
        </div>
      ))}

      {unbilled.length > 0 && (
        <div className="flex items-center justify-between px-4 py-2.5" style={{ borderTop: "1px solid var(--border)" }}>
          <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>{selected.length} of {unbilled.length} selected</span>
          <span className="text-sm font-bold tabular-nums" style={{ color: "var(--text-primary)" }}>{fmt(selectedTotal)}</span>
        </div>
      )}
    </div>
  );
}

// Small labeled figure for the Billing summary strip.
// Matches the Work Order Overview Stat card: icon + label row, bold value; the
// accent (or status color) tints both the icon and value, muted/primary otherwise.
function BillingKpi({ label, value, tone, color, icon: Icon }: { label: string; value: string; tone?: "accent" | "green"; color?: string; icon?: React.ElementType }) {
  const accent = color ?? (tone === "accent" ? "var(--accent-text)" : tone === "green" ? "#16a34a" : undefined);
  return (
    <div className="rounded-xl p-3.5" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" }}>
      <div className="flex items-center gap-1.5 mb-1.5">
        {Icon && <Icon className="w-3.5 h-3.5 shrink-0" style={{ color: accent ?? "var(--text-muted)" }} />}
        <p className="text-[10px] font-semibold uppercase tracking-widest truncate" style={{ color: "var(--text-muted)" }}>{label}</p>
      </div>
      <p className="text-base font-bold leading-tight truncate" style={{ color: accent ?? "var(--text-primary)" }}>{value}</p>
    </div>
  );
}

type Kpi = { label: string; value: string; tone?: "accent" | "green"; color?: string; icon?: React.ElementType };
const KPI_COLS: Record<number, string> = { 2: "md:grid-cols-2", 3: "md:grid-cols-3", 4: "md:grid-cols-4", 5: "md:grid-cols-5" };

// Shared billing summary strip — used on both the Overview and Billing tabs.
// Unbilled / Deposit figures are field-pricing gated; void/canceled invoices
// don't count toward invoiced/collected. Overview passes `status` to lead with a
// Status card (5-up); the Billing tab omits it (4-up).
function JobBillingKpis({ jobId, status }: { jobId: string; status?: { label: string; color: string } }) {
  const rev = useDataVersion();
  const { fieldVisible } = usePermissions();
  const showPricing = fieldVisible("finance_field_pricing");
  const invoices = React.useMemo(() => getInvoicesForJob(jobId), [jobId, rev]);
  const ledger   = React.useMemo(() => getJobLedger(jobId), [jobId, rev]);
  const live = invoices.filter(i => i.status !== "void" && i.status !== "canceled");
  const unbilled  = sumUnbilled(ledger);
  const invoiced  = live.reduce((s, i) => s + i.total, 0);
  const collected = live.reduce((s, i) => s + (i.total - i.balanceDue), 0);
  const depositOnFile = getUnappliedDeposits(jobId).reduce((s, d) => s + d.total, 0);

  const kpis = [
    status && { label: "Status", value: status.label, color: status.color, icon: CheckCircle },
    showPricing && { label: "Unbilled", value: fmt(unbilled), tone: unbilled > 0 ? "accent" as const : undefined, icon: DollarSign },
    { label: "Invoiced", value: fmt(invoiced), icon: Receipt },
    { label: "Collected", value: fmt(collected), tone: "green" as const, icon: CircleDollarSign },
    showPricing && { label: "Deposit on file", value: fmt(depositOnFile), icon: Wallet },
  ].filter(Boolean) as Kpi[];

  return (
    <div className={`grid grid-cols-2 ${KPI_COLS[kpis.length] ?? "md:grid-cols-4"} gap-3`}>
      {kpis.map(k => <BillingKpi key={k.label} label={k.label} value={k.value} tone={k.tone} color={k.color} icon={k.icon} />)}
    </div>
  );
}

function JobFinancialsTab({ jobId }: { jobId: string }) {
  const router = useRouter();
  const rev = useDataVersion();
  const [wizard, setWizard] = useState(false);
  const job      = getJob(jobId);
  const quotes   = getQuotesForJob(jobId);
  const invoices = React.useMemo(() => getInvoicesForJob(jobId), [jobId, rev]);

  function makeInvoice() {
    const inv = createInvoiceFromJob(jobId);
    if (inv) router.push(`/invoices/${inv.id}`);
  }

  function Section({ title, onNew, newLabel = "New Quote", children }: { title: string; onNew?: () => void; newLabel?: string; children: React.ReactNode }) {
    return (
      <div className="rounded-xl overflow-hidden self-start w-full" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" }}>
        <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
          <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{title}</p>
          {onNew && <DetailActionButton onClick={onNew}>{newLabel}</DetailActionButton>}
        </div>
        {children}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {wizard && job && (
        <QuoteTypeChooser preset={{ customerId: job.accountId, jobId, lockCustomer: true }}
          onClose={() => setWizard(false)} />
      )}

      <JobDepositControl jobId={jobId} />

      {/* Quotes + Invoices — side by side once there's room, stacked on narrow */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 items-start">
      <Section title={`Quotes (${quotes.length})`} onNew={() => setWizard(true)}>
        {quotes.length === 0 ? (
          <div className="px-4 py-8 text-center"><p className="text-sm" style={{ color: "var(--text-muted)" }}>No quotes for this job</p></div>
        ) : quotes.map((q, i) => {
          const s = QUOTE_STATUS_STYLE[q.status];
          return (
            <Link key={q.id} href={`/quotes/${q.id}`}
              className="group flex items-center gap-4 px-4 py-3 hover:bg-[var(--bg-surface-2)] transition-colors"
              style={{ borderBottom: i < quotes.length - 1 ? "1px solid var(--border)" : "none", textDecoration: "none" }}>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-mono font-medium" style={{ color: "var(--text-primary)" }}>{q.quoteNumber}</p>
                <p className="text-xs mt-0.5 truncate" style={{ color: "var(--text-muted)" }}>{q.title}</p>
              </div>
              {/* Status appears on row hover only — rows stay quiet at rest. */}
              <StatusBadge label={s.label} color={s.color} className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
              <span className="text-sm font-semibold shrink-0" style={{ color: "var(--text-primary)" }}>{q.total > 0 ? fmt(q.total) : "TBD"}</span>
              <ChevronRight className="w-4 h-4 shrink-0" style={{ color: "var(--text-muted)" }} />
            </Link>
          );
        })}
      </Section>

      <Section title={`Invoices (${invoices.length})`} onNew={makeInvoice} newLabel="Create Invoice">
        {invoices.length === 0 ? (
          <div className="px-4 py-8 text-center"><p className="text-sm" style={{ color: "var(--text-muted)" }}>No invoices for this job</p></div>
        ) : invoices.map((inv, i) => {
          const s = INVOICE_STATUS_STYLE[inv.status];
          return (
            <Link key={inv.id} href={`/invoices/${inv.id}`}
              className="group flex items-center gap-4 px-4 py-3 hover:bg-[var(--bg-surface-2)] transition-colors"
              style={{ borderBottom: i < invoices.length - 1 ? "1px solid var(--border)" : "none", textDecoration: "none" }}>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-mono font-medium flex items-center gap-1.5" style={{ color: "var(--text-primary)" }}>
                  {inv.invoiceNumber}
                  {inv.isDeposit && <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full" style={{ backgroundColor: "var(--accent-soft-bg)", color: "var(--accent-text)" }}>Deposit</span>}
                </p>
                <p className="text-xs mt-0.5 truncate" style={{ color: "var(--text-muted)" }}>{inv.title}</p>
              </div>
              {/* Status appears on row hover only — rows stay quiet at rest. */}
              <StatusBadge label={s.label} color={s.color} className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="text-right shrink-0">
                <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{fmt(inv.total)}</p>
                {inv.balanceDue > 0 && <p className="text-[10px]" style={{ color: inv.status === "past_due" ? "#dc2626" : "var(--text-muted)" }}>{fmt(inv.balanceDue)} due</p>}
              </div>
              <ChevronRight className="w-4 h-4 shrink-0" style={{ color: "var(--text-muted)" }} />
            </Link>
          );
        })}
      </Section>
      </div>

      {/* Billable work last — it's edited at the job layer, below the documents. */}
      <JobLedgerCard jobId={jobId} />
    </div>
  );
}

// ─── Shared primitives ────────────────────────────────────
// Same visual language as the Agreement / Customer overview tabs: a shadowed
// surface Card, an uppercase SectionLabel, and labeled InfoRows.
function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl ${className}`} style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" }}>
      {children}
    </div>
  );
}
function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>{children}</p>;
}
function InfoRow({ icon: Icon, label, value }: { icon?: typeof Phone; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2.5">
      {Icon && <Icon className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: "var(--text-muted)" }} />}
      <div className="min-w-0 flex-1">
        <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>{label}</p>
        <p className="text-sm font-medium break-words" style={{ color: "var(--text-primary)" }}>{value || "—"}</p>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────
function JobDetailContent({ params }: { params: Promise<{ id: string }> }) {
  const { id }    = use(params);
  const router    = useRouter();
  const searchParams = useSearchParams();
  // Back target — defaults to the Jobs list, but a linking page (e.g. a customer
  // profile's Jobs tab) can pass ?back=<url>&backLabel=<text> to return there.
  const backHref  = searchParams.get("back") || "/jobs";
  const backLabel = searchParams.get("backLabel") || "Jobs";
  // Tab is URL-synced (?tab=) so comment deep-links and back-links land on the
  // right tab, and the global comment watcher can focus sub-entities within it.
  const [tab, setTabState] = useState(() => { const t = searchParams.get("tab"); return t && TABS.includes(t) ? t : "Overview"; });
  function setTab(t: string) {
    setTabState(t);
    const sp = new URLSearchParams(searchParams.toString());
    sp.set("tab", t);
    router.replace(`/jobs/${id}?${sp.toString()}`, { scroll: false });
  }
  const [job, setJob] = useState(() => getJob(id));
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [returnOpen, setReturnOpen] = useState(false);
  const refresh = () => setJob(getJob(id));

  // Status is driven elsewhere: scheduling on the dispatch board, and the field
  // progression (en route / in progress / complete) by the technician. The Jobs
  // page only exposes office-level actions and shows status read-only.
  // Cancel = reversible. Reschedule/Reactivate clear the schedule so the job
  // returns to the dispatch queue ready to re-book. Delete = permanent.
  function cancelJob()     { updateJob(id, { status: "canceled" }); refresh(); }
  function reactivateJob() { updateJob(id, { status: "new", scheduledDate: "", scheduledTime: "", assignedTo: "", assignedToInitials: "" }); refresh(); }
  function rescheduleJob() { updateJob(id, { status: "new", scheduledDate: "", scheduledTime: "" }); router.push("/dispatching"); }
  function doDelete()      { deleteJob(id); router.push("/jobs"); }

  if (!job) {
    return (
      <div className="p-6">
        <Link href={backHref} className="flex items-center gap-1.5 text-sm mb-4" style={{ color: "var(--text-secondary)" }}>
          <ArrowLeft className="w-4 h-4" /> Back to {backLabel}
        </Link>
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>Job not found.</p>
      </div>
    );
  }

  const s       = resolveJobStatus(job.status, getJobStatuses().filter(st => st.active));
  const project = job.projectId ? getProject(job.projectId) : null;
  const canVisit = canAddVisit(job).allowed;

  return (
    <div className="flex flex-col h-full">
      <div style={{ backgroundColor: "var(--bg-surface)", borderBottom: "1px solid var(--border)" }}>
        {/* Top row */}
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-4 min-w-0">
            <Link href={backHref} className="flex items-center gap-1.5 text-sm shrink-0" style={{ color: "var(--text-secondary)" }}>
              <ArrowLeft className="w-4 h-4" /> {backLabel}
            </Link>
            {project && !backHref.includes(`/projects/${project.id}`) && (
              <>
                <span style={{ color: "var(--text-muted)" }}>›</span>
                <Link href={`/projects/${project.id}`} className="text-sm shrink-0 truncate max-w-[160px]" style={{ color: "var(--text-secondary)" }}>{project.name}</Link>
              </>
            )}
            <div className="w-px h-5 shrink-0" style={{ backgroundColor: "var(--border)" }} />
            <div className="min-w-0">
              <h1 className="text-base font-semibold truncate" style={{ color: "var(--text-primary)" }}>{job.title}</h1>
              <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{job.customerName} · {job.scheduledDate} at {job.scheduledTime}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {/* On-hold jobs (waiting on parts/customer/approval) surface a prominent
                return-visit action — that's how a second trip gets booked. */}
            {HOLD_STATUSES.has(job.status) && canVisit && (
              <button onClick={() => setReturnOpen(true)} className="inline-flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg" style={{ backgroundColor: "#f59e0b1a", color: "#b45309", border: "1px solid #f59e0b59" }}>
                <Repeat className="w-4 h-4" /> Schedule return visit
              </button>
            )}
            {/* Every action for this job lives in the ⋮ menu, consistent with the
                other detail pages. Status itself is shown as the badge above. */}
            <ActionsMenu actions={[
              canVisit &&
                { label: "Schedule return visit", icon: Repeat, onClick: () => setReturnOpen(true) },
              job.status !== "canceled" && !["completed", "invoiced", "closed", "no_show"].includes(job.status) &&
                { label: "Reschedule", icon: Calendar, onClick: rescheduleJob },
              job.status === "canceled"
                ? { label: "Reactivate", icon: RotateCcw, onClick: reactivateJob }
                : (!["completed", "invoiced", "closed", "no_show"].includes(job.status) &&
                    { label: "Cancel job", icon: Ban, onClick: cancelJob }),
              { label: "Delete job", icon: Trash2, onClick: () => setConfirmDelete(true), danger: true, separated: true },
            ]} />
          </div>
        </div>
        {/* Status is read-only here (shown as the badge in the header above) —
            it's changed only from the dispatch board stage icon or the mobile app. */}

        {/* Sub-tabs — glossy light-amber (comment-mode accent) */}
        <DetailTabs tabs={TABS} active={tab} onChange={setTab} className="px-6 py-2" />
      </div>

      <div className="flex-1 overflow-y-auto p-6" style={{ backgroundColor: "var(--bg-page)" }}>
        {tab === "Overview"          && <OverviewTab  jobId={id} />}
        {tab === "Work Order"        && <WorkOrderTab jobId={id} />}
        {tab === "Visits"            && <VisitsTab    jobId={id} onSchedule={() => setReturnOpen(true)} />}
        {tab === "Tasks"             && <RecordTasks type="job" id={id} />}
        {tab === "Notes"             && <NotesTab     jobId={id} />}
        {tab === "Customer"          && <CustomerTab  jobId={id} />}
        {tab === "Photos & Files"    && <PhotoGallery recordLevel="job" scope={{ accountId: job.accountId, jobId: id, projectId: job.projectId }} accountName={job.customerName} />}
        {tab === "Billing"           && <JobFinancialsTab jobId={id} />}
        {tab === "History"           && <JobHistoryList job={job} />}
      </div>

      {/* Delete confirmation */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setConfirmDelete(false)}>
          <div className="w-full max-w-sm rounded-2xl p-6" onClick={e => e.stopPropagation()}
            style={{ backgroundColor: "var(--bg-surface)", boxShadow: "0 16px 48px rgba(0,0,0,0.24)" }}>
            <div className="flex items-center gap-2.5 mb-2">
              <div className="w-9 h-9 rounded-full flex items-center justify-center" style={{ backgroundColor: "#fee2e2" }}>
                <Trash2 className="w-4 h-4 text-red-600" />
              </div>
              <p className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>Delete this job?</p>
            </div>
            <p className="text-sm mb-3" style={{ color: "var(--text-secondary)" }}>
              &ldquo;{job.title}&rdquo; will be permanently removed — this can&apos;t be undone. To keep a record, use <span className="font-medium">Cancel</span> instead.
            </p>
            {job.sourceModule === "agreements" && (
              <div className="flex items-start gap-2 mb-5 rounded-lg p-3" style={{ backgroundColor: "#eff6ff", border: "1px solid #bfdbfe" }}>
                <Info className="w-4 h-4 shrink-0 mt-0.5" style={{ color: "#2563eb" }} />
                <p className="text-xs" style={{ color: "#1e40af" }}>
                  This job is a maintenance agreement visit. Deleting it returns the visit to the <span className="font-medium">schedule queue</span> so it can be re-booked — the agreement&apos;s visit count won&apos;t be lost.
                </p>
              </div>
            )}
            <div className="flex justify-end gap-2">
              <button onClick={() => setConfirmDelete(false)} className="px-3 py-2 rounded-lg text-sm"
                style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}>Keep job</button>
              <button onClick={doDelete} className="px-4 py-2 rounded-lg text-sm font-medium text-white" style={{ backgroundColor: "#dc2626" }}>
                Delete permanently
              </button>
            </div>
          </div>
        </div>
      )}

      {returnOpen && <ReturnVisitModal job={job} onClose={() => setReturnOpen(false)} onScheduled={() => { refresh(); setTab("Visits"); }} />}
    </div>
  );
}

export default function JobDetailPage(props: { params: Promise<{ id: string }> }) {
  // Suspense boundary required because the content reads useSearchParams.
  return (
    <Suspense fallback={null}>
      <JobDetailContent {...props} />
    </Suspense>
  );
}
