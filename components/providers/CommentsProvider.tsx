"use client";

// ─── Comments provider ────────────────────────────────────
// Holds the opt-in "comment mode" toggle and the global comments-drawer state.
// Commentable blocks register their anchor and open the drawer through here; the
// drawer (mounted once in the dashboard layout) reads this context. `version`
// bumps after any write so badges/lists re-read the store.

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import type { CommentAnchor } from "@/lib/comments/data";
import { getCommentSettings } from "@/lib/comments/settings";

interface DrawerState {
  open:           boolean;
  scope:          CommentAnchor | null;  // record + compose target
  focusThreadId?: string;
}

interface CommentsContextValue {
  enabled:    boolean;
  setEnabled: (v: boolean) => void;
  version:    number;
  bump:       () => void;
  drawer:     DrawerState;
  openComposer: (anchor: CommentAnchor) => void;
  openThread:   (scope: CommentAnchor, threadId: string) => void;
  closeDrawer:  () => void;
}

const CommentsContext = createContext<CommentsContextValue | null>(null);

const MODE_KEY = "crm-comment-mode";

export function CommentsProvider({ children }: { children: React.ReactNode }) {
  const [enabled, setEnabledState] = useState(false);
  const [version, setVersion] = useState(0);
  const [drawer, setDrawer] = useState<DrawerState>({ open: false, scope: null });

  useEffect(() => {
    try {
      const stored = localStorage.getItem(MODE_KEY);
      // No explicit per-session choice yet → fall back to the org default.
      if (stored === "1") setEnabledState(true);
      else if (stored === null && getCommentSettings().defaultCommentModeOn) setEnabledState(true);
    } catch { /* ignore */ }
  }, []);

  const setEnabled = useCallback((v: boolean) => {
    setEnabledState(v);
    try { localStorage.setItem(MODE_KEY, v ? "1" : "0"); } catch { /* ignore */ }
  }, []);

  const bump = useCallback(() => setVersion(v => v + 1), []);
  const openComposer = useCallback((anchor: CommentAnchor) => setDrawer({ open: true, scope: anchor, focusThreadId: undefined }), []);
  const openThread   = useCallback((scope: CommentAnchor, threadId: string) => setDrawer({ open: true, scope, focusThreadId: threadId }), []);
  const closeDrawer  = useCallback(() => setDrawer(d => ({ ...d, open: false })), []);

  return (
    <CommentsContext.Provider value={{ enabled, setEnabled, version, bump, drawer, openComposer, openThread, closeDrawer }}>
      {children}
    </CommentsContext.Provider>
  );
}

export function useComments(): CommentsContextValue {
  const ctx = useContext(CommentsContext);
  if (!ctx) throw new Error("useComments must be used within CommentsProvider");
  return ctx;
}
