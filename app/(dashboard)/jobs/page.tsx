"use client";

import { useState } from "react";
import Link from "next/link";
import { Search, Plus, SlidersHorizontal, ChevronUp, ChevronDown, FolderKanban } from "lucide-react";
import { cn } from "@/lib/utils";
import { ALL_JOBS, JOB_STATUS_CONFIG, type Job, type JobStatus, type JobType } from "@/lib/jobs/data";
import { ALL_PROJECTS, PROJECT_STATUS_CONFIG, getProjectProgress, type ProjectStatus } from "@/lib/projects/data";
import { useHierarchy } from "@/components/providers/HierarchyProvider";

const TODAY = "May 30, 2026";

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
function ProjectsInline({ companyId, locationId }: { companyId?: string; locationId?: string }) {
  const filtered = ALL_PROJECTS
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

  const [tab, setTab]         = useState("today");
  const [search, setSearch]   = useState("");
  const [sortField, setSort]  = useState<SortField>("scheduledDate");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const isProjects = tab === "projects";

  // Context filter
  const contextFiltered = ALL_JOBS
    .filter(j => !effectiveCompanyId  || j.companyId  === effectiveCompanyId)
    .filter(j => !effectiveLocationId || j.locationId === effectiveLocationId);

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
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-semibold" style={{ color: "var(--text-primary)" }}>Jobs</h1>
            <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: "var(--bg-input)", color: "var(--text-muted)" }}>{contextFiltered.length}</span>
          </div>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>Daily operations — all scheduled and active work</p>
        </div>
        <button className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-3 py-2 rounded-lg transition-colors">
          <Plus className="w-4 h-4" /> New Job
        </button>
      </div>

      {/* Table card */}
      <div className="rounded-xl overflow-hidden" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-subtle)", boxShadow: "var(--shadow-card)" }}>
        {/* Tabs + search */}
        <div className="flex items-center justify-between px-4" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
          <div className="flex items-center gap-0.5">
            {TABS.map(t => {
              const count = t.key === "projects" ? ALL_PROJECTS.filter(p => (!effectiveCompanyId || p.companyId === effectiveCompanyId) && (!effectiveLocationId || p.locationId === effectiveLocationId)).length : contextFiltered.filter(t.fn).length;
              const active = tab === t.key;
              return (
                <button key={t.key} onClick={() => setTab(t.key)}
                  className="relative flex items-center gap-1.5 px-3 py-3 text-sm font-medium transition-colors"
                  style={{ color: active ? "#4f46e5" : "var(--text-muted)" }}
                >
                  {t.key === "projects" && <FolderKanban className="w-3.5 h-3.5" />}
                  {t.label}
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ backgroundColor: active ? "#e0e7ff" : "var(--bg-input)", color: active ? "#4f46e5" : "var(--text-muted)" }}>{count}</span>
                  {active && <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-t bg-indigo-600" />}
                </button>
              );
            })}
          </div>
          {!isProjects && (
            <div className="flex items-center gap-2 py-2">
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
            <ProjectsInline companyId={effectiveCompanyId} locationId={effectiveLocationId} />
          </div>
        ) : (
          <>
            {/* Column headers */}
            <div className="grid px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider select-none"
              style={{ gridTemplateColumns: "2.5fr 1fr 1fr 1.5fr 1fr 1fr", color: "var(--text-muted)", borderBottom: "1px solid var(--border-subtle)", backgroundColor: "var(--bg-surface-2)" }}>
              {([
                { label: "Job / Customer",  field: "customerName"  },
                { label: "Type",            field: "type"          },
                { label: "Status",          field: "status"        },
                { label: "Scheduled",       field: "scheduledDate" },
                { label: "Tech",            field: "assignedTo"    },
                { label: "Amount",          field: null            },
              ] as const).map(({ label, field }) => (
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
                const s = JOB_STATUS_CONFIG[job.status];
                return (
                  <Link key={job.id} href={`/jobs/${job.id}`}
                    className="grid px-4 py-3 items-center hover:bg-[var(--bg-surface-2)] transition-colors"
                    style={{ gridTemplateColumns: "2.5fr 1fr 1fr 1.5fr 1fr 1fr", borderBottom: i < displayed.length - 1 ? "1px solid var(--border-subtle)" : "none", textDecoration: "none" }}>
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
                    {/* Amount */}
                    <span className="text-sm font-medium" style={{ color: job.actualAmount ? "#10b981" : "var(--text-secondary)" }}>
                      {job.actualAmount ?? job.estimatedAmount ?? "—"}
                    </span>
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
    </div>
  );
}
