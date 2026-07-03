"use client";

// ─── Communications — customer communication command center ──
// Three intentional columns: a smart Communication Queue (who needs a response),
// a structured Conversation Workspace (messages + internal notes + CRM events on
// one timeline, with a channel-aware composer), and a Customer + Work Context
// panel (the job/estimate/invoice it's connected to, plus actions). Built on the
// localStorage-backed inbox store so message functionality keeps working.

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  Search, Plus, Filter, Send, Paperclip, ChevronDown, ExternalLink, Phone, Mail, Voicemail,
  PhoneMissed, User, Briefcase, FileText, Receipt, ShieldCheck, Zap, StickyNote,
  CircleDot, Clock, Sparkles, MapPin, UserPlus, Calendar, Star, CheckCircle2,
  MessageSquare as MessageSquareIcon, Inbox as InboxIcon, PanelRightClose, PanelRightOpen, X,
  Bot, RefreshCw, Pencil, Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useDataVersion } from "@/lib/sync/useDataVersion";
import {
  getConversations, getConversation, previewOf, markRead, sendMessage, addNote, setStatus, assignOwner,
  getOwners, matchesView,
  CHANNEL_META, STATUS_META,
  type Conversation, type InboxChannel, type ConvStatus, type QueueView, type LinkedType, type TimelineItem,
} from "@/lib/inbox/data";
import { draftReply, canAutoSend, isAutopilot, setAutopilot, awaitingReply } from "@/lib/inbox/ai";

const ACCENT = "#4f46e5";
const ACCENT_SOFT = "var(--accent-soft-bg)";

// Channel is the primary, centralized scope (top tabs, like the jobs module tabs).
const CHANNEL_TABS = [
  { key: "call",     label: "Call",           icon: Phone },
  { key: "sms",      label: "SMS",            icon: MessageSquareIcon },
  { key: "email",    label: "Email",          icon: Mail },
  { key: "internal", label: "Internal Notes", icon: StickyNote },
] as const;
type ChannelTab = typeof CHANNEL_TABS[number]["key"];

function matchesChannel(c: Conversation, tab: ChannelTab): boolean {
  switch (tab) {
    case "call":     return c.channel === "call" || c.channel === "voicemail" || c.timeline.some(t => t.kind === "call");
    case "sms":      return c.channel === "sms";
    case "email":    return c.channel === "email";
    case "internal": return c.status === "internal_review" || c.timeline.some(t => t.kind === "note");
  }
}

// Secondary status views (combine with the channel tab).
const VIEWS: { key: QueueView; label: string }[] = [
  { key: "all", label: "All" }, { key: "needs_response", label: "Needs Response" }, { key: "unread", label: "Unread" },
  { key: "waiting", label: "Waiting" }, { key: "follow_up", label: "Follow-Up Due" }, { key: "archived", label: "Archived" },
];

const LINKED_ICON: Record<LinkedType, typeof Briefcase> = {
  job: Briefcase, estimate: FileText, invoice: Receipt, maintenance: ShieldCheck, agreement: ShieldCheck,
};

function initials(name: string): string {
  const p = name.replace(/\(.*\)/, "").trim().split(/\s+/);
  return (p.length >= 2 ? p[0][0] + p[p.length - 1][0] : name.slice(0, 2)).toUpperCase();
}
const me = "Sarah Chen"; // the acting office user (notes/call logs attributed here)

export default function CommunicationsPage() {
  const rev = useDataVersion();
  const convos = useMemo(() => getConversations(), [rev]);
  const [channelTab, setChannelTab] = useState<ChannelTab>("sms");
  const [view, setView] = useState<QueueView>("all");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(convos[0]?.id ?? null);
  const [contextOpen, setContextOpen] = useState(true);
  const [filterOpen, setFilterOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  const selected = useMemo(() => (selectedId ? getConversation(selectedId) : undefined), [selectedId, rev]);

  // Queue list is scoped by channel tab + view only; free-text search surfaces a
  // results overlay (conversations + matching messages) like the Team Workspace search.
  const filtered = convos.filter(c => matchesChannel(c, channelTab) && matchesView(c, view));

  const sq = search.trim().toLowerCase();
  const convoHits = sq
    ? convos.filter(c => c.name.toLowerCase().includes(sq) || c.linked.some(l => l.label.toLowerCase().includes(sq))).slice(0, 4)
    : [];
  const messageHits = sq
    ? convos.flatMap(c => c.timeline.flatMap(t =>
        (t.kind === "message" || t.kind === "note") && t.text.toLowerCase().includes(sq)
          ? [{ c, text: t.text, time: t.time, author: t.kind === "note" ? t.author : (t.from === "us" ? "You" : c.name) }]
          : [],
      )).slice(0, 8)
    : [];

  const counts = useMemo(() => ({
    needs: convos.filter(c => matchesView(c, "needs_response")).length,
    unread: convos.filter(c => c.unread && c.status !== "archived").length,
  }), [convos]);

  function open(id: string) { setSelectedId(id); markRead(id); }

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ backgroundColor: "var(--bg-page)" }}>
      {/* Page header */}
      <header className="shrink-0 px-5 py-3 flex items-center gap-4" style={{ borderBottom: "1px solid var(--border)", backgroundColor: "var(--bg-page)" }}>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-semibold truncate" style={{ color: "var(--text-primary)" }}>Communications</h1>
          <p className="text-xs hidden md:block truncate" style={{ color: "var(--text-muted)" }}>Messages, calls, and follow-ups in one place.</p>
        </div>

        {/* Centralized channel tabs — same centered segmented control as the Leads view tabs */}
        <div className="flex items-center rounded-lg overflow-hidden" style={{ border: "1px solid var(--border)" }}>
          {CHANNEL_TABS.map(t => {
            const active = channelTab === t.key;
            return (
              <button key={t.key} onClick={() => setChannelTab(t.key)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm transition-colors"
                style={{ backgroundColor: active ? ACCENT : "var(--bg-surface)", color: active ? "#fff" : "var(--text-secondary)" }}>
                <t.icon className="w-3.5 h-3.5" /> {t.label}
              </button>
            );
          })}
        </div>

        <div className="flex-1 flex items-center justify-end gap-2">
          {counts.unread > 0 && <Stat label="unread" value={counts.unread} tone={ACCENT} />}
          {/* Filter (replaces the old view tab strip) */}
          <div className="relative">
            <button onClick={() => setFilterOpen(o => !o)} title="Filter conversations"
              className="flex items-center justify-center w-9 h-9 rounded-lg transition-colors hover:bg-[var(--bg-surface-2)]"
              style={{ border: "1px solid var(--border)", color: view !== "all" ? ACCENT : "var(--text-secondary)" }}>
              <Filter className="w-4 h-4" />
            </button>
            {filterOpen && (
              <div className="absolute right-0 top-full mt-1 z-20 w-52 rounded-lg overflow-hidden py-1" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" }} onMouseLeave={() => setFilterOpen(false)}>
                {VIEWS.map(v => {
                  const n = convos.filter(c => matchesChannel(c, channelTab) && matchesView(c, v.key)).length;
                  return (
                    <button key={v.key} onClick={() => { setView(v.key); setFilterOpen(false); }}
                      className="w-full flex items-center justify-between px-3 py-1.5 text-xs text-left hover:bg-[var(--bg-surface-2)]"
                      style={{ color: view === v.key ? ACCENT : "var(--text-primary)", fontWeight: view === v.key ? 600 : 400 }}>
                      {v.label}{n > 0 && <span className="opacity-60">{n}</span>}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          <button onClick={() => setContextOpen(o => !o)} title={contextOpen ? "Hide context panel" : "Show context panel"}
            className="hidden xl:flex items-center justify-center w-9 h-9 rounded-lg transition-colors hover:bg-[var(--bg-surface-2)]" style={{ border: "1px solid var(--border)", color: contextOpen ? ACCENT : "var(--text-secondary)" }}>
            {contextOpen ? <PanelRightClose className="w-4 h-4" /> : <PanelRightOpen className="w-4 h-4" />}
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* ── Left: Communication Queue ── */}
        <aside className="flex flex-col shrink-0 w-72" style={{ backgroundColor: "var(--bg-page)", borderRight: "1px solid var(--border)" }}>
          <div className="px-2.5 pt-2.5 pb-2 shrink-0" style={{ borderBottom: "1px solid var(--border)" }}>
            <div className="flex items-center gap-1.5">
              <div className="relative flex-1 min-w-0">
                <div className="flex items-center gap-2 rounded-lg px-2.5 py-1.5" style={{ backgroundColor: "var(--bg-input)" }}>
                  <Search className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--text-muted)" }} />
                  <input value={search} onFocusCapture={() => setSearchOpen(true)} onChange={e => { setSearch(e.target.value); setSearchOpen(true); }} placeholder="Search conversations, people, messages…"
                    className="bg-transparent text-[13px] outline-none w-full min-w-0" style={{ color: "var(--text-primary)" }} />
                  {search && <button onClick={() => { setSearch(""); setSearchOpen(false); }} title="Clear" className="shrink-0" style={{ color: "var(--text-muted)" }}><X className="w-3.5 h-3.5" /></button>}
                </div>
                {searchOpen && sq && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setSearchOpen(false)} />
                    <div className="absolute left-0 right-0 top-full mt-2 z-50 rounded-xl overflow-hidden" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "0 12px 32px rgba(0,0,0,0.2)" }}>
                      <div className="max-h-[26rem] overflow-y-auto thin-scroll-y py-1">
                        {convoHits.length === 0 && messageHits.length === 0 ? (
                          <p className="px-3 py-4 text-xs text-center" style={{ color: "var(--text-muted)" }}>No matches for &ldquo;{search.trim()}&rdquo;.</p>
                        ) : (
                          <>
                            {convoHits.length > 0 && (
                              <>
                                <p className="text-[10px] font-semibold uppercase tracking-wider px-3 pt-2 pb-1" style={{ color: "var(--text-muted)" }}>Conversations</p>
                                {convoHits.map(c => (
                                  <button key={c.id} onClick={() => { open(c.id); setSearch(""); setSearchOpen(false); }} className="w-full flex items-center gap-2.5 px-3 py-1.5 text-left transition-colors hover:bg-[var(--bg-surface-2)]">
                                    <span className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-[9px] font-bold text-white" style={{ backgroundColor: "#6b7280" }}>{initials(c.name)}</span>
                                    <span className="text-sm font-medium truncate flex-1" style={{ color: "var(--text-primary)" }}><Highlight text={c.name} q={sq} /></span>
                                    {c.linked[0] && <span className="text-[10px] shrink-0 truncate max-w-[90px]" style={{ color: "var(--text-muted)" }}>{c.linked[0].label}</span>}
                                  </button>
                                ))}
                              </>
                            )}
                            {messageHits.length > 0 && (
                              <>
                                <p className="text-[10px] font-semibold uppercase tracking-wider px-3 pt-2 pb-1" style={{ color: "var(--text-muted)", borderTop: convoHits.length ? "1px solid var(--border)" : "none" }}>Messages</p>
                                {messageHits.map((h, i) => (
                                  <button key={i} onClick={() => { open(h.c.id); setSearch(""); setSearchOpen(false); }} className="w-full flex items-start gap-2.5 px-3 py-1.5 text-left transition-colors hover:bg-[var(--bg-surface-2)]">
                                    <span className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-[9px] font-bold text-white mt-0.5" style={{ backgroundColor: "#6b7280" }}>{initials(h.c.name)}</span>
                                    <span className="min-w-0 flex-1">
                                      <span className="flex items-center justify-between gap-2">
                                        <span className="text-[11px] font-medium truncate" style={{ color: "var(--text-secondary)" }}>{h.c.name} · {h.author}</span>
                                        <span className="text-[10px] shrink-0" style={{ color: "var(--text-muted)" }}>{h.time}</span>
                                      </span>
                                      <span className="block text-xs truncate" style={{ color: "var(--text-primary)" }}><Highlight text={h.text} q={sq} /></span>
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
              <button title="New conversation" className="shrink-0 flex items-center justify-center w-8 h-8 rounded-lg text-white transition-opacity hover:opacity-90" style={{ backgroundColor: ACCENT }}>
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {filtered.length === 0
              ? <p className="text-xs text-center py-10" style={{ color: "var(--text-muted)" }}>No conversations in this view.</p>
              : filtered.map(c => <QueueRow key={c.id} c={c} selected={c.id === selectedId} onClick={() => open(c.id)} />)}
          </div>
        </aside>

        {/* ── Center: Conversation Workspace ── */}
        <section className="flex-1 flex flex-col min-w-0" style={{ backgroundColor: "var(--bg-page)" }}>
          {selected ? <Workspace key={selected.id} c={selected} mode={channelTab} needsCount={counts.needs} /> : <EmptyCenter />}
        </section>

        {/* ── Right: Customer + Work Context (collapsible, eased) ── */}
        <aside className="hidden xl:block shrink-0 overflow-hidden" style={{ width: contextOpen ? 320 : 0, transition: "width 0.32s cubic-bezier(0.4, 0, 0.2, 1)" }}>
          <div className="w-[320px] h-full overflow-y-auto" style={{ borderLeft: "1px solid var(--border)", backgroundColor: "var(--bg-page)" }}>
            {selected && <ContextPanel c={selected} />}
          </div>
        </aside>
      </div>
    </div>
  );
}

// ─── Left: queue row ──────────────────────────────────────
function QueueRow({ c, selected, onClick }: { c: Conversation; selected: boolean; onClick: () => void }) {
  const ch = CHANNEL_META[c.channel];
  const st = STATUS_META[c.status];
  const linked = c.linked[0];
  const missed = c.timeline.some(t => t.kind === "call" && t.direction === "missed");
  return (
    <button onClick={onClick} className="w-full text-left px-2.5 py-2 flex items-start gap-2.5 transition-colors hover:bg-[var(--bg-surface-2)] relative"
      style={{ backgroundColor: selected ? ACCENT_SOFT : "transparent", borderBottom: "1px solid var(--border)" }}>
      {selected && <span className="absolute left-0 top-0 bottom-0 w-0.5" style={{ backgroundColor: ACCENT }} />}
      <div className="relative shrink-0 mt-0.5">
        <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold" style={{ backgroundColor: selected ? "var(--accent-soft-2-bg)" : "#6b7280", color: selected ? "var(--accent-text-strong)" : "#fff" }}>{initials(c.name)}</div>
        <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full flex items-center justify-center" style={{ backgroundColor: "var(--bg-surface)" }}>
          <span className="w-3 h-3 rounded-full flex items-center justify-center" style={{ backgroundColor: ch.color + "22" }}>
            {missed ? <PhoneMissed className="w-1.5 h-1.5" style={{ color: "#dc2626" }} /> : <ch.icon className="w-1.5 h-1.5" style={{ color: ch.color }} />}
          </span>
        </span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-1">
          <span className={cn("text-[13px] truncate", c.unread ? "font-semibold" : "font-medium")} style={{ color: "var(--text-primary)" }}>{c.name}</span>
          <span className="text-[10px] shrink-0" style={{ color: c.unread ? ACCENT : "var(--text-muted)" }}>{c.lastActivity}</span>
        </div>
        <p className="text-xs truncate mt-0.5" style={{ color: c.unread ? "var(--text-secondary)" : "var(--text-muted)" }}>{previewOf(c)}</p>
        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
          <span className="inline-flex items-center gap-1 text-[9px] font-semibold px-1.5 py-0.5 rounded-full" style={{ backgroundColor: st.color + "22", color: st.color }}>
            <span className="w-1 h-1 rounded-full" style={{ backgroundColor: st.color }} />{st.label}
          </span>
          {linked && <span className="text-[9px] px-1.5 py-0.5 rounded truncate max-w-[120px]" style={{ backgroundColor: "var(--bg-input)", color: "var(--text-muted)" }}>{linked.label}</span>}
        </div>
      </div>
    </button>
  );
}

// ─── Center: workspace ────────────────────────────────────
function Workspace({ c, mode, needsCount }: { c: Conversation; mode: ChannelTab; needsCount: number }) {
  const st = STATUS_META[c.status];
  const [text, setText] = useState("");
  const [statusOpen, setStatusOpen] = useState(false);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const isNote = mode === "internal" || mode === "call";

  // ── AI assistant ──
  const [aiDraft, setAiDraft] = useState<{ text: string; source: "claude" | "local" } | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [autopilot, setAutopilotState] = useState(() => isAutopilot(c.id));
  const handledRef = useRef<string | null>(null);
  // The channel the AI replies on (fall back to a sendable one for call/note tabs).
  const replyChannel: InboxChannel = mode === "sms" || mode === "email" ? mode : c.channel === "email" ? "email" : "sms";

  const generate = async () => {
    setAiLoading(true);
    try { setAiDraft(await draftReply(c)); } finally { setAiLoading(false); }
  };
  const approveSend = (t: string) => {
    const v = t.trim(); if (!v) return;
    sendMessage(c.id, replyChannel, v);
    setAiDraft(null); setText("");
  };

  const submit = () => {
    const v = text.trim(); if (!v) return;
    if (mode === "internal") addNote(c.id, me, v);
    else if (mode === "call") addNote(c.id, me, `📞 Call note: ${v}`);
    else sendMessage(c.id, mode, v);
    setText(""); setAiDraft(null);
  };
  const onKey = (e: React.KeyboardEvent) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); } };

  const toggleAutopilot = () => {
    const next = !autopilot;
    setAutopilot(c.id, next); setAutopilotState(next);
    if (!next) handledRef.current = null;
  };

  // Auto-pilot: on a new unanswered customer message, draft — then send it if it's
  // routine, or surface it for approval if it's sensitive. One pass per message.
  const lastMsgId = c.timeline[c.timeline.length - 1]?.id;
  useEffect(() => {
    if (!autopilot || !awaitingReply(c)) return;
    const inbound = [...c.timeline].reverse().find(t => t.kind === "message" && t.from === "customer");
    if (!inbound || handledRef.current === inbound.id) return;
    handledRef.current = inbound.id;
    let cancelled = false;
    (async () => {
      const d = await draftReply(c);
      if (cancelled) return;
      const auto = canAutoSend(c);
      if (auto.ok) {
        sendMessage(c.id, replyChannel, d.text);
        addNote(c.id, "AI Assistant", `🤖 Auto-replied: “${d.text}”`);
        setAiDraft(null);
      } else {
        setAiDraft(d);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autopilot, lastMsgId]);

  return (
    <>
      {/* Header */}
      <header className="flex items-center justify-between gap-3 px-5 py-2.5 shrink-0" style={{ borderBottom: "1px solid var(--border)" }}>
        <div className="flex items-center gap-3 min-w-0">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold truncate" style={{ color: "var(--text-primary)" }}>{c.name}</h2>
            </div>
            <div className="flex items-center gap-2 mt-0.5 text-[11px]" style={{ color: "var(--text-muted)" }}>
              <span>{c.contact.phone}</span>
              {c.ownerName && <span className="inline-flex items-center gap-1"><User className="w-3 h-3" /> {c.ownerName}</span>}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Auto-pilot toggle */}
          <button onClick={toggleAutopilot} title="Let the AI assistant draft replies and auto-send the routine ones"
            className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1.5 rounded-lg transition-colors"
            style={{ backgroundColor: autopilot ? ACCENT_SOFT : "var(--bg-input)", color: autopilot ? "var(--accent-text-strong)" : "var(--text-muted)", border: `1px solid ${autopilot ? "var(--accent-soft-border)" : "var(--border)"}` }}>
            <Bot className="w-3.5 h-3.5" /> Auto-reply
            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: autopilot ? "#16a34a" : "var(--text-muted)" }} />
          </button>
          {/* Status control */}
          <div className="relative">
            <button onClick={() => setStatusOpen(o => !o)} className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1.5 rounded-lg" style={{ backgroundColor: st.color + "1a", color: st.color }}>
              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: st.color }} />{st.label}<ChevronDown className="w-3 h-3" />
            </button>
            {statusOpen && (
              <div className="absolute right-0 top-full mt-1 z-20 w-44 rounded-lg overflow-hidden py-1" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" }}>
                {(Object.keys(STATUS_META) as ConvStatus[]).map(s => (
                  <button key={s} onClick={() => { setStatus(c.id, s); setStatusOpen(false); }} className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-left hover:bg-[var(--bg-surface-2)]" style={{ color: "var(--text-primary)" }}>
                    <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: STATUS_META[s].color }} />{STATUS_META[s].label}
                  </button>
                ))}
              </div>
            )}
          </div>
          {needsCount > 0 && <Stat label="need response" value={needsCount} tone="#dc2626" />}
          <IconBtn title="Call"><Phone className="w-4 h-4" /></IconBtn>
        </div>
      </header>

      {/* Timeline */}
      <div className="flex-1 overflow-y-auto px-5 py-5" style={{ backgroundColor: "var(--bg-page)" }}>
        <div className="space-y-2.5">
          {c.timeline.map(t => <TimelineRow key={t.id} t={t} name={c.name} />)}
        </div>
      </div>

      {/* Composer */}
      <div className="shrink-0 px-5 py-3" style={{ borderTop: "1px solid var(--border)", backgroundColor: "transparent" }}>
        {/* AI assistant — draft a reply; approve before it reaches the customer */}
        {!isNote && (
          <div className="mb-2.5">
            {aiDraft ? (
              <div className="rounded-xl p-2.5" style={{ border: "1px solid var(--accent-soft-border)", backgroundColor: ACCENT_SOFT }}>
                <div className="flex items-center gap-1.5 mb-1.5">
                  <Sparkles className="w-3 h-3" style={{ color: "var(--accent-text-strong)" }} />
                  <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--accent-text-strong)" }}>AI draft</span>
                  <span className="text-[9px] px-1.5 py-0.5 rounded-full" style={{ backgroundColor: "var(--bg-surface)", color: "var(--text-muted)" }}>{aiDraft.source === "claude" ? "Claude" : "Assistant"}</span>
                  <span className="text-[10px] ml-auto hidden sm:block" style={{ color: "var(--text-muted)" }}>Review before it reaches the customer</span>
                </div>
                <p className="text-sm mb-2 leading-relaxed" style={{ color: "var(--text-primary)" }}>{aiDraft.text}</p>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <button onClick={() => approveSend(aiDraft.text)} className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg text-white" style={{ backgroundColor: ACCENT }}><Send className="w-3.5 h-3.5" /> Approve &amp; Send</button>
                  <button onClick={() => { setText(aiDraft.text); setAiDraft(null); taRef.current?.focus(); }} className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg hover:bg-[var(--bg-surface)]" style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}><Pencil className="w-3.5 h-3.5" /> Edit</button>
                  <button onClick={generate} disabled={aiLoading} className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg hover:bg-[var(--bg-surface)] disabled:opacity-50" style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}><RefreshCw className={cn("w-3.5 h-3.5", aiLoading && "animate-spin")} /> Regenerate</button>
                  <button onClick={() => setAiDraft(null)} title="Dismiss" className="ml-auto inline-flex items-center justify-center w-7 h-7 rounded-lg hover:bg-[var(--bg-surface)]" style={{ color: "var(--text-muted)" }}><X className="w-3.5 h-3.5" /></button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <button onClick={generate} disabled={aiLoading} className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1.5 rounded-lg disabled:opacity-60" style={{ backgroundColor: ACCENT_SOFT, color: "var(--accent-text-strong)", border: "1px solid var(--accent-soft-border)" }}>
                  {aiLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                  {aiLoading ? "Drafting…" : "Draft with AI"}
                </button>
                {autopilot && <span className="inline-flex items-center gap-1 text-[10px] font-medium" style={{ color: "#16a34a" }}><Bot className="w-3 h-3" /> Auto-reply on — routine replies send automatically</span>}
              </div>
            )}
          </div>
        )}

        {/* Input */}
        <div className="rounded-xl px-3 py-2" style={{ border: `1px solid ${isNote ? "#f59e0b66" : "var(--border)"}`, backgroundColor: isNote ? "#f59e0b0d" : "var(--bg-surface)" }}>
          {isNote && <p className="text-[10px] font-semibold mb-1 flex items-center gap-1" style={{ color: "#b45309" }}><StickyNote className="w-3 h-3" /> Internal {mode === "call" ? "call log" : "note"} — not sent to the customer</p>}
          <textarea ref={taRef} value={text} onChange={e => setText(e.target.value)} onKeyDown={onKey} rows={2}
            placeholder={isNote ? "Add an internal note for the team…" : `Message ${c.name} via ${CHANNEL_META[mode].label}…`}
            className="w-full resize-none text-sm outline-none bg-transparent" style={{ color: "var(--text-primary)" }} />
          <div className="flex items-center justify-between pt-1.5">
            <div className="flex items-center gap-0.5">
              <AttachMenu />
              <IconBtn title="Create follow-up task" onClick={() => setStatus(c.id, "follow_up")}><Clock className="w-4 h-4" /></IconBtn>
            </div>
            <button onClick={submit} disabled={!text.trim()} className="flex items-center gap-1.5 text-sm font-medium px-4 py-1.5 rounded-lg text-white transition-opacity disabled:opacity-40" style={{ backgroundColor: isNote ? "#f59e0b" : ACCENT }}>
              {isNote ? <><StickyNote className="w-3.5 h-3.5" /> {mode === "call" ? "Log call" : "Save note"}</> : <><Send className="w-3.5 h-3.5" /> Send</>}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// timeline item renderer
function TimelineRow({ t, name }: { t: TimelineItem; name: string }) {
  if (t.kind === "event") {
    return (
      <div className="flex justify-center my-1">
        <span className="inline-flex items-center gap-1.5 text-[10px] font-medium px-2.5 py-1 rounded-full" style={{ backgroundColor: "var(--bg-surface-2)", color: "var(--text-muted)" }}>
          <CircleDot className="w-3 h-3" style={{ color: "var(--accent-icon)" }} /> {t.label} · {t.time}
        </span>
      </div>
    );
  }
  if (t.kind === "note") {
    return (
      <div className="rounded-xl px-3.5 py-2.5 w-full" style={{ backgroundColor: "#f59e0b14", border: "1px solid #f59e0b40" }}>
        <div className="flex items-center gap-1.5 mb-1">
          <StickyNote className="w-3 h-3" style={{ color: "#b45309" }} />
          <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "#b45309" }}>Internal note</span>
          <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>· {t.author} · {t.time}</span>
        </div>
        <p className="text-sm" style={{ color: "var(--text-primary)" }}>{t.text}</p>
      </div>
    );
  }
  if (t.kind === "call") {
    return (
      <div className="rounded-xl px-3.5 py-2.5 w-full" style={{ backgroundColor: "var(--bg-surface-2)", border: "1px solid var(--border)" }}>
        <div className="flex items-center gap-1.5 mb-0.5">
          {t.direction === "missed" ? <PhoneMissed className="w-3.5 h-3.5" style={{ color: "#dc2626" }} /> : <Phone className="w-3.5 h-3.5" style={{ color: "#059669" }} />}
          <span className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>{t.direction === "missed" ? "Missed call" : "Call"}{t.durationSec ? ` · ${Math.floor(t.durationSec / 60)}:${String(t.durationSec % 60).padStart(2, "0")}` : ""}</span>
          <span className="text-[10px] ml-auto" style={{ color: "var(--text-muted)" }}>{t.time}</span>
        </div>
        {t.voicemail && <div className="flex items-start gap-1.5 mt-1.5 text-xs" style={{ color: "var(--text-secondary)" }}><Voicemail className="w-3.5 h-3.5 mt-0.5 shrink-0" style={{ color: "#a855f7" }} /> “{t.voicemail}”</div>}
      </div>
    );
  }
  // message
  const isUs = t.from === "us";
  const ch = CHANNEL_META[t.channel];
  return (
    <div className={cn("flex items-end gap-2", isUs ? "justify-end" : "justify-start")}>
      {!isUs && <div className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold text-white shrink-0" style={{ backgroundColor: "#6b7280" }}>{initials(name)}</div>}
      <div className={cn("flex flex-col max-w-[68%]", isUs ? "items-end" : "items-start")}>
        <div className="px-3.5 py-2.5 text-sm leading-relaxed break-words" style={{ backgroundColor: isUs ? "var(--bubble-out-bg)" : "var(--bubble-in-bg)", color: isUs ? "var(--bubble-out-text)" : "var(--bubble-in-text)", borderRadius: isUs ? "16px 16px 4px 16px" : "16px 16px 16px 4px" }}>{t.text}</div>
        <div className="flex items-center gap-1 mt-1 px-1">
          <ch.icon className="w-2.5 h-2.5" style={{ color: "var(--text-muted)" }} />
          <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>{t.time}</span>
        </div>
      </div>
    </div>
  );
}

// ─── Right: context panel ─────────────────────────────────
function ContextPanel({ c }: { c: Conversation }) {
  const [ownerOpen, setOwnerOpen] = useState(false);
  const owners = getOwners();
  const job = c.linked.find(l => l.type === "job");
  const est = c.linked.find(l => l.type === "estimate");
  const inv = c.linked.find(l => l.type === "invoice");
  const agr = c.linked.find(l => l.type === "agreement" || l.type === "maintenance");

  return (
    <div className="p-4 space-y-4">
      {/* Contact */}
      <Card>
        <div className="flex items-center gap-2.5 mb-2.5">
          <div className="w-9 h-9 rounded-full flex items-center justify-center text-[11px] font-bold" style={{ backgroundColor: "var(--accent-soft-2-bg)", color: "var(--accent-text-strong)" }}>{initials(c.contact.name)}</div>
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate" style={{ color: "var(--text-primary)" }}>{c.contact.name}</p>
            <div className="flex items-center gap-1.5">
              {c.customerStatus && <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full" style={{ backgroundColor: "var(--accent-soft-2-bg)", color: "var(--accent-text-strong)" }}>{c.customerStatus}</span>}
              {c.tags.map(t => <span key={t} className="text-[9px] px-1.5 py-0.5 rounded" style={{ backgroundColor: "var(--bg-input)", color: "var(--text-muted)" }}>{t}</span>)}
            </div>
          </div>
        </div>
        <Row icon={Phone}>{c.contact.phone}</Row>
        {c.contact.email && <Row icon={Mail}>{c.contact.email}</Row>}
        {c.contact.pref && <Row icon={Zap}>Prefers {CHANNEL_META[c.contact.pref].label}</Row>}
        {c.propertyLabel && <Row icon={MapPin}>{c.propertyLabel}</Row>}
        <OutlineBtn className="mt-3"><User className="w-3.5 h-3.5" /> View customer</OutlineBtn>
      </Card>

      {/* Owner */}
      <Card>
        <Label icon={UserPlus}>Owner</Label>
        <div className="relative">
          <button onClick={() => setOwnerOpen(o => !o)} className="w-full flex items-center justify-between text-sm px-3 py-2 rounded-lg" style={{ border: "1px solid var(--border)", color: "var(--text-primary)" }}>
            <span className="flex items-center gap-2"><span className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold" style={{ backgroundColor: "var(--accent-soft-2-bg)", color: "var(--accent-text-strong)" }}>{c.ownerName ? initials(c.ownerName) : "?"}</span>{c.ownerName ?? "Unassigned"}</span>
            <ChevronDown className="w-3.5 h-3.5" style={{ color: "var(--text-muted)" }} />
          </button>
          {ownerOpen && (
            <div className="absolute left-0 right-0 top-full mt-1 z-20 rounded-lg overflow-hidden py-1 max-h-56 overflow-y-auto" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" }}>
              {owners.map(o => <button key={o} onClick={() => { assignOwner(c.id, o); setOwnerOpen(false); }} className="w-full text-left px-3 py-1.5 text-xs hover:bg-[var(--bg-surface-2)]" style={{ color: "var(--text-primary)" }}>{o}</button>)}
            </div>
          )}
        </div>
      </Card>

      {/* Linked job */}
      {job && (
        <Card>
          <Label icon={Briefcase}>Active Job</Label>
          <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{job.label}</p>
          {job.meta?.status && <Meta>{job.meta.status}{job.meta.time ? ` · ${job.meta.time}` : ""}</Meta>}
          {job.meta?.tech && <Row icon={User}>{job.meta.tech}</Row>}
          {job.href && <Link href={job.href} className="block"><OutlineBtn className="mt-2.5"><ExternalLink className="w-3.5 h-3.5" /> Open job</OutlineBtn></Link>}
        </Card>
      )}

      {/* Estimate */}
      {est && (
        <Card>
          <Label icon={FileText}>Estimate</Label>
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{est.meta?.amount ?? est.label}</p>
            {est.meta?.status && <StatusTag color="#8b5cf6">{est.meta.status}</StatusTag>}
          </div>
          <Meta>{est.label}</Meta>
          <OutlineBtn className="mt-2.5"><Send className="w-3.5 h-3.5" /> Send follow-up</OutlineBtn>
        </Card>
      )}

      {/* Invoice */}
      {inv && (
        <Card>
          <Label icon={Receipt}>Invoice</Label>
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{inv.meta?.balance ?? inv.label}</p>
            {inv.meta?.status && <StatusTag color={inv.meta.status === "Past due" ? "#dc2626" : "#0891b2"}>{inv.meta.status}</StatusTag>}
          </div>
          {inv.meta?.due && <Meta>Due {inv.meta.due}</Meta>}
          <OutlineBtn className="mt-2.5"><Receipt className="w-3.5 h-3.5" /> Send reminder</OutlineBtn>
        </Card>
      )}

      {/* Agreement */}
      {agr && (
        <Card>
          <Label icon={ShieldCheck}>Agreement</Label>
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{agr.label}</p>
            {agr.meta?.status && <StatusTag color="#16a34a">{agr.meta.status}</StatusTag>}
          </div>
          {agr.meta?.nextVisit && <Meta>Next visit · {agr.meta.nextVisit}</Meta>}
        </Card>
      )}

      {/* Quick actions */}
      <Card>
        <Label icon={Zap}>Quick Actions</Label>
        <div className="grid grid-cols-2 gap-1.5">
          {[
            { label: "Schedule job", icon: Calendar },
            { label: "Create task", icon: Clock },
            { label: "Send estimate", icon: FileText },
            { label: "Send invoice", icon: Receipt },
            { label: "Request review", icon: Star },
            { label: "Mark resolved", icon: CheckCircle2, onClick: () => setStatus(c.id, "resolved") },
          ].map(a => (
            <button key={a.label} onClick={a.onClick} className="flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-2 rounded-lg transition-colors hover:bg-[var(--bg-surface-2)]" style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}>
              <a.icon className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--text-muted)" }} /> {a.label}
            </button>
          ))}
        </div>
      </Card>
    </div>
  );
}

// ─── Small bits ───────────────────────────────────────────
function EmptyCenter() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-3 px-6 text-center">
      <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ backgroundColor: "var(--accent-soft-bg)" }}><InboxIcon className="w-6 h-6" style={{ color: "var(--accent-text)" }} /></div>
      <div>
        <p className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>Pick a conversation</p>
        <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>Select a thread to read, reply, and see its full work context.</p>
      </div>
    </div>
  );
}
function Highlight({ text, q }: { text: string; q: string }) {
  if (!q) return <>{text}</>;
  const i = text.toLowerCase().indexOf(q);
  if (i === -1) return <>{text}</>;
  return <>{text.slice(0, i)}<mark className="rounded-sm px-0.5" style={{ backgroundColor: "var(--accent-soft-bg)", color: "var(--accent-text-strong)" }}>{text.slice(i, i + q.length)}</mark>{text.slice(i + q.length)}</>;
}
function Stat({ label, value, tone }: { label: string; value: number; tone: string }) {
  return <span className="text-[11px] font-semibold px-2 py-1 rounded-md" style={{ backgroundColor: tone + "1a", color: tone }}>{value} {label}</span>;
}
function Card({ children }: { children: React.ReactNode }) {
  return <div className="rounded-xl p-4" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)" }}>{children}</div>;
}
function Label({ icon: Icon, children }: { icon: typeof User; children: React.ReactNode }) {
  return <div className="flex items-center gap-1.5 mb-2.5"><Icon className="w-3 h-3" style={{ color: "var(--text-muted)" }} /><p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>{children}</p></div>;
}
function Row({ icon: Icon, children }: { icon: typeof User; children: React.ReactNode }) {
  return <div className="flex items-center gap-2 text-xs mt-1.5" style={{ color: "var(--text-secondary)" }}><Icon className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--text-muted)" }} /> <span className="truncate">{children}</span></div>;
}
function Meta({ children }: { children: React.ReactNode }) { return <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>{children}</p>; }
function StatusTag({ color, children }: { color: string; children: React.ReactNode }) {
  return <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: color + "22", color }}>{children}</span>;
}
function OutlineBtn({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <button className={`w-full flex items-center justify-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg transition-colors hover:bg-[var(--bg-surface-2)] ${className}`} style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}>{children}</button>;
}
function IconBtn({ title, children, onClick }: { title: string; children: React.ReactNode; onClick?: () => void }) {
  return <button title={title} onClick={onClick} className="flex items-center justify-center w-8 h-8 rounded-lg transition-colors hover:bg-[var(--bg-surface-2)]" style={{ color: "var(--text-secondary)" }}>{children}</button>;
}
function AttachMenu() {
  const [open, setOpen] = useState(false);
  const items = ["Estimate", "Invoice", "Document", "Photo", "Schedule send"];
  return (
    <div className="relative">
      <IconBtn title="Attach" onClick={() => setOpen(o => !o)}><Paperclip className="w-4 h-4" /></IconBtn>
      {open && (
        <div className="absolute left-0 bottom-full mb-1 z-20 w-40 rounded-lg overflow-hidden py-1" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" }} onMouseLeave={() => setOpen(false)}>
          {items.map(i => <button key={i} className="w-full text-left px-3 py-1.5 text-xs hover:bg-[var(--bg-surface-2)]" style={{ color: "var(--text-primary)" }}>{i}</button>)}
        </div>
      )}
    </div>
  );
}
