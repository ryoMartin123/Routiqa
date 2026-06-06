"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Search, Plus, SlidersHorizontal, ChevronUp, ChevronDown,
  FileText, CalendarCheck, RefreshCw, DollarSign, LayoutTemplate,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  AGREEMENTS, TEMPLATES, AGREEMENT_STATS, formatValue, getAllAgreements,
  type AgreementStatus, type CustomerAgreement, type AgreementTemplate,
} from "@/lib/agreements/data";
import AgreementBuilder from "@/components/agreements/AgreementBuilder";
import ModuleSummaryCards from "@/components/shared/ModuleSummaryCards";
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
  draft:    { label: "Draft",    bg: "#e0e7ff", color: "#3730a3" },
  archived: { label: "Archived", bg: "var(--bg-input)", color: "var(--text-muted)" },
};

function TemplatesTable() {
  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{
        backgroundColor: "var(--bg-surface)",
        border: "1px solid var(--border-subtle)",
        boxShadow: "var(--shadow-card)",
      }}
    >
      {/* Column headers */}
      <div
        className="grid px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider"
        style={{
          gridTemplateColumns: "2.5fr 1fr 1fr 1fr 1fr 1fr 1fr",
          color: "var(--text-muted)",
          borderBottom: "1px solid var(--border-subtle)",
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
              borderBottom: i < TEMPLATES.length - 1 ? "1px solid var(--border-subtle)" : "none",
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
              style={{ color: t.activeCount > 0 ? "#4f46e5" : "var(--text-muted)" }}
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
  const [moduleView, setModuleView] = useState<ModuleView>("list");
  const [showBuilder, setShowBuilder] = useState(false);

  // Merge in session-created agreements client-side (avoids a hydration gap).
  const [agreements, setAgreements] = useState<CustomerAgreement[]>(AGREEMENTS);
  useEffect(() => { setAgreements(getAllAgreements()); }, [showBuilder]);

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
      ? <ChevronUp className="w-3 h-3" style={{ color: "#4f46e5" }} />
      : <ChevronDown className="w-3 h-3" style={{ color: "#4f46e5" }} />;
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
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-semibold" style={{ color: "var(--text-primary)" }}>
              Agreements
            </h1>
            <span
              className="text-xs font-bold px-2 py-0.5 rounded-full"
              style={{ backgroundColor: "var(--bg-input)", color: "var(--text-muted)" }}
            >
              {agreements.length}
            </span>
          </div>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>
            Maintenance plans, service agreements, renewals, and recurring visits
          </p>
        </div>
        <ModuleViewToggle view={moduleView} onChange={setModuleView} />
        <div className="flex-1 flex items-center justify-end gap-2">
          <button
            onClick={() => router.push("/settings?section=agreements")}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm transition-colors"
            style={{ border: "1px solid var(--border)", color: "var(--text-secondary)", backgroundColor: "var(--bg-surface)" }}
          >
            <LayoutTemplate className="w-4 h-4" />
            Templates
          </button>
          <button onClick={() => setShowBuilder(true)}
            className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-3 py-2 rounded-lg transition-colors">
            <Plus className="w-4 h-4" />
            New Agreement
          </button>
        </div>
      </div>

      {moduleView === "overview" && (
        <ModuleSummaryCards
          cards={[
            { icon: FileText,      label: "Active Agreements",     value: String(AGREEMENT_STATS.active),          sub: "Running or visits due", iconColor: "#4f46e5" },
            { icon: CalendarCheck, label: "Visits Due This Month", value: String(AGREEMENT_STATS.visitsDueMonth),  sub: "June 2026",             iconColor: "#10b981" },
            { icon: RefreshCw,     label: "Renewals Due Soon",     value: String(AGREEMENT_STATS.renewalsDueSoon), sub: "Within 60 days",        iconColor: "#f59e0b" },
            { icon: DollarSign,    label: "Agreement Revenue",     value: revenueDisplay,                          sub: `${AGREEMENTS.length} agreements`, iconColor: "#10b981" },
          ]}
        />
      )}

      {/* Table card */}
      {moduleView === "list" && (
      <div
        className="rounded-xl overflow-hidden"
        style={{
          backgroundColor: "var(--bg-surface)",
          border: "1px solid var(--border-subtle)",
          boxShadow: "var(--shadow-card)",
        }}
      >
        {/* Tabs + search */}
        <div
          className="flex items-center justify-between flex-wrap gap-2 px-4 py-3"
          style={{ borderBottom: "1px solid var(--border-subtle)" }}
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

        {/* Templates view */}
        {isTemplates ? (
          <TemplatesTable />
        ) : (
          <>
            {/* Column headers */}
            <div
              className="grid px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider select-none"
              style={{
                gridTemplateColumns: "2fr 1.5fr 1fr 1fr 1fr 1fr 1fr 1fr 1.5fr",
                color: "var(--text-muted)",
                borderBottom: "1px solid var(--border-subtle)",
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
                  style={{ color: sortField === field ? "#4f46e5" : "var(--text-muted)" }}
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
                        borderBottom: i < displayed.length - 1 ? "1px solid var(--border-subtle)" : "none",
                        textDecoration: "none",
                      }}
                    >
                      {/* Customer */}
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center text-[10px] font-bold text-indigo-600 shrink-0">
                          {a.customerInitials}
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
                borderTop: "1px solid var(--border-subtle)",
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
        )}
      </div>
      )}

      {showBuilder && (
        <AgreementBuilder
          onClose={() => setShowBuilder(false)}
          onCreated={(id) => { setShowBuilder(false); router.push(`/agreements/${id}`); }}
        />
      )}
    </div>
  );
}
