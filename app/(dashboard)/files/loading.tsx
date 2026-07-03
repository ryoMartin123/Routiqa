"use client";

import { Delayed, Skeleton } from "@/components/ui/Skeleton";
import { useSectionCount } from "@/lib/ui/skeleton-count";

// Photos & Files mirror: header (title · view toggle · Upload) + the gallery's
// own toolbar (view tabs · search · filters) + a grid of 4:3 thumbnail tiles
// (same minmax(190px) grid as PhotoGallery). Data-aware: as many thumbnails as
// there are files (0 → shell only).
const surface = { backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" } as const;

export default function Loading() {
  const count = useSectionCount("files");
  return (
    <Delayed>
      <div className="p-6 space-y-5">
        {/* Header */}
        <div className="flex items-center gap-4">
          <div className="flex-1 min-w-0 space-y-2">
            <Skeleton className="h-6 w-44 rounded-md" />
            <Skeleton className="h-3.5 w-80 max-w-full rounded" />
          </div>
          <Skeleton className="h-9 w-40 rounded-lg shrink-0" />
          <div className="flex-1 flex justify-end">
            <Skeleton className="h-9 w-24 rounded-lg" />
          </div>
        </div>

        {/* Gallery */}
        <div className="space-y-4">
          {/* Toolbar — view tabs (left) · search + filters (right) */}
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <Skeleton className="h-9 w-64 max-w-full rounded-lg" />
            <div className="flex items-center gap-2">
              <Skeleton className="h-9 w-64 rounded-lg" />
              <Skeleton className="h-9 w-24 rounded-lg" />
            </div>
          </div>

          {/* Thumbnail grid — only when there are files */}
          {count > 0 && (
            <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))" }}>
              {Array.from({ length: count }).map((_, i) => (
                <div key={i} className="rounded-xl overflow-hidden" style={surface}>
                  <Skeleton className="aspect-[4/3] rounded-none" />
                  <div className="p-2.5 space-y-1.5">
                    <Skeleton className="h-3 w-2/3 rounded" />
                    <Skeleton className="h-2.5 w-1/2 rounded" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Delayed>
  );
}
