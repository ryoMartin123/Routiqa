"use client";

// Top-bar toggle for comment mode. Off by default so the UI is unchanged until
// the user opts in; when on, Commentable blocks reveal their affordance.

import { MessageSquarePlus } from "lucide-react";
import { useComments } from "@/components/providers/CommentsProvider";

export default function CommentModeToggle() {
  const { enabled, setEnabled } = useComments();
  return (
    <button onClick={() => setEnabled(!enabled)}
      title={enabled ? "Comment mode on — click a block to comment" : "Comment mode"}
      className="relative p-2 rounded-lg transition-colors"
      style={{
        backgroundColor: enabled ? "var(--accent-soft-bg)" : "transparent",
        color: enabled ? "var(--accent-text)" : "var(--text-secondary)",
        border: `1px solid ${enabled ? "var(--accent-soft-border)" : "transparent"}`,
      }}>
      <MessageSquarePlus className="w-5 h-5" />
    </button>
  );
}
