"use client";

import { use, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Pencil, CheckCircle, Circle, ChevronRight, MapPin, User, Calendar, DollarSign, Clock, Plus } from "lucide-react";
import { getProject, getProjectTasks, getProjectProgress, PROJECT_STATUS_CONFIG, PROJECT_TYPE_LABELS } from "@/lib/projects/data";
import { getJobsForProject, JOB_STATUS_CONFIG } from "@/lib/jobs/data";
import { getCustomer } from "@/lib/customers/data";
import { getQuotesForProject, fmt as fmtCurrency } from "@/lib/quotes/data";
import { QUOTE_STATUS_STYLE } from "@/lib/quotes/types";
import QuoteWizard from "@/components/quotes/QuoteWizard";
import PhotoGallery from "@/components/files/PhotoGallery";

const TABS = ["Overview", "Jobs", "Tasks", "Photos & Files", "Scope", "Estimates", "Invoices", "Notes", "Timeline"];

// ─── Overview tab ─────────────────────────────────────────
function OverviewTab({ projectId }: { projectId: string }) {
  const project  = getProject(projectId)!;
  const jobs     = getJobsForProject(projectId);
  const tasks    = getProjectTasks(projectId);
  const progress = getProjectProgress(projectId);
  const pct      = progress.total > 0 ? Math.round((progress.completed / progress.total) * 100) : 0;
  const s        = PROJECT_STATUS_CONFIG[project.status];
  const openTasks = tasks.filter(t => !t.isComplete);

  return (
    <div className="grid grid-cols-3 gap-6">
      {/* Left: project details */}
      <div className="space-y-4">
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

      {/* Right: progress + jobs + tasks */}
      <div className="col-span-2 space-y-4">
        {/* Progress */}
        <div className="rounded-xl p-5" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-subtle)", boxShadow: "var(--shadow-card)" }}>
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Project Progress</p>
            <span className="text-sm font-bold" style={{ color: pct === 100 ? "#10b981" : "#4f46e5" }}>{pct}%</span>
          </div>
          <div className="h-2.5 rounded-full mb-3" style={{ backgroundColor: "var(--bg-input)" }}>
            <div className="h-2.5 rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: pct === 100 ? "#10b981" : "#4f46e5" }} />
          </div>
          <div className="flex gap-6">
            {[
              { label: "Total Jobs",  value: String(progress.total) },
              { label: "Completed",   value: String(progress.completed) },
              { label: "Remaining",   value: String(progress.total - progress.completed) },
            ].map(({ label, value }) => (
              <div key={label}>
                <p className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>{value}</p>
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>{label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Jobs summary */}
        <div className="rounded-xl overflow-hidden" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-subtle)", boxShadow: "var(--shadow-card)" }}>
          <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
            <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Jobs</p>
            <Link href={`/projects/${projectId}?tab=Jobs`} className="text-xs font-medium text-indigo-600 hover:text-indigo-700">View all</Link>
          </div>
          {jobs.map((job, i) => {
            const js = JOB_STATUS_CONFIG[job.status];
            return (
              <Link key={job.id} href={`/jobs/${job.id}`}
                className="flex items-center justify-between px-4 py-3 hover:bg-[var(--bg-surface-2)] transition-colors"
                style={i < jobs.length - 1 ? { borderBottom: "1px solid var(--border-subtle)" } : undefined}>
                <div>
                  <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{job.title}</p>
                  <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{job.scheduledDate} · {job.assignedTo}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: js.bg, color: js.color }}>{js.label}</span>
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
  const jobs = getJobsForProject(projectId);
  return (
    <div className="rounded-xl overflow-hidden" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-subtle)", boxShadow: "var(--shadow-card)" }}>
      <div className="grid px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider"
        style={{ gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr 1fr", color: "var(--text-muted)", borderBottom: "1px solid var(--border-subtle)", backgroundColor: "var(--bg-surface-2)" }}>
        <span>Job</span><span>Type</span><span>Status</span><span>Date</span><span>Tech</span><span>Amount</span>
      </div>
      {jobs.map((job, i) => {
        const s = JOB_STATUS_CONFIG[job.status];
        return (
          <Link key={job.id} href={`/jobs/${job.id}`}
            className="grid px-4 py-3 items-center hover:bg-[var(--bg-surface-2)] transition-colors"
            style={{ gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr 1fr", borderBottom: i < jobs.length - 1 ? "1px solid var(--border-subtle)" : "none", textDecoration: "none" }}>
            <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{job.title}</span>
            <span className="text-sm capitalize" style={{ color: "var(--text-secondary)" }}>{job.type}</span>
            <span className="inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: s.bg, color: s.color }}>{s.label}</span>
            <span className="text-sm" style={{ color: "var(--text-secondary)" }}>{job.scheduledDate}</span>
            <span className="text-sm" style={{ color: "var(--text-secondary)" }}>{job.assignedTo}</span>
            <span className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>{job.estimatedAmount ?? "—"}</span>
          </Link>
        );
      })}
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
  const [wizard, setWizard] = useState(false);
  const [, forceRefresh] = useState(0);
  const project = getProject(projectId)!;
  const quotes  = getQuotesForProject(projectId);

  return (
    <div className="rounded-xl overflow-hidden max-w-3xl" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-subtle)", boxShadow: "var(--shadow-card)" }}>
      {wizard && (
        <QuoteWizard preset={{ customerId: project.accountId, projectId, lockCustomer: true }}
          onClose={() => setWizard(false)}
          onCreated={() => { setWizard(false); forceRefresh(n => n + 1); }} />
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
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0" style={{ backgroundColor: s.bg, color: s.color }}>{s.label}</span>
            <span className="text-sm font-semibold shrink-0" style={{ color: "var(--text-primary)" }}>{q.total > 0 ? fmtCurrency(q.total) : "TBD"}</span>
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
export default function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id }    = use(params);
  const [tab, setTab] = useState("Overview");

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

  const s        = PROJECT_STATUS_CONFIG[project.status];
  const progress = getProjectProgress(id);
  const pct      = progress.total > 0 ? Math.round((progress.completed / progress.total) * 100) : 0;

  return (
    <div className="flex flex-col h-full">
      <div style={{ backgroundColor: "var(--bg-surface)", borderBottom: "1px solid var(--border-subtle)" }}>
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-4 min-w-0">
            <Link href="/projects" className="flex items-center gap-1.5 text-sm shrink-0" style={{ color: "var(--text-secondary)" }}>
              <ArrowLeft className="w-4 h-4" /> Projects
            </Link>
            <div className="w-px h-5 shrink-0" style={{ backgroundColor: "var(--border)" }} />
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>{project.name}</h1>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: s.bg, color: s.color }}>{s.label}</span>
              </div>
              <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                {project.customerName} · {progress.completed}/{progress.total} jobs complete · {pct}%
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm" style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}>
              <Pencil className="w-3.5 h-3.5" /> Edit
            </button>
            <Link href={`/jobs/new?projectId=${id}`} className="px-3 py-1.5 rounded-lg text-sm font-medium bg-indigo-600 hover:bg-indigo-700 text-white transition-colors">
              + Add Job
            </Link>
          </div>
        </div>
        <div className="flex items-center gap-0.5 px-6 overflow-x-auto">
          {TABS.map(t => {
            const active = tab === t;
            return (
              <button key={t} onClick={() => setTab(t)}
                className="relative px-3 py-2.5 text-sm font-medium transition-colors whitespace-nowrap shrink-0"
                style={{ color: active ? "#4f46e5" : "var(--text-muted)" }}>
                {t}
                {active && <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-t bg-indigo-600" />}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6" style={{ backgroundColor: "var(--bg-page)" }}>
        {tab === "Overview"      && <OverviewTab projectId={id} />}
        {tab === "Jobs"          && <JobsTab     projectId={id} />}
        {tab === "Tasks"         && <TasksTab    projectId={id} />}
        {tab === "Scope"         && <ScopeTab    projectId={id} />}
        {tab === "Photos & Files"&& <PhotoGallery recordLevel="project" scope={{ accountId: project.accountId, projectId: id }} accountName={project.customerName} />}
        {tab === "Estimates"     && <ProjectEstimatesTab projectId={id} />}
        {tab === "Invoices"      && <StubTab label="Invoices" />}
        {tab === "Notes"         && <StubTab label="Notes" />}
        {tab === "Timeline"      && <StubTab label="Timeline" />}
      </div>
    </div>
  );
}
