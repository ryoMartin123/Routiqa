"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import RowArrow from "@/components/shared/RowArrow";
import { useRouter } from "next/navigation";
import JobWizard from "@/components/jobs/JobWizard";
import { Search, Plus, SlidersHorizontal, ChevronUp, ChevronDown, FolderKanban, Briefcase, Calendar, CalendarClock, Loader, CheckCircle2, X, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { recencyTs } from "@/lib/recency";
import { ALL_JOBS, getSessionJobs, resolveJobStatus, type Job, type JobType } from "@/lib/jobs/data";
import UiSelect from "@/components/ui/Select";
import PageTitle from "@/components/shared/PageTitle";
import { ALL_PROJECTS, getSessionProjects, getProjectProgress, type Project } from "@/lib/projects/data";
import { getProjectStages, projectTypeLabel } from "@/lib/projects/settings";
import { getJobStatuses, jobTypeLabel } from "@/lib/job-config/data";
import { useHierarchy } from "@/components/providers/HierarchyProvider";
import { usePermissions } from "@/components/providers/PermissionProvider";
import ModuleSummaryCards, { type SummaryCard } from "@/components/shared/ModuleSummaryCards";
import ModuleViewToggle, { type ModuleView } from "@/components/shared/ModuleViewToggle";
import StatusTabs from "@/components/shared/StatusTabs";
import StatusBadge from "@/components/shared/StatusBadge";

// Today's date in the same human format jobs store ("Jun 5, 2026"). Computed
// client-side (see effect below) so it stays in sync with the dispatch board,
// which schedules against the real current date.
function todayStr(): string {
  return new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

// Statuses that mean the job is finished — excluded from the Unscheduled tab.
const DONE_STATUSES = new Set(["completed", "invoiced", "closed", "canceled", "no_show"]);

function daysAgo(dateStr?: string): number {
  if (!dateStr) return Infinity;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return Infinity;
  return (Date.now() - d.getTime()) / 86_400_000;
}

// ─── Filter tabs ──────────────────────────────────────────
// Built per-render so the Scheduled filter tracks the live "today" string.
// (The old "Today" tab was removed in favor of the Time filter in the toolbar.)
function tabsFor(today: string): { key: string; label: string; fn: (j: Job) => boolean }[] {
  const isUnscheduled = (j: Job) => !j.scheduledDate?.trim() && !DONE_STATUSES.has(j.status);
  return [
    { key: "all",         label: "All",         fn: (j) => j.status !== "canceled" },
    { key: "unscheduled", label: "Unscheduled", fn: isUnscheduled },
    { key: "scheduled",   label: "Scheduled",   fn: (j) => j.status === "scheduled" && j.scheduledDate !== today },
    { key: "in_progress", label: "In Progress", fn: (j) => j.status === "in_progress" || j.status === "en_route" },
    { key: "on_hold",     label: "On Hold",     fn: (j) => j.status === "waiting_on_parts" || j.status === "waiting_on_customer" || j.status === "waiting_on_approval" },
    { key: "completed",   label: "Completed",   fn: (j) => j.status === "completed" },
    { key: "canceled",    label: "Canceled",    fn: (j) => j.status === "canceled" },
    { key: "projects",    label: "Projects",    fn: () => false }, // special view
  ];
}

// Job types (the Job.type enum) with readable labels for the Type filter.
// "Maintenance" is keyed agreement_visit (the canonical maintenance key); labels
// come from the configured Job Types via jobTypeLabel.
const JOB_TYPE_VALUES: JobType[] = [
  "agreement_visit", "repair", "installation", "inspection",
  "emergency", "estimate", "warranty", "replacement", "other",
];

// ─── Time (scheduled-date) filter ─────────────────────────
type TimeFilter = "any" | "today" | "week" | "month" | "overdue" | "unscheduled";
const TIME_OPTIONS: { key: TimeFilter; label: string }[] = [
  { key: "any",         label: "Any time"    },
  { key: "today",       label: "Today"       },
  { key: "week",        label: "This week"   },
  { key: "month",       label: "This month"  },
  { key: "overdue",     label: "Overdue"     },
  { key: "unscheduled", label: "Unscheduled" },
];

function matchesTime(j: Job, window: TimeFilter, today: string): boolean {
  if (window === "any") return true;
  const hasDate = !!j.scheduledDate?.trim();
  if (window === "unscheduled") return !hasDate && !DONE_STATUSES.has(j.status);
  if (!hasDate) return false;
  if (window === "today") return j.scheduledDate === today;
  const d = new Date(j.scheduledDate!);
  if (isNaN(d.getTime())) return false;
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (window === "overdue") return d < startOfToday && !DONE_STATUSES.has(j.status);
  if (window === "month")   return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  if (window === "week") {
    // Current week, Sunday→Saturday around today.
    const startOfWeek = new Date(startOfToday); startOfWeek.setDate(startOfToday.getDate() - startOfToday.getDay());
    const endOfWeek = new Date(startOfWeek); endOfWeek.setDate(startOfWeek.getDate() + 7);
    return d >= startOfWeek && d < endOfWeek;
  }
  return true;
}

// "recent" is the default pseudo-sort: newest created/changed first (top of the
// list, front of the card grid). Clicking a column header switches to that field.
type SortField = "recent" | "customerName" | "type" | "status" | "scheduledDate" | "assignedTo";

// Recency = newest created/changed (lifecycle stamps + status history count).
function jobRecency(j: Job): number {
  return recencyTs(j.id, j.completedAt, j.startedAt, j.enRouteAt, j.dispatchedAt,
    ...(j.statusHistory ?? []).map(h => h.at));
}

// ─── Mini projects table (shown when Projects tab active) ─
function ProjectsInline({ projects, companyId, locationId }: { projects: Project[]; companyId?: string; locationId?: string }) {
  const filtered = projects
    .filter(p => !companyId  || p.companyId  === companyId)
    .filter(p => !locationId || p.locationId === locationId);

  // Use the configured project stages (name + color) so the status pill matches
  // the Projects module exactly, rather than the coarse status enum.
  const stageMap = new Map(getProjectStages({ companyId, locationId }).map(st => [st.key, st]));

  return (
    <div className="rounded-xl overflow-hidden" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" }}>
      <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: "1px solid var(--border)", backgroundColor: "var(--bg-surface-2)" }}>
        <div className="flex items-center gap-2">
          <FolderKanban className="w-4 h-4" style={{ color: "var(--text-muted)" }} />
          <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Active Projects</span>
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ backgroundColor: "var(--bg-input)", color: "var(--text-muted)" }}>{filtered.length}</span>
        </div>
        <Link href="/projects" className="text-xs font-medium text-[#0f8578] hover:text-[#0c6b60]">View all projects →</Link>
      </div>

      {/* Column headers */}
      <div className="grid px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider" style={{ gridTemplateColumns: "2.5fr 1fr 1fr 1fr 1fr 1fr", color: "var(--text-muted)", borderBottom: "1px solid var(--border)", backgroundColor: "transparent" }}>
        <span>Project</span><span>Type</span><span>Status</span><span>Target Date</span><span>Progress</span><span>Value</span>
      </div>

      {filtered.map((p, i) => {
        const st = stageMap.get(p.stage ?? "");
        const prog = getProjectProgress(p.id);
        const pct = prog.total > 0 ? Math.round((prog.completed / prog.total) * 100) : 0;
        return (
          <Link key={p.id} href={`/projects/${p.id}`}
            className="grid px-4 py-3 items-center hover:bg-[var(--bg-surface-2)] transition-colors"
            style={{ gridTemplateColumns: "2.5fr 1fr 1fr 1fr 1fr 1fr", borderBottom: i < filtered.length - 1 ? "1px solid var(--border)" : "none", textDecoration: "none" }}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: "var(--bg-input)" }}><FolderKanban className="w-3.5 h-3.5" style={{ color: "var(--text-muted)" }} /></div>
              <div className="min-w-0">
                <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>{p.name}</p>
                <p className="text-[10px] truncate" style={{ color: "var(--text-muted)" }}>{p.customerName}</p>
              </div>
            </div>
            <span className="text-sm" style={{ color: "var(--text-secondary)" }}>{projectTypeLabel(p.type)}</span>
            <StatusBadge label={st?.name ?? "—"} color={st?.color ?? "#6b7280"} />
            <span className="text-sm" style={{ color: "var(--text-secondary)" }}>{p.targetDate ?? "—"}</span>
            <div className="flex items-center gap-2">
              <div className="w-16 h-1.5 rounded-full shrink-0" style={{ backgroundColor: "var(--bg-input)" }}>
                <div className="h-1.5 rounded-full bg-[#239c8d]" style={{ width: `${pct}%` }} />
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

// ─── Filter popover primitives ────────────────────────────
function FilterField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[11px] font-semibold mb-1" style={{ color: "var(--text-secondary)" }}>{label}</p>
      {children}
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
  const [tab, setTab]         = useState("all");
  const [moduleView, setModuleView] = useState<ModuleView>("cards");

  // Toolbar filters (popover). All default to "any" so first render is unfiltered.
  const [filterOpen, setFilterOpen] = useState(false);
  const [timeFilter, setTimeFilter] = useState<TimeFilter>("any");
  const [typeFilter, setTypeFilter] = useState<JobType | "any">("any");
  const [assigneeFilter, setAssigneeFilter] = useState<string>("any");
  const filterRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!filterOpen) return;
    const onDown = (e: MouseEvent) => { if (filterRef.current && !filterRef.current.contains(e.target as Node)) setFilterOpen(false); };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [filterOpen]);

  // "Today" resolves client-side so it matches the dispatch board's real date
  // (empty on first paint → Today shows only active jobs until this fills in).
  const [today, setToday] = useState("");
  useEffect(() => { setToday(todayStr()); }, []);
  const TABS = tabsFor(today);
  const [search, setSearch]   = useState("");
  const [sortField, setSort]  = useState<SortField>("recent");
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
    { icon: Calendar,      label: "Today's Jobs",        value: String(contextFiltered.filter(j => today !== "" && j.scheduledDate === today).length),                  sub: "Scheduled today",   iconColor: "#0f8578" },
    { icon: CalendarClock, label: "Scheduled",           value: String(contextFiltered.filter(j => j.status === "scheduled").length),                                   sub: "Upcoming work",     iconColor: "#0891b2" },
    { icon: Loader,        label: "In Progress",         value: String(contextFiltered.filter(j => j.status === "in_progress" || j.status === "en_route").length),       sub: "Active now",        iconColor: "#f59e0b" },
    { icon: CheckCircle2,  label: "Completed This Week", value: String(contextFiltered.filter(j => j.status === "completed" && daysAgo(j.completedDate) <= 7).length),    sub: "Last 7 days",       iconColor: "#10b981" },
  ];

  const tabFn = TABS.find(t => t.key === tab)?.fn ?? (() => true);

  // Assignee options derived from the jobs currently in context.
  const assigneeOptions = Array.from(new Set(contextFiltered.map(j => j.assignedTo).filter(Boolean))).sort();
  const activeFilterCount = (timeFilter !== "any" ? 1 : 0) + (typeFilter !== "any" ? 1 : 0) + (assigneeFilter !== "any" ? 1 : 0);
  function clearFilters() { setTimeFilter("any"); setTypeFilter("any"); setAssigneeFilter("any"); }

  const displayed = contextFiltered
    .filter(tabFn)
    .filter(j => matchesTime(j, timeFilter, today))
    .filter(j => typeFilter === "any" || j.type === typeFilter)
    .filter(j => assigneeFilter === "any" || j.assignedTo === assigneeFilter)
    .filter(j => {
      if (!search) return true;
      const q = search.toLowerCase();
      return j.customerName.toLowerCase().includes(q) || j.title.toLowerCase().includes(q) || j.assignedTo.toLowerCase().includes(q);
    })
    .sort((a, b) => {
      if (sortField === "recent") return jobRecency(b) - jobRecency(a);
      const av = a[sortField] ?? "", bv = b[sortField] ?? "";
      return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
    });

  function handleSort(field: SortField) {
    if (sortField === field) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSort(field); setSortDir("asc"); }
  }

  function SortIcon({ field }: { field: SortField }) {
    if (sortField !== field) return <ChevronDown className="w-3 h-3 opacity-30" />;
    return sortDir === "asc" ? <ChevronUp className="w-3 h-3" style={{ color: "#0f8578" }} /> : <ChevronDown className="w-3 h-3" style={{ color: "#0f8578" }} />;
  }

  return (
    <div className="p-6">
      {/* Header — title · centered view toggle · action */}
      <div className="flex items-center gap-4 mb-6">
        <div className="flex-1 min-w-0">
          <PageTitle title="Jobs" count={contextFiltered.length} description="Track scheduled work, job status, assignments, and field progress." />
        </div>
        <ModuleViewToggle view={moduleView} onChange={setModuleView} withCards overviewFirst />
        <div className="flex-1 flex justify-end">
          {canCreateJob && (
            <button onClick={() => setShowCreate(true)} data-open={showCreate} className="flex items-center gap-1.5 bg-[#0f8578] hover:bg-[#0c6b60] text-white text-sm font-medium px-3 py-2 rounded-lg transition-colors">
              <Plus className="plus-icon w-4 h-4" /> New Job
            </button>
          )}
        </div>
      </div>

      {moduleView === "overview" && (
        <div className="mb-5">
          <ModuleSummaryCards cards={summaryCards} />
        </div>
      )}

      {/* List + Cards share the same toolbar/tabs */}
      {(moduleView === "list" || moduleView === "cards") && (
      <>
        {/* Toolbar — tabs · search · filter, OUTSIDE the table card (consistent with Customers/Leads) */}
        <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
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
              <div className="relative" ref={filterRef}>
                <button onClick={() => setFilterOpen(o => !o)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm"
                  style={{
                    border: `1px solid ${activeFilterCount > 0 ? "var(--accent-soft-border)" : "var(--border)"}`,
                    color: activeFilterCount > 0 ? "var(--accent-text)" : "var(--text-secondary)",
                    backgroundColor: activeFilterCount > 0 ? "var(--accent-soft-bg)" : "var(--bg-surface)",
                  }}>
                  <SlidersHorizontal className="w-3.5 h-3.5" /> Filter
                  {activeFilterCount > 0 && (
                    <span className="ml-0.5 text-[10px] font-bold px-1.5 rounded-full text-white" style={{ backgroundColor: "var(--accent-text)" }}>{activeFilterCount}</span>
                  )}
                </button>

                {filterOpen && (
                  <div className="absolute right-0 top-full mt-1.5 w-72 rounded-xl z-30 p-3.5 space-y-3.5"
                    style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "0 12px 32px rgba(0,0,0,0.18)" }}>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>Filters</span>
                      {activeFilterCount > 0 && (
                        <button onClick={clearFilters} className="flex items-center gap-1 text-[11px] font-medium hover:underline" style={{ color: "var(--accent-text)" }}>
                          <X className="w-3 h-3" /> Clear all
                        </button>
                      )}
                    </div>

                    {/* Time */}
                    <FilterField label="Time">
                      <UiSelect size="sm" value={timeFilter} onChange={v => setTimeFilter(v as TimeFilter)}
                        options={TIME_OPTIONS.map(o => ({ value: o.key, label: o.label }))} />
                    </FilterField>

                    {/* Type */}
                    <FilterField label="Type">
                      <UiSelect size="sm" value={typeFilter} onChange={v => setTypeFilter(v as JobType | "any")}
                        options={[{ value: "any", label: "Any type" }, ...JOB_TYPE_VALUES.map(t => ({ value: t, label: jobTypeLabel(t) }))]} />
                    </FilterField>

                    {/* Assigned To */}
                    {assigneeOptions.length > 0 && (
                      <FilterField label="Assigned To">
                        <UiSelect size="sm" value={assigneeFilter} onChange={setAssigneeFilter}
                          options={[{ value: "any", label: "Anyone" }, ...assigneeOptions.map(a => ({ value: a, label: a }))]} />
                      </FilterField>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Projects tab keeps its inline list; otherwise the list table or cards grid */}
        {isProjects ? (
          <div className="rounded-xl overflow-hidden p-4" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" }}>
            <ProjectsInline projects={allProjects} companyId={effectiveCompanyId} locationId={effectiveLocationId} />
          </div>
        ) : moduleView === "cards" ? (
          displayed.length === 0 ? (
            <div className="rounded-xl py-16 text-center" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)" }}>
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>No jobs match the current filter.</p>
            </div>
          ) : (
            <div className="grid gap-3 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
              {displayed.map(job => <JobCard key={job.id} job={job} statusConfig={statusConfig} showAmount={showAmount} />)}
            </div>
          )
        ) : (
          <div className="rounded-xl overflow-hidden" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" }}>
          <>
            {/* Column headers */}
            <div className="grid px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider select-none"
              style={{ gridTemplateColumns: gridCols, color: "var(--text-muted)", borderBottom: "1px solid var(--border)", backgroundColor: "transparent" }}>
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
                  style={{ color: sortField === field ? "#0f8578" : "var(--text-muted)" }}>
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
                    className="relative group grid px-4 py-3 items-center hover:bg-[var(--bg-surface-2)] transition-colors"
                    style={{ gridTemplateColumns: gridCols, borderBottom: i < displayed.length - 1 ? "1px solid var(--border)" : "none", textDecoration: "none" }}>
                    <RowArrow />
                    {/* Job / Customer */}
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: "var(--accent-soft-bg)" }}><Briefcase className="w-3.5 h-3.5" style={{ color: "var(--accent-text)" }} /></div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>{job.title}</p>
                          {job.projectId && <span className="shrink-0 text-[9px] font-semibold px-1.5 py-0.5 rounded" style={{ backgroundColor: "#d3ebe6", color: "#0f8578" }}>PROJECT</span>}
                        </div>
                        <p className="text-[10px] truncate" style={{ color: "var(--text-muted)" }}>{job.customerName}</p>
                      </div>
                    </div>
                    {/* Type */}
                    <span className="text-sm capitalize" style={{ color: "var(--text-secondary)" }}>{job.type}</span>
                    {/* Status */}
                    <StatusBadge label={s.label} color={s.color} />
                    {/* Scheduled */}
                    <div>
                      <p className="text-sm" style={{ color: "var(--text-primary)" }}>{job.scheduledDate}</p>
                      <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>{job.scheduledTime} · {job.durationMinutes}m</p>
                    </div>
                    {/* Tech */}
                    <div className="flex items-center gap-1.5">
                      <div className="w-5 h-5 rounded-full bg-[var(--copper-soft-bg)] flex items-center justify-center text-[8px] font-bold text-[var(--copper-text)] shrink-0">{job.assignedToInitials}</div>
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
              style={{ borderTop: "1px solid var(--border)", color: "var(--text-muted)", backgroundColor: "transparent" }}>
              <span>Showing {displayed.length} of {contextFiltered.filter(tabFn).length} jobs</span>
              <div className="flex gap-1">
                <button className="px-2 py-1 rounded" style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}>← Prev</button>
                <button className="px-2 py-1 rounded" style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}>Next →</button>
              </div>
            </div>
          </>
          </div>
        )}
      </>
      )}

      {showCreate && (
        <JobWizard
          onClose={() => setShowCreate(false)}
          onCreated={(jid) => { setShowCreate(false); router.push(`/jobs/${jid}`); }} />
      )}
    </div>
  );
}

// ─── Job card (Cards view) — mirrors the dispatch unscheduled-queue card ───
function JobCard({ job, statusConfig, showAmount }: {
  job: Job; statusConfig: { key: string; name: string; color: string }[]; showAmount: boolean;
}) {
  const s = resolveJobStatus(job.status, statusConfig);
  const amount = job.actualAmount ?? job.estimatedAmount;
  return (
    <Link href={`/jobs/${job.id}`}
      className="group block rounded-lg p-3 transition-all hover:-translate-y-0.5 hover:shadow-md"
      style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", borderLeft: `3px solid ${s.color}`, textDecoration: "none" }}>
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
          <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded inline-flex items-center gap-1 shrink-0" style={{ backgroundColor: s.color + "22", color: s.color }}>
            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: s.color }} />{s.label}
          </span>
          <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded shrink-0" style={{ backgroundColor: "var(--bg-input)", color: "var(--text-muted)" }}>{jobTypeLabel(job.type)}</span>
          {job.projectId && <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded shrink-0" style={{ backgroundColor: "#d3ebe6", color: "#0f8578" }}>PROJECT</span>}
        </div>
        {showAmount && amount && <span className="text-xs font-bold shrink-0" style={{ color: job.actualAmount ? "#10b981" : "var(--text-primary)" }}>{amount}</span>}
      </div>
      <p className="text-sm font-semibold truncate" style={{ color: "var(--text-primary)" }}>{job.title}</p>
      {job.customerName && <p className="text-xs truncate" style={{ color: "var(--text-secondary)" }}>{job.customerName}</p>}
      <div className="flex items-center justify-between gap-2 mt-2 pt-2" style={{ borderTop: "1px solid var(--border)" }}>
        <span className="text-[10px] truncate" style={{ color: "var(--text-muted)" }}>
          {job.scheduledDate ? `${job.scheduledDate}${job.scheduledTime ? ` · ${job.scheduledTime}` : ""}` : "Unscheduled"}
        </span>
        <div className="flex items-center gap-1.5 shrink-0 min-w-0">
          <div className="w-5 h-5 rounded-full bg-[var(--copper-soft-bg)] flex items-center justify-center text-[8px] font-bold text-[var(--copper-text)] shrink-0">{job.assignedToInitials || "—"}</div>
          <span className="text-[10px] truncate" style={{ color: "var(--text-secondary)" }}>{job.assignedTo || "Unassigned"}</span>
          <ArrowRight className="w-3.5 h-3.5 shrink-0 transition-transform group-hover:-rotate-45" style={{ color: "#0f8578" }} />
        </div>
      </div>
    </Link>
  );
}
