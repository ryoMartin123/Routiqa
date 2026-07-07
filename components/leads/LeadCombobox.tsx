"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Search, Check } from "lucide-react";
import { useHierarchy } from "@/components/providers/HierarchyProvider";
import { getAllLeads, getLead, LEAD_SOURCE_LABELS, LEAD_STAGE_CONFIG, type Lead } from "@/lib/leads/data";

interface Props {
  value:        string;                 // selected lead id ("" = none)
  onChange:     (id: string) => void;
  disabled?:    boolean;
  placeholder?: string;
  size?:        "sm" | "md";
}

// Searchable lead picker — scoped to the active company/location, limited to
// convertible leads (linked to an account, not already converted). Mirrors
// AccountCombobox so the project wizard's two source pickers feel identical.
export default function LeadCombobox({
  value, onChange, disabled, placeholder = "Search leads…", size = "md",
}: Props) {
  const { effectiveCompanyId, effectiveLocationId } = useHierarchy();
  const [open, setOpen]   = useState(false);
  const [query, setQuery] = useState("");
  const [activeIdx, setActiveIdx] = useState(0);
  const wrapRef  = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const pad = size === "sm" ? "px-2.5 py-1.5 text-xs" : "px-3 py-2 text-sm";

  const scoped = useMemo(
    () => getAllLeads()
      .filter(l => (!effectiveCompanyId  || l.companyId  === effectiveCompanyId))
      .filter(l => (!effectiveLocationId || l.locationId === effectiveLocationId))
      .filter(l => l.accountId && !l.convertedToProjectId && !l.convertedToJobId),
    [effectiveCompanyId, effectiveLocationId],
  );

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return scoped;
    const has = (v?: string) => (v ?? "").toLowerCase().includes(q);
    return scoped.filter(l => has(l.customerName) || has(l.title) || has(LEAD_SOURCE_LABELS[l.source]) || has(l.customerPhone));
  }, [scoped, query]);

  const selected: Lead | undefined = value ? getLead(value) : undefined;

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
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
    if (e.key === "Escape") { setOpen(false); return; }
    if (e.key === "ArrowDown") { e.preventDefault(); setActiveIdx(i => Math.min(i + 1, results.length - 1)); }
    if (e.key === "ArrowUp")   { e.preventDefault(); setActiveIdx(i => Math.max(i - 1, 0)); }
    if (e.key === "Enter")     { e.preventDefault(); const pick = results[activeIdx]; if (pick) choose(pick.id); }
  }

  return (
    <div ref={wrapRef} className="relative w-full">
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen(o => !o)}
        className={`w-full flex items-center justify-between gap-2 rounded-lg outline-none transition-colors ${pad}`}
        style={{
          border: `1px solid ${open ? "#8ed0c6" : "var(--border)"}`,
          backgroundColor: "var(--bg-surface)",
          color: selected ? "var(--text-primary)" : "var(--text-muted)",
          boxShadow: open ? "0 0 0 3px rgba(35,156,141,0.12)" : "none",
          opacity: disabled ? 0.5 : 1,
          cursor: disabled ? "not-allowed" : "pointer",
        }}
      >
        <span className="truncate text-left">{selected ? `${selected.customerName} — ${selected.title}` : placeholder}</span>
        <ChevronDown className="w-3.5 h-3.5 shrink-0 transition-transform"
          style={{ color: "var(--text-muted)", transform: open ? "rotate(180deg)" : "none" }} />
      </button>

      {open && (
        <div
          className="absolute left-0 right-0 z-50 mt-1.5 rounded-xl overflow-hidden"
          style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "0 12px 32px rgba(0,0,0,0.16)" }}
        >
          <div className="flex items-center gap-2 px-2.5 py-2" style={{ borderBottom: "1px solid var(--border)" }}>
            <Search className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--text-muted)" }} />
            <input
              ref={inputRef}
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Search by customer, title, source…"
              className="w-full bg-transparent text-sm outline-none"
              style={{ color: "var(--text-primary)" }}
            />
          </div>

          <div className="p-1 overflow-y-auto" style={{ maxHeight: "240px" }}>
            {results.length === 0 && (
              <p className="px-2.5 py-3 text-xs text-center" style={{ color: "var(--text-muted)" }}>
                {scoped.length === 0 ? "No open leads in this scope to convert." : `No leads match “${query}”.`}
              </p>
            )}
            {results.map((l, i) => {
              const isSelected = l.id === value;
              const isActive = i === activeIdx;
              const sc = LEAD_STAGE_CONFIG[l.stage];
              return (
                <button
                  key={l.id}
                  type="button"
                  onClick={() => choose(l.id)}
                  onMouseEnter={() => setActiveIdx(i)}
                  className="w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg text-left transition-colors"
                  style={{ backgroundColor: isActive ? "var(--bg-surface-2)" : "transparent" }}
                >
                  <span className="min-w-0">
                    <span className="block text-sm truncate" style={{ color: isSelected ? "#0f8578" : "var(--text-primary)", fontWeight: isSelected ? 600 : 400 }}>{l.customerName}</span>
                    <span className="block text-[11px] truncate" style={{ color: "var(--text-muted)" }}>{l.title}</span>
                  </span>
                  <span className="flex items-center gap-1.5 shrink-0">
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap" style={{ backgroundColor: sc.bg, color: sc.color }}>{sc.label}</span>
                    {isSelected && <Check className="w-3.5 h-3.5" style={{ color: "#0f8578" }} />}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
