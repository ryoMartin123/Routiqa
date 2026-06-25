"use client";

// ─── Skeleton loading primitives ──────────────────────────
// Reusable placeholder shapes shown while a page route or major page content is
// loading. Pure presentational + CSS shimmer (.skeleton-block in globals.css).
// Compose the building blocks, or drop in a ready-made <PageSkeleton variant />.

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

// ─── Delay gate + minimum-visible hold ────────────────────
// Two-sided anti-flash for skeleton fallbacks:
//   • delay      — render nothing for the first `delay` ms. If the page is ready
//     quickly the fallback unmounts before the timer fires, so a fast load never
//     flashes a skeleton.
//   • minVisible — ONCE the skeleton has appeared, guarantee it stays on screen
//     for at least this long. A Next.js route `loading.tsx` fallback is unmounted
//     the instant the page is ready, so we can't hold it in React; instead, on
//     unmount we hand the rendered skeleton off to a lightweight DOM overlay that
//     lingers for the remaining time and fades out. The result: a load that
//     finishes just after `delay` still shows a calm skeleton for ~minVisible
//     rather than a sub-frame flash. (Mirrors AppLoadingOverlay's self-control.)
export function Delayed({
  delay = 200, minVisible = 600, fadeMs = 220, children,
}: { delay?: number; minVisible?: number; fadeMs?: number; children: React.ReactNode }) {
  const [show, setShow] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const shownAtRef = useRef<number | null>(null);
  // Bumped on every effect run; lets the deferred hand-off tell a real unmount
  // from React StrictMode's mount→unmount→mount double-invoke in development.
  const runIdRef = useRef(0);

  useEffect(() => {
    const t = setTimeout(() => setShow(true), delay);
    return () => clearTimeout(t);
  }, [delay]);

  useEffect(() => {
    if (!show) return;
    shownAtRef.current = Date.now();
    const runId = ++runIdRef.current;
    // Snapshot the skeleton's static markup NOW, while it's mounted and laid out.
    // We deliberately do NOT freeze its position: the `host` (page-content region)
    // stays mounted across the loading→page swap, so the hand-off overlay measures
    // it LIVE and tracks it every frame. That keeps the overlay glued to the
    // content even when the layout shifts mid-hold — e.g. collapsing the sidebar
    // (a 300ms width animation) or resizing the window — instead of floating at
    // stale coordinates, which was the visible "glitch".
    const node = ref.current;
    const host = node?.parentElement as HTMLElement | null;   // the page-content region (not the chrome)
    const html = node?.innerHTML ?? null;
    const initialRect = host?.getBoundingClientRect();
    const ok = !!(html && initialRect && initialRect.width > 0 && initialRect.height > 0);
    return () => {
      const shownAt = shownAtRef.current;
      if (shownAt == null || !ok || !host) return;
      const remaining = minVisible - (Date.now() - shownAt);
      if (remaining <= 0) return;            // already on screen long enough
      // Defer one tick: if a new effect run bumps runId first, this was a
      // StrictMode remount, not a teardown — skip the hand-off.
      setTimeout(() => {
        // Reading the *latest* runIdRef.current here is intentional — a bump means
        // a StrictMode remount happened, so this teardown isn't real.
        // eslint-disable-next-line react-hooks/exhaustive-deps
        if (runIdRef.current !== runId || typeof document === "undefined") return;
        try {
          const overlay = document.createElement("div");
          overlay.setAttribute("aria-hidden", "true");
          overlay.style.cssText = `position:fixed;overflow:hidden;z-index:30;background:var(--bg-page);transition:opacity ${fadeMs}ms ease;pointer-events:none;`;
          overlay.innerHTML = html!;
          document.body.appendChild(overlay);
          // Re-anchor to the live content region every frame so the overlay follows
          // any layout change while it's held (sidebar collapse/expand, resize).
          let raf = 0;
          const place = () => {
            const rect = host.isConnected ? host.getBoundingClientRect() : initialRect!;
            overlay.style.top = `${rect.top}px`;
            overlay.style.left = `${rect.left}px`;
            overlay.style.width = `${rect.width}px`;
            overlay.style.height = `${rect.height}px`;
            raf = requestAnimationFrame(place);
          };
          place();
          window.setTimeout(() => {
            overlay.style.opacity = "0";
            window.setTimeout(() => { cancelAnimationFrame(raf); overlay.remove(); }, fadeMs);
          }, remaining);
        } catch { /* best-effort hold */ }
      }, 0);
    };
  }, [show, minVisible, fadeMs]);

  if (!show) return null;
  // display:contents — the wrapper gives us a ref to snapshot on hand-off without
  // generating a box, so the skeleton's own layout (e.g. h-full) is unaffected.
  return <div ref={ref} style={{ display: "contents" }}>{children}</div>;
}

// Base shimmer block. Size it with className (w-/h-) or style.
export function Skeleton({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return <div className={cn("skeleton-block", className)} style={style} />;
}

// One line of text. `w` controls width (e.g. "w-1/2", "w-24").
export function SkeletonText({ w = "w-full", className }: { w?: string; className?: string }) {
  return <Skeleton className={cn("h-3.5 rounded", w, className)} />;
}

export function SkeletonCircle({ size = 32, className }: { size?: number; className?: string }) {
  return <Skeleton className={cn("rounded-full shrink-0", className)} style={{ width: size, height: size }} />;
}

// ─── Page chrome ──────────────────────────────────────────
export function PageHeaderSkeleton({ withAction = true }: { withAction?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4 mb-6">
      <div className="space-y-2">
        <Skeleton className="h-6 w-44 rounded-md" />
        <Skeleton className="h-3.5 w-64 rounded" />
      </div>
      {withAction && <Skeleton className="h-9 w-32 rounded-lg" />}
    </div>
  );
}

// A row of filter chips / a search bar — the toolbar most CRM list pages have.
export function ToolbarSkeleton() {
  return (
    <div className="flex items-center gap-2 mb-4">
      <Skeleton className="h-9 w-64 rounded-lg" />
      <Skeleton className="h-9 w-24 rounded-lg" />
      <Skeleton className="h-9 w-24 rounded-lg" />
      <div className="flex-1" />
      <Skeleton className="h-9 w-20 rounded-lg" />
    </div>
  );
}

// ─── Content blocks ───────────────────────────────────────
export function StatCardsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-xl p-4" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)" }}>
          <div className="flex items-center justify-between mb-3">
            <Skeleton className="h-3 w-20 rounded" />
            <SkeletonCircle size={16} />
          </div>
          <Skeleton className="h-7 w-16 rounded-md mb-1.5" />
          <Skeleton className="h-3 w-24 rounded" />
        </div>
      ))}
    </div>
  );
}

export function TableSkeleton({ rows = 8, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="rounded-xl overflow-hidden" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)" }}>
      {/* Header */}
      <div className="flex items-center gap-4 px-4 py-3" style={{ backgroundColor: "var(--bg-surface-2)" }}>
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} className={cn("h-3 rounded", i === 0 ? "w-40" : "flex-1 max-w-[8rem]")} />
        ))}
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex items-center gap-4 px-4 py-3.5" style={{ borderTop: "1px solid var(--border-subtle)" }}>
          {Array.from({ length: cols }).map((_, c) => (
            <div key={c} className={cn("flex items-center gap-2.5", c === 0 ? "w-40" : "flex-1 max-w-[8rem]")}>
              {c === 0 && <SkeletonCircle size={28} />}
              <Skeleton className="h-3.5 rounded flex-1" />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

export function ListSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="space-y-2.5">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 rounded-xl p-4" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)" }}>
          <SkeletonCircle size={36} />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3.5 w-1/3 rounded" />
            <Skeleton className="h-3 w-2/3 rounded" />
          </div>
          <Skeleton className="h-6 w-16 rounded-full" />
        </div>
      ))}
    </div>
  );
}

export function CardGridSkeleton({ count = 8, minWidth = 220 }: { count?: number; minWidth?: number }) {
  return (
    <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${minWidth}px, 1fr))` }}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-xl overflow-hidden" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)" }}>
          <Skeleton className="h-32 rounded-none" />
          <div className="p-4 space-y-2">
            <Skeleton className="h-3.5 w-2/3 rounded" />
            <Skeleton className="h-3 w-1/2 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function BoardSkeleton({ columns = 4, cards = 3 }: { columns?: number; cards?: number }) {
  return (
    <div className="flex gap-4 overflow-hidden">
      {Array.from({ length: columns }).map((_, c) => (
        <div key={c} className="flex-1 min-w-[15rem] space-y-3">
          <Skeleton className="h-4 w-28 rounded" />
          {Array.from({ length: cards }).map((_, i) => (
            <div key={i} className="rounded-xl p-4 space-y-2" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)" }}>
              <Skeleton className="h-3.5 w-3/4 rounded" />
              <Skeleton className="h-3 w-1/2 rounded" />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

// ─── Ready-made full-page skeletons ───────────────────────
export type PageSkeletonVariant = "table" | "list" | "cards" | "stats" | "board" | "detail";

export function PageSkeleton({ variant = "table", delay = 200 }: { variant?: PageSkeletonVariant; delay?: number }) {
  return (
    <Delayed delay={delay}>
    <div className="p-6">
      <PageHeaderSkeleton />
      {variant === "table" && (<><ToolbarSkeleton /><TableSkeleton /></>)}
      {variant === "list" && (<><ToolbarSkeleton /><ListSkeleton /></>)}
      {variant === "cards" && (<><ToolbarSkeleton /><CardGridSkeleton /></>)}
      {variant === "board" && (<><ToolbarSkeleton /><BoardSkeleton /></>)}
      {variant === "stats" && (
        <div className="space-y-6">
          <StatCardsSkeleton />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Skeleton className="h-64 rounded-xl" />
            <Skeleton className="h-64 rounded-xl" />
          </div>
        </div>
      )}
      {variant === "detail" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2 space-y-4">
            <Skeleton className="h-40 rounded-xl" />
            <Skeleton className="h-64 rounded-xl" />
          </div>
          <div className="space-y-4">
            <Skeleton className="h-48 rounded-xl" />
            <Skeleton className="h-32 rounded-xl" />
          </div>
        </div>
      )}
    </div>
    </Delayed>
  );
}
