"use client";

// ─── Searchable, grouped catalog picker ───────────────────
// The clean/light take on the screenshot's grouped "When this happens" dropdown:
// a single button that opens a searchable popover with items grouped by CRM
// object (or action group). Used for the Trigger and Action steps. No dark
// canvas, no bulky native select — just search + tidy grouped rows.

import { useEffect, useMemo, useRef, useState } from "react";
import { Search, ChevronDown } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface CatalogGroup {
  key: string;
  label: string;
  icon: LucideIcon;
  color: string;
  items: { value: string; label: string }[];
}

export default function CatalogPicker({
  groups, value, onChange, placeholder = "Choose…", accent = "#e11d48",
}: {
  groups: CatalogGroup[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  accent?: string;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);
  useEffect(() => { if (!open) setQ(""); }, [open]);

  // Current selection — find which group + item the value belongs to.
  const selected = useMemo(() => {
    for (const g of groups) {
      const it = g.items.find(i => i.value === value);
      if (it) return { group: g, item: it };
    }
    return null;
  }, [groups, value]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return groups
      .map(g => ({ ...g, items: needle ? g.items.filter(i => i.label.toLowerCase().includes(needle) || g.label.toLowerCase().includes(needle)) : g.items }))
      .filter(g => g.items.length > 0);
  }, [groups, q]);

  const SelIcon = selected?.group.icon;

  return (
    <div ref={wrapRef} className="relative w-full">
      <button type="button" onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between gap-2 rounded-lg px-3 py-2.5 transition-colors"
        style={{ border: `1px solid ${open ? accent : "var(--border)"}`, backgroundColor: "var(--bg-surface)", boxShadow: open ? `0 0 0 3px ${accent}1f` : "none" }}
        aria-haspopup="listbox" aria-expanded={open}>
        <span className="flex items-center gap-2.5 min-w-0">
          {selected && SelIcon ? (
            <span className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: selected.group.color + "1a" }}>
              <SelIcon className="w-4 h-4" style={{ color: selected.group.color }} />
            </span>
          ) : (
            <span className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: "var(--bg-surface-2)" }}>
              <Search className="w-3.5 h-3.5" style={{ color: "var(--text-muted)" }} />
            </span>
          )}
          <span className="min-w-0 text-left">
            <span className="block text-sm font-medium truncate" style={{ color: selected ? "var(--text-primary)" : "var(--text-muted)" }}>
              {selected ? selected.item.label : placeholder}
            </span>
            {selected && <span className="block text-[11px] truncate" style={{ color: "var(--text-muted)" }}>{selected.group.label}</span>}
          </span>
        </span>
        <ChevronDown className="w-4 h-4 shrink-0 transition-transform" style={{ color: "var(--text-muted)", transform: open ? "rotate(180deg)" : "none" }} />
      </button>

      {open && (
        <div className="absolute left-0 right-0 mt-1.5 z-50 rounded-xl overflow-hidden"
          style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "0 12px 32px rgba(0,0,0,0.16)" }}>
          <div className="p-2" style={{ borderBottom: "1px solid var(--border)" }}>
            <div className="flex items-center gap-2 rounded-lg px-2.5 py-1.5" style={{ backgroundColor: "var(--bg-surface-2)" }}>
              <Search className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--text-muted)" }} />
              <input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="Search…"
                className="bg-transparent text-sm outline-none w-full" style={{ color: "var(--text-primary)" }} />
            </div>
          </div>
          <div className="max-h-72 overflow-y-auto thin-scroll-y p-1">
            {filtered.length === 0 && (
              <p className="text-xs text-center py-6" style={{ color: "var(--text-muted)" }}>No matches</p>
            )}
            {filtered.map(g => {
              const GIcon = g.icon;
              return (
                <div key={g.key} className="mb-1">
                  <div className="flex items-center gap-1.5 px-2 pt-2 pb-1">
                    <GIcon className="w-3 h-3 shrink-0" style={{ color: g.color }} />
                    <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>{g.label}</span>
                  </div>
                  {g.items.map(it => {
                    const sel = it.value === value;
                    return (
                      <button key={it.value} type="button"
                        onClick={() => { onChange(it.value); setOpen(false); }}
                        className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-left text-sm transition-colors hover:bg-[var(--bg-surface-2)]"
                        style={{ color: sel ? accent : "var(--text-secondary)", fontWeight: sel ? 600 : 400, backgroundColor: sel ? accent + "12" : "transparent" }}>
                        {it.label}
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
