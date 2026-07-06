// ─── RowArrow ─────────────────────────────────────────────
// The app-wide "this row opens something" cue: an accent arrow pinned to the
// row's far right that fades in and nudges up-right on row hover. Host row
// needs `relative group` on its class list; the arrow sits in the row's right
// padding gutter so no grid template has to change.

import { ArrowUpRight } from "lucide-react";

export default function RowArrow() {
  return (
    <ArrowUpRight
      className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 opacity-0 transition-all duration-150 group-hover:opacity-100 group-hover:-translate-y-[60%] pointer-events-none shrink-0"
      style={{ color: "var(--accent-text)" }}
    />
  );
}
