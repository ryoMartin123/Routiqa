"use client";

// ─── Searchable select ────────────────────────────────────
// Like Select, but the popup has a filter box — for pickers with many options
// (jobs, customers) where scrolling a plain dropdown doesn't scale. Options can
// carry a sublabel and extra keywords to match on. Popup is portaled to <body>
// (position:fixed) so it floats above scrolling modals/drawers, and flips up
// when there isn't room below — same behavior as Select.

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Check, Search, X } from "lucide-react";

export interface SearchOption {
  value: string;
  label: string;
  sublabel?: string;
  keywords?: string;   // extra text to match (not shown)
}

export default function SearchSelect({
  value, onChange, options, placeholder = "Select…", searchPlaceholder = "Search…",
  disabled, size = "md", emptyText = "No matches.",
}: {
  value: string;
  onChange: (value: string) => void;
  options: SearchOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  disabled?: boolean;
  size?: "sm" | "md";
  emptyText?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [pos, setPos] = useState<{ left: number; width: number; maxH: number; dropUp: boolean; top?: number; bottom?: number } | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = options.find(o => o.value === value);
  const pad = size === "sm" ? "px-2.5 py-1.5 text-xs" : "px-3 py-2 text-sm";

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(o => {
      const hay = `${o.label} ${o.sublabel ?? ""} ${o.keywords ?? ""}`.toLowerCase();
      return q.split(/\s+/).every(t => hay.includes(t));
    });
  }, [options, query]);

  // Outside-click closes (popup is portaled, so check both refs).
  useEffect(() => {
    if (!open) { setQuery(""); return; }
    const id = requestAnimationFrame(() => inputRef.current?.focus());
    function onDoc(e: MouseEvent) {
      const t = e.target as Node;
      if (wrapRef.current?.contains(t) || popRef.current?.contains(t)) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => { cancelAnimationFrame(id); document.removeEventListener("mousedown", onDoc); };
  }, [open]);

  // Position the fixed popup under (or above) the trigger.
  useLayoutEffect(() => {
    if (!open || !btnRef.current) return;
    const GAP = 6, MARGIN = 8, IDEAL = 300;
    const measure = () => {
      const rect = btnRef.current!.getBoundingClientRect();
      const below = window.innerHeight - rect.bottom - GAP - MARGIN;
      const above = rect.top - GAP - MARGIN;
      const dropUp = below < 200 && above > below;
      const maxH = Math.max(160, Math.min(IDEAL, dropUp ? above : below));
      setPos(dropUp
        ? { left: rect.left, width: rect.width, maxH, dropUp, bottom: window.innerHeight - rect.top + GAP }
        : { left: rect.left, width: rect.width, maxH, dropUp, top: rect.bottom + GAP });
    };
    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => { window.removeEventListener("resize", measure); window.removeEventListener("scroll", measure, true); };
  }, [open]);

  return (
    <div ref={wrapRef} className="relative w-full">
      <button ref={btnRef} type="button" disabled={disabled} onClick={() => !disabled && setOpen(o => !o)}
        className={`w-full flex items-center justify-between gap-2 rounded-lg outline-none transition-colors ${pad}`}
        style={{
          border: `1px solid ${open ? "#a5b4fc" : "var(--border)"}`,
          backgroundColor: "var(--bg-surface)",
          boxShadow: open ? "0 0 0 3px rgba(99,102,241,0.12)" : "none",
          opacity: disabled ? 0.5 : 1, cursor: disabled ? "not-allowed" : "pointer",
        }}>
        <span className="min-w-0 text-left truncate" style={{ color: selected ? "var(--text-primary)" : "var(--text-muted)" }}>
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown className="w-3.5 h-3.5 shrink-0 transition-transform" style={{ color: "var(--text-muted)", transform: open ? "rotate(180deg)" : "none" }} />
      </button>

      {open && pos && typeof document !== "undefined" && createPortal(
        <div ref={popRef} className="rounded-xl overflow-hidden flex flex-col"
          style={{
            position: "fixed", left: pos.left, width: pos.width, zIndex: 1000,
            backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)",
            boxShadow: "0 12px 32px rgba(0,0,0,0.16)", maxHeight: pos.maxH,
            ...(pos.dropUp ? { bottom: pos.bottom } : { top: pos.top }),
          }}>
          <div className="flex items-center gap-2 px-3 py-2.5 shrink-0" style={{ borderBottom: "1px solid var(--border)" }}>
            <Search className="w-4 h-4 shrink-0" style={{ color: "var(--text-muted)" }} />
            <input ref={inputRef} value={query} onChange={e => setQuery(e.target.value)} placeholder={searchPlaceholder}
              className="flex-1 min-w-0 bg-transparent outline-none text-sm" style={{ color: "var(--text-primary)" }} />
            {query && <button type="button" onClick={() => { setQuery(""); inputRef.current?.focus(); }} style={{ color: "var(--text-muted)" }}><X className="w-3.5 h-3.5" /></button>}
          </div>
          <div className="p-1 overflow-y-auto thin-scroll-y">
            {results.length === 0 ? (
              <div className="px-3 py-6 text-center text-xs" style={{ color: "var(--text-muted)" }}>{emptyText}</div>
            ) : results.map(o => {
              const isSel = o.value === value;
              return (
                <button key={o.value} type="button" onClick={() => { onChange(o.value); setOpen(false); }}
                  className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left transition-colors hover:bg-[var(--bg-surface-2)]">
                  <span className="flex flex-col min-w-0 flex-1">
                    <span className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>{o.label}</span>
                    {o.sublabel && <span className="text-[11px] truncate" style={{ color: "var(--text-muted)" }}>{o.sublabel}</span>}
                  </span>
                  {isSel && <Check className="w-3.5 h-3.5 shrink-0" style={{ color: "#4f46e5" }} />}
                </button>
              );
            })}
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
