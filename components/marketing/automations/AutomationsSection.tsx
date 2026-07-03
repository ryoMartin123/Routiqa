"use client";

// ─── Automations command center ───────────────────────────
// Mirrors the CRM record-module pattern (Customers/Projects): a central solid
// Overview / Cards / List view toggle, lightweight status quick-filter tabs
// (minimal counts), a category dropdown, and a search + Filter popover — all
// themed in the Marketing crimson. The Overview is a visual data dashboard.
// Powered by real CRM data; assignment/edits write back to the store.

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Plus, Zap, Search, SlidersHorizontal, MoreHorizontal, Pencil, Trash2, Play, Pause, Copy,
  AlertTriangle, MessageSquare, CheckCircle2, DollarSign, Activity, PieChart, LayoutGrid, TrendingUp, ChevronRight,
  type LucideIcon,
} from "lucide-react";
import PageTitle from "@/components/shared/PageTitle";
import ModuleViewToggle, { type ModuleView } from "@/components/shared/ModuleViewToggle";
import MarketingEmptyState from "@/components/marketing/MarketingEmptyState";
import AutomationBuilder from "@/components/marketing/automations/AutomationBuilder";
import UiSelect from "@/components/ui/Select";
import {
  getAutomations, deleteAutomation, setAutomationStatus, duplicateAutomation, blankAutomation,
  summarize, triggerSummary, actionSummary, STATUS_CONFIG,
  automationCategory, automationChannel, CATEGORY_CONFIG, automationWarnings, needsAttention,
  getTrigger, TRIGGER_OBJECTS,
  type MarketingAutomation, type TriggerObject,
} from "@/lib/marketing/automations";

const ACCENT = "#e11d48";
const AMBER = "#f59e0b";

// Status filters live as the primary tab row; category moved to a secondary
// dropdown to keep the row uncluttered.
type StatusKey = "all" | "active" | "draft" | "paused" | "attention";
const STATUS_TABS: { key: StatusKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "active", label: "Active" },
  { key: "draft", label: "Drafts" },
  { key: "paused", label: "Paused" },
  { key: "attention", label: "Needs Attention" },
];
type CatKey = "all" | "review_request" | "estimate_followup" | "maintenance" | "reactivation";
const CATEGORY_OPTIONS: { value: CatKey; label: string }[] = [
  { value: "all", label: "All categories" },
  { value: "review_request", label: "Review Requests" },
  { value: "estimate_followup", label: "Estimate Follow-Ups" },
  { value: "maintenance", label: "Maintenance" },
  { value: "reactivation", label: "Reactivation" },
];
const SORTS = [
  { value: "last_run", label: "Sort: Last run" },
  { value: "performance", label: "Sort: Performance" },
  { value: "revenue", label: "Sort: Revenue" },
  { value: "created", label: "Sort: Recently created" },
];
const CHANNELS = ["all", "SMS", "Email", "Campaign", "Task", "Team", "Tag", "Audience"];
const LIST_COLS = "2.3fr 1.5fr 1.5fr 0.7fr 0.9fr 1fr 0.4fr";
const money = (n?: number) => `$${(n ?? 0).toLocaleString()}`;

export default function AutomationsSection() {
  const [items, setItems] = useState<MarketingAutomation[]>([]);
  const [editing, setEditing] = useState<MarketingAutomation | null>(null);
  const [menuId, setMenuId] = useState<string | null>(null);
  const [moduleView, setModuleView] = useState<ModuleView>("cards");
  const [statusTab, setStatusTab] = useState<StatusKey>("all");
  const [category, setCategory] = useState<CatKey>("all");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("last_run");
  const [fChannel, setFChannel] = useState("all");
  const [fTrigger, setFTrigger] = useState("all");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const filtersRef = useRef<HTMLDivElement>(null);

  function reload() { setItems(getAutomations()); }
  useEffect(reload, []);
  useEffect(() => {
    if (!filtersOpen) return;
    const onDown = (e: MouseEvent) => { if (filtersRef.current && !filtersRef.current.contains(e.target as Node)) setFiltersOpen(false); };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [filtersOpen]);

  const kpi = useMemo(() => ({
    active: items.filter(a => a.status === "active").length,
    draft: items.filter(a => a.status === "draft").length,
    paused: items.filter(a => a.status === "paused").length,
    attention: items.filter(needsAttention).length,
    contacts: items.reduce((s, a) => s + (a.stats?.contacts ?? 0), 0),
    replies: items.reduce((s, a) => s + (a.stats?.replies ?? 0), 0),
    booked: items.reduce((s, a) => s + (a.stats?.booked ?? 0), 0),
    revenue: items.reduce((s, a) => s + (a.stats?.revenue ?? 0), 0),
  }), [items]);

  const statusCount = (k: StatusKey) => items.filter(a => matchesStatus(a, k)).length;

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items
      .filter(a => matchesStatus(a, statusTab))
      .filter(a => category === "all" || automationCategory(a) === category)
      .filter(a => fChannel === "all" || automationChannel(a) === fChannel)
      .filter(a => fTrigger === "all" || getTrigger(a.triggerKey)?.object === fTrigger)
      .filter(a => !q || a.name.toLowerCase().includes(q) || summarize(a).toLowerCase().includes(q))
      .sort((x, y) => {
        if (sort === "performance") return (y.stats?.replies ?? 0) - (x.stats?.replies ?? 0);
        if (sort === "revenue") return (y.stats?.revenue ?? 0) - (x.stats?.revenue ?? 0);
        return 0;
      });
  }, [items, statusTab, category, query, sort, fChannel, fTrigger]);

  const activeFilters = (category !== "all" ? 1 : 0) + (fChannel !== "all" ? 1 : 0) + (fTrigger !== "all" ? 1 : 0);

  const rowProps = (a: MarketingAutomation) => ({
    menuOpen: menuId === a.id,
    onToggleMenu: () => setMenuId(menuId === a.id ? null : a.id),
    onCloseMenu: () => setMenuId(null),
    onEdit: () => setEditing(a),
    onStatus: (s: MarketingAutomation["status"]) => { setAutomationStatus(a.id, s); setMenuId(null); reload(); },
    onDuplicate: () => { duplicateAutomation(a.id); setMenuId(null); reload(); },
    onDelete: () => { deleteAutomation(a.id); setMenuId(null); reload(); },
  });

  if (editing) {
    return <AutomationBuilder initial={editing} onDone={() => { setEditing(null); reload(); }} onCancel={() => setEditing(null)} />;
  }

  // First-run empty state (no automations at all).
  if (items.length === 0) {
    return (
      <div className="p-6 space-y-5">
        <PageTitle title="Automations" description="Rule-based marketing that runs automatically on your CRM data" />
        <MarketingEmptyState
          icon={Zap}
          title="No automations yet"
          description="Set up rules that run marketing automatically on your CRM data — like a review request when a job is completed, or a financing follow-up when an estimate stalls."
          ctaLabel="Set up automation"
          onCta={() => setEditing(blankAutomation())}
          suggestions={["Completed job → review request", "Estimate stalls 3 days → follow-up", "Maintenance due in 30 days → reminder", "No service in 12 months → reactivation"]}
        />
      </div>
    );
  }

  const toolbar = (
    <div className="flex items-center gap-3 flex-wrap">
      <div className="flex-1 min-w-0 overflow-x-auto thin-scroll-x">
        <div className="flex items-center gap-1 w-max">
          {STATUS_TABS.map(t => {
            const on = statusTab === t.key; const n = statusCount(t.key); const isAttn = t.key === "attention";
            return (
              <button key={t.key} onClick={() => setStatusTab(t.key)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap"
                style={{ backgroundColor: on ? ACCENT + "1f" : "transparent", color: on ? ACCENT : "var(--text-muted)", border: `1px solid ${on ? ACCENT + "59" : "transparent"}` }}>
                {t.label}
                {n > 0 && (isAttn
                  ? <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ backgroundColor: AMBER + "22", color: "#92400e" }}>{n}</span>
                  : <span className="text-xs tabular-nums" style={{ color: on ? ACCENT : "var(--text-muted)", opacity: 0.65 }}>{n}</span>)}
              </button>
            );
          })}
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <div className="flex items-center gap-2 rounded-lg px-2.5 py-1.5" style={{ border: "1px solid var(--border)", backgroundColor: "var(--bg-surface)" }}>
          <Search className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--text-muted)" }} />
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search automations…" className="bg-transparent text-sm outline-none w-36" style={{ color: "var(--text-primary)" }} />
        </div>
        <div className="relative" ref={filtersRef}>
          <button onClick={() => setFiltersOpen(o => !o)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
            style={{ border: `1px solid ${activeFilters ? ACCENT + "59" : "var(--border)"}`, backgroundColor: activeFilters ? ACCENT + "1f" : "var(--bg-surface)", color: activeFilters ? ACCENT : "var(--text-secondary)" }}>
            <SlidersHorizontal className="w-3.5 h-3.5" /> Filter
            {activeFilters > 0 && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ backgroundColor: ACCENT + "33", color: ACCENT }}>{activeFilters}</span>}
          </button>
          {filtersOpen && (
            <div className="absolute right-0 top-full mt-2 z-50 rounded-xl p-4 w-64" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "0 12px 32px rgba(0,0,0,0.18)" }}>
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Filters</p>
                {activeFilters > 0 && <button onClick={() => { setCategory("all"); setFChannel("all"); setFTrigger("all"); }} className="text-xs" style={{ color: ACCENT }}>Clear all</button>}
              </div>
              <div className="space-y-2.5">
                <FilterField label="Category">
                  <UiSelect size="sm" value={category} onChange={v => setCategory(v as CatKey)} options={CATEGORY_OPTIONS} />
                </FilterField>
                <FilterField label="Channel">
                  <UiSelect size="sm" value={fChannel} onChange={setFChannel} options={CHANNELS.map(c => ({ value: c, label: c === "all" ? "All channels" : c }))} />
                </FilterField>
                <FilterField label="Trigger object">
                  <UiSelect size="sm" value={fTrigger} onChange={setFTrigger}
                    options={[{ value: "all", label: "All triggers" }, ...(Object.keys(TRIGGER_OBJECTS) as TriggerObject[]).map(o => ({ value: o, label: TRIGGER_OBJECTS[o].label }))]} />
                </FilterField>
                <FilterField label="Sort by">
                  <UiSelect size="sm" value={sort} onChange={setSort} options={SORTS} />
                </FilterField>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="p-6 space-y-5">
      {/* Header — title · centered view toggle · create */}
      <div className="flex items-center gap-4">
        <div className="flex-1 min-w-0">
          <PageTitle title="Automations" count={items.length} description="Your always-on marketing — what's running, what's working, what needs attention" />
        </div>
        <ModuleViewToggle view={moduleView} onChange={setModuleView} withCards overviewFirst accent={ACCENT} />
        <div className="flex-1 flex justify-end">
          <button onClick={() => setEditing(blankAutomation())}
            className="flex items-center gap-1.5 text-white text-sm font-medium px-3 py-2 rounded-lg transition-colors shrink-0" style={{ backgroundColor: ACCENT }}>
            <Plus className="w-4 h-4" /> Create automation
          </button>
        </div>
      </div>

      {/* ── Overview (visual dashboard) ── */}
      {moduleView === "overview" && <OverviewDashboard items={items} kpi={kpi} />}

      {/* ── Cards ── */}
      {moduleView === "cards" && (
        <div className="space-y-4">
          {toolbar}
          {visible.length === 0 ? (
            <p className="text-sm text-center py-12" style={{ color: "var(--text-muted)" }}>No automations match this filter.</p>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">{visible.map(a => <AutomationCard key={a.id} a={a} onOpen={() => setEditing(a)} showStatusOnHover={statusTab === "all"} />)}</div>
          )}
        </div>
      )}

      {/* ── List ── */}
      {moduleView === "list" && (
        <div className="space-y-4">
          {toolbar}
          {visible.length === 0 ? (
            <p className="text-sm text-center py-12" style={{ color: "var(--text-muted)" }}>No automations match this filter.</p>
          ) : (
            <div className="rounded-xl overflow-hidden" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" }}>
              <div className="hidden md:grid px-5 py-2.5 text-[10px] font-semibold uppercase tracking-wider"
                style={{ gridTemplateColumns: LIST_COLS, color: "var(--text-muted)", borderBottom: "1px solid var(--border)", backgroundColor: "transparent" }}>
                <span>Automation</span><span>When</span><span>Then</span><span className="text-right">Contacts</span><span>Last run</span><span>Performance</span><span></span>
              </div>
              {visible.map((a, i) => <AutomationListRow key={a.id} a={a} last={i === visible.length - 1} {...rowProps(a)} />)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function matchesStatus(a: MarketingAutomation, k: StatusKey): boolean {
  switch (k) {
    case "all": return true;
    case "active": case "draft": case "paused": return a.status === k;
    case "attention": return needsAttention(a);
  }
}

// ── Shared row actions ──
interface RowActions {
  menuOpen: boolean;
  onToggleMenu: () => void; onCloseMenu: () => void;
  onEdit: () => void; onStatus: (s: MarketingAutomation["status"]) => void; onDuplicate: () => void; onDelete: () => void;
}
function RowMenu({ a, menuOpen, onToggleMenu, onCloseMenu, onEdit, onStatus, onDuplicate, onDelete }: { a: MarketingAutomation } & RowActions) {
  return (
    <div className="relative shrink-0" onClick={e => e.stopPropagation()}>
      <button onClick={onToggleMenu} className="p-1.5 rounded-lg transition-colors hover:bg-[var(--bg-surface-2)]" title="Actions">
        <MoreHorizontal className="w-4 h-4" style={{ color: "var(--text-muted)" }} />
      </button>
      {menuOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={onCloseMenu} />
          <div className="absolute right-0 mt-1 w-44 rounded-xl overflow-hidden z-50 py-1" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "0 12px 32px rgba(0,0,0,0.18)" }}>
            <MenuItem icon={Pencil} label="Edit" onClick={onEdit} />
            {a.status === "active"
              ? <MenuItem icon={Pause} label="Pause" onClick={() => onStatus("paused")} />
              : <MenuItem icon={Play} label={a.status === "draft" ? "Activate" : "Resume"} onClick={() => onStatus("active")} />}
            <MenuItem icon={Copy} label="Duplicate" onClick={onDuplicate} />
            <MenuItem icon={Trash2} label="Delete" danger onClick={onDelete} />
          </div>
        </>
      )}
    </div>
  );
}

// ── Cards view row ──
// Click anywhere to open the automation (no inline menu). The corner arrow is
// always shown and rotates diagonally on hover; the status only appears on hover
// (and only when the "All" tab is active, where statuses are mixed).
function AutomationCard({ a, onOpen, showStatusOnHover }: { a: MarketingAutomation; onOpen: () => void; showStatusOnHover: boolean }) {
  const sc = STATUS_CONFIG[a.status];
  const cat = CATEGORY_CONFIG[automationCategory(a)];
  const channel = automationChannel(a);
  const attn = automationWarnings(a).length > 0;
  const replies = a.stats?.replies ?? 0;
  const revenue = a.stats?.revenue ?? 0;
  return (
    <div className="group rounded-xl p-4 cursor-pointer transition-all duration-150 hover:-translate-y-0.5"
      style={{ backgroundColor: "var(--bg-surface)", border: `1px solid ${attn ? AMBER + "66" : "var(--border-subtle)"}`, boxShadow: "var(--shadow-card)" }}
      onClick={onOpen}
      onMouseEnter={e => { e.currentTarget.style.boxShadow = "0 10px 28px rgba(0,0,0,0.12)"; e.currentTarget.style.borderColor = attn ? AMBER : ACCENT + "80"; }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = "var(--shadow-card)"; e.currentTarget.style.borderColor = attn ? AMBER + "66" : "var(--border-subtle)"; }}>
      <div className="flex items-center gap-2">
        <h3 className="text-sm font-semibold truncate flex-1" style={{ color: "var(--text-primary)" }}>{a.name || "Untitled automation"}</h3>
        {showStatusOnHover && (
          <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded inline-flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
            style={{ backgroundColor: sc.color + "22", color: sc.color }}>
            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: sc.color }} />{sc.label}
          </span>
        )}
        {attn && <AlertTriangle className="w-3.5 h-3.5 shrink-0" style={{ color: AMBER }} />}
        <ChevronRight className="w-4 h-4 shrink-0 transition-transform duration-150 group-hover:-rotate-45" style={{ color: ACCENT }} />
      </div>
      <p className="text-xs mt-2 line-clamp-1" style={{ color: "var(--text-secondary)" }}>{summarize(a)}</p>
      {/* Category + channel — same rectangular badges as the CRM job cards
          (status-style colored chip + muted type chip). */}
      <div className="flex items-center gap-1.5 mt-3 pt-3" style={{ borderTop: "1px solid var(--border)" }}>
        <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded inline-flex items-center gap-1 shrink-0" style={{ backgroundColor: cat.color + "22", color: cat.color }}>
          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: cat.color }} />{cat.label}
        </span>
        {channel !== "—" && (
          <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded shrink-0" style={{ backgroundColor: "var(--bg-input)", color: "var(--text-muted)" }}>{channel}</span>
        )}
        <span className="ml-auto text-[11px] shrink-0" style={{ color: "var(--text-muted)" }}>{replies} repl{revenue > 0 ? ` · ${money(revenue)}` : ""}</span>
      </div>
    </div>
  );
}

// ── List view row (compact) ──
function AutomationListRow({ a, last, ...actions }: { a: MarketingAutomation; last: boolean } & RowActions) {
  const sc = STATUS_CONFIG[a.status];
  const perf = a.stats && a.stats.sent > 0 ? `${a.stats.replies} repl · ${money(a.stats.revenue)}` : "—";
  const attn = automationWarnings(a).length > 0;
  return (
    <div className="md:grid flex flex-col gap-2 px-5 py-3.5 items-center cursor-pointer transition-colors hover:bg-[var(--bg-surface-2)]"
      style={{ gridTemplateColumns: LIST_COLS, borderBottom: last ? "none" : "1px solid var(--border)" }}
      onClick={actions.onEdit}>
      <div className="min-w-0 w-full pr-2">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>{a.name || "Untitled"}</p>
          <Chip label={sc.label} bg={sc.bg} color={sc.color} />
          {attn && <AlertTriangle className="w-3.5 h-3.5 shrink-0" style={{ color: AMBER }} />}
        </div>
        <p className="text-[11px] mt-0.5 line-clamp-1" style={{ color: "var(--text-muted)" }}>{CATEGORY_CONFIG[automationCategory(a)].label} · {automationChannel(a)}</p>
      </div>
      <span className="text-xs truncate w-full pr-2 md:block hidden" style={{ color: "var(--text-secondary)" }}>{triggerSummary(a)}</span>
      <span className="text-xs truncate w-full pr-2 md:block hidden" style={{ color: "var(--text-secondary)" }}>{actionSummary(a)}</span>
      <span className="text-sm font-semibold md:text-right w-full" style={{ color: "var(--text-primary)" }}>{a.stats?.contacts ?? 0}</span>
      <span className="text-xs w-full md:block hidden" style={{ color: "var(--text-muted)" }}>{a.lastRun ?? "Never"}</span>
      <span className="text-xs w-full md:block hidden" style={{ color: "var(--text-secondary)" }}>{perf}</span>
      <div className="md:justify-self-end"><RowMenu a={a} {...actions} /></div>
    </div>
  );
}

// ── Small pieces ──
function FilterField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[11px] font-medium mb-1" style={{ color: "var(--text-secondary)" }}>{label}</label>
      {children}
    </div>
  );
}
function Chip({ label, color, bg, soft }: { label: string; color?: string; bg?: string; soft?: boolean }) {
  // Rectangular badge matching the CRM job cards (rounded, not a pill).
  return (
    <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded shrink-0"
      style={{ backgroundColor: bg ?? (soft && color ? color + "22" : "var(--bg-input)"), color: color ?? "var(--text-muted)" }}>{label}</span>
  );
}
function MenuItem({ icon: Icon, label, onClick, danger }: { icon: typeof Pencil; label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button onClick={onClick} className="w-full flex items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors hover:bg-[var(--bg-surface-2)]"
      style={{ color: danger ? "#dc2626" : "var(--text-secondary)" }}>
      <Icon className="w-3.5 h-3.5" /> {label}
    </button>
  );
}

// ── Overview: a visual, data-rich dashboard (replaces the KPI bar) ──
interface Kpi { active: number; draft: number; paused: number; attention: number; contacts: number; replies: number; booked: number; revenue: number }

function OverviewDashboard({ items, kpi }: { items: MarketingAutomation[]; kpi: Kpi }) {
  const cats = (Object.keys(CATEGORY_CONFIG) as (keyof typeof CATEGORY_CONFIG)[])
    .map(k => ({ label: CATEGORY_CONFIG[k].label, color: CATEGORY_CONFIG[k].color, n: items.filter(a => automationCategory(a) === k).length }))
    .filter(c => c.n > 0).sort((a, b) => b.n - a.n);
  const maxCat = Math.max(1, ...cats.map(c => c.n));

  const top = [...items].sort((a, b) => (b.stats?.revenue ?? 0) - (a.stats?.revenue ?? 0)).filter(a => (a.stats?.revenue ?? 0) > 0).slice(0, 5);
  const maxRev = Math.max(1, ...top.map(a => a.stats?.revenue ?? 0));

  const replyRate = kpi.contacts ? Math.round((kpi.replies / kpi.contacts) * 100) : 0;
  const bookRate = kpi.contacts ? Math.round((kpi.booked / kpi.contacts) * 100) : 0;

  const statusSegs = [
    { label: "Active", value: kpi.active, color: "#16a34a" },
    { label: "Drafts", value: kpi.draft, color: "#9ca3af" },
    { label: "Paused", value: kpi.paused, color: AMBER },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatTile icon={DollarSign}    label="Revenue attributed" value={money(kpi.revenue)}        sub="from automations"          color={ACCENT} />
        <StatTile icon={CheckCircle2}  label="Booked jobs"        value={kpi.booked.toLocaleString()} sub={`${bookRate}% of contacts`} color="#16a34a" />
        <StatTile icon={MessageSquare} label="Replies"            value={kpi.replies.toLocaleString()} sub={`${replyRate}% reply rate`} color="#7c3aed" />
        <StatTile icon={Zap}           label="Active automations" value={String(kpi.active)}         sub={`${items.length} total`}    color="#2563eb" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <DashCard title="Engagement funnel" icon={Activity}>
          <FunnelBar label="Contacts reached" value={kpi.contacts} pct={100} color="#0891b2" />
          <FunnelBar label="Replies" value={kpi.replies} pct={kpi.contacts ? (kpi.replies / kpi.contacts) * 100 : 0} color="#7c3aed" />
          <FunnelBar label="Booked jobs" value={kpi.booked} pct={kpi.contacts ? (kpi.booked / kpi.contacts) * 100 : 0} color="#16a34a" />
          <p className="text-[11px] mt-3" style={{ color: "var(--text-muted)" }}>{replyRate}% reply rate · {bookRate}% booking rate across all sends.</p>
        </DashCard>

        <DashCard title="Status mix" icon={PieChart}>
          <div className="flex items-center gap-6">
            <Donut segments={statusSegs} total={items.length} />
            <div className="space-y-1.5">
              {statusSegs.map(s => (
                <div key={s.label} className="flex items-center gap-2 text-xs">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
                  <span style={{ color: "var(--text-secondary)" }}>{s.label}</span>
                  <span className="font-semibold" style={{ color: "var(--text-primary)" }}>{s.value}</span>
                </div>
              ))}
            </div>
          </div>
        </DashCard>

        <DashCard title="By category" icon={LayoutGrid}>
          {cats.length === 0 ? <Empty /> : cats.map(c => <Bar key={c.label} label={c.label} value={c.n} pct={(c.n / maxCat) * 100} color={c.color} />)}
        </DashCard>

        <DashCard title="Top performers" subtitle="by revenue" icon={TrendingUp}>
          {top.length === 0 ? <Empty label="No revenue attributed yet." /> : top.map(a => (
            <div key={a.id} className="mb-2.5 last:mb-0">
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="truncate pr-2" style={{ color: "var(--text-secondary)" }}>{a.name}</span>
                <span className="font-semibold shrink-0" style={{ color: "var(--text-primary)" }}>{money(a.stats?.revenue)}</span>
              </div>
              <div className="h-2 rounded-full" style={{ backgroundColor: "var(--bg-input)" }}>
                <div className="h-2 rounded-full" style={{ width: `${((a.stats?.revenue ?? 0) / maxRev) * 100}%`, backgroundColor: ACCENT }} />
              </div>
            </div>
          ))}
        </DashCard>
      </div>
    </div>
  );
}

function StatTile({ icon: Icon, label, value, sub, color }: { icon: LucideIcon; label: string; value: string; sub: string; color: string }) {
  return (
    <div className="rounded-xl p-4" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" }}>
      <div className="flex items-center gap-2">
        <span className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: color + "1a" }}>
          <Icon className="w-4 h-4" style={{ color }} />
        </span>
        <p className="text-[10px] font-semibold uppercase tracking-wider truncate" style={{ color: "var(--text-muted)" }}>{label}</p>
      </div>
      <p className="text-2xl font-bold mt-2 truncate" style={{ color: "var(--text-primary)" }}>{value}</p>
      <p className="text-[11px] mt-0.5 truncate" style={{ color: "var(--text-muted)" }}>{sub}</p>
    </div>
  );
}

function DashCard({ title, subtitle, icon: Icon, children }: { title: string; subtitle?: string; icon: LucideIcon; children: React.ReactNode }) {
  return (
    <div className="rounded-xl p-5" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" }}>
      <div className="flex items-center gap-2 mb-4">
        <Icon className="w-4 h-4" style={{ color: ACCENT }} />
        <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{title}</h2>
        {subtitle && <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>· {subtitle}</span>}
      </div>
      {children}
    </div>
  );
}

function Bar({ label, value, pct, color }: { label: string; value: number; pct: number; color: string }) {
  return (
    <div className="mb-2.5 last:mb-0">
      <div className="flex items-center justify-between text-xs mb-1">
        <span className="truncate pr-2" style={{ color: "var(--text-secondary)" }}>{label}</span>
        <span className="font-semibold shrink-0" style={{ color: "var(--text-primary)" }}>{value}</span>
      </div>
      <div className="h-2 rounded-full" style={{ backgroundColor: "var(--bg-input)" }}>
        <div className="h-2 rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}

function FunnelBar({ label, value, pct, color }: { label: string; value: number; pct: number; color: string }) {
  return (
    <div className="mb-2.5 last:mb-0">
      <div className="flex items-center justify-between text-xs mb-1">
        <span style={{ color: "var(--text-secondary)" }}>{label}</span>
        <span className="font-semibold" style={{ color: "var(--text-primary)" }}>{value.toLocaleString()}</span>
      </div>
      <div className="h-2.5 rounded-full" style={{ backgroundColor: "var(--bg-input)" }}>
        <div className="h-2.5 rounded-full" style={{ width: `${Math.max(2, pct)}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}

function Donut({ segments, total }: { segments: { label: string; value: number; color: string }[]; total: number }) {
  let acc = 0;
  const stops = segments.filter(s => s.value > 0).map(s => {
    const start = total ? (acc / total) * 360 : 0; acc += s.value; const end = total ? (acc / total) * 360 : 0;
    return `${s.color} ${start}deg ${end}deg`;
  }).join(", ");
  const bg = stops ? `conic-gradient(${stops})` : "var(--bg-input)";
  return (
    <div className="relative w-28 h-28 rounded-full shrink-0" style={{ background: bg }}>
      <div className="absolute inset-[12px] rounded-full flex flex-col items-center justify-center" style={{ backgroundColor: "var(--bg-surface)" }}>
        <span className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>{total}</span>
        <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>total</span>
      </div>
    </div>
  );
}

function Empty({ label = "No data yet." }: { label?: string }) {
  return <p className="text-xs py-2" style={{ color: "var(--text-muted)" }}>{label}</p>;
}
