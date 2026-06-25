"use client";

// ─── Comments drawer ──────────────────────────────────────
// Right slide-over showing every thread on the current record. The composer
// targets the anchor the user clicked (record-level or a specific sub-entity),
// supports @mentions (which notify the mentioned users with a deep-link back to
// this exact spot), replies, resolve, and "Create task" — turning a comment into
// an assignable task pinned to the same location.

import { useEffect, useMemo, useRef, useState } from "react";
import { X, Check, CornerDownRight, Trash2, ListPlus, AtSign, MessageSquare } from "lucide-react";
import { useComments } from "@/components/providers/CommentsProvider";
import { usePermissionContext } from "@/components/providers/PermissionProvider";
import { getStaffedUsers } from "@/lib/users/data";
import {
  getThreadsForRecord, getThreadsForPath, getPinLabelMap, threadCommentCount, addComment, addReply, resolveThread, deleteComment,
  anchorHref, anchorLabel, anchorKey,
  type CommentAnchor, type CommentThread, type Comment,
} from "@/lib/comments/data";
import { notifyUsers } from "@/lib/notifications/data";
import NewTaskModal from "@/components/tasks/NewTaskModal";

interface MentionUser { id: string; name: string; initials: string }

function useMentionUsers(): MentionUser[] {
  return useMemo(() => getStaffedUsers().map(u => ({ id: u.id, name: u.fullName, initials: u.initials })), []);
}

// Mentions = staffed users whose "@Name" appears in the body.
function detectMentions(body: string, users: MentionUser[]): string[] {
  return users.filter(u => body.includes(`@${u.name}`)).map(u => u.id);
}

// Render body with @Name tokens emphasized.
function renderBody(body: string, users: MentionUser[]): React.ReactNode {
  const names = users.map(u => u.name).filter(n => body.includes(`@${n}`)).sort((a, b) => b.length - a.length);
  if (!names.length) return body;
  const out: React.ReactNode[] = [];
  let rest = body, k = 0;
  while (rest.length) {
    let hitAt = -1, hitName = "";
    for (const n of names) {
      const i = rest.indexOf(`@${n}`);
      if (i !== -1 && (hitAt === -1 || i < hitAt)) { hitAt = i; hitName = n; }
    }
    if (hitAt === -1) { out.push(rest); break; }
    if (hitAt > 0) out.push(rest.slice(0, hitAt));
    out.push(<span key={k++} className="font-semibold" style={{ color: "var(--warning-text)" }}>@{hitName}</span>);
    rest = rest.slice(hitAt + 1 + hitName.length);
  }
  return out;
}

function timeAgo(iso: string): string {
  const d = new Date(iso); if (isNaN(d.getTime())) return "";
  const s = Math.floor((Date.now() - d.getTime()) / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60); if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60); if (h < 24) return `${h}h ago`;
  const dd = Math.floor(h / 24); if (dd < 7) return `${dd}d ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// ─── Composer with @mention autocomplete ──────────────────
function Composer({ users, placeholder, autoFocus, onSubmit }: {
  users: MentionUser[]; placeholder: string; autoFocus?: boolean;
  onSubmit: (body: string, mentions: string[]) => void;
}) {
  const [value, setValue] = useState("");
  const [menu, setMenu] = useState<{ query: string; at: number } | null>(null);
  const [idx, setIdx] = useState(0);
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { if (autoFocus) ref.current?.focus(); }, [autoFocus]);

  // Auto-grow with content (Enter adds a line) up to a max height, then scroll.
  useEffect(() => {
    const el = ref.current; if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [value]);

  const matches = menu
    ? users.filter(u => u.name.toLowerCase().includes(menu.query.toLowerCase())).slice(0, 6)
    : [];

  function onChange(v: string, caret: number) {
    setValue(v);
    // Active @token = "@" + word chars immediately before the caret.
    const upto = v.slice(0, caret);
    const m = upto.match(/@([\w'’.-]*)$/);
    setMenu(m ? { query: m[1], at: caret - m[1].length - 1 } : null);
    setIdx(0);
  }

  function pick(u: MentionUser) {
    if (!menu) return;
    const before = value.slice(0, menu.at);
    const after = value.slice(menu.at + 1 + menu.query.length);
    const next = `${before}@${u.name} ${after}`;
    setValue(next); setMenu(null);
    requestAnimationFrame(() => ref.current?.focus());
  }

  function submit() {
    const body = value.trim();
    if (!body) return;
    onSubmit(body, detectMentions(body, users));
    setValue(""); setMenu(null);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (menu && matches.length) {
      if (e.key === "ArrowDown") { e.preventDefault(); setIdx(i => Math.min(i + 1, matches.length - 1)); return; }
      if (e.key === "ArrowUp")   { e.preventDefault(); setIdx(i => Math.max(i - 1, 0)); return; }
      if (e.key === "Enter" || e.key === "Tab") { e.preventDefault(); pick(matches[idx]); return; }
      if (e.key === "Escape")    { setMenu(null); return; }
    }
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); submit(); }
  }

  return (
    <div className="relative">
      <div className="relative">
        <textarea ref={ref} value={value} rows={2}
          onChange={e => onChange(e.target.value, e.target.selectionStart ?? e.target.value.length)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          className="w-full rounded-lg px-3 py-2 text-sm outline-none resize-none thin-scroll-y"
          style={{ border: "1px solid var(--border)", backgroundColor: "var(--bg-surface)", color: "var(--text-primary)", minHeight: "3.5rem", maxHeight: "10rem", overflowY: "auto" }} />

        {/* Opens downward, anchored under the textarea, so it stays on-screen. */}
        {menu && matches.length > 0 && (
          <div className="absolute left-0 top-full mt-1 z-30 w-56 rounded-xl overflow-hidden py-1 max-h-56 overflow-y-auto"
            style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "0 12px 32px rgba(0,0,0,0.18)" }}>
            {matches.map((u, i) => (
              <button key={u.id} onClick={() => pick(u)} onMouseEnter={() => setIdx(i)}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-left transition-colors"
                style={{ backgroundColor: i === idx ? "var(--bg-surface-2)" : "transparent" }}>
                <span className="w-5 h-5 rounded-full bg-indigo-600 flex items-center justify-center text-[8px] font-bold text-white shrink-0">{u.initials}</span>
                <span className="text-sm truncate" style={{ color: "var(--text-primary)" }}>{u.name}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between mt-1.5">
        <span className="flex items-center gap-1 text-[11px]" style={{ color: "var(--text-muted)" }}>
          <AtSign className="w-3 h-3" /> to mention · ⌘↵ to send
        </span>
        <button onClick={submit} disabled={!value.trim()}
          className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-40"
          style={{ backgroundColor: "#2a2415", color: "#d8b566" }}>
          Comment
        </button>
      </div>
    </div>
  );
}

// ─── Thread card ──────────────────────────────────────────
function CommentRow({ c, users, reply }: { c: Comment; users: MentionUser[]; reply?: boolean }) {
  return (
    <div className={`flex items-start gap-2.5 ${reply ? "pl-3" : ""}`}>
      <span className="w-6 h-6 rounded-full bg-indigo-600 flex items-center justify-center text-[9px] font-bold text-white shrink-0 mt-0.5">{c.authorInitials}</span>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{c.authorName}</span>
          <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>{timeAgo(c.createdAt)}</span>
        </div>
        <p className="text-sm whitespace-pre-wrap break-words mt-0.5" style={{ color: "var(--text-secondary)" }}>{renderBody(c.body, users)}</p>
      </div>
    </div>
  );
}

export default function CommentsDrawer() {
  const { drawer, closeDrawer, version, bump, setSolo } = useComments();
  const { actingUser } = usePermissionContext();
  const users = useMentionUsers();
  const [taskFor, setTaskFor] = useState<CommentThread | null>(null);
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const scope = drawer.scope;

  // Path scope (pins + page comments) lists every thread on the route; otherwise
  // we stay record-scoped (e.g. a comment opened from the calendar item drawer).
  const threads = useMemo(
    () => (drawer.pathScope
      ? getThreadsForPath(drawer.pathScope, drawer.tabScope ?? "")
      : scope ? getThreadsForRecord(scope.recordType, scope.recordId) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [drawer.pathScope, drawer.tabScope, scope?.recordType, scope?.recordId, version],
  );

  // Stable pin letters for this page, matching the on-page markers.
  const pinLabels = useMemo(
    () => (drawer.pathScope ? getPinLabelMap(drawer.pathScope, drawer.tabScope ?? "") : {} as Record<string, string>),
    [drawer.pathScope, drawer.tabScope, version],
  );

  // Soloing a pin narrows the list to that one thread; otherwise show all.
  const soloId = drawer.soloThreadId;
  const soloPinLabel = soloId ? pinLabels[soloId] : undefined;
  const visibleThreads = soloId ? threads.filter(t => t.root.id === soloId) : threads;

  // Scroll to / highlight a thread opened from a deep-link.
  useEffect(() => {
    if (!drawer.open || !drawer.focusThreadId) return;
    const t = setTimeout(() => {
      const el = listRef.current?.querySelector(`[data-thread="${drawer.focusThreadId}"]`);
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
      el?.classList.add("anchor-flash");
      setTimeout(() => el?.classList.remove("anchor-flash"), 1600);
    }, 120);
    return () => clearTimeout(t);
  }, [drawer.open, drawer.focusThreadId, version]);

  if (!drawer.open || !scope) return null;

  const author = {
    authorId: actingUser?.id ?? "me",
    authorName: actingUser?.fullName ?? "You",
    authorInitials: actingUser?.initials ?? "ME",
  };

  function notifyForMentions(mentions: string[], body: string, threadId: string) {
    if (!scope) return;
    const recipients = mentions.filter(id => id !== author.authorId);
    if (!recipients.length) return;
    notifyUsers(recipients, {
      kind: "mention",
      actorName: author.authorName,
      title: `${author.authorName} mentioned you`,
      detail: body.length > 80 ? body.slice(0, 80) + "…" : body,
      href: anchorHref(scope, threadId),
      anchorKey: anchorKey(scope),
      threadId,
    });
  }

  function postRoot(body: string, mentions: string[]) {
    if (!scope) return;
    // When focused on a single pin, the composer adds to THAT pin's thread (a
    // reply) instead of starting a new, separate thread on the page.
    if (drawer.soloThreadId) {
      addReply(drawer.soloThreadId, { anchor: scope, body, mentions, ...author });
      notifyForMentions(mentions, body, drawer.soloThreadId);
    } else {
      const c = addComment({ anchor: scope, body, mentions, ...author });
      notifyForMentions(mentions, body, c.threadId);
    }
    bump();
  }

  function postReply(threadId: string, body: string, mentions: string[]) {
    if (!scope) return;
    addReply(threadId, { anchor: scope, body, mentions, ...author });
    notifyForMentions(mentions, body, threadId);
    setReplyTo(null);
    bump();
  }

  function onResolve(threadId: string, resolved: boolean) { resolveThread(threadId, resolved); bump(); }
  function onDelete(id: string) { deleteComment(id); bump(); }

  const openThreads = visibleThreads.filter(t => !t.root.resolved);
  const resolvedThreads = visibleThreads.filter(t => t.root.resolved);

  return (
    <>
      {/* Backdrop — data-comment-ui so clicking it closes (not drops a pin) in comment mode */}
      <div data-comment-ui className="fixed inset-0 z-[65]" style={{ backgroundColor: "rgba(0,0,0,0.25)" }} onClick={closeDrawer} />

      {/* Panel */}
      <div data-comment-ui data-comment-panel className="fixed top-0 right-0 bottom-0 z-[70] w-full max-w-md flex flex-col"
        style={{ backgroundColor: "var(--bg-surface)", borderLeft: "1px solid var(--border)", boxShadow: "-16px 0 48px rgba(0,0,0,0.18)" }}>

        {/* Header */}
        <div className="flex items-start justify-between gap-3 px-5 py-4 shrink-0" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4" style={{ color: "var(--warning-icon)" }} />
              <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                {soloPinLabel ? `Pin ${soloPinLabel}` : "Comments"}
              </h2>
            </div>
            <p className="text-xs mt-0.5 truncate" style={{ color: "var(--text-muted)" }}>{anchorLabel(scope)}</p>
            {/* Toggle between this single thread and all comments on the page/record. */}
            {soloId ? (
              threads.length > 1 && (
                <button onClick={() => setSolo(undefined)}
                  className="mt-1.5 text-[11px] font-medium transition-colors hover:underline" style={{ color: "var(--warning-icon)" }}>
                  ← View all {threads.length} comment{threads.length === 1 ? "" : "s"} {drawer.pathScope ? "on this page" : "here"}
                </button>
              )
            ) : (
              drawer.pathScope && threads.length > 0 && (
                <p className="mt-1.5 text-[11px]" style={{ color: "var(--text-muted)" }}>
                  Showing all {threads.length} on this page · click a pin to focus it
                </p>
              )
            )}
          </div>
          <button onClick={closeDrawer} className="p-1.5 rounded-lg" style={{ color: "var(--text-muted)" }}><X className="w-4 h-4" /></button>
        </div>

        {/* Composer for the targeted anchor */}
        <div className="px-5 py-4 shrink-0" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
          <Composer users={users} autoFocus
            placeholder={soloPinLabel ? `Reply to pin ${soloPinLabel}…` : `Comment on ${scope.subLabel ?? scope.section ?? scope.recordLabel}…`}
            onSubmit={postRoot} />
        </div>

        {/* Threads */}
        <div ref={listRef} className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {threads.length === 0 && (
            <div className="text-center py-10">
              <MessageSquare className="w-7 h-7 mx-auto mb-2 opacity-20" style={{ color: "var(--text-muted)" }} />
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>No comments here yet.</p>
              <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>Start the thread above, @mention a teammate, or turn it into a task.</p>
            </div>
          )}

          {openThreads.map(t => (
            <ThreadCard key={t.root.id} t={t} users={users}
              replyTo={replyTo} setReplyTo={setReplyTo}
              onReply={postReply} onResolve={onResolve} onDelete={onDelete}
              onTask={() => setTaskFor(t)} scope={scope}
              pinLabel={pinLabels[t.root.id]} solo={!!soloId} onFocusPin={() => setSolo(t.root.id)} />
          ))}

          {resolvedThreads.length > 0 && (
            <div className="pt-2">
              <p className="text-[10px] font-semibold uppercase tracking-widest mb-3" style={{ color: "var(--text-muted)" }}>Resolved ({resolvedThreads.length})</p>
              <div className="space-y-5 opacity-60">
                {resolvedThreads.map(t => (
                  <ThreadCard key={t.root.id} t={t} users={users}
                    replyTo={replyTo} setReplyTo={setReplyTo}
                    onReply={postReply} onResolve={onResolve} onDelete={onDelete}
                    onTask={() => setTaskFor(t)} scope={scope}
                    pinLabel={pinLabels[t.root.id]} solo={!!soloId} onFocusPin={() => setSolo(t.root.id)} />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Convert a thread into a task pinned to the same anchor */}
      {taskFor && (
        <NewTaskModal
          open
          onClose={() => setTaskFor(null)}
          onSaved={() => { setTaskFor(null); bump(); }}
          defaultTitle={taskFor.root.body}
          defaultAssigneeId={taskFor.root.mentions[0]}
          anchor={{
            recordType: taskFor.root.anchor.recordType,
            recordId:   taskFor.root.anchor.recordId,
            href:       anchorHref(taskFor.root.anchor, taskFor.root.threadId),
            label:      anchorLabel(taskFor.root.anchor),
          }}
        />
      )}
    </>
  );
}

function ThreadCard({ t, users, replyTo, setReplyTo, onReply, onResolve, onDelete, onTask, pinLabel, solo, onFocusPin }: {
  t: CommentThread; users: MentionUser[];
  replyTo: string | null; setReplyTo: (v: string | null) => void;
  onReply: (threadId: string, body: string, mentions: string[]) => void;
  onResolve: (threadId: string, resolved: boolean) => void;
  onDelete: (id: string) => void;
  onTask: () => void;
  scope: CommentAnchor;
  pinLabel?: string;
  solo?: boolean;
  onFocusPin?: () => void;
}) {
  const isReplying = replyTo === t.root.id;
  const count = threadCommentCount(t);
  return (
    <div data-thread={t.root.id} className="rounded-xl p-3.5 space-y-3"
      style={{ backgroundColor: "var(--bg-surface-2)", border: "1px solid var(--border-subtle)" }}>
      {/* Pin badge — the letter identifies which marker this thread belongs to,
          the number is its comment count; in the all-on-page view, clicking it
          focuses just that pin. */}
      {pinLabel !== undefined && (
        <button
          onClick={() => { if (!solo) onFocusPin?.(); }}
          disabled={solo}
          className="flex items-center gap-1.5 text-[11px] font-semibold rounded-full pl-1.5 pr-2.5 py-0.5 transition-colors disabled:cursor-default"
          style={{ backgroundColor: "var(--warning-soft-bg)", color: "var(--warning-text)", border: "1px solid var(--warning-soft-border)" }}>
          <span className="flex items-center justify-center w-4 h-4 rounded-full text-[9px]" style={{ backgroundColor: "#2a2415", color: "#d8b566" }}>{pinLabel}</span>
          Pin {pinLabel}
          <span style={{ color: "var(--text-muted)" }}>· {count} comment{count === 1 ? "" : "s"}</span>
        </button>
      )}
      <CommentRow c={t.root} users={users} />
      {t.replies.map(r => <CommentRow key={r.id} c={r} users={users} reply />)}

      {isReplying ? (
        <div className="pl-3">
          <Composer users={users} autoFocus placeholder="Reply…" onSubmit={(b, m) => onReply(t.root.id, b, m)} />
        </div>
      ) : (
        <div className="flex items-center gap-1 pt-1" style={{ borderTop: "1px solid var(--border-subtle)" }}>
          <ThreadAction icon={CornerDownRight} label="Reply" onClick={() => setReplyTo(t.root.id)} />
          <ThreadAction icon={ListPlus} label="Task" onClick={onTask} />
          <ThreadAction icon={Check} label={t.root.resolved ? "Reopen" : "Resolve"} onClick={() => onResolve(t.root.id, !t.root.resolved)} />
          <div className="ml-auto">
            <ThreadAction icon={Trash2} label="" danger onClick={() => onDelete(t.root.id)} />
          </div>
        </div>
      )}
    </div>
  );
}

function ThreadAction({ icon: Icon, label, onClick, danger }: { icon: typeof Check; label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button onClick={onClick}
      className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium transition-colors hover:bg-[var(--bg-surface)]"
      style={{ color: danger ? "#dc2626" : "var(--text-secondary)" }}>
      <Icon className="w-3.5 h-3.5" /> {label}
    </button>
  );
}
