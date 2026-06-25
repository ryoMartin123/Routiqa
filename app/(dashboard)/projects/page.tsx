"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import ProjectWizard from "@/components/projects/ProjectWizard";
import UiSelect from "@/components/ui/Select";
import { Search, Plus, SlidersHorizontal, ChevronUp, ChevronDown, PlayCircle, PauseCircle, CheckCircle2, DollarSign, LayoutList, BarChart3, Columns3, CalendarDays, ChevronLeft, ChevronRight, MapPin, FolderKanban, LayoutGrid, GanttChart } from "lucide-react";
import ProjectCards from "@/components/projects/ProjectCards";
import { cn } from "@/lib/utils";
import { ALL_PROJECTS, getSessionProjects, updateProject, type Project } from "@/lib/projects/data";
import { getProjectStages, projectTypeLabel, type ProjectStage } from "@/lib/projects/settings";
import { mapProgress } from "@/lib/projects/map";
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

// Project completion — driven by the project Map (the single source of truth).
function progressOf(projectId: string): { completed: number; total: number; pct: number; unit: string } {
  const m = mapProgress(projectId);
  return { completed: m.done, total: m.total, pct: m.pct, unit: "steps" };
}

type SortField = "name" | "customerName" | "status" | "targetDate";
type ProjectView = "cards" | "overview" | "kanban" | "timeline" | "calendar" | "list";

// Overview leads the tab row, but Cards is the default opening view (set below).
const VIEW_TABS: { key: ProjectView; label: string; icon: typeof LayoutList }[] = [
  { key: "overview", label: "Overview", icon: BarChart3 },
  { key: "cards",    label: "Cards",    icon: LayoutGrid },
  { key: "kanban",   label: "Board",    icon: Columns3 },
  { key: "timeline", label: "Timeline", icon: GanttChart },
  { key: "calendar", label: "Calendar", icon: CalendarDays },
  { key: "list",     label: "List",     icon: LayoutList },
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
  const [view, setView]       = useState<ProjectView>("cards");
  const [lens, setLens]       = useState<LensKey>("status");
  const [tab, setTab]         = useState("all");
  const [search, setSearch]   = useState("");
  // Calendar focus lives here (lifted out of ProjectCalendar) so the month + nav
  // can sit in the shared toolbar row, in line with the tabs/search across views.
  const [calFocus, setCalFocus] = useState(() => new Date());
  const [sortField, setSort]  = useState<SortField>("status");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [refreshKey, setRefreshKey] = useState(0);

  // Filter popover (stage / type / assignee) — applies across every view.
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [fStage, setFStage]       = useState("all");
  const [fType, setFType]         = useState("all");
  const [fAssignee, setFAssignee] = useState("all");
  const filterRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!filtersOpen) return;
    const onDown = (e: MouseEvent) => { if (filterRef.current && !filterRef.current.contains(e.target as Node)) setFiltersOpen(false); };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [filtersOpen]);

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
  // Search is applied here (not just in the list) so the shared toolbar's search
  // box filters Kanban and Calendar too — it's in line with the tabs above them.
  const matchesSearch = (p: Project) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return p.name.toLowerCase().includes(q) || p.customerName.toLowerCase().includes(q);
  };
  const matchesFilters = (p: Project) =>
    (fStage === "all" || p.stage === fStage) &&
    (fType === "all" || p.type === fType) &&
    (fAssignee === "all" || (p.assignedTo || "Unassigned") === fAssignee);
  const lensFiltered = contextFiltered.filter(p => matchesTab(p) && matchesSearch(p) && matchesFilters(p));

  // Filter dropdown options (derived from the active context) + active count.
  const stageOpts    = [{ value: "all", label: "All stages" }, ...activeStages.map(s => ({ value: s.key, label: s.name }))];
  const typeOpts     = [{ value: "all", label: "All types" }, ...[...new Set(contextFiltered.map(p => p.type))].map(t => ({ value: t, label: projectTypeLabel(t) }))];
  const assigneeOpts = [{ value: "all", label: "All assignees" }, ...[...new Set(contextFiltered.map(p => p.assignedTo || "Unassigned"))].map(a => ({ value: a, label: a }))];
  const activeFilters = [fStage, fType, fAssignee].filter(v => v !== "all").length;

  function selectLens(k: LensKey) { setLens(k); setTab("all"); }

  // Summary metrics — respect the active context (stage is the source of truth)
  const summaryCards: SummaryCard[] = [
    { icon: PlayCircle,   label: "Active Projects", value: String(contextFiltered.filter(p => statusBucket(p, stageMap) === "active").length),    sub: "In progress", iconColor: "#4f46e5" },
    { icon: PauseCircle,  label: "Overdue",         value: String(contextFiltered.filter(p => healthBucket(p) === "overdue").length),            sub: "Past target", iconColor: "#ef4444" },
    { icon: CheckCircle2, label: "Completed",       value: String(contextFiltered.filter(p => statusBucket(p, stageMap) === "completed").length), sub: "Finished",    iconColor: "#10b981" },
    { icon: DollarSign,   label: "Total Value",     value: fmtMoney(contextFiltered.reduce((s, p) => s + parseMoney(p.estimatedValue), 0)), sub: `${contextFiltered.length} projects`, iconColor: "#0891b2" },
  ];

  const displayed = lensFiltered
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
    <div className="p-6 flex flex-col h-full min-h-0">
      <div className="flex items-center gap-4 mb-6 shrink-0">
        <div className="flex-1 min-w-0">
          <PageTitle title="Projects" count={contextFiltered.length} description="Organize larger multi-phase work, milestones, and related jobs." />
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
        <div className="flex-1 min-h-0 flex flex-col gap-5">
          <div className="shrink-0"><ModuleSummaryCards cards={summaryCards} /></div>
          <ProjectsOverview projects={contextFiltered} stages={activeStages} />
        </div>
      )}

      {/* Lens switcher + bucket tabs (left) · search + filter (right). The whole
          row sits ABOVE the views, so search & filter stay in line with the tabs
          and apply across List / Kanban / Calendar — never buried in the table. */}
      {view !== "overview" && (
        <div className="relative flex items-center justify-between flex-wrap gap-2 mb-4">
          {/* Calendar month nav — inline with the tabs/search, but absolutely
              centered to the section (not floating between the two groups). */}
          {view === "calendar" && (
            <div className="absolute left-1/2 -translate-x-1/2 hidden lg:flex items-center gap-0.5">
              <button onClick={() => setCalFocus(f => new Date(f.getFullYear(), f.getMonth() - 1, 1))} title="Previous month"
                className="p-1 rounded-md transition-colors hover:bg-[var(--bg-surface-2)]" style={{ color: "var(--text-muted)" }}><ChevronLeft className="w-4 h-4" /></button>
              <span className="text-sm font-semibold text-center" style={{ color: "var(--text-primary)", minWidth: 150 }}>
                {calFocus.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
              </span>
              <button onClick={() => setCalFocus(f => new Date(f.getFullYear(), f.getMonth() + 1, 1))} title="Next month"
                className="p-1 rounded-md transition-colors hover:bg-[var(--bg-surface-2)]" style={{ color: "var(--text-muted)" }}><ChevronRight className="w-4 h-4" /></button>
            </div>
          )}
          <div className="flex flex-wrap items-center gap-0.5">
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

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 rounded-lg px-3 py-1.5" style={{ backgroundColor: "var(--bg-input)" }}>
              <Search className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--text-muted)" }} />
              <input type="text" placeholder="Search projects..." value={search} onChange={e => setSearch(e.target.value)}
                className="bg-transparent text-sm outline-none w-44" style={{ color: "var(--text-primary)" }} />
            </div>
            <div className="relative" ref={filterRef}>
              <button onClick={() => setFiltersOpen(o => !o)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors"
                style={{
                  border: `1px solid ${activeFilters > 0 ? "var(--accent-soft-border)" : "var(--border)"}`,
                  backgroundColor: activeFilters > 0 ? "var(--accent-soft-bg)" : "var(--bg-surface)",
                  color: activeFilters > 0 ? "var(--accent-text)" : "var(--text-secondary)",
                }}>
                <SlidersHorizontal className="w-3.5 h-3.5" /> Filter
                {activeFilters > 0 && <span className="text-[10px] font-bold px-1.5 rounded-full" style={{ backgroundColor: "var(--accent-soft-2-bg)", color: "var(--accent-text)" }}>{activeFilters}</span>}
              </button>
              {filtersOpen && (
                <div className="absolute right-0 top-full mt-2 z-50 rounded-xl p-4 w-64 space-y-3" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "0 12px 32px rgba(0,0,0,0.18)" }}>
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Filters</p>
                    {activeFilters > 0 && <button onClick={() => { setFStage("all"); setFType("all"); setFAssignee("all"); }} className="text-xs" style={{ color: "var(--accent-text)" }}>Clear</button>}
                  </div>
                  <div><label className="block text-[10px] font-medium mb-1 uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Stage</label><UiSelect size="sm" value={fStage} onChange={setFStage} options={stageOpts} /></div>
                  <div><label className="block text-[10px] font-medium mb-1 uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Type</label><UiSelect size="sm" value={fType} onChange={setFType} options={typeOpts} /></div>
                  <div><label className="block text-[10px] font-medium mb-1 uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Assignee</label><UiSelect size="sm" value={fAssignee} onChange={setFAssignee} options={assigneeOpts} /></div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {view === "cards"    && <ProjectCards projects={displayed} stagesByKey={stageMap} onOpen={(id) => router.push(`/projects/${id}`)} />}
      {view === "kanban"   && <ProjectKanban stages={activeStages} projects={lensFiltered} onMove={moveStage} />}
      {view === "timeline" && <ProjectTimeline projects={displayed} stageMap={stageMap} onOpen={(id) => router.push(`/projects/${id}`)} />}
      {view === "calendar" && <ProjectCalendar stages={stages} projects={lensFiltered} focus={calFocus} />}

      {view === "list" && (
      <div className="rounded-xl overflow-hidden" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-subtle)", boxShadow: "var(--shadow-card)" }}>
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
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: "var(--bg-input)" }}><FolderKanban className="w-3.5 h-3.5" style={{ color: "var(--text-muted)" }} /></div>
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

// ─── Timeline view (placeholder) ──────────────────────────
// Projects laid out by target date. Early preview — a chronological rail with a
// progress bar per project; richer milestone bars land later.
function ProjectTimeline({ projects, stageMap, onOpen }: {
  projects: Project[]; stageMap: Map<string, ProjectStage>; onOpen: (id: string) => void;
}) {
  const sorted = [...projects].sort((a, b) => {
    const at = a.targetDate ? new Date(a.targetDate).getTime() : Infinity;
    const bt = b.targetDate ? new Date(b.targetDate).getTime() : Infinity;
    return at - bt;
  });
  if (sorted.length === 0) {
    return <div className="rounded-xl p-12 text-center" style={{ border: "1px dashed var(--border)" }}><p className="text-sm" style={{ color: "var(--text-muted)" }}>No projects to plot.</p></div>;
  }
  return (
    <div className="rounded-xl overflow-hidden" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-subtle)", boxShadow: "var(--shadow-card)" }}>
      <div className="px-4 py-2.5 flex items-center justify-between" style={{ borderBottom: "1px solid var(--border-subtle)", backgroundColor: "var(--bg-surface-2)" }}>
        <p className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>By target date</p>
        <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>Timeline — early preview</span>
      </div>
      {sorted.map((p, i) => {
        const prog = progressOf(p.id);
        const stage = stageMap.get(p.stage ?? "");
        return (
          <button key={p.id} onClick={() => onOpen(p.id)} className="w-full grid items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-[var(--bg-surface-2)]"
            style={{ gridTemplateColumns: "108px 1.6fr 2.4fr 60px", borderTop: i === 0 ? "none" : "1px solid var(--border-subtle)" }}>
            <span className="text-xs font-medium" style={{ color: p.targetDate ? "var(--text-secondary)" : "var(--text-muted)" }}>{p.targetDate ?? "No date"}</span>
            <div className="min-w-0">
              <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>{p.name}</p>
              <p className="text-[11px] truncate" style={{ color: "var(--text-muted)" }}>{p.customerName}{stage ? ` · ${stage.name}` : ""}</p>
            </div>
            <div className="h-2 rounded-full" style={{ backgroundColor: "var(--bg-input)" }}>
              <div className="h-2 rounded-full" style={{ width: `${prog.pct}%`, backgroundColor: prog.pct === 100 ? "#10b981" : stage?.color ?? "#6366f1" }} />
            </div>
            <span className="text-xs font-semibold text-right tabular-nums" style={{ color: "var(--text-secondary)" }}>{prog.pct}%</span>
          </button>
        );
      })}
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
function ProjectCalendar({ stages, projects, focus }: { stages: ProjectStage[]; projects: Project[]; focus: Date }) {
  const stageColor = (key?: string) => stages.find(s => s.key === key)?.color ?? "#6366f1";
  // Overflow popover: which week + where it was clicked (fixed-positioned so the
  // calendar's overflow-hidden corners don't clip it).
  const [pop, setPop] = useState<{ w: number; x: number; y: number } | null>(null);

  const monthStart = new Date(focus.getFullYear(), focus.getMonth(), 1);
  const gridStart = new Date(monthStart);
  gridStart.setDate(gridStart.getDate() - gridStart.getDay());
  const days = Array.from({ length: 42 }, (_, i) => { const d = new Date(gridStart); d.setDate(d.getDate() + i); return d; });
  const today = new Date();
  const dayOnly = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const today0 = dayOnly(today);
  const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const fmtMD = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const fmtRange = (s: Date, e: Date) => s.getTime() === e.getTime() ? fmtMD(s)
    : (s.getMonth() === e.getMonth() && s.getFullYear() === e.getFullYear() ? `${fmtMD(s)} – ${e.getDate()}` : `${fmtMD(s)} – ${fmtMD(e)}`);

  // Each project becomes a [start, end] span (target required; start defaults to it).
  type Span = { p: Project; start: Date; end: Date; lane: number };
  const spans: Span[] = [];
  let undated = 0;
  projects.forEach(p => {
    const end = p.targetDate ? new Date(p.targetDate) : null;
    if (!end || isNaN(end.getTime())) { undated++; return; }
    let start = p.startDate ? new Date(p.startDate) : null;
    if (!start || isNaN(start.getTime()) || start.getTime() > end.getTime()) start = end;
    spans.push({ p, start: dayOnly(start), end: dayOnly(end), lane: 0 });
  });
  const isOverdue = (s: Span) => s.end.getTime() < today0.getTime();

  // D — priority so the visible lanes show the projects that matter most: overdue
  // first, then earliest start, then earliest finish.
  spans.sort((a, b) => {
    const ao = isOverdue(a) ? 0 : 1, bo = isOverdue(b) ? 0 : 1;
    if (ao !== bo) return ao - bo;
    if (a.start.getTime() !== b.start.getTime()) return a.start.getTime() - b.start.getTime();
    return a.end.getTime() - b.end.getTime();
  });
  // C — assign each span ONE lane for the whole visible month, so a multi-week bar
  // stays on the same row across weeks instead of jumping / vanishing.
  const lanes: { start: number; end: number }[][] = [];
  spans.forEach(s => {
    const sT = s.start.getTime(), eT = s.end.getTime();
    let lane = lanes.findIndex(ivs => ivs.every(iv => eT < iv.start || sT > iv.end));
    if (lane === -1) { lane = lanes.length; lanes.push([]); }
    lanes[lane].push({ start: sT, end: eT });
    s.lane = lane;
  });

  const LANE_H = 20, TOP = 26, MAX_LANES = 3;

  // Spans intersecting week w, clamped to its columns, sorted by their month lane.
  function spansForWeek(w: number) {
    const weekStart = dayOnly(days[w * 7]), weekEnd = dayOnly(days[w * 7 + 6]);
    return spans
      .filter(s => s.start.getTime() <= weekEnd.getTime() && s.end.getTime() >= weekStart.getTime())
      .map(s => {
        const segStart = s.start.getTime() < weekStart.getTime() ? weekStart : s.start;
        const segEnd   = s.end.getTime()   > weekEnd.getTime()   ? weekEnd   : s.end;
        return {
          ...s, startCol: segStart.getDay(), endCol: segEnd.getDay(),
          contStart: s.start.getTime() < weekStart.getTime(),
          contEnd: s.end.getTime() > weekEnd.getTime(),
        };
      })
      .sort((a, b) => a.lane - b.lane);
  }

  return (
    <div>
      <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--border-subtle)" }}>
        <div className="grid grid-cols-7">
          {weekdays.map(w => (
            <div key={w} className="px-2 py-2 text-[11px] font-semibold text-center" style={{ color: "var(--text-muted)", backgroundColor: "var(--bg-surface-2)", borderBottom: "1px solid var(--border-subtle)" }}>{w}</div>
          ))}
        </div>

        {Array.from({ length: 6 }).map((_, w) => {
          const weekDays = days.slice(w * 7, w * 7 + 7);
          const wspans   = spansForWeek(w);
          const visible  = wspans.filter(b => b.lane < MAX_LANES);
          const hidden   = wspans.length - visible.length;
          const maxVisLane = visible.reduce((m, b) => Math.max(m, b.lane + 1), 0);
          const laneRows = hidden > 0 ? MAX_LANES : maxVisLane;
          const minH     = Math.max(108, TOP + Math.max(1, laneRows) * LANE_H + (hidden ? 18 : 8));
          return (
            <div key={w} className="relative grid grid-cols-7" style={{ minHeight: minH, borderBottom: w < 5 ? "1px solid var(--border-subtle)" : undefined }}>
              {weekDays.map((day, ci) => {
                const inMonth = day.getMonth() === focus.getMonth();
                const isToday = sameDay(day, today);
                return (
                  <div key={ci} className="px-2 pt-1.5" style={{ backgroundColor: inMonth ? "var(--bg-surface)" : "var(--bg-page)", borderRight: ci !== 6 ? "1px solid var(--border-subtle)" : undefined }}>
                    <span className="text-[11px]"
                      style={{ color: isToday ? "#4f46e5" : inMonth ? "var(--text-secondary)" : "var(--text-muted)", fontWeight: isToday ? 700 : 500 }}
                      title={isToday ? "Today" : undefined}>{day.getDate()}</span>
                  </div>
                );
              })}

              {/* Spanning bars overlay */}
              {visible.map(b => {
                const col = stageColor(b.p.stage);
                const leftPct  = (b.startCol / 7) * 100;
                const widthPct = ((b.endCol - b.startCol + 1) / 7) * 100;
                return (
                  <Link key={b.p.id} href={`/projects/${b.p.id}`} title={b.p.name}
                    className="absolute text-[10px] font-medium truncate transition-opacity hover:opacity-90 flex items-center"
                    style={{
                      left: `calc(${leftPct}% + 3px)`, width: `calc(${widthPct}% - 6px)`,
                      top: TOP + b.lane * LANE_H, height: LANE_H - 4,
                      paddingLeft: 6, paddingRight: 6,
                      backgroundColor: col + "26", color: "var(--text-primary)", textDecoration: "none",
                      borderLeft: b.contStart ? undefined : `2px solid ${col}`,
                      borderTopLeftRadius: b.contStart ? 0 : 4, borderBottomLeftRadius: b.contStart ? 0 : 4,
                      borderTopRightRadius: b.contEnd ? 0 : 4, borderBottomRightRadius: b.contEnd ? 0 : 4,
                    }}>
                    {b.contStart ? "‹ " : ""}{b.p.name}
                  </Link>
                );
              })}
              {hidden > 0 && (
                <button onClick={e => setPop({ w, x: e.clientX, y: e.clientY })}
                  className="absolute text-[10px] font-semibold px-1.5 py-0.5 rounded transition-colors hover:bg-[var(--bg-surface-2)]"
                  style={{ left: 6, top: TOP + MAX_LANES * LANE_H, color: "var(--accent-text)" }}>
                  +{hidden} more
                </button>
              )}
            </div>
          );
        })}
      </div>

      {undated > 0 && (
        <p className="text-xs mt-2" style={{ color: "var(--text-muted)" }}>
          {undated} project{undated === 1 ? "" : "s"} without a target date {undated === 1 ? "is" : "are"} not shown.
        </p>
      )}

      {/* A — overflow popover: every project active that week, one click away */}
      {pop && (() => {
        const list = spansForWeek(pop.w);
        const ws = dayOnly(days[pop.w * 7]), we = dayOnly(days[pop.w * 7 + 6]);
        const vw = typeof window !== "undefined" ? window.innerWidth : 1200;
        const vh = typeof window !== "undefined" ? window.innerHeight : 800;
        const left = Math.min(pop.x, vw - 304);
        const top  = Math.min(pop.y, vh - 340);
        return (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setPop(null)} />
            <div className="fixed z-50 rounded-xl overflow-hidden" style={{ left, top, width: 288, backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "0 12px 32px rgba(0,0,0,0.2)" }}>
              <div className="flex items-center justify-between px-3 py-2" style={{ borderBottom: "1px solid var(--border-subtle)", backgroundColor: "var(--bg-surface-2)" }}>
                <p className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>Week of {fmtMD(ws)} – {fmtMD(we)} · {list.length}</p>
                <button onClick={() => setPop(null)} className="text-sm leading-none px-1" style={{ color: "var(--text-muted)" }}>✕</button>
              </div>
              <div className="max-h-72 overflow-y-auto thin-scroll-y py-1">
                {list.map(s => (
                  <Link key={s.p.id} href={`/projects/${s.p.id}`} onClick={() => setPop(null)}
                    className="flex items-center gap-2 px-3 py-2 hover:bg-[var(--bg-surface-2)] transition-colors" style={{ textDecoration: "none" }}>
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: stageColor(s.p.stage) }} />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium truncate" style={{ color: "var(--text-primary)" }}>{s.p.name}</p>
                      <p className="text-[10px] truncate" style={{ color: isOverdue(s) ? "#dc2626" : "var(--text-muted)" }}>
                        {fmtRange(s.start, s.end)}{isOverdue(s) ? " · Overdue" : ""}{s.p.assignedTo ? ` · ${s.p.assignedTo}` : ""}
                      </p>
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--text-muted)" }} />
                  </Link>
                ))}
              </div>
            </div>
          </>
        );
      })()}
    </div>
  );
}

// ─── Overview view — portfolio statistics ─────────────────
// Beyond the KPI cards: distribution by stage, a health + average-completion
// read-out, and a breakdown by project type. Derived from the active context.
function ProjectsOverview({ projects, stages }: {
  projects: Project[]; stages: ProjectStage[];
}) {
  const total = projects.length;
  const avgProgress = total ? Math.round(projects.reduce((s, p) => s + mapProgress(p.id).pct, 0) / total) : 0;

  const byStage = stages.map(st => {
    const items = projects.filter(p => p.stage === st.key);
    return { st, count: items.length, value: items.reduce((s, p) => s + parseMoney(p.estimatedValue), 0) };
  });
  const maxStage = Math.max(1, ...byStage.map(b => b.count));

  const health = { on_track: 0, at_risk: 0, overdue: 0 };
  projects.forEach(p => { health[healthBucket(p)]++; });
  const HEALTH = [
    { key: "on_track", label: "On track", color: "#10b981" },
    { key: "at_risk",  label: "At risk",  color: "#f59e0b" },
    { key: "overdue",  label: "Overdue",  color: "#ef4444" },
  ] as const;

  const typeMap = new Map<string, number>();
  projects.forEach(p => { const k = projectTypeLabel(p.type); typeMap.set(k, (typeMap.get(k) ?? 0) + 1); });
  const byType = [...typeMap.entries()].sort((a, b) => b[1] - a[1]);

  // Team load — projects (and value) per assigned user.
  const assigneeMap = new Map<string, { name: string; initials: string; count: number; value: number }>();
  projects.forEach(p => {
    const name = p.assignedTo || "Unassigned";
    const cur = assigneeMap.get(name) ?? { name, initials: name === "Unassigned" ? "—" : (p.assignedToInitials || "—"), count: 0, value: 0 };
    cur.count++; cur.value += parseMoney(p.estimatedValue);
    assigneeMap.set(name, cur);
  });
  const byAssignee = [...assigneeMap.values()].sort((a, b) => b.count - a.count);
  const maxAssignee = Math.max(1, ...byAssignee.map(a => a.count));

  if (total === 0) return null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 flex-1 min-h-0" style={{ gridAutoRows: "minmax(min-content, 1fr)" }}>
      <OvPanel title="Projects by stage" className="lg:col-span-2">
        <div className="space-y-2.5">
          {byStage.map(({ st, count, value }) => (
            <div key={st.key} className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 w-32 shrink-0 min-w-0">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: st.color }} />
                <span className="text-xs truncate" style={{ color: "var(--text-secondary)" }}>{st.name}</span>
              </div>
              <div className="flex-1 h-2 rounded-full" style={{ backgroundColor: "var(--bg-input)" }}>
                <div className="h-2 rounded-full" style={{ width: `${(count / maxStage) * 100}%`, backgroundColor: st.color }} />
              </div>
              <span className="text-xs font-medium w-8 text-right shrink-0" style={{ color: "var(--text-primary)" }}>{count}</span>
              <span className="text-[11px] w-16 text-right shrink-0" style={{ color: "var(--text-muted)" }}>{fmtMoney(value)}</span>
            </div>
          ))}
          {byStage.length === 0 && <p className="text-xs" style={{ color: "var(--text-muted)" }}>No active stages configured.</p>}
        </div>
      </OvPanel>

      <OvPanel title="Health & progress">
        <div className="space-y-2.5">
          {HEALTH.map(h => (
            <div key={h.key} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: h.color }} />
                <span className="text-xs" style={{ color: "var(--text-secondary)" }}>{h.label}</span>
              </div>
              <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{health[h.key]}</span>
            </div>
          ))}
        </div>
        <div className="mt-3 pt-3" style={{ borderTop: "1px solid var(--border-subtle)" }}>
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span style={{ color: "var(--text-muted)" }}>Avg. completion</span>
            <span className="font-semibold" style={{ color: "var(--text-primary)" }}>{avgProgress}%</span>
          </div>
          <div className="h-2 rounded-full" style={{ backgroundColor: "var(--bg-input)" }}>
            <div className="h-2 rounded-full bg-indigo-500" style={{ width: `${avgProgress}%` }} />
          </div>
        </div>
      </OvPanel>

      <OvPanel title="By assignee" className="lg:col-span-2">
        <div className="space-y-2.5">
          {byAssignee.map(a => (
            <div key={a.name} className="flex items-center gap-3">
              <div className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold text-white shrink-0"
                style={{ backgroundColor: a.name === "Unassigned" ? "#9ca3af" : "#6366f1" }}>{a.initials}</div>
              <span className="text-xs truncate w-28 shrink-0" style={{ color: "var(--text-secondary)" }}>{a.name}</span>
              <div className="flex-1 h-2 rounded-full" style={{ backgroundColor: "var(--bg-input)" }}>
                <div className="h-2 rounded-full" style={{ width: `${(a.count / maxAssignee) * 100}%`, backgroundColor: a.name === "Unassigned" ? "#9ca3af" : "#6366f1" }} />
              </div>
              <span className="text-xs font-medium w-8 text-right shrink-0" style={{ color: "var(--text-primary)" }}>{a.count}</span>
              <span className="text-[11px] w-16 text-right shrink-0" style={{ color: "var(--text-muted)" }}>{fmtMoney(a.value)}</span>
            </div>
          ))}
        </div>
      </OvPanel>

      <OvPanel title="By type">
        <div className="flex flex-wrap gap-2">
          {byType.map(([label, n]) => (
            <div key={label} className="flex items-center gap-2 px-3 py-1.5 rounded-lg" style={{ backgroundColor: "var(--bg-surface-2)", border: "1px solid var(--border-subtle)" }}>
              <span className="text-xs" style={{ color: "var(--text-secondary)" }}>{label}</span>
              <span className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>{n}</span>
            </div>
          ))}
        </div>
      </OvPanel>
    </div>
  );
}

function OvPanel({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-xl p-4 flex flex-col", className)} style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-subtle)", boxShadow: "var(--shadow-card)" }}>
      <p className="text-xs font-semibold uppercase tracking-widest mb-3 shrink-0" style={{ color: "var(--text-muted)" }}>{title}</p>
      <div className="flex-1 min-h-0 flex flex-col justify-start">{children}</div>
    </div>
  );
}
