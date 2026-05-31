"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import {
  Search, Plus, ChevronUp, ChevronDown, LayoutList, Columns3,
  TrendingUp, DollarSign, CalendarClock, Trophy, MapPin, AlertTriangle,
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
      className="block rounded-xl p-3 mb-2 transition-all hover:shadow-md"
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
function PipelineView({ leads, openStages, resolve, tab }: {
  leads: Lead[];
  openStages: PipelineStage[];
  resolve: (key: string) => StageDisplay;
  tab: string;
}) {
  // Won / Lost → flat grid
  if (tab === "won" || tab === "lost") {
    const subset = leads.filter(l => resolve(l.stage).category === tab);
    const total  = subset.reduce((s, l) => s + parseLeadValue(l), 0);
    return (
      <div className="px-6 pb-4">
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

  // Active board — horizontally scrollable, generous column width
  return (
    <div className="overflow-x-auto pb-4">
      <div className="flex gap-4 min-w-max px-6 pb-2">
        {openStages.map(stage => {
          const cards = leads.filter(l => l.stage === stage.key);
          const total = cards.reduce((s, l) => s + parseLeadValue(l), 0);
          return (
            <div key={stage.key} className="shrink-0" style={{ width: "300px" }}>
              {/* Stage header — name, count, total value */}
              <div className="flex items-center justify-between mb-2 px-1">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: stage.color }} />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold truncate" style={{ color: "var(--text-primary)" }}>{stage.name}</p>
                    <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                      {cards.length} lead{cards.length === 1 ? "" : "s"}{total > 0 ? ` · ${fmtMoney(total)}` : ""}
                    </p>
                  </div>
                </div>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0"
                  style={{ backgroundColor: stage.color + "22", color: stage.color }}>
                  {cards.length}
                </span>
              </div>

              {/* Cards column */}
              <div className="rounded-xl p-2 min-h-[120px]" style={{ backgroundColor: "var(--bg-surface-2)", border: "1px solid var(--border-subtle)" }}>
                {cards.length === 0
                  ? <p className="text-[10px] text-center py-6" style={{ color: "var(--text-muted)" }}>No leads</p>
                  : cards.map(l => <PipelineCard key={l.id} lead={l} />)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────
export default function LeadsPage() {
  const { effectiveCompanyId, effectiveLocationId, effectiveServiceAreaId } = useHierarchy();

  const [view, setView]       = useState<"table" | "pipeline">("pipeline");
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
    .filter(l => !effectiveServiceAreaId || l.serviceAreaId === effectiveServiceAreaId);

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
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
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
        <button className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-3 py-2 rounded-lg transition-colors">
          <Plus className="w-4 h-4" /> New Lead
        </button>
      </div>

      {/* Summary cards */}
      <div className="mb-5">
        <ModuleSummaryCards cards={summaryCards} moduleKey="leads" />
      </div>

      {/* Control bar — tabs (left) + view toggle (right) */}
      <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
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
        <div className="flex items-center rounded-lg overflow-hidden" style={{ border: "1px solid var(--border)" }}>
          <button onClick={() => setView("pipeline")} className="flex items-center gap-1.5 px-3 py-1.5 text-sm transition-colors"
            style={{ backgroundColor: view === "pipeline" ? "#4f46e5" : "var(--bg-surface)", color: view === "pipeline" ? "#fff" : "var(--text-secondary)" }}>
            <Columns3 className="w-3.5 h-3.5" /> Pipeline
          </button>
          <button onClick={() => setView("table")} className="flex items-center gap-1.5 px-3 py-1.5 text-sm transition-colors"
            style={{ backgroundColor: view === "table" ? "#4f46e5" : "var(--bg-surface)", color: view === "table" ? "#fff" : "var(--text-secondary)" }}>
            <LayoutList className="w-3.5 h-3.5" /> Table
          </button>
        </div>
      </div>

      {/* Filter row — search + dropdowns (shared by both views) */}
      <div className="flex items-center flex-wrap gap-2 mb-4">
        <div className="flex items-center gap-2 rounded-lg px-3 py-1.5" style={{ backgroundColor: "var(--bg-input)" }}>
          <Search className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--text-muted)" }} />
          <input type="text" placeholder="Search leads..." value={search} onChange={e => setSearch(e.target.value)}
            className="bg-transparent text-sm outline-none w-44" style={{ color: "var(--text-primary)" }} />
        </div>
        <Select size="sm" className="w-40" value={fAssigned} onChange={setFAssigned}
          options={[{ value: "all", label: "All Assignees" }, ...assignedOpts.map(a => ({ value: a, label: a }))]} />
        <Select size="sm" className="w-40" value={fSource} onChange={setFSource}
          options={[{ value: "all", label: "All Sources" }, ...sourceOpts.map(s => ({ value: s, label: LEAD_SOURCE_LABELS[s] }))]} />
        <Select size="sm" className="w-36" value={fPriority} onChange={setFPriority}
          options={[{ value: "all", label: "Any Priority" }, { value: "overdue", label: "Overdue" }, { value: "followup", label: "Follow-Up Due" }, { value: "hot", label: "Hot ($5k+)" }]} />
        <Select size="sm" className="w-36" value={fDate} onChange={setFDate}
          options={[{ value: "all", label: "Any Date" }, { value: "7", label: "Last 7 days" }, { value: "30", label: "Last 30 days" }, { value: "90", label: "Last 90 days" }]} />
        {locationOpts.length > 1 && (
          <Select size="sm" className="w-40" value={fLocation} onChange={setFLocation}
            options={[{ value: "all", label: "All Locations" }, ...locationOpts.map(l => ({ value: l, label: l }))]} />
        )}
        {activeFilterCount > 0 && (
          <button onClick={() => { setFAssigned("all"); setFSource("all"); setFPriority("all"); setFDate("all"); setFLocation("all"); }}
            className="text-xs px-2.5 py-1.5 rounded-lg transition-colors" style={{ color: "var(--accent-text)" }}>
            Clear ({activeFilterCount})
          </button>
        )}
      </div>

      {/* Pipeline view */}
      {view === "pipeline" ? (
        <div className="rounded-xl overflow-hidden" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-subtle)", boxShadow: "var(--shadow-card)", paddingTop: "12px" }}>
          <PipelineView leads={filtered} openStages={openStages} resolve={resolve} tab={tab} />
        </div>
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
