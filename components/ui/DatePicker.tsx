"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react";

// Themed date picker — a calendar popover that matches the Select dropdown.
// Value is a "yyyy-mm-dd" string (drop-in for a native <input type="date">).
// The calendar renders in a portal with fixed positioning so it OVERLAYS its
// container (e.g. a scrollable modal body) instead of being clipped by it.
interface Props {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  size?: "sm" | "md";
  className?: string;
  min?: string;          // "yyyy-mm-dd" — earliest selectable date
  max?: string;          // "yyyy-mm-dd" — latest selectable date
  clearable?: boolean;
}

function parseYMD(v: string): Date | null {
  if (!v) return null;
  const [y, m, d] = v.split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}
function toYMD(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

const POP_W = 256;
const POP_H = 312;   // approx height for flip math

export default function DatePicker({ value, onChange, placeholder = "Select date", size = "md", className, min, max, clearable = true }: Props) {
  const [open, setOpen] = useState(false);
  const sel = parseYMD(value);
  const [view, setView] = useState<Date>(() => sel ?? new Date());
  const wrapRef = useRef<HTMLDivElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  // Anchor the portal popover to the trigger, flipping above when there's no
  // room below and clamping to the viewport so it's never off-screen.
  const place = useCallback(() => {
    const el = wrapRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    let left = Math.min(r.left, window.innerWidth - POP_W - 8);
    left = Math.max(8, left);
    // Always open DOWNWARD from the field (never flip up above it). It floats over
    // surrounding content via the portal; if it would run past the bottom edge we
    // clamp it up just enough to stay on-screen rather than flipping high.
    let top = r.bottom + 6;
    const maxTop = window.innerHeight - POP_H - 8;
    if (top > maxTop) top = Math.max(8, maxTop);
    setPos({ top, left });
  }, []);

  useEffect(() => {
    if (!open) return;
    if (sel) setView(sel);
    place();
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (wrapRef.current?.contains(t) || popRef.current?.contains(t)) return;
      setOpen(false);
    };
    const reposition = () => place();
    document.addEventListener("mousedown", onDoc);
    window.addEventListener("scroll", reposition, true);   // capture: catches nested scrollers (modal body)
    window.addEventListener("resize", reposition);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      window.removeEventListener("scroll", reposition, true);
      window.removeEventListener("resize", reposition);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const pad = size === "sm" ? "px-2.5 py-1.5 text-xs" : "px-3 py-2 text-sm";
  const today = new Date();
  const minD = parseYMD(min ?? "");
  const maxD = parseYMD(max ?? "");
  const outOfRange = (d: Date) => (minD && d < minD && !sameDay(d, minD)) || (maxD && d > maxD && !sameDay(d, maxD));

  const monthStart = new Date(view.getFullYear(), view.getMonth(), 1);
  const gridStart = new Date(monthStart); gridStart.setDate(gridStart.getDate() - gridStart.getDay());
  const days = Array.from({ length: 42 }, (_, i) => { const d = new Date(gridStart); d.setDate(gridStart.getDate() + i); return d; });

  function choose(d: Date) { onChange(toYMD(d)); setOpen(false); }

  return (
    <div ref={wrapRef} className={`relative ${className ?? "w-full"}`}>
      <button type="button" onClick={() => setOpen(o => !o)}
        className={`w-full flex items-center justify-between gap-2 rounded-lg outline-none transition-colors ${pad}`}
        style={{
          border: `1px solid ${open ? "#a5b4fc" : "var(--border)"}`,
          backgroundColor: "var(--bg-surface)",
          color: sel ? "var(--text-primary)" : "var(--text-muted)",
          boxShadow: open ? "0 0 0 3px rgba(99,102,241,0.12)" : "none",
        }}>
        <span className="truncate text-left">{sel ? sel.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : placeholder}</span>
        <CalendarIcon className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--text-muted)" }} />
      </button>

      {open && pos && typeof document !== "undefined" && createPortal(
        <div ref={popRef} className="fixed p-3 rounded-xl"
          style={{ top: pos.top, left: pos.left, width: POP_W, zIndex: 9999, backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "0 12px 32px rgba(0,0,0,0.16)" }}>
          <div className="flex items-center justify-between mb-2">
            <button type="button" onClick={() => setView(v => new Date(v.getFullYear(), v.getMonth() - 1, 1))}
              className="p-1 rounded-lg hover:bg-[var(--bg-surface-2)]" style={{ color: "var(--text-secondary)" }}><ChevronLeft className="w-4 h-4" /></button>
            <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{view.toLocaleDateString("en-US", { month: "long", year: "numeric" })}</span>
            <button type="button" onClick={() => setView(v => new Date(v.getFullYear(), v.getMonth() + 1, 1))}
              className="p-1 rounded-lg hover:bg-[var(--bg-surface-2)]" style={{ color: "var(--text-secondary)" }}><ChevronRight className="w-4 h-4" /></button>
          </div>

          <div className="grid grid-cols-7 mb-1">
            {["S", "M", "T", "W", "T", "F", "S"].map((w, i) => (
              <span key={i} className="text-center text-[10px] font-semibold py-1" style={{ color: "var(--text-muted)" }}>{w}</span>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-0.5">
            {days.map((d, i) => {
              const inMonth = d.getMonth() === view.getMonth();
              const isSel = sel ? sameDay(d, sel) : false;
              const isToday = sameDay(d, today);
              const disabled = !!outOfRange(d);
              return (
                <button key={i} type="button" disabled={disabled} onClick={() => choose(d)}
                  className={`h-8 rounded-lg text-xs flex items-center justify-center transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${isSel ? "" : "hover:bg-[var(--bg-surface-2)]"}`}
                  style={{
                    backgroundColor: isSel ? "#4f46e5" : undefined,
                    color: isSel ? "#fff" : inMonth ? "var(--text-primary)" : "var(--text-muted)",
                    fontWeight: isSel || isToday ? 600 : 400,
                    border: isToday && !isSel ? "1px solid var(--accent-soft-border)" : "1px solid transparent",
                  }}>
                  {d.getDate()}
                </button>
              );
            })}
          </div>

          <div className="flex items-center justify-between mt-2 pt-2" style={{ borderTop: "1px solid var(--border)" }}>
            <button type="button" disabled={!!outOfRange(today)} onClick={() => choose(new Date())} className="text-xs font-medium disabled:opacity-30 disabled:cursor-not-allowed" style={{ color: "var(--accent-text)" }}>Today</button>
            {clearable && value && (
              <button type="button" onClick={() => { onChange(""); setOpen(false); }} className="text-xs" style={{ color: "var(--text-muted)" }}>Clear</button>
            )}
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
