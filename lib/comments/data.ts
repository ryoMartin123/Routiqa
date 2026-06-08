// ─── Contextual comments — anchors, threads, store ────────
// A comment is pinned to a *semantic anchor* (a record + optional tab section +
// optional sub-entity), never to pixels — so it survives layout/sort changes and
// deep-links cleanly. Threads = a root comment + its replies. Persists to
// localStorage (pre-Supabase), mirroring the other module stores.
//
// Future DB: a `comments` table keyed by organization_id with anchor columns
// (record_type, record_id, section, sub_id) + a self-referential parent_id.

import { clearNotificationsForThread } from "@/lib/notifications/data";
import { getCommentSettings } from "@/lib/comments/settings";

export type AnchorRecordType =
  | "customer" | "lead" | "job" | "project"
  | "quote" | "invoice" | "agreement" | "workorder"
  | "item" | "dispatch" | "calendar" | "report" | "marketing" | "settings"
  | "page";   // route-scoped comments (pins + general page comments)

export interface CommentAnchor {
  recordType:  AnchorRecordType;
  recordId:    string;
  recordLabel: string;       // denormalized for display ("Ryo Martin")
  section?:    string;       // tab key, e.g. "Properties"
  subId?:      string;       // sub-entity id, e.g. a property id
  subLabel?:   string;       // human label of the sub-entity ("123 Main St")
  // ─── Comment-mode (route-scoped) fields ───
  // "anchor" = the legacy semantic anchor above; "pin" = a positional marker
  // dropped anywhere on a page; "page" = a general comment on the page itself.
  kind?:       "anchor" | "pin" | "page";
  path?:       string;       // route the comment lives on (drives the page indicator)
  pinId?:      string;       // stable id for a pin thread
  pin?:        { xPct: number; yPct: number };  // position within the page's comment region
}

export interface Comment {
  id:             string;
  threadId:       string;    // root comment id; replies share it
  parentId?:      string;    // set on replies (equals threadId)
  anchor:         CommentAnchor;
  authorId:       string;
  authorName:     string;
  authorInitials: string;
  body:           string;
  mentions:       string[];  // mentioned user ids
  resolved:       boolean;   // meaningful on the root
  createdAt:      string;    // ISO
}

export interface CommentThread {
  root:    Comment;
  replies: Comment[];
}

// ─── Anchor helpers ───────────────────────────────────────
const ROUTE: Record<AnchorRecordType, string> = {
  customer: "customers", lead: "leads", job: "jobs", project: "projects",
  quote: "quotes", invoice: "invoices", agreement: "agreements", workorder: "work-orders",
  item: "items", dispatch: "dispatching", calendar: "calendar",
  report: "reports", marketing: "marketing", settings: "settings",
  page: "",   // page comments carry their own `path`; never routed via ROUTE
};

// Record types that have a per-id detail page (route/{id}); the rest are
// collection pages where the row is identified by the anchor itself.
const DETAIL_TYPES = new Set<AnchorRecordType>([
  "customer", "lead", "job", "project", "quote", "invoice", "agreement",
]);

// Stable key for matching/badge lookup + scroll target: customer:cust-1/§Properties/#p-2
export function anchorKey(a: CommentAnchor): string {
  if (a.kind === "pin"  && a.pinId) return `pin:${a.pinId}`;
  if (a.kind === "page" && a.path)  return `page:${a.path}`;
  let k = `${a.recordType}:${a.recordId}`;
  if (a.section) k += `/§${a.section}`;
  if (a.subId)   k += `/#${a.subId}`;
  return k;
}

// Deep-link that lands on the record/list, switches to the tab, and carries the
// scope (ct/cid/clabel) + scroll target (focus = anchorKey) so the global
// CommentDeepLinkWatcher can open the thread and flash the spot on any page.
export function anchorHref(a: CommentAnchor, threadId?: string): string {
  // Page/pin comments live on a concrete route + sub-tab — link straight back,
  // restoring the tab so the pin lands on the exact section it was left on.
  if ((a.kind === "pin" || a.kind === "page") && a.path) {
    const p = new URLSearchParams();
    if (a.section) p.set("tab", a.section);
    p.set("focus", anchorKey(a));
    if (threadId) p.set("thread", threadId);
    return `${a.path}?${p.toString()}`;
  }
  const base = DETAIL_TYPES.has(a.recordType) ? `/${ROUTE[a.recordType]}/${a.recordId}` : `/${ROUTE[a.recordType]}`;
  const p = new URLSearchParams();
  if (a.section) p.set("tab", a.section);
  p.set("focus", anchorKey(a));
  if (threadId)  p.set("thread", threadId);
  p.set("ct", a.recordType);
  p.set("cid", a.recordId);
  p.set("clabel", a.recordLabel);
  return `${base}?${p.toString()}`;
}

// Short human label of where the anchor points ("Properties › 123 Main St").
export function anchorLabel(a: CommentAnchor): string {
  const parts = [a.recordLabel];
  if (a.section)  parts.push(a.section);
  if (a.subLabel) parts.push(a.subLabel);
  return parts.join(" › ");
}

// ─── Store ────────────────────────────────────────────────
const KEY = "crm-comments";
let _cache: Comment[] | null = null;

function all(): Comment[] {
  if (_cache) return _cache;
  if (typeof window === "undefined") return [];
  try { const raw = localStorage.getItem(KEY); _cache = raw ? (JSON.parse(raw) as Comment[]) : []; }
  catch { _cache = []; }
  return _cache!;
}
function persist(): void {
  if (typeof window === "undefined" || !_cache) return;
  try { localStorage.setItem(KEY, JSON.stringify(_cache)); } catch { /* ignore */ }
}

function cid(): string {
  return `cmt-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

// ─── Reads ────────────────────────────────────────────────
export function getCommentsForRecord(recordType: AnchorRecordType, recordId: string): Comment[] {
  return all()
    .filter(c => c.anchor.recordType === recordType && c.anchor.recordId === recordId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

function toThreads(comments: Comment[]): CommentThread[] {
  const roots = comments.filter(c => !c.parentId);
  return roots.map(root => ({
    root,
    replies: comments.filter(c => c.parentId === root.id).sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
  }));
}

// Threads on a whole record (drawer list), newest activity first.
export function getThreadsForRecord(recordType: AnchorRecordType, recordId: string): CommentThread[] {
  return toThreads(getCommentsForRecord(recordType, recordId))
    .sort((a, b) => lastActivity(b).localeCompare(lastActivity(a)));
}
function lastActivity(t: CommentThread): string {
  return t.replies.length ? t.replies[t.replies.length - 1].createdAt : t.root.createdAt;
}

// Open (unresolved) thread count for an anchor — drives the inline badge.
export function commentCountForAnchorKey(key: string): number {
  return all().filter(c => !c.parentId && !c.resolved && anchorKey(c.anchor) === key).length;
}

// ─── Page-scoped reads (comment-mode pins + general page comments) ───
// Scope = route path + the active sub-tab (`?tab=`). A comment left on the
// Properties tab of a customer is tied to that exact tab, so it only shows there
// and its deep-link restores that tab.
function inScope(a: CommentAnchor, path: string, tab: string): boolean {
  return a.path === path && (a.section ?? "") === tab;
}

export function getThreadsForPath(path: string, tab = ""): CommentThread[] {
  const scoped = all().filter(c => inScope(c.anchor, path, tab)).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  return toThreads(scoped).sort((a, b) => lastActivity(b).localeCompare(lastActivity(a)));
}

// Pin threads only (for rendering positioned markers on the page).
export function getPinThreadsForPath(path: string, tab = ""): CommentThread[] {
  return getThreadsForPath(path, tab).filter(t => t.root.anchor.kind === "pin");
}

// Open thread count for the current route + tab — drives the page indicator.
export function commentCountForPath(path: string, tab = ""): number {
  return all().filter(c => !c.parentId && !c.resolved && inScope(c.anchor, path, tab)).length;
}

// Every thread across the CRM, newest activity first — for the Tasks › Comments tab.
export function getAllThreads(): CommentThread[] {
  return toThreads([...all()].sort((a, b) => a.createdAt.localeCompare(b.createdAt)))
    .sort((a, b) => lastActivity(b).localeCompare(lastActivity(a)));
}

export function pinId(): string {
  return `pin-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

// ─── Writes ───────────────────────────────────────────────
export interface NewCommentInput {
  anchor:         CommentAnchor;
  authorId:       string;
  authorName:     string;
  authorInitials: string;
  body:           string;
  mentions?:      string[];
}

export function addComment(input: NewCommentInput): Comment {
  const id = cid();
  const c: Comment = {
    id, threadId: id, anchor: input.anchor,
    authorId: input.authorId, authorName: input.authorName, authorInitials: input.authorInitials,
    body: input.body.trim(), mentions: input.mentions ?? [], resolved: false,
    createdAt: new Date().toISOString(),
  };
  _cache = [...all(), c];
  persist();
  return c;
}

export function addReply(threadId: string, input: NewCommentInput): Comment | undefined {
  const root = all().find(c => c.id === threadId);
  if (!root) return undefined;
  const id = cid();
  const reply: Comment = {
    id, threadId, parentId: threadId, anchor: root.anchor,
    authorId: input.authorId, authorName: input.authorName, authorInitials: input.authorInitials,
    body: input.body.trim(), mentions: input.mentions ?? [], resolved: false,
    createdAt: new Date().toISOString(),
  };
  _cache = [...all(), reply];
  persist();
  return reply;
}

// Edit a comment's text (and re-derive its mentions from the new body).
export function updateCommentBody(id: string, body: string, mentions: string[]): Comment | undefined {
  let updated: Comment | undefined;
  _cache = all().map(c => c.id === id ? (updated = { ...c, body: body.trim(), mentions }) : c);
  persist();
  return updated;
}

export function resolveThread(threadId: string, resolved: boolean): void {
  _cache = all().map(c => c.id === threadId ? { ...c, resolved } : c);
  persist();
  // Resolving clears the thread's open state, so (by default) drop its mention
  // notifications too — configurable in Settings → Tasks & Comments.
  if (resolved && getCommentSettings().clearNotificationsOnResolve) clearNotificationsForThread(threadId);
}

// Delete a comment; deleting a root removes its whole thread.
export function deleteComment(id: string): void {
  // If `id` is a thread root, its mention notifications should die with the thread.
  const removingThread = all().some(c => c.id === id && !c.parentId);
  _cache = all().filter(c => c.id !== id && c.threadId !== id);
  persist();
  if (removingThread && getCommentSettings().clearNotificationsOnDelete) clearNotificationsForThread(id);
}
