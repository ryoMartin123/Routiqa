"use client";

import { use, useState, Suspense } from "react";
import Link from "next/link";
import { ArrowLeft, Pencil, Circle, ChevronRight, ArrowRight, MapPin, User, Calendar, DollarSign, Clock, Plus, Trash2, AlertCircle, Tag, Activity, Briefcase, ShoppingCart, Building2, UserCog, HardHat, Package, TrendingUp } from "lucide-react";
import { getProject, getProjectProgress, deleteProject, PROJECT_TYPE_LABELS } from "@/lib/projects/data";
import { getTasksForProject } from "@/lib/tasks/data";
import RecordTasks from "@/components/tasks/RecordTasks";
import { getProjectVendorLinks, assignmentsForProject, posForProject, materialRequestsForProject, poSubtotal } from "@/lib/inventory/data";
import ActionsMenu from "@/components/shared/ActionsMenu";
import EditProjectModal from "@/components/projects/EditProjectModal";
import JobWizard from "@/components/jobs/JobWizard";
import { mapProgress } from "@/lib/projects/map";
import { getProjectStages } from "@/lib/projects/settings";
import { getJobsForProject, JOB_STATUS_CONFIG } from "@/lib/jobs/data";
import StatusBadge from "@/components/shared/StatusBadge";
import { getCustomer } from "@/lib/customers/data";
import { getQuotesForProject, getInvoicesForProject, fmt as fmtCurrency } from "@/lib/quotes/data";
import { QUOTE_STATUS_STYLE, INVOICE_STATUS_STYLE } from "@/lib/quotes/types";
import InvoiceWizard from "@/components/quotes/InvoiceWizard";
import { useRouter, useSearchParams } from "next/navigation";
import Commentable from "@/components/comments/Commentable";
import QuoteTypeChooser from "@/components/quotes/create/QuoteTypeChooser";
import PhotoGallery from "@/components/files/PhotoGallery";
import DetailTabs from "@/components/shared/DetailTabs";
import ProjectMaterialsVendors from "@/components/projects/ProjectMaterialsVendors";
import ProjectMap from "@/components/projects/ProjectMap";
import ProjectBudget from "@/components/projects/ProjectBudget";
import ProjectActivity from "@/components/projects/ProjectActivity";

const TABS = ["Overview", "Map", "Jobs", "Tasks", "Materials & Vendors", "Budget", "Photos & Files", "Scope", "Estimates", "Invoices", "Notes", "Timeline"];

// Link to a job opened from this project — carries ?back so the job's Back button
// returns to this project's Jobs tab instead of the global Jobs list.
function jobHrefFromProject(jobId: string, projectId: string, projectName: string): string {
  const back = encodeURIComponent(`/projects/${projectId}?tab=Jobs`);
  return `/jobs/${jobId}?back=${back}&backLabel=${encodeURIComponent(projectName)}`;
}

// Minimal accent action — matches the Request Materials / Add Vendor buttons in
// Materials & Vendors (tinted circular + chip, no heavy fill).
function MiniAction({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className="group flex items-center gap-1.5 text-xs font-medium transition-colors" style={{ color: "#4f46e5" }}>
      <span className="w-4 h-4 rounded-full flex items-center justify-center transition-all group-hover:brightness-95" style={{ backgroundColor: "#4f46e51a" }}><Plus className="w-3 h-3" /></span>
      {children}
    </button>
  );
}

// "View all / View map…" affordance — the arrow tilts up to a 45° up-right angle
// and nudges outward on hover, so the "go there" cue feels alive. Shared by every
// Overview card link so they read identically.
function ViewLink({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className="group inline-flex items-center gap-1 text-xs font-medium transition-colors hover:brightness-110" style={{ color: "var(--accent-text)" }}>
      {children}
      <ArrowRight className="w-3.5 h-3.5 transition-transform duration-200 ease-out group-hover:-rotate-45 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
    </button>
  );
}

// ─── Workflow summary (Overview) ──────────────────────────
// Compact read-out of where the project is, driven by the Map (the source of
// truth). Links to the full Map tab.
function WorkflowSummary({ projectId, onOpenMap }: { projectId: string; onOpenMap?: () => void }) {
  const prog = mapProgress(projectId);
  const allDone = prog.total > 0 && prog.done === prog.total;
  return (
    <div className="rounded-xl p-4" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" }}>
      <div className="flex items-center justify-between mb-2">
        <p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>Workflow Progress</p>
        {onOpenMap && <ViewLink onClick={onOpenMap}>View map</ViewLink>}
      </div>
      {prog.total === 0 ? (
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>No workflow steps yet.</p>
      ) : (
        <>
          <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{allDone ? "All steps complete" : `${prog.done} of ${prog.total} steps done`}</p>
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

// ─── Overview tab ─────────────────────────────────────────
// Summary stat cards + a read-only details grid — same shape as the Customer /
// Agreement overviews, with a Materials & Vendors KPI (Inventory owns the
// masters; the project links to them).
const money = (n: number) => `$${n.toLocaleString()}`;
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function OverviewTab({ projectId, onOpenMap, onOpenTab }: { projectId: string; onOpenMap?: () => void; onOpenTab: (t: string) => void }) {
  const project  = getProject(projectId)!;
  const jobs     = getJobsForProject(projectId);
  const tasks    = getTasksForProject(projectId);
  const openTasks = tasks.filter(t => t.status !== "completed");

  const stageDef = getProjectStages({ companyId: project.companyId, locationId: project.locationId }).find(st => st.key === project.stage);
  const jobProg = getProjectProgress(projectId);
  const prog = mapProgress(projectId);
  const pct = prog.pct;
  const progLabel = `${prog.done}/${prog.total} steps`;

  // Materials & Vendors KPIs.
  const links = getProjectVendorLinks(projectId);
  const assignments = assignmentsForProject(projectId);
  const pos = posForProject(projectId);
  const requests = materialRequestsForProject(projectId);
  const committed =
    links.reduce((s, l) => s + (l.amountCommitted ?? 0), 0) +
    assignments.reduce((s, a) => s + (a.contractAmount ?? 0), 0) +
    pos.reduce((s, p) => s + poSubtotal(p), 0);

  return (
    <div className="flex flex-col gap-5 h-full min-h-0">
      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <Stat icon={Activity}     label="Stage"          value={stageDef?.name ?? "—"} accent={stageDef?.color} sub={PROJECT_TYPE_LABELS[project.type]} />
        <Stat icon={TrendingUp}   label="Progress"       value={`${pct}%`} sub={progLabel} />
        <Stat icon={DollarSign}   label="Value"          value={project.estimatedValue || "—"} sub="Estimated" />
        <Stat icon={Briefcase}    label="Jobs"           value={`${jobProg.completed}/${jobProg.total || jobs.length}`} sub="completed" />
        <Stat icon={ShoppingCart} label="Committed Cost" value={money(committed)} accent="#10b981" sub={`${pos.length} PO${pos.length === 1 ? "" : "s"} · ${assignments.length} sub${assignments.length === 1 ? "" : "s"}`} />
        <Stat icon={Calendar}     label="Target Date"    value={project.targetDate ?? "—"} sub={project.startDate ? `Start ${project.startDate}` : undefined} />
      </div>

      {/* Details + side */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <DCard className="p-4 lg:col-span-2">
          <DLabel>Project Details</DLabel>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 mt-3">
            <DRow icon={Tag}       label="Type" value={PROJECT_TYPE_LABELS[project.type]} />
            <DRow icon={Activity}  label="Priority" value={cap(project.priority)} />
            <DRow icon={User}      label="Customer / Account" value={project.customerName} />
            <DRow icon={MapPin}    label="Property" value={project.propertyAddress ?? "—"} />
            <DRow icon={Building2} label="Branch" value={project.locationName} />
            <DRow icon={UserCog}   label="Assigned To" value={project.assignedTo} />
            <DRow icon={Calendar}  label="Start Date" value={project.startDate ?? "—"} />
            <DRow icon={Calendar}  label="Target Date" value={project.targetDate ?? "—"} />
          </div>
          {project.scope && (
            <div className="mt-4 pt-3" style={{ borderTop: "1px solid var(--border)" }}>
              <DLabel>Scope</DLabel>
              <p className="text-sm mt-2 whitespace-pre-line line-clamp-4" style={{ color: "var(--text-secondary)" }}>{project.scope}</p>
            </div>
          )}
        </DCard>

        <div className="flex flex-col gap-4">
          <WorkflowSummary projectId={projectId} onOpenMap={onOpenMap} />

          {/* Materials & Vendors KPI */}
          <DCard className="p-4">
            <div className="flex items-center justify-between mb-3">
              <DLabel>Materials &amp; Vendors</DLabel>
              <ViewLink onClick={() => onOpenTab("Materials & Vendors")}>View vendors</ViewLink>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <MiniKpi icon={Building2}    label="Vendors" value={links.length} />
              <MiniKpi icon={HardHat}      label="Subcontractors" value={assignments.length} />
              <MiniKpi icon={ShoppingCart} label="Purchase Orders" value={pos.length} />
              <MiniKpi icon={Package}      label="Material Requests" value={requests.length} />
            </div>
            <div className="flex items-center justify-between mt-3 pt-3" style={{ borderTop: "1px solid var(--border)" }}>
              <span className="text-xs" style={{ color: "var(--text-muted)" }}>Committed cost</span>
              <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{money(committed)}</span>
            </div>
          </DCard>
        </div>
      </div>

      {/* Jobs + tasks — fills the remaining height; lists scroll internally */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 flex-1 min-h-0">
        <DCard className="lg:col-span-2 overflow-hidden flex flex-col min-h-0">
          <div className="flex items-center justify-between px-4 py-3 shrink-0" style={{ borderBottom: "1px solid var(--border)" }}>
            <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Jobs</p>
            <ViewLink onClick={() => onOpenTab("Jobs")}>View all</ViewLink>
          </div>
          <div className="flex-1 overflow-y-auto min-h-0">
          {jobs.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm" style={{ color: "var(--text-muted)" }}>No jobs on this project yet.</p>
          ) : jobs.map((job, i) => {
            const js = JOB_STATUS_CONFIG[job.status];
            return (
              <Link key={job.id} href={jobHrefFromProject(job.id, projectId, project.name)}
                className="flex items-center justify-between px-4 py-3 hover:bg-[var(--bg-surface-2)] transition-colors"
                style={i < jobs.length - 1 ? { borderBottom: "1px solid var(--border)" } : undefined}>
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
        </DCard>

        <DCard className="overflow-hidden flex flex-col min-h-0">
          <div className="flex items-center justify-between px-4 py-3 shrink-0" style={{ borderBottom: "1px solid var(--border)" }}>
            <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Open Tasks ({openTasks.length})</p>
            <ViewLink onClick={() => onOpenTab("Tasks")}>View all</ViewLink>
          </div>
          <div className="flex-1 overflow-y-auto min-h-0">
          {openTasks.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm" style={{ color: "var(--text-muted)" }}>No open tasks.</p>
          ) : openTasks.map((task, i) => (
            <div key={task.id} className="flex items-center justify-between px-4 py-2.5"
              style={i < openTasks.length - 1 ? { borderBottom: "1px solid var(--border)" } : undefined}>
              <div className="flex items-center gap-2.5 min-w-0">
                <Circle className="w-4 h-4 shrink-0" style={{ color: "var(--border)" }} />
                <span className="text-sm truncate" style={{ color: "var(--text-primary)" }}>{task.title}</span>
              </div>
              {task.dueDate && <span className="text-xs shrink-0" style={{ color: "var(--text-muted)" }}>{task.dueDate}</span>}
            </div>
          ))}
          </div>
        </DCard>
      </div>
    </div>
  );
}

// ─── Overview presentational primitives (match Customer/Agreement overviews) ──
function Stat({ icon: Icon, label, value, sub, accent }: { icon: typeof Activity; label: string; value: React.ReactNode; sub?: string; accent?: string }) {
  return (
    <div className="rounded-xl p-3.5" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" }}>
      <div className="flex items-center gap-1.5 mb-1.5">
        <Icon className="w-3.5 h-3.5" style={{ color: accent ?? "var(--text-muted)" }} />
        <p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>{label}</p>
      </div>
      <p className="text-base font-bold leading-tight truncate" style={{ color: accent ?? "var(--text-primary)" }}>{value}</p>
      {sub && <p className="text-[11px] mt-0.5 truncate" style={{ color: "var(--text-muted)" }}>{sub}</p>}
    </div>
  );
}
function DCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-xl ${className}`} style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" }}>{children}</div>;
}
function DLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>{children}</p>;
}
function DRow({ icon: Icon, label, value }: { icon?: typeof Activity; label: string; value: React.ReactNode }) {
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
function MiniKpi({ icon: Icon, label, value }: { icon: typeof Activity; label: string; value: number }) {
  return (
    <div className="rounded-lg px-2.5 py-2 flex items-center gap-2" style={{ backgroundColor: "var(--bg-surface-2)", border: "1px solid var(--border)" }}>
      <Icon className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--text-muted)" }} />
      <div className="min-w-0">
        <p className="text-base font-bold leading-none" style={{ color: "var(--text-primary)" }}>{value}</p>
        <p className="text-[10px] truncate" style={{ color: "var(--text-muted)" }}>{label}</p>
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
    <div className="rounded-xl overflow-hidden" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" }}>
      {wizard && (
        <JobWizard preset={{ customerId: project.accountId, projectId, lockCustomer: true }}
          onClose={() => setWizard(false)}
          onCreated={(jid) => { setWizard(false); forceRefresh(n => n + 1); router.push(jobHrefFromProject(jid, projectId, project.name)); }} />
      )}
      <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
        <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Jobs ({jobs.length})</p>
        <MiniAction onClick={() => setWizard(true)}>Add Job</MiniAction>
      </div>
      {jobs.length === 0 ? (
        <div className="px-4 py-10 text-center"><p className="text-sm" style={{ color: "var(--text-muted)" }}>No jobs on this project yet.</p></div>
      ) : (
      <>
      <div className="grid px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider"
        style={{ gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr 1fr", color: "var(--text-muted)", borderBottom: "1px solid var(--border)", backgroundColor: "transparent" }}>
        <span>Job</span><span>Type</span><span>Status</span><span>Date</span><span>Tech</span><span>Amount</span>
      </div>
      {jobs.map((job, i) => {
        const s = JOB_STATUS_CONFIG[job.status];
        return (
          <Link key={job.id} href={jobHrefFromProject(job.id, projectId, project.name)}
            className="grid px-4 py-3 items-center hover:bg-[var(--bg-surface-2)] transition-colors"
            style={{ gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr 1fr", borderBottom: i < jobs.length - 1 ? "1px solid var(--border)" : "none", textDecoration: "none" }}>
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
// Project tasks come from the central tasks store (so anything created here — or
// linked to the project elsewhere — shows up). Create + complete inline.
// ─── Scope tab ────────────────────────────────────────────
function ScopeTab({ projectId }: { projectId: string }) {
  const project = getProject(projectId)!;
  if (!project.scope) return <StubContent label="No scope document added yet." />;
  return (
    <div className="max-w-2xl">
      <div className="rounded-xl p-6" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" }}>
        <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: "var(--text-muted)" }}>Scope of Work</p>
        <p className="text-sm leading-relaxed whitespace-pre-line" style={{ color: "var(--text-secondary)" }}>{project.scope}</p>
      </div>
    </div>
  );
}

function StubContent({ label }: { label: string }) {
  return <div className="rounded-xl p-10 text-center" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)" }}><p className="text-sm" style={{ color: "var(--text-muted)" }}>{label}</p></div>;
}

// ─── Estimates (quotes) tab ───────────────────────────────
function ProjectEstimatesTab({ projectId }: { projectId: string }) {
  const [wizard, setWizard] = useState(false);
  const project = getProject(projectId)!;
  const quotes  = getQuotesForProject(projectId);

  return (
    <div className="rounded-xl overflow-hidden w-full" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" }}>
      {wizard && (
        <QuoteTypeChooser preset={{ customerId: project.accountId, projectId, lockCustomer: true }}
          onClose={() => setWizard(false)} />
      )}
      <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
        <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Estimates ({quotes.length})</p>
        <MiniAction onClick={() => setWizard(true)}>New Quote</MiniAction>
      </div>
      {quotes.length === 0 ? (
        <div className="px-4 py-10 text-center"><p className="text-sm" style={{ color: "var(--text-muted)" }}>No estimates for this project yet.</p></div>
      ) : quotes.map((q, i) => {
        const s = QUOTE_STATUS_STYLE[q.status];
        return (
          <Link key={q.id} href={`/quotes/${q.id}`}
            className="flex items-center gap-4 px-4 py-3 hover:bg-[var(--bg-surface-2)] transition-colors"
            style={{ borderBottom: i < quotes.length - 1 ? "1px solid var(--border)" : "none", textDecoration: "none" }}>
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
    <div className="rounded-xl overflow-hidden w-full" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" }}>
      {wizard && (
        <InvoiceWizard preset={{ customerId: project.accountId, projectId, lockCustomer: true }}
          onClose={() => setWizard(false)}
          onCreated={(id) => { setWizard(false); router.push(`/invoices/${id}`); }} />
      )}
      <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
        <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Invoices ({invoices.length})</p>
        <MiniAction onClick={() => setWizard(true)}>New Invoice</MiniAction>
      </div>
      {invoices.length === 0 ? (
        <div className="px-4 py-10 text-center"><p className="text-sm" style={{ color: "var(--text-muted)" }}>No invoices for this project yet.</p></div>
      ) : invoices.map((inv, i) => {
        const s = INVOICE_STATUS_STYLE[inv.status];
        return (
          <Link key={inv.id} href={`/invoices/${inv.id}`}
            className="flex items-center gap-4 px-4 py-3 hover:bg-[var(--bg-surface-2)] transition-colors"
            style={{ borderBottom: i < invoices.length - 1 ? "1px solid var(--border)" : "none", textDecoration: "none" }}>
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
  return <div className="rounded-xl p-10 text-center" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)" }}><p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{label}</p><p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>Coming soon</p></div>;
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

  // Progress is driven by the project Map (the single source of truth).
  const prog     = mapProgress(id);
  const pct      = prog.pct;
  const progLabel = `${prog.done}/${prog.total} steps`;

  return (
    <div className="flex flex-col h-full">
      <div style={{ backgroundColor: "var(--bg-surface)", borderBottom: "1px solid var(--border)" }}>
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
        {/* Sub-tabs — glossy light-amber (comment-mode accent) */}
        <DetailTabs tabs={TABS} active={tab} onChange={setTab} className="px-6 py-2" />
      </div>

      <div className="flex-1 overflow-y-auto p-6" style={{ backgroundColor: "var(--bg-page)" }}>
        {tab === "Overview"      && <OverviewTab projectId={id} onOpenMap={() => setTab("Map")} onOpenTab={setTab} />}
        {tab === "Map"           && <ProjectMap projectId={id} onOpenTab={setTab} />}
        {tab === "Jobs"          && <JobsTab     projectId={id} />}
        {tab === "Tasks"         && <RecordTasks type="project" id={id} />}
        {tab === "Materials & Vendors" && <ProjectMaterialsVendors projectId={id} projectName={project.name} />}
        {tab === "Budget"        && <ProjectBudget projectId={id} />}
        {tab === "Scope"         && <ScopeTab    projectId={id} />}
        {tab === "Photos & Files"&& <PhotoGallery recordLevel="project" scope={{ accountId: project.accountId, projectId: id }} accountName={project.customerName} />}
        {tab === "Estimates"     && <ProjectEstimatesTab projectId={id} />}
        {tab === "Invoices"      && <ProjectInvoicesTab projectId={id} />}
        {tab === "Notes"         && <StubTab label="Notes" />}
        {tab === "Timeline"      && <ProjectActivity projectId={id} />}
      </div>

      {editing && (
        <EditProjectModal project={project} onClose={() => setEditing(false)}
          onSaved={() => { setEditing(false); setRefreshKey(k => k + 1); }} />
      )}

      {confirmDelete && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setConfirmDelete(false)}>
          <div className="w-full max-w-md rounded-2xl overflow-hidden" onClick={e => e.stopPropagation()}
            style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "0 16px 48px rgba(0,0,0,0.24)" }}>
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
            <div className="px-6 py-4 flex justify-end gap-2" style={{ borderTop: "1px solid var(--border)" }}>
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
