"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Search, Check, ChevronDown, X, Building2, Home } from "lucide-react";
import type { Customer } from "@/lib/customers/data";

interface AccountSearchSelectProps {
  customers: Customer[];
  value: string;
  onChange: (id: string) => void;
  disabled?: boolean;
  placeholder?: string;
  forceDown?: boolean;   // always open the popover below the field (skip auto flip-up)
}

// Modern searchable account picker (combobox).
// Replaces the plain account <select> in the quote/invoice wizards:
// shows the selected account with an avatar + context line, and opens a
// search-as-you-type popover that matches name, location, city, email,
// phone, or tags. Themed via CSS variables, full keyboard navigation.
export default function AccountSearchSelect({
  customers, value, onChange, disabled, placeholder = "Search accounts…", forceDown,
}: AccountSearchSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIdx, setActiveIdx] = useState(0);
  // Flip the popover above the trigger when there isn't enough room below.
  const [dropUp, setDropUp] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = customers.find(c => c.id === value);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter(c => {
      const hay = [
        c.name, c.type, c.status, c.locationName,
        c.city, c.state, c.zip, c.email ?? "", c.phone,
        ...c.tags,
      ].join(" ").toLowerCase();
      return q.split(/\s+/).every(term => hay.includes(term));
    });
  }, [customers, query]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  // Focus the search field + reset highlight when opening
  useEffect(() => {
    if (open) {
      setActiveIdx(0);
      const id = requestAnimationFrame(() => inputRef.current?.focus());
      return () => cancelAnimationFrame(id);
    }
    setQuery("");
  }, [open]);

  // Keep the highlighted row in view
  useEffect(() => { setActiveIdx(0); }, [query]);

  // Open upward when the popover (search box + ~300px list) would run off-screen.
  // Skipped entirely when forceDown is set — the popover always opens below.
  useLayoutEffect(() => {
    if (forceDown) { setDropUp(false); return; }
    if (!open || !btnRef.current) return;
    const measure = () => {
      const rect = btnRef.current!.getBoundingClientRect();
      const below = window.innerHeight - rect.bottom;
      setDropUp(below < 360 && rect.top > below);
    };
    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [open, forceDown]);

  function choose(id: string) {
    onChange(id);
    setOpen(false);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") { setOpen(false); return; }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx(i => Math.min(i + 1, results.length - 1));
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx(i => Math.max(i - 1, 0));
    }
    if (e.key === "Enter") {
      e.preventDefault();
      const pick = results[activeIdx];
      if (pick) choose(pick.id);
    }
  }

  return (
    <div ref={wrapRef} className="relative w-full">
      {/* Trigger */}
      <button
        ref={btnRef}
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen(o => !o)}
        className="w-full flex items-center justify-between gap-2 rounded-lg outline-none transition-colors px-3 py-2"
        style={{
          border: `1px solid ${open ? "#a5b4fc" : "var(--border)"}`,
          backgroundColor: "var(--bg-surface)",
          boxShadow: open ? "0 0 0 3px rgba(99,102,241,0.12)" : "none",
          opacity: disabled ? 0.5 : 1,
          cursor: disabled ? "not-allowed" : "pointer",
        }}
      >
        {selected ? (
          <span className="flex items-center gap-2.5 min-w-0">
            <Avatar customer={selected} />
            <span className="flex flex-col min-w-0 text-left">
              <span className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>{selected.name}</span>
              <span className="text-[11px] truncate" style={{ color: "var(--text-muted)" }}>{subtitle(selected)}</span>
            </span>
          </span>
        ) : (
          <span className="text-sm" style={{ color: "var(--text-muted)" }}>{placeholder}</span>
        )}
        <ChevronDown className="w-3.5 h-3.5 shrink-0 transition-transform"
          style={{ color: "var(--text-muted)", transform: open ? "rotate(180deg)" : "none" }} />
      </button>

      {/* Popover */}
      {open && (
        <div
          className="absolute left-0 right-0 z-50 rounded-xl overflow-hidden"
          style={{
            backgroundColor: "var(--bg-surface)",
            border: "1px solid var(--border)",
            boxShadow: "0 12px 32px rgba(0,0,0,0.16)",
            ...(dropUp ? { bottom: "100%", marginBottom: 6 } : { top: "100%", marginTop: 6 }),
          }}
        >
          {/* Search field */}
          <div className="flex items-center gap-2 px-3 py-2.5" style={{ borderBottom: "1px solid var(--border)" }}>
            <Search className="w-4 h-4 shrink-0" style={{ color: "var(--text-muted)" }} />
            <input
              ref={inputRef}
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Search by name, location, email, phone…"
              className="flex-1 bg-transparent outline-none text-sm"
              style={{ color: "var(--text-primary)" }}
            />
            {query && (
              <button type="button" onClick={() => { setQuery(""); inputRef.current?.focus(); }} style={{ color: "var(--text-muted)" }}>
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Results */}
          <div className="p-1 overflow-y-auto thin-scroll-y" style={{ maxHeight: "300px" }}>
            {results.length === 0 ? (
              <div className="px-3 py-6 text-center text-xs" style={{ color: "var(--text-muted)" }}>
                No accounts match “{query}”.
              </div>
            ) : (
              results.map((c, i) => {
                const isSelected = c.id === value;
                const isActive = i === activeIdx;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => choose(c.id)}
                    onMouseEnter={() => setActiveIdx(i)}
                    className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left transition-colors"
                    style={{ backgroundColor: isActive ? "var(--bg-surface-2)" : "transparent" }}
                  >
                    <Avatar customer={c} />
                    <span className="flex flex-col min-w-0 flex-1">
                      <span className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>{c.name}</span>
                      <span className="text-[11px] truncate" style={{ color: "var(--text-muted)" }}>{subtitle(c)}</span>
                    </span>
                    <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full shrink-0"
                      style={{ backgroundColor: "var(--bg-input)", color: "var(--text-muted)" }}>{c.status}</span>
                    {isSelected && <Check className="w-3.5 h-3.5 shrink-0" style={{ color: "#4f46e5" }} />}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// "Commercial · Augusta Branch · Augusta, GA"
function subtitle(c: Customer): string {
  return [c.type, c.locationName, `${c.city}, ${c.state}`].filter(Boolean).join(" · ");
}

function Avatar({ customer }: { customer: Customer }) {
  const commercial = customer.type === "Commercial";
  const Icon = commercial ? Building2 : Home;
  return (
    <span className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 relative"
      style={{ backgroundColor: "var(--accent-soft-bg)" }}>
      <span className="text-[11px] font-bold" style={{ color: "var(--accent-text-strong)" }}>{customer.initials}</span>
      <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full flex items-center justify-center"
        style={{ backgroundColor: "var(--bg-surface)" }}>
        <Icon className="w-2 h-2" style={{ color: "var(--text-muted)" }} />
      </span>
    </span>
  );
}
