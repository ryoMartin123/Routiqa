"use client";

import { useMemo, useState } from "react";
import {
  Search, MessageSquare, Mail, Phone, PhoneMissed, Paperclip, Send, Plus,
  ExternalLink, MoreHorizontal, CheckCheck, Smile, Clock, User, Briefcase, Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────
type Channel = "sms" | "email" | "call";

interface Message {
  id: number;
  from: "customer" | "us";
  text: string;
  time: string;
}

interface ActiveJob { title: string; time: string; tech: string }

interface Conversation {
  id: number;
  name: string;
  preview: string;
  time: string;
  job: string;
  type: Channel;
  unread: boolean;
  missed?: boolean;
  contact: { name: string; phone: string; email?: string };
  activeJob: ActiveJob | null;
  messages: Message[];
}

// ─── Channel config ───────────────────────────────────────
const CHANNELS: Record<Channel, { label: string; icon: typeof MessageSquare; color: string }> = {
  sms:   { label: "SMS",   icon: MessageSquare, color: "#4f46e5" },
  email: { label: "Email", icon: Mail,          color: "#0891b2" },
  call:  { label: "Call",  icon: Phone,         color: "#059669" },
};

const QUICK_REPLIES = [
  "On the way 🚐",
  "Running ~15 min late",
  "Job complete — invoice sent",
  "Can we reschedule?",
  "Thanks! Let us know if anything else comes up.",
];

// ─── Mock data ────────────────────────────────────────────
const SEED: Conversation[] = [
  {
    id: 1, name: "K. Brennan", preview: "Sounds good, see you at 3:30", time: "2m",
    job: "Job #2231", type: "sms", unread: false,
    contact: { name: "K. Brennan", phone: "(303) 555-0142", email: "kbrennan@email.com" },
    activeJob: { title: "Water heater install", time: "Today · 3:30 PM", tech: "J. Patel" },
    messages: [
      { id: 1, from: "customer", text: "Hey — what time again for the water heater?", time: "2:14 PM" },
      { id: 2, from: "us", text: "We've got you booked for 3:30 today. J. Patel is the tech.", time: "2:18 PM" },
      { id: 3, from: "customer", text: "Sounds good, see you at 3:30", time: "2:21 PM" },
    ],
  },
  {
    id: 2, name: "Hammond LLC", preview: "Re: Invoice 1042 — can we split?", time: "18m",
    job: "Job #2218", type: "email", unread: true,
    contact: { name: "Hammond LLC", phone: "(706) 442-8800", email: "ap@hammondllc.com" },
    activeJob: { title: "Roof inspection", time: "May 28 · 10:00 AM", tech: "D. Nguyen" },
    messages: [
      { id: 1, from: "customer", text: "Hey, regarding Invoice 1042 — is it possible to split the payment into two installments?", time: "9:42 AM" },
    ],
  },
  {
    id: 3, name: "T. Okafor", preview: "Confirming tomorrow's estimate", time: "1h",
    job: "Lead", type: "sms", unread: false,
    contact: { name: "T. Okafor", phone: "(803) 391-4422" },
    activeJob: null,
    messages: [
      { id: 1, from: "customer", text: "Confirming tomorrow's estimate for the roof damage?", time: "1:10 PM" },
    ],
  },
  {
    id: 4, name: "Lakeside Apts", preview: "Missed call · 45s voicemail", time: "3h",
    job: "Job #2228", type: "call", unread: true, missed: true,
    contact: { name: "Lakeside Apts", phone: "(706) 555-2200" },
    activeJob: { title: "Drain cleaning", time: "Today · 10:30 AM", tech: "M. Cole" },
    messages: [
      { id: 1, from: "customer", text: "Missed call · 45s voicemail left", time: "11:14 AM" },
    ],
  },
  {
    id: 5, name: "Alvarez Residence", preview: "Thanks for the quick fix!", time: "1d",
    job: "Job #2230", type: "sms", unread: false,
    contact: { name: "Alvarez Residence", phone: "(803) 229-1183", email: "alvarez@email.com" },
    activeJob: { title: "HVAC tune-up", time: "Yesterday · 8:00 AM", tech: "J. Patel" },
    messages: [
      { id: 1, from: "us", text: "All done with the tune-up — system's running great. Invoice on its way.", time: "Yesterday" },
      { id: 2, from: "customer", text: "Thanks for the quick fix!", time: "Yesterday" },
    ],
  },
];

// ─── Helpers ──────────────────────────────────────────────
function initials(name: string): string {
  const p = name.replace(/\(.*\)/, "").trim().split(/\s+/);
  return (p.length >= 2 ? p[0][0] + p[p.length - 1][0] : name.slice(0, 2)).toUpperCase();
}
function nowLabel(): string {
  return new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

// ─── Page ─────────────────────────────────────────────────
export default function InboxPage() {
  const [convos, setConvos]       = useState<Conversation[]>(SEED);
  const [selectedId, setSelected] = useState(1);
  const [filter, setFilter]       = useState<"all" | Channel>("all");
  const [search, setSearch]       = useState("");
  const [reply, setReply]         = useState("");
  const [channel, setChannel]     = useState<Channel>("sms");

  const selected = convos.find(c => c.id === selectedId) ?? convos[0];

  const counts = useMemo(() => ({
    all:   convos.length,
    sms:   convos.filter(c => c.type === "sms").length,
    email: convos.filter(c => c.type === "email").length,
    call:  convos.filter(c => c.type === "call").length,
  }), [convos]);
  const unreadTotal = convos.filter(c => c.unread).length;

  const filtered = convos.filter(c => {
    if (filter !== "all" && c.type !== filter) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return c.name.toLowerCase().includes(q) || c.preview.toLowerCase().includes(q) || c.job.toLowerCase().includes(q);
  });

  function openConversation(id: number) {
    setSelected(id);
    setConvos(cs => cs.map(c => (c.id === id ? { ...c, unread: false } : c)));
    const c = convos.find(x => x.id === id);
    setChannel(c?.type === "email" ? "email" : "sms");
  }

  function send() {
    const text = reply.trim();
    if (!text) return;
    setConvos(cs => cs.map(c => c.id === selectedId
      ? { ...c, preview: text, time: "now", unread: false,
          messages: [...c.messages, { id: Date.now(), from: "us", text, time: nowLabel() }] }
      : c));
    setReply("");
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  }

  const composerChannel = CHANNELS[channel];

  return (
    <div className="flex h-full overflow-hidden" style={{ backgroundColor: "var(--bg-page)" }}>
      {/* ── Left: conversation list ───────────────────────── */}
      <aside className="flex flex-col shrink-0 w-[300px]" style={{ backgroundColor: "var(--bg-surface)", borderRight: "1px solid var(--border-subtle)" }}>
        {/* Header */}
        <div className="px-4 pt-5 pb-3 shrink-0" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>Inbox</h1>
              {unreadTotal > 0 && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ backgroundColor: "var(--accent-soft-2-bg)", color: "var(--accent-text)" }}>
                  {unreadTotal} new
                </span>
              )}
            </div>
            <button title="New message" className="flex items-center justify-center w-7 h-7 rounded-lg text-white transition-colors hover:opacity-90" style={{ backgroundColor: "#4f46e5" }}>
              <Plus className="w-4 h-4" />
            </button>
          </div>

          {/* Search */}
          <div className="flex items-center gap-2 rounded-lg px-3 py-2" style={{ backgroundColor: "var(--bg-input)" }}>
            <Search className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--text-muted)" }} />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search messages"
              className="bg-transparent text-xs outline-none flex-1 min-w-0" style={{ color: "var(--text-primary)" }} />
          </div>

          {/* Channel filter pills */}
          <div className="flex items-center gap-1 mt-3">
            {([
              { key: "all",   label: "All" },
              { key: "sms",   label: "SMS" },
              { key: "email", label: "Email" },
              { key: "call",  label: "Calls" },
            ] as const).map(t => {
              const active = filter === t.key;
              const c = counts[t.key];
              return (
                <button key={t.key} onClick={() => setFilter(t.key)}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors"
                  style={{
                    backgroundColor: active ? "var(--accent-soft-bg)" : "transparent",
                    color: active ? "var(--accent-text)" : "var(--text-muted)",
                    border: `1px solid ${active ? "var(--accent-soft-border)" : "transparent"}`,
                  }}>
                  {t.label}
                  <span className="text-[9px] font-bold px-1 rounded-full" style={{ backgroundColor: active ? "var(--accent-soft-2-bg)" : "var(--bg-input)", color: active ? "var(--accent-text)" : "var(--text-muted)" }}>{c}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {filtered.length === 0 ? (
            <p className="text-xs text-center py-10" style={{ color: "var(--text-muted)" }}>No conversations found.</p>
          ) : filtered.map(c => {
            const ch = CHANNELS[c.type];
            const isSel = c.id === selectedId;
            return (
              <button key={c.id} onClick={() => openConversation(c.id)}
                className="w-full text-left px-3 py-3 flex items-start gap-3 transition-colors hover:bg-[var(--bg-surface-2)]"
                style={{
                  backgroundColor: isSel ? "var(--accent-soft-bg)" : "transparent",
                  borderBottom: "1px solid var(--border-subtle)",
                  borderLeft: `2px solid ${isSel ? "#4f46e5" : "transparent"}`,
                }}>
                {/* Avatar + channel chip */}
                <div className="relative shrink-0">
                  <div className="w-9 h-9 rounded-full flex items-center justify-center text-[11px] font-bold text-white" style={{ backgroundColor: isSel ? "#4f46e5" : "#6b7280" }}>
                    {initials(c.name)}
                  </div>
                  <span className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full flex items-center justify-center" style={{ backgroundColor: "var(--bg-surface)" }}>
                    <span className="w-3.5 h-3.5 rounded-full flex items-center justify-center" style={{ backgroundColor: ch.color + "22" }}>
                      {c.missed
                        ? <PhoneMissed className="w-2 h-2" style={{ color: "#dc2626" }} />
                        : <ch.icon className="w-2 h-2" style={{ color: ch.color }} />}
                    </span>
                  </span>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <span className={cn("text-sm truncate", c.unread ? "font-semibold" : "font-medium")} style={{ color: "var(--text-primary)" }}>{c.name}</span>
                    <span className="text-[10px] shrink-0" style={{ color: c.unread ? "var(--accent-text)" : "var(--text-muted)" }}>{c.time}</span>
                  </div>
                  <p className="text-xs truncate mt-0.5" style={{ color: c.unread ? "var(--text-secondary)" : "var(--text-muted)" }}>{c.preview}</p>
                  <div className="flex items-center gap-1.5 mt-1.5">
                    <span className="text-[9px] font-medium px-1.5 py-0.5 rounded" style={{ backgroundColor: "var(--bg-input)", color: "var(--text-muted)" }}>{c.job}</span>
                    {c.unread && <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: "#4f46e5" }} />}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </aside>

      {/* ── Center: chat ──────────────────────────────────── */}
      <section className="flex-1 flex flex-col min-w-0" style={{ backgroundColor: "var(--bg-surface)" }}>
        {selected && (
          <>
            {/* Chat header */}
            <header className="flex items-center justify-between gap-3 px-5 py-3 shrink-0" style={{ borderBottom: "1px solid var(--border-subtle)", backgroundColor: "var(--bg-surface)" }}>
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-full flex items-center justify-center text-[11px] font-bold text-white shrink-0" style={{ backgroundColor: "#4f46e5" }}>{initials(selected.name)}</div>
                <div className="min-w-0">
                  <h2 className="text-sm font-semibold truncate" style={{ color: "var(--text-primary)" }}>{selected.name}</h2>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <ChannelBadge type={selected.type} />
                    <span className="text-xs" style={{ color: "var(--text-muted)" }}>· {selected.contact.phone}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <IconBtn title="Call"><Phone className="w-4 h-4" /></IconBtn>
                <IconBtn title="Email"><Mail className="w-4 h-4" /></IconBtn>
                {selected.activeJob && (
                  <button className="hidden sm:flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors hover:bg-[var(--bg-surface-2)]" style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}>
                    <ExternalLink className="w-3.5 h-3.5" /> Open job
                  </button>
                )}
                <IconBtn title="More"><MoreHorizontal className="w-4 h-4" /></IconBtn>
              </div>
            </header>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-5 py-5" style={{ backgroundColor: "var(--bg-page)" }}>
              <div className="flex justify-center mb-5">
                <span className="text-[10px] font-medium px-2.5 py-1 rounded-full" style={{ backgroundColor: "var(--bg-surface-2)", color: "var(--text-muted)" }}>Today</span>
              </div>
              <div className="space-y-3">
                {selected.messages.map(m => {
                  const isUs = m.from === "us";
                  return (
                    <div key={m.id} className={cn("flex items-end gap-2", isUs ? "justify-end" : "justify-start")}>
                      {!isUs && (
                        <div className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold text-white shrink-0" style={{ backgroundColor: "#6b7280" }}>{initials(selected.name)}</div>
                      )}
                      <div className={cn("flex flex-col max-w-[68%]", isUs ? "items-end" : "items-start")}>
                        <div className="px-3.5 py-2.5 text-sm leading-relaxed break-words"
                          style={{
                            backgroundColor: isUs ? "var(--bubble-out-bg)" : "var(--bubble-in-bg)",
                            color: isUs ? "var(--bubble-out-text)" : "var(--bubble-in-text)",
                            borderRadius: isUs ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
                          }}>
                          {m.text}
                        </div>
                        <div className="flex items-center gap-1 mt-1 px-1">
                          <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>{m.time}</span>
                          {isUs && <CheckCheck className="w-3 h-3" style={{ color: "var(--accent-text)" }} />}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Composer */}
            <div className="shrink-0 px-5 py-3" style={{ borderTop: "1px solid var(--border-subtle)", backgroundColor: "var(--bg-surface)" }}>
              {/* Quick replies */}
              <div className="flex items-center gap-1.5 mb-2.5 overflow-x-auto thin-scroll-x pb-0.5">
                <Zap className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--text-muted)" }} />
                {QUICK_REPLIES.map(r => (
                  <button key={r} onClick={() => setReply(r)}
                    className="shrink-0 text-[11px] px-2.5 py-1 rounded-full transition-colors hover:bg-[var(--accent-soft-bg)]"
                    style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}>
                    {r}
                  </button>
                ))}
              </div>

              {/* Input row */}
              <div className="rounded-xl px-3 py-2" style={{ border: "1px solid var(--border)", backgroundColor: "var(--bg-surface)" }}>
                <textarea value={reply} onChange={e => setReply(e.target.value)} onKeyDown={onKeyDown}
                  placeholder={`Message ${selected.name} via ${composerChannel.label}…`} rows={2}
                  className="w-full resize-none text-sm outline-none bg-transparent" style={{ color: "var(--text-primary)" }} />
                <div className="flex items-center justify-between pt-1.5">
                  <div className="flex items-center gap-1">
                    {/* Channel toggle */}
                    <div className="flex items-center rounded-lg overflow-hidden mr-1" style={{ border: "1px solid var(--border)" }}>
                      {(["sms", "email"] as const).map(ch => {
                        const active = channel === ch;
                        const C = CHANNELS[ch];
                        return (
                          <button key={ch} onClick={() => setChannel(ch)} title={C.label}
                            className="flex items-center gap-1 px-2 py-1 text-[11px] font-medium transition-colors"
                            style={{ backgroundColor: active ? "#4f46e5" : "var(--bg-surface)", color: active ? "#fff" : "var(--text-muted)" }}>
                            <C.icon className="w-3 h-3" /> {C.label}
                          </button>
                        );
                      })}
                    </div>
                    <IconBtn title="Attach"><Paperclip className="w-4 h-4" /></IconBtn>
                    <IconBtn title="Emoji"><Smile className="w-4 h-4" /></IconBtn>
                  </div>
                  <button onClick={send} disabled={!reply.trim()}
                    className="flex items-center gap-1.5 text-sm font-medium px-4 py-1.5 rounded-lg text-white transition-colors disabled:opacity-40"
                    style={{ backgroundColor: "#4f46e5" }}>
                    <Send className="w-3.5 h-3.5" /> Send
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </section>

      {/* ── Right: context ────────────────────────────────── */}
      <aside className="hidden lg:flex flex-col shrink-0 w-[280px] overflow-y-auto p-4 gap-4" style={{ borderLeft: "1px solid var(--border-subtle)", backgroundColor: "var(--bg-page)" }}>
        {selected && (
          <>
            {/* Contact card */}
            <Card>
              <SectionLabel icon={User}>Contact</SectionLabel>
              <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{selected.contact.name}</p>
              <div className="mt-2 space-y-1.5">
                <div className="flex items-center gap-2 text-xs" style={{ color: "var(--text-secondary)" }}>
                  <Phone className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--text-muted)" }} /> {selected.contact.phone}
                </div>
                {selected.contact.email && (
                  <div className="flex items-center gap-2 text-xs" style={{ color: "var(--text-secondary)" }}>
                    <Mail className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--text-muted)" }} /> <span className="truncate">{selected.contact.email}</span>
                  </div>
                )}
              </div>
              <button className="w-full mt-3 text-xs font-medium px-3 py-2 rounded-lg transition-colors hover:bg-[var(--bg-surface-2)]" style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}>
                View customer
              </button>
            </Card>

            {/* Active job card */}
            {selected.activeJob ? (
              <Card>
                <SectionLabel icon={Briefcase}>Active Job</SectionLabel>
                <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{selected.activeJob.title}</p>
                <div className="mt-2 space-y-1.5">
                  <div className="flex items-center gap-2 text-xs" style={{ color: "var(--text-secondary)" }}>
                    <Clock className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--text-muted)" }} /> {selected.activeJob.time}
                  </div>
                  <div className="flex items-center gap-2 text-xs" style={{ color: "var(--text-secondary)" }}>
                    <User className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--text-muted)" }} /> {selected.activeJob.tech}
                  </div>
                </div>
                <span className="inline-block mt-2.5 text-[10px] font-medium px-1.5 py-0.5 rounded" style={{ backgroundColor: "var(--bg-input)", color: "var(--text-muted)" }}>{selected.job}</span>
              </Card>
            ) : (
              <Card>
                <SectionLabel icon={Briefcase}>Active Job</SectionLabel>
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>No job linked to this conversation yet.</p>
                <button className="w-full mt-3 text-xs font-medium px-3 py-2 rounded-lg transition-colors hover:bg-[var(--bg-surface-2)]" style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}>
                  Link a job
                </button>
              </Card>
            )}

            {/* Quick actions */}
            <Card>
              <SectionLabel icon={Zap}>Quick Actions</SectionLabel>
              <div className="space-y-1.5">
                {[
                  { label: "Create task", icon: Clock },
                  { label: "Schedule job", icon: Briefcase },
                  { label: "Send invoice", icon: Mail },
                ].map(a => (
                  <button key={a.label} className="w-full flex items-center gap-2 text-xs font-medium px-3 py-2 rounded-lg transition-colors hover:bg-[var(--bg-surface-2)]" style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}>
                    <a.icon className="w-3.5 h-3.5" style={{ color: "var(--text-muted)" }} /> {a.label}
                  </button>
                ))}
              </div>
            </Card>
          </>
        )}
      </aside>
    </div>
  );
}

// ─── Small shared bits ────────────────────────────────────
function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl p-4" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-subtle)", boxShadow: "var(--shadow-card)" }}>
      {children}
    </div>
  );
}

function SectionLabel({ icon: Icon, children }: { icon: typeof User; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-1.5 mb-2.5">
      <Icon className="w-3 h-3" style={{ color: "var(--text-muted)" }} />
      <p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>{children}</p>
    </div>
  );
}

function ChannelBadge({ type }: { type: Channel }) {
  const ch = CHANNELS[type];
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full" style={{ backgroundColor: ch.color + "22", color: ch.color }}>
      <ch.icon className="w-2.5 h-2.5" /> {ch.label}
    </span>
  );
}

function IconBtn({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <button title={title} className="flex items-center justify-center w-8 h-8 rounded-lg transition-colors hover:bg-[var(--bg-surface-2)]" style={{ color: "var(--text-secondary)" }}>
      {children}
    </button>
  );
}
