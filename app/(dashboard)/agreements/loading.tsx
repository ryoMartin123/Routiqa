"use client";

import { Delayed, Skeleton } from "@/components/ui/Skeleton";
import { useSectionCount } from "@/lib/ui/skeleton-count";

// Agreements defaults to the Cards view — match the card grid so the swap is
// seamless. Data-aware: render as many cards as there are agreements (0 → shell only).
const surface = { backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)" } as const;

export default function Loading() {
  const count = useSectionCount("agreements");
  return (
    <Delayed>
      <div className="p-6">
        {/* Header — title · view toggle · action */}
        <div className="flex items-center gap-4 mb-6">
          <div className="flex-1 min-w-0 space-y-2">
            <Skeleton className="h-6 w-40 rounded-md" />
            <Skeleton className="h-3.5 w-80 rounded" />
          </div>
          <Skeleton className="h-9 w-56 rounded-lg shrink-0" />
          <div className="flex-1 flex justify-end"><Skeleton className="h-9 w-32 rounded-lg" /></div>
        </div>

        {/* Tabs (left) · search + filter (right) */}
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-1.5">
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-8 w-24 rounded-lg" />)}
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-8 w-52 rounded-lg" />
            <Skeleton className="h-8 w-20 rounded-lg" />
          </div>
        </div>

        {/* Cards grid — only when there are agreements */}
        {count > 0 && (
        <div className="grid gap-3 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: count }).map((_, i) => (
            <div key={i} className="rounded-lg p-3" style={{ ...surface, borderLeft: "3px solid var(--border)" }}>
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex items-center gap-1.5">
                  <Skeleton className="h-4 w-16 rounded" />
                  <Skeleton className="h-4 w-14 rounded" />
                </div>
                <Skeleton className="h-3.5 w-12 rounded" />
              </div>
              <Skeleton className="h-4 w-2/3 rounded mb-1.5" />
              <Skeleton className="h-3 w-1/2 rounded" />
              <div className="flex items-center justify-between mt-3 pt-2" style={{ borderTop: "1px solid var(--border)" }}>
                <Skeleton className="h-3 w-24 rounded" />
                <Skeleton className="h-3 w-16 rounded" />
              </div>
            </div>
          ))}
        </div>
        )}
      </div>
    </Delayed>
  );
}
