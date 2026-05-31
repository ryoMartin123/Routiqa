"use client";

import { useState } from "react";
import Link from "next/link";
import { Search, Plus, SlidersHorizontal, ChevronUp, ChevronDown, Users, UserPlus, TrendingUp, Building2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { type Customer, type AccountType, type CustomerType, type CustomerStatus } from "@/lib/customers/data";
import { useHierarchy } from "@/components/providers/HierarchyProvider";
import { useCustomers } from "@/components/providers/CustomerProvider";
import NewCustomerModal from "@/components/customers/NewCustomerModal";
import ModuleSummaryCards, { type SummaryCard } from "@/components/shared/ModuleSummaryCards";

const THIS_MONTH = new Date().toLocaleDateString("en-US", { month: "short", year: "numeric" });

// ─── Filter tabs ──────────────────────────────────────────
const TABS = [
  { key: "all",         label: "All",         fn: (_: Customer) => true },
  { key: "customers",   label: "Customers",   fn: (c: Customer) => c.status === "Customer" },
  { key: "prospects",   label: "Prospects",   fn: (c: Customer) => c.status === "Prospect" },
  // Residential = homeowners/renters; Commercial = all business account types
  { key: "residential", label: "Residential", fn: (c: Customer) => c.accountType === "residential" },
  { key: "commercial",  label: "Commercial",  fn: (c: Customer) => c.accountType !== "residential" },
];

// Sub-labels shown under the account name when accountType gives more
// detail than the Residential / Commercial badge already covers.
const ACCOUNT_SUBLABEL: Partial<Record<AccountType, string>> = {
  property_management: "Property Management",
  multi_site:          "Multi-Site",
  other:               "Other",
};

type SortField = "name" | "type" | "status" | "since" | "locationName";

// ─── Badge helpers ────────────────────────────────────────
function typePill(type: CustomerType) {
  return type === "Commercial"
    ? { backgroundColor: "#fef3c7", color: "#92400e" }
    : { backgroundColor: "var(--bg-input)", color: "var(--text-secondary)" };
}

function statusPill(status: CustomerStatus) {
  return status === "Customer"
    ? { backgroundColor: "#d1fae5", color: "#065f46" }
    : { backgroundColor: "#e0e7ff", color: "#3730a3" };
}

// ─── Page ─────────────────────────────────────────────────
export default function CustomersPage() {
  const { effectiveCompanyId, effectiveLocationId, effectiveServiceAreaId } = useHierarchy();
  const { customers } = useCustomers();

  const [modalOpen, setModalOpen] = useState(false);
  const [tab, setTab]             = useState("all");
  const [search, setSearch]   = useState("");
  const [sortField, setSort]  = useState<SortField>("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

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

  const tabFn = TABS.find((t) => t.key === tab)?.fn ?? (() => true);

  // 2. Tab + search + sort
  const displayed = contextFiltered
    .filter(tabFn)
    .filter((c) => {
      if (!search) return true;
      const q = search.toLowerCase();
      return (
        c.name.toLowerCase().includes(q) ||
        c.address.toLowerCase().includes(q) ||
        c.city.toLowerCase().includes(q) ||
        c.phone.includes(q) ||
        (c.email ?? "").toLowerCase().includes(q)
      );
    })
    .sort((a, b) => {
      const av = a[sortField] ?? "";
      const bv = b[sortField] ?? "";
      return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
    });

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
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-semibold" style={{ color: "var(--text-primary)" }}>
              Customers
            </h1>
            <span
              className="text-xs font-bold px-2 py-0.5 rounded-full"
              style={{ backgroundColor: "var(--bg-input)", color: "var(--text-muted)" }}
            >
              {contextFiltered.length}
            </span>
          </div>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>
            All customers, leads, and accounts
          </p>
        </div>
        <button
          onClick={() => setModalOpen(true)}
          className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-3 py-2 rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Customer
        </button>
      </div>

      {/* Summary cards */}
      <div className="mb-5">
        <ModuleSummaryCards cards={summaryCards} moduleKey="customers" />
      </div>

      {/* Table card */}
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
          className="flex items-center justify-between px-4"
          style={{ borderBottom: "1px solid var(--border-subtle)" }}
        >
          <div className="flex items-center gap-0.5">
            {TABS.map((t) => {
              const count = contextFiltered.filter(t.fn).length;
              const active = tab === t.key;
              return (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className="relative flex items-center gap-1.5 px-3 py-3 text-sm font-medium transition-colors"
                  style={{ color: active ? "#4f46e5" : "var(--text-muted)" }}
                >
                  {t.label}
                  <span
                    className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                    style={{
                      backgroundColor: active ? "#e0e7ff" : "var(--bg-input)",
                      color: active ? "#4f46e5" : "var(--text-muted)",
                    }}
                  >
                    {count}
                  </span>
                  {active && <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-t bg-indigo-600" />}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-2 py-2">
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
            <button
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm"
              style={{ border: "1px solid var(--border)", color: "var(--text-secondary)", backgroundColor: "var(--bg-surface)" }}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              Filter
            </button>
          </div>
        </div>

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
                  <span className="inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full" style={typePill(c.type)}>
                    {c.type}
                  </span>
                </div>
                <div>
                  <span className="inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full" style={statusPill(c.status)}>
                    {c.status}
                  </span>
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
      <NewCustomerModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </div>
  );
}
