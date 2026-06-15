"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import Link from "next/link";
import { Search, Plus, SlidersHorizontal, ChevronUp, ChevronDown, Users, UserPlus, TrendingUp, Building2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { type Customer, type AccountType, type CustomerType, type CustomerStatus } from "@/lib/customers/data";
import { getAllAgreements } from "@/lib/agreements/data";
import { useHierarchy } from "@/components/providers/HierarchyProvider";
import { useCustomers } from "@/components/providers/CustomerProvider";
import NewCustomerModal from "@/components/customers/NewCustomerModal";
import PageTitle from "@/components/shared/PageTitle";
import ModuleSummaryCards, { type SummaryCard } from "@/components/shared/ModuleSummaryCards";
import StatusTabs from "@/components/shared/StatusTabs";
import StatusBadge from "@/components/shared/StatusBadge";
import ModuleViewToggle, { type ModuleView } from "@/components/shared/ModuleViewToggle";
import Select from "@/components/ui/Select";

const THIS_MONTH = new Date().toLocaleDateString("en-US", { month: "short", year: "numeric" });

// ─── Filter tabs ──────────────────────────────────────────
// Grouped with bar separators: who-they-are · | · type · | · agreements.
const TABS: { key: string; label: string; fn: (c: Customer) => boolean; dividerBefore?: boolean }[] = [
  { key: "all",         label: "All",         fn: () => true },
  { key: "customers",   label: "Customers",   fn: (c) => c.status === "Customer" },
  { key: "prospects",   label: "Prospects",   fn: (c) => c.status === "Prospect" },
  // Residential = homeowners/renters; Commercial = all business account types
  { key: "residential", label: "Residential", fn: (c) => c.accountType === "residential", dividerBefore: true },
  { key: "commercial",  label: "Commercial",  fn: (c) => c.accountType !== "residential" },
];

const DATE_RANGES = [
  { value: "all",   label: "Any time" },
  { value: "month", label: "This month" },
  { value: "12mo",  label: "Last 12 months" },
  { value: "year",  label: "This year" },
];
function withinSince(since: string, range: string): boolean {
  if (range === "all") return true;
  const d = new Date(since);
  if (isNaN(d.getTime())) return true;
  const now = new Date();
  if (range === "month") return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  if (range === "year")  return d.getFullYear() === now.getFullYear();
  if (range === "12mo")  return now.getTime() - d.getTime() <= 365 * 86_400_000;
  return true;
}

// Sub-labels shown under the account name when accountType gives more
// detail than the Residential / Commercial badge already covers.
const ACCOUNT_SUBLABEL: Partial<Record<AccountType, string>> = {
  property_management: "Property Management",
  multi_site:          "Multi-Site",
  other:               "Other",
};

type SortField = "name" | "type" | "status" | "since" | "locationName";

// ─── Badge helpers ────────────────────────────────────────
// Saturated dot colors for the shared StatusBadge (dot + text) indicator,
// matching the customer detail page.
function typeDot(type: CustomerType) {
  return type === "Commercial" ? "#f59e0b" : "#6b7280";
}
function statusDot(status: CustomerStatus) {
  return status === "Customer" ? "#10b981" : "#6366f1";
}

// ─── Page ─────────────────────────────────────────────────
export default function CustomersPage() {
  const { effectiveCompanyId, effectiveLocationId, effectiveServiceAreaId } = useHierarchy();
  const { customers } = useCustomers();

  const [modalOpen, setModalOpen] = useState(false);
  const [tab, setTab]             = useState("all");
  const [moduleView, setModuleView] = useState<ModuleView>("list");
  const [search, setSearch]   = useState("");
  const [sortField, setSort]  = useState<SortField>("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  // Advanced filters (the Filter popover) — combinable with the active tab.
  const [fStatus, setFStatus] = useState<"all" | CustomerStatus>("all");
  const [fType, setFType]     = useState<"all" | CustomerType>("all");
  const [fDate, setFDate]     = useState("all");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const filtersRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!filtersOpen) return;
    const onDown = (e: MouseEvent) => { if (filtersRef.current && !filtersRef.current.contains(e.target as Node)) setFiltersOpen(false); };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [filtersOpen]);

  // Customers that have at least one agreement (matched by id or name).
  const withAgreement = useMemo(() => {
    const ids = new Set<string>(); const names = new Set<string>();
    for (const a of getAllAgreements()) { if (a.customerId) ids.add(a.customerId); if (a.customer) names.add(a.customer); }
    return (c: Customer) => ids.has(c.id) || names.has(c.name);
  }, [customers]);

  // 1. Context filter — scope from the hierarchy selector
  const contextFiltered = customers
    .filter(c => !effectiveCompanyId    || c.companyId    === effectiveCompanyId)
    .filter(c => !effectiveLocationId   || c.locationId   === effectiveLocationId)
    .filter(c => !effectiveServiceAreaId || c.serviceAreaId === effectiveServiceAreaId);

  // Summary metrics — respect the active context (computed from contextFiltered)
  const totalCustomers = contextFiltered.filter(c => c.status === "Customer").length;
  const newThisMonth   = contextFiltered.filter(c => c.since === THIS_MONTH).length;
  const activeLeads    = contextFiltered.filter(c => c.status === "Prospect").length;
  const commercial     = contextFiltered.filter(c => c.accountType !== "residential").length;
  const residential    = contextFiltered.filter(c => c.accountType === "residential").length;

  const summaryCards: SummaryCard[] = [
    { icon: Users,      label: "Total Customers", value: String(totalCustomers), sub: "Active accounts",            iconColor: "#4f46e5" },
    { icon: UserPlus,   label: "New This Month",  value: String(newThisMonth),   sub: THIS_MONTH,                   iconColor: "#10b981" },
    { icon: TrendingUp, label: "Active Leads",    value: String(activeLeads),    sub: "In pipeline",                iconColor: "#f59e0b" },
    { icon: Building2,  label: "Comm / Res Split",value: `${commercial} / ${residential}`, sub: "Commercial / Residential", iconColor: "#0891b2" },
  ];

  const tabFn = tab === "agreements" ? withAgreement : (TABS.find((t) => t.key === tab)?.fn ?? (() => true));

  // 2. Tab + advanced filters + search + sort
  const displayed = contextFiltered
    .filter(tabFn)
    .filter((c) => fStatus === "all" || c.status === fStatus)
    .filter((c) => fType   === "all" || c.type   === fType)
    .filter((c) => withinSince(c.since, fDate))
    .filter((c) => {
      if (!search) return true;
      const q = search.toLowerCase();
      const has = (v?: string) => (v ?? "").toLowerCase().includes(q);
      return has(c.name) || has(c.address) || has(c.city) || has(c.phone) || has(c.email);
    })
    .sort((a, b) => {
      const av = String(a[sortField] ?? "");
      const bv = String(b[sortField] ?? "");
      return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
    });

  const activeFilters = (fStatus !== "all" ? 1 : 0) + (fType !== "all" ? 1 : 0) + (fDate !== "all" ? 1 : 0);
  function clearFilters() { setFStatus("all"); setFType("all"); setFDate("all"); }

  function handleSort(field: SortField) {
    if (sortField === field) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSort(field); setSortDir("asc"); }
  }

  function SortIcon({ field }: { field: SortField }) {
    if (sortField !== field) return <ChevronDown className="w-3 h-3 opacity-30" />;
    return sortDir === "asc"
      ? <ChevronUp   className="w-3 h-3" style={{ color: "#4f46e5" }} />
      : <ChevronDown className="w-3 h-3" style={{ color: "#4f46e5" }} />;
  }

  return (
    <div className="p-6">
      {/* Header — title · centered view toggle · action */}
      <div className="flex items-center gap-4 mb-6">
        <div className="flex-1 min-w-0">
          <PageTitle title="Customers" count={contextFiltered.length} description="All customers, leads, and accounts" />
        </div>
        <ModuleViewToggle view={moduleView} onChange={setModuleView} />
        <div className="flex-1 flex justify-end gap-2">
          <button
            onClick={() => setModalOpen(true)}
            className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-3 py-2 rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Customer
          </button>
        </div>
      </div>

      {moduleView === "overview" && (
        <div className="mb-5">
          <ModuleSummaryCards cards={summaryCards} />
        </div>
      )}

      {/* Table card */}
      {moduleView === "list" && (
      <>
        {/* Toolbar — tabs · search · filter. Lives OUTSIDE the table card so the
            filter popover isn't clipped by the card's overflow. */}
        <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
          <StatusTabs active={tab} onChange={setTab}
            tabs={[
              ...TABS.map(t => ({ key: t.key, label: t.label, count: contextFiltered.filter(t.fn).length, dividerBefore: t.dividerBefore })),
              { key: "agreements", label: "Agreements", count: contextFiltered.filter(withAgreement).length, dividerBefore: true },
            ]} />

          <div className="flex items-center gap-2">
            <div
              className="flex items-center gap-2 rounded-lg px-3 py-1.5"
              style={{ backgroundColor: "var(--bg-input)" }}
            >
              <Search className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--text-muted)" }} />
              <input
                type="text"
                placeholder="Search customers..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="bg-transparent text-sm outline-none w-44 min-w-0"
                style={{ color: "var(--text-primary)" }}
              />
            </div>
            <div className="relative" ref={filtersRef}>
              <button
                onClick={() => setFiltersOpen(o => !o)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors"
                style={{
                  border: `1px solid ${activeFilters > 0 || filtersOpen ? "var(--accent-soft-border)" : "var(--border)"}`,
                  backgroundColor: activeFilters > 0 ? "var(--accent-soft-bg)" : "var(--bg-surface)",
                  color: activeFilters > 0 ? "var(--accent-text)" : "var(--text-secondary)",
                }}
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                Filter
                {activeFilters > 0 && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ backgroundColor: "var(--accent-soft-2-bg)", color: "var(--accent-text)" }}>{activeFilters}</span>
                )}
              </button>
              {filtersOpen && (
                <div className="absolute right-0 top-full mt-2 z-50 rounded-xl p-4 w-72"
                  style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "0 12px 32px rgba(0,0,0,0.18)" }}>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Filters</p>
                    {activeFilters > 0 && <button onClick={clearFilters} className="text-xs" style={{ color: "var(--accent-text)" }}>Clear all</button>}
                  </div>
                  <div className="space-y-2.5">
                    <FilterField label="Customer / Prospect">
                      <Select size="sm" value={fStatus} onChange={v => setFStatus(v as "all" | CustomerStatus)}
                        options={[{ value: "all", label: "All" }, { value: "Customer", label: "Customers" }, { value: "Prospect", label: "Prospects" }]} />
                    </FilterField>
                    <FilterField label="Customer Type">
                      <Select size="sm" value={fType} onChange={v => setFType(v as "all" | CustomerType)}
                        options={[{ value: "all", label: "All Types" }, { value: "Residential", label: "Residential" }, { value: "Commercial", label: "Commercial" }]} />
                    </FilterField>
                    <FilterField label="Customer Since">
                      <Select size="sm" value={fDate} onChange={setFDate} options={DATE_RANGES} />
                    </FilterField>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="rounded-xl overflow-hidden" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-subtle)", boxShadow: "var(--shadow-card)" }}>
        {/* Column headers */}
        <div
          className="grid px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider select-none"
          style={{
            gridTemplateColumns: "2fr 1fr 1fr 2.5fr 1fr 1fr",
            color: "var(--text-muted)",
            borderBottom: "1px solid var(--border-subtle)",
            backgroundColor: "var(--bg-surface-2)",
          }}
        >
          {(
            [
              { label: "Name",     field: "name"         },
              { label: "Type",     field: "type"         },
              { label: "Status",   field: "status"       },
              { label: "Address",  field: null           },
              { label: "Phone",    field: null           },
              { label: "Since",    field: "since"        },
            ] as const
          ).map(({ label, field }) => (
            <button
              key={label}
              onClick={() => field && handleSort(field as SortField)}
              className={cn("flex items-center gap-1 text-left", field ? "cursor-pointer hover:opacity-80" : "cursor-default")}
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
                No customers match the current context or search.
              </p>
            </div>
          ) : (
            displayed.map((c, i) => (
              <Link
                key={c.id}
                href={`/customers/${c.id}`}
                className="grid px-4 py-3 transition-colors hover:bg-[var(--bg-surface-2)] items-center"
                style={{
                  gridTemplateColumns: "2fr 1fr 1fr 2.5fr 1fr 1fr",
                  borderBottom: i < displayed.length - 1 ? "1px solid var(--border-subtle)" : "none",
                  textDecoration: "none",
                }}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center text-[10px] font-bold text-indigo-600 shrink-0">
                    {c.initials}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>{c.name}</p>
                    <p className="text-[10px] truncate" style={{ color: "var(--text-muted)" }}>
                      {ACCOUNT_SUBLABEL[c.accountType]
                        ? `${ACCOUNT_SUBLABEL[c.accountType]} · ${c.locationName}`
                        : c.locationName}
                    </p>
                  </div>
                </div>
                <div>
                  <StatusBadge label={c.type} color={typeDot(c.type)} />
                </div>
                <div>
                  <StatusBadge label={c.status} color={statusDot(c.status)} />
                </div>
                <span className="text-sm truncate" style={{ color: "var(--text-secondary)" }}>
                  {c.address}, {c.city}, {c.state}
                </span>
                <span className="text-sm" style={{ color: "var(--text-secondary)" }}>{c.phone}</span>
                <span className="text-sm" style={{ color: "var(--text-muted)" }}>{c.since}</span>
              </Link>
            ))
          )}
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-between px-4 py-3 text-xs"
          style={{ borderTop: "1px solid var(--border-subtle)", color: "var(--text-muted)", backgroundColor: "var(--bg-surface-2)" }}
        >
          <span>Showing {displayed.length} of {contextFiltered.filter(tabFn).length} records</span>
          <div className="flex items-center gap-1">
            <button className="px-2 py-1 rounded" style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}>← Prev</button>
            <button className="px-2 py-1 rounded" style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}>Next →</button>
          </div>
        </div>
      </div>
      </>
      )}
      <NewCustomerModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </div>
  );
}

// ─── Filter field (label + control, used in the Filters popover) ──
function FilterField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: "var(--text-muted)" }}>
        {label}
      </label>
      {children}
    </div>
  );
}
