"use client";

// ─── Team Workspace · Channels ────────────────────────────
// A structured internal workspace (NOT a chat clone): channels organize team
// communication, shared notes, meetings, action items, and linked documents.
// Immersive 3-panel layout — channel list (with Create/Filter) · selected
// channel workspace · collapsible channel details. The Feed reads bottom-up
// (newest last) with the composer pinned at the bottom. All state is local/mock.

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Hash, Plus, Pin, Archive, Users, MessagesSquare,
  FileText, X, Send, Megaphone, HelpCircle, CheckCircle2, Link2,
  Lock, Pencil, Trash2, Clock, PanelRightClose, PanelRightOpen, UserPlus, ShieldCheck,
  Reply, Check, CornerDownRight, Smile,
  Image as ImageIcon, Mic, Video, ChevronRight, ArrowLeft, Tag,
} from "lucide-react";
import UiSelect from "@/components/ui/Select";
import { cn } from "@/lib/utils";
import { useHierarchy } from "@/components/providers/HierarchyProvider";
import {
  getAllChannels, getChannelPosts, createChannel, updateChannel, archiveChannel,
  togglePinChannel, addChannelPost,
  getChannelMembers, addChannelMember, removeChannelMember,
  canManageChannelMembers, getWorkspacePeople, CHANNEL_ROLE_LABELS, CURRENT_USER,
  CHANNEL_TYPE_LABELS, CHANNEL_TYPE_OPTIONS, VISIBILITY_LABELS, VISIBILITY_OPTIONS,
  POST_TYPE_STYLE, SPECIAL_POST_TYPES, QUICK_REACTIONS,
  toggleReaction, hasReacted, acknowledgePost, hasAcknowledged, togglePinPost,
  getPostReplies, addPostReply,
  type Channel, type ChannelType, type ChannelVisibility, type PostType,
  type ChannelPost, type PostAttachment, type ReplyRef,
} from "@/lib/team-workspace/data";

const ACCENT = "#2563eb";
const POST_TYPE_ICON: Record<PostType, typeof Megaphone> = {
  message: MessagesSquare, announcement: Megaphone, decision: CheckCircle2, question: HelpCircle, sop: FileText,
};

export default function ChannelsWorkspace() {
  const [tick, setTick] = useState(0);
  const refresh = () => setTick(t => t + 1);
  const channels = useMemo(() => getAllChannels(), [tick]);
  // Company/location view context (top-bar selector) filters which channels show.
  const { effectiveCompanyId } = useHierarchy();

  const [selectedId, setSelectedId] = useState<string>(() => getAllChannels().find(c => c.status === "active")?.id ?? "");
  const [search, setSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [fType, setFType] = useState<string>("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);

  const selected = channels.find(c => c.id === selectedId) ?? null;

  const s = search.trim().toLowerCase();
  // Search matches the channel name/description, any member's name, or any
  // message in the channel (author or content) — so you can find a channel by
  // a person or by something that was said in it.
  function matchesSearch(c: Channel): boolean {
    if (!s) return true;
    if (`${c.name} ${c.description}`.toLowerCase().includes(s)) return true;
    if (c.members.some(m => m.name.toLowerCase().includes(s))) return true;
    return getChannelPosts(c.id).some(p => `${p.author} ${p.content}`.toLowerCase().includes(s));
  }
  const visible = channels.filter(c => {
    if (c.status === "archived") return false;   // archived hidden (managed in Settings)
    // Company view: org-wide channels (no companyId) always show; company-scoped
    // channels only when viewing that company (or the whole org).
    if (effectiveCompanyId && c.companyId && c.companyId !== effectiveCompanyId) return false;
    if (fType !== "all" && c.type !== fType) return false;
    if (!matchesSearch(c)) return false;
    return true;
  });
  const pinned = visible.filter(c => c.pinned);
  const team = visible.filter(c => !c.pinned && c.type !== "project");
  const projects = visible.filter(c => !c.pinned && c.type === "project");
  const activeFilters = fType !== "all" ? 1 : 0;
  const onSelect = (id: string) => setSelectedId(id);

  // Search results — channels (by name/member) and the actual matching messages,
  // so you can see what you're looking for. Capped + single-line to stay clean.
  const inView = channels.filter(c => c.status === "active" && !(effectiveCompanyId && c.companyId && c.companyId !== effectiveCompanyId));
  const channelHits = s ? inView.filter(c => c.name.toLowerCase().includes(s) || c.members.some(m => m.name.toLowerCase().includes(s))).slice(0, 4) : [];
  const messageHits = s
    ? inView.flatMap(c => getChannelPosts(c.id).filter(p => `${p.author} ${p.content}`.toLowerCase().includes(s)).map(p => ({ c, p }))).slice(0, 8)
    : [];
  function openResult(channelId: string) { setSelectedId(channelId); setSearch(""); setSearchOpen(false); }

  return (
    <div className="h-full flex min-h-0">
      {/* Left — channel list */}
      <aside className="w-72 shrink-0 flex flex-col" style={{ borderRight: "1px solid var(--border)", backgroundColor: "var(--bg-surface)" }}>
        <div className="p-2.5 shrink-0 flex items-center gap-1.5" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
          <div className="relative flex-1 min-w-0 order-2">
            <div className="flex items-center gap-2 rounded-lg px-2.5 py-1.5" style={{ backgroundColor: "var(--bg-input)" }}>
              <Hash className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--text-muted)" }} />
              <input value={search} onFocusCapture={() => setSearchOpen(true)} onChange={e => { setSearch(e.target.value); setSearchOpen(true); }} placeholder="Search channels, people, messages…" className="bg-transparent text-sm outline-none w-full min-w-0" style={{ color: "var(--text-primary)" }} />
              {search && <button onClick={() => { setSearch(""); setSearchOpen(false); }} title="Clear" className="shrink-0" style={{ color: "var(--text-muted)" }}><X className="w-3.5 h-3.5" /></button>}
            </div>
            {searchOpen && s && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setSearchOpen(false)} />
                <div className="absolute left-0 top-full mt-2 z-50 w-80 rounded-xl overflow-hidden" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "0 12px 32px rgba(0,0,0,0.2)" }}>
                  <div className="max-h-[26rem] overflow-y-auto thin-scroll-y py-1">
                    {channelHits.length === 0 && messageHits.length === 0 ? (
                      <p className="px-3 py-4 text-xs text-center" style={{ color: "var(--text-muted)" }}>No matches for &ldquo;{search.trim()}&rdquo;.</p>
                    ) : (
                      <>
                        {channelHits.length > 0 && (
                          <>
                            <p className="text-[10px] font-semibold uppercase tracking-wider px-3 pt-2 pb-1" style={{ color: "var(--text-muted)" }}>Channels</p>
                            {channelHits.map(c => (
                              <button key={c.id} onClick={() => openResult(c.id)} className="w-full flex items-center gap-2.5 px-3 py-1.5 text-left transition-colors hover:bg-[var(--bg-surface-2)]">
                                <span className="w-6 h-6 rounded-md flex items-center justify-center shrink-0 text-[9px] font-bold text-white" style={{ backgroundColor: c.accent }}>{channelInitials(c.name)}</span>
                                <span className="text-sm font-medium truncate flex-1" style={{ color: "var(--text-primary)" }}><Highlight text={c.name} q={s} /></span>
                                <span className="text-[10px] shrink-0" style={{ color: "var(--text-muted)" }}>{c.membersCount}</span>
                              </button>
                            ))}
                          </>
                        )}
                        {messageHits.length > 0 && (
                          <>
                            <p className="text-[10px] font-semibold uppercase tracking-wider px-3 pt-2 pb-1" style={{ color: "var(--text-muted)", borderTop: channelHits.length ? "1px solid var(--border-subtle)" : "none" }}>Messages</p>
                            {messageHits.map(({ c, p }) => (
                              <button key={p.id} onClick={() => openResult(c.id)} className="w-full flex items-start gap-2.5 px-3 py-1.5 text-left transition-colors hover:bg-[var(--bg-surface-2)]">
                                <span className="w-6 h-6 rounded-md flex items-center justify-center shrink-0 text-[9px] font-bold text-white mt-0.5" style={{ backgroundColor: c.accent }}>{channelInitials(c.name)}</span>
                                <span className="min-w-0 flex-1">
                                  <span className="flex items-center justify-between gap-2">
                                    <span className="text-[11px] font-medium truncate" style={{ color: "var(--text-secondary)" }}>{c.name} · {p.author}</span>
                                    <span className="text-[10px] shrink-0" style={{ color: "var(--text-muted)" }}>{p.createdAt}</span>
                                  </span>
                                  <span className="block text-xs truncate" style={{ color: "var(--text-primary)" }}><Highlight text={p.content} q={s} /></span>
                                </span>
                              </button>
                            ))}
                          </>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
          {/* Single actions menu — create + filters live together (left of search) */}
          <div className="relative shrink-0 order-1">
            <button onClick={() => setMenuOpen(o => !o)} title="Channel actions"
              className="w-8 h-8 rounded-lg flex items-center justify-center text-white"
              style={{ backgroundColor: ACCENT }}>
              <Plus className="w-4 h-4" />
              {activeFilters > 0 && <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full" style={{ backgroundColor: "#f59e0b", border: "1.5px solid var(--bg-surface)" }} />}
            </button>
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
                <div className="absolute left-0 top-full mt-2 z-50 w-64 rounded-xl overflow-hidden" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "0 12px 32px rgba(0,0,0,0.18)" }}>
                  <button onClick={() => { setMenuOpen(false); setCreateOpen(true); }} className="w-full flex items-center gap-2 px-3 py-2.5 text-sm font-medium transition-colors hover:bg-[var(--bg-surface-2)]" style={{ color: "var(--text-primary)" }}>
                    <Plus className="w-4 h-4" style={{ color: ACCENT }} /> Create Channel
                  </button>
                  <div className="p-3 space-y-2" style={{ borderTop: "1px solid var(--border-subtle)" }}>
                    <div className="flex items-center">
                      <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Filter</span>
                      {activeFilters > 0 && <button onClick={() => setFType("all")} className="ml-auto text-[11px]" style={{ color: "var(--accent-text)" }}>Clear</button>}
                    </div>
                    <UiSelect size="sm" value={fType} onChange={setFType} options={[{ value: "all", label: "Any type" }, ...CHANNEL_TYPE_OPTIONS.map(t => ({ value: t, label: CHANNEL_TYPE_LABELS[t] }))]} />
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto thin-scroll-y px-2 py-3">
          <ChannelGroup label="Pinned" channels={pinned} selectedId={selectedId} onSelect={onSelect} />
          <ChannelGroup label="Team Channels" channels={team} selectedId={selectedId} onSelect={onSelect} />
          <ChannelGroup label="Project Channels" channels={projects} selectedId={selectedId} onSelect={onSelect} />
          {visible.length === 0 && <p className="text-xs text-center py-8" style={{ color: "var(--text-muted)" }}>No channels match.</p>}
        </div>
      </aside>

      {/* Center — selected channel workspace */}
      <section className="flex-1 min-w-0 flex flex-col overflow-hidden">
        {!selected ? (
          <div className="flex-1 flex items-center justify-center p-8">
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>Select a channel to open its workspace.</p>
          </div>
        ) : (
          <ChannelWorkspace key={selected.id} channel={selected} refresh={refresh} tick={tick}
            detailsOpen={detailsOpen} onToggleDetails={() => setDetailsOpen(o => !o)} />
        )}
      </section>

      {/* Right — channel details (collapsible). Kept mounted and width-animated
          so it eases open/closed instead of snapping. */}
      {selected && (
        <div className={cn("shrink-0 h-full overflow-hidden transition-[width] duration-300 ease-in-out", detailsOpen ? "w-80" : "w-0")} aria-hidden={!detailsOpen}>
          <ChannelDetails channel={selected} refresh={refresh} onEdit={() => setEditOpen(true)} onCollapse={() => setDetailsOpen(false)} tick={tick} />
        </div>
      )}

      {createOpen && <CreateChannelModal onClose={() => setCreateOpen(false)} onCreated={(c) => { setCreateOpen(false); refresh(); setSelectedId(c.id); }} />}
      {editOpen && selected && <EditChannelDrawer channel={selected} onClose={() => setEditOpen(false)} onSaved={() => { setEditOpen(false); refresh(); }} onArchived={() => { setEditOpen(false); refresh(); }} />}
    </div>
  );
}

// ─── Left panel ───────────────────────────────────────────
function ChannelGroup({ label, channels, selectedId, onSelect }: {
  label: string; channels: Channel[]; selectedId: string; onSelect: (id: string) => void;
}) {
  if (channels.length === 0) return null;
  return (
    <div className="mb-3">
      <p className="text-[10px] font-semibold uppercase tracking-widest px-2 mb-1 mt-2" style={{ color: "var(--text-muted)" }}>{label}</p>
      {channels.map(c => {
        const active = c.id === selectedId;
        return (
          <button key={c.id} onClick={() => onSelect(c.id)}
            className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-md mb-0.5 text-left transition-colors"
            style={{ backgroundColor: active ? ACCENT + "1f" : "transparent" }}>
            <span className="w-7 h-7 rounded-md flex items-center justify-center shrink-0 text-[11px] font-bold text-white" style={{ backgroundColor: c.accent }}>
              {channelInitials(c.name)}
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1.5">
                <span className="text-sm font-medium truncate" style={{ color: active ? "var(--text-primary)" : "var(--text-secondary)" }}>{c.name}</span>
                {c.pinned && <Pin className="w-3 h-3 shrink-0" style={{ color: "var(--text-muted)" }} />}
              </span>
              <span className="flex items-center gap-1.5 text-[10px]" style={{ color: "var(--text-muted)" }}>
                <Users className="w-2.5 h-2.5" /> {c.membersCount} · {c.lastActivity}
              </span>
            </span>
            {c.unreadCount > 0 && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0 text-white" style={{ backgroundColor: c.accent }}>{c.unreadCount}</span>}
          </button>
        );
      })}
    </div>
  );
}

// ─── Center workspace ─────────────────────────────────────
// The channel IS its feed for now — meetings, action items, documents, and
// pinned items are surfaced elsewhere in My Workspace and link back to channels
// in a later phase.
function ChannelWorkspace({ channel, refresh, tick, detailsOpen, onToggleDetails }: {
  channel: Channel; refresh: () => void; tick: number;
  detailsOpen: boolean; onToggleDetails: () => void;
}) {
  const posts = useMemo(() => getChannelPosts(channel.id), [channel.id, tick]);

  return (
    <>
      {/* Channel header — name + description · details toggle */}
      <div className="px-5 pt-4 pb-3 shrink-0 flex items-start gap-2" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold truncate" style={{ color: "var(--text-primary)" }}>{channel.name}</h2>
            {channel.status === "archived" && <Chip tone="muted">Archived</Chip>}
          </div>
          <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>{channel.description}</p>
        </div>
        <button onClick={onToggleDetails} title={detailsOpen ? "Hide details" : "Show details"}
          className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors hover:bg-[var(--bg-surface-2)] mt-0.5" style={{ color: "var(--text-secondary)", border: "1px solid var(--border)" }}>
          {detailsOpen ? <PanelRightClose className="w-4 h-4" /> : <PanelRightOpen className="w-4 h-4" />}
        </button>
      </div>

      {/* Feed */}
      <div className="flex-1 min-h-0 flex flex-col">
        <FeedTab channel={channel} posts={posts} refresh={refresh} />
      </div>
    </>
  );
}

// ── Feed — compact, Slack/Teams-speed messages; composer pinned bottom ──
// Plain messages are lightweight rows; structured posts (announcement/decision/
// question/SOP/ack) get a subtle tinted card + badge. Reactions sit directly on
// the message. Replies split by post kind:
//   • Normal message → WhatsApp-style: "Reply" quotes it in the composer and the
//     answer posts back into the main channel carrying a compact quoted preview.
//   • Structured post → "View thread" opens a right-side drawer (original on top,
//     replies below, reply inline) so long discussions stay out of the channel.
function FeedTab({ channel, posts, refresh }: { channel: Channel; posts: ChannelPost[]; refresh: () => void }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const ordered = [...posts].reverse(); // oldest → newest
  const [threadId, setThreadId] = useState<string | null>(null);
  const [replyingTo, setReplyingTo] = useState<ReplyRef | null>(null);
  const threadPost = threadId ? posts.find(p => p.id === threadId) ?? null : null;

  // Structured posts get a full thread; plain messages get quoted replies.
  const isStructured = (p: ChannelPost) => p.postType !== "message" || !!p.requiresAck;

  // Keep the feed pinned to the latest post (on channel switch + new post).
  useEffect(() => { const el = scrollRef.current; if (el) el.scrollTop = el.scrollHeight; }, [channel.id, posts.length]);

  function startQuoteReply(p: ChannelPost) {
    setReplyingTo({ postId: p.id, author: p.author, excerpt: p.content });
    setTimeout(() => composerRef.current?.focus(), 0);
  }

  return (
    <div className="h-full flex flex-col min-h-0">
      <div ref={scrollRef} className="flex-1 overflow-y-auto thin-scroll-y px-4 py-3">
        <div className="w-full flex flex-col gap-0.5 min-h-full justify-end">
          {ordered.length === 0
            ? <EmptyState icon={MessagesSquare} text="No messages yet. Say something below." />
            : ordered.map(p => {
                const structured = isStructured(p);
                return (
                  <PostRow key={p.id} post={p} refresh={refresh} structured={structured}
                    onViewThread={() => setThreadId(p.id)}
                    onQuoteReply={() => startQuoteReply(p)}
                    threadOpen={threadId === p.id} />
                );
              })}
        </div>
      </div>
      <Composer channel={channel} refresh={refresh} taRef={composerRef}
        replyingTo={replyingTo} onClearReply={() => setReplyingTo(null)} />

      {/* Thread popup — structured posts only. */}
      {threadPost && (
        <ThreadModal key={threadPost.id} post={threadPost} channel={channel}
          refresh={refresh} onClose={() => setThreadId(null)} />
      )}
    </div>
  );
}

// ── A single message row ──
function PostRow({ post: p, refresh, structured, onViewThread, onQuoteReply, threadOpen }: {
  post: ChannelPost; refresh: () => void; structured: boolean;
  onViewThread: () => void; onQuoteReply: () => void; threadOpen: boolean;
}) {
  const special = p.postType !== "message";
  const st = POST_TYPE_STYLE[p.postType];
  const Icon = POST_TYPE_ICON[p.postType];
  const onReplyAction = structured ? onViewThread : onQuoteReply;

  return (
    <div className="group relative flex gap-2.5 rounded-lg px-2 py-1.5"
      style={threadOpen ? { backgroundColor: "var(--bg-surface-2)" } : undefined}>
      <span className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0 mt-0.5" style={{ backgroundColor: "#6b7280" }}>{initials(p.author)}</span>

      <div className="min-w-0 flex-1">
        {/* One-line header */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{p.author}</span>
          <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>{p.createdAt}</span>
          {special && (
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded" style={{ backgroundColor: st.bg, color: st.color }}>
              <Icon className="w-3 h-3" /> {st.label}
            </span>
          )}
          {p.pinned && <Pin className="w-3 h-3" style={{ color: "var(--text-muted)" }} />}
        </div>

        {/* Body — special posts get a subtle tinted card with a left accent */}
        <div className={special ? "mt-1 rounded-lg px-3 py-2" : "mt-0.5"}
          style={special ? { backgroundColor: st.bg, borderLeft: `3px solid ${st.color}` } : undefined}>
          {/* Quoted-reply preview — shows who/what this message answers */}
          {p.replyTo && <QuotedPreview reply={p.replyTo} />}

          <p className="text-sm leading-relaxed whitespace-pre-wrap break-words" style={{ color: "var(--text-primary)" }}>{p.content}</p>

          {p.attachments && p.attachments.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {p.attachments.map(a => <AttachmentChip key={a.id} att={a} />)}
            </div>
          )}

          {/* Acknowledgment — opt-in, important posts only; separate from reactions */}
          {p.requiresAck && <AckBar post={p} refresh={refresh} />}
        </div>

        {/* Reactions attached directly to the message */}
        <ReactionRow post={p} refresh={refresh} structured={structured} onAction={onReplyAction} />
      </div>

      {/* Action menu — one icon, top-right of the message, revealed on hover */}
      <PostActionsMenu post={p} structured={structured} refresh={refresh} onReplyAction={onReplyAction} />
    </div>
  );
}

// A pinch-bracket glyph — our own little "message actions" mark. Two facing
// corner brackets that close inward to a caret when open. Minimal, custom, and
// not the generic kebab.
function ActionGlyph({ open }: { open: boolean }) {
  return (
    <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 3 L3 8 L6 13" style={{ transition: "transform 200ms ease", transform: open ? "translateX(1.5px)" : "none" }} />
      <path d="M10 3 L13 8 L10 13" style={{ transition: "transform 200ms ease", transform: open ? "translateX(-1.5px)" : "none" }} />
    </svg>
  );
}

// Single custom trigger (top-right, on hover) opening reactions + reply + pin.
function PostActionsMenu({ post: p, structured, refresh, onReplyAction }: {
  post: ChannelPost; structured: boolean; refresh: () => void; onReplyAction: () => void;
}) {
  const [open, setOpen] = useState(false);
  const react = (emoji: string) => { toggleReaction(p.id, emoji); setOpen(false); refresh(); };

  return (
    <div className={cn("absolute top-1 right-1", open ? "flex" : "hidden group-hover:flex")}>
      <button title="Message actions" onClick={() => setOpen(o => !o)}
        className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors hover:bg-[var(--bg-surface-2)]"
        style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", color: open ? ACCENT : "var(--text-secondary)", boxShadow: "0 2px 8px rgba(0,0,0,0.1)" }}>
        <ActionGlyph open={open} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 bottom-full mb-1 z-50 w-56 rounded-xl overflow-hidden py-1" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "0 12px 32px rgba(0,0,0,0.2)" }}>
            {/* Reactions — common ones up front, any emoji on request (one per user) */}
            <ReactionPicker onPick={react} />
            <div className="my-1" style={{ borderTop: "1px solid var(--border-subtle)" }} />
            <button onClick={() => { onReplyAction(); setOpen(false); }} className="w-full flex items-center gap-2.5 px-3 py-2 text-sm transition-colors hover:bg-[var(--bg-surface-2)]" style={{ color: "var(--text-primary)" }}>
              {structured ? <MessagesSquare className="w-4 h-4 shrink-0" /> : <Reply className="w-4 h-4 shrink-0" />}
              {structured ? "View thread" : "Reply"}
            </button>
            <button onClick={() => { togglePinPost(p.id); setOpen(false); refresh(); }} className="w-full flex items-center gap-2.5 px-3 py-2 text-sm transition-colors hover:bg-[var(--bg-surface-2)]" style={{ color: "var(--text-primary)" }}>
              <Pin className="w-4 h-4 shrink-0" /> {p.pinned ? "Unpin" : "Pin"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// Extended emoji set revealed under the common reactions when you want more.
const EXTENDED_EMOJIS = [
  "😀", "😄", "😁", "😂", "🤣", "😊", "😍", "😎", "🤩", "🥳", "😉", "🙂",
  "🤔", "😴", "😢", "😭", "😤", "😡", "🤯", "😱", "🙃", "🤗", "🫡", "🤝",
  "👍", "👎", "👏", "🙏", "💪", "👀", "✋", "👋", "🤙", "🔥", "⭐", "✨",
  "💯", "✅", "❌", "❗", "❓", "🎉", "🚀", "💡", "⚡", "❤️", "🧡", "💛",
  "💚", "💙", "💜", "📌", "📅", "🛠️", "🚚", "🏠", "💼", "📈", "💰", "🧾",
];

// Reaction picker — shows the common emojis; "more" reveals an extended grid and
// a field to type/paste ANY emoji you want.
function ReactionPicker({ onPick }: { onPick: (emoji: string) => void }) {
  const [expanded, setExpanded] = useState(false);
  const [custom, setCustom] = useState("");
  function addCustom() {
    const e = Array.from(custom.trim())[0];   // first grapheme (handles surrogate pairs)
    if (e) { onPick(e); setCustom(""); }
  }
  return (
    <div>
      <div className="flex items-center gap-0.5 px-1.5 py-1">
        {QUICK_REACTIONS.map((e, i) => (
          <button key={e} onClick={() => onPick(e)} style={{ animationDelay: `${i * 35}ms` }}
            className="tw-emoji-pop-in w-7 h-7 rounded-md flex items-center justify-center text-base transition hover:scale-125 active:scale-90 hover:bg-[var(--bg-surface-2)]">{e}</button>
        ))}
        <button onClick={() => setExpanded(v => !v)} title="More emojis"
          className="w-7 h-7 rounded-md flex items-center justify-center transition-colors hover:bg-[var(--bg-surface-2)]"
          style={{ color: expanded ? ACCENT : "var(--text-muted)" }}>
          <Smile className="w-4 h-4" />
        </button>
      </div>
      {expanded && (
        <div className="px-1.5 pb-1.5" onClick={e => e.stopPropagation()}>
          <div className="grid grid-cols-8 gap-0.5 max-h-32 overflow-y-auto thin-scroll-y mb-1.5">
            {EXTENDED_EMOJIS.map((e, i) => (
              <button key={`${e}-${i}`} onClick={() => onPick(e)} className="w-6 h-6 rounded-md flex items-center justify-center text-sm transition-colors hover:bg-[var(--bg-surface-2)]">{e}</button>
            ))}
          </div>
          <div className="flex items-center gap-1.5">
            <input value={custom} onChange={e => setCustom(e.target.value)} placeholder="Type or paste any emoji"
              onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addCustom(); } }}
              className="flex-1 min-w-0 rounded-lg px-2 py-1 text-sm outline-none" style={{ border: "1px solid var(--border)", backgroundColor: "var(--bg-surface-2)", color: "var(--text-primary)" }} />
            <button onClick={addCustom} disabled={!custom.trim()} className="shrink-0 px-2.5 py-1 rounded-lg text-xs font-medium text-white disabled:opacity-40" style={{ backgroundColor: ACCENT }}>Add</button>
          </div>
        </div>
      )}
    </div>
  );
}

// Compact quoted-message preview (used both in the feed and the composer).
function QuotedPreview({ reply, onClear }: { reply: ReplyRef; onClear?: () => void }) {
  return (
    <div className="flex items-start gap-1.5 mb-1.5 rounded-md pl-2 pr-1.5 py-1" style={{ backgroundColor: "var(--bg-surface-2)", borderLeft: `2px solid ${ACCENT}` }}>
      <Reply className="w-3 h-3 mt-0.5 shrink-0" style={{ color: ACCENT }} />
      <span className="min-w-0 flex-1">
        <span className="text-[11px] font-semibold" style={{ color: ACCENT }}>{reply.author}</span>
        {/* Wrap up to 3 lines, then clamp — never collapse a multi-line quote
            into one jumbled line; the rest is hidden past the third line.
            (No `block` here: it sets display and would override line-clamp's
            own display:-webkit-box, silently disabling the clamp.) */}
        <span className="text-[11px] whitespace-pre-wrap break-words line-clamp-3" style={{ color: "var(--text-muted)" }}>{reply.excerpt}</span>
      </span>
      {onClear && <button onClick={onClear} title="Cancel reply" className="w-4 h-4 rounded flex items-center justify-center shrink-0 mt-0.5" style={{ color: "var(--text-muted)" }}><X className="w-3 h-3" /></button>}
    </div>
  );
}

// ── Reaction chips under the message (react/reply/pin live in the hover menu) ──
// For structured posts that already have a thread, a compact "N replies" link
// stays visible so discussions are discoverable; everything else is clean.
function ReactionRow({ post: p, refresh, structured, onAction }: {
  post: ChannelPost; refresh: () => void; structured: boolean; onAction: () => void;
}) {
  const entries = Object.entries(p.reactions).filter(([, names]) => names.length > 0);
  const showThread = structured && p.replyCount > 0;
  if (entries.length === 0 && !showThread) return null;
  const react = (emoji: string) => { toggleReaction(p.id, emoji); refresh(); };

  return (
    <div className="flex items-center gap-1.5 mt-1 flex-wrap">
      {entries.map(([emoji, names]) => {
        const mine = hasReacted(p, emoji);
        return (
          <button key={emoji} onClick={() => react(emoji)}
            className="tw-reaction-in inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-xs leading-none transition hover:scale-105 active:scale-95"
            title={names.join(", ")}
            style={{ backgroundColor: mine ? ACCENT + "1f" : "var(--bg-surface-2)", border: `1px solid ${mine ? ACCENT + "59" : "var(--border-subtle)"}`, color: mine ? ACCENT : "var(--text-secondary)" }}>
            <span>{emoji}</span><span className="font-medium">{names.length}</span>
          </button>
        );
      })}

      {showThread && (
        <button onClick={onAction} className="inline-flex items-center gap-1 text-xs ml-0.5 transition-colors hover:text-[var(--text-secondary)]" style={{ color: "var(--text-muted)" }}>
          <MessagesSquare className="w-3.5 h-3.5" /> {p.replyCount} {p.replyCount === 1 ? "reply" : "replies"} · View thread
        </button>
      )}
    </div>
  );
}

function AttachmentChip({ att }: { att: PostAttachment }) {
  const Icon = att.kind === "image" ? ImageIcon : att.kind === "document" ? FileText : Link2;
  const label = att.kind === "image" ? "Open image" : att.kind === "document" ? "Open document" : "Open record";
  return (
    <button className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs transition-colors hover:bg-[var(--bg-surface)]"
      title={label}
      style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}>
      <Icon className="w-3.5 h-3.5 shrink-0" style={{ color: ACCENT }} />
      <span className="font-medium truncate max-w-[16rem]" style={{ color: "var(--text-primary)" }}>{att.title}</span>
    </button>
  );
}

function AckBar({ post: p, refresh }: { post: ChannelPost; refresh: () => void }) {
  const acked = hasAcknowledged(p);
  const done = p.ackBy?.length ?? 0;
  const total = p.audienceCount ?? 0;
  return (
    <div className="flex items-center gap-2.5 mt-2 pt-2 flex-wrap" style={{ borderTop: "1px dashed var(--border)" }}>
      <button onClick={() => { if (!acked) { acknowledgePost(p.id); refresh(); } }} disabled={acked}
        className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors disabled:cursor-default"
        style={acked
          ? { backgroundColor: "#10b98114", color: "#10b981", border: "1px solid #10b98159" }
          : { backgroundColor: ACCENT, color: "#fff" }}>
        {acked ? <><Check className="w-3.5 h-3.5" /> Acknowledged</> : <><CheckCircle2 className="w-3.5 h-3.5" /> Acknowledge</>}
      </button>
      <span className="text-[11px] font-medium" style={{ color: "var(--text-muted)" }}>Acknowledged {done}/{total}</span>
    </div>
  );
}

// ── Lightweight composer — one line by default ("+" and Send inline). The "+"
// menu is a drill-down: post type opens its own submenu (only if you want it),
// and you can attach images/documents (recordings & video later). Replying to a
// normal message shows a WhatsApp-style quoted preview that posts back inline.
function Composer({ channel, refresh, taRef, replyingTo, onClearReply }: {
  channel: Channel; refresh: () => void; taRef: React.RefObject<HTMLTextAreaElement | null>;
  replyingTo: ReplyRef | null; onClearReply: () => void;
}) {
  const [content, setContent] = useState("");
  const [postType, setPostType] = useState<PostType>("message");
  const [requireAck, setRequireAck] = useState(false);
  const [attachments, setAttachments] = useState<PostAttachment[]>([]);
  const [moreOpen, setMoreOpen] = useState(false);
  const [menuView, setMenuView] = useState<"root" | "types">("root");
  const imageInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);

  // Auto-grow as you type/paste — starts at one line, grows to a max, then scrolls.
  useEffect(() => {
    const el = taRef.current; if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(Math.max(el.scrollHeight, 32), 200)}px`;
  }, [content, taRef]);

  const special = postType !== "message";
  const st = POST_TYPE_STYLE[postType];

  function reset() { setContent(""); setPostType("message"); setRequireAck(false); setAttachments([]); onClearReply(); }
  function post() {
    if (!content.trim()) return;
    addChannelPost(channel.id, content, { postType, requiresAck: requireAck, attachments, replyTo: replyingTo ?? undefined });
    reset(); refresh();
  }
  function addAttachment(att: PostAttachment) {
    setAttachments(a => a.some(x => x.id === att.id) ? a : [...a, att]);
  }
  function openMenu() { setMenuView("root"); setMoreOpen(true); }
  function closeMenu() { setMoreOpen(false); }
  function onFilePicked(kind: "image" | "document", e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) addAttachment({ id: `att-${Date.now()}`, title: f.name, kind });
    e.target.value = "";   // allow re-picking the same file
    closeMenu();
  }

  return (
    <div className="shrink-0 px-4 py-3" style={{ borderTop: "1px solid var(--border-subtle)", backgroundColor: "var(--bg-surface)" }}>
      {/* Quoted reply preview (WhatsApp-style) */}
      {replyingTo && (
        <div className="mb-1.5">
          <QuotedPreview reply={replyingTo} onClear={onClearReply} />
        </div>
      )}

      {/* Active context chips — only when special options are selected */}
      {(special || requireAck || attachments.length > 0) && (
        <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
          {special && (
            <ContextChip color={st.color} bg={st.bg} onClear={() => setPostType("message")}>{st.label}</ContextChip>
          )}
          {requireAck && (
            <ContextChip color="#f59e0b" bg="#f59e0b14" onClear={() => setRequireAck(false)}>Acknowledgment required</ContextChip>
          )}
          {attachments.map(a => (
            <ContextChip key={a.id} color={ACCENT} bg={ACCENT + "14"} onClear={() => setAttachments(prev => prev.filter(x => x.id !== a.id))}>{a.title}</ContextChip>
          ))}
        </div>
      )}

      <div className="w-full rounded-xl flex items-center gap-1.5 px-2 py-1.5" style={{ backgroundColor: "var(--bg-surface-2)", border: "1px solid var(--border)" }}>
        {/* "+" / More options */}
        <div className="relative shrink-0">
          <button onClick={() => (moreOpen ? closeMenu() : openMenu())} title="Add to message"
            className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors hover:bg-[var(--bg-surface)]" style={{ color: moreOpen ? ACCENT : "var(--text-secondary)" }}>
            <Plus className="w-4 h-4 transition-transform" style={{ transform: moreOpen ? "rotate(45deg)" : "none" }} />
          </button>
          {moreOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={closeMenu} />
              <div className="absolute left-0 bottom-full mb-2 z-50 w-60 rounded-xl overflow-hidden py-1" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "0 12px 32px rgba(0,0,0,0.2)" }}>
                {menuView === "root" ? (
                  <>
                    {/* Post type — opens its own submenu only if you want it */}
                    <MenuItem icon={Tag} label="Post type" onClick={() => setMenuView("types")}>
                      <span className="ml-auto flex items-center gap-1 text-xs" style={{ color: special ? st.color : "var(--text-muted)" }}>
                        {special ? st.label : "Message"}<ChevronRight className="w-3.5 h-3.5" style={{ color: "var(--text-muted)" }} />
                      </span>
                    </MenuItem>
                    <div className="my-1" style={{ borderTop: "1px solid var(--border-subtle)" }} />
                    <MenuItem icon={ImageIcon} label="Upload image" onClick={() => imageInputRef.current?.click()} />
                    <MenuItem icon={FileText} label="Upload document" onClick={() => docInputRef.current?.click()} />
                    <div className="my-1" style={{ borderTop: "1px solid var(--border-subtle)" }} />
                    <MenuItem icon={Mic} label="Record audio" soon />
                    <MenuItem icon={Video} label="Record video" soon />
                  </>
                ) : (
                  <>
                    <button onClick={() => setMenuView("root")} className="w-full flex items-center gap-1.5 px-3 py-2 text-[11px] font-semibold uppercase tracking-wider transition-colors hover:bg-[var(--bg-surface-2)]" style={{ color: "var(--text-muted)" }}>
                      <ArrowLeft className="w-3.5 h-3.5" /> Post type
                    </button>
                    <div className="my-0.5" style={{ borderTop: "1px solid var(--border-subtle)" }} />
                    <MenuItem icon={MessagesSquare} label="Message" onClick={() => { setPostType("message"); closeMenu(); }} check={postType === "message"} />
                    {SPECIAL_POST_TYPES.map(t => {
                      const s = POST_TYPE_STYLE[t]; const I = POST_TYPE_ICON[t];
                      return <MenuItem key={t} icon={I} iconColor={s.color} label={s.label} onClick={() => { setPostType(t); closeMenu(); }} check={postType === t} />;
                    })}
                    <div className="my-1" style={{ borderTop: "1px solid var(--border-subtle)" }} />
                    <MenuItem icon={CheckCircle2} iconColor="#f59e0b" label="Require acknowledgment" onClick={() => setRequireAck(v => !v)} check={requireAck} />
                  </>
                )}
              </div>
            </>
          )}
          {/* Hidden file inputs — real picker, mock storage (filename only) */}
          <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={e => onFilePicked("image", e)} />
          <input ref={docInputRef} type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt" className="hidden" onChange={e => onFilePicked("document", e)} />
        </div>

        <textarea ref={taRef} id="tw-composer" value={content} onChange={e => setContent(e.target.value)} rows={1}
          placeholder={replyingTo ? `Reply to ${replyingTo.author}…` : special ? `Write ${/^[aeiou]/i.test(st.label) ? "an" : "a"} ${st.label.toLowerCase()}…` : "Message…"}
          className="flex-1 bg-transparent text-sm outline-none resize-none thin-scroll-y py-1.5" style={{ color: "var(--text-primary)", minHeight: 32, maxHeight: 200, overflowY: "auto", lineHeight: "20px" }}
          onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); post(); } }} />

        <button onClick={post} disabled={!content.trim()}
          className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-white disabled:opacity-40 transition-opacity" style={{ backgroundColor: ACCENT }} title="Send (Enter)">
          <Send className="w-4 h-4" />
        </button>
      </div>
      <p className="text-[10px] mt-1 px-1" style={{ color: "var(--text-muted)" }}><kbd>Enter</kbd> to send · <kbd>Shift</kbd>+<kbd>Enter</kbd> for a new line</p>
    </div>
  );
}

// A row in the composer "+" menu. `soon` renders it as a disabled "coming soon"
// item; `check` shows a selected tick; children render on the right (e.g. a value).
function MenuItem({ icon: Icon, iconColor, label, onClick, soon, check, children }: {
  icon: typeof Tag; iconColor?: string; label: string; onClick?: () => void; soon?: boolean; check?: boolean; children?: React.ReactNode;
}) {
  return (
    <button onClick={soon ? undefined : onClick} disabled={soon}
      className="w-full flex items-center gap-2.5 px-3 py-2 text-sm transition-colors hover:bg-[var(--bg-surface-2)] disabled:hover:bg-transparent disabled:cursor-default"
      style={{ color: soon ? "var(--text-muted)" : "var(--text-primary)" }}>
      <Icon className="w-4 h-4 shrink-0" style={{ color: iconColor ?? (soon ? "var(--text-muted)" : "var(--text-secondary)") }} />
      {label}
      {soon && <span className="ml-auto text-[10px] font-semibold px-1.5 py-0.5 rounded-full" style={{ backgroundColor: "var(--bg-surface-2)", color: "var(--text-muted)" }}>Soon</span>}
      {check && <Check className="w-3.5 h-3.5 ml-auto" style={{ color: ACCENT }} />}
      {children}
    </button>
  );
}

function ContextChip({ children, color, bg, onClear }: { children: React.ReactNode; color: string; bg: string; onClear: () => void }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full pl-2 pr-1 py-0.5 text-[11px] font-semibold" style={{ backgroundColor: bg, color }}>
      {children}
      <button onClick={onClear} className="w-4 h-4 rounded-full flex items-center justify-center hover:bg-black/10" style={{ color }}><X className="w-3 h-3" /></button>
    </span>
  );
}

// ── Thread popup — replies for one (structured) post, centered modal ──
function ThreadModal({ post: p, channel, refresh, onClose }: {
  post: ChannelPost; channel: Channel; refresh: () => void; onClose: () => void;
}) {
  const [tick, setTick] = useState(0);
  const replies = useMemo(() => getPostReplies(p.id), [p.id, tick]);
  const [reply, setReply] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  const st = POST_TYPE_STYLE[p.postType];
  const Icon = POST_TYPE_ICON[p.postType];

  useEffect(() => { endRef.current?.scrollIntoView({ block: "end" }); }, [replies.length]);

  function send() {
    if (!reply.trim()) return;
    addPostReply(p.id, reply);
    setReply(""); setTick(t => t + 1); refresh();
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-lg max-h-[80vh] flex flex-col rounded-2xl overflow-hidden" onClick={e => e.stopPropagation()} style={{ backgroundColor: "var(--bg-surface)", boxShadow: "0 24px 64px rgba(0,0,0,0.4)" }}>
      <div className="px-4 py-3 shrink-0 flex items-center justify-between gap-2" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
        <div className="min-w-0">
          <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Thread</p>
          <p className="text-[11px] truncate" style={{ color: "var(--text-muted)" }}>{channel.name}</p>
        </div>
        <button onClick={onClose} title="Close thread" className="w-7 h-7 rounded-md flex items-center justify-center transition-colors hover:bg-[var(--bg-surface-2)]" style={{ color: "var(--text-muted)" }}><X className="w-4 h-4" /></button>
      </div>

      <div className="flex-1 overflow-y-auto thin-scroll-y px-4 py-3">
        {/* Root post */}
        <div className="pb-3 mb-3" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold text-white shrink-0" style={{ backgroundColor: "#6b7280" }}>{initials(p.author)}</span>
            <span className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>{p.author}</span>
            <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>{p.createdAt}</span>
            {p.postType !== "message" && <span className="inline-flex items-center gap-1 text-[9px] font-semibold px-1 py-0.5 rounded" style={{ backgroundColor: st.bg, color: st.color }}><Icon className="w-2.5 h-2.5" />{st.label}</span>}
          </div>
          <p className="text-sm leading-relaxed whitespace-pre-wrap break-words" style={{ color: "var(--text-primary)" }}>{p.content}</p>
        </div>

        <p className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--text-muted)" }}>{replies.length} {replies.length === 1 ? "reply" : "replies"}</p>
        <div className="space-y-3">
          {replies.map(r => (
            <div key={r.id} className="flex gap-2">
              <span className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold text-white shrink-0 mt-0.5" style={{ backgroundColor: "#6b7280" }}>{initials(r.author)}</span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>{r.author}</span>
                  <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>{r.createdAt}</span>
                </div>
                <p className="text-sm leading-snug whitespace-pre-wrap break-words" style={{ color: "var(--text-primary)" }}>{r.content}</p>
              </div>
            </div>
          ))}
          {replies.length === 0 && (
            <p className="text-xs flex items-center gap-1.5" style={{ color: "var(--text-muted)" }}><CornerDownRight className="w-3.5 h-3.5" /> No replies yet — start the thread.</p>
          )}
        </div>
        <div ref={endRef} />
      </div>

      <div className="shrink-0 px-3 py-3" style={{ borderTop: "1px solid var(--border-subtle)" }}>
        <div className="flex items-end gap-1.5 rounded-xl px-2 py-1.5" style={{ backgroundColor: "var(--bg-surface-2)", border: "1px solid var(--border)" }}>
          <textarea value={reply} onChange={e => setReply(e.target.value)} rows={1} placeholder="Reply…"
            className="flex-1 bg-transparent text-sm outline-none resize-none thin-scroll-y py-1.5" style={{ color: "var(--text-primary)", maxHeight: 140 }}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }} />
          <button onClick={send} disabled={!reply.trim()} className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-white disabled:opacity-40" style={{ backgroundColor: ACCENT }} title="Send reply"><Send className="w-4 h-4" /></button>
        </div>
      </div>
      </div>
    </div>
  );
}

// ─── Members section (permission-gated add/remove) ────────
function MembersSection({ channel, refresh, tick }: { channel: Channel; refresh: () => void; tick: number }) {
  const members = useMemo(() => getChannelMembers(channel.id), [channel.id, tick]);
  const canManage = useMemo(() => canManageChannelMembers(channel.id), [channel.id, tick]);
  const [adding, setAdding] = useState(false);
  const [pick, setPick] = useState("");

  // People not already in this channel — the add picker source.
  const available = useMemo(
    () => getWorkspacePeople().filter(n => !members.some(m => m.name === n)),
    [members],
  );

  function add() {
    if (!pick) return;
    addChannelMember(channel.id, pick, "member");
    setPick(""); setAdding(false); refresh();
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Members · {members.length}</p>
        {canManage && !adding && (
          <button onClick={() => setAdding(true)} className="flex items-center gap-1 text-[11px] font-medium" style={{ color: ACCENT }}>
            <UserPlus className="w-3 h-3" /> Add
          </button>
        )}
      </div>

      {/* Add picker — only for channel admins */}
      {canManage && adding && (
        <div className="flex items-center gap-1.5 mb-2">
          <div className="flex-1 min-w-0">
            <UiSelect size="sm" value={pick} onChange={setPick}
              options={available.length ? [{ value: "", label: "Select a person…" }, ...available.map(n => ({ value: n, label: n }))] : [{ value: "", label: "Everyone is already a member" }]} />
          </div>
          <button onClick={add} disabled={!pick} className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-white disabled:opacity-40 shrink-0" style={{ backgroundColor: ACCENT }}>Add</button>
          <button onClick={() => { setAdding(false); setPick(""); }} title="Cancel" className="w-7 h-7 rounded-md flex items-center justify-center shrink-0" style={{ border: "1px solid var(--border)", color: "var(--text-muted)" }}><X className="w-3.5 h-3.5" /></button>
        </div>
      )}

      <ul className="space-y-1">
        {members.map(m => (
          <li key={m.name} className="flex items-center gap-2 group">
            <span className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold text-white shrink-0" style={{ backgroundColor: m.role === "admin" ? channel.accent : "#6b7280" }}>{personInitials(m.name)}</span>
            <span className="text-xs truncate flex-1 min-w-0" style={{ color: "var(--text-primary)" }}>{m.name}{m.name === CURRENT_USER && <span className="text-[10px]" style={{ color: "var(--text-muted)" }}> · you</span>}</span>
            {m.role === "admin" && <ShieldCheck className="w-3 h-3 shrink-0" style={{ color: channel.accent }} aria-label={CHANNEL_ROLE_LABELS.admin} />}
            {canManage && m.name !== CURRENT_USER && (
              <button onClick={() => { if (confirm(`Remove ${m.name} from ${channel.name}?`)) { removeChannelMember(channel.id, m.name); refresh(); } }}
                title="Remove" className="w-5 h-5 rounded flex items-center justify-center shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: "#dc2626" }}>
                <X className="w-3 h-3" />
              </button>
            )}
          </li>
        ))}
      </ul>
      {!canManage && <p className="text-[10px] mt-1.5" style={{ color: "var(--text-muted)" }}>Only channel admins can add or remove members.</p>}
    </div>
  );
}

function personInitials(name: string): string {
  const p = name.trim().split(/\s+/);
  return (p.length >= 2 ? p[0][0] + p[p.length - 1][0] : name.slice(0, 2)).toUpperCase();
}

// ─── Right details panel ──────────────────────────────────
function ChannelDetails({ channel, refresh, onEdit, onCollapse, tick }: { channel: Channel; refresh: () => void; onEdit: () => void; onCollapse: () => void; tick: number }) {
  const recent = useMemo(() => getChannelPosts(channel.id).slice(0, 4), [channel.id, tick]);
  const LINKED_APPS = ["CRM", "HR", "Inventory", "Documents"];
  return (
    <aside className="w-80 h-full shrink-0 overflow-y-auto thin-scroll-y p-4 space-y-4" style={{ borderLeft: "1px solid var(--border)", backgroundColor: "var(--bg-surface)" }}>
      <div className="flex items-center gap-2.5">
        <span className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 text-sm font-bold text-white" style={{ backgroundColor: channel.accent }}>{channelInitials(channel.name)}</span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold truncate" style={{ color: "var(--text-primary)" }}>{channel.name}</p>
          <p className="text-xs truncate" style={{ color: "var(--text-muted)" }}>{CHANNEL_TYPE_LABELS[channel.type]}</p>
        </div>
        <button onClick={onCollapse} title="Hide details" className="w-7 h-7 rounded-md flex items-center justify-center shrink-0 transition-colors hover:bg-[var(--bg-surface-2)]" style={{ color: "var(--text-muted)" }}>
          <X className="w-4 h-4" />
        </button>
      </div>

      <DetailRow label="Description" value={channel.description} />
      <div className="grid grid-cols-2 gap-3">
        <DetailRow label="Type" value={CHANNEL_TYPE_LABELS[channel.type]} />
        <DetailRow label="Visibility" value={VISIBILITY_LABELS[channel.visibility]} icon={channel.visibility === "private" ? Lock : undefined} />
        <DetailRow label="Status" value={channel.status === "archived" ? "Archived" : "Active"} />
      </div>
      {channel.context && <DetailRow label="Linked company / location" value={channel.context} />}
      {channel.managers.length > 0 && <DetailRow label="Managers / owners" value={channel.managers.join(", ")} />}

      <MembersSection channel={channel} refresh={refresh} tick={tick} />

      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: "var(--text-muted)" }}>Linked apps</p>
        <div className="flex flex-wrap gap-1.5">
          {LINKED_APPS.map(a => <span key={a} className="text-[11px] px-1.5 py-0.5 rounded" style={{ backgroundColor: "var(--bg-surface-2)", color: "var(--text-secondary)" }}>{a}</span>)}
        </div>
        <p className="text-[10px] mt-1" style={{ color: "var(--text-muted)" }}>Record linking arrives in a later phase.</p>
      </div>

      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: "var(--text-muted)" }}>Recent activity</p>
        {recent.length === 0 ? <p className="text-xs" style={{ color: "var(--text-muted)" }}>No recent posts.</p> : (
          <ul className="space-y-1.5">
            {recent.map(p => (
              <li key={p.id} className="flex items-start gap-2 text-xs" style={{ color: "var(--text-secondary)" }}>
                <Clock className="w-3 h-3 mt-0.5 shrink-0" style={{ color: "var(--text-muted)" }} />
                <span className="min-w-0"><span className="truncate">{p.content}</span> <span style={{ color: "var(--text-muted)" }}>· {p.createdAt}</span></span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="pt-1 space-y-1.5" style={{ borderTop: "1px solid var(--border-subtle)" }}>
        <p className="text-[10px] font-semibold uppercase tracking-wider mb-0.5 mt-2" style={{ color: "var(--text-muted)" }}>Quick actions</p>
        <QuickAction icon={Pencil} label="Edit channel" onClick={onEdit} />
        <QuickAction icon={Pin} label={channel.pinned ? "Unpin channel" : "Pin channel"} onClick={() => { togglePinChannel(channel.id); refresh(); }} />
        {channel.status !== "archived" && <QuickAction icon={Archive} label="Archive channel" onClick={() => { if (confirm(`Archive ${channel.name}?`)) { archiveChannel(channel.id); refresh(); } }} />}
      </div>
    </aside>
  );
}

// ─── Create modal ─────────────────────────────────────────
function CreateChannelModal({ onClose, onCreated }: { onClose: () => void; onCreated: (c: Channel) => void }) {
  const [name, setName] = useState(""); const [description, setDescription] = useState("");
  const [type, setType] = useState<ChannelType>("team"); const [visibility, setVisibility] = useState<ChannelVisibility>("everyone");
  const [context, setContext] = useState("");
  const valid = name.trim().length > 0;
  function create() { if (!valid) return; onCreated(createChannel({ name, description, type, visibility, context: context.trim() || undefined })); }
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-lg rounded-2xl overflow-hidden" onClick={e => e.stopPropagation()} style={{ backgroundColor: "var(--bg-surface)", boxShadow: "0 16px 48px rgba(0,0,0,0.24)" }}>
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
          <p className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>Create Channel</p>
          <button onClick={onClose} style={{ color: "var(--text-muted)" }}><X className="w-4 h-4" /></button>
        </div>
        <div className="p-5 space-y-3">
          <Field label="Channel name *"><input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Service Team" className={inp} style={inpStyle} autoFocus /></Field>
          <Field label="Description"><textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} placeholder="What's this channel for?" className={inp + " resize-none"} style={inpStyle} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Channel type"><UiSelect value={type} onChange={v => setType(v as ChannelType)} options={CHANNEL_TYPE_OPTIONS.map(t => ({ value: t, label: CHANNEL_TYPE_LABELS[t] }))} /></Field>
            <Field label="Visibility"><UiSelect value={visibility} onChange={v => setVisibility(v as ChannelVisibility)} options={VISIBILITY_OPTIONS.map(v => ({ value: v, label: VISIBILITY_LABELS[v] }))} /></Field>
          </div>
          <Field label="Company / location context" hint="Optional"><input value={context} onChange={e => setContext(e.target.value)} placeholder="e.g. Augusta Branch" className={inp} style={inpStyle} /></Field>
          <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>Members and roles can be managed after creating the channel.</p>
        </div>
        <div className="px-5 py-3 flex items-center justify-end gap-2" style={{ borderTop: "1px solid var(--border-subtle)" }}>
          <button onClick={onClose} className="text-sm font-medium px-3 py-2 rounded-lg" style={{ color: "var(--text-secondary)" }}>Cancel</button>
          <button onClick={create} disabled={!valid} className="text-sm font-medium px-4 py-2 rounded-lg text-white disabled:opacity-40" style={{ backgroundColor: ACCENT }}>Create Channel</button>
        </div>
      </div>
    </div>
  );
}

// ─── Edit drawer ──────────────────────────────────────────
const ACCENT_SWATCHES = ["#14b8a6", "#0ea5e9", "#6366f1", "#a855f7", "#ec4899", "#f59e0b", "#f97316", "#ef4444", "#10b981", "#8b5cf6", "#6b7280"];
function EditChannelDrawer({ channel, onClose, onSaved, onArchived }: { channel: Channel; onClose: () => void; onSaved: () => void; onArchived: () => void }) {
  const [name, setName] = useState(channel.name); const [description, setDescription] = useState(channel.description);
  const [type, setType] = useState<ChannelType>(channel.type); const [visibility, setVisibility] = useState<ChannelVisibility>(channel.visibility);
  const [accent, setAccent] = useState(channel.accent); const [context, setContext] = useState(channel.context ?? "");
  function save() { updateChannel(channel.id, { name: name.trim() || channel.name, description, type, visibility, accent, context: context.trim() || undefined }); onSaved(); }
  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-[460px] h-full flex flex-col" style={{ backgroundColor: "var(--bg-surface)", borderLeft: "1px solid var(--border)", boxShadow: "-16px 0 48px -12px rgba(0,0,0,0.3)" }}>
        <div className="flex items-center justify-between px-5 py-4 shrink-0" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
          <p className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>Channel Settings</p>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-[var(--bg-surface-2)]" style={{ color: "var(--text-secondary)" }}><X className="w-4 h-4" /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          <Field label="Channel name"><input value={name} onChange={e => setName(e.target.value)} className={inp} style={inpStyle} /></Field>
          <Field label="Description"><textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} className={inp + " resize-none"} style={inpStyle} /></Field>
          <Field label="Icon color">
            <div className="flex flex-wrap gap-1.5">
              {ACCENT_SWATCHES.map(c => (
                <button key={c} onClick={() => setAccent(c)} className="w-7 h-7 rounded-md transition-transform" style={{ backgroundColor: c, outline: accent === c ? "2px solid var(--text-primary)" : "none", outlineOffset: 2 }} />
              ))}
            </div>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Channel type"><UiSelect value={type} onChange={v => setType(v as ChannelType)} options={CHANNEL_TYPE_OPTIONS.map(t => ({ value: t, label: CHANNEL_TYPE_LABELS[t] }))} /></Field>
            <Field label="Visibility"><UiSelect value={visibility} onChange={v => setVisibility(v as ChannelVisibility)} options={VISIBILITY_OPTIONS.map(v => ({ value: v, label: VISIBILITY_LABELS[v] }))} /></Field>
          </div>
          <Field label="Company / location context" hint="Optional"><input value={context} onChange={e => setContext(e.target.value)} className={inp} style={inpStyle} /></Field>
          <div className="rounded-lg px-3 py-2.5 flex items-center gap-2" style={{ backgroundColor: "var(--bg-surface-2)", border: "1px solid var(--border-subtle)" }}>
            <Users className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--text-muted)" }} />
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>Member &amp; manager management arrives with the permission model.</span>
          </div>
        </div>
        <div className="px-5 py-3 flex items-center justify-between gap-2 shrink-0" style={{ borderTop: "1px solid var(--border-subtle)" }}>
          <div className="flex items-center gap-1.5">
            {channel.status !== "archived" && <button onClick={() => { if (confirm(`Archive ${channel.name}?`)) { archiveChannel(channel.id); onArchived(); } }} className="flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-lg" style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}><Archive className="w-3.5 h-3.5" /> Archive</button>}
            <button onClick={() => alert("Delete is a placeholder — channels are archived for now.")} className="p-2 rounded-lg" style={{ border: "1px solid var(--border)", color: "#dc2626" }} title="Delete (placeholder)"><Trash2 className="w-3.5 h-3.5" /></button>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="text-sm font-medium px-3 py-2 rounded-lg" style={{ color: "var(--text-secondary)" }}>Cancel</button>
            <button onClick={save} className="text-sm font-medium px-4 py-2 rounded-lg text-white" style={{ backgroundColor: ACCENT }}>Save Changes</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── bits ─────────────────────────────────────────────────
const inp = "w-full rounded-lg px-3 py-2 text-sm outline-none";
const inpStyle: React.CSSProperties = { border: "1px solid var(--border)", backgroundColor: "var(--bg-surface-2)", color: "var(--text-primary)" };

function channelInitials(name: string): string { return name.replace(/[^a-zA-Z]/g, "").slice(0, 2).toUpperCase() || "CH"; }

// Renders text with the matched query highlighted. For long messages it shifts
// the window so the match stays visible inside the single-line (truncated) row.
function Highlight({ text, q }: { text: string; q: string }) {
  if (!q) return <>{text}</>;
  const i = text.toLowerCase().indexOf(q.toLowerCase());
  if (i < 0) return <>{text}</>;
  const start = Math.max(0, i - 18);
  return (
    <>
      {start > 0 ? "…" : ""}{text.slice(start, i)}
      <mark style={{ backgroundColor: ACCENT + "33", color: "inherit", borderRadius: 2, padding: "0 1px" }}>{text.slice(i, i + q.length)}</mark>
      {text.slice(i + q.length)}
    </>
  );
}
function initials(name: string): string {
  const p = name.trim().split(/\s+/);
  return (p.length >= 2 ? p[0][0] + p[p.length - 1][0] : name.slice(0, 2)).toUpperCase();
}
function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="flex items-center gap-1.5 text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>
        {label}{hint && <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>· {hint}</span>}
      </label>
      {children}
    </div>
  );
}
function DetailRow({ label, value, icon: Icon }: { label: string; value: string; icon?: typeof Lock }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wider mb-0.5" style={{ color: "var(--text-muted)" }}>{label}</p>
      <p className="text-sm flex items-center gap-1.5" style={{ color: "var(--text-primary)" }}>{Icon && <Icon className="w-3.5 h-3.5" style={{ color: "var(--text-muted)" }} />}{value}</p>
    </div>
  );
}
function QuickAction({ icon: Icon, label, onClick }: { icon: typeof Pencil; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-sm text-left transition-colors hover:bg-[var(--bg-surface-2)]" style={{ color: "var(--text-secondary)" }}>
      <Icon className="w-4 h-4 shrink-0" /> {label}
    </button>
  );
}
function Chip({ children, tone }: { children: React.ReactNode; tone?: "muted" }) {
  return <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded shrink-0" style={tone === "muted" ? { backgroundColor: "var(--bg-input)", color: "var(--text-muted)" } : { backgroundColor: "var(--accent-soft-bg)", color: "var(--accent-text)" }}>{children}</span>;
}
function EmptyState({ icon: Icon, text }: { icon: typeof MessagesSquare; text: string }) {
  return (
    <div className="rounded-xl p-10 text-center" style={{ border: "1px dashed var(--border)", backgroundColor: "var(--bg-surface)" }}>
      <Icon className="w-6 h-6 mx-auto mb-2" style={{ color: "var(--text-muted)" }} />
      <p className="text-sm" style={{ color: "var(--text-muted)" }}>{text}</p>
    </div>
  );
}
