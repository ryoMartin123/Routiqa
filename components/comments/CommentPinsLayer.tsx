"use client";

// ─── Comment pins layer ───────────────────────────────────
// Renders the positioned comment pins for the current page, but only while
// comment mode is on (normal browsing stays clean — the top-bar badge is the
// only at-rest signal). Sits inside the page's comment region so pins scroll
// with the content. Each pin opens its thread in the drawer.

import { useMemo } from "react";
import { Check } from "lucide-react";
import { usePathname, useSearchParams } from "next/navigation";
import { useComments } from "@/components/providers/CommentsProvider";
import { getPinThreadsForPath } from "@/lib/comments/data";
import { getCommentSettings } from "@/lib/comments/settings";

function pageLabel(path: string): string {
  const seg = path.split("/").filter(Boolean)[0] ?? "dashboard";
  return seg.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

export default function CommentPinsLayer() {
  const { enabled, version, openPath, drawer } = useComments();
  const path = usePathname();
  const tab = useSearchParams().get("tab") ?? "";
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const pins = useMemo(() => {
    if (!enabled) return [];
    const all = getPinThreadsForPath(path, tab);
    return getCommentSettings().showResolvedComments ? all : all.filter(t => !t.root.resolved);
  }, [enabled, path, tab, version]);

  if (!enabled || pins.length === 0) return null;

  return (
    <div className="absolute inset-0 pointer-events-none z-40" aria-hidden>
      {pins.map((t, i) => {
        const pin = t.root.anchor.pin;
        if (!pin) return null;
        const active = drawer.focusThreadId === t.root.id;
        const resolved = t.root.resolved;
        const bg = resolved ? "var(--bg-surface)" : "#2a2415";
        const fg = resolved ? "var(--text-muted)" : "#d8b566";
        const ring = active ? "0 0 0 2.5px #cca54e, 0 4px 12px rgba(0,0,0,0.22)" : "0 4px 12px rgba(0,0,0,0.22)";
        return (
          <button
            key={t.root.id}
            data-comment-ui
            data-pin={t.root.anchor.pinId}
            onClick={() => openPath(path, pageLabel(path), t.root.id, tab)}
            title={t.root.body.slice(0, 80)}
            className="pointer-events-auto absolute transition-transform hover:scale-110 origin-bottom"
            style={{ left: `${pin.xPct}%`, top: `${pin.yPct}%`, transform: "translate(-50%, -100%)", opacity: resolved ? 0.7 : 1 }}>
            {/* tail — a small rotated square anchors the bubble to the exact spot */}
            <span className="absolute left-1/2 -translate-x-1/2 -bottom-[3px] w-2 h-2 rotate-45 rounded-[1.5px]"
              style={{ backgroundColor: bg }} />
            {/* bubble */}
            <span className="relative flex items-center justify-center rounded-full"
              style={{ width: "1.4rem", height: "1.4rem", backgroundColor: bg, color: fg, boxShadow: ring }}>
              {resolved
                ? <Check className="w-3 h-3" strokeWidth={2.5} />
                : <span className="text-[10px] font-semibold leading-none">{i + 1}</span>}
            </span>
          </button>
        );
      })}
    </div>
  );
}
