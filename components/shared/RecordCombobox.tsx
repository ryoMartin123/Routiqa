"use client";

// ─── Generic record combobox ──────────────────────────────
// A searchable single-select over a caller-supplied option list. Mirrors the
// styling of AccountCombobox / LeadCombobox so pickers across the app feel
// identical, but stays domain-agnostic — the caller maps its records to
// { id, label, sublabel } and resolves the selection however it needs.

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Search, Check } from "lucide-react";

export interface RecordOption {
  id: string;
  label: string;
  sublabel?: string;
}

interface Props {
  value:        string;
  onChange:     (id: string) => void;
  options:      RecordOption[];
  placeholder?: string;
  emptyText?:   string;
  size?:        "sm" | "md";
}

export default function RecordCombobox({
  value, onChange, options, placeholder = "Search…", emptyText = "No matches.", size = "md",
}: Props) {
  const [open, setOpen]   = useState(false);
  const [query, setQuery] = useState("");
  const [activeIdx, setActiveIdx] = useState(0);
  const wrapRef  = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const pad = size === "sm" ? "px-2.5 py-1.5 text-xs" : "px-3 py-2 text-sm";

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    const has = (v?: string) => (v ?? "").toLowerCase().includes(q);
    return options.filter(o => has(o.label) || has(o.sublabel));
  }, [options, query]);

  const selected = value ? options.find(o => o.id === value) : undefined;

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  useEffect(() => { if (open) setTimeout(() => inputRef.current?.focus(), 0); }, [open]);
  useEffect(() => { setActiveIdx(0); }, [query]);

  function choose(id: string) {
    onChange(id);
    setOpen(false);
    setQuery("");
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape")    { setOpen(false); return; }
    if (e.key === "ArrowDown") { e.preventDefault(); setActiveIdx(i => Math.min(i + 1, results.length - 1)); }
    if (e.key === "ArrowUp")   { e.preventDefault(); setActiveIdx(i => Math.max(i - 1, 0)); }
    if (e.key === "Enter")     { e.preventDefault(); const pick = results[activeIdx]; if (pick) choose(pick.id); }
  }

  return (
    <div ref={wrapRef} className="relative w-full">
      <button type="button" onClick={() => setOpen(o => !o)}
        className={`w-full flex items-center justify-between gap-2 rounded-lg outline-none transition-colors ${pad}`}
        style={{
          border: `1px solid ${open ? "#8ed0c6" : "var(--border)"}`,
          backgroundColor: "var(--bg-surface)",
          color: selected ? "var(--text-primary)" : "var(--text-muted)",
          boxShadow: open ? "0 0 0 3px rgba(35,156,141,0.12)" : "none",
        }}>
        <span className="truncate text-left">
          {selected ? (selected.sublabel ? `${selected.label} — ${selected.sublabel}` : selected.label) : placeholder}
        </span>
        <ChevronDown className="w-3.5 h-3.5 shrink-0 transition-transform"
          style={{ color: "var(--text-muted)", transform: open ? "rotate(180deg)" : "none" }} />
      </button>

      {open && (
        <div className="absolute left-0 right-0 z-50 mt-1.5 rounded-xl overflow-hidden"
          style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "0 12px 32px rgba(0,0,0,0.16)" }}>
          <div className="flex items-center gap-2 px-2.5 py-2" style={{ borderBottom: "1px solid var(--border)" }}>
            <Search className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--text-muted)" }} />
            <input ref={inputRef} value={query} onChange={e => setQuery(e.target.value)} onKeyDown={onKeyDown}
              placeholder={placeholder}
              className="w-full bg-transparent text-sm outline-none" style={{ color: "var(--text-primary)" }} />
          </div>

          <div className="p-1 overflow-y-auto" style={{ maxHeight: "240px" }}>
            {results.length === 0 && (
              <p className="px-2.5 py-3 text-xs text-center" style={{ color: "var(--text-muted)" }}>
                {options.length === 0 ? emptyText : `No matches for “${query}”.`}
              </p>
            )}
            {results.map((o, i) => {
              const isSelected = o.id === value;
              const isActive = i === activeIdx;
              return (
                <button key={o.id} type="button" onClick={() => choose(o.id)} onMouseEnter={() => setActiveIdx(i)}
                  className="w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg text-left transition-colors"
                  style={{ backgroundColor: isActive ? "var(--bg-surface-2)" : "transparent" }}>
                  <span className="min-w-0">
                    <span className="block text-sm truncate" style={{ color: isSelected ? "#0f8578" : "var(--text-primary)", fontWeight: isSelected ? 600 : 400 }}>{o.label}</span>
                    {o.sublabel && <span className="block text-[11px] truncate" style={{ color: "var(--text-muted)" }}>{o.sublabel}</span>}
                  </span>
                  {isSelected && <Check className="w-3.5 h-3.5 shrink-0" style={{ color: "#0f8578" }} />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
