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

export function HoverInfo({ rows, placement = "right" }: {
  rows: { label: string; node: React.ReactNode }[];
  // "right" (default) opens beside the trigger — fine mid-page. "bottom" opens
  // downward, used in page headers where opening up/right would be clipped by the
  // scrollable content area's top edge (under the nav).
  placement?: "right" | "bottom";
}) {
  // Each variant includes a transparent "bridge" (pl-2 / pt-2) so the cursor can
  // travel from the trigger into the panel without it closing.
  const pos = placement === "bottom"
    ? "top-full left-0 pt-2"
    : "left-full top-1/2 -translate-y-1/2 pl-2";
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
      <span
        role="tooltip"
        className={cn(
          "absolute z-50 opacity-0 invisible transition-opacity duration-150",
          pos,
          "group-hover/info:opacity-100 group-hover/info:visible group-focus-within/info:opacity-100 group-focus-within/info:visible",
        )}
      >
        <span
          className="flex flex-col divide-y rounded-xl overflow-hidden min-w-[200px] w-max"
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
