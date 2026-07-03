"use client";

// ─── Inventory & Procurement · Inventory Items ────────────
// Manage tracked materials/equipment: search + filter, a scannable table with
// inline quantity adjustments, and an add/edit modal. Mock/local state — links
// to vendors, jobs, and purchase orders come in a later phase.

import { useMemo, useState } from "react";
import {
  Boxes, Plus, Search, SlidersHorizontal, Pencil, Trash2, Minus, AlertTriangle, DollarSign, X,
} from "lucide-react";
import UiSelect from "@/components/ui/Select";
import StatusBadge from "@/components/shared/StatusBadge";
import ModuleViewToggle, { type ModuleView } from "@/components/shared/ModuleViewToggle";
import StatusTabs from "@/components/shared/StatusTabs";
import { PageHeader, StatCard } from "@/components/platform/ui";
import {
  getInventoryItems, getItemCategories, getLowStockItems, inventoryValue,
  getWarehouses, getVendors, createItem, updateItem, deleteItem, adjustItemQty,
  itemStock, STOCK_STATUS_STYLE,
  type InventoryItem,
} from "@/lib/inventory/data";

const ACCENT = "#f97316";
const money = (n?: number) => (n && n > 0 ? `$${n.toLocaleString()}` : "—");
// Grid columns — mirrors the CRM/Admin table layout.
const INV_COLS = "2fr 1.2fr 1.3fr 1.3fr 1.2fr 0.8fr 0.9fr 1fr 0.9fr";

export default function InventoryItems() {
  const [tick, setTick] = useState(0);
  const refresh = () => setTick(t => t + 1);
  const items = useMemo(() => getInventoryItems(), [tick]);

  const [view, setView] = useState<ModuleView>("list");
  const [search, setSearch] = useState("");
  const [fCategory, setFCategory] = useState("all");
  const [fLocation, setFLocation] = useState("all");
  const [fStatus, setFStatus] = useState("all");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [editing, setEditing] = useState<InventoryItem | "new" | null>(null);

  const categories = useMemo(() => getItemCategories(), [tick]);
  const locations = useMemo(() => getWarehouses().map(w => w.name), []);

  const lowCount = getLowStockItems().length;
  const outCount = items.filter(i => i.qtyOnHand <= 0).length;
  const value = inventoryValue();

  // Stock-status counts drive the glossy tabs above the table.
  const cntIn = items.filter(i => itemStock(i) === "in").length;
  const cntLow = items.filter(i => itemStock(i) === "low").length;
  const cntOut = items.filter(i => itemStock(i) === "out").length;

  const s = search.trim().toLowerCase();
  const filtered = items.filter(i => {
    if (s && !`${i.name} ${i.sku} ${i.category} ${i.vendor ?? ""}`.toLowerCase().includes(s)) return false;
    if (fCategory !== "all" && i.category !== fCategory) return false;
    if (fLocation !== "all" && i.location !== fLocation) return false;
    if (fStatus !== "all" && itemStock(i) !== fStatus) return false;
    return true;
  });
  // Status lives in the glossy tabs; the Filter popover holds category + location.
  const activeFilters = [fCategory !== "all", fLocation !== "all"].filter(Boolean).length;
  function clearFilters() { setFCategory("all"); setFLocation("all"); }

  return (
    <div className="p-6 space-y-5">
      {/* Header — title · Items/Overview toggle (inventory color) · Add Item */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex-1 min-w-0"><PageHeader title="Inventory Items" subtitle="Track materials, equipment, truck stock, costs, and reorder points." /></div>
        <ModuleViewToggle view={view} onChange={setView} listLabel="Items" accent={ACCENT} />
        <div className="flex-1 flex justify-end">
          <button onClick={() => setEditing("new")} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-white shrink-0" style={{ backgroundColor: ACCENT }}>
            <Plus className="w-4 h-4" /> Add Item
          </button>
        </div>
      </div>

      {/* Overview — KPI cards */}
      {view === "overview" && (
        <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))" }}>
          <StatCard label="Inventory Items" value={String(items.length)} hint="Tracked SKUs" icon={Boxes} accent={ACCENT} />
          <StatCard label="Low Stock" value={String(lowCount)} hint="At/below reorder" icon={AlertTriangle} accent="#f59e0b" />
          <StatCard label="Out of Stock" value={String(outCount)} hint="Needs reorder" icon={AlertTriangle} accent="#ef4444" />
          <StatCard label="Inventory Value" value={money(value)} hint="On-hand × cost" icon={DollarSign} accent="#10b981" />
        </div>
      )}

      {view === "list" && (
      <>
      {/* Toolbar — glossy status tabs (left) · search + Filter (right) */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <StatusTabs accent={ACCENT} active={fStatus} onChange={setFStatus}
          tabs={[
            { key: "all", label: "All", count: items.length },
            { key: "in", label: "In stock", count: cntIn },
            { key: "low", label: "Low stock", count: cntLow },
            { key: "out", label: "Out of stock", count: cntOut },
          ]} />
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 rounded-lg px-3 py-1.5" style={{ backgroundColor: "var(--bg-input)" }}>
            <Search className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--text-muted)" }} />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search items, SKU, vendor..." className="bg-transparent text-sm outline-none w-52" style={{ color: "var(--text-primary)" }} />
          </div>
          <div className="relative">
            <button onClick={() => setFiltersOpen(o => !o)} title="Filter"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors"
              style={{ border: `1px solid ${activeFilters ? ACCENT + "66" : "var(--border)"}`, backgroundColor: activeFilters ? ACCENT + "14" : "var(--bg-surface)", color: activeFilters ? ACCENT : "var(--text-secondary)" }}>
              <SlidersHorizontal className="w-3.5 h-3.5" /> Filter
              {activeFilters > 0 && <span className="text-[10px] font-bold px-1.5 rounded-full" style={{ backgroundColor: ACCENT + "26", color: ACCENT }}>{activeFilters}</span>}
            </button>
            {filtersOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setFiltersOpen(false)} />
                <div className="absolute right-0 top-full mt-2 z-50 rounded-xl p-4 w-72" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "0 12px 32px rgba(0,0,0,0.18)" }}>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Filters</p>
                    {activeFilters > 0 && <button onClick={clearFilters} className="text-xs" style={{ color: ACCENT }}>Clear all</button>}
                  </div>
                  <div className="space-y-2.5">
                    <FilterField label="Category"><UiSelect size="sm" value={fCategory} onChange={setFCategory} options={[{ value: "all", label: "Any category" }, ...categories.map(c => ({ value: c, label: c }))]} /></FilterField>
                    <FilterField label="Location"><UiSelect size="sm" value={fLocation} onChange={setFLocation} options={[{ value: "all", label: "Any location" }, ...locations.map(l => ({ value: l, label: l }))]} /></FilterField>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Table — grid layout (matches the CRM + Admin tables) */}
      <div className="rounded-xl overflow-hidden" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" }}>
        <div className="overflow-x-auto thin-scroll-x">
          <div style={{ minWidth: 1040 }}>
            <div className="grid px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider items-center" style={{ gridTemplateColumns: INV_COLS, gap: "0.75rem", color: "var(--text-muted)", borderBottom: "1px solid var(--border)", backgroundColor: "transparent" }}>
              <span>Item</span><span>Category</span><span>Vendor</span><span>Location</span><span>On Hand</span><span>Reorder</span><span>Cost</span><span>Status</span><span className="text-right">Actions</span>
            </div>
            {filtered.length === 0 ? (
              <div className="py-14 text-center"><p className="text-sm" style={{ color: "var(--text-muted)" }}>No items match the current filters.</p></div>
            ) : filtered.map((it, i) => {
              const st = STOCK_STATUS_STYLE[itemStock(it)];
              return (
                <div key={it.id} className="grid px-4 py-3 items-center transition-colors hover:bg-[var(--bg-surface-2)]"
                  style={{ gridTemplateColumns: INV_COLS, gap: "0.75rem", borderBottom: i < filtered.length - 1 ? "1px solid var(--border)" : "none" }}>
                  {/* Item */}
                  <div className="min-w-0">
                    <button onClick={() => setEditing(it)} className="text-sm font-medium text-left hover:underline truncate block" style={{ color: "var(--text-primary)" }}>{it.name}</button>
                    <p className="text-[11px] truncate" style={{ color: "var(--text-muted)" }}>{it.sku}{it.unit ? ` · ${it.unit}` : ""}</p>
                  </div>
                  <div className="text-xs truncate" style={{ color: "var(--text-secondary)" }}>{it.category}</div>
                  <div className="text-xs truncate" style={{ color: "var(--text-secondary)" }}>{it.vendor ?? "—"}</div>
                  <div className="text-xs truncate" style={{ color: "var(--text-secondary)" }}>{it.location}</div>
                  {/* On Hand */}
                  <div className="flex items-center gap-1">
                    <button onClick={() => { adjustItemQty(it.id, -1); refresh(); }} className="w-6 h-6 rounded-md flex items-center justify-center shrink-0" style={{ border: "1px solid var(--border)", color: "var(--text-muted)" }} title="Decrease"><Minus className="w-3 h-3" /></button>
                    <span className="w-8 text-center text-sm font-semibold tabular-nums" style={{ color: itemStock(it) === "out" ? "#ef4444" : "var(--text-primary)" }}>{it.qtyOnHand}</span>
                    <button onClick={() => { adjustItemQty(it.id, 1); refresh(); }} className="w-6 h-6 rounded-md flex items-center justify-center shrink-0" style={{ border: "1px solid var(--border)", color: "var(--text-muted)" }} title="Increase"><Plus className="w-3 h-3" /></button>
                  </div>
                  <div className="text-sm tabular-nums" style={{ color: "var(--text-secondary)" }}>{it.reorderPoint}</div>
                  <div className="text-sm tabular-nums whitespace-nowrap" style={{ color: "var(--text-secondary)" }}>{money(it.cost)}</div>
                  <div><StatusBadge label={st.label} color={st.dot} /></div>
                  {/* Actions */}
                  <div className="flex items-center justify-end gap-1">
                    <button onClick={() => setEditing(it)} title="Edit" className="p-1.5 rounded-lg" style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}><Pencil className="w-3.5 h-3.5" /></button>
                    <button onClick={() => { if (confirm(`Delete ${it.name}?`)) { deleteItem(it.id); refresh(); } }} title="Delete" className="p-1.5 rounded-lg" style={{ border: "1px solid var(--border)", color: "#dc2626" }}><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      </>
      )}

      {editing && <ItemModal item={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); refresh(); }} />}
    </div>
  );
}

function FilterField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: "var(--text-muted)" }}>{label}</label>
      {children}
    </div>
  );
}

// ─── Add / edit modal ─────────────────────────────────────
function ItemModal({ item, onClose, onSaved }: { item: InventoryItem | "new"; onClose: () => void; onSaved: () => void }) {
  const isNew = item === "new";
  const base = isNew ? null : item;
  const [name, setName] = useState(base?.name ?? "");
  const [sku, setSku] = useState(base?.sku ?? "");
  const [category, setCategory] = useState(base?.category ?? "");
  const [vendor, setVendor] = useState(base?.vendor ?? "");
  const [location, setLocation] = useState(base?.location ?? getWarehouses()[0]?.name ?? "");
  const [unit, setUnit] = useState(base?.unit ?? "each");
  const [cost, setCost] = useState(base?.cost != null ? String(base.cost) : "");
  const [sellPrice, setSellPrice] = useState(base?.sellPrice != null ? String(base.sellPrice) : "");
  const [qtyOnHand, setQty] = useState(base ? String(base.qtyOnHand) : "0");
  const [reorderPoint, setReorder] = useState(base ? String(base.reorderPoint) : "0");
  const [error, setError] = useState<string | null>(null);

  const vendorOptions = useMemo(() => [{ value: "", label: "None" }, ...getVendors().map(v => ({ value: v.name, label: v.name }))], []);
  const locationOptions = useMemo(() => getWarehouses().map(w => ({ value: w.name, label: w.name })), []);
  const num = (s: string) => (s === "" ? undefined : Math.max(0, parseFloat(s) || 0));

  function save() {
    if (!name.trim()) { setError("Item name is required."); return; }
    if (!sku.trim()) { setError("SKU / item code is required."); return; }
    const payload = {
      name: name.trim(), sku: sku.trim(), category: category.trim() || "Uncategorized",
      vendor: vendor || undefined, location, unit: unit.trim() || undefined,
      cost: num(cost), sellPrice: num(sellPrice),
      qtyOnHand: num(qtyOnHand) ?? 0, reorderPoint: num(reorderPoint) ?? 0,
    };
    if (isNew) createItem(payload); else updateItem((item as InventoryItem).id, payload);
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-xl max-h-[92vh] rounded-2xl overflow-hidden flex flex-col" onClick={e => e.stopPropagation()} style={{ backgroundColor: "var(--bg-surface)", boxShadow: "0 16px 48px rgba(0,0,0,0.24)" }}>
        <div className="flex items-center justify-between px-5 py-4 shrink-0" style={{ borderBottom: "1px solid var(--border)" }}>
          <p className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>{isNew ? "Add Item" : "Edit Item"}</p>
          <button onClick={onClose} style={{ color: "var(--text-muted)" }}><X className="w-4 h-4" /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Item name *" className="col-span-2"><input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. 4-inch Media Filter" className={inp} style={inpStyle} autoFocus /></Field>
            <Field label="SKU / item code *"><input value={sku} onChange={e => setSku(e.target.value)} placeholder="e.g. HVAC-MF-4" className={inp} style={inpStyle} /></Field>
            <Field label="Category"><input value={category} onChange={e => setCategory(e.target.value)} placeholder="e.g. Filters" className={inp} style={inpStyle} /></Field>
            <Field label="Preferred vendor"><UiSelect value={vendor} onChange={setVendor} options={vendorOptions} /></Field>
            <Field label="Location"><UiSelect value={location} onChange={setLocation} options={locationOptions} /></Field>
            <Field label="Cost"><MoneyInput value={cost} onChange={setCost} /></Field>
            <Field label="Sell price" hint="Optional"><MoneyInput value={sellPrice} onChange={setSellPrice} /></Field>
            <Field label="Unit"><input value={unit} onChange={e => setUnit(e.target.value)} placeholder="each, box, ft…" className={inp} style={inpStyle} /></Field>
            <Field label="Quantity on hand"><input type="number" min={0} value={qtyOnHand} onChange={e => setQty(e.target.value)} className={inp} style={inpStyle} /></Field>
            <Field label="Reorder point"><input type="number" min={0} value={reorderPoint} onChange={e => setReorder(e.target.value)} className={inp} style={inpStyle} /></Field>
          </div>
          <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>Linking to jobs, projects, and purchase orders arrives in a later phase.</p>
        </div>
        {error && <div className="mx-5 mb-3 px-3 py-2 rounded-lg text-xs shrink-0" style={{ backgroundColor: "#fee2e2", color: "#991b1b" }}>{error}</div>}
        <div className="px-5 py-3 flex items-center justify-end gap-2 shrink-0" style={{ borderTop: "1px solid var(--border)" }}>
          <button onClick={onClose} className="text-sm font-medium px-3 py-2 rounded-lg" style={{ color: "var(--text-secondary)" }}>Cancel</button>
          <button onClick={save} className="text-sm font-medium px-4 py-2 rounded-lg text-white" style={{ backgroundColor: ACCENT }}>{isNew ? "Add Item" : "Save Changes"}</button>
        </div>
      </div>
    </div>
  );
}

const inp = "w-full rounded-lg px-3 py-2 text-sm outline-none";
const inpStyle: React.CSSProperties = { border: "1px solid var(--border)", backgroundColor: "var(--bg-surface-2)", color: "var(--text-primary)" };

function Field({ label, hint, className, children }: { label: string; hint?: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={className}>
      <label className="flex items-center gap-1.5 text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>
        {label}{hint && <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>· {hint}</span>}
      </label>
      {children}
    </div>
  );
}
function MoneyInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center gap-1.5 rounded-lg px-3" style={{ border: "1px solid var(--border)", backgroundColor: "var(--bg-surface-2)" }}>
      <span className="text-xs" style={{ color: "var(--text-muted)" }}>$</span>
      <input type="number" min={0} step="0.01" value={value} onChange={e => onChange(e.target.value)} placeholder="0.00" className="w-full py-2 text-sm outline-none bg-transparent" style={{ color: "var(--text-primary)" }} />
    </div>
  );
}
