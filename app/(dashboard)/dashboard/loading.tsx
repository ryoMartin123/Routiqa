"use client";

import { Delayed, Skeleton, SkeletonCircle } from "@/components/ui/Skeleton";
import { loadLayout } from "@/lib/dashboard/layouts";

// Adaptive dashboard skeleton. The dashboard is a grid of widgets the user can
// add, move, and resize, so the loader reads the SAVED layout and mirrors each
// visible widget's WIDTH and HEIGHT. We pack widgets in their saved order with
// the same 12-col grid / 50px rows / 16px gaps as DashboardGrid (auto-flow
// instead of absolute x/y, which avoids the gaps + overlaps a customized layout
// could otherwise produce). Each tile gets realistic internals for its size so
// it reads as widgets loading — not empty boxes. <Delayed> renders only on the
// client, so reading the persisted layout here is hydration-safe.
const surface = { backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" } as const;
const inset = { backgroundColor: "var(--bg-surface-2)" } as const;

function WidgetTile({ w, h }: { w: number; h: number }) {
  const colSpan = Math.min(Math.max(w, 2), 12);
  const kind: "strip" | "list" | "mini" = h <= 3 ? "strip" : h >= 6 ? "list" : "mini";

  return (
    <div className="rounded-xl p-4 flex flex-col overflow-hidden" style={{ gridColumn: `span ${colSpan}`, gridRow: `span ${h}`, ...surface }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3 shrink-0">
        <Skeleton className="h-3.5 w-28 max-w-[55%] rounded" />
        <Skeleton className="h-5 w-5 rounded-md" />
      </div>

      {kind === "strip" && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 flex-1 min-h-0">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-lg p-3 flex flex-col justify-center gap-2" style={inset}>
              <Skeleton className="h-2.5 w-12 rounded" />
              <Skeleton className="h-5 w-10 rounded-md" />
            </div>
          ))}
        </div>
      )}

      {kind === "list" && (
        <div className="flex-1 min-h-0 space-y-3.5 overflow-hidden">
          {Array.from({ length: Math.min(6, Math.max(3, h - 2)) }).map((_, i) => (
            <div key={i} className="flex items-center gap-2.5">
              <SkeletonCircle size={30} />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-3 w-1/2 rounded" />
                <Skeleton className="h-2.5 w-1/3 rounded" />
              </div>
              <Skeleton className="h-4 w-12 rounded-full shrink-0" />
            </div>
          ))}
        </div>
      )}

      {kind === "mini" && (
        <div className="flex-1 min-h-0 flex flex-col">
          <Skeleton className="h-7 w-20 rounded-md mb-1.5" />
          <Skeleton className="h-2.5 w-24 rounded mb-3" />
          {/* little bar-chart placeholder */}
          <div className="flex-1 min-h-0 flex items-end gap-1.5">
            {[55, 80, 40, 95, 65, 75].map((p, i) => (
              <Skeleton key={i} className="flex-1 rounded-sm" style={{ height: `${p}%`, minHeight: 8 }} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function Loading() {
  const widgets = loadLayout().filter(w => w.visible).sort((a, b) => a.order - b.order);

  return (
    <Delayed>
      <div className="p-6 space-y-4">
        {/* Header — title (left) · greeting (center) · customize (right) */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex-1 min-w-0 space-y-2">
            <Skeleton className="h-7 w-40 rounded-md" />
            <Skeleton className="h-3.5 w-80 max-w-full rounded" />
          </div>
          <div className="flex-1 hidden md:flex justify-center">
            <Skeleton className="h-3.5 w-56 rounded" />
          </div>
          <div className="flex-1 flex justify-end">
            <Skeleton className="h-9 w-28 rounded-lg" />
          </div>
        </div>

        {/* Widget grid — packs widgets in saved order at their real sizes */}
        <div className="grid" style={{ gridTemplateColumns: "repeat(12, minmax(0, 1fr))", gridAutoRows: "50px", gridAutoFlow: "row dense", gap: "16px" }}>
          {widgets.map(w => <WidgetTile key={w.widgetId} w={w.w} h={w.h} />)}
        </div>
      </div>
    </Delayed>
  );
}
