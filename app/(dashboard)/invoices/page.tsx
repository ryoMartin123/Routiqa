"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import RowArrow from "@/components/shared/RowArrow";
import { Search, Plus, SlidersHorizontal, ChevronUp, ChevronDown, AlertTriangle, CalendarClock, CheckCircle2, DollarSign, ArrowUpRight, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { getAllInvoices, fmt, type InvoiceRecord } from "@/lib/quotes/data";
import { INVOICE_STATUS_STYLE, type InvoiceStatus } from "@/lib/quotes/types";
import InvoiceWizard from "@/components/quotes/InvoiceWizard";
import { useHierarchy } from "@/components/providers/HierarchyProvider";
import { recencyTs } from "@/lib/recency";
import ModuleSummaryCards, { type SummaryCard } from "@/components/shared/ModuleSummaryCards";
import ModuleViewToggle, { type ModuleView } from "@/components/shared/ModuleViewToggle";
import StatusBadge from "@/components/shared/StatusBadge";
import StatusTabs from "@/components/shared/StatusTabs";
import PageTitle from "@/components/shared/PageTitle";

// Recency = newest created/changed (payments count as activity).
function invoiceRecency(i: InvoiceRecord): number {
  return recencyTs(i.id, i.updatedAt, i.createdAt, ...(i.payments ?? []).map(p => p.at));
}

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
  { key: "all",            label: "All"     },
  { key: "draft",          label: "Draft"   },
  { key: "sent",           label: "Sent"    },
  { key: "viewed",         label: "Viewed"  },
  { key: "partially_paid", label: "Partial" },
  { key: "paid",           label: "Paid"    },
  { key: "void",           label: "Void"    },
];

// "recent" is the default pseudo-sort: newest created/changed first (top of the
// list, front of the card grid). Clicking a column header switches to that field.
type SortField = "recent" | "invoiceNumber" | "customerName" | "status" | "total" | "balanceDue" | "dueDate";

const LINKED_TYPE_STYLE: Record<string, { bg: string; color: string }> = {
  quote:      { bg: "#f5f3ff", color: "#6d28d9" },
  job:        { bg: "#d3ebe6", color: "#0a5c53" },
  project:    { bg: "#ede9fe", color: "#5b21b6" },
  agreement:  { bg: "#ecfdf5", color: "#059669" },
  work_order: { bg: "#ecfeff", color: "#0891b2" },
};

// Where the "Linked To" cell navigates, and which type colors it. Invoices
// raised from a field work order carry linkedType "job" but label the work
// order — those route to the work order itself.
function linkedTarget(inv: InvoiceRecord): { href: string; type: string } | null {
  if (inv.workOrderId && inv.linkedLabel?.startsWith("Work Order")) {
    return { href: `/work-orders/${inv.workOrderId}`, type: "work_order" };
  }
  if (!inv.linkedType || !inv.linkedId) return null;
  return { href: `/${inv.linkedType}s/${inv.linkedId}`, type: inv.linkedType };
}

export default function InvoicesPage() {
  const { effectiveCompanyId, effectiveLocationId, effectiveServiceAreaId } = useHierarchy();

  const router = useRouter();
  const [tab, setTab]         = useState<"all" | InvoiceStatus>("all");
  const [search, setSearch]   = useState("");
  const [sortField, setSort]  = useState<SortField>("recent");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [invoices, setInvoices] = useState<InvoiceRecord[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [moduleView, setModuleView] = useState<ModuleView>("list");

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
      if (sortField === "recent") return invoiceRecency(b) - invoiceRecency(a);
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
      ? <ChevronUp className="w-3 h-3" style={{ color: "#0f8578" }} />
      : <ChevronDown className="w-3 h-3" style={{ color: "#0f8578" }} />;
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
    { icon: DollarSign,    label: "Outstanding Balance", value: fmt(totalOutstanding),                                              sub: `${contextFiltered.filter(i => i.balanceDue > 0).length} open invoices`, iconColor: "#0f8578" },
    { icon: AlertTriangle, label: "Past Due",            value: fmt(pastDueTotal),                                                  sub: `${contextFiltered.filter(i => i.status === "past_due").length} invoices`, iconColor: "#dc2626" },
    { icon: CalendarClock, label: "Due This Week",       value: fmt(dueThisWeek.reduce((s, i) => s + i.balanceDue, 0)),              sub: `${dueThisWeek.length} invoices`, iconColor: "#f59e0b" },
    { icon: CheckCircle2,  label: "Paid This Month",     value: fmt(paidThisMonth.reduce((s, i) => s + i.total, 0)),                 sub: `${paidThisMonth.length} payments`, iconColor: "#10b981" },
  ];

  return (
    <div className="p-6">
      <div className="flex items-center gap-4 mb-6">
        <div className="flex-1 min-w-0">
          <PageTitle title="Invoices" count={contextFiltered.length}
            description="Track customer invoices, balances, payments, and billing status." />
        </div>
        <ModuleViewToggle view={moduleView} onChange={setModuleView} withCards overviewFirst />
        <div className="flex-1 flex justify-end">
          <button onClick={() => setShowCreate(true)} className="flex items-center gap-1.5 bg-[#0f8578] hover:bg-[#0c6b60] text-white text-sm font-medium px-3 py-2 rounded-lg transition-colors">
            <Plus className="w-4 h-4" /> New Invoice
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
          <StatusTabs active={tab} onChange={k => setTab(k as "all" | InvoiceStatus)}
            tabs={STATUS_TABS.map(t => ({ key: t.key, label: t.label, count: tabCount(t.key) }))} />
          <div className="flex items-center gap-2 shrink-0">
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

        {moduleView === "cards" ? (
          displayed.length === 0 ? (
            <div className="rounded-xl py-16 text-center" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)" }}>
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>No invoices match the current filter.</p>
            </div>
          ) : (
            <div className="grid gap-3 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
              {displayed.map(inv => <InvoiceCard key={inv.id} invoice={inv} />)}
            </div>
          )
        ) : (
        <>
        {/* Table card */}
        <div className="rounded-xl overflow-hidden" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" }}>
        {/* Column headers */}
        <div className="grid px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider select-none"
          style={{ gridTemplateColumns: "1fr 2fr 1.8fr 1.2fr 0.9fr 0.9fr 1fr", color: "var(--text-muted)", borderBottom: "1px solid var(--border)", backgroundColor: "transparent" }}>
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
              style={{ color: sortField === field ? "#0f8578" : "var(--text-muted)" }}>
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
            const target = linkedTarget(inv);
            const lt = target ? LINKED_TYPE_STYLE[target.type] : (inv.linkedType ? LINKED_TYPE_STYLE[inv.linkedType] : null);
            const isOverdue = inv.status === "past_due";
            return (
              <Link key={inv.id} href={`/invoices/${inv.id}`}
                className="relative group grid px-4 py-3 items-center hover:bg-[var(--bg-surface-2)] transition-colors"
                style={{ gridTemplateColumns: "1fr 2fr 1.8fr 1.2fr 0.9fr 0.9fr 1fr", borderBottom: i < displayed.length - 1 ? "1px solid var(--border)" : "none", textDecoration: "none" }}>
                <RowArrow />
                <span className="text-sm font-mono font-medium" style={{ color: "var(--text-primary)" }}>{inv.invoiceNumber}</span>
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>{inv.title}</p>
                  <p className="text-[10px] truncate mt-0.5" style={{ color: "var(--text-muted)" }}>{inv.customerName}</p>
                </div>
                <div className="min-w-0">
                  {inv.linkedLabel && lt && target ? (
                    // The row itself links to the invoice; this cell hijacks the
                    // click and routes to the linked record instead.
                    <span role="link" tabIndex={0}
                      onClick={e => { e.preventDefault(); e.stopPropagation(); router.push(target.href); }}
                      onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); e.stopPropagation(); router.push(target.href); } }}
                      className="group/linked inline-flex items-center gap-1 text-[11px] font-medium max-w-full cursor-pointer hover:underline"
                      style={{ color: lt.color }}>
                      <span className="truncate">{inv.linkedLabel}</span>
                      <ArrowUpRight className="w-3 h-3 shrink-0 transition-transform group-hover/linked:translate-x-0.5 group-hover/linked:-translate-y-0.5" />
                    </span>
                  ) : inv.linkedLabel && lt ? (
                    <span className="inline-flex items-center text-[11px] font-medium max-w-full" style={{ color: lt.color }}>
                      <span className="truncate">{inv.linkedLabel}</span>
                    </span>
                  ) : <span style={{ color: "var(--text-muted)" }}>—</span>}
                </div>
                <StatusBadge label={s.label} color={s.color} />
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
          style={{ borderTop: "1px solid var(--border)", color: "var(--text-muted)", backgroundColor: "transparent" }}>
          <span>Showing {displayed.length} of {contextFiltered.length} invoices</span>
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

      {showCreate && (
        <InvoiceWizard
          onClose={() => setShowCreate(false)}
          onCreated={(id) => { setShowCreate(false); router.push(`/invoices/${id}`); }} />
      )}
    </div>
  );
}

// ─── Card view — one invoice per card, status color on the left edge ─────────
function InvoiceCard({ invoice: inv }: { invoice: InvoiceRecord }) {
  const s = INVOICE_STATUS_STYLE[inv.status];
  const target = linkedTarget(inv);
  const lt = target ? LINKED_TYPE_STYLE[target.type] : (inv.linkedType ? LINKED_TYPE_STYLE[inv.linkedType] : null);
  const isOverdue = inv.status === "past_due";
  return (
    <Link href={`/invoices/${inv.id}`}
      className="group block rounded-lg p-3 transition-all hover:-translate-y-0.5 hover:shadow-md"
      style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", borderLeft: `3px solid ${s.color}`, textDecoration: "none" }}>
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
          <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded inline-flex items-center gap-1 shrink-0" style={{ backgroundColor: s.color + "22", color: s.color }}>
            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: s.color }} />{s.label}
          </span>
          <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded font-mono shrink-0" style={{ backgroundColor: "var(--bg-input)", color: "var(--text-muted)" }}>{inv.invoiceNumber}</span>
          {inv.isDeposit && <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded shrink-0" style={{ backgroundColor: "var(--accent-soft-bg)", color: "var(--accent-text)" }}>Deposit</span>}
        </div>
        <span className="text-xs font-bold shrink-0" style={{ color: inv.balanceDue > 0 ? (isOverdue ? "#dc2626" : "var(--text-primary)") : "#10b981" }}>
          {inv.balanceDue > 0 ? fmt(inv.balanceDue) : "Paid"}
        </span>
      </div>
      <p className="text-sm font-semibold truncate" style={{ color: "var(--text-primary)" }}>{inv.title}</p>
      <p className="text-xs truncate" style={{ color: "var(--text-secondary)" }}>{inv.customerName}</p>
      <div className="flex items-center justify-between gap-2 mt-2 pt-2" style={{ borderTop: "1px solid var(--border)" }}>
        {inv.linkedLabel && lt ? (
          <span className="inline-flex items-center gap-1.5 min-w-0 text-[10px] font-medium" style={{ color: "var(--text-muted)" }}>
            <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: lt.color }} />
            <span className="truncate">{inv.linkedLabel}</span>
          </span>
        ) : (
          <span className="text-[10px] truncate" style={{ color: "var(--text-muted)" }}>{fmt(inv.total)} total</span>
        )}
        <span className="flex items-center gap-1.5 shrink-0">
          <span className="text-[10px]" style={{ color: isOverdue ? "#dc2626" : "var(--text-muted)" }}>Due {inv.dueDate}</span>
          <ArrowRight className="w-3.5 h-3.5 shrink-0 transition-transform group-hover:-rotate-45" style={{ color: "#0f8578" }} />
        </span>
      </div>
    </Link>
  );
}
