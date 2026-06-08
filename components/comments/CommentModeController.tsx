"use client";

// ─── Comment-mode controller ──────────────────────────────
// When comment mode is on the whole app becomes a comment surface: a banner
// appears, the cursor turns into a crosshair, navigation/actions are blocked, and
// clicking anywhere drops a comment pin at that spot (scoped to the current page).
// Esc or the banner's Done button exits. Mounted once in the dashboard layout.

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { MessageSquarePlus, X } from "lucide-react";
import { useComments } from "@/components/providers/CommentsProvider";
import { commentCountForPath, pinId, type CommentAnchor } from "@/lib/comments/data";

// "/customers/acc-1" → "Customers"
function pageLabel(path: string): string {
  const seg = path.split("/").filter(Boolean)[0] ?? "dashboard";
  return seg.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

const clamp = (n: number) => Math.max(0, Math.min(100, n));

export default function CommentModeController() {
  const { enabled, setEnabled, openComposer, openPath, version } = useComments();
  const path = usePathname();
  const tab = useSearchParams().get("tab") ?? "";
  const count = (() => { try { return commentCountForPath(path, tab); } catch { return 0; } })();
  // eslint-disable-next-line @typescript-eslint/no-unused-expressions
  version; // re-read count after writes

  useEffect(() => {
    if (!enabled) return;

    document.body.dataset.commentMode = "1";

    function onClickCapture(e: MouseEvent) {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      // Let the comment UI (drawer, banner, pins, toggle) work normally.
      if (target.closest("[data-comment-ui]")) return;

      // Block the page's own navigation / actions, repurpose the click as a comment.
      e.preventDefault();
      e.stopPropagation();

      // Only drop a pin when the click is inside the page content region — clicks
      // on the (locked) sidebar/top bar are blocked but don't create stray pins.
      const region = document.querySelector<HTMLElement>("[data-comment-region]");
      if (!region) return;
      const rect = region.getBoundingClientRect();
      const inside = e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom;
      if (!inside) return;
      const xPct = clamp(((e.clientX - rect.left) / rect.width) * 100);
      const yPct = clamp(((e.clientY - rect.top) / rect.height) * 100);

      // Read the live sub-tab so the pin is tied to the exact section it's left on.
      const activeTab = new URLSearchParams(window.location.search).get("tab") || undefined;
      const anchor: CommentAnchor = {
        recordType: "page", recordId: path, recordLabel: pageLabel(path),
        kind: "pin", path, section: activeTab, pinId: pinId(), pin: { xPct, yPct },
      };
      openComposer(anchor);
    }

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setEnabled(false);
    }

    // Capture phase so we run before React's delegated handlers (blocks <Link>).
    document.addEventListener("click", onClickCapture, true);
    document.addEventListener("keydown", onKey);
    return () => {
      delete document.body.dataset.commentMode;
      document.removeEventListener("click", onClickCapture, true);
      document.removeEventListener("keydown", onKey);
    };
  }, [enabled, path, openComposer, setEnabled]);

  if (!enabled) return null;

  return (
    <>
      {/* Static amber frame around the whole viewport (with a one-time entry
          flash) — unmistakable "you're in comment mode" signal. Non-interactive. */}
      <div aria-hidden className="fixed inset-0 pointer-events-none z-[55] comment-mode-frame" />

    {/* Centered via flex (not a transform) so the entry animation slides straight
        down instead of gliding in from the left. */}
    <div className="fixed top-0 left-0 right-0 z-[60] mt-2 flex justify-center pointer-events-none">
    <div data-comment-ui
      className="comment-mode-banner pointer-events-auto flex items-center gap-3 px-4 py-2 rounded-full"
      style={{ backgroundColor: "#2a2415", color: "#d8b566", border: "1px solid #4a3d20", boxShadow: "0 8px 24px rgba(0,0,0,0.28)" }}>
      <MessageSquarePlus className="w-4 h-4 shrink-0" />
      <span className="text-sm font-medium whitespace-nowrap">Comment mode — click anywhere to comment</span>
      {count > 0 && (
        <button onClick={() => openPath(path, pageLabel(path), undefined, tab)}
          className="text-xs font-semibold px-2 py-0.5 rounded-full"
          style={{ backgroundColor: "#4a3d20", color: "#d8b566" }}>
          {count} here
        </button>
      )}
      <button onClick={() => setEnabled(false)} title="Exit comment mode (Esc)"
        className="flex items-center gap-1 text-xs font-semibold pl-2 ml-0.5"
        style={{ borderLeft: "1px solid #4a3d20" }}>
        <X className="w-3.5 h-3.5" /> Done
      </button>
    </div>
    </div>
    </>
  );
}
