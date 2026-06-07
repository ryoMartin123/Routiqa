"use client";

// ─── Comment deep-link watcher ────────────────────────────
// Mounted once in the dashboard layout. On any route it reads the comment
// deep-link params a notification carries — ct/cid/clabel (scope), thread, and
// focus (= anchorKey scroll target) — opens the drawer to the thread, and
// scrolls/flashes the anchored block. No per-page wiring needed: a page only has
// to wrap its commentable blocks; this handles arrival from anywhere.

import { useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { useComments } from "@/components/providers/CommentsProvider";
import type { AnchorRecordType } from "@/lib/comments/data";

export default function CommentDeepLinkWatcher() {
  const params = useSearchParams();
  const { openThread } = useComments();
  const handled = useRef("");

  useEffect(() => {
    const thread = params.get("thread");
    const focus  = params.get("focus");
    const ct     = params.get("ct");
    const cid    = params.get("cid");
    const clabel = params.get("clabel") ?? cid ?? "";

    // Handle each unique (thread, focus) once — so closing the drawer doesn't
    // immediately reopen it while the params linger in the URL.
    const sig = `${thread ?? ""}|${focus ?? ""}`;
    if (handled.current === sig) return;
    handled.current = sig;

    if (thread && ct && cid) {
      openThread({ recordType: ct as AnchorRecordType, recordId: cid, recordLabel: clabel }, thread);
    }
    if (focus) {
      const tmr = setTimeout(() => {
        const el = document.querySelector(`[data-anchor="${focus}"]`);
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
          el.classList.add("anchor-flash");
          setTimeout(() => el.classList.remove("anchor-flash"), 1600);
        }
      }, 400);
      return () => clearTimeout(tmr);
    }
  }, [params, openThread]);

  return null;
}
