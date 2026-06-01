"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import {
  Search, Plus, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, LayoutList, Columns3,
  TrendingUp, DollarSign, CalendarClock, Trophy, MapPin, AlertTriangle,
  SlidersHorizontal, X, Eye, EyeOff, SlidersVertical, BarChart3, CalendarDays,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  ALL_LEADS, LEAD_STAGE_CONFIG, LEAD_SOURCE_LABELS, leadAgeDays, getLeadTasks,
  type Lead, type LeadStage, type LeadSource,
} from "@/lib/leads/data";
import { getStages, type PipelineStage, type StageCategory } from "@/lib/pipelines/data";
import { useHierarchy } from "@/components/providers/HierarchyProvider";
import Select from "@/components/ui/Select";
import ModuleSummaryCards, { type SummaryCard } from "@/components/shared/ModuleSummaryCards";

// ─── Lead value + status helpers ──────────────────────────
function parseLeadValue(l: Lead): number {
  if (!l.estimatedValue) return 0;
  const n = parseFloat(l.estimatedValue.replace(/[^0-9.]/g, ""));
  return isNaN(n) ? 0 : n;
}
function fmtMoney(n: number): string {
  if (n >= 1000) return `$${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k`;
  return `$${n.toLocaleString()}`;
}
function leadFollowUpDue(l: Lead): boolean {
  return getLeadTasks(l.id).some(t => t.status === "open" || t.status === "overdue");
}
function leadIsOverdue(l: Lead): boolean {
  return getLeadTasks(l.id).some(t => t.status === "overdue") || leadAgeDays(l.createdAt) > 21;
}

// ─── Stage display config, resolved from pipeline settings ──
// Pipeline settings keys (e.g. "new_lead") match the lead.stage values.
// Falls back to LEAD_STAGE_CONFIG for any key not present in settings.
interface StageDisplay { label: string; color: string; bg: string; category: StageCategory }

function buildStageResolver(stages: PipelineStage[]): (key: string) => StageDisplay {
  const byKey = new Map(stages.map(s => [s.key, s]));
  return (key: string) => {
    const s = byKey.get(key);
    if (s) return { label: s.name, color: s.color, bg: s.color + "22", category: s.category };
    const legacy = LEAD_STAGE_CONFIG[key as LeadStage];
    if (legacy) {
      const cat: StageCategory = key === "won" ? "won" : key === "lost" ? "lost" : "open";
      return { label: legacy.label, color: legacy.color, bg: legacy.bg, category: cat };
    }
    return { label: key, color: "#6b7280", bg: "var(--bg-input)", category: "open" };
  };
}

type SortField = "customerName" | "stage" | "source" | "estimatedValue" | "locationName" | "createdAt";

// ─── Age display ──────────────────────────────────────────
function AgeChip({ createdAt }: { createdAt: string }) {
  const days = leadAgeDays(createdAt);
  const urgent = days > 14;
  return (
    <span
      className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
      style={{
        backgroundColor: urgent ? "#fee2e2" : "var(--bg-input)",
        color: urgent ? "#991b1b" : "var(--text-muted)",
      }}
    >
      {days}d
    </span>
  );
}

// ─── Pipeline card ────────────────────────────────────────
function PipelineCard({ lead }: { lead: Lead }) {
  const overdue = leadIsOverdue(lead);
  return (
    <Link href={`/leads/${lead.id}`}
      draggable
      onDragStart={e => { e.dataTransfer.setData("text/plain", lead.id); e.dataTransfer.effectAllowed = "move"; }}
      className="block rounded-xl p-3 mb-2 transition-all hover:shadow-md cursor-grab active:cursor-grabbing"
      style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-subtle)", boxShadow: "var(--shadow-card)", textDecoration: "none" }}>

      {/* Customer + status */}
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center text-[9px] font-bold text-indigo-600 shrink-0">
            {lead.customerInitials}
          </div>
          <p className="text-sm font-semibold truncate" style={{ color: "var(--text-primary)" }}>{lead.customerName}</p>
        </div>
        {overdue
          ? <span className="inline-flex items-center gap-1 text-[9px] font-semibold px-1.5 py-0.5 rounded-full shrink-0" style={{ backgroundColor: "#fee2e2", color: "#991b1b" }}><AlertTriangle className="w-2.5 h-2.5" /> Overdue</span>
          : <AgeChip createdAt={lead.createdAt} />}
      </div>

      {/* Lead type / title */}
      <p className="text-xs font-medium leading-snug mb-1" style={{ color: "var(--text-secondary)" }}>{lead.title}</p>

      {/* Address */}
      {lead.customerAddress && (
        <p className="text-[10px] leading-snug mb-2 truncate flex items-center gap-1" style={{ color: "var(--text-muted)" }}>
          <MapPin className="w-2.5 h-2.5 shrink-0" /> {lead.customerAddress}
        </p>
      )}

      {/* Value + source */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="text-sm font-bold" style={{ color: lead.estimatedValue ? "var(--text-primary)" : "var(--text-muted)" }}>
          {lead.estimatedValue ?? "TBD"}
        </span>
        <span className="text-[9px] font-medium px-1.5 py-0.5 rounded-full" style={{ backgroundColor: "var(--bg-input)", color: "var(--text-muted)" }}>
          {LEAD_SOURCE_LABELS[lead.source]}
        </span>
      </div>

      {/* Assigned + date */}
      <div className="flex items-center justify-between pt-2" style={{ borderTop: "1px solid var(--border-subtle)" }}>
        <div className="flex items-center gap-1.5 min-w-0">
          <div className="w-5 h-5 rounded-full bg-indigo-600 flex items-center justify-center text-[8px] font-bold text-white shrink-0" title={lead.assignedTo}>
            {lead.assignedToInitials}
          </div>
          <span className="text-[10px] truncate" style={{ color: "var(--text-secondary)" }}>{lead.assignedTo}</span>
        </div>
        <span className="text-[10px] shrink-0" style={{ color: "var(--text-muted)" }}>{lead.displayDate}</span>
      </div>
    </Link>
  );
}

// ─── Pipeline view ────────────────────────────────────────
// Active working stages only — Won/Lost are reached via the tab filter and
// render as a flat grid so they don't clutter the board.
function PipelineView({ leads, openStages, resolve, tab, onMoveStage }: {
  leads: Lead[];
  openStages: PipelineStage[];
  resolve: (key: string) => StageDisplay;
  tab: string;
  onMoveStage: (leadId: string, stageKey: string) => void;
}) {
  const [dropStage, setDropStage] = useState<string | null>(null);
  // Won / Lost → flat grid
  if (tab === "won" || tab === "lost") {
    const subset = leads.filter(l => resolve(l.stage).category === tab);
    const total  = subset.reduce((s, l) => s + parseLeadValue(l), 0);
    return (
      <div className="pb-4">
        {subset.length === 0 ? (
          <div className="rounded-xl py-16 text-center" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-subtle)" }}>
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>No {tab} leads in this view.</p>
          </div>
        ) : (
          <>
            <p className="text-xs mb-3" style={{ color: "var(--text-muted)" }}>
              {subset.length} {tab} lead{subset.length === 1 ? "" : "s"}{total > 0 ? ` · ${fmtMoney(total)}` : ""}
            </p>
            <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}>
              {subset.map(l => <PipelineCard key={l.id} lead={l} />)}
            </div>
          </>
        )}
      </div>
    );
  }

  // Active board — flat columns (Attio style): no boxed column fill, cards float.
  // Vertical mouse wheel pans horizontally; thin themed scrollbar; columns snap.
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
        {openStages.map(stage => {
          const cards = leads.filter(l => l.stage === stage.key);
          const total = cards.reduce((s, l) => s + parseLeadValue(l), 0);
          return (
            <div key={stage.key}
              className="shrink-0 snap-col flex flex-col rounded-xl transition-colors h-full min-h-0"
              style={{ width: "296px", backgroundColor: dropStage === stage.key ? "var(--accent-soft-bg)" : undefined, outline: dropStage === stage.key ? "1px dashed var(--accent-soft-border)" : undefined }}
              onDragOver={e => { e.preventDefault(); if (dropStage !== stage.key) setDropStage(stage.key); }}
              onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDropStage(null); }}
              onDrop={e => { e.preventDefault(); setDropStage(null); const id = e.dataTransfer.getData("text/plain"); if (id) onMoveStage(id, stage.key); }}>
              {/* Flat stage header: colored dot · name · count · value */}
              <div className="flex items-center gap-2 mb-3 pb-2 px-1 pt-1 shrink-0" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: stage.color }} />
                <p className="text-sm font-semibold truncate" style={{ color: "var(--text-primary)" }}>{stage.name}</p>
                <span className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>{cards.length}</span>
                {total > 0 && <span className="ml-auto text-[11px] font-medium shrink-0" style={{ color: "var(--text-muted)" }}>{fmtMoney(total)}</span>}
              </div>

              {/* Cards — drag to another column to change stage; column scrolls internally. */}
              <div className="space-y-2 overflow-y-auto thin-scroll-y flex-1 px-1 pb-1" style={{ minHeight: "100px" }}>
                {cards.length === 0
                  ? <p className="text-[11px] py-4 text-center" style={{ color: "var(--text-muted)" }}>Drop here</p>
                  : cards.map(l => <PipelineCard key={l.id} lead={l} />)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Filter field used in the Leads filter popover.
function LeadFilterField({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="block text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: "var(--text-muted)" }}>{label}</label>{children}</div>;
}

// ─── Page ─────────────────────────────────────────────────
export default function LeadsPage() {
  const { effectiveCompanyId, effectiveLocationId, effectiveServiceAreaId } = useHierarchy();

  const [view, setView]       = useState<"overview" | "pipeline" | "table" | "calendar">("table");
  const [stageEdits, setStageEdits] = useState<Record<string, string>>({});
  const [tab, setTab]         = useState<string>("active");
  const [search, setSearch]   = useState("");
  const [sortField, setSort]  = useState<SortField>("createdAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  // Pipeline filters
  const [fAssigned, setFAssigned] = useState("all");
  const [fSource,   setFSource]   = useState("all");
  const [fPriority, setFPriority] = useState("all");
  const [fDate,     setFDate]     = useState("all");
  const [fLocation, setFLocation] = useState("all");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const filtersRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!filtersOpen) return;
    const onDown = (e: MouseEvent) => { if (filtersRef.current && !filtersRef.current.contains(e.target as Node)) setFiltersOpen(false); };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [filtersOpen]);

  // Visible-stages control (which open stages show on the board) — persisted.
  const [hiddenStages, setHiddenStages] = useState<Set<string>>(new Set());
  const [stagesOpen, setStagesOpen] = useState(false);
  const stagesRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    try { const raw = localStorage.getItem("crm-leads-hidden-stages"); if (raw) setHiddenStages(new Set(JSON.parse(raw))); } catch { /* ignore */ }
  }, []);
  useEffect(() => {
    if (!stagesOpen) return;
    const onDown = (e: MouseEvent) => { if (stagesRef.current && !stagesRef.current.contains(e.target as Node)) setStagesOpen(false); };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [stagesOpen]);
  function toggleStage(key: string) {
    setHiddenStages(prev => {
      const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key);
      try { localStorage.setItem("crm-leads-hidden-stages", JSON.stringify([...n])); } catch { /* ignore */ }
      return n;
    });
  }

  // Active pipeline stages from settings (loaded after mount to avoid hydration mismatch).
  const [activeStages, setActiveStages] = useState<PipelineStage[]>([]);
  useEffect(() => { setActiveStages(getStages().filter(s => s.active)); }, []);

  const resolve   = useMemo(() => buildStageResolver(activeStages), [activeStages]);
  const openStages = activeStages.filter(s => s.category === "open");

  // Table tabs: All / Active / per-open-stage / Won / Lost — derived from settings.
  const tableTabs = useMemo(() => {
    const tabs: { key: string; label: string; fn: (l: Lead) => boolean }[] = [
      { key: "all",    label: "All",    fn: () => true },
      { key: "active", label: "Active", fn: l => resolve(l.stage).category === "open" },
    ];
    if (activeStages.some(s => s.category === "won"))
      tabs.push({ key: "won",  label: "Won",  fn: l => resolve(l.stage).category === "won" });
    if (activeStages.some(s => s.category === "lost"))
      tabs.push({ key: "lost", label: "Lost", fn: l => resolve(l.stage).category === "lost" });
    return tabs;
  }, [activeStages, resolve]);

  // Context filter
  const contextFiltered = ALL_LEADS
    .filter(l => !effectiveCompanyId     || l.companyId     === effectiveCompanyId)
    .filter(l => !effectiveLocationId    || l.locationId    === effectiveLocationId)
    .filter(l => !effectiveServiceAreaId || l.serviceAreaId === effectiveServiceAreaId)
    // Apply any drag-and-drop stage changes (local, pre-Supabase).
    .map(l => stageEdits[l.id] ? { ...l, stage: stageEdits[l.id] as LeadStage } : l);

  // Drag a pipeline card to another column → update its stage.
  function moveStage(leadId: string, stageKey: string) {
    setStageEdits(s => ({ ...s, [leadId]: stageKey }));
  }

  // Filter option lists (from the current context)
  const assignedOpts = useMemo(() => Array.from(new Set(contextFiltered.map(l => l.assignedTo))).sort(), [contextFiltered]);
  const sourceOpts   = useMemo(() => Array.from(new Set(contextFiltered.map(l => l.source))), [contextFiltered]);
  const locationOpts = useMemo(() => Array.from(new Set(contextFiltered.map(l => l.locationName))).sort(), [contextFiltered]);

  // Shared filter set (filters + search, but NOT the Active/Won/Lost tab)
  const filtered = contextFiltered
    .filter(l => fAssigned === "all" || l.assignedTo   === fAssigned)
    .filter(l => fSource   === "all" || l.source       === fSource)
    .filter(l => fLocation === "all" || l.locationName === fLocation)
    .filter(l => fDate     === "all" || leadAgeDays(l.createdAt) <= Number(fDate))
    .filter(l => {
      if (fPriority === "all")      return true;
      if (fPriority === "overdue")  return leadIsOverdue(l);
      if (fPriority === "followup") return leadFollowUpDue(l);
      if (fPriority === "hot")      return parseLeadValue(l) >= 5000;
      return true;
    })
    .filter(l => {
      if (!search) return true;
      const q = search.toLowerCase();
      return (
        l.customerName.toLowerCase().includes(q) ||
        l.title.toLowerCase().includes(q) ||
        (l.customerEmail ?? "").toLowerCase().includes(q) ||
        (l.customerPhone ?? "").includes(q)
      );
    });

  const tabFn = tableTabs.find(t => t.key === tab)?.fn ?? (() => true);

  // Table rows: filter set + tab + sort
  const displayed = filtered
    .filter(tabFn)
    .sort((a, b) => {
      const av = a[sortField] ?? "", bv = b[sortField] ?? "";
      return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
    });

  // Summary metrics — based on context (respect the selector, not the board filters)
  const openCtx = contextFiltered.filter(l => resolve(l.stage).category === "open");
  const summaryCards: SummaryCard[] = [
    { icon: TrendingUp,    label: "Open Leads",     value: String(openCtx.length),                                              sub: "Active pipeline",   iconColor: "#4f46e5" },
    { icon: DollarSign,    label: "Pipeline Value", value: fmtMoney(openCtx.reduce((s, l) => s + parseLeadValue(l), 0)),        sub: `${openCtx.length} open leads`, iconColor: "#10b981" },
    { icon: CalendarClock, label: "Follow-Ups Due", value: String(openCtx.filter(leadFollowUpDue).length),                     sub: "Need attention",    iconColor: "#f59e0b" },
    { icon: Trophy,        label: "Won This Month", value: String(contextFiltered.filter(l => resolve(l.stage).category === "won").length), sub: "Closed won", iconColor: "#059669" },
  ];

  const activeFilterCount = [fAssigned, fSource, fPriority, fDate, fLocation].filter(v => v !== "all").length;

  function handleSort(field: SortField) {
    if (sortField === field) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSort(field); setSortDir("asc"); }
  }

  function SortIcon({ field }: { field: SortField }) {
    if (sortField !== field) return <ChevronDown className="w-3 h-3 opacity-30" />;
    return sortDir === "asc"
      ? <ChevronUp className="w-3 h-3" style={{ color: "#4f46e5" }} />
      : <ChevronDown className="w-3 h-3" style={{ color: "#4f46e5" }} />;
  }

  return (
    <div className="p-6">
      {/* Header — title · centered view tabs · stages + action */}
      <div className="flex items-center gap-4 mb-6">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-semibold" style={{ color: "var(--text-primary)" }}>Leads</h1>
            <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: "var(--bg-input)", color: "var(--text-muted)" }}>
              {contextFiltered.length}
            </span>
          </div>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>
            Sales pipeline — track, follow up, and convert
          </p>
        </div>
        <div className="flex items-center rounded-lg overflow-hidden" style={{ border: "1px solid var(--border)" }}>
          {([
            { key: "overview", icon: BarChart3,   label: "Overview" },
            { key: "pipeline", icon: Columns3,    label: "Pipeline" },
            { key: "table",    icon: LayoutList,  label: "List" },
            { key: "calendar", icon: CalendarDays,label: "Calendar" },
          ] as const).map(v => {
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
        <div className="flex-1 flex items-center justify-end gap-2">
          {/* Visible Stages control (pipeline view only) */}
          {view === "pipeline" && (() => {
            const visibleCount = openStages.filter(s => !hiddenStages.has(s.key)).length;
            return (
              <div className="relative" ref={stagesRef}>
                <button onClick={() => setStagesOpen(o => !o)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors"
                  style={{ border: `1px solid ${hiddenStages.size > 0 ? "var(--accent-soft-border)" : "var(--border)"}`, backgroundColor: hiddenStages.size > 0 ? "var(--accent-soft-bg)" : "var(--bg-surface)", color: hiddenStages.size > 0 ? "var(--accent-text)" : "var(--text-secondary)" }}>
                  <SlidersVertical className="w-3.5 h-3.5" /> Stages
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ backgroundColor: "var(--bg-input)", color: "var(--text-muted)" }}>{visibleCount}/{openStages.length}</span>
                </button>
                {stagesOpen && (
                  <div className="absolute right-0 top-full mt-2 z-50 rounded-xl p-3 w-60" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "0 12px 32px rgba(0,0,0,0.18)" }}>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Visible Stages</p>
                      {hiddenStages.size > 0 && <button onClick={() => { setHiddenStages(new Set()); try { localStorage.removeItem("crm-leads-hidden-stages"); } catch {} }} className="text-xs" style={{ color: "var(--accent-text)" }}>Show all</button>}
                    </div>
                    <div className="space-y-0.5">
                      {openStages.map(s => {
                        const visible = !hiddenStages.has(s.key);
                        const lastVisible = visible && visibleCount <= 1;
                        return (
                          <button key={s.key} onClick={() => { if (!lastVisible) toggleStage(s.key); }} disabled={lastVisible}
                            className="w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg text-sm transition-colors hover:bg-[var(--bg-surface-2)]"
                            style={{ opacity: lastVisible ? 0.5 : 1, cursor: lastVisible ? "not-allowed" : "pointer" }}>
                            <span className="flex items-center gap-2 min-w-0">
                              <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
                              <span className="truncate" style={{ color: "var(--text-primary)" }}>{s.name}</span>
                            </span>
                            {visible ? <Eye className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--accent-text)" }} /> : <EyeOff className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--text-muted)" }} />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })()}
          <button className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-3 py-2 rounded-lg transition-colors">
            <Plus className="w-4 h-4" /> New Lead
          </button>
        </div>
      </div>

      {/* Filter row — search + single Filter button (hidden on Overview) */}
      {view !== "overview" && (
      <div className="mb-4 space-y-2">
        {/* Status tabs (left) + search & filter (right) on one row */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-0.5 flex-wrap">
            {tableTabs.map(t => {
              const count  = filtered.filter(t.fn).length;
              const active = tab === t.key;
              return (
                <button key={t.key} onClick={() => setTab(t.key)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
                  style={{
                    backgroundColor: active ? "var(--accent-soft-bg)" : "transparent",
                    color: active ? "var(--accent-text)" : "var(--text-muted)",
                    border: `1px solid ${active ? "var(--accent-soft-border)" : "transparent"}`,
                  }}>
                  {t.label}
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                    style={{ backgroundColor: active ? "var(--accent-soft-2-bg)" : "var(--bg-input)", color: active ? "var(--accent-text)" : "var(--text-muted)" }}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 rounded-lg px-3 py-1.5" style={{ backgroundColor: "var(--bg-input)" }}>
              <Search className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--text-muted)" }} />
              <input type="text" placeholder="Search leads..." value={search} onChange={e => setSearch(e.target.value)}
                className="bg-transparent text-sm outline-none w-48" style={{ color: "var(--text-primary)" }} />
            </div>

            <div className="relative" ref={filtersRef}>
              <button onClick={() => setFiltersOpen(o => !o)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors"
                style={{ border: `1px solid ${activeFilterCount ? "var(--accent-soft-border)" : "var(--border)"}`, backgroundColor: activeFilterCount ? "var(--accent-soft-bg)" : "var(--bg-surface)", color: activeFilterCount ? "var(--accent-text)" : "var(--text-secondary)" }}>
                <SlidersHorizontal className="w-3.5 h-3.5" /> Filter
                {activeFilterCount > 0 && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ backgroundColor: "var(--accent-soft-2-bg)", color: "var(--accent-text)" }}>{activeFilterCount}</span>}
              </button>
              {filtersOpen && (
                <div className="absolute right-0 top-full mt-2 z-50 rounded-xl p-4 w-72" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "0 12px 32px rgba(0,0,0,0.18)" }}>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Filters</p>
                    {activeFilterCount > 0 && <button onClick={() => { setFAssigned("all"); setFSource("all"); setFPriority("all"); setFDate("all"); setFLocation("all"); }} className="text-xs" style={{ color: "var(--accent-text)" }}>Clear all</button>}
                  </div>
                  <div className="space-y-2.5">
                    <LeadFilterField label="Assigned To"><Select size="sm" value={fAssigned} onChange={setFAssigned} options={[{ value: "all", label: "All Assignees" }, ...assignedOpts.map(a => ({ value: a, label: a }))]} /></LeadFilterField>
                    <LeadFilterField label="Lead Source"><Select size="sm" value={fSource} onChange={setFSource} options={[{ value: "all", label: "All Sources" }, ...sourceOpts.map(s => ({ value: s, label: LEAD_SOURCE_LABELS[s] }))]} /></LeadFilterField>
                    <LeadFilterField label="Priority"><Select size="sm" value={fPriority} onChange={setFPriority} options={[{ value: "all", label: "Any Priority" }, { value: "overdue", label: "Overdue" }, { value: "followup", label: "Follow-Up Due" }, { value: "hot", label: "Hot ($5k+)" }]} /></LeadFilterField>
                    <LeadFilterField label="Date Range"><Select size="sm" value={fDate} onChange={setFDate} options={[{ value: "all", label: "Any Date" }, { value: "7", label: "Last 7 days" }, { value: "30", label: "Last 30 days" }, { value: "90", label: "Last 90 days" }]} /></LeadFilterField>
                    {locationOpts.length > 1 && <LeadFilterField label="Location"><Select size="sm" value={fLocation} onChange={setFLocation} options={[{ value: "all", label: "All Locations" }, ...locationOpts.map(l => ({ value: l, label: l }))]} /></LeadFilterField>}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Active filter chips */}
        {(() => {
          const chips = [
            fAssigned !== "all" && { label: fAssigned, clear: () => setFAssigned("all") },
            fSource !== "all" && { label: LEAD_SOURCE_LABELS[fSource as LeadSource] ?? fSource, clear: () => setFSource("all") },
            fPriority !== "all" && { label: { overdue: "Overdue", followup: "Follow-Up Due", hot: "Hot ($5k+)" }[fPriority] ?? fPriority, clear: () => setFPriority("all") },
            fDate !== "all" && { label: `Last ${fDate} days`, clear: () => setFDate("all") },
            fLocation !== "all" && { label: fLocation, clear: () => setFLocation("all") },
          ].filter(Boolean);
          if (chips.length === 0) return null;
          return (
            <div className="flex items-center flex-wrap gap-2">
              {chips.map((chip, i) => (
                <button key={i} onClick={(chip as { clear: () => void }).clear}
                  className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full transition-colors"
                  style={{ backgroundColor: "var(--bg-input)", color: "var(--text-secondary)" }}>
                  {(chip as { label: string }).label}
                  <X className="w-3 h-3" style={{ color: "var(--text-muted)" }} />
                </button>
              ))}
            </div>
          );
        })()}
      </div>
      )}

      {/* ── Views ── */}
      {view === "overview" ? (
        <OverviewView contextLeads={contextFiltered} resolve={resolve} openStages={openStages} summaryCards={summaryCards} />
      ) : view === "calendar" ? (
        <LeadsCalendar leads={filtered.filter(tabFn)} resolve={resolve} />
      ) : view === "pipeline" ? (
        <PipelineView leads={filtered} openStages={openStages.filter(s => !hiddenStages.has(s.key))} resolve={resolve} tab={tab} onMoveStage={moveStage} />
      ) : (
        /* Table view */
        <div className="rounded-xl overflow-hidden" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-subtle)", boxShadow: "var(--shadow-card)" }}>
          {/* Column headers */}
          <div className="grid px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider select-none"
            style={{ gridTemplateColumns: "2.5fr 1.2fr 1fr 1fr 1fr 1fr 0.6fr", color: "var(--text-muted)", borderBottom: "1px solid var(--border-subtle)", backgroundColor: "var(--bg-surface-2)" }}>
            {([
              { label: "Lead / Customer",  field: "customerName" },
              { label: "Stage",            field: "stage"        },
              { label: "Source",           field: "source"       },
              { label: "Value",            field: "estimatedValue"},
              { label: "Assigned",         field: null           },
              { label: "Branch",           field: "locationName" },
              { label: "Age",              field: "createdAt"    },
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
              <div className="py-16 text-center">
                <p className="text-sm" style={{ color: "var(--text-muted)" }}>No leads match the current filter.</p>
              </div>
            ) : displayed.map((lead, i) => {
              const s = resolve(lead.stage);
              return (
                <Link key={lead.id} href={`/leads/${lead.id}`}
                  className="grid px-4 py-3 items-center hover:bg-[var(--bg-surface-2)] transition-colors"
                  style={{ gridTemplateColumns: "2.5fr 1.2fr 1fr 1fr 1fr 1fr 0.6fr", borderBottom: i < displayed.length - 1 ? "1px solid var(--border-subtle)" : "none", textDecoration: "none" }}>

                  {/* Lead / Customer */}
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center text-[10px] font-bold text-indigo-600 shrink-0">
                      {lead.customerInitials}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>{lead.title}</p>
                      <p className="text-[10px] truncate" style={{ color: "var(--text-muted)" }}>{lead.customerName}</p>
                    </div>
                  </div>

                  {/* Stage */}
                  <span className="inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full"
                    style={{ backgroundColor: s.bg, color: s.color }}>
                    {s.label}
                  </span>

                  {/* Source */}
                  <span className="text-sm" style={{ color: "var(--text-secondary)" }}>
                    {LEAD_SOURCE_LABELS[lead.source]}
                  </span>

                  {/* Value */}
                  <span className="text-sm font-medium" style={{ color: lead.estimatedValue ? "var(--text-primary)" : "var(--text-muted)" }}>
                    {lead.estimatedValue ?? "TBD"}
                  </span>

                  {/* Assigned */}
                  <div className="flex items-center gap-1.5">
                    <div className="w-5 h-5 rounded-full bg-indigo-600 flex items-center justify-center text-[8px] font-bold text-white shrink-0">
                      {lead.assignedToInitials}
                    </div>
                    <span className="text-sm truncate" style={{ color: "var(--text-secondary)" }}>{lead.assignedTo}</span>
                  </div>

                  {/* Branch */}
                  <span className="text-sm truncate" style={{ color: "var(--text-secondary)" }}>{lead.locationName}</span>

                  {/* Age */}
                  <AgeChip createdAt={lead.createdAt} />
                </Link>
              );
            })}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-4 py-3 text-xs"
            style={{ borderTop: "1px solid var(--border-subtle)", color: "var(--text-muted)", backgroundColor: "var(--bg-surface-2)" }}>
            <span>Showing {displayed.length} of {filtered.filter(tabFn).length} leads</span>
            <div className="flex gap-1">
              <button className="px-2 py-1 rounded" style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}>← Prev</button>
              <button className="px-2 py-1 rounded" style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}>Next →</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Overview view: analytics for the visible leads ──────────
function OverviewCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl p-5" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-subtle)", boxShadow: "var(--shadow-card)" }}>
      <p className="text-sm font-semibold mb-4" style={{ color: "var(--text-primary)" }}>{title}</p>
      {children}
    </div>
  );
}

function BarRow({ label, count, sub, pct, color }: { label: string; count: number; sub?: string; pct: number; color: string }) {
  return (
    <div className="mb-3 last:mb-0">
      <div className="flex items-center gap-2 mb-1">
        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
        <span className="text-xs font-medium truncate" style={{ color: "var(--text-secondary)" }}>{label}</span>
        <span className="ml-auto text-xs font-semibold shrink-0" style={{ color: "var(--text-primary)" }}>{count}</span>
        {sub && <span className="text-[11px] shrink-0 w-12 text-right" style={{ color: "var(--text-muted)" }}>{sub}</span>}
      </div>
      <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: "var(--bg-input)" }}>
        <div className="h-full rounded-full transition-all" style={{ width: `${Math.max(2, pct * 100)}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}

function OverviewView({ contextLeads, resolve, openStages, summaryCards }: {
  contextLeads: Lead[];
  resolve: (key: string) => StageDisplay;
  openStages: PipelineStage[];
  summaryCards: SummaryCard[];
}) {
  // Leads by stage (open stages only — the active pipeline)
  const byStage = openStages.map(s => {
    const ls = contextLeads.filter(l => l.stage === s.key);
    return { name: s.name, color: s.color, count: ls.length, value: ls.reduce((a, l) => a + parseLeadValue(l), 0) };
  });
  const maxStage = Math.max(1, ...byStage.map(b => b.count));

  // Leads by source
  const sourceMap = new Map<LeadSource, number>();
  contextLeads.forEach(l => sourceMap.set(l.source, (sourceMap.get(l.source) ?? 0) + 1));
  const bySource = Array.from(sourceMap, ([k, v]) => ({ label: LEAD_SOURCE_LABELS[k] ?? k, count: v })).sort((a, b) => b.count - a.count);
  const maxSource = Math.max(1, ...bySource.map(s => s.count));

  // Leads by rep (value-weighted)
  const repMap = new Map<string, { count: number; value: number }>();
  contextLeads.forEach(l => {
    const r = repMap.get(l.assignedTo) ?? { count: 0, value: 0 };
    r.count++; r.value += parseLeadValue(l);
    repMap.set(l.assignedTo, r);
  });
  const byRep = Array.from(repMap, ([name, d]) => ({ name, ...d })).sort((a, b) => b.value - a.value).slice(0, 6);
  const maxRepVal = Math.max(1, ...byRep.map(r => r.value));

  // Conversion
  const won = contextLeads.filter(l => resolve(l.stage).category === "won").length;
  const lost = contextLeads.filter(l => resolve(l.stage).category === "lost").length;
  const open = contextLeads.filter(l => resolve(l.stage).category === "open").length;
  const winRate = won + lost > 0 ? Math.round((won / (won + lost)) * 100) : 0;

  return (
    <div className="space-y-5">
      <ModuleSummaryCards cards={summaryCards} />
      <div className="grid gap-5" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))" }}>
        <OverviewCard title="Leads by Stage">
          {byStage.length === 0
            ? <p className="text-xs" style={{ color: "var(--text-muted)" }}>No leads in pipeline</p>
            : byStage.map(b => <BarRow key={b.name} label={b.name} count={b.count} sub={b.value > 0 ? fmtMoney(b.value) : undefined} pct={b.count / maxStage} color={b.color} />)}
        </OverviewCard>

        <OverviewCard title="Conversion">
          <div className="flex items-center gap-4 mb-4">
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-bold" style={{ color: "var(--text-primary)" }}>{winRate}</span>
              <span className="text-lg font-semibold" style={{ color: "var(--text-muted)" }}>%</span>
            </div>
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>win rate</span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: "Open", val: open, color: "#6366f1" },
              { label: "Won", val: won, color: "#22c55e" },
              { label: "Lost", val: lost, color: "#ef4444" },
            ].map(s => (
              <div key={s.label} className="rounded-lg px-3 py-2" style={{ backgroundColor: "var(--bg-input)" }}>
                <p className="text-lg font-bold" style={{ color: s.color }}>{s.val}</p>
                <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>{s.label}</p>
              </div>
            ))}
          </div>
        </OverviewCard>

        <OverviewCard title="Leads by Source">
          {bySource.length === 0
            ? <p className="text-xs" style={{ color: "var(--text-muted)" }}>No leads</p>
            : bySource.map(s => <BarRow key={s.label} label={s.label} count={s.count} pct={s.count / maxSource} color="#6366f1" />)}
        </OverviewCard>

        <OverviewCard title="Top Reps">
          {byRep.length === 0
            ? <p className="text-xs" style={{ color: "var(--text-muted)" }}>No leads assigned</p>
            : byRep.map(r => <BarRow key={r.name} label={r.name} count={r.count} sub={r.value > 0 ? fmtMoney(r.value) : undefined} pct={r.value / maxRepVal} color="#8b5cf6" />)}
        </OverviewCard>
      </div>
    </div>
  );
}

// ─── Calendar view: leads placed on their created date ───────
function LeadsCalendar({ leads, resolve }: { leads: Lead[]; resolve: (key: string) => StageDisplay }) {
  const [focus, setFocus] = useState(() => new Date());

  const monthStart = new Date(focus.getFullYear(), focus.getMonth(), 1);
  const gridStart = new Date(monthStart);
  gridStart.setDate(gridStart.getDate() - gridStart.getDay());
  const days = Array.from({ length: 42 }, (_, i) => {
    const d = new Date(gridStart);
    d.setDate(d.getDate() + i);
    return d;
  });
  const today = new Date();
  const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

  // Bucket leads by created date for O(1) cell lookup
  const byKey = new Map<string, Lead[]>();
  leads.forEach(l => {
    const d = new Date(l.createdAt);
    if (isNaN(d.getTime())) return;
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    const arr = byKey.get(key) ?? [];
    arr.push(l);
    byKey.set(key, arr);
  });

  function shiftMonth(delta: number) {
    setFocus(f => new Date(f.getFullYear(), f.getMonth() + delta, 1));
  }

  const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
          {focus.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
        </p>
        <div className="flex items-center gap-1">
          <button onClick={() => setFocus(new Date())}
            className="text-xs font-medium px-3 py-1.5 rounded-lg transition-colors hover:bg-[var(--bg-surface-2)]"
            style={{ color: "var(--text-secondary)", border: "1px solid var(--border-subtle)" }}>Today</button>
          <button onClick={() => shiftMonth(-1)}
            className="p-1.5 rounded-lg transition-colors hover:bg-[var(--bg-surface-2)]"
            style={{ color: "var(--text-secondary)", border: "1px solid var(--border-subtle)" }}><ChevronLeft className="w-4 h-4" /></button>
          <button onClick={() => shiftMonth(1)}
            className="p-1.5 rounded-lg transition-colors hover:bg-[var(--bg-surface-2)]"
            style={{ color: "var(--text-secondary)", border: "1px solid var(--border-subtle)" }}><ChevronRight className="w-4 h-4" /></button>
        </div>
      </div>

      <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--border-subtle)" }}>
        <div className="grid grid-cols-7">
          {weekdays.map(w => (
            <div key={w} className="px-2 py-2 text-[11px] font-semibold text-center"
              style={{ color: "var(--text-muted)", backgroundColor: "var(--bg-surface-2)", borderBottom: "1px solid var(--border-subtle)" }}>{w}</div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {days.map((day, i) => {
            const inMonth = day.getMonth() === focus.getMonth();
            const items = byKey.get(`${day.getFullYear()}-${day.getMonth()}-${day.getDate()}`) ?? [];
            const isToday = sameDay(day, today);
            return (
              <div key={i} className="min-h-[104px] p-1.5 flex flex-col"
                style={{
                  backgroundColor: inMonth ? "var(--bg-surface)" : "var(--bg-page)",
                  borderRight: (i % 7 !== 6) ? "1px solid var(--border-subtle)" : undefined,
                  borderBottom: i < 35 ? "1px solid var(--border-subtle)" : undefined,
                }}>
                <span className="text-[11px] font-medium mb-1 inline-flex items-center justify-center w-5 h-5 rounded-full self-start"
                  style={isToday
                    ? { backgroundColor: "var(--accent-soft-bg)", color: "var(--accent-text-strong)" }
                    : { color: inMonth ? "var(--text-secondary)" : "var(--text-muted)" }}>{day.getDate()}</span>
                <div className="flex flex-col gap-1 overflow-hidden">
                  {items.slice(0, 3).map(l => {
                    const d = resolve(l.stage);
                    return (
                      <Link key={l.id} href={`/leads/${l.id}`}
                        className="block rounded px-1.5 py-0.5 text-[10px] font-medium truncate transition-opacity hover:opacity-80"
                        style={{ backgroundColor: d.bg, color: d.color, textDecoration: "none" }}
                        title={`${l.customerName} · ${d.label}`}>
                        {l.customerName}
                      </Link>
                    );
                  })}
                  {items.length > 3 && (
                    <span className="text-[10px] px-1.5" style={{ color: "var(--text-muted)" }}>+{items.length - 3} more</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

