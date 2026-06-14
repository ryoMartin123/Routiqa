"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ChevronDown, Check } from "lucide-react";

export interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps {
  value:        string;
  onChange:     (value: string) => void;
  options:      SelectOption[];
  placeholder?: string;
  disabled?:    boolean;
  className?:   string;     // applied to the trigger button (for width/sizing)
  size?:        "sm" | "md";
}

// Clean, modern dropdown that replaces native <select>.
// Matches the Places-autocomplete dropdown styling (rounded, soft shadow,
// indigo selected state) and themes via CSS variables.
export default function Select({
  value, onChange, options, placeholder = "Select…", disabled, className, size = "md",
}: SelectProps) {
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState<number>(-1);
  // Flip the popup above the trigger (and cap its height) when there isn't
  // enough room below — keeps it on-screen inside scrolling drawers/wizards.
  const [placement, setPlacement] = useState<{ dropUp: boolean; maxH: number }>({ dropUp: false, maxH: 260 });
  const wrapRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  const selected = options.find(o => o.value === value);
  const pad = size === "sm" ? "px-2.5 py-1.5 text-xs" : "px-3 py-2 text-sm";

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  // Sync active index to the current value when opening
  useEffect(() => {
    if (open) setActiveIdx(options.findIndex(o => o.value === value));
  }, [open, value, options]);

  // Decide drop direction + max height from the room around the trigger.
  useLayoutEffect(() => {
    if (!open || !btnRef.current) return;
    const GAP = 6, MARGIN = 8, IDEAL = 260;
    const measure = () => {
      const rect = btnRef.current!.getBoundingClientRect();
      const below = window.innerHeight - rect.bottom - GAP - MARGIN;
      const above = rect.top - GAP - MARGIN;
      const dropUp = below < Math.min(IDEAL, options.length * 38 + 8) && above > below;
      setPlacement({ dropUp, maxH: Math.max(120, Math.min(IDEAL, dropUp ? above : below)) });
    };
    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [open, options.length]);

  function choose(v: string) {
    onChange(v);
    setOpen(false);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (disabled) return;
    if (e.key === "Escape") { setOpen(false); return; }
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (!open) { setOpen(true); return; }
      if (activeIdx >= 0 && options[activeIdx]) choose(options[activeIdx].value);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!open) { setOpen(true); return; }
      setActiveIdx(i => Math.min((i < 0 ? -1 : i) + 1, options.length - 1));
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx(i => Math.max((i < 0 ? options.length : i) - 1, 0));
    }
  }

  return (
    <div ref={wrapRef} className={`relative ${className ?? "w-full"}`}>
      {/* Trigger */}
      <button
        ref={btnRef}
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen(o => !o)}
        onKeyDown={onKeyDown}
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
        <span className="truncate text-left">{selected ? selected.label : placeholder}</span>
        <ChevronDown className="w-3.5 h-3.5 shrink-0 transition-transform"
          style={{ color: "var(--text-muted)", transform: open ? "rotate(180deg)" : "none" }} />
      </button>

      {/* Popup */}
      {open && (
        <div
          className="absolute left-0 right-0 z-50 p-1 rounded-xl overflow-y-auto"
          style={{
            backgroundColor: "var(--bg-surface)",
            border: "1px solid var(--border)",
            boxShadow: "0 12px 32px rgba(0,0,0,0.16)",
            maxHeight: placement.maxH,
            ...(placement.dropUp ? { bottom: "100%", marginBottom: 6 } : { top: "100%", marginTop: 6 }),
          }}
          role="listbox"
        >
          {options.map((o, i) => {
            const isSelected = o.value === value;
            const isActive = i === activeIdx;
            return (
              <button
                key={o.value || `opt-${i}`}
                type="button"
                onClick={() => choose(o.value)}
                onMouseEnter={() => setActiveIdx(i)}
                role="option"
                aria-selected={isSelected}
                className="w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg text-left text-sm transition-colors"
                style={{
                  backgroundColor: isActive ? "var(--bg-surface-2)" : "transparent",
                  color: isSelected ? "#4f46e5" : "var(--text-secondary)",
                  fontWeight: isSelected ? 600 : 400,
                }}
              >
                <span className="truncate">{o.label}</span>
                {isSelected && <Check className="w-3.5 h-3.5 shrink-0" style={{ color: "#4f46e5" }} />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
