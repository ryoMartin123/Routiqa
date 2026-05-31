"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Search, Plus, SlidersHorizontal, ChevronUp, ChevronDown, Receipt, AlertTriangle, CalendarClock, CheckCircle2, DollarSign } from "lucide-react";
import { cn } from "@/lib/utils";
import { getAllInvoices, fmt, type InvoiceRecord } from "@/lib/quotes/data";
import { INVOICE_STATUS_STYLE, type InvoiceStatus } from "@/lib/quotes/types";
import CreateDocumentModal from "@/components/quotes/CreateDocumentModal";
import { useHierarchy } from "@/components/providers/HierarchyProvider";
import ModuleSummaryCards, { type SummaryCard } from "@/components/shared/ModuleSummaryCards";

const NOW = new Date();
function daysUntil(dateStr?: string): number {
  if (!dateStr) return Infinity;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return Infinity;
  return (d.getTime() - NOW.getTime()) / 86_400_000;
}
function isThisMonth(dateStr?: string): boolean {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  return !isNaN(d.getTime()) && d.getMonth() === NOW.getMonth() && d.getFullYear() === NOW.getFullYear();
}

const STATUS_TABS: { key: "all" | InvoiceStatus; label: string }[] = [
  { key: "all",            label: "All"            },
  { key: "draft",          label: "Draft"          },
  { key: "sent",           label: "Sent"           },
  { key: "viewed",         label: "Viewed"         },
  { key: "partially_paid", label: "Partially Paid" },
  { key: "paid",           label: "Paid"           },
  { key: "past_due",       label: "Past Due"       },
  { key: "void",           label: "Void"           },
  { key: "canceled",       label: "Canceled"       },
];

type SortField = "invoiceNumber" | "customerName" | "status" | "total" | "balanceDue" | "dueDate";

const LINKED_TYPE_STYLE: Record<string, { bg: string; color: string }> = {
  quote:     { bg: "#f5f3ff", color: "#6d28d9" },
  job:       { bg: "#e0e7ff", color: "#3730a3" },
  project:   { bg: "#ede9fe", color: "#5b21b6" },
  agreement: { bg: "#ecfdf5", color: "#059669" },
};

export default function InvoicesPage() {
  const { effectiveCompanyId, effectiveLocationId, effectiveServiceAreaId } = useHierarchy();

  const router = useRouter();
  const [tab, setTab]         = useState<"all" | InvoiceStatus>("all");
  const [search, setSearch]   = useState("");
  const [sortField, setSort]  = useState<SortField>("dueDate");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [invoices, setInvoices] = useState<InvoiceRecord[]>([]);
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => { setInvoices(getAllInvoices()); }, []);

  const contextFiltered = invoices
    .filter(i => !effectiveCompanyId     || i.companyId     === effectiveCompanyId)
    .filter(i => !effectiveLocationId    || i.locationId    === effectiveLocationId)
    .filter(i => !effectiveServiceAreaId || i.serviceAreaId === effectiveServiceAreaId);

  const displayed = contextFiltered
    .filter(i => tab === "all" || i.status === tab)
    .filter(i => {
      if (!search) return true;
      const s = search.toLowerCase();
      return (
        i.invoiceNumber.toLowerCase().includes(s) ||
        i.title.toLowerCase().includes(s) ||
        i.customerName.toLowerCase().includes(s)
      );
    })
    .sort((a, b) => {
      if (sortField === "total" || sortField === "balanceDue") {
        const av = a[sortField], bv = b[sortField];
        return sortDir === "asc" ? av - bv : bv - av;
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
      ? <ChevronUp className="w-3 h-3" style={{ color: "#4f46e5" }} />
      : <ChevronDown className="w-3 h-3" style={{ color: "#4f46e5" }} />;
  }

  const tabCount = (key: "all" | InvoiceStatus) =>
    key === "all" ? contextFiltered.length : contextFiltered.filter(i => i.status === key).length;

  const totalOutstanding = contextFiltered
    .filter(i => i.status !== "paid" && i.status !== "void" && i.status !== "canceled")
    .reduce((sum, i) => sum + i.balanceDue, 0);

  // Summary metrics — respect the active context
  const pastDueTotal = contextFiltered.filter(i => i.status === "past_due").reduce((s, i) => s + i.balanceDue, 0);
  const dueThisWeek  = contextFiltered.filter(i => i.balanceDue > 0 && daysUntil(i.dueDate) >= 0 && daysUntil(i.dueDate) <= 7);
  const paidThisMonth = contextFiltered.filter(i => i.status === "paid" && isThisMonth(i.paidAt));
  const summaryCards: SummaryCard[] = [
    { icon: DollarSign,    label: "Outstanding Balance", value: fmt(totalOutstanding),                                              sub: `${contextFiltered.filter(i => i.balanceDue > 0).length} open invoices`, iconColor: "#4f46e5" },
    { icon: AlertTriangle, label: "Past Due",            value: fmt(pastDueTotal),                                                  sub: `${contextFiltered.filter(i => i.status === "past_due").length} invoices`, iconColor: "#dc2626" },
    { icon: CalendarClock, label: "Due This Week",       value: fmt(dueThisWeek.reduce((s, i) => s + i.balanceDue, 0)),              sub: `${dueThisWeek.length} invoices`, iconColor: "#f59e0b" },
    { icon: CheckCircle2,  label: "Paid This Month",     value: fmt(paidThisMonth.reduce((s, i) => s + i.total, 0)),                 sub: `${paidThisMonth.length} payments`, iconColor: "#10b981" },
  ];

  return (
    <div className="p-6">
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-2.5">
            <Receipt className="w-5 h-5" style={{ color: "#4f46e5" }} />
            <h1 className="text-2xl font-semibold" style={{ color: "var(--text-primary)" }}>Invoices</h1>
            <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: "var(--bg-input)", color: "var(--text-muted)" }}>
              {contextFiltered.length}
            </span>
          </div>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>
            {totalOutstanding > 0
              ? `${fmt(totalOutstanding)} outstanding across ${contextFiltered.filter(i => i.balanceDue > 0).length} invoices`
              : "All invoices up to date"}
          </p>
        </div>
        <button className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-3 py-2 rounded-lg transition-colors">
          <Plus className="w-4 h-4" /> New Invoice
        </button>
      </div>

      {/* Summary cards */}
      <div className="mb-5">
        <ModuleSummaryCards cards={summaryCards} moduleKey="invoices" />
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
              <input type="text" placeholder="Search invoices..." value={search} onChange={e => setSearch(e.target.value)}
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
          style={{ gridTemplateColumns: "1fr 2fr 1.8fr 1.2fr 0.9fr 0.9fr 1fr", color: "var(--text-muted)", borderBottom: "1px solid var(--border-subtle)", backgroundColor: "var(--bg-surface-2)" }}>
          {([
            { label: "Invoice #",    field: "invoiceNumber" },
            { label: "Title",        field: null            },
            { label: "Linked To",    field: null            },
            { label: "Status",       field: "status"        },
            { label: "Total",        field: "total"         },
            { label: "Balance Due",  field: "balanceDue"    },
            { label: "Due Date",     field: "dueDate"       },
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
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>No invoices match the current filter.</p>
            </div>
          ) : displayed.map((inv, i) => {
            const s  = INVOICE_STATUS_STYLE[inv.status];
            const lt = inv.linkedType ? LINKED_TYPE_STYLE[inv.linkedType] : null;
            const isOverdue = inv.status === "past_due";
            return (
              <Link key={inv.id} href={`/invoices/${inv.id}`}
                className="grid px-4 py-3 items-center hover:bg-[var(--bg-surface-2)] transition-colors"
                style={{ gridTemplateColumns: "1fr 2fr 1.8fr 1.2fr 0.9fr 0.9fr 1fr", borderBottom: i < displayed.length - 1 ? "1px solid var(--border-subtle)" : "none", textDecoration: "none" }}>
                <span className="text-sm font-mono font-medium" style={{ color: "var(--text-primary)" }}>{inv.invoiceNumber}</span>
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>{inv.title}</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <div className="w-4 h-4 rounded-full bg-indigo-100 flex items-center justify-center text-[8px] font-bold text-indigo-600 shrink-0">{inv.customerInitials}</div>
                    <p className="text-[10px] truncate" style={{ color: "var(--text-muted)" }}>{inv.customerName}</p>
                  </div>
                </div>
                <div>
                  {inv.linkedLabel && lt ? (
                    <span className="inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full"
                      style={{ backgroundColor: lt.bg, color: lt.color }}>
                      {inv.linkedLabel}
                    </span>
                  ) : <span style={{ color: "var(--text-muted)" }}>—</span>}
                </div>
                <span className="inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full"
                  style={{ backgroundColor: s.bg, color: s.color }}>{s.label}</span>
                <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{fmt(inv.total)}</span>
                <span className="text-sm font-semibold"
                  style={{ color: inv.balanceDue > 0 ? (isOverdue ? "#dc2626" : "var(--text-primary)") : "#10b981" }}>
                  {inv.balanceDue > 0 ? fmt(inv.balanceDue) : "Paid"}
                </span>
                <span className="text-sm" style={{ color: isOverdue ? "#dc2626" : "var(--text-secondary)" }}>
                  {inv.dueDate}
                </span>
              </Link>
            );
          })}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-3 text-xs"
          style={{ borderTop: "1px solid var(--border-subtle)", color: "var(--text-muted)", backgroundColor: "var(--bg-surface-2)" }}>
          <span>Showing {displayed.length} of {contextFiltered.length} invoices</span>
          <div className="flex gap-1">
            <button className="px-2 py-1 rounded" style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}>← Prev</button>
            <button className="px-2 py-1 rounded" style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}>Next →</button>
          </div>
        </div>
      </div>
    </div>
  );
}
