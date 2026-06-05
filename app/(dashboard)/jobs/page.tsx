"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import JobWizard from "@/components/jobs/JobWizard";
import { Search, Plus, SlidersHorizontal, ChevronUp, ChevronDown, FolderKanban, Calendar, CalendarClock, Loader, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { ALL_JOBS, getSessionJobs, resolveJobStatus, type Job, type JobType } from "@/lib/jobs/data";
import { ALL_PROJECTS, getSessionProjects, PROJECT_STATUS_CONFIG, getProjectProgress, type Project, type ProjectStatus } from "@/lib/projects/data";
import { getJobStatuses } from "@/lib/job-config/data";
import { useHierarchy } from "@/components/providers/HierarchyProvider";
import { usePermissions } from "@/components/providers/PermissionProvider";
import ModuleSummaryCards, { type SummaryCard } from "@/components/shared/ModuleSummaryCards";
import ModuleViewToggle, { type ModuleView } from "@/components/shared/ModuleViewToggle";
import StatusTabs from "@/components/shared/StatusTabs";

const TODAY = "May 30, 2026";

function daysAgo(dateStr?: string): number {
  if (!dateStr) return Infinity;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return Infinity;
  return (Date.now() - d.getTime()) / 86_400_000;
}

// ─── Filter tabs ──────────────────────────────────────────
const TABS = [
  { key: "today",       label: "Today",       fn: (j: Job) => j.scheduledDate === TODAY || j.status === "in_progress" || j.status === "en_route" },
  { key: "scheduled",   label: "Scheduled",   fn: (j: Job) => j.status === "scheduled" && j.scheduledDate !== TODAY },
  { key: "in_progress", label: "In Progress", fn: (j: Job) => j.status === "in_progress" || j.status === "en_route" },
  { key: "completed",   label: "Completed",   fn: (j: Job) => j.status === "completed" },
  { key: "all",         label: "All",         fn: (_: Job) => true },
  { key: "projects",    label: "Projects",    fn: (_: Job) => false }, // special view
];

type SortField = "customerName" | "type" | "status" | "scheduledDate" | "assignedTo";

// ─── Mini projects table (shown when Projects tab active) ─
function ProjectsInline({ projects, companyId, locationId }: { projects: Project[]; companyId?: string; locationId?: string }) {
  const filtered = projects
    .filter(p => !companyId  || p.companyId  === companyId)
    .filter(p => !locationId || p.locationId === locationId);

  return (
    <div className="rounded-xl overflow-hidden" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-subtle)", boxShadow: "var(--shadow-card)" }}>
      <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: "1px solid var(--border-subtle)", backgroundColor: "var(--bg-surface-2)" }}>
        <div className="flex items-center gap-2">
          <FolderKanban className="w-4 h-4" style={{ color: "var(--text-muted)" }} />
          <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Active Projects</span>
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ backgroundColor: "var(--bg-input)", color: "var(--text-muted)" }}>{filtered.length}</span>
        </div>
        <Link href="/projects" className="text-xs font-medium text-indigo-600 hover:text-indigo-700">View all projects →</Link>
      </div>

      {/* Column headers */}
      <div className="grid px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider" style={{ gridTemplateColumns: "2.5fr 1fr 1fr 1fr 1fr 1fr", color: "var(--text-muted)", borderBottom: "1px solid var(--border-subtle)", backgroundColor: "var(--bg-surface-2)" }}>
        <span>Project</span><span>Type</span><span>Status</span><span>Target Date</span><span>Progress</span><span>Value</span>
      </div>

      {filtered.map((p, i) => {
        const s = PROJECT_STATUS_CONFIG[p.status];
        const prog = getProjectProgress(p.id);
        const pct = prog.total > 0 ? Math.round((prog.completed / prog.total) * 100) : 0;
        return (
          <Link key={p.id} href={`/projects/${p.id}`}
            className="grid px-4 py-3 items-center hover:bg-[var(--bg-surface-2)] transition-colors"
            style={{ gridTemplateColumns: "2.5fr 1fr 1fr 1fr 1fr 1fr", borderBottom: i < filtered.length - 1 ? "1px solid var(--border-subtle)" : "none", textDecoration: "none" }}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center text-[10px] font-bold text-indigo-600 shrink-0">{p.customerInitials}</div>
              <div className="min-w-0">
                <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>{p.name}</p>
                <p className="text-[10px] truncate" style={{ color: "var(--text-muted)" }}>{p.customerName}</p>
              </div>
            </div>
            <span className="text-sm" style={{ color: "var(--text-secondary)" }}>{p.type.charAt(0).toUpperCase() + p.type.slice(1)}</span>
            <span className="inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: s.bg, color: s.color }}>{s.label}</span>
            <span className="text-sm" style={{ color: "var(--text-secondary)" }}>{p.targetDate ?? "—"}</span>
            <div className="flex items-center gap-2">
              <div className="flex-1 h-1.5 rounded-full" style={{ backgroundColor: "var(--bg-input)" }}>
                <div className="h-1.5 rounded-full bg-indigo-500" style={{ width: `${pct}%` }} />
              </div>
              <span className="text-[10px] shrink-0" style={{ color: "var(--text-muted)" }}>{prog.completed}/{prog.total}</span>
            </div>
            <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{p.estimatedValue ?? "—"}</span>
          </Link>
        );
      })}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────
export default function JobsPage() {
  const { effectiveCompanyId, effectiveLocationId } = useHierarchy();
  const { can, accessLevel, fieldVisible, me } = usePermissions();

  // Scope: managers/admins see all jobs in context; techs see only their own.
  const jobsLevel = accessLevel("jobs", "view");
  const canCreateJob = can("jobs", "create");
  // Mask financial figures (job amount) unless the role may see totals.
  const showAmount = fieldVisible("finance_totals");
  const gridCols = showAmount ? "2.5fr 1fr 1fr 1.5fr 1fr 1fr" : "2.5fr 1fr 1fr 1.5fr 1fr";

  const router = useRouter();
  const [showCreate, setShowCreate] = useState(false);
  const [tab, setTab]         = useState("today");
  const [moduleView, setModuleView] = useState<ModuleView>("list");
  const [search, setSearch]   = useState("");
  const [sortField, setSort]  = useState<SortField>("scheduledDate");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  // Configured job statuses from settings (drive badge labels + colors).
  const [statusConfig, setStatusConfig] = useState<{ key: string; name: string; color: string }[]>([]);
  useEffect(() => { setStatusConfig(getJobStatuses().filter(s => s.active)); }, []);

  // Merge in session-created records (e.g. jobs/projects converted from quotes)
  // after mount so SSR and first client render match the seed (no hydration gap).
  const [extraJobs, setExtraJobs] = useState<Job[]>([]);
  const [extraProjects, setExtraProjects] = useState<Project[]>([]);
  useEffect(() => { setExtraJobs(getSessionJobs()); setExtraProjects(getSessionProjects()); }, []);
  const allJobs = [...extraJobs, ...ALL_JOBS];
  const allProjects = [...extraProjects, ...ALL_PROJECTS];

  const isProjects = tab === "projects";

  // Context filter + permission scope (all vs. own-assigned vs. none)
  const contextFiltered = allJobs
    .filter(j => !effectiveCompanyId  || j.companyId  === effectiveCompanyId)
    .filter(j => !effectiveLocationId || j.locationId === effectiveLocationId)
    .filter(j => jobsLevel === "all" ? true : jobsLevel === "own" ? j.assignedTo === me : false);

  // Summary metrics — respect the active context
  const summaryCards: SummaryCard[] = [
    { icon: Calendar,      label: "Today's Jobs",        value: String(contextFiltered.filter(j => j.scheduledDate === TODAY).length),                                  sub: "Scheduled today",   iconColor: "#4f46e5" },
    { icon: CalendarClock, label: "Scheduled",           value: String(contextFiltered.filter(j => j.status === "scheduled").length),                                   sub: "Upcoming work",     iconColor: "#0891b2" },
    { icon: Loader,        label: "In Progress",         value: String(contextFiltered.filter(j => j.status === "in_progress" || j.status === "en_route").length),       sub: "Active now",        iconColor: "#f59e0b" },
    { icon: CheckCircle2,  label: "Completed This Week", value: String(contextFiltered.filter(j => j.status === "completed" && daysAgo(j.completedDate) <= 7).length),    sub: "Last 7 days",       iconColor: "#10b981" },
  ];

  const tabFn = TABS.find(t => t.key === tab)?.fn ?? (() => true);

  const displayed = contextFiltered
    .filter(tabFn)
    .filter(j => {
      if (!search) return true;
      const q = search.toLowerCase();
      return j.customerName.toLowerCase().includes(q) || j.title.toLowerCase().includes(q) || j.assignedTo.toLowerCase().includes(q);
    })
    .sort((a, b) => {
      const av = a[sortField] ?? "", bv = b[sortField] ?? "";
      return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
    });

  function handleSort(field: SortField) {
    if (sortField === field) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSort(field); setSortDir("asc"); }
  }

  function SortIcon({ field }: { field: SortField }) {
    if (sortField !== field) return <ChevronDown className="w-3 h-3 opacity-30" />;
    return sortDir === "asc" ? <ChevronUp className="w-3 h-3" style={{ color: "#4f46e5" }} /> : <ChevronDown className="w-3 h-3" style={{ color: "#4f46e5" }} />;
  }

  return (
    <div className="p-6">
      {/* Header — title · centered view toggle · action */}
      <div className="flex items-center gap-4 mb-6">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-semibold" style={{ color: "var(--text-primary)" }}>Jobs</h1>
            <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: "var(--bg-input)", color: "var(--text-muted)" }}>{contextFiltered.length}</span>
          </div>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>Daily operations — all scheduled and active work</p>
        </div>
        <ModuleViewToggle view={moduleView} onChange={setModuleView} />
        <div className="flex-1 flex justify-end">
          {canCreateJob && (
            <button onClick={() => setShowCreate(true)} className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-3 py-2 rounded-lg transition-colors">
              <Plus className="w-4 h-4" /> New Job
            </button>
          )}
        </div>
      </div>

      {moduleView === "overview" && (
        <div className="mb-5">
          <ModuleSummaryCards cards={summaryCards} />
        </div>
      )}

      {/* Table card */}
      {moduleView === "list" && (
      <div className="rounded-xl overflow-hidden" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-subtle)", boxShadow: "var(--shadow-card)" }}>
        {/* Tabs + search */}
        <div className="flex items-center justify-between flex-wrap gap-2 px-4 py-3" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
          <StatusTabs active={tab} onChange={k => setTab(k as typeof tab)}
            tabs={TABS.map(t => ({
              key: t.key, label: t.label,
              icon: t.key === "projects" ? FolderKanban : undefined,
              count: t.key === "projects"
                ? allProjects.filter(p => (!effectiveCompanyId || p.companyId === effectiveCompanyId) && (!effectiveLocationId || p.locationId === effectiveLocationId)).length
                : contextFiltered.filter(t.fn).length,
            }))} />
          {!isProjects && (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 rounded-lg px-3 py-1.5" style={{ backgroundColor: "var(--bg-input)" }}>
                <Search className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--text-muted)" }} />
                <input type="text" placeholder="Search jobs..." value={search} onChange={e => setSearch(e.target.value)}
                  className="bg-transparent text-sm outline-none w-44" style={{ color: "var(--text-primary)" }} />
              </div>
              <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm"
                style={{ border: "1px solid var(--border)", color: "var(--text-secondary)", backgroundColor: "var(--bg-surface)" }}>
                <SlidersHorizontal className="w-3.5 h-3.5" /> Filter
              </button>
            </div>
          )}
        </div>

        {/* Projects view */}
        {isProjects ? (
          <div className="p-4">
            <ProjectsInline projects={allProjects} companyId={effectiveCompanyId} locationId={effectiveLocationId} />
          </div>
        ) : (
          <>
            {/* Column headers */}
            <div className="grid px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider select-none"
              style={{ gridTemplateColumns: gridCols, color: "var(--text-muted)", borderBottom: "1px solid var(--border-subtle)", backgroundColor: "var(--bg-surface-2)" }}>
              {([
                { label: "Job / Customer",  field: "customerName"  },
                { label: "Type",            field: "type"          },
                { label: "Status",          field: "status"        },
                { label: "Scheduled",       field: "scheduledDate" },
                { label: "Tech",            field: "assignedTo"    },
                ...(showAmount ? [{ label: "Amount", field: null }] : []),
              ] as { label: string; field: string | null }[]).map(({ label, field }) => (
                <button key={label} onClick={() => field && handleSort(field as SortField)}
                  className={cn("flex items-center gap-1 text-left", field ? "cursor-pointer hover:opacity-80" : "cursor-default")}
                  style={{ color: sortField === field ? "#4f46e5" : "var(--text-muted)" }}>
                  {label}{field && <SortIcon field={field as SortField} />}
                </button>
              ))}
            </div>

            {/* Rows */}
            <div>
              {displayed.length === 0 ? (
                <div className="py-16 text-center"><p className="text-sm" style={{ color: "var(--text-muted)" }}>No jobs match the current filter.</p></div>
              ) : displayed.map((job, i) => {
                const s = resolveJobStatus(job.status, statusConfig);
                return (
                  <Link key={job.id} href={`/jobs/${job.id}`}
                    className="grid px-4 py-3 items-center hover:bg-[var(--bg-surface-2)] transition-colors"
                    style={{ gridTemplateColumns: gridCols, borderBottom: i < displayed.length - 1 ? "1px solid var(--border-subtle)" : "none", textDecoration: "none" }}>
                    {/* Job / Customer */}
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center text-[10px] font-bold text-indigo-600 shrink-0">{job.customerInitials}</div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>{job.title}</p>
                          {job.projectId && <span className="shrink-0 text-[9px] font-semibold px-1.5 py-0.5 rounded" style={{ backgroundColor: "#e0e7ff", color: "#4f46e5" }}>PROJECT</span>}
                        </div>
                        <p className="text-[10px] truncate" style={{ color: "var(--text-muted)" }}>{job.customerName}</p>
                      </div>
                    </div>
                    {/* Type */}
                    <span className="text-sm capitalize" style={{ color: "var(--text-secondary)" }}>{job.type}</span>
                    {/* Status */}
                    <span className="inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: s.bg, color: s.color }}>{s.label}</span>
                    {/* Scheduled */}
                    <div>
                      <p className="text-sm" style={{ color: "var(--text-primary)" }}>{job.scheduledDate}</p>
                      <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>{job.scheduledTime} · {job.durationMinutes}m</p>
                    </div>
                    {/* Tech */}
                    <div className="flex items-center gap-1.5">
                      <div className="w-5 h-5 rounded-full bg-indigo-600 flex items-center justify-center text-[8px] font-bold text-white shrink-0">{job.assignedToInitials}</div>
                      <span className="text-sm truncate" style={{ color: "var(--text-secondary)" }}>{job.assignedTo}</span>
                    </div>
                    {/* Amount — hidden for roles without financial-totals access */}
                    {showAmount && (
                      <span className="text-sm font-medium" style={{ color: job.actualAmount ? "#10b981" : "var(--text-secondary)" }}>
                        {job.actualAmount ?? job.estimatedAmount ?? "—"}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between px-4 py-3 text-xs"
              style={{ borderTop: "1px solid var(--border-subtle)", color: "var(--text-muted)", backgroundColor: "var(--bg-surface-2)" }}>
              <span>Showing {displayed.length} of {contextFiltered.filter(tabFn).length} jobs</span>
              <div className="flex gap-1">
                <button className="px-2 py-1 rounded" style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}>← Prev</button>
                <button className="px-2 py-1 rounded" style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}>Next →</button>
              </div>
            </div>
          </>
        )}
      </div>
      )}

      {showCreate && (
        <JobWizard
          onClose={() => setShowCreate(false)}
          onCreated={(jid) => { setShowCreate(false); router.push(`/jobs/${jid}`); }} />
      )}
    </div>
  );
}
