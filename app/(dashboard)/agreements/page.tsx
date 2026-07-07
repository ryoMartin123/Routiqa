"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Search, Plus, SlidersHorizontal, ChevronUp, ChevronDown,
  FileText, CalendarCheck, RefreshCw, DollarSign, ArrowRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  AGREEMENTS, TEMPLATES, AGREEMENT_STATS, formatValue, getAllAgreements,
  type AgreementStatus, type CustomerAgreement, type AgreementTemplate,
} from "@/lib/agreements/data";
import ModuleSummaryCards from "@/components/shared/ModuleSummaryCards";
import PageTitle from "@/components/shared/PageTitle";
import ModuleViewToggle, { type ModuleView } from "@/components/shared/ModuleViewToggle";
import StatusBadge from "@/components/shared/StatusBadge";
import StatusTabs from "@/components/shared/StatusTabs";

// ─── Status config ────────────────────────────────────────
const STATUS: Record<AgreementStatus, { label: string; bg: string; color: string }> = {
  active:       { label: "Active",       bg: "#d1fae5", color: "#065f46" },
  due_soon:     { label: "Due Soon",     bg: "#fef3c7", color: "#92400e" },
  overdue:      { label: "Overdue",      bg: "#fee2e2", color: "#991b1b" },
  renewal_due:  { label: "Renewal Due",  bg: "#ffedd5", color: "#9a3412" },
  canceled:     { label: "Canceled",     bg: "var(--bg-input)", color: "var(--text-muted)" },
};

// ─── Filter tabs ──────────────────────────────────────────
const TABS = [
  { key: "all",         label: "All",         fn: (_: CustomerAgreement) => true },
  { key: "active",      label: "Active",      fn: (a: CustomerAgreement) => a.status === "active" },
  { key: "due_soon",    label: "Due Soon",    fn: (a: CustomerAgreement) => a.status === "due_soon" },
  { key: "overdue",     label: "Overdue",     fn: (a: CustomerAgreement) => a.status === "overdue" },
  { key: "renewal_due", label: "Renewals",    fn: (a: CustomerAgreement) => a.status === "renewal_due" },
  { key: "canceled",    label: "Canceled",    fn: (a: CustomerAgreement) => a.status === "canceled" },
  { key: "templates",   label: "Templates",   fn: (_: CustomerAgreement) => false }, // special view
];

type SortField = "customer" | "type" | "status" | "renewalDate" | "annualValue" | "assignedTo";

// ─── Templates view ───────────────────────────────────────
const TMPL_STATUS: Record<string, { label: string; bg: string; color: string }> = {
  active:   { label: "Active",   bg: "#d1fae5", color: "#065f46" },
  draft:    { label: "Draft",    bg: "#d3ebe6", color: "#0a5c53" },
  archived: { label: "Archived", bg: "var(--bg-input)", color: "var(--text-muted)" },
};

function TemplatesTable() {
  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{
        backgroundColor: "var(--bg-surface)",
        border: "1px solid var(--border)",
        boxShadow: "var(--shadow-card)",
      }}
    >
      {/* Column headers */}
      <div
        className="grid px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider"
        style={{
          gridTemplateColumns: "2.5fr 1fr 1fr 1fr 1fr 1fr 1fr",
          color: "var(--text-muted)",
          borderBottom: "1px solid var(--border)",
          backgroundColor: "var(--bg-surface-2)",
        }}
      >
        <span>Template Name</span>
        <span>Industry</span>
        <span>Billing</span>
        <span>Visit Frequency</span>
        <span>Price</span>
        <span>Active Agreements</span>
        <span>Status</span>
      </div>

      {TEMPLATES.map((t: AgreementTemplate, i) => {
        const s = TMPL_STATUS[t.status];
        return (
          <div
            key={t.id}
            className="grid px-4 py-3 items-center hover:bg-[var(--bg-surface-2)] transition-colors cursor-pointer"
            style={{
              gridTemplateColumns: "2.5fr 1fr 1fr 1fr 1fr 1fr 1fr",
              borderBottom: i < TEMPLATES.length - 1 ? "1px solid var(--border)" : "none",
            }}
          >
            <div>
              <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{t.name}</p>
              <p className="text-xs mt-0.5 truncate" style={{ color: "var(--text-muted)" }}>{t.description.slice(0, 60)}…</p>
            </div>
            <span className="text-sm" style={{ color: "var(--text-secondary)" }}>{t.industry}</span>
            <span className="text-sm" style={{ color: "var(--text-secondary)" }}>{t.billingFrequency}</span>
            <span className="text-sm" style={{ color: "var(--text-secondary)" }}>{t.visitFrequency}</span>
            <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{t.priceLabel}</span>
            <span
              className="text-sm font-semibold"
              style={{ color: t.activeCount > 0 ? "#0f8578" : "var(--text-muted)" }}
            >
              {t.activeCount}
            </span>
            <StatusBadge label={s.label} color={s.color} />
          </div>
        );
      })}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────
export default function AgreementsPage() {
  const router = useRouter();
  const [tab, setTab]         = useState("all");
  const [search, setSearch]   = useState("");
  const [sortField, setSort]  = useState<SortField>("customer");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [moduleView, setModuleView] = useState<ModuleView>("cards");

  // Merge in session-created agreements client-side (avoids a hydration gap).
  const [agreements, setAgreements] = useState<CustomerAgreement[]>(AGREEMENTS);
  useEffect(() => { setAgreements(getAllAgreements()); }, []);

  const isTemplates = tab === "templates";
  const tabFn = TABS.find((t) => t.key === tab)?.fn ?? (() => true);

  const displayed = agreements
    .filter(tabFn)
    .filter((a) => {
      if (!search) return true;
      const q = search.toLowerCase();
      return (
        a.customer.toLowerCase().includes(q) ||
        a.type.toLowerCase().includes(q) ||
        a.location.toLowerCase().includes(q) ||
        a.assignedTo.toLowerCase().includes(q)
      );
    })
    .sort((a, b) => {
      let av = "", bv = "";
      if (sortField === "annualValue") {
        return sortDir === "asc" ? a.annualValue - b.annualValue : b.annualValue - a.annualValue;
      }
      if (sortField === "customer")    { av = a.customer;    bv = b.customer; }
      if (sortField === "type")        { av = a.type;        bv = b.type; }
      if (sortField === "status")      { av = a.status;      bv = b.status; }
      if (sortField === "renewalDate") { av = a.renewalDate; bv = b.renewalDate; }
      if (sortField === "assignedTo")  { av = a.assignedTo;  bv = b.assignedTo; }
      return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
    });

  function handleSort(field: SortField) {
    if (sortField === field) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSort(field); setSortDir("asc"); }
  }

  function SortIcon({ field }: { field: SortField }) {
    if (sortField !== field) return <ChevronDown className="w-3 h-3 opacity-30" />;
    return sortDir === "asc"
      ? <ChevronUp className="w-3 h-3" style={{ color: "#0f8578" }} />
      : <ChevronDown className="w-3 h-3" style={{ color: "#0f8578" }} />;
  }

  const totalAnnualRevenue = AGREEMENT_STATS.annualRevenue;
  const revenueDisplay =
    totalAnnualRevenue >= 1000
      ? `$${(totalAnnualRevenue / 1000).toFixed(1)}k/yr`
      : `$${totalAnnualRevenue}/yr`;

  return (
    <div className="p-6 space-y-5">
      {/* Page header — title · centered view toggle · actions */}
      <div className="flex items-center gap-4">
        <div className="flex-1 min-w-0">
          <PageTitle title="Agreements" count={agreements.length} description="Manage recurring service plans, visits, billing rules, and renewals." />
        </div>
        <ModuleViewToggle view={moduleView} onChange={setModuleView} withCards overviewFirst />
        <div className="flex-1 flex items-center justify-end gap-2">
          <button onClick={() => router.push("/agreements/new")}
            className="flex items-center gap-1.5 bg-[#0f8578] hover:bg-[#0c6b60] text-white text-sm font-medium px-3 py-2 rounded-lg transition-colors">
            <Plus className="w-4 h-4" />
            New Agreement
          </button>
        </div>
      </div>

      {moduleView === "overview" && (
        <ModuleSummaryCards
          cards={[
            { icon: FileText,      label: "Active Agreements",     value: String(AGREEMENT_STATS.active),          sub: "Running or visits due", iconColor: "#0f8578" },
            { icon: CalendarCheck, label: "Visits Due This Month", value: String(AGREEMENT_STATS.visitsDueMonth),  sub: "June 2026",             iconColor: "#10b981" },
            { icon: RefreshCw,     label: "Renewals Due Soon",     value: String(AGREEMENT_STATS.renewalsDueSoon), sub: "Within 60 days",        iconColor: "#f59e0b" },
            { icon: DollarSign,    label: "Agreement Revenue",     value: revenueDisplay,                          sub: `${AGREEMENTS.length} agreements`, iconColor: "#10b981" },
          ]}
        />
      )}

      {(moduleView === "list" || moduleView === "cards") && (
      <>
        {/* Toolbar — tabs · search · filter, OUTSIDE the table card (consistent with Customers/Leads) */}
        <div
          className="flex items-center justify-between flex-wrap gap-2 mb-3"
        >
          <StatusTabs active={tab} onChange={k => setTab(k as typeof tab)}
            tabs={TABS.map(t => ({ key: t.key, label: t.label, count: t.key === "templates" ? TEMPLATES.length : agreements.filter(t.fn).length }))} />

          {!isTemplates && (
            <div className="flex items-center gap-2">
              <div
                className="flex items-center gap-2 rounded-lg px-3 py-1.5"
                style={{ backgroundColor: "var(--bg-input)" }}
              >
                <Search className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--text-muted)" }} />
                <input
                  type="text"
                  placeholder="Search agreements..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="bg-transparent text-sm outline-none w-44"
                  style={{ color: "var(--text-primary)" }}
                />
              </div>
              <button
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm"
                style={{ border: "1px solid var(--border)", color: "var(--text-secondary)", backgroundColor: "var(--bg-surface)" }}
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                Filter
              </button>
            </div>
          )}
        </div>

        {/* Templates keep the table; otherwise list table or cards grid */}
        {isTemplates ? (
          <div className="rounded-xl overflow-hidden" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" }}>
            <TemplatesTable />
          </div>
        ) : moduleView === "cards" ? (
          displayed.length === 0 ? (
            <div className="rounded-xl py-16 text-center" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)" }}>
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>No agreements match your search.</p>
            </div>
          ) : (
            <div className="grid gap-3 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
              {displayed.map(a => <AgreementCard key={a.id} a={a} />)}
            </div>
          )
        ) : (
          <div className="rounded-xl overflow-hidden" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" }}>
          <>
            {/* Column headers */}
            <div
              className="grid px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider select-none"
              style={{
                gridTemplateColumns: "2fr 1.5fr 1fr 1fr 1fr 1fr 1fr 1fr 1.5fr",
                color: "var(--text-muted)",
                borderBottom: "1px solid var(--border)",
                backgroundColor: "var(--bg-surface-2)",
              }}
            >
              {(
                [
                  { label: "Customer / Account", field: "customer"    },
                  { label: "Agreement Type",     field: "type"        },
                  { label: "Status",             field: "status"      },
                  { label: "Location",           field: null          },
                  { label: "Next Visit",         field: null          },
                  { label: "Renewal Date",       field: "renewalDate" },
                  { label: "Billing",            field: null          },
                  { label: "Value",              field: "annualValue" },
                  { label: "Assigned To",        field: "assignedTo"  },
                ] as const
              ).map(({ label, field }) => (
                <button
                  key={label}
                  onClick={() => field && handleSort(field as SortField)}
                  className={cn(
                    "flex items-center gap-1 text-left",
                    field ? "cursor-pointer hover:opacity-80" : "cursor-default"
                  )}
                  style={{ color: sortField === field ? "#0f8578" : "var(--text-muted)" }}
                >
                  {label}
                  {field && <SortIcon field={field as SortField} />}
                </button>
              ))}
            </div>

            {/* Rows */}
            <div>
              {displayed.length === 0 ? (
                <div className="py-16 text-center">
                  <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                    No agreements match your search.
                  </p>
                </div>
              ) : (
                displayed.map((a, i) => {
                  const s = STATUS[a.status];
                  return (
                    <Link
                      key={a.id}
                      href={`/agreements/${a.id}`}
                      className="grid px-4 py-3 items-center hover:bg-[var(--bg-surface-2)] transition-colors"
                      style={{
                        gridTemplateColumns: "2fr 1.5fr 1fr 1fr 1fr 1fr 1fr 1fr 1.5fr",
                        borderBottom: i < displayed.length - 1 ? "1px solid var(--border)" : "none",
                        textDecoration: "none",
                      }}
                    >
                      {/* Customer */}
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: "var(--accent-soft-bg)" }}>
                          <FileText className="w-3.5 h-3.5" style={{ color: "var(--accent-text)" }} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>
                            {a.customer}
                          </p>
                          <p className="text-[10px] truncate" style={{ color: "var(--text-muted)" }}>
                            {a.industry}
                          </p>
                        </div>
                      </div>

                      {/* Type */}
                      <span className="text-sm truncate" style={{ color: "var(--text-secondary)" }}>
                        {a.type}
                      </span>

                      {/* Status */}
                      <div>
                        <StatusBadge label={s.label} color={s.color} />
                      </div>

                      {/* Location */}
                      <span className="text-sm" style={{ color: "var(--text-secondary)" }}>
                        {a.location}
                      </span>

                      {/* Next Visit */}
                      <span
                        className="text-sm"
                        style={{
                          color: a.status === "overdue"
                            ? "#dc2626"
                            : a.nextVisit ? "var(--text-secondary)" : "var(--text-muted)",
                          fontWeight: a.status === "overdue" ? 600 : 400,
                        }}
                      >
                        {a.nextVisit ?? "—"}
                      </span>

                      {/* Renewal Date */}
                      <span
                        className="text-sm"
                        style={{
                          color: a.status === "renewal_due" ? "#ea580c" : "var(--text-secondary)",
                          fontWeight: a.status === "renewal_due" ? 600 : 400,
                        }}
                      >
                        {a.renewalDate}
                      </span>

                      {/* Billing */}
                      <span className="text-sm" style={{ color: "var(--text-muted)" }}>
                        {a.billingFrequency}
                      </span>

                      {/* Value */}
                      <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                        {formatValue(a)}
                      </span>

                      {/* Assigned To */}
                      <span className="text-sm" style={{ color: "var(--text-secondary)" }}>
                        {a.assignedTo}
                      </span>
                    </Link>
                  );
                })
              )}
            </div>

            {/* Footer */}
            <div
              className="flex items-center justify-between px-4 py-3 text-xs"
              style={{
                borderTop: "1px solid var(--border)",
                color: "var(--text-muted)",
                backgroundColor: "var(--bg-surface-2)",
              }}
            >
              <span>
                Showing {displayed.length} of {agreements.filter(tabFn).length} agreements
              </span>
              <div className="flex items-center gap-1">
                <button
                  className="px-2 py-1 rounded"
                  style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}
                >
                  ← Prev
                </button>
                <button
                  className="px-2 py-1 rounded"
                  style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}
                >
                  Next →
                </button>
              </div>
            </div>
          </>
          </div>
        )}
      </>
      )}

    </div>
  );
}

// ─── Agreement card (Cards view) — same size/style as the Jobs card ───
function AgreementCard({ a }: { a: CustomerAgreement }) {
  const s = STATUS[a.status];
  return (
    <Link href={`/agreements/${a.id}`}
      className="group block rounded-lg p-3 transition-all hover:-translate-y-0.5 hover:shadow-md"
      style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", borderLeft: `3px solid ${s.color}`, textDecoration: "none" }}>
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
          <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded inline-flex items-center gap-1 shrink-0" style={{ backgroundColor: s.color + "22", color: s.color }}>
            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: s.color }} />{s.label}
          </span>
          <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded shrink-0 truncate" style={{ backgroundColor: "var(--bg-input)", color: "var(--text-muted)" }}>{a.type}</span>
        </div>
        <span className="text-xs font-bold shrink-0" style={{ color: "var(--text-primary)" }}>{formatValue(a)}</span>
      </div>
      <p className="text-sm font-semibold truncate" style={{ color: "var(--text-primary)" }}>{a.customer}</p>
      {(a.location || a.industry) && <p className="text-xs truncate" style={{ color: "var(--text-secondary)" }}>{a.location || a.industry}</p>}
      <div className="flex items-center justify-between gap-2 mt-2 pt-2" style={{ borderTop: "1px solid var(--border)" }}>
        <span className="text-[10px] truncate" style={{ color: a.status === "overdue" ? "#dc2626" : a.status === "renewal_due" ? "#ea580c" : "var(--text-muted)" }}>
          {a.nextVisit ? `Next: ${a.nextVisit}` : `Renews ${a.renewalDate}`}
        </span>
        <div className="flex items-center gap-1.5 shrink-0 min-w-0">
          <span className="text-[10px] truncate" style={{ color: "var(--text-secondary)" }}>{a.assignedTo}</span>
          <ArrowRight className="w-3.5 h-3.5 shrink-0 transition-transform group-hover:-rotate-45" style={{ color: "#0f8578" }} />
        </div>
      </div>
    </Link>
  );
}
