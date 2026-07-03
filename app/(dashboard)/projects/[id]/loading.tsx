import { Delayed, Skeleton } from "@/components/ui/Skeleton";

// Matches the project detail layout (header bar + tabs + Overview content) so the
// loading→page hand-off doesn't jump. Without this, navigating from the cards
// briefly showed the parent /projects cards-grid skeleton, then snapped to the
// detail layout — the jitter. A close-matching skeleton keeps the swap still.
const surface = { backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)" } as const;

export default function Loading() {
  return (
    <Delayed>
      <div className="flex flex-col h-full">
        {/* Header bar — back · title · actions, then the sub-tabs */}
        <div style={{ backgroundColor: "var(--bg-surface)", borderBottom: "1px solid var(--border)" }}>
          <div className="flex items-center justify-between px-6 py-4">
            <div className="flex items-center gap-4 min-w-0">
              <Skeleton className="h-4 w-20 rounded" />
              <div className="w-px h-5" style={{ backgroundColor: "var(--border)" }} />
              <div className="space-y-1.5">
                <Skeleton className="h-5 w-56 rounded-md" />
                <Skeleton className="h-3 w-40 rounded" />
              </div>
            </div>
            <Skeleton className="h-8 w-8 rounded-lg" />
          </div>
          <div className="flex items-center gap-2 px-6 py-2">
            {Array.from({ length: 9 }).map((_, i) => <Skeleton key={i} className="h-7 w-20 rounded-lg shrink-0" />)}
          </div>
        </div>

        {/* Content — Overview shape: 6 stat cards · details + side · Jobs/Tasks
            (the last row fills the rest so the loader covers the whole section). */}
        <div className="flex-1 overflow-y-auto p-6" style={{ backgroundColor: "var(--bg-page)" }}>
          <div className="flex flex-col gap-5 h-full min-h-0">
            {/* Row 1 — summary stat cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 shrink-0">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="rounded-xl p-4" style={surface}>
                  <Skeleton className="h-3 w-16 rounded mb-2.5" />
                  <Skeleton className="h-6 w-12 rounded mb-1.5" />
                  <Skeleton className="h-3 w-20 rounded" />
                </div>
              ))}
            </div>

            {/* Row 2 — details (2/3) + side (1/3) */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 shrink-0">
              <div className="lg:col-span-2 rounded-xl p-4" style={surface}>
                <Skeleton className="h-4 w-32 rounded mb-4" />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3.5">
                  {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-4 w-full rounded" />)}
                </div>
              </div>
              <div className="flex flex-col gap-4">
                <Skeleton className="h-28 rounded-xl" />
                <div className="rounded-xl p-4" style={surface}>
                  <Skeleton className="h-3.5 w-28 rounded mb-3" />
                  <div className="grid grid-cols-2 gap-2">
                    {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 rounded-lg" />)}
                  </div>
                </div>
              </div>
            </div>

            {/* Row 3 — Jobs (2/3) + Open Tasks (1/3), fills remaining height */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 flex-1 min-h-0">
              <div className="lg:col-span-2 rounded-xl overflow-hidden flex flex-col" style={surface}>
                <div className="px-4 py-3 shrink-0" style={{ borderBottom: "1px solid var(--border)" }}>
                  <Skeleton className="h-3.5 w-16 rounded" />
                </div>
                <div className="flex-1 min-h-0 p-4 space-y-3.5">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="flex items-center justify-between gap-3">
                      <div className="flex-1 space-y-1.5">
                        <Skeleton className="h-3.5 w-1/2 rounded" />
                        <Skeleton className="h-3 w-1/3 rounded" />
                      </div>
                      <Skeleton className="h-5 w-16 rounded-full shrink-0" />
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-xl overflow-hidden flex flex-col" style={surface}>
                <div className="px-4 py-3 shrink-0" style={{ borderBottom: "1px solid var(--border)" }}>
                  <Skeleton className="h-3.5 w-24 rounded" />
                </div>
                <div className="flex-1 min-h-0 p-4 space-y-3">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-2.5">
                      <Skeleton className="w-4 h-4 rounded-full shrink-0" />
                      <Skeleton className="h-3.5 flex-1 rounded" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Delayed>
  );
}
