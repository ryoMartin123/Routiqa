"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import ProjectWizard from "@/components/projects/ProjectWizard";
import { Search, Plus, SlidersHorizontal, ChevronUp, ChevronDown, PlayCircle, PauseCircle, CheckCircle2, DollarSign, LayoutList, BarChart3, Columns3, CalendarDays, ChevronLeft, ChevronRight, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import { ALL_PROJECTS, getSessionProjects, updateProject, getProjectProgress, type Project } from "@/lib/projects/data";
import { getProjectStages, projectTypeLabel, type ProjectStage } from "@/lib/projects/settings";
import { phaseProgress } from "@/lib/projects/phases";
import { PROJECT_LENSES, bucketOf, statusBucket, healthBucket, type LensKey } from "@/lib/projects/lenses";
import { useHierarchy } from "@/components/providers/HierarchyProvider";
import ModuleSummaryCards, { type SummaryCard } from "@/components/shared/ModuleSummaryCards";
import PageTitle from "@/components/shared/PageTitle";
import StatusBadge from "@/components/shared/StatusBadge";

function parseMoney(s?: string): number {
  if (!s) return 0;
  const n = parseFloat(s.replace(/[^0-9.]/g, ""));
  return isNaN(n) ? 0 : n;
}
function fmtMoney(n: number): string {
  if (n >= 1000) return `$${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k`;
  return `$${n.toLocaleString()}`;
}

// Project completion — phases when present (the milestone model), else jobs.
function progressOf(projectId: string): { completed: number; total: number; pct: number; unit: string } {
  const ph = phaseProgress(projectId);
  if (ph.total > 0) return { completed: ph.done, total: ph.total, pct: ph.pct, unit: "phases" };
  const j = getProjectProgress(projectId);
  return { completed: j.completed, total: j.total, pct: j.total ? Math.round((j.completed / j.total) * 100) : 0, unit: "jobs" };
}

type SortField = "name" | "customerName" | "status" | "targetDate";
type ProjectView = "list" | "overview" | "kanban" | "calendar";

// Same order as the Leads section: Overview · Kanban · List · Calendar.
const VIEW_TABS: { key: ProjectView; label: string; icon: typeof LayoutList }[] = [
  { key: "overview", label: "Overview", icon: BarChart3 },
  { key: "kanban",   label: "Kanban",   icon: Columns3 },
  { key: "list",     label: "List",     icon: LayoutList },
  { key: "calendar", label: "Calendar", icon: CalendarDays },
];

// Pill tab style shared by the lens switcher + bucket tabs (Photos & Files look).
function pillStyle(active: boolean): React.CSSProperties {
  return {
    backgroundColor: active ? "var(--accent-soft-bg)" : "transparent",
    color: active ? "var(--accent-text)" : "var(--text-muted)",
    border: `1px solid ${active ? "var(--accent-soft-border)" : "transparent"}`,
  };
}

export default function ProjectsPage() {
  const { effectiveCompanyId, effectiveLocationId } = useHierarchy();
  const router = useRouter();

  const [wizardOpen, setWizardOpen] = useState(false);
  const [view, setView]       = useState<ProjectView>("list");
  const [lens, setLens]       = useState<LensKey>("status");
  const [tab, setTab]         = useState("all");
  const [search, setSearch]   = useState("");
  const [sortField, setSort]  = useState<SortField>("status");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [refreshKey, setRefreshKey] = useState(0);

  // Session-created projects + the custom pipeline stages, loaded after mount.
  const [extraProjects, setExtraProjects] = useState<Project[]>([]);
  const [stages, setStages] = useState<ProjectStage[]>([]);
  useEffect(() => { setExtraProjects(getSessionProjects()); }, [refreshKey]);
  useEffect(() => {
    setStages(getProjectStages({ companyId: effectiveCompanyId, locationId: effectiveLocationId }));
  }, [effectiveCompanyId, effectiveLocationId]);
  const allProjects = [...extraProjects, ...ALL_PROJECTS];

  // Lookups derived from the custom stages.
  const stageMap = useMemo(() => new Map(stages.map(s => [s.key, s])), [stages]);
  const activeStages = useMemo(() => stages.filter(s => s.active), [stages]);

  function moveStage(id: string, stageKey: string) {
    updateProject(id, { stage: stageKey });
    setRefreshKey(k => k + 1);
  }

  const contextFiltered = allProjects
    .filter(p => !effectiveCompanyId  || p.companyId  === effectiveCompanyId)
    .filter(p => !effectiveLocationId || p.locationId === effectiveLocationId);

  // Lens tabs — current lens's buckets with live counts.
  const lensDef = PROJECT_LENSES.find(l => l.key === lens)!;
  const lensTabs = lensDef.tabs.map(t => ({
    key: t.key, label: t.label,
    count: t.key === "all" ? contextFiltered.length : contextFiltered.filter(p => bucketOf(lens, p, stageMap) === t.key).length,
  }));
  const matchesTab = (p: Project) => tab === "all" || bucketOf(lens, p, stageMap) === tab;
  const lensFiltered = contextFiltered.filter(matchesTab);

  function selectLens(k: LensKey) { setLens(k); setTab("all"); }

  // Summary metrics — respect the active context (stage is the source of truth)
  const summaryCards: SummaryCard[] = [
    { icon: PlayCircle,   label: "Active Projects", value: String(contextFiltered.filter(p => statusBucket(p, stageMap) === "active").length),    sub: "In progress", iconColor: "#4f46e5" },
    { icon: PauseCircle,  label: "Overdue",         value: String(contextFiltered.filter(p => healthBucket(p) === "overdue").length),            sub: "Past target", iconColor: "#ef4444" },
    { icon: CheckCircle2, label: "Completed",       value: String(contextFiltered.filter(p => statusBucket(p, stageMap) === "completed").length), sub: "Finished",    iconColor: "#10b981" },
    { icon: DollarSign,   label: "Total Value",     value: fmtMoney(contextFiltered.reduce((s, p) => s + parseMoney(p.estimatedValue), 0)), sub: `${contextFiltered.length} projects`, iconColor: "#0891b2" },
  ];

  const displayed = lensFiltered
    .filter(p => {
      if (!search) return true;
      const q = search.toLowerCase();
      return p.name.toLowerCase().includes(q) || p.customerName.toLowerCase().includes(q);
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
      <div className="flex items-center gap-4 mb-6">
        <div className="flex-1 min-w-0">
          <PageTitle title="Projects" count={contextFiltered.length} description="Multi-phase and larger scope work" />
        </div>
        <div className="flex items-center rounded-lg overflow-hidden shrink-0" style={{ border: "1px solid var(--border)" }}>
          {VIEW_TABS.map(v => {
            const active = view === v.key;
            return (
              <button key={v.key} onClick={() => setView(v.key)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm transition-colors"
                style={{ backgroundColor: active ? "#4f46e5" : "var(--bg-surface)", color: active ? "#fff" : "var(--text-secondary)" }}>
                <v.icon className="w-3.5 h-3.5" /> {v.label}
              </button>
            );
          })}
        </div>
        <div className="flex-1 flex justify-end">
          <button onClick={() => setWizardOpen(true)}
            className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-3 py-2 rounded-lg transition-colors">
            <Plus className="w-4 h-4" /> New Project
          </button>
        </div>
      </div>

      {view === "overview" && (
        <div className="mb-5">
          <ModuleSummaryCards cards={summaryCards} />
        </div>
      )}

      {/* Lens switcher + bucket tabs (Photos & Files style): the lens picker that
          toggles which tab-set shows on the LEFT, a divider, then the active
          lens's buckets on the RIGHT. Applies across List / Kanban / Calendar. */}
      {view !== "overview" && (
        <div className="flex flex-wrap items-center gap-0.5 mb-4">
          {PROJECT_LENSES.map(l => (
            <button key={l.key} onClick={() => selectLens(l.key)}
              className="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
              style={pillStyle(lens === l.key)}>
              {l.label}
            </button>
          ))}

          <span className="w-px h-5 mx-1.5 shrink-0" style={{ backgroundColor: "var(--border)" }} />

          {lensTabs.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
              style={pillStyle(tab === t.key)}>
              {t.label}<span className="ml-1.5 opacity-60">{t.count}</span>
            </button>
          ))}
        </div>
      )}

      {view === "kanban"   && <ProjectKanban stages={activeStages} projects={lensFiltered} onMove={moveStage} />}
      {view === "calendar" && <ProjectCalendar stages={stages} projects={lensFiltered} />}

      {view === "list" && (
      <div className="rounded-xl overflow-hidden" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-subtle)", boxShadow: "var(--shadow-card)" }}>
        {/* Search (the lens + tabs live above, shared across views) */}
        <div className="flex items-center justify-end flex-wrap gap-2 px-4 py-3" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
          <div className="flex items-center gap-2 rounded-lg px-3 py-1.5" style={{ backgroundColor: "var(--bg-input)" }}>
            <Search className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--text-muted)" }} />
            <input type="text" placeholder="Search projects..." value={search} onChange={e => setSearch(e.target.value)}
              className="bg-transparent text-sm outline-none w-44" style={{ color: "var(--text-primary)" }} />
          </div>
          <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm"
            style={{ border: "1px solid var(--border)", color: "var(--text-secondary)", backgroundColor: "var(--bg-surface)" }}>
            <SlidersHorizontal className="w-3.5 h-3.5" /> Filter
          </button>
        </div>

        {/* Column headers */}
        <div className="grid px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider select-none"
          style={{ gridTemplateColumns: "2.5fr 1fr 1fr 1fr 1fr 1fr 1.5fr", color: "var(--text-muted)", borderBottom: "1px solid var(--border-subtle)", backgroundColor: "var(--bg-surface-2)" }}>
          {([
            { label: "Project",     field: "name"         },
            { label: "Type",        field: null            },
            { label: "Stage",       field: null            },
            { label: "Customer",    field: "customerName" },
            { label: "Target Date", field: "targetDate"   },
            { label: "Progress",    field: null            },
            { label: "Value",       field: null            },
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
            <div className="py-16 text-center"><p className="text-sm" style={{ color: "var(--text-muted)" }}>No projects match the current filter.</p></div>
          ) : displayed.map((p, i) => {
            const st   = stageMap.get(p.stage ?? "");
            const prog = progressOf(p.id);
            const pct  = prog.pct;
            return (
              <Link key={p.id} href={`/projects/${p.id}`}
                className="grid px-4 py-3 items-center hover:bg-[var(--bg-surface-2)] transition-colors"
                style={{ gridTemplateColumns: "2.5fr 1fr 1fr 1fr 1fr 1fr 1.5fr", borderBottom: i < displayed.length - 1 ? "1px solid var(--border-subtle)" : "none", textDecoration: "none" }}>
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center text-[10px] font-bold text-indigo-600 shrink-0">{p.customerInitials}</div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>{p.name}</p>
                    <p className="text-[10px] truncate" style={{ color: "var(--text-muted)" }}>{p.locationName}</p>
                  </div>
                </div>
                <span className="text-sm" style={{ color: "var(--text-secondary)" }}>{projectTypeLabel(p.type)}</span>
                <StatusBadge label={st?.name ?? "—"} color={st?.color ?? "#6b7280"} />
                <span className="text-sm truncate" style={{ color: "var(--text-secondary)" }}>{p.customerName}</span>
                <span className="text-sm" style={{ color: "var(--text-secondary)" }}>{p.targetDate ?? "—"}</span>
                <div className="flex items-center gap-2">
                  <div className="w-16 h-1.5 rounded-full shrink-0" style={{ backgroundColor: "var(--bg-input)" }}>
                    <div className="h-1.5 rounded-full bg-indigo-500" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-[10px] shrink-0" style={{ color: "var(--text-muted)" }}>{prog.completed}/{prog.total}</span>
                </div>
                <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{p.estimatedValue ?? "—"}</span>
              </Link>
            );
          })}
        </div>

        <div className="flex items-center justify-between px-4 py-3 text-xs"
          style={{ borderTop: "1px solid var(--border-subtle)", color: "var(--text-muted)", backgroundColor: "var(--bg-surface-2)" }}>
          <span>Showing {displayed.length} of {lensFiltered.length} projects</span>
        </div>
      </div>
      )}

      {wizardOpen && (
        <ProjectWizard
          onClose={() => setWizardOpen(false)}
          onCreated={(id) => { setWizardOpen(false); router.push(`/projects/${id}`); }}
        />
      )}
    </div>
  );
}

// ─── Kanban view ──────────────────────────────────────────
// Same flat-column / wheel-pan style as the Leads pipeline board.
function ProjectKanban({ stages, projects, onMove }: {
  stages: ProjectStage[]; projects: Project[]; onMove: (id: string, stageKey: string) => void;
}) {
  const [dropStage, setDropStage] = useState<string | null>(null);
  if (stages.length === 0) {
    return <div className="rounded-xl p-10 text-center" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-subtle)" }}>
      <p className="text-sm" style={{ color: "var(--text-muted)" }}>No active project stages. Add them in Settings → Projects → Stages.</p>
    </div>;
  }
  const keys = new Set(stages.map(s => s.key));
  const colFor = (p: Project) => (p.stage && keys.has(p.stage)) ? p.stage! : stages[0].key;
  return (
    <div
      className="overflow-x-auto thin-scroll-x"
      style={{ height: "calc(100vh - 250px)" }}
      ref={el => {
        if (!el) return;
        const onWheel = (e: WheelEvent) => {
          if (el.scrollWidth <= el.clientWidth || e.deltaY === 0) return;
          e.preventDefault();
          el.scrollLeft += e.deltaY;
        };
        el.addEventListener("wheel", onWheel, { passive: false });
        return () => el.removeEventListener("wheel", onWheel);
      }}
    >
      <div className="flex gap-5 min-w-max h-full pb-2">
        {stages.map(stage => {
          const cards = projects.filter(p => colFor(p) === stage.key);
          const total = cards.reduce((s, p) => s + parseMoney(p.estimatedValue), 0);
          return (
            <div key={stage.key}
              className="shrink-0 snap-col flex flex-col rounded-xl transition-colors h-full min-h-0"
              style={{ width: "296px", backgroundColor: dropStage === stage.key ? "var(--accent-soft-bg)" : undefined, outline: dropStage === stage.key ? "1px dashed var(--accent-soft-border)" : undefined }}
              onDragOver={e => { e.preventDefault(); if (dropStage !== stage.key) setDropStage(stage.key); }}
              onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDropStage(null); }}
              onDrop={e => { e.preventDefault(); setDropStage(null); const id = e.dataTransfer.getData("text/plain"); if (id) onMove(id, stage.key); }}>
              {/* Flat stage header: colored dot · name · count · value */}
              <div className="flex items-center gap-2 mb-3 pb-2 px-1 pt-1 shrink-0" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: stage.color }} />
                <p className="text-sm font-semibold truncate" style={{ color: "var(--text-primary)" }}>{stage.name}</p>
                <span className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>{cards.length}</span>
                {total > 0 && <span className="ml-auto text-[11px] font-medium shrink-0" style={{ color: "var(--text-muted)" }}>{fmtMoney(total)}</span>}
              </div>

              <div className="space-y-2 overflow-y-auto thin-scroll-y flex-1 px-1 pb-1" style={{ minHeight: "100px" }}>
                {cards.length === 0
                  ? <p className="text-[11px] py-4 text-center" style={{ color: "var(--text-muted)" }}>Drop here</p>
                  : cards.map(p => <ProjectCard key={p.id} project={p} />)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Card mirrors the Leads PipelineCard layout.
function ProjectCard({ project }: { project: Project }) {
  const pct = progressOf(project.id).pct;
  return (
    <Link href={`/projects/${project.id}`}
      draggable
      onDragStart={e => { e.dataTransfer.setData("text/plain", project.id); e.dataTransfer.effectAllowed = "move"; }}
      className="block rounded-xl p-3 mb-2 transition-all hover:shadow-md cursor-grab active:cursor-grabbing"
      style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-subtle)", boxShadow: "var(--shadow-card)", textDecoration: "none" }}>

      {/* Customer + progress */}
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center text-[9px] font-bold text-indigo-600 shrink-0">
            {project.customerInitials}
          </div>
          <p className="text-sm font-semibold truncate" style={{ color: "var(--text-primary)" }}>{project.customerName}</p>
        </div>
        <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full shrink-0" style={{ backgroundColor: "var(--accent-soft-bg)", color: "var(--accent-text)" }}>{pct}%</span>
      </div>

      {/* Project name */}
      <p className="text-xs font-medium leading-snug mb-1" style={{ color: "var(--text-secondary)" }}>{project.name}</p>

      {/* Address */}
      {project.propertyAddress && (
        <p className="text-[10px] leading-snug mb-2 truncate flex items-center gap-1" style={{ color: "var(--text-muted)" }}>
          <MapPin className="w-2.5 h-2.5 shrink-0" /> {project.propertyAddress}
        </p>
      )}

      {/* Value + type */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="text-sm font-bold" style={{ color: project.estimatedValue ? "var(--text-primary)" : "var(--text-muted)" }}>
          {project.estimatedValue ?? "TBD"}
        </span>
        <span className="text-[9px] font-medium px-1.5 py-0.5 rounded-full" style={{ backgroundColor: "var(--bg-input)", color: "var(--text-muted)" }}>
          {projectTypeLabel(project.type)}
        </span>
      </div>

      {/* Assigned + target date */}
      <div className="flex items-center justify-between pt-2" style={{ borderTop: "1px solid var(--border-subtle)" }}>
        <div className="flex items-center gap-1.5 min-w-0">
          <div className="w-5 h-5 rounded-full bg-indigo-600 flex items-center justify-center text-[8px] font-bold text-white shrink-0" title={project.assignedTo}>
            {project.assignedToInitials || "—"}
          </div>
          <span className="text-[10px] truncate" style={{ color: "var(--text-secondary)" }}>{project.assignedTo || "Unassigned"}</span>
        </div>
        <span className="text-[10px] shrink-0" style={{ color: "var(--text-muted)" }}>{project.targetDate ?? "—"}</span>
      </div>
    </Link>
  );
}

// ─── Calendar view ────────────────────────────────────────
// Same month-grid style as the Leads calendar; projects placed on target date.
function ProjectCalendar({ stages, projects }: { stages: ProjectStage[]; projects: Project[] }) {
  const [focus, setFocus] = useState(() => new Date());
  const stageColor = (key?: string) => stages.find(s => s.key === key)?.color ?? "#6366f1";

  const monthStart = new Date(focus.getFullYear(), focus.getMonth(), 1);
  const gridStart = new Date(monthStart);
  gridStart.setDate(gridStart.getDate() - gridStart.getDay());
  const days = Array.from({ length: 42 }, (_, i) => { const d = new Date(gridStart); d.setDate(d.getDate() + i); return d; });
  const today = new Date();
  const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

  const byKey = new Map<string, Project[]>();
  let undated = 0;
  projects.forEach(p => {
    const d = p.targetDate ? new Date(p.targetDate) : null;
    if (!d || isNaN(d.getTime())) { undated++; return; }
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    const arr = byKey.get(key) ?? []; arr.push(p); byKey.set(key, arr);
  });

  function shiftMonth(delta: number) { setFocus(f => new Date(f.getFullYear(), f.getMonth() + delta, 1)); }
  const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
          {focus.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
        </p>
        <div className="flex items-center gap-1">
          <button onClick={() => setFocus(new Date())} className="text-xs font-medium px-3 py-1.5 rounded-lg transition-colors hover:bg-[var(--bg-surface-2)]" style={{ color: "var(--text-secondary)", border: "1px solid var(--border-subtle)" }}>Today</button>
          <button onClick={() => shiftMonth(-1)} className="p-1.5 rounded-lg transition-colors hover:bg-[var(--bg-surface-2)]" style={{ color: "var(--text-secondary)", border: "1px solid var(--border-subtle)" }}><ChevronLeft className="w-4 h-4" /></button>
          <button onClick={() => shiftMonth(1)} className="p-1.5 rounded-lg transition-colors hover:bg-[var(--bg-surface-2)]" style={{ color: "var(--text-secondary)", border: "1px solid var(--border-subtle)" }}><ChevronRight className="w-4 h-4" /></button>
        </div>
      </div>

      <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--border-subtle)" }}>
        <div className="grid grid-cols-7">
          {weekdays.map(w => (
            <div key={w} className="px-2 py-2 text-[11px] font-semibold text-center" style={{ color: "var(--text-muted)", backgroundColor: "var(--bg-surface-2)", borderBottom: "1px solid var(--border-subtle)" }}>{w}</div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {days.map((day, i) => {
            const inMonth = day.getMonth() === focus.getMonth();
            const items = byKey.get(`${day.getFullYear()}-${day.getMonth()}-${day.getDate()}`) ?? [];
            const isToday = sameDay(day, today);
            return (
              <div key={i} className="min-h-[104px] p-1.5 flex flex-col"
                style={{ backgroundColor: inMonth ? "var(--bg-surface)" : "var(--bg-page)", borderRight: (i % 7 !== 6) ? "1px solid var(--border-subtle)" : undefined, borderBottom: i < 35 ? "1px solid var(--border-subtle)" : undefined }}>
                <span className="text-[11px] font-medium mb-1 inline-flex items-center justify-center w-5 h-5 rounded-full self-start"
                  style={isToday ? { backgroundColor: "var(--accent-soft-bg)", color: "var(--accent-text-strong)" } : { color: inMonth ? "var(--text-secondary)" : "var(--text-muted)" }}>{day.getDate()}</span>
                <div className="flex flex-col gap-1 overflow-hidden">
                  {items.slice(0, 3).map(p => (
                    <Link key={p.id} href={`/projects/${p.id}`}
                      className="block rounded px-1.5 py-0.5 text-[10px] font-medium truncate transition-opacity hover:opacity-80"
                      style={{ backgroundColor: stageColor(p.stage) + "22", color: "var(--text-primary)", textDecoration: "none" }}
                      title={p.name}>
                      {p.name}
                    </Link>
                  ))}
                  {items.length > 3 && <span className="text-[10px] px-1.5" style={{ color: "var(--text-muted)" }}>+{items.length - 3} more</span>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {undated > 0 && (
        <p className="text-xs mt-2" style={{ color: "var(--text-muted)" }}>
          {undated} project{undated === 1 ? "" : "s"} without a target date {undated === 1 ? "is" : "are"} not shown.
        </p>
      )}
    </div>
  );
}
