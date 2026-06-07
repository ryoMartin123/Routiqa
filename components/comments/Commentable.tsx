"use client";

// ─── Commentable wrapper ──────────────────────────────────
// Wraps any meaningful block (a record header, a tab, a property/equipment row)
// and makes it a comment anchor. Resting state is invisible: nothing renders
// unless the block already has open comments (a small badge) or comment mode is
// on (a hover affordance + dashed outline). This is what keeps the page clean
// while still feeling like "comment anywhere."

import { useMemo } from "react";
import { MessageSquarePlus } from "lucide-react";
import { useComments } from "@/components/providers/CommentsProvider";
import { anchorKey, commentCountForAnchorKey, type CommentAnchor } from "@/lib/comments/data";

export default function Commentable({
  anchor, children, className, badgeCorner = "tr", inset = false,
}: {
  anchor:       CommentAnchor;
  children:     React.ReactNode;
  className?:   string;
  badgeCorner?: "tr" | "tl";
  // inset keeps the badge inside the element bounds — use for rows that sit
  // inside an overflow-hidden card (which would clip an outside badge).
  inset?:       boolean;
}) {
  const { enabled, openComposer, version } = useComments();
  const key = anchorKey(anchor);
  // version makes the count re-read after any add/resolve.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const count = useMemo(() => commentCountForAnchorKey(key), [key, version]);

  const show = enabled || count > 0;
  const cornerPos = inset
    ? (badgeCorner === "tr" ? "top-1 right-1" : "top-1 left-1")
    : (badgeCorner === "tr" ? "-top-2 -right-2" : "-top-2 -left-2");

  return (
    <div className={`relative ${enabled ? "group/cmt rounded-xl" : ""} ${className ?? ""}`}
      data-anchor={key}
      style={enabled ? { outline: "1px dashed transparent", outlineOffset: "3px", transition: "outline-color .15s" } : undefined}>
      {/* Dashed highlight only while hovering in comment mode */}
      {enabled && (
        <span className="pointer-events-none absolute inset-0 rounded-xl opacity-0 group-hover/cmt:opacity-100 transition-opacity"
          style={{ outline: "1.5px dashed var(--accent-soft-border)", outlineOffset: "3px" }} />
      )}

      {children}

      {show && (
        <button
          onClick={e => { e.stopPropagation(); e.preventDefault(); openComposer(anchor); }}
          title={count > 0 ? `${count} comment${count === 1 ? "" : "s"}` : "Add comment"}
          className={`absolute ${cornerPos} z-20 flex items-center justify-center transition-all ${enabled && count === 0 ? "opacity-0 group-hover/cmt:opacity-100" : "opacity-100"}`}
          style={{
            minWidth: "1.25rem", height: "1.25rem", padding: count > 0 ? "0 0.3rem" : "0",
            borderRadius: "999px",
            backgroundColor: count > 0 ? "var(--accent-text)" : "var(--bg-surface)",
            color: count > 0 ? "#fff" : "var(--accent-text)",
            border: `1px solid ${count > 0 ? "var(--accent-text)" : "var(--accent-soft-border)"}`,
            boxShadow: "0 2px 6px rgba(0,0,0,0.12)",
          }}>
          {count > 0
            ? <span className="text-[10px] font-bold leading-none">{count}</span>
            : <MessageSquarePlus className="w-3 h-3" />}
        </button>
      )}
    </div>
  );
}
