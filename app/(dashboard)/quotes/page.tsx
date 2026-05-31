"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Search, Plus, SlidersHorizontal, ChevronUp, ChevronDown, FilePen, Send, AlarmClock, DollarSign } from "lucide-react";
import { cn } from "@/lib/utils";
import { getAllQuotes, fmt, type QuoteRecord } from "@/lib/quotes/data";
import { QUOTE_STATUS_STYLE, type QuoteStatus } from "@/lib/quotes/types";
import CreateDocumentModal from "@/components/quotes/CreateDocumentModal";
import { useHierarchy } from "@/components/providers/HierarchyProvider";
import ModuleSummaryCards, { type SummaryCard } from "@/components/shared/ModuleSummaryCards";

function daysUntil(dateStr?: string): number {
  if (!dateStr) return Infinity;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return Infinity;
  return (d.getTime() - Date.now()) / 86_400_000;
}

const STATUS_TABS: { key: "all" | QuoteStatus; label: string }[] = [
  { key: "all",       label: "All"       },
  { key: "draft",     label: "Draft"     },
  { key: "sent",      label: "Sent"      },
  { key: "viewed",    label: "Viewed"    },
  { key: "approved",  label: "Approved"  },
  { key: "rejected",  label: "Rejected"  },
  { key: "expired",   label: "Expired"   },
  { key: "converted", label: "Converted" },
];

type SortField = "quoteNumber" | "customerName" | "status" | "total" | "createdAt";

const LINKED_TYPE_STYLE: Record<string, { bg: string; color: string }> = {
  lead:      { bg: "#fef3c7", color: "#92400e" },
  job:       { bg: "#e0e7ff", color: "#3730a3" },
  project:   { bg: "#ede9fe", color: "#5b21b6" },
  agreement: { bg: "#ecfdf5", color: "#059669" },
};

export default function QuotesPage() {
  const { effectiveCompanyId, effectiveLocationId, effectiveServiceAreaId } = useHierarchy();

  const router = useRouter();
  const [tab, setTab]         = useState<"all" | QuoteStatus>("all");
  const [search, setSearch]   = useState("");
  const [sortField, setSort]  = useState<SortField>("createdAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [quotes, setQuotes]   = useState<QuoteRecord[]>([]);
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => { setQuotes(getAllQuotes()); }, []);

  const contextFiltered = quotes
    .filter(q => !effectiveCompanyId     || q.companyId     === effectiveCompanyId)
    .filter(q => !effectiveLocationId    || q.locationId    === effectiveLocationId)
    .filter(q => !effectiveServiceAreaId || q.serviceAreaId === effectiveServiceAreaId);

  const displayed = contextFiltered
    .filter(q => tab === "all" || q.status === tab)
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
      const av = String(a[sortField] ?? ""), bv = String(b[sortField] ?? "");
      if (sortField === "total") {
        return sortDir === "asc" ? a.total - b.total : b.total - a.total;
      }
      return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
    });

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

  const tabCount = (key: "all" | QuoteStatus) =>
    key === "all" ? contextFiltered.length : contextFiltered.filter(q => q.status === key).length;

  // Summary metrics — respect the active context
  const openQuotes = contextFiltered.filter(q => q.status === "draft" || q.status === "sent" || q.status === "viewed");
  const summaryCards: SummaryCard[] = [
    { icon: FilePen,    label: "Open Quotes",     value: String(openQuotes.length),                                                                  sub: "Draft, sent, viewed",  iconColor: "#4f46e5" },
    { icon: Send,       label: "Need Follow-Up",  value: String(contextFiltered.filter(q => q.status === "sent" || q.status === "viewed").length),    sub: "Awaiting response",    iconColor: "#f59e0b" },
    { icon: AlarmClock, label: "Expiring Soon",   value: String(openQuotes.filter(q => { const d = daysUntil(q.expiresAt); return d >= 0 && d <= 30; }).length), sub: "Within 30 days", iconColor: "#dc2626" },
    { icon: DollarSign, label: "Open Quote Value",value: fmt(openQuotes.reduce((s, q) => s + q.total, 0)),                                            sub: `${openQuotes.length} open quotes`, iconColor: "#10b981" },
  ];

  return (
    <div className="p-6">
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-2.5">
            <FilePen className="w-5 h-5" style={{ color: "#4f46e5" }} />
            <h1 className="text-2xl font-semibold" style={{ color: "var(--text-primary)" }}>Quotes</h1>
            <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: "var(--bg-input)", color: "var(--text-muted)" }}>
              {contextFiltered.length}
            </span>
          </div>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>
            Estimates and proposals — track, follow up, and convert
          </p>
        </div>
        <button onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-3 py-2 rounded-lg transition-colors">
          <Plus className="w-4 h-4" /> New Quote
        </button>
      </div>

      {/* Summary cards */}
      <div className="mb-5">
        <ModuleSummaryCards cards={summaryCards} moduleKey="quotes" />
      </div>

      <div className="rounded-xl overflow-hidden" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-subtle)", boxShadow: "var(--shadow-card)" }}>
        {/* Tabs + search */}
        <div className="flex items-center justify-between px-4" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
          <div className="flex items-center gap-0.5 overflow-x-auto">
            {STATUS_TABS.map(t => {
              const count  = tabCount(t.key);
              const active = tab === t.key;
              if (t.key !== "all" && count === 0) return null;
              return (
                <button key={t.key} onClick={() => setTab(t.key)}
                  className="relative flex items-center gap-1.5 px-3 py-3 text-sm font-medium transition-colors whitespace-nowrap shrink-0"
                  style={{ color: active ? "#4f46e5" : "var(--text-muted)" }}>
                  {t.label}
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                    style={{ backgroundColor: active ? "#e0e7ff" : "var(--bg-input)", color: active ? "#4f46e5" : "var(--text-muted)" }}>
                    {count}
                  </span>
                  {active && <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-t bg-indigo-600" />}
                </button>
              );
            })}
          </div>
          <div className="flex items-center gap-2 py-2 shrink-0">
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

        {/* Column headers */}
        <div className="grid px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider select-none"
          style={{ gridTemplateColumns: "1fr 2fr 2fr 1.2fr 1fr 1fr", color: "var(--text-muted)", borderBottom: "1px solid var(--border-subtle)", backgroundColor: "var(--bg-surface-2)" }}>
          {([
            { label: "Quote #",   field: "quoteNumber"   },
            { label: "Title",     field: null            },
            { label: "Linked To", field: null            },
            { label: "Status",    field: "status"        },
            { label: "Total",     field: "total"         },
            { label: "Expires",   field: null            },
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
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>No quotes match the current filter.</p>
            </div>
          ) : displayed.map((q, i) => {
            const s = QUOTE_STATUS_STYLE[q.status];
            const lt = q.linkedType ? LINKED_TYPE_STYLE[q.linkedType] : null;
            return (
              <Link key={q.id} href={`/quotes/${q.id}`}
                className="grid px-4 py-3 items-center hover:bg-[var(--bg-surface-2)] transition-colors"
                style={{ gridTemplateColumns: "1fr 2fr 2fr 1.2fr 1fr 1fr", borderBottom: i < displayed.length - 1 ? "1px solid var(--border-subtle)" : "none", textDecoration: "none" }}>
                <span className="text-sm font-mono font-medium" style={{ color: "var(--text-primary)" }}>{q.quoteNumber}</span>
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>{q.title}</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <div className="w-4 h-4 rounded-full bg-indigo-100 flex items-center justify-center text-[8px] font-bold text-indigo-600 shrink-0">{q.customerInitials}</div>
                    <p className="text-[10px] truncate" style={{ color: "var(--text-muted)" }}>{q.customerName}</p>
                  </div>
                </div>
                <div>
                  {q.linkedLabel && lt ? (
                    <span className="inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full"
                      style={{ backgroundColor: lt.bg, color: lt.color }}>
                      {q.linkedLabel}
                    </span>
                  ) : <span style={{ color: "var(--text-muted)" }}>—</span>}
                </div>
                <span className="inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full"
                  style={{ backgroundColor: s.bg, color: s.color }}>{s.label}</span>
                <span className="text-sm font-semibold" style={{ color: q.total > 0 ? "var(--text-primary)" : "var(--text-muted)" }}>
                  {q.total > 0 ? fmt(q.total) : "TBD"}
                </span>
                <span className="text-sm" style={{ color: q.expiresAt ? "var(--text-secondary)" : "var(--text-muted)" }}>
                  {q.expiresAt ?? "—"}
                </span>
              </Link>
            );
          })}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-3 text-xs"
          style={{ borderTop: "1px solid var(--border-subtle)", color: "var(--text-muted)", backgroundColor: "var(--bg-surface-2)" }}>
          <span>Showing {displayed.length} of {contextFiltered.length} quotes</span>
          <div className="flex gap-1">
            <button className="px-2 py-1 rounded" style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}>← Prev</button>
            <button className="px-2 py-1 rounded" style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}>Next →</button>
          </div>
        </div>
      </div>

      {showCreate && (
        <CreateDocumentModal kind="quote"
          onClose={() => setShowCreate(false)}
          onCreated={(id) => { setShowCreate(false); router.push(`/quotes/${id}`); }} />
      )}
    </div>
  );
}
