import { Delayed, Skeleton, SkeletonCircle } from "@/components/ui/Skeleton";

// Account-detail-shaped skeleton. Mirrors the real page exactly so opening a
// customer fills the whole screen and the boxes line up: a sticky header
// (back · avatar · name · actions) + tabs, then the Overview layout — a row of
// 5 stat cards, the wide-account / current-work snapshot grid, and a tall
// activity panel that fills the rest. Wrapped in <Delayed> for the same
// anti-flash + minimum-visible hold as every other route skeleton.
export default function Loading() {
  return (
    <Delayed>
      <div className="flex flex-col h-full">
        {/* Sticky header */}
        <div style={{ backgroundColor: "var(--bg-surface)", borderBottom: "1px solid var(--border)" }}>
          {/* Top row */}
          <div className="flex items-center justify-between px-6 py-4">
            <div className="flex items-center gap-4 min-w-0">
              <Skeleton className="h-4 w-20 rounded" />
              <div className="w-px h-5" style={{ backgroundColor: "var(--border)" }} />
              <SkeletonCircle size={36} />
              <div className="space-y-1.5">
                <Skeleton className="h-4 w-44 rounded" />
                <Skeleton className="h-3 w-60 rounded" />
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Skeleton className="h-9 w-28 rounded-lg" />
              <Skeleton className="h-9 w-9 rounded-lg" />
            </div>
          </div>
          {/* Tabs */}
          <div className="flex items-center gap-2 px-6 py-2">
            {Array.from({ length: 9 }).map((_, i) => (
              <Skeleton key={i} className="h-7 rounded-full" style={{ width: `${4.5 + (i % 3)}rem` }} />
            ))}
          </div>
        </div>

        {/* Content — Overview shape */}
        <div className="flex-1 overflow-hidden p-6" style={{ backgroundColor: "var(--bg-page)" }}>
          <div className="h-full flex flex-col gap-5">
            {/* 5 stat cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2.5 shrink-0">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="rounded-xl px-3 py-2.5" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" }}>
                  <div className="flex items-center gap-1.5 mb-2">
                    <Skeleton className="w-3 h-3 rounded" />
                    <Skeleton className="h-2.5 w-16 rounded" />
                  </div>
                  <Skeleton className="h-4 w-20 rounded" />
                </div>
              ))}
            </div>

            {/* Snapshot grid: wide account (left) · current work (right) */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 shrink-0">
              <Skeleton className="lg:col-span-2 h-56 rounded-xl" />
              <Skeleton className="h-56 rounded-xl" />
            </div>

            {/* Recent activity fills the rest */}
            <Skeleton className="flex-1 min-h-0 rounded-xl" />
          </div>
        </div>
      </div>
    </Delayed>
  );
}
