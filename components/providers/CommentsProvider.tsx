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
  scope:          CommentAnchor | null;  // compose target (a pin, page, or record anchor)
  pathScope?:     string;                // when set, the drawer lists ALL threads on this route + tab
  tabScope?:      string;                // the sub-tab (`?tab=`) the scope is pinned to
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
  // Open the drawer showing every comment on a route + sub-tab (optionally focused).
  openPath:     (path: string, label?: string, focusThreadId?: string, tab?: string) => void;
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
  // A pin/page anchor carries `path` → the drawer lists the whole page; a record
  // anchor (e.g. from the calendar) has no path → it stays record-scoped.
  const openComposer = useCallback((anchor: CommentAnchor) =>
    setDrawer({ open: true, scope: anchor, pathScope: anchor.path, tabScope: anchor.section ?? "", focusThreadId: undefined }), []);
  const openThread   = useCallback((scope: CommentAnchor, threadId: string) =>
    setDrawer({ open: true, scope, pathScope: scope.path, tabScope: scope.section ?? "", focusThreadId: threadId }), []);
  const openPath     = useCallback((path: string, label?: string, focusThreadId?: string, tab = "") =>
    setDrawer({
      open: true,
      scope: { recordType: "page", recordId: path, recordLabel: label ?? "This page", kind: "page", path, section: tab || undefined },
      pathScope: path,
      tabScope: tab,
      focusThreadId,
    }), []);
  const closeDrawer  = useCallback(() => setDrawer(d => ({ ...d, open: false })), []);

  return (
    <CommentsContext.Provider value={{ enabled, setEnabled, version, bump, drawer, openComposer, openThread, openPath, closeDrawer }}>
      {children}
    </CommentsContext.Provider>
  );
}

export function useComments(): CommentsContextValue {
  const ctx = useContext(CommentsContext);
  if (!ctx) throw new Error("useComments must be used within CommentsProvider");
  return ctx;
}
