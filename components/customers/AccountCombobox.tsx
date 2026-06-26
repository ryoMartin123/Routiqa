"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Search, Check, Plus } from "lucide-react";
import { useHierarchy } from "@/components/providers/HierarchyProvider";
import { getAllCustomers, getCustomer, type Customer } from "@/lib/customers/data";

// Cap how many rows render at once — with hundreds of accounts we don't dump
// them all into the DOM; the user narrows with the search box instead.
const MAX_RESULTS = 50;

interface Props {
  value:        string;                 // selected account id ("" = none)
  onChange:     (id: string) => void;
  onCreateNew?: () => void;             // shown as a "+ Create new account" row
  disabled?:    boolean;
  placeholder?: string;
  size?:        "sm" | "md";
  dropUp?:      boolean;                // open the popup above the trigger
}

// Searchable account picker. Filters to the active company/location scope (a job
// or lead belongs to a location), matches on name/phone/address/city, and can
// offer a "create new account" escape hatch. Reused by the job + lead wizards.
export default function AccountCombobox({
  value, onChange, onCreateNew, disabled, placeholder = "Search accounts…", size = "md", dropUp = false,
}: Props) {
  const { effectiveCompanyId, effectiveLocationId } = useHierarchy();
  const [open, setOpen]   = useState(false);
  const [query, setQuery] = useState("");
  const [activeIdx, setActiveIdx] = useState(0);
  const wrapRef  = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const pad = size === "sm" ? "px-2.5 py-1.5 text-xs" : "px-3 py-2 text-sm";

  // Accounts within the current scope (down-inclusion: a chosen company/location
  // narrows the list; "All" shows everything authorized).
  const scoped = useMemo(
    () => getAllCustomers().filter(c =>
      (!effectiveCompanyId  || c.companyId  === effectiveCompanyId) &&
      (!effectiveLocationId || c.locationId === effectiveLocationId)),
    [effectiveCompanyId, effectiveLocationId],
  );

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return scoped;
    const has = (v?: string) => (v ?? "").toLowerCase().includes(q);
    return scoped.filter(c => has(c.name) || has(c.phone) || has(c.address) || has(c.city) || has(c.email));
  }, [scoped, query]);

  // Only render the first MAX_RESULTS rows; keyboard nav + the create row are
  // based on this visible slice too.
  const visible = results.slice(0, MAX_RESULTS);
  const overflow = results.length - visible.length;

  // The selected account resolves from the full set, so a pick outside the
  // current scope (e.g. a locked preset) still shows its name.
  const selected: Customer | undefined = value ? getCustomer(value) : undefined;

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  // Focus the search box when opening; reset highlight as the query changes.
  useEffect(() => { if (open) setTimeout(() => inputRef.current?.focus(), 0); }, [open]);
  useEffect(() => { setActiveIdx(0); }, [query]);

  function choose(id: string) {
    onChange(id);
    setOpen(false);
    setQuery("");
  }

  const createRowIdx = onCreateNew ? visible.length : -1;   // create row sits after the visible rows

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") { setOpen(false); return; }
    const max = onCreateNew ? visible.length : visible.length - 1;
    if (e.key === "ArrowDown") { e.preventDefault(); setActiveIdx(i => Math.min(i + 1, max)); }
    if (e.key === "ArrowUp")   { e.preventDefault(); setActiveIdx(i => Math.max(i - 1, 0)); }
    if (e.key === "Enter") {
      e.preventDefault();
      if (activeIdx === createRowIdx && onCreateNew) { setOpen(false); onCreateNew(); return; }
      const pick = visible[activeIdx];
      if (pick) choose(pick.id);
    }
  }

  function sub(c: Customer): string {
    return [c.city && `${c.city}, ${c.state}`, c.phone].filter(Boolean).join(" · ");
  }

  return (
    <div ref={wrapRef} className="relative w-full">
      {/* Trigger */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen(o => !o)}
        className={`w-full flex items-center justify-between gap-2 rounded-lg outline-none transition-colors ${pad}`}
        style={{
          border: `1px solid ${open ? "#a5b4fc" : "var(--border)"}`,
          backgroundColor: "var(--bg-surface)",
          color: selected ? "var(--text-primary)" : "var(--text-muted)",
          boxShadow: open ? "0 0 0 3px rgba(99,102,241,0.12)" : "none",
          opacity: disabled ? 0.5 : 1,
          cursor: disabled ? "not-allowed" : "pointer",
        }}
      >
        <span className="truncate text-left">{selected ? selected.name : placeholder}</span>
        <ChevronDown className="w-3.5 h-3.5 shrink-0 transition-transform"
          style={{ color: "var(--text-muted)", transform: open ? "rotate(180deg)" : "none" }} />
      </button>

      {/* Popup */}
      {open && (
        <div
          className={`absolute left-0 right-0 z-50 rounded-xl overflow-hidden ${dropUp ? "bottom-full mb-1.5" : "mt-1.5"}`}
          style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "0 12px 32px rgba(0,0,0,0.16)" }}
        >
          {/* Search box */}
          <div className="flex items-center gap-2 px-2.5 py-2" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
            <Search className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--text-muted)" }} />
            <input
              ref={inputRef}
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Search by name, phone, address…"
              className="w-full bg-transparent text-sm outline-none"
              style={{ color: "var(--text-primary)" }}
            />
          </div>

          {/* Results */}
          <div className="p-1 overflow-y-auto" style={{ maxHeight: "240px" }}>
            {results.length === 0 && (
              <p className="px-2.5 py-3 text-xs text-center" style={{ color: "var(--text-muted)" }}>
                No accounts match “{query}”.
              </p>
            )}
            {visible.map((c, i) => {
              const isSelected = c.id === value;
              const isActive = i === activeIdx;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => choose(c.id)}
                  onMouseEnter={() => setActiveIdx(i)}
                  className="w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg text-left transition-colors"
                  style={{ backgroundColor: isActive ? "var(--bg-surface-2)" : "transparent" }}
                >
                  <span className="min-w-0">
                    <span className="block text-sm truncate" style={{ color: isSelected ? "#4f46e5" : "var(--text-primary)", fontWeight: isSelected ? 600 : 400 }}>{c.name}</span>
                    <span className="block text-[11px] truncate" style={{ color: "var(--text-muted)" }}>{sub(c)}</span>
                  </span>
                  {isSelected && <Check className="w-3.5 h-3.5 shrink-0" style={{ color: "#4f46e5" }} />}
                </button>
              );
            })}
            {overflow > 0 && (
              <p className="px-2.5 py-2 text-[11px] text-center" style={{ color: "var(--text-muted)" }}>
                +{overflow} more — keep typing to narrow.
              </p>
            )}
          </div>

          {/* Create-new row */}
          {onCreateNew && (
            <button
              type="button"
              onClick={() => { setOpen(false); onCreateNew(); }}
              onMouseEnter={() => setActiveIdx(createRowIdx)}
              className="w-full flex items-center gap-2 px-2.5 py-2.5 text-sm font-medium transition-colors"
              style={{
                borderTop: "1px solid var(--border-subtle)",
                backgroundColor: activeIdx === createRowIdx ? "var(--bg-surface-2)" : "transparent",
                color: "var(--accent-text)",
              }}
            >
              <Plus className="w-3.5 h-3.5 shrink-0" /> Create new account
            </button>
          )}
        </div>
      )}
    </div>
  );
}
