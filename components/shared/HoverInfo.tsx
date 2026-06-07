"use client";

// ─── HoverInfo ────────────────────────────────────────────
// Replaces a noisy row of inline status/type pills with a single subtle "ⓘ"
// trigger; the pills surface on hover (or keyboard focus) only when wanted.

import { Info } from "lucide-react";
import { cn } from "@/lib/utils";

export function Pill({ text, style }: { text: string; style: React.CSSProperties }) {
  return (
    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap" style={style}>
      {text}
    </span>
  );
}

export function HoverInfo({ rows }: { rows: { label: string; node: React.ReactNode }[] }) {
  return (
    <span className="relative inline-flex group/info align-middle shrink-0">
      <button
        type="button"
        aria-label="Show details"
        className="inline-flex items-center justify-center w-5 h-5 rounded-full transition-colors hover:bg-[var(--bg-surface-2)]"
        style={{ color: "var(--text-muted)", border: "1px solid var(--border)" }}
      >
        <Info className="w-3 h-3" />
      </button>
      {/* Opens to the RIGHT of the trigger; pl-2 is a hover "bridge" so moving the
          cursor into the panel keeps it open. */}
      <span
        role="tooltip"
        className={cn(
          "absolute left-full top-1/2 -translate-y-1/2 pl-2 z-30 opacity-0 invisible transition-opacity duration-150",
          "group-hover/info:opacity-100 group-hover/info:visible group-focus-within/info:opacity-100 group-focus-within/info:visible",
        )}
      >
        <span
          className="flex flex-col divide-y rounded-xl overflow-hidden min-w-[200px]"
          style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "0 12px 32px rgba(0,0,0,0.18)", borderColor: "var(--border-subtle)" }}
        >
          {rows.map(r => (
            <span key={r.label} className="flex items-center justify-between gap-4 px-3 py-2" style={{ borderColor: "var(--border-subtle)" }}>
              <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>{r.label}</span>
              {r.node}
            </span>
          ))}
        </span>
      </span>
    </span>
  );
}

export default HoverInfo;
