"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { Package, Plus, Search, Layers, LayoutList, EyeOff, SlidersHorizontal } from "lucide-react";
import { useHierarchy } from "@/components/providers/HierarchyProvider";
import UiSelect from "@/components/ui/Select";
import ItemFormDrawer from "@/components/items/ItemFormDrawer";
import IndustryCatalogModal from "@/components/items/IndustryCatalogModal";
import { getAllItems, getActiveCategoryNames, fmt, type Item } from "@/lib/items/data";
import { ITEM_TYPES, ITEM_TYPE_CONFIG, type ItemType } from "@/lib/items/types";

const GRID = "2.2fr 1fr 1.2fr 0.9fr 0.7fr 0.7fr 0.8fr 44px";

type Tab = "all" | "categories" | "packages" | "inactive";

function ItemRow({ it, last, onClick }: { it: Item; last: boolean; onClick: () => void }) {
  const tc = ITEM_TYPE_CONFIG[it.type];
  return (
    <div onClick={onClick}
      className="grid px-4 py-3 items-center cursor-pointer hover:bg-[var(--bg-surface-2)] transition-colors"
      style={{ gridTemplateColumns: GRID, borderBottom: last ? "none" : "1px solid var(--border-subtle)", opacity: it.active ? 1 : 0.55 }}>
      <div className="min-w-0 pr-2">
        <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>{it.name}</p>
        <p className="text-[10px] truncate" style={{ color: "var(--text-muted)" }}>{it.sku ? `${it.sku} · ` : ""}{it.description ?? ""}</p>
      </div>
      <span className="inline-block w-fit text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: tc.bg, color: tc.color }}>{tc.label}</span>
      <span className="text-xs truncate pr-2" style={{ color: "var(--text-secondary)" }}>{it.category}</span>
      <span className="text-sm font-semibold text-right" style={{ color: it.unitPrice < 0 ? "#dc2626" : "var(--text-primary)" }}>{fmt(it.unitPrice)}</span>
      <span className="text-center text-xs" style={{ color: it.taxable ? "var(--text-secondary)" : "var(--text-muted)" }}>{it.taxable ? "Yes" : "No"}</span>
      <span className="text-center text-xs" style={{ color: "var(--text-secondary)" }}>{it.defaultQuantity}</span>
      <span className="inline-block w-fit text-[10px] font-semibold px-2 py-0.5 rounded-full"
        style={{ backgroundColor: it.active ? "#d1fae5" : "var(--bg-input)", color: it.active ? "#065f46" : "var(--text-muted)" }}>{it.active ? "Active" : "Inactive"}</span>
      <span className="text-[10px] justify-self-end" style={{ color: "var(--text-muted)" }}>Edit</span>
    </div>
  );
}

export default function ItemsPage() {
  const { effectiveCompanyId, effectiveLocationId } = useHierarchy();

  const [items, setItems] = useState<Item[]>([]);
  const [refresh, setRefresh] = useState(0);
  const [tab, setTab] = useState<Tab>("all");
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | ItemType>("all");
  const [catFilter, setCatFilter] = useState<string>("all");
  const [drawer, setDrawer] = useState<{ open: boolean; item?: Item }>({ open: false });
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const filtersRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setItems(getAllItems()); }, [refresh]);
  useEffect(() => {
    if (!filtersOpen) return;
    const onDown = (e: MouseEvent) => { if (filtersRef.current && !filtersRef.current.contains(e.target as Node)) setFiltersOpen(false); };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [filtersOpen]);
  const categories = useMemo(() => getActiveCategoryNames(), [refresh]);

  const contextItems = items
    .filter(i => !effectiveCompanyId  || i.companyId  === effectiveCompanyId)
    .filter(i => !effectiveLocationId || !i.locationId || i.locationId === effectiveLocationId);

  const matchesSearch = (i: Item) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return i.name.toLowerCase().includes(s) || (i.sku ?? "").toLowerCase().includes(s) || (i.description ?? "").toLowerCase().includes(s);
  };

  // Rows for the table-style tabs
  const tableItems = contextItems
    .filter(i => tab !== "packages" || i.type === "package")
    .filter(i => tab !== "inactive" || !i.active)
    .filter(i => typeFilter === "all" || i.type === typeFilter)
    .filter(i => catFilter === "all" || i.category === catFilter)
    .filter(matchesSearch);

  const activeFilterCount = (typeFilter !== "all" ? 1 : 0) + (catFilter !== "all" ? 1 : 0);

  // Grouped data for the Categories tab
  const grouped = useMemo(() => {
    const m = new Map<string, Item[]>();
    contextItems.filter(matchesSearch).forEach(i => { const a = m.get(i.category) ?? []; a.push(i); m.set(i.category, a); });
    const order = [...categories, ...[...m.keys()].filter(k => !categories.includes(k))];
    return order.filter(c => m.has(c)).map(c => ({ category: c, items: m.get(c)! }));
  }, [contextItems, categories, search]); // eslint-disable-line react-hooks/exhaustive-deps

  const counts = {
    all: contextItems.length,
    categories: categories.length,
    packages: contextItems.filter(i => i.type === "package").length,
    inactive: contextItems.filter(i => !i.active).length,
  };
  const TABS: { key: Tab; label: string; icon: typeof LayoutList }[] = [
    { key: "all", label: "All Items", icon: LayoutList }, { key: "categories", label: "Categories", icon: Layers },
    { key: "packages", label: "Packages", icon: Package }, { key: "inactive", label: "Inactive", icon: EyeOff },
  ];

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-semibold" style={{ color: "var(--text-primary)" }}>Items &amp; Services</h1>
            <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: "var(--bg-input)", color: "var(--text-muted)" }}>{contextItems.length}</span>
          </div>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>Reusable catalog items for quotes and invoices</p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button onClick={() => setCatalogOpen(true)}
            className="flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-lg transition-colors"
            style={{ border: "1px solid var(--border)", color: "var(--text-secondary)", backgroundColor: "var(--bg-surface)" }}>
            <Layers className="w-4 h-4" /> Starter Catalog
          </button>
          <button onClick={() => setDrawer({ open: true })}
            className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-3 py-2 rounded-lg transition-colors">
            <Plus className="w-4 h-4" /> Add Item
          </button>
        </div>
      </div>

      {/* Table card */}
      <div className="rounded-xl overflow-hidden" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-subtle)", boxShadow: "var(--shadow-card)" }}>
        {/* Pill tabs (left) + search & filter (right) */}
        <div className="flex items-center justify-between flex-wrap gap-2 px-4 py-3" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
          <div className="flex items-center gap-0.5 flex-wrap">
            {TABS.map(t => {
              const active = tab === t.key;
              return (
                <button key={t.key} onClick={() => setTab(t.key)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
                  style={{ backgroundColor: active ? "var(--accent-soft-bg)" : "transparent", color: active ? "var(--accent-text)" : "var(--text-muted)", border: `1px solid ${active ? "var(--accent-soft-border)" : "transparent"}` }}>
                  <t.icon className="w-3.5 h-3.5" /> {t.label}
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ backgroundColor: active ? "var(--accent-soft-2-bg)" : "var(--bg-input)", color: active ? "var(--accent-text)" : "var(--text-muted)" }}>{counts[t.key]}</span>
                </button>
              );
            })}
          </div>
          <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 rounded-lg px-3 py-1.5" style={{ backgroundColor: "var(--bg-input)" }}>
            <Search className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--text-muted)" }} />
            <input type="text" placeholder="Search items, SKU…" value={search} onChange={e => setSearch(e.target.value)}
              className="bg-transparent text-sm outline-none w-44" style={{ color: "var(--text-primary)" }} />
          </div>
          <div className="relative" ref={filtersRef}>
            <button onClick={() => setFiltersOpen(o => !o)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors"
              style={{ border: "1px solid var(--border)", color: activeFilterCount > 0 ? "#4f46e5" : "var(--text-secondary)", backgroundColor: "var(--bg-surface)" }}>
              <SlidersHorizontal className="w-3.5 h-3.5" /> Filter
              {activeFilterCount > 0 && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ backgroundColor: "#e0e7ff", color: "#4f46e5" }}>{activeFilterCount}</span>}
            </button>
            {filtersOpen && (
              <div className="absolute right-0 top-full mt-1 w-64 rounded-xl p-3 z-20 space-y-3" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "0 8px 24px rgba(0,0,0,0.16)" }}>
                <div>
                  <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: "var(--text-muted)" }}>Type</label>
                  <UiSelect value={typeFilter} onChange={v => setTypeFilter(v as "all" | ItemType)} size="sm"
                    options={[{ value: "all", label: "All Types" }, ...ITEM_TYPES.map(t => ({ value: t, label: ITEM_TYPE_CONFIG[t].label }))]} />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: "var(--text-muted)" }}>Category</label>
                  <UiSelect value={catFilter} onChange={setCatFilter} size="sm"
                    options={[{ value: "all", label: "All Categories" }, ...categories.map(c => ({ value: c, label: c }))]} />
                </div>
                {activeFilterCount > 0 && (
                  <button onClick={() => { setTypeFilter("all"); setCatFilter("all"); }} className="text-xs font-medium" style={{ color: "#4f46e5" }}>Clear filters</button>
                )}
              </div>
            )}
          </div>
          </div>
        </div>

        {/* ── Categories tab ── */}
        {tab === "categories" ? (
          grouped.length === 0 ? (
            <div className="py-16 text-center"><p className="text-sm" style={{ color: "var(--text-muted)" }}>No items yet.</p></div>
          ) : (
            <div className="p-4 space-y-4">
              {grouped.map(g => (
                <div key={g.category} className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--border-subtle)" }}>
                  <div className="flex items-center justify-between px-4 py-2.5" style={{ backgroundColor: "var(--bg-surface-2)", borderBottom: "1px solid var(--border-subtle)" }}>
                    <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{g.category}</p>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ backgroundColor: "var(--bg-input)", color: "var(--text-muted)" }}>{g.items.length}</span>
                  </div>
                  {g.items.map((it, i) => {
                    const tc = ITEM_TYPE_CONFIG[it.type];
                    return (
                      <div key={it.id} onClick={() => setDrawer({ open: true, item: it })}
                        className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-[var(--bg-surface-2)] transition-colors"
                        style={{ borderBottom: i < g.items.length - 1 ? "1px solid var(--border-subtle)" : "none", opacity: it.active ? 1 : 0.55 }}>
                        <span className="text-sm flex-1 truncate" style={{ color: "var(--text-primary)" }}>{it.name}</span>
                        <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full shrink-0" style={{ backgroundColor: tc.bg, color: tc.color }}>{tc.label}</span>
                        {!it.active && <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full shrink-0" style={{ backgroundColor: "var(--bg-input)", color: "var(--text-muted)" }}>Inactive</span>}
                        <span className="text-sm font-medium w-20 text-right shrink-0" style={{ color: it.unitPrice < 0 ? "#dc2626" : "var(--text-primary)" }}>{fmt(it.unitPrice)}</span>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          )
        ) : (
          <>
            {/* Column headers */}
            <div className="grid px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider" style={{ gridTemplateColumns: GRID, color: "var(--text-muted)", borderBottom: "1px solid var(--border-subtle)", backgroundColor: "var(--bg-surface-2)" }}>
              <span>Item</span><span>Type</span><span>Category</span><span className="text-right">Unit Price</span><span className="text-center">Taxable</span><span className="text-center">Qty</span><span>Status</span><span />
            </div>
            {tableItems.length === 0 ? (
              <div className="py-16 text-center"><p className="text-sm" style={{ color: "var(--text-muted)" }}>No items match the current filters.</p></div>
            ) : tableItems.map((it, i) => (
              <ItemRow key={it.id} it={it} last={i === tableItems.length - 1} onClick={() => setDrawer({ open: true, item: it })} />
            ))}
          </>
        )}

        <div className="flex items-center justify-between px-4 py-3 text-xs" style={{ borderTop: "1px solid var(--border-subtle)", color: "var(--text-muted)", backgroundColor: "var(--bg-surface-2)" }}>
          <span>{tab === "categories" ? `${grouped.length} categories` : `Showing ${tableItems.length} of ${contextItems.length} items`}</span>
        </div>
      </div>

      {drawer.open && (
        <ItemFormDrawer item={drawer.item}
          onClose={() => setDrawer({ open: false })}
          onSaved={() => { setDrawer({ open: false }); setRefresh(n => n + 1); }} />
      )}
      {catalogOpen && (
        <IndustryCatalogModal onClose={() => setCatalogOpen(false)}
          onApplied={() => { setCatalogOpen(false); setRefresh(n => n + 1); }} />
      )}
    </div>
  );
}
