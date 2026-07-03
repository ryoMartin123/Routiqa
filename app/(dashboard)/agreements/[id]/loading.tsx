import { Delayed, Skeleton } from "@/components/ui/Skeleton";

// Agreement-detail-shaped skeleton — mirrors the real Overview so opening an
// agreement doesn't flash a mismatched layout: a header bar + tabs, then the
// 6 summary cards and the details (2/3) + people/next-steps (1/3) grid that
// fills the remaining height.
const surface = { backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)" } as const;

export default function Loading() {
  return (
    <Delayed>
      <div className="flex flex-col h-full">
        {/* Header bar — back · title · actions, then sub-tabs */}
        <div style={{ backgroundColor: "var(--bg-surface)", borderBottom: "1px solid var(--border)" }}>
          <div className="flex items-center justify-between px-6 py-4">
            <div className="flex items-center gap-4 min-w-0">
              <Skeleton className="h-4 w-24 rounded" />
              <div className="w-px h-5" style={{ backgroundColor: "var(--border)" }} />
              <div className="space-y-1.5">
                <Skeleton className="h-5 w-56 rounded-md" />
                <Skeleton className="h-3 w-44 rounded" />
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Skeleton className="h-9 w-28 rounded-lg" />
              <Skeleton className="h-9 w-9 rounded-lg" />
            </div>
          </div>
          <div className="flex items-center gap-2 px-6 pb-2">
            {Array.from({ length: 10 }).map((_, i) => (
              <Skeleton key={i} className="h-7 rounded-full shrink-0" style={{ width: `${4.5 + (i % 3)}rem` }} />
            ))}
          </div>
        </div>

        {/* Content — Overview shape, fills the height */}
        <div className="flex-1 overflow-hidden p-6" style={{ backgroundColor: "var(--bg-page)" }}>
          <div className="flex flex-col gap-5 h-full">
            {/* 6 summary cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 shrink-0">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="rounded-xl p-3.5" style={surface}>
                  <Skeleton className="h-2.5 w-14 rounded mb-2.5" />
                  <Skeleton className="h-5 w-16 rounded mb-1.5" />
                  <Skeleton className="h-2.5 w-20 rounded" />
                </div>
              ))}
            </div>

            {/* Details (2/3) + People / Next steps (1/3) — fills remaining height */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 flex-1 min-h-0">
              <div className="lg:col-span-2 rounded-xl p-4" style={surface}>
                <Skeleton className="h-3.5 w-36 rounded mb-4" />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
                  {Array.from({ length: 10 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-2.5">
                      <Skeleton className="w-4 h-4 rounded shrink-0" />
                      <Skeleton className="h-3.5 flex-1 rounded" />
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex flex-col gap-4">
                <div className="rounded-xl p-4 flex-1" style={surface}>
                  <Skeleton className="h-3.5 w-20 rounded mb-4" />
                  <div className="space-y-3.5">
                    {Array.from({ length: 2 }).map((_, i) => (
                      <div key={i} className="flex items-center gap-2.5">
                        <Skeleton className="w-4 h-4 rounded shrink-0" />
                        <Skeleton className="h-3.5 flex-1 rounded" />
                      </div>
                    ))}
                  </div>
                </div>
                <div className="rounded-xl p-4 flex-1" style={surface}>
                  <Skeleton className="h-3.5 w-24 rounded mb-4" />
                  <div className="space-y-3.5">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <div key={i} className="flex items-center gap-2.5">
                        <Skeleton className="w-4 h-4 rounded shrink-0" />
                        <Skeleton className="h-3.5 flex-1 rounded" />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Delayed>
  );
}
