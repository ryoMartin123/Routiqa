// ─── Notification events — stored, per-recipient ─────────
// Explicit events (a mention, a task assignment, a comment reply) addressed to a
// specific user. Distinct from the dashboard's *derived* urgent items (overdue
// tasks, past-due invoices) which NotificationBell computes on the fly — these
// are durable records with read state. Persists to localStorage (pre-Supabase).

export type NotificationKind = "mention" | "task_assigned" | "comment_reply";

export interface StoredNotification {
  id:          string;
  kind:        NotificationKind;
  recipientId: string;       // user id this is addressed to
  actorName:   string;       // who triggered it
  title:       string;
  detail:      string;
  href:        string;       // deep-link to the exact spot
  anchorKey?:  string;
  createdAt:   string;       // ISO
  read:        boolean;
}

const KEY = "crm-notification-events";
let _cache: StoredNotification[] | null = null;

function all(): StoredNotification[] {
  if (_cache) return _cache;
  if (typeof window === "undefined") return [];
  try { const raw = localStorage.getItem(KEY); _cache = raw ? (JSON.parse(raw) as StoredNotification[]) : []; }
  catch { _cache = []; }
  return _cache!;
}
function persist(): void {
  if (typeof window === "undefined" || !_cache) return;
  try { localStorage.setItem(KEY, JSON.stringify(_cache)); } catch { /* ignore */ }
}

export interface NewNotificationInput {
  kind:        NotificationKind;
  recipientId: string;
  actorName:   string;
  title:       string;
  detail:      string;
  href:        string;
  anchorKey?:  string;
}

export function addNotification(input: NewNotificationInput): StoredNotification {
  const n: StoredNotification = {
    id: `ntf-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    ...input, createdAt: new Date().toISOString(), read: false,
  };
  _cache = [n, ...all()];
  persist();
  return n;
}

// Fan-out a mention/assignment to several recipients at once (skips empties).
export function notifyUsers(recipientIds: string[], base: Omit<NewNotificationInput, "recipientId">): void {
  recipientIds.filter(Boolean).forEach(recipientId => addNotification({ ...base, recipientId }));
}

export function getNotificationsForUser(userId: string): StoredNotification[] {
  return all().filter(n => n.recipientId === userId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function unreadCountForUser(userId: string): number {
  return all().filter(n => n.recipientId === userId && !n.read).length;
}

export function markRead(id: string): void {
  _cache = all().map(n => n.id === id ? { ...n, read: true } : n);
  persist();
}

export function markAllReadForUser(userId: string): void {
  _cache = all().map(n => n.recipientId === userId ? { ...n, read: true } : n);
  persist();
}

export function clearNotification(id: string): void {
  _cache = all().filter(n => n.id !== id);
  persist();
}
