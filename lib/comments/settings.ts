// ─── Comments settings — org-level behavior for contextual comments ──
// Configures how the contextual-comments layer behaves: whether comment mode
// starts on, whether commentable blocks show their dashed outline, and whether
// mention notifications are auto-cleared when a thread is resolved or deleted.
// Persists to localStorage (pre-Supabase), mirroring lib/tasks/settings.

export interface CommentSettings {
  // Start each session with comment mode already on (otherwise it's opt-in via
  // the top-bar toggle). The toggle still overrides this within a session.
  defaultCommentModeOn:        boolean;
  // Show resolved comment pins (dimmed) while in comment mode. Off hides them so
  // only open threads are visible.
  showResolvedComments:        boolean;
  // When a thread is resolved, drop the mention notifications it spawned so the
  // recipients' bells don't pile up with stale alerts.
  clearNotificationsOnResolve: boolean;
  // When a thread is deleted, drop the mention notifications it spawned.
  clearNotificationsOnDelete:  boolean;
}

export const DEFAULT_COMMENT_SETTINGS: CommentSettings = {
  defaultCommentModeOn:        false,
  showResolvedComments:        true,
  clearNotificationsOnResolve: true,
  clearNotificationsOnDelete:  true,
};

// ─── Persistence ──────────────────────────────────────────
const KEY = "crm-comment-settings";
let _cache: CommentSettings | null = null;

export function getCommentSettings(): CommentSettings {
  if (_cache) return _cache;
  if (typeof window === "undefined") return DEFAULT_COMMENT_SETTINGS;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) { _cache = DEFAULT_COMMENT_SETTINGS; return _cache; }
    const parsed = JSON.parse(raw) as Partial<CommentSettings>;
    // Merge over defaults so newly-added fields appear for existing users.
    _cache = { ...DEFAULT_COMMENT_SETTINGS, ...parsed };
  } catch { _cache = DEFAULT_COMMENT_SETTINGS; }
  return _cache!;
}

export function saveCommentSettings(next: CommentSettings): CommentSettings {
  _cache = next;
  if (typeof window !== "undefined") {
    try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* ignore */ }
  }
  return next;
}

export function resetCommentSettings(): CommentSettings {
  _cache = null;
  if (typeof window !== "undefined") {
    try { localStorage.removeItem(KEY); } catch { /* ignore */ }
  }
  return getCommentSettings();
}
