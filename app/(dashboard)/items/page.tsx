"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { Plus, Search, Layers, SlidersHorizontal, Boxes, X } from "lucide-react";
import { getInventoryItems, type InventoryItem } from "@/lib/inventory/data";
import type { ItemPreset } from "@/components/items/ItemFormDrawer";
import { useHierarchy } from "@/components/providers/HierarchyProvider";
import PageTitle from "@/components/shared/PageTitle";
import StatusBadge from "@/components/shared/StatusBadge";
import UiSelect from "@/components/ui/Select";
import ItemFormDrawer from "@/components/items/ItemFormDrawer";
import IndustryCatalogModal from "@/components/items/IndustryCatalogModal";
import { getAllItems, getActiveCategoryNames, fmt, type Item } from "@/lib/items/data";
import { ITEM_TYPES, ITEM_TYPE_CONFIG, type ItemType } from "@/lib/items/types";
import Commentable from "@/components/comments/Commentable";

const GRID = "2.2fr 1fr 1.2fr 0.9fr 0.7fr 0.7fr 0.8fr 44px";

type Tab = "all" | "categories" | "packages" | "inactive";

function ItemRow({ it, last, onClick }: { it: Item; last: boolean; onClick: () => void }) {
  const tc = ITEM_TYPE_CONFIG[it.type];
  return (
    <div onClick={onClick}
      className="grid px-4 py-3 items-center cursor-pointer hover:bg-[var(--bg-surface-2)] transition-colors"
      style={{ gridTemplateColumns: GRID, borderBottom: last ? "none" : "1px solid var(--border)", opacity: it.active ? 1 : 0.55 }}>
      <div className="min-w-0 pr-2">
        <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>{it.name}</p>
        <p className="text-[10px] truncate" style={{ color: "var(--text-muted)" }}>{it.sku ? `${it.sku} · ` : ""}{it.components?.length ? `Bundle · ${it.components.length} components · ` : ""}{it.description ?? ""}</p>
      </div>
      <StatusBadge label={tc.label} color={tc.color} />
      <span className="text-xs truncate pr-2" style={{ color: "var(--text-secondary)" }}>{it.category}</span>
      <span className="text-sm font-semibold text-right" style={{ color: it.unitPrice < 0 ? "#dc2626" : "var(--text-primary)" }}>{fmt(it.unitPrice)}</span>
      <span className="text-center text-xs" style={{ color: it.taxable ? "var(--text-secondary)" : "var(--text-muted)" }}>{it.taxable ? "Yes" : "No"}</span>
      <span className="text-center text-xs" style={{ color: "var(--text-secondary)" }}>{it.defaultQuantity}</span>
      <StatusBadge label={it.active ? "Active" : "Inactive"} color={it.active ? "#10b981" : "#9ca3af"} />
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
  const [drawer, setDrawer] = useState<{ open: boolean; item?: Item; preset?: ItemPreset }>({ open: false });
  const [invPickOpen, setInvPickOpen] = useState(false);
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
  const TABS: { key: Tab; label: string }[] = [
    { key: "all", label: "All Items" }, { key: "categories", label: "Categories" },
    { key: "packages", label: "Packages" }, { key: "inactive", label: "Inactive" },
  ];

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <div className="flex-1 min-w-0">
          <PageTitle title="Items & Services" count={contextItems.length} description="Reusable catalog items for quotes and invoices" />
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button onClick={() => setCatalogOpen(true)}
            className="flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-lg transition-colors"
            style={{ border: "1px solid var(--border)", color: "var(--text-secondary)", backgroundColor: "var(--bg-surface)" }}>
            <Layers className="w-4 h-4" /> Starter Catalog
          </button>
          <button onClick={() => setInvPickOpen(true)}
            className="flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-lg transition-colors"
            style={{ border: "1px solid var(--border)", color: "var(--text-secondary)", backgroundColor: "var(--bg-surface)" }}>
            <Boxes className="w-4 h-4" /> From Inventory
          </button>
          <button onClick={() => setDrawer({ open: true })}
            className="flex items-center gap-1.5 bg-[#0f8578] hover:bg-[#0c6b60] text-white text-sm font-medium px-3 py-2 rounded-lg transition-colors">
            <Plus className="w-4 h-4" /> Add Item
          </button>
        </div>
      </div>

      {/* Toolbar — pill tabs · search · filter, OUTSIDE the table card (consistent with Customers/Leads) */}
      <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
          <div className="flex items-center gap-0.5 flex-wrap">
            {TABS.map(t => {
              const active = tab === t.key;
              return (
                <button key={t.key} onClick={() => setTab(t.key)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
                  style={{ backgroundColor: active ? "var(--accent-soft-bg)" : "transparent", color: active ? "var(--accent-text)" : "var(--text-muted)", border: `1px solid ${active ? "var(--accent-soft-border)" : "transparent"}` }}>
                  {t.label}
                  <span className="text-xs tabular-nums" style={{ color: active ? "var(--accent-text)" : "var(--text-muted)", opacity: 0.7 }}>{counts[t.key]}</span>
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
              style={{ border: "1px solid var(--border)", color: activeFilterCount > 0 ? "#0f8578" : "var(--text-secondary)", backgroundColor: "var(--bg-surface)" }}>
              <SlidersHorizontal className="w-3.5 h-3.5" /> Filter
              {activeFilterCount > 0 && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ backgroundColor: "#d3ebe6", color: "#0f8578" }}>{activeFilterCount}</span>}
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
                  <button onClick={() => { setTypeFilter("all"); setCatFilter("all"); }} className="text-xs font-medium" style={{ color: "#0f8578" }}>Clear filters</button>
                )}
              </div>
            )}
          </div>
          </div>
        </div>

      {/* Table card */}
      <div className="rounded-xl overflow-hidden" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" }}>
        {/* ── Categories tab ── */}
        {tab === "categories" ? (
          grouped.length === 0 ? (
            <div className="py-16 text-center"><p className="text-sm" style={{ color: "var(--text-muted)" }}>No items yet.</p></div>
          ) : (
            <div className="p-4 space-y-4">
              {grouped.map(g => (
                <div key={g.category} className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
                  <div className="flex items-center justify-between px-4 py-2.5" style={{ backgroundColor: "var(--bg-surface-2)", borderBottom: "1px solid var(--border)" }}>
                    <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{g.category}</p>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ backgroundColor: "var(--bg-input)", color: "var(--text-muted)" }}>{g.items.length}</span>
                  </div>
                  {g.items.map((it, i) => {
                    const tc = ITEM_TYPE_CONFIG[it.type];
                    return (
                      <Commentable key={it.id} inset anchor={{ recordType: "item", recordId: it.id, recordLabel: it.name }}>
                      <div onClick={() => setDrawer({ open: true, item: it })}
                        className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-[var(--bg-surface-2)] transition-colors"
                        style={{ borderBottom: i < g.items.length - 1 ? "1px solid var(--border)" : "none", opacity: it.active ? 1 : 0.55 }}>
                        <span className="text-sm flex-1 truncate" style={{ color: "var(--text-primary)" }}>{it.name}</span>
                        <StatusBadge label={tc.label} color={tc.color} size="sm" className="shrink-0" />
                        {!it.active && <StatusBadge label="Inactive" color="#9ca3af" size="sm" className="shrink-0" />}
                        <span className="text-sm font-medium w-20 text-right shrink-0" style={{ color: it.unitPrice < 0 ? "#dc2626" : "var(--text-primary)" }}>{fmt(it.unitPrice)}</span>
                      </div>
                      </Commentable>
                    );
                  })}
                </div>
              ))}
            </div>
          )
        ) : (
          <>
            {/* Column headers */}
            <div className="grid px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider" style={{ gridTemplateColumns: GRID, color: "var(--text-muted)", borderBottom: "1px solid var(--border)", backgroundColor: "transparent" }}>
              <span>Item</span><span>Type</span><span>Category</span><span className="text-right">Unit Price</span><span className="text-center">Taxable</span><span className="text-center">Qty</span><span>Status</span><span />
            </div>
            {tableItems.length === 0 ? (
              <div className="py-16 text-center"><p className="text-sm" style={{ color: "var(--text-muted)" }}>No items match the current filters.</p></div>
            ) : tableItems.map((it, i) => (
              <Commentable key={it.id} inset anchor={{ recordType: "item", recordId: it.id, recordLabel: it.name }}>
                <ItemRow it={it} last={i === tableItems.length - 1} onClick={() => setDrawer({ open: true, item: it })} />
              </Commentable>
            ))}
          </>
        )}

        <div className="flex items-center justify-between px-4 py-3 text-xs" style={{ borderTop: "1px solid var(--border)", color: "var(--text-muted)", backgroundColor: "transparent" }}>
          <span>{tab === "categories" ? `${grouped.length} categories` : `Showing ${tableItems.length} of ${contextItems.length} items`}</span>
        </div>
      </div>

      {drawer.open && (
        <ItemFormDrawer item={drawer.item} preset={drawer.preset}
          onClose={() => setDrawer({ open: false })}
          onSaved={() => { setDrawer({ open: false }); setRefresh(n => n + 1); }} />
      )}
      {invPickOpen && (
        <InventoryPickModal existing={items}
          onClose={() => setInvPickOpen(false)}
          onPick={inv => {
            setInvPickOpen(false);
            setDrawer({ open: true, preset: {
              name: inv.name, sku: inv.sku,
              type: inv.category === "Equipment" ? "equipment" : "material",
              category: inv.category,
              unitPrice: inv.sellPrice ?? 0, unitCost: inv.cost ?? 0,
              inventoryItemId: inv.id,
            } });
          }} />
      )}
      {catalogOpen && (
        <IndustryCatalogModal onClose={() => setCatalogOpen(false)}
          onApplied={() => { setCatalogOpen(false); setRefresh(n => n + 1); }} />
      )}
    </div>
  );
}

// ─── New item from inventory — pick a stock record to sell ──
// Prefills the item form from the inventory record and keeps the link, so cost
// and price drift is surfaced on the item later (never auto-synced).
function InventoryPickModal({ existing, onClose, onPick }: {
  existing: Item[]; onClose: () => void; onPick: (inv: InventoryItem) => void;
}) {
  const [q, setQ] = useState("");
  const inventory = useMemo(() => getInventoryItems(), []);
  const linked = useMemo(() => new Set(existing.map(i => i.inventoryItemId).filter(Boolean)), [existing]);
  const filtered = inventory.filter(i => {
    if (!q) return true;
    const s = q.toLowerCase();
    return i.name.toLowerCase().includes(s) || i.sku.toLowerCase().includes(s) || (i.category ?? "").toLowerCase().includes(s);
  });
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-lg max-h-[85vh] flex flex-col rounded-2xl overflow-hidden" onClick={e => e.stopPropagation()}
        style={{ backgroundColor: "var(--bg-surface)", boxShadow: "0 16px 48px rgba(0,0,0,0.24)" }}>
        <div className="flex items-center gap-2.5 px-5 py-4 shrink-0" style={{ borderBottom: "1px solid var(--border)" }}>
          <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: "var(--accent-soft-bg)" }}>
            <Boxes className="w-4 h-4" style={{ color: "var(--accent-text)" }} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>New Item from Inventory</p>
            <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>Pick a stock record — name, SKU, cost &amp; price prefill and stay linked.</p>
          </div>
          <button onClick={onClose} style={{ color: "var(--text-muted)" }}><X className="w-4 h-4" /></button>
        </div>
        <div className="px-5 py-3 shrink-0" style={{ borderBottom: "1px solid var(--border)" }}>
          <div className="flex items-center gap-2 rounded-lg px-3 py-1.5" style={{ backgroundColor: "var(--bg-input)" }}>
            <Search className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--text-muted)" }} />
            <input autoFocus placeholder="Search inventory…" value={q} onChange={e => setQ(e.target.value)}
              className="bg-transparent text-sm outline-none w-full" style={{ color: "var(--text-primary)" }} />
          </div>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto thin-scroll-y p-2">
          {filtered.length === 0 ? (
            <p className="text-xs text-center py-8" style={{ color: "var(--text-muted)" }}>No inventory records match.</p>
          ) : filtered.map(inv => {
            const already = linked.has(inv.id);
            return (
              <button key={inv.id} onClick={() => onPick(inv)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors hover:bg-[var(--bg-surface-2)]">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>{inv.name}</p>
                  <p className="text-[10px] truncate" style={{ color: "var(--text-muted)" }}>{inv.sku} · {inv.category} · {inv.qtyOnHand ?? 0} on hand{inv.vendor ? ` · ${inv.vendor}` : ""}</p>
                </div>
                {already && <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full shrink-0" style={{ backgroundColor: "var(--bg-input)", color: "var(--text-muted)" }}>Linked</span>}
                <div className="text-right shrink-0">
                  <p className="text-sm font-semibold tabular-nums" style={{ color: "var(--text-primary)" }}>{fmt(inv.sellPrice ?? 0)}</p>
                  <p className="text-[10px] tabular-nums" style={{ color: "var(--text-muted)" }}>cost {fmt(inv.cost ?? 0)}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
