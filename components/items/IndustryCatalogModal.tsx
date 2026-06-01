"use client";

import { useState } from "react";
import { X, Check, AlertTriangle, Layers } from "lucide-react";
import {
  INDUSTRY_CATALOGS, applyIndustryCatalog, countMissingFromCatalog, fmt,
} from "@/lib/items/data";
import { ITEM_TYPE_CONFIG } from "@/lib/items/types";

export default function IndustryCatalogModal({ onClose, onApplied }: {
  onClose: () => void;
  onApplied: () => void;
}) {
  const [selected, setSelected] = useState(INDUSTRY_CATALOGS[0].id);
  const [confirmReplace, setConfirmReplace] = useState(false);

  const cat = INDUSTRY_CATALOGS.find(c => c.id === selected)!;
  const missing = countMissingFromCatalog(selected);

  // Group the preview items by category
  const byCat = new Map<string, typeof cat.items>();
  cat.items.forEach(si => { const a = byCat.get(si.category) ?? []; a.push(si); byCat.set(si.category, a); });

  function apply(mode: "missing" | "replace") {
    applyIndustryCatalog(selected, mode);
    onApplied();
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-4xl h-[86vh] flex flex-col rounded-2xl overflow-hidden" onClick={e => e.stopPropagation()}
        style={{ backgroundColor: "var(--bg-surface)", boxShadow: "0 16px 48px rgba(0,0,0,0.24)" }}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 shrink-0" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
          <div className="flex items-center gap-2.5">
            <Layers className="w-5 h-5" style={{ color: "#4f46e5" }} />
            <div>
              <p className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>Industry Starter Catalogs</p>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>Preview, then copy items into your catalog — fully editable after.</p>
            </div>
          </div>
          <button onClick={onClose} style={{ color: "var(--text-muted)" }}><X className="w-4 h-4" /></button>
        </div>

        <div className="flex-1 flex min-h-0">
          {/* Industry list */}
          <div className="w-56 shrink-0 overflow-y-auto thin-scroll-y py-2 px-2" style={{ borderRight: "1px solid var(--border-subtle)", backgroundColor: "var(--bg-surface-2)" }}>
            {INDUSTRY_CATALOGS.map(c => {
              const active = selected === c.id;
              return (
                <button key={c.id} onClick={() => { setSelected(c.id); setConfirmReplace(false); }}
                  className="w-full text-left px-3 py-2.5 rounded-lg mb-1 transition-colors"
                  style={{ backgroundColor: active ? "var(--bg-surface)" : "transparent", border: active ? "1px solid var(--border)" : "1px solid transparent" }}>
                  <p className="text-sm font-medium" style={{ color: active ? "#4f46e5" : "var(--text-primary)" }}>{c.label}</p>
                  <p className="text-[10px] mt-0.5" style={{ color: "var(--text-muted)" }}>{c.items.length} items · {c.categories.length} categories</p>
                </button>
              );
            })}
          </div>

          {/* Preview */}
          <div className="flex-1 overflow-y-auto thin-scroll-y p-5">
            <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{cat.label}</p>
            <p className="text-xs mt-0.5 mb-3" style={{ color: "var(--text-secondary)" }}>{cat.description}</p>

            <p className="text-[10px] font-semibold uppercase tracking-widest mb-1.5" style={{ color: "var(--text-muted)" }}>Categories</p>
            <div className="flex flex-wrap gap-1.5 mb-4">
              {cat.categories.map(c => (
                <span key={c} className="text-[11px] font-medium px-2 py-0.5 rounded-full" style={{ backgroundColor: "var(--bg-surface-2)", color: "var(--text-secondary)", border: "1px solid var(--border-subtle)" }}>{c}</span>
              ))}
            </div>

            <p className="text-[10px] font-semibold uppercase tracking-widest mb-1.5" style={{ color: "var(--text-muted)" }}>Items</p>
            <div className="space-y-3">
              {[...byCat.entries()].map(([category, list]) => (
                <div key={category}>
                  <p className="text-xs font-semibold mb-1" style={{ color: "var(--text-secondary)" }}>{category}</p>
                  <div className="rounded-lg overflow-hidden" style={{ border: "1px solid var(--border-subtle)" }}>
                    {list.map((si, i) => {
                      const tc = ITEM_TYPE_CONFIG[si.type];
                      return (
                        <div key={si.name} className="flex items-center gap-3 px-3 py-1.5" style={{ borderBottom: i < list.length - 1 ? "1px solid var(--border-subtle)" : "none" }}>
                          <span className="text-sm flex-1 truncate" style={{ color: "var(--text-primary)" }}>{si.name}</span>
                          <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full shrink-0" style={{ backgroundColor: tc.bg, color: tc.color }}>{tc.label}</span>
                          <span className="text-xs font-medium w-16 text-right shrink-0" style={{ color: si.unitPrice < 0 ? "#dc2626" : "var(--text-secondary)" }}>{fmt(si.unitPrice)}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer actions */}
        <div className="px-6 py-4 shrink-0" style={{ borderTop: "1px solid var(--border-subtle)" }}>
          {confirmReplace ? (
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-xs" style={{ color: "#b45309" }}>
                <AlertTriangle className="w-4 h-4 shrink-0" />
                Replace clears your current catalog and loads the {cat.label} starter. This can&apos;t be undone.
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button onClick={() => setConfirmReplace(false)} className="px-3 py-2 rounded-lg text-sm" style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}>Cancel</button>
                <button onClick={() => apply("replace")} className="px-4 py-2 rounded-lg text-sm font-medium text-white" style={{ backgroundColor: "#dc2626" }}>Replace All</button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-3">
              <button onClick={onClose} className="px-3 py-2 rounded-lg text-sm" style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}>Cancel</button>
              <div className="flex items-center gap-2">
                <button onClick={() => setConfirmReplace(true)} className="px-3 py-2 rounded-lg text-sm font-medium" style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}>Replace All</button>
                <button onClick={() => apply("missing")} disabled={missing === 0}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-40" style={{ backgroundColor: "#4f46e5" }}>
                  <Check className="w-3.5 h-3.5" /> {missing === 0 ? "All present" : `Apply Missing (${missing})`}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
