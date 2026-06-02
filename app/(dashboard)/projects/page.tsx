"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Search, Plus, SlidersHorizontal, ChevronUp, ChevronDown, PlayCircle, PauseCircle, CheckCircle2, DollarSign } from "lucide-react";
import { cn } from "@/lib/utils";
import { ALL_PROJECTS, getSessionProjects, PROJECT_STATUS_CONFIG, PROJECT_TYPE_LABELS, getProjectProgress, type Project, type ProjectStatus } from "@/lib/projects/data";
import { useHierarchy } from "@/components/providers/HierarchyProvider";
import ModuleSummaryCards, { type SummaryCard } from "@/components/shared/ModuleSummaryCards";
import ModuleViewToggle, { type ModuleView } from "@/components/shared/ModuleViewToggle";
import StatusTabs from "@/components/shared/StatusTabs";

function parseMoney(s?: string): number {
  if (!s) return 0;
  const n = parseFloat(s.replace(/[^0-9.]/g, ""));
  return isNaN(n) ? 0 : n;
}
function fmtMoney(n: number): string {
  if (n >= 1000) return `$${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k`;
  return `$${n.toLocaleString()}`;
}

const TABS = [
  { key: "all",       label: "All",       fn: (_: Project) => true },
  { key: "active",    label: "Active",    fn: (p: Project) => p.status === "active" },
  { key: "draft",     label: "Draft",     fn: (p: Project) => p.status === "draft" },
  { key: "on_hold",   label: "On Hold",   fn: (p: Project) => p.status === "on_hold" },
  { key: "completed", label: "Completed", fn: (p: Project) => p.status === "completed" },
];

type SortField = "name" | "customerName" | "status" | "targetDate";

export default function ProjectsPage() {
  const { effectiveCompanyId, effectiveLocationId } = useHierarchy();

  const [tab, setTab]         = useState("all");
  const [search, setSearch]   = useState("");
  const [sortField, setSort]  = useState<SortField>("status");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [moduleView, setModuleView] = useState<ModuleView>("list");

  // Merge session-created projects (e.g. converted from a quote) after mount.
  const [extraProjects, setExtraProjects] = useState<Project[]>([]);
  useEffect(() => { setExtraProjects(getSessionProjects()); }, []);
  const allProjects = [...extraProjects, ...ALL_PROJECTS];

  const contextFiltered = allProjects
    .filter(p => !effectiveCompanyId  || p.companyId  === effectiveCompanyId)
    .filter(p => !effectiveLocationId || p.locationId === effectiveLocationId);

  // Summary metrics — respect the active context
  const summaryCards: SummaryCard[] = [
    { icon: PlayCircle,   label: "Active Projects", value: String(contextFiltered.filter(p => p.status === "active").length),    sub: "In progress", iconColor: "#4f46e5" },
    { icon: PauseCircle,  label: "On Hold",         value: String(contextFiltered.filter(p => p.status === "on_hold").length),   sub: "Paused",      iconColor: "#f59e0b" },
    { icon: CheckCircle2, label: "Completed",       value: String(contextFiltered.filter(p => p.status === "completed").length), sub: "Finished",    iconColor: "#10b981" },
    { icon: DollarSign,   label: "Total Value",     value: fmtMoney(contextFiltered.reduce((s, p) => s + parseMoney(p.estimatedValue), 0)), sub: `${contextFiltered.length} projects`, iconColor: "#0891b2" },
  ];

  const tabFn = TABS.find(t => t.key === tab)?.fn ?? (() => true);

  const displayed = contextFiltered
    .filter(tabFn)
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
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-semibold" style={{ color: "var(--text-primary)" }}>Projects</h1>
            <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: "var(--bg-input)", color: "var(--text-muted)" }}>{contextFiltered.length}</span>
          </div>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>Multi-phase and larger scope work</p>
        </div>
        <ModuleViewToggle view={moduleView} onChange={setModuleView} />
        <div className="flex-1 flex justify-end">
          <button className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-3 py-2 rounded-lg transition-colors">
            <Plus className="w-4 h-4" /> New Project
          </button>
        </div>
      </div>

      {moduleView === "overview" && (
        <div className="mb-5">
          <ModuleSummaryCards cards={summaryCards} />
        </div>
      )}

      {moduleView === "list" && (
      <div className="rounded-xl overflow-hidden" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-subtle)", boxShadow: "var(--shadow-card)" }}>
        {/* Tabs + search */}
        <div className="flex items-center justify-between flex-wrap gap-2 px-4 py-3" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
          <StatusTabs active={tab} onChange={k => setTab(k as typeof tab)}
            tabs={TABS.map(t => ({ key: t.key, label: t.label, count: contextFiltered.filter(t.fn).length }))} />
          <div className="flex items-center gap-2">
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
        </div>

        {/* Column headers */}
        <div className="grid px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider select-none"
          style={{ gridTemplateColumns: "2.5fr 1fr 1fr 1fr 1fr 1fr 1.5fr", color: "var(--text-muted)", borderBottom: "1px solid var(--border-subtle)", backgroundColor: "var(--bg-surface-2)" }}>
          {([
            { label: "Project",     field: "name"         },
            { label: "Type",        field: null            },
            { label: "Status",      field: "status"       },
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
            const s    = PROJECT_STATUS_CONFIG[p.status];
            const prog = getProjectProgress(p.id);
            const pct  = prog.total > 0 ? Math.round((prog.completed / prog.total) * 100) : 0;
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
                <span className="text-sm" style={{ color: "var(--text-secondary)" }}>{PROJECT_TYPE_LABELS[p.type]}</span>
                <span className="inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: s.bg, color: s.color }}>{s.label}</span>
                <span className="text-sm truncate" style={{ color: "var(--text-secondary)" }}>{p.customerName}</span>
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

        <div className="flex items-center justify-between px-4 py-3 text-xs"
          style={{ borderTop: "1px solid var(--border-subtle)", color: "var(--text-muted)", backgroundColor: "var(--bg-surface-2)" }}>
          <span>Showing {displayed.length} of {contextFiltered.filter(tabFn).length} projects</span>
        </div>
      </div>
      )}
    </div>
  );
}
