import { Delayed, Skeleton } from "@/components/ui/Skeleton";

// Dispatch-board-shaped skeleton. The board is NOT a kanban — it's a header
// (title · centered date nav · view toggle) over a toolbar, then a tall
// time-grid calendar. The root is full-height (h-full flex) and the grid grows
// to fill so the loader never leaves a blank bottom before the real grid mounts.
export default function Loading() {
  return (
    <Delayed>
      <div className="p-6 h-full flex flex-col gap-4">
        {/* Header — title (left) · centered date nav · toggle (right) */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="flex-1 min-w-0 space-y-2">
            <Skeleton className="h-6 w-40 rounded-md" />
            <Skeleton className="h-3.5 w-80 max-w-full rounded" />
          </div>
          <div className="flex flex-col items-center gap-1.5 shrink-0">
            <Skeleton className="h-4 w-32 rounded" />
            <Skeleton className="h-6 w-28 rounded-md" />
          </div>
          <div className="flex-1 flex justify-end shrink-0">
            <Skeleton className="h-8 w-36 rounded-lg" />
          </div>
        </div>

        {/* Toolbar — view tabs (left) · actions (right) */}
        <div className="flex items-center justify-between flex-wrap gap-3 shrink-0">
          <Skeleton className="h-9 w-72 max-w-full rounded-lg" />
          <div className="flex items-center gap-2">
            <Skeleton className="h-8 w-8 rounded-lg" />
            <Skeleton className="h-8 w-28 rounded-lg" />
          </div>
        </div>

        {/* Time-grid calendar — fills the remaining height */}
        <div className="rounded-xl overflow-hidden flex-1 min-h-0 flex flex-col" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" }}>
          {/* Column header (time gutter + resource/day columns) */}
          <div className="flex shrink-0" style={{ borderBottom: "1px solid var(--border)", backgroundColor: "var(--bg-surface-2)" }}>
            <div className="w-16 shrink-0 px-3 py-2.5" />
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex-1 px-3 py-2.5 flex items-center gap-2" style={{ borderLeft: "1px solid var(--border)" }}>
                <Skeleton className="w-6 h-6 rounded-full shrink-0" />
                <Skeleton className="h-3 w-20 rounded" />
              </div>
            ))}
          </div>
          {/* Hourly rows grow to fill, with a scattering of scheduled blocks */}
          <div className="flex-1 min-h-0 flex flex-col">
            {Array.from({ length: 9 }).map((_, r) => (
              <div key={r} className="flex flex-1 min-h-[44px]" style={{ borderTop: r === 0 ? "none" : "1px solid var(--border)" }}>
                <div className="w-16 shrink-0 px-3 py-2">
                  <Skeleton className="h-2.5 w-10 rounded" />
                </div>
                {Array.from({ length: 5 }).map((_, c) => (
                  <div key={c} className="flex-1 p-1.5" style={{ borderLeft: "1px solid var(--border)" }}>
                    {(r + c) % 3 === 0 && <Skeleton className="h-full rounded-lg" />}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </Delayed>
  );
}
