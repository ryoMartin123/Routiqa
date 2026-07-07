"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import RowArrow from "@/components/shared/RowArrow";
import { Search, Plus, SlidersHorizontal, ChevronUp, ChevronDown, FilePen, Send, AlarmClock, DollarSign } from "lucide-react";
import { cn } from "@/lib/utils";
import { getAllQuotes, getArchivedQuotes, fmt, type QuoteRecord } from "@/lib/quotes/data";
import { QUOTE_STATUS_STYLE, type QuoteStatus } from "@/lib/quotes/types";

type QuoteTab = "all" | "archived" | QuoteStatus;
import QuoteTypeChooser from "@/components/quotes/create/QuoteTypeChooser";
import { useHierarchy } from "@/components/providers/HierarchyProvider";
import { recencyTs } from "@/lib/recency";
import ModuleSummaryCards, { type SummaryCard } from "@/components/shared/ModuleSummaryCards";
import PageTitle from "@/components/shared/PageTitle";
import ModuleViewToggle, { type ModuleView } from "@/components/shared/ModuleViewToggle";
import StatusTabs from "@/components/shared/StatusTabs";
import StatusBadge from "@/components/shared/StatusBadge";

function daysUntil(dateStr?: string): number {
  if (!dateStr) return Infinity;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return Infinity;
  return (d.getTime() - Date.now()) / 86_400_000;
}

const STATUS_TABS: { key: QuoteTab; label: string }[] = [
  { key: "all",       label: "All"       },
  { key: "draft",     label: "Draft"     },
  { key: "sent",      label: "Sent"      },
  { key: "viewed",    label: "Viewed"    },
  { key: "approved",  label: "Approved"  },
  { key: "converted", label: "Converted" },
  { key: "rejected",  label: "Declined"  },
  { key: "expired",   label: "Expired"   },
  { key: "archived",  label: "Archived"  },
];

// "recent" is the default pseudo-sort: newest created/changed first (top of the
// list, front of the card grid). Clicking a column header switches to that field.
type SortField = "recent" | "quoteNumber" | "customerName" | "status" | "total" | "createdAt";

// Recency = newest created/changed (any logged activity counts).
function quoteRecency(q: QuoteRecord): number {
  return recencyTs(q.id, q.updatedAt, q.createdAt, ...(q.activity ?? []).map(a => a.iso ?? a.at));
}

// Full column layout (Quote# · Customer · Property · Related · Status · Total · Assigned · Location · Created · Expires)
const GRID_COLS = "110px 1.7fr 1.4fr 1.4fr 100px 110px 1fr 1fr 110px 110px";
const GRID_MIN_WIDTH = "1240px";

const LINKED_TYPE_STYLE: Record<string, { bg: string; color: string }> = {
  lead:      { bg: "#fef3c7", color: "#92400e" },
  job:       { bg: "#d3ebe6", color: "#0a5c53" },
  project:   { bg: "#ede9fe", color: "#5b21b6" },
  agreement: { bg: "#ecfdf5", color: "#059669" },
};

export default function QuotesPage() {
  const { effectiveCompanyId, effectiveLocationId, effectiveServiceAreaId } = useHierarchy();

  const [tab, setTab]         = useState<QuoteTab>("all");
  const [search, setSearch]   = useState("");
  const [sortField, setSort]  = useState<SortField>("recent");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [quotes, setQuotes]   = useState<QuoteRecord[]>([]);
  const [archived, setArchived] = useState<QuoteRecord[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [moduleView, setModuleView] = useState<ModuleView>("list");

  useEffect(() => { setQuotes(getAllQuotes()); setArchived(getArchivedQuotes()); }, []);

  const inContext = (q: QuoteRecord) =>
    (!effectiveCompanyId     || q.companyId     === effectiveCompanyId) &&
    (!effectiveLocationId    || q.locationId    === effectiveLocationId) &&
    (!effectiveServiceAreaId || q.serviceAreaId === effectiveServiceAreaId);

  const activeCtx   = quotes.filter(inContext);
  const archivedCtx = archived.filter(inContext);
  const contextFiltered = activeCtx;   // active set drives header count + summary

  // The Archived tab lists archived quotes (any status); other tabs list active.
  const base = tab === "archived" ? archivedCtx : activeCtx;
  const displayed = base
    .filter(q => tab === "all" || tab === "archived" || q.status === tab)
    .filter(q => {
      if (!search) return true;
      const s = search.toLowerCase();
      return (
        q.quoteNumber.toLowerCase().includes(s) ||
        q.title.toLowerCase().includes(s) ||
        q.customerName.toLowerCase().includes(s)
      );
    })
    .sort((a, b) => {
      if (sortField === "recent") return quoteRecency(b) - quoteRecency(a);
      if (sortField === "total") {
        return sortDir === "asc" ? a.total - b.total : b.total - a.total;
      }
      const av = String(a[sortField] ?? ""), bv = String(b[sortField] ?? "");
      return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
    });

  function handleSort(field: SortField) {
    if (sortField === field) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSort(field); setSortDir("asc"); }
  }

  function SortIcon({ field }: { field: SortField }) {
    if (sortField !== field) return <ChevronDown className="w-3 h-3 opacity-30" />;
    return sortDir === "asc"
      ? <ChevronUp className="w-3 h-3" style={{ color: "#0f8578" }} />
      : <ChevronDown className="w-3 h-3" style={{ color: "#0f8578" }} />;
  }

  const tabCount = (key: QuoteTab) =>
    key === "all" ? activeCtx.length
    : key === "archived" ? archivedCtx.length
    : activeCtx.filter(q => q.status === key).length;

  // Summary metrics — respect the active context
  const openQuotes = contextFiltered.filter(q => q.status === "draft" || q.status === "sent" || q.status === "viewed");
  const summaryCards: SummaryCard[] = [
    { icon: FilePen,    label: "Open Quotes",     value: String(openQuotes.length),                                                                  sub: "Draft, sent, viewed",  iconColor: "#0f8578" },
    { icon: Send,       label: "Need Follow-Up",  value: String(contextFiltered.filter(q => q.status === "sent" || q.status === "viewed").length),    sub: "Awaiting response",    iconColor: "#f59e0b" },
    { icon: AlarmClock, label: "Expiring Soon",   value: String(openQuotes.filter(q => { const d = daysUntil(q.expiresAt); return d >= 0 && d <= 30; }).length), sub: "Within 30 days", iconColor: "#dc2626" },
    { icon: DollarSign, label: "Open Quote Value",value: fmt(openQuotes.reduce((s, q) => s + q.total, 0)),                                            sub: `${openQuotes.length} open quotes`, iconColor: "#10b981" },
  ];

  return (
    <div className="p-6">
      <div className="flex items-center gap-4 mb-6">
        <div className="flex-1 min-w-0">
          <PageTitle title="Quotes" count={contextFiltered.length} description="Create, track, and send customer quotes and proposals." />
        </div>
        <ModuleViewToggle view={moduleView} onChange={setModuleView} withCards overviewFirst />
        <div className="flex-1 flex justify-end">
          <button onClick={() => setShowCreate(true)}
            className="flex items-center gap-1.5 bg-[#0f8578] hover:bg-[#0c6b60] text-white text-sm font-medium px-3 py-2 rounded-lg transition-colors">
            <Plus className="w-4 h-4" /> New Quote
          </button>
        </div>
      </div>

      {moduleView === "overview" && (
        <div className="mb-5">
          <ModuleSummaryCards cards={summaryCards} />
        </div>
      )}

      {(moduleView === "list" || moduleView === "cards") && (
      <>
        {/* Toolbar — tabs · search · filter, OUTSIDE the table card (consistent with Customers/Leads) */}
        <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
          <StatusTabs active={tab} onChange={k => setTab(k as QuoteTab)}
            tabs={STATUS_TABS.map(t => ({ key: t.key, label: t.label, count: tabCount(t.key) }))} />
          <div className="flex items-center gap-2 shrink-0">
            <div className="flex items-center gap-2 rounded-lg px-3 py-1.5" style={{ backgroundColor: "var(--bg-input)" }}>
              <Search className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--text-muted)" }} />
              <input type="text" placeholder="Search quotes..." value={search} onChange={e => setSearch(e.target.value)}
                className="bg-transparent text-sm outline-none w-40" style={{ color: "var(--text-primary)" }} />
            </div>
            <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm"
              style={{ border: "1px solid var(--border)", color: "var(--text-secondary)", backgroundColor: "var(--bg-surface)" }}>
              <SlidersHorizontal className="w-3.5 h-3.5" /> Filter
            </button>
          </div>
        </div>

        {moduleView === "cards" ? (
          displayed.length === 0 ? (
            <div className="rounded-xl py-16 text-center" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)" }}>
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>No quotes match the current filter.</p>
            </div>
          ) : (
            <div className="grid gap-3 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
              {displayed.map(q => <QuoteCard key={q.id} quote={q} />)}
            </div>
          )
        ) : (
        <>
        {/* Table card */}
        <div className="rounded-xl overflow-hidden" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" }}>
        {/* Table — horizontal scroll so all columns stay visible on narrow screens */}
        <div className="overflow-x-auto thin-scroll-x">
          <div style={{ minWidth: GRID_MIN_WIDTH }}>
            {/* Column headers */}
            <div className="grid px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider select-none"
              style={{ gridTemplateColumns: GRID_COLS, color: "var(--text-muted)", borderBottom: "1px solid var(--border)", backgroundColor: "transparent" }}>
              {([
                { label: "Quote #",            field: "quoteNumber"  },
                { label: "Customer / Account", field: "customerName" },
                { label: "Property",           field: null           },
                { label: "Related To",         field: null           },
                { label: "Status",             field: "status"       },
                { label: "Total",              field: "total"        },
                { label: "Assigned To",        field: null           },
                { label: "Location",           field: null           },
                { label: "Created",            field: "createdAt"    },
                { label: "Expires",            field: null           },
              ] as const).map(({ label, field }) => (
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
                <div className="py-16 text-center">
                  <p className="text-sm" style={{ color: "var(--text-muted)" }}>No quotes match the current filter.</p>
                </div>
              ) : displayed.map((q, i) => {
                const s = QUOTE_STATUS_STYLE[q.status];
                const lt = q.linkedType ? LINKED_TYPE_STYLE[q.linkedType] : null;
                return (
                  <Link key={q.id} href={`/quotes/${q.id}`}
                    className="relative group grid px-4 py-3 items-center hover:bg-[var(--bg-surface-2)] transition-colors"
                    style={{ gridTemplateColumns: GRID_COLS, borderBottom: i < displayed.length - 1 ? "1px solid var(--border)" : "none", textDecoration: "none" }}>
                    <RowArrow />
                    {/* Quote # */}
                    <span className="text-sm font-mono font-medium truncate" style={{ color: "var(--text-primary)" }}>{q.quoteNumber}</span>
                    {/* Customer / Account (+ title) */}
                    <div className="min-w-0 pr-2">
                      <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>{q.customerName}</p>
                      <p className="text-[10px] truncate mt-0.5" style={{ color: "var(--text-muted)" }}>{q.title}</p>
                    </div>
                    {/* Property */}
                    <span className="text-xs truncate pr-2" style={{ color: q.propertyLabel ? "var(--text-secondary)" : "var(--text-muted)" }}>{q.propertyLabel ?? "—"}</span>
                    {/* Related To */}
                    <div className="pr-2 min-w-0">
                      {q.linkedLabel && lt ? (
                        <span className="inline-flex items-center gap-1.5 max-w-full text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
                          <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: lt.color }} />
                          <span className="truncate">{q.linkedLabel}</span>
                        </span>
                      ) : <span style={{ color: "var(--text-muted)" }}>—</span>}
                    </div>
                    {/* Status */}
                    <StatusBadge label={s.label} color={s.color} className="w-fit" />
                    {/* Total */}
                    <span className="text-sm font-semibold" style={{ color: q.total > 0 ? "var(--text-primary)" : "var(--text-muted)" }}>{q.total > 0 ? fmt(q.total) : "TBD"}</span>
                    {/* Assigned To */}
                    <span className="text-xs truncate pr-2" style={{ color: "var(--text-secondary)" }}>{q.assignedTo ?? q.createdBy}</span>
                    {/* Location */}
                    <span className="text-xs truncate pr-2" style={{ color: "var(--text-secondary)" }}>{q.locationName}</span>
                    {/* Created */}
                    <span className="text-xs" style={{ color: "var(--text-secondary)" }}>{q.createdAt}</span>
                    {/* Expires */}
                    <span className="text-xs" style={{ color: q.expiresAt ? "var(--text-secondary)" : "var(--text-muted)" }}>{q.expiresAt ?? "—"}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-3 text-xs"
          style={{ borderTop: "1px solid var(--border)", color: "var(--text-muted)", backgroundColor: "transparent" }}>
          <span>Showing {displayed.length} of {contextFiltered.length} quotes</span>
          <div className="flex gap-1">
            <button className="px-2 py-1 rounded" style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}>← Prev</button>
            <button className="px-2 py-1 rounded" style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}>Next →</button>
          </div>
        </div>
      </div>
      </>
        )}
      </>
      )}

      {showCreate && <QuoteTypeChooser onClose={() => setShowCreate(false)} />}
    </div>
  );
}

// ─── Card view — one quote per card, status color on the left edge ───────────
function QuoteCard({ quote: q }: { quote: QuoteRecord }) {
  const s = QUOTE_STATUS_STYLE[q.status];
  const lt = q.linkedType ? LINKED_TYPE_STYLE[q.linkedType] : null;
  return (
    <Link href={`/quotes/${q.id}`}
      className="group block rounded-lg p-3 transition-all hover:-translate-y-0.5 hover:shadow-md"
      style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", borderLeft: `3px solid ${s.color}`, textDecoration: "none" }}>
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
          <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded inline-flex items-center gap-1 shrink-0" style={{ backgroundColor: s.color + "22", color: s.color }}>
            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: s.color }} />{s.label}
          </span>
          <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded font-mono shrink-0" style={{ backgroundColor: "var(--bg-input)", color: "var(--text-muted)" }}>{q.quoteNumber}</span>
        </div>
        <span className="text-xs font-bold shrink-0" style={{ color: q.total > 0 ? "var(--text-primary)" : "var(--text-muted)" }}>{q.total > 0 ? fmt(q.total) : "TBD"}</span>
      </div>
      <p className="text-sm font-semibold truncate" style={{ color: "var(--text-primary)" }}>{q.title}</p>
      <p className="text-xs truncate" style={{ color: "var(--text-secondary)" }}>{q.customerName}</p>
      <div className="flex items-center justify-between gap-2 mt-2 pt-2" style={{ borderTop: "1px solid var(--border)" }}>
        {q.linkedLabel && lt ? (
          <span className="inline-flex items-center gap-1.5 min-w-0 text-[10px] font-medium" style={{ color: "var(--text-muted)" }}>
            <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: lt.color }} />
            <span className="truncate">{q.linkedLabel}</span>
          </span>
        ) : (
          <span className="text-[10px] truncate" style={{ color: "var(--text-muted)" }}>{q.expiresAt ? `Expires ${q.expiresAt}` : `Created ${q.createdAt}`}</span>
        )}
        <span className="text-[10px] shrink-0" style={{ color: "var(--text-muted)" }}>{q.createdAt}</span>
      </div>
    </Link>
  );
}
