"use client";

import { useMemo, useState } from "react";
import { X, Search, Package, Check, Plus } from "lucide-react";
import UiSelect from "@/components/ui/Select";
import { fmt, type Item } from "@/lib/items/data";
import { ITEM_TYPE_CONFIG } from "@/lib/items/types";

// Searchable, multi-select catalog picker. Overlays whatever wizard launched it
// (quotes or invoices) and returns the chosen items to add as line items.
export default function CatalogPicker({ items, showCost, onAdd, onClose }: {
  items: Item[]; showCost: boolean; onAdd: (sel: Item[]) => void; onClose: () => void;
}) {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("all");
  const [sel, setSel] = useState<Record<string, boolean>>({});

  const categories = useMemo(() => Array.from(new Set(items.map(i => i.category))).sort(), [items]);
  const filtered = items.filter(i =>
    (cat === "all" || i.category === cat) &&
    (!q || i.name.toLowerCase().includes(q.toLowerCase()) || (i.sku ?? "").toLowerCase().includes(q.toLowerCase())),
  );
  const selectedCount = Object.values(sel).filter(Boolean).length;
  function toggle(id: string) { setSel(s => ({ ...s, [id]: !s[id] })); }
  function confirm() { onAdd(items.filter(i => sel[i.id])); }

  return (
    <div className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-2xl max-h-[88vh] flex flex-col rounded-2xl overflow-hidden" onClick={e => e.stopPropagation()}
        style={{ backgroundColor: "var(--bg-surface)", boxShadow: "0 16px 48px rgba(0,0,0,0.3)" }}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 shrink-0" style={{ borderBottom: "1px solid var(--border)" }}>
          <div className="flex items-center gap-2">
            <Package className="w-4 h-4" style={{ color: "#4f46e5" }} />
            <p className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>Add from Catalog</p>
          </div>
          <button onClick={onClose} style={{ color: "var(--text-muted)" }}><X className="w-4 h-4" /></button>
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-2 px-5 py-3 shrink-0" style={{ borderBottom: "1px solid var(--border)" }}>
          <div className="flex items-center gap-2 rounded-lg px-3 py-2 flex-1" style={{ backgroundColor: "var(--bg-input)" }}>
            <Search className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--text-muted)" }} />
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search items or SKU…" autoFocus
              className="bg-transparent text-sm outline-none flex-1 min-w-0" style={{ color: "var(--text-primary)" }} />
          </div>
          <div className="w-44 shrink-0">
            <UiSelect size="sm" value={cat} onChange={setCat}
              options={[{ value: "all", label: "All Categories" }, ...categories.map(c => ({ value: c, label: c }))]} />
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto thin-scroll-y p-3">
          {items.length === 0 ? (
            <p className="text-sm text-center py-10" style={{ color: "var(--text-muted)" }}>No catalog items for this company yet.</p>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-center py-10" style={{ color: "var(--text-muted)" }}>No items match your search.</p>
          ) : (
            <div className="space-y-1.5">
              {filtered.map(i => {
                const on = !!sel[i.id];
                const cfg = ITEM_TYPE_CONFIG[i.type];
                const m = i.unitCost != null ? i.unitPrice - i.unitCost : null;
                return (
                  <button key={i.id} onClick={() => toggle(i.id)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors"
                    style={{ border: `1px solid ${on ? "var(--accent-soft-border)" : "var(--border-subtle)"}`, backgroundColor: on ? "var(--accent-soft-bg)" : "var(--bg-surface)" }}>
                    <span className="w-4 h-4 rounded flex items-center justify-center shrink-0"
                      style={{ border: `1px solid ${on ? "#4f46e5" : "var(--border)"}`, backgroundColor: on ? "#4f46e5" : "transparent" }}>
                      {on && <Check className="w-3 h-3 text-white" />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>{i.name}</p>
                        <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full shrink-0" style={{ backgroundColor: cfg.bg, color: cfg.color }}>{cfg.label}</span>
                      </div>
                      <p className="text-[11px] truncate" style={{ color: "var(--text-muted)" }}>{i.category}{i.sku ? ` · ${i.sku}` : ""}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{fmt(i.unitPrice)}</p>
                      {showCost && m != null && <p className="text-[10px]" style={{ color: "#059669" }}>{fmt(m)} margin</p>}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 flex items-center justify-between shrink-0" style={{ borderTop: "1px solid var(--border)" }}>
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>{selectedCount} selected</span>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="px-3 py-1.5 rounded-lg text-sm" style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}>Cancel</button>
            <button onClick={confirm} disabled={selectedCount === 0}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-medium text-white disabled:opacity-40" style={{ backgroundColor: "#4f46e5" }}>
              <Plus className="w-3.5 h-3.5" /> Add {selectedCount > 0 ? selectedCount : ""} {selectedCount === 1 ? "item" : "items"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
