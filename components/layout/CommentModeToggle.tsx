"use client";

// Top-bar toggle for comment mode. Off by default so the UI is unchanged until
// the user opts in. The badge shows how many open comments live on the current
// page — the single, low-noise at-rest signal that a page has comments.

import { MessageSquarePlus } from "lucide-react";
import { usePathname, useSearchParams } from "next/navigation";
import { useComments } from "@/components/providers/CommentsProvider";
import { commentCountForPath } from "@/lib/comments/data";

export default function CommentModeToggle() {
  const { enabled, setEnabled, version } = useComments();
  const path = usePathname();
  const tab = useSearchParams().get("tab") ?? "";
  // eslint-disable-next-line @typescript-eslint/no-unused-expressions
  version; // re-read after writes
  const count = (() => { try { return commentCountForPath(path, tab); } catch { return 0; } })();

  return (
    <button data-comment-ui onClick={() => setEnabled(!enabled)}
      title={enabled ? "Comment mode on — click a block to comment" : count > 0 ? `${count} comment${count === 1 ? "" : "s"} on this page` : "Comment mode"}
      className="relative p-2 rounded-lg transition-colors"
      style={{
        backgroundColor: enabled ? "#2a2415" : "transparent",
        color: enabled ? "#d8b566" : "var(--text-secondary)",
        border: `1px solid ${enabled ? "#4a3d20" : "transparent"}`,
      }}>
      <MessageSquarePlus className="w-5 h-5" />
      {count > 0 && (
        <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full text-[9px] font-bold flex items-center justify-center"
          style={{ backgroundColor: "#2a2415", color: "#d8b566", border: "1px solid #4a3d20" }}>
          {count > 9 ? "9+" : count}
        </span>
      )}
    </button>
  );
}
