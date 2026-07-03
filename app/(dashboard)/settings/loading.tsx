import { Skeleton, PageHeaderSkeleton, Delayed } from "@/components/ui/Skeleton";

// Settings has its own two-column shell (category rail + content), so it gets a
// matching skeleton rather than the generic page variant. Gated by Delayed so a
// fast load doesn't flash the skeleton.
export default function Loading() {
  return (
    <Delayed>
    <div className="flex h-full" style={{ backgroundColor: "var(--bg-page)" }}>
      <div className="w-44 shrink-0 py-5 px-2 space-y-1.5" style={{ backgroundColor: "var(--bg-surface)", borderRight: "1px solid var(--border)" }}>
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-8 rounded-lg" />
        ))}
      </div>
      <div className="flex-1 overflow-hidden p-6">
        <PageHeaderSkeleton withAction={false} />
        <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))" }}>
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
      </div>
    </div>
    </Delayed>
  );
}
