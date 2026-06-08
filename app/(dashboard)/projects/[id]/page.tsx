"use client";

import { use, useState, Suspense } from "react";
import Link from "next/link";
import { ArrowLeft, Pencil, CheckCircle, Circle, ChevronRight, MapPin, User, Calendar, DollarSign, Clock, Plus, Trash2, AlertCircle } from "lucide-react";
import { getProject, getProjectTasks, getProjectProgress, deleteProject, PROJECT_TYPE_LABELS } from "@/lib/projects/data";
import ActionsMenu from "@/components/shared/ActionsMenu";
import ProjectPhases from "@/components/projects/ProjectPhases";
import EditProjectModal from "@/components/projects/EditProjectModal";
import JobWizard from "@/components/jobs/JobWizard";
import { phaseProgress, getPhases } from "@/lib/projects/phases";
import { getProjectStages } from "@/lib/projects/settings";
import { getJobsForProject, JOB_STATUS_CONFIG } from "@/lib/jobs/data";
import StatusBadge from "@/components/shared/StatusBadge";
import { getCustomer } from "@/lib/customers/data";
import { getQuotesForProject, getInvoicesForProject, fmt as fmtCurrency } from "@/lib/quotes/data";
import { QUOTE_STATUS_STYLE, INVOICE_STATUS_STYLE } from "@/lib/quotes/types";
import InvoiceWizard from "@/components/quotes/InvoiceWizard";
import { useRouter, useSearchParams } from "next/navigation";
import Commentable from "@/components/comments/Commentable";
import QuickCreateQuoteModal from "@/components/quotes/QuickCreateQuoteModal";
import PhotoGallery from "@/components/files/PhotoGallery";

const TABS = ["Overview", "Phases", "Jobs", "Tasks", "Photos & Files", "Scope", "Estimates", "Invoices", "Notes", "Timeline"];

// Link to a job opened from this project — carries ?back so the job's Back button
// returns to this project's Jobs tab instead of the global Jobs list.
function jobHrefFromProject(jobId: string, projectId: string, projectName: string): string {
  const back = encodeURIComponent(`/projects/${projectId}?tab=Jobs`);
  return `/jobs/${jobId}?back=${back}&backLabel=${encodeURIComponent(projectName)}`;
}

// ─── Current-phase summary (Overview) ─────────────────────
// Compact read-out of where the project is; the full editable stepper lives on
// the Phases tab.
function PhaseSummary({ projectId, onOpenPhases }: { projectId: string; onOpenPhases?: () => void }) {
  const phases = getPhases(projectId);
  const prog = phaseProgress(projectId);
  const current = phases.find(p => p.status === "in_progress") ?? phases.find(p => p.status === "upcoming");
  const allDone = phases.length > 0 && prog.done === prog.total;
  return (
    <div className="rounded-xl p-4" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-subtle)", boxShadow: "var(--shadow-card)" }}>
      <div className="flex items-center justify-between mb-2">
        <p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>Current Phase</p>
        {onOpenPhases && (
          <button onClick={onOpenPhases} className="text-[11px] font-medium hover:underline" style={{ color: "var(--accent-text)" }}>View phases →</button>
        )}
      </div>
      {phases.length === 0 ? (
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>No phases yet — set them up on the Phases tab.</p>
      ) : (
        <>
          <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{allDone ? "All phases complete" : current?.name ?? "—"}</p>
          <div className="flex items-center gap-2 mt-2">
            <div className="flex-1 h-1.5 rounded-full" style={{ backgroundColor: "var(--bg-input)" }}>
              <div className="h-1.5 rounded-full" style={{ width: `${prog.pct}%`, backgroundColor: allDone ? "#10b981" : "#4f46e5" }} />
            </div>
            <span className="text-[10px] shrink-0" style={{ color: "var(--text-muted)" }}>{prog.done}/{prog.total} · {prog.pct}%</span>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Phases tab ───────────────────────────────────────────
function PhasesTab({ projectId, onChange }: { projectId: string; onChange?: () => void }) {
  return <ProjectPhases projectId={projectId} onChange={onChange} />;
}

// ─── Overview tab ─────────────────────────────────────────
function OverviewTab({ projectId, onChange, onOpenPhases }: { projectId: string; onChange?: () => void; onOpenPhases?: () => void }) {
  const project  = getProject(projectId)!;
  const jobs     = getJobsForProject(projectId);
  const tasks    = getProjectTasks(projectId);
  const openTasks = tasks.filter(t => !t.isComplete);

  return (
    <div className="grid grid-cols-3 gap-6">
      {/* Left: phase summary + project details */}
      <div className="space-y-4">
        <PhaseSummary projectId={projectId} onOpenPhases={onOpenPhases} />

        <div className="rounded-xl p-4" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-subtle)", boxShadow: "var(--shadow-card)" }}>
          <p className="text-[10px] font-semibold uppercase tracking-widest mb-3" style={{ color: "var(--text-muted)" }}>Project Info</p>
          <div className="space-y-2.5">
            {[
              { label: "Type",        value: PROJECT_TYPE_LABELS[project.type] },
              { label: "Priority",    value: project.priority.charAt(0).toUpperCase() + project.priority.slice(1) },
              { label: "Assigned To", value: project.assignedTo },
              { label: "Start Date",  value: project.startDate ?? "—" },
              { label: "Target Date", value: project.targetDate ?? "—" },
              { label: "Branch",      value: project.locationName },
            ].map(({ label, value }) => (
              <div key={label} className="flex justify-between">
                <span className="text-xs" style={{ color: "var(--text-muted)" }}>{label}</span>
                <span className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>{value}</span>
              </div>
            ))}
          </div>
        </div>

        {project.estimatedValue && (
          <div className="rounded-xl p-4" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-subtle)" }}>
            <p className="text-[10px] font-semibold uppercase tracking-widest mb-2" style={{ color: "var(--text-muted)" }}>Value</p>
            <p className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>{project.estimatedValue}</p>
            <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>Estimated</p>
          </div>
        )}

        {project.propertyAddress && (
          <div className="rounded-xl p-4" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-subtle)" }}>
            <p className="text-[10px] font-semibold uppercase tracking-widest mb-2" style={{ color: "var(--text-muted)" }}>Property</p>
            <p className="text-sm" style={{ color: "var(--text-primary)" }}>{project.propertyAddress}</p>
          </div>
        )}
      </div>

      {/* Right: jobs + tasks */}
      <div className="col-span-2 space-y-4">

        {/* Jobs summary */}
        <div className="rounded-xl overflow-hidden" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-subtle)", boxShadow: "var(--shadow-card)" }}>
          <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
            <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Jobs</p>
            <Link href={`/projects/${projectId}?tab=Jobs`} className="text-xs font-medium text-indigo-600 hover:text-indigo-700">View all</Link>
          </div>
          {jobs.map((job, i) => {
            const js = JOB_STATUS_CONFIG[job.status];
            return (
              <Link key={job.id} href={jobHrefFromProject(job.id, projectId, project.name)}
                className="flex items-center justify-between px-4 py-3 hover:bg-[var(--bg-surface-2)] transition-colors"
                style={i < jobs.length - 1 ? { borderBottom: "1px solid var(--border-subtle)" } : undefined}>
                <div>
                  <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{job.title}</p>
                  <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{job.scheduledDate} · {job.assignedTo}</p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge label={js.label} color={js.color} />
                  <ChevronRight className="w-3.5 h-3.5" style={{ color: "var(--text-muted)" }} />
                </div>
              </Link>
            );
          })}
        </div>

        {/* Open tasks */}
        {openTasks.length > 0 && (
          <div className="rounded-xl overflow-hidden" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-subtle)" }}>
            <div className="px-4 py-3" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
              <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Open Tasks ({openTasks.length})</p>
            </div>
            {openTasks.map((task, i) => (
              <div key={task.id} className="flex items-center justify-between px-4 py-2.5"
                style={i < openTasks.length - 1 ? { borderBottom: "1px solid var(--border-subtle)" } : undefined}>
                <div className="flex items-center gap-2.5">
                  <Circle className="w-4 h-4 shrink-0" style={{ color: "var(--border)" }} />
                  <span className="text-sm" style={{ color: "var(--text-primary)" }}>{task.title}</span>
                </div>
                {task.dueDate && <span className="text-xs" style={{ color: "var(--text-muted)" }}>{task.dueDate}</span>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Jobs tab ─────────────────────────────────────────────
function JobsTab({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [wizard, setWizard] = useState(false);
  const [, forceRefresh] = useState(0);
  const project = getProject(projectId)!;
  const jobs = getJobsForProject(projectId);
  return (
    <div className="rounded-xl overflow-hidden" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-subtle)", boxShadow: "var(--shadow-card)" }}>
      {wizard && (
        <JobWizard preset={{ customerId: project.accountId, projectId, lockCustomer: true }}
          onClose={() => setWizard(false)}
          onCreated={(jid) => { setWizard(false); forceRefresh(n => n + 1); router.push(jobHrefFromProject(jid, projectId, project.name)); }} />
      )}
      <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
        <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Jobs ({jobs.length})</p>
        <button onClick={() => setWizard(true)} className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg"
          style={{ backgroundColor: "#4f46e5", color: "#fff" }}>
          <Plus className="w-3.5 h-3.5" /> Add Job
        </button>
      </div>
      {jobs.length === 0 ? (
        <div className="px-4 py-10 text-center"><p className="text-sm" style={{ color: "var(--text-muted)" }}>No jobs on this project yet.</p></div>
      ) : (
      <>
      <div className="grid px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider"
        style={{ gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr 1fr", color: "var(--text-muted)", borderBottom: "1px solid var(--border-subtle)", backgroundColor: "var(--bg-surface-2)" }}>
        <span>Job</span><span>Type</span><span>Status</span><span>Date</span><span>Tech</span><span>Amount</span>
      </div>
      {jobs.map((job, i) => {
        const s = JOB_STATUS_CONFIG[job.status];
        return (
          <Link key={job.id} href={jobHrefFromProject(job.id, projectId, project.name)}
            className="grid px-4 py-3 items-center hover:bg-[var(--bg-surface-2)] transition-colors"
            style={{ gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr 1fr", borderBottom: i < jobs.length - 1 ? "1px solid var(--border-subtle)" : "none", textDecoration: "none" }}>
            <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{job.title}</span>
            <span className="text-sm capitalize" style={{ color: "var(--text-secondary)" }}>{job.type}</span>
            <StatusBadge label={s.label} color={s.color} />
            <span className="text-sm" style={{ color: "var(--text-secondary)" }}>{job.scheduledDate}</span>
            <span className="text-sm" style={{ color: "var(--text-secondary)" }}>{job.assignedTo}</span>
            <span className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>{job.estimatedAmount ?? "—"}</span>
          </Link>
        );
      })}
      </>
      )}
    </div>
  );
}

// ─── Tasks tab ────────────────────────────────────────────
function TasksTab({ projectId }: { projectId: string }) {
  const tasks = getProjectTasks(projectId);
  const [items, setItems] = useState(tasks);

  function toggle(id: string) {
    setItems(prev => prev.map(t => t.id === id ? { ...t, isComplete: !t.isComplete } : t));
  }

  if (items.length === 0) return <StubContent label="No tasks for this project." />;
  return (
    <div className="max-w-xl space-y-2">
      {items.map(task => (
        <button key={task.id} onClick={() => toggle(task.id)}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left hover:bg-[var(--bg-surface-2)] transition-colors"
          style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-subtle)" }}>
          {task.isComplete
            ? <CheckCircle className="w-5 h-5 shrink-0 text-emerald-500" />
            : <Circle      className="w-5 h-5 shrink-0" style={{ color: "var(--border)" }} />}
          <div className="flex-1 min-w-0">
            <span className={task.isComplete ? "line-through" : ""} style={{ color: task.isComplete ? "var(--text-muted)" : "var(--text-primary)", fontSize: "0.875rem" }}>
              {task.title}
            </span>
            {(task.dueDate || task.assignedTo) && (
              <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                {[task.dueDate, task.assignedTo].filter(Boolean).join(" · ")}
              </p>
            )}
          </div>
        </button>
      ))}
    </div>
  );
}

// ─── Scope tab ────────────────────────────────────────────
function ScopeTab({ projectId }: { projectId: string }) {
  const project = getProject(projectId)!;
  if (!project.scope) return <StubContent label="No scope document added yet." />;
  return (
    <div className="max-w-2xl">
      <div className="rounded-xl p-6" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-subtle)", boxShadow: "var(--shadow-card)" }}>
        <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: "var(--text-muted)" }}>Scope of Work</p>
        <p className="text-sm leading-relaxed whitespace-pre-line" style={{ color: "var(--text-secondary)" }}>{project.scope}</p>
      </div>
    </div>
  );
}

function StubContent({ label }: { label: string }) {
  return <div className="rounded-xl p-10 text-center" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-subtle)" }}><p className="text-sm" style={{ color: "var(--text-muted)" }}>{label}</p></div>;
}

// ─── Estimates (quotes) tab ───────────────────────────────
function ProjectEstimatesTab({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [wizard, setWizard] = useState(false);
  const [, forceRefresh] = useState(0);
  const project = getProject(projectId)!;
  const quotes  = getQuotesForProject(projectId);

  return (
    <div className="rounded-xl overflow-hidden max-w-3xl" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-subtle)", boxShadow: "var(--shadow-card)" }}>
      {wizard && (
        <QuickCreateQuoteModal preset={{ customerId: project.accountId, projectId, lockCustomer: true }}
          onClose={() => setWizard(false)}
          onContinue={(qid) => { setWizard(false); router.push(`/quotes/${qid}/builder`); }} />
      )}
      <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
        <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Estimates ({quotes.length})</p>
        <button onClick={() => setWizard(true)} className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg"
          style={{ backgroundColor: "#4f46e5", color: "#fff" }}>
          <Plus className="w-3.5 h-3.5" /> New Quote
        </button>
      </div>
      {quotes.length === 0 ? (
        <div className="px-4 py-10 text-center"><p className="text-sm" style={{ color: "var(--text-muted)" }}>No estimates for this project yet.</p></div>
      ) : quotes.map((q, i) => {
        const s = QUOTE_STATUS_STYLE[q.status];
        return (
          <Link key={q.id} href={`/quotes/${q.id}`}
            className="flex items-center gap-4 px-4 py-3 hover:bg-[var(--bg-surface-2)] transition-colors"
            style={{ borderBottom: i < quotes.length - 1 ? "1px solid var(--border-subtle)" : "none", textDecoration: "none" }}>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-mono font-medium" style={{ color: "var(--text-primary)" }}>{q.quoteNumber}</p>
              <p className="text-xs mt-0.5 truncate" style={{ color: "var(--text-muted)" }}>{q.title}</p>
            </div>
            <StatusBadge label={s.label} color={s.color} className="shrink-0" />
            <span className="text-sm font-semibold shrink-0" style={{ color: "var(--text-primary)" }}>{q.total > 0 ? fmtCurrency(q.total) : "TBD"}</span>
          </Link>
        );
      })}
    </div>
  );
}

// ─── Invoices tab ─────────────────────────────────────────
function ProjectInvoicesTab({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [wizard, setWizard] = useState(false);
  const project  = getProject(projectId)!;
  const invoices = getInvoicesForProject(projectId);

  return (
    <div className="rounded-xl overflow-hidden max-w-3xl" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-subtle)", boxShadow: "var(--shadow-card)" }}>
      {wizard && (
        <InvoiceWizard preset={{ customerId: project.accountId, projectId, lockCustomer: true }}
          onClose={() => setWizard(false)}
          onCreated={(id) => { setWizard(false); router.push(`/invoices/${id}`); }} />
      )}
      <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
        <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Invoices ({invoices.length})</p>
        <button onClick={() => setWizard(true)} className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg"
          style={{ backgroundColor: "#4f46e5", color: "#fff" }}>
          <Plus className="w-3.5 h-3.5" /> New Invoice
        </button>
      </div>
      {invoices.length === 0 ? (
        <div className="px-4 py-10 text-center"><p className="text-sm" style={{ color: "var(--text-muted)" }}>No invoices for this project yet.</p></div>
      ) : invoices.map((inv, i) => {
        const s = INVOICE_STATUS_STYLE[inv.status];
        return (
          <Link key={inv.id} href={`/invoices/${inv.id}`}
            className="flex items-center gap-4 px-4 py-3 hover:bg-[var(--bg-surface-2)] transition-colors"
            style={{ borderBottom: i < invoices.length - 1 ? "1px solid var(--border-subtle)" : "none", textDecoration: "none" }}>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-mono font-medium" style={{ color: "var(--text-primary)" }}>{inv.invoiceNumber}</p>
              <p className="text-xs mt-0.5 truncate" style={{ color: "var(--text-muted)" }}>
                {inv.balanceDue > 0 ? `Balance ${fmtCurrency(inv.balanceDue)}` : "Paid in full"}
              </p>
            </div>
            <StatusBadge label={s.label} color={s.color} className="shrink-0" />
            <span className="text-sm font-semibold shrink-0" style={{ color: "var(--text-primary)" }}>{fmtCurrency(inv.total)}</span>
          </Link>
        );
      })}
    </div>
  );
}
function StubTab({ label }: { label: string }) {
  return <div className="rounded-xl p-10 text-center" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-subtle)" }}><p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{label}</p><p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>Coming soon</p></div>;
}

// ─── Page ─────────────────────────────────────────────────
function ProjectDetailContent({ params }: { params: Promise<{ id: string }> }) {
  const { id }    = use(params);
  const router    = useRouter();
  const searchParams = useSearchParams();
  // Tab is URL-synced (?tab=) so comment deep-links land on the right tab.
  const [tab, setTabState] = useState(() => { const t = searchParams.get("tab"); return t && TABS.includes(t) ? t : "Overview"; });
  function setTab(t: string) {
    setTabState(t);
    router.replace(`/projects/${id}?tab=${encodeURIComponent(t)}`, { scroll: false });
  }
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [editing, setEditing] = useState(false);
  const [, setRefreshKey] = useState(0);   // bump to re-read after edits / phase→stage changes

  const project = getProject(id);
  if (!project) {
    return (
      <div className="p-6">
        <Link href="/projects" className="flex items-center gap-1.5 text-sm mb-4" style={{ color: "var(--text-secondary)" }}>
          <ArrowLeft className="w-4 h-4" /> Back to Projects
        </Link>
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>Project not found.</p>
      </div>
    );
  }

  // Stage is the source of truth — show it as the badge.
  const stageDef = getProjectStages({ companyId: project.companyId, locationId: project.locationId }).find(st => st.key === project.stage);
  // Prefer phase progress (the new milestone model); fall back to jobs when a
  // project has no phases yet.
  const ph       = phaseProgress(id);
  const jobProg  = getProjectProgress(id);
  const usePhases = ph.total > 0;
  const pct      = usePhases ? ph.pct : (jobProg.total > 0 ? Math.round((jobProg.completed / jobProg.total) * 100) : 0);
  const progLabel = usePhases ? `${ph.done}/${ph.total} phases` : `${jobProg.completed}/${jobProg.total} jobs`;

  return (
    <div className="flex flex-col h-full">
      <div style={{ backgroundColor: "var(--bg-surface)", borderBottom: "1px solid var(--border-subtle)" }}>
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-4 min-w-0">
            <Link href="/projects" className="flex items-center gap-1.5 text-sm shrink-0" style={{ color: "var(--text-secondary)" }}>
              <ArrowLeft className="w-4 h-4" /> Projects
            </Link>
            <div className="w-px h-5 shrink-0" style={{ backgroundColor: "var(--border)" }} />
            <Commentable anchor={{ recordType: "project", recordId: id, recordLabel: project.customerName }}>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>{project.name}</h1>
                <StatusBadge label={stageDef?.name ?? "—"} color={stageDef?.color ?? "#6b7280"} />
              </div>
              <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                {project.customerName} · {progLabel} complete · {pct}%
              </p>
            </div>
            </Commentable>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <ActionsMenu actions={[
              { label: "Edit project", icon: Pencil, onClick: () => setEditing(true) },
              { label: "Delete project", icon: Trash2, onClick: () => setConfirmDelete(true), danger: true, separated: true },
            ]} />
          </div>
        </div>
        {/* Tabs — rectangle translucent style, consistent with section + customer tabs */}
        <div className="flex items-center gap-0.5 px-6 py-2 overflow-x-auto">
          {TABS.map(t => {
            const active = tab === t;
            return (
              <button key={t} onClick={() => setTab(t)}
                className="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap shrink-0"
                style={{
                  backgroundColor: active ? "var(--accent-soft-bg)" : "transparent",
                  color: active ? "var(--accent-text)" : "var(--text-muted)",
                  border: `1px solid ${active ? "var(--accent-soft-border)" : "transparent"}`,
                }}>
                {t}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6" style={{ backgroundColor: "var(--bg-page)" }}>
        {tab === "Overview"      && <OverviewTab projectId={id} onChange={() => setRefreshKey(k => k + 1)} onOpenPhases={() => setTab("Phases")} />}
        {tab === "Phases"        && <PhasesTab   projectId={id} onChange={() => setRefreshKey(k => k + 1)} />}
        {tab === "Jobs"          && <JobsTab     projectId={id} />}
        {tab === "Tasks"         && <TasksTab    projectId={id} />}
        {tab === "Scope"         && <ScopeTab    projectId={id} />}
        {tab === "Photos & Files"&& <PhotoGallery recordLevel="project" scope={{ accountId: project.accountId, projectId: id }} accountName={project.customerName} />}
        {tab === "Estimates"     && <ProjectEstimatesTab projectId={id} />}
        {tab === "Invoices"      && <ProjectInvoicesTab projectId={id} />}
        {tab === "Notes"         && <StubTab label="Notes" />}
        {tab === "Timeline"      && <StubTab label="Timeline" />}
      </div>

      {editing && (
        <EditProjectModal project={project} onClose={() => setEditing(false)}
          onSaved={() => { setEditing(false); setRefreshKey(k => k + 1); }} />
      )}

      {confirmDelete && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setConfirmDelete(false)}>
          <div className="w-full max-w-md rounded-2xl overflow-hidden" onClick={e => e.stopPropagation()}
            style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-subtle)", boxShadow: "0 16px 48px rgba(0,0,0,0.24)" }}>
            <div className="px-6 py-5 flex items-start gap-3">
              <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: "#fee2e2" }}>
                <AlertCircle className="w-5 h-5" style={{ color: "#dc2626" }} />
              </div>
              <div>
                <h2 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>Delete project?</h2>
                <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
                  This permanently removes <span className="font-medium" style={{ color: "var(--text-primary)" }}>{project.name}</span>. Jobs under it are not deleted but lose their project link. This can&apos;t be undone.
                </p>
              </div>
            </div>
            <div className="px-6 py-4 flex justify-end gap-2" style={{ borderTop: "1px solid var(--border-subtle)" }}>
              <button onClick={() => setConfirmDelete(false)} className="px-4 py-2 rounded-lg text-sm font-medium" style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}>Cancel</button>
              <button onClick={() => { deleteProject(id); router.push("/projects"); }} className="px-4 py-2 rounded-lg text-sm font-medium text-white" style={{ backgroundColor: "#dc2626" }}>Delete Project</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ProjectDetailPage(props: { params: Promise<{ id: string }> }) {
  // Suspense boundary required because the content reads useSearchParams.
  return <Suspense fallback={null}><ProjectDetailContent {...props} /></Suspense>;
}
