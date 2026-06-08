"use client";

// ─── Commentable wrapper ──────────────────────────────────
// Historically this rendered an inline comment affordance on specific blocks.
// Comments are now placed as positional pins anywhere in comment mode (see
// CommentModeController + CommentPinsLayer), so this is a thin passthrough: it
// renders its children and keeps a stable `data-anchor` hook for deep-link
// scrolling. The prop signature is unchanged so existing pages need no edits.

import { anchorKey, type CommentAnchor } from "@/lib/comments/data";

export default function Commentable({
  anchor, children, className,
}: {
  anchor:       CommentAnchor;
  children:     React.ReactNode;
  className?:   string;
  badgeCorner?: "tr" | "tl";   // accepted for back-compat, no longer used
  inset?:       boolean;        // accepted for back-compat, no longer used
}) {
  return (
    <div className={className} data-anchor={anchorKey(anchor)}>
      {children}
    </div>
  );
}
