"use client";

import { useState } from "react";
import { Search, MessageSquare, Mail, Phone, Paperclip, Send } from "lucide-react";
import { cn } from "@/lib/utils";

interface Message {
  id: number;
  from: "customer" | "us";
  text: string;
  time: string;
}

interface ActiveJob {
  title: string;
  time: string;
  tech: string;
}

interface Conversation {
  id: number;
  name: string;
  preview: string;
  time: string;
  job: string;
  type: "sms" | "email" | "call";
  unread: boolean;
  contact: { name: string; phone: string };
  activeJob: ActiveJob | null;
  messages: Message[];
}

const conversations: Conversation[] = [
  {
    id: 1,
    name: "K. Brennan",
    preview: "Sounds good, see you at 3:30",
    time: "2m",
    job: "Job #2231",
    type: "sms",
    unread: false,
    contact: { name: "K. Brennan", phone: "(303) 555-0142" },
    activeJob: { title: "Water heater install", time: "Today · 3:30 pm", tech: "J. Patel" },
    messages: [
      { id: 1, from: "customer", text: "Hey — what time again for the water heater?", time: "2:14 pm" },
      { id: 2, from: "us", text: "We've got you booked for 3:30 today. J. Patel is the tech.", time: "2:18 pm" },
      { id: 3, from: "customer", text: "Sounds good, see you at 3:30", time: "2:21 pm" },
    ],
  },
  {
    id: 2,
    name: "Hammond LLC",
    preview: "Re: Invoice 1042 — can we split?",
    time: "18m",
    job: "Job #2218",
    type: "email",
    unread: true,
    contact: { name: "Hammond LLC", phone: "(706) 442-8800" },
    activeJob: { title: "Roof inspection", time: "May 28 · 10:00 am", tech: "D. Nguyen" },
    messages: [
      { id: 1, from: "customer", text: "Hey, regarding Invoice 1042 — is it possible to split the payment into two installments?", time: "9:42 am" },
    ],
  },
  {
    id: 3,
    name: "T. Okafor",
    preview: "Confirming tomorrow's estimate",
    time: "1h",
    job: "Job lead",
    type: "sms",
    unread: false,
    contact: { name: "T. Okafor", phone: "(803) 391-4422" },
    activeJob: null,
    messages: [
      { id: 1, from: "customer", text: "Confirming tomorrow's estimate for the roof damage?", time: "1:10 pm" },
    ],
  },
  {
    id: 4,
    name: "Lakeside Apts",
    preview: "Missed call · 45s voicemail",
    time: "3h",
    job: "Job #2228",
    type: "call",
    unread: true,
    contact: { name: "Lakeside Apts", phone: "(706) 555-2200" },
    activeJob: { title: "Drain cleaning", time: "Today · 10:30 am", tech: "M. Cole" },
    messages: [
      { id: 1, from: "customer", text: "📞 Missed call · 45s voicemail", time: "11:14 am" },
    ],
  },
  {
    id: 5,
    name: "Alvarez",
    preview: "Thanks for the quick fix!",
    time: "1d",
    job: "Job #2230",
    type: "sms",
    unread: false,
    contact: { name: "Alvarez Residence", phone: "(803) 229-1183" },
    activeJob: { title: "HVAC tune-up", time: "Yesterday · 8:00 am", tech: "J. Patel" },
    messages: [
      { id: 1, from: "customer", text: "Thanks for the quick fix!", time: "Yesterday" },
    ],
  },
];

const quickReplies = [
  "On the way",
  "Running 15 min late",
  "Job complete — invoice sent",
  "Need to reschedule",
];

const filterTabs = ["All", "SMS", "Email", "Calls"];

const TypeIcon = { sms: MessageSquare, email: Mail, call: Phone };

export default function InboxPage() {
  const [selectedId, setSelectedId] = useState(1);
  const [activeFilter, setActiveFilter] = useState("All");
  const [reply, setReply] = useState("");

  const selected = conversations.find((c) => c.id === selectedId)!;

  const filtered = conversations.filter((c) => {
    if (activeFilter === "All") return true;
    if (activeFilter === "SMS") return c.type === "sms";
    if (activeFilter === "Email") return c.type === "email";
    if (activeFilter === "Calls") return c.type === "call";
    return true;
  });

  return (
    /* Full-bleed: fills entire main area */
    <div className="flex h-full overflow-hidden">
      {/* ── Left: Conversation list ───────────────────────── */}
      <div
        className="flex flex-col shrink-0"
        style={{
          width: "240px",
          backgroundColor: "var(--bg-surface-2)",
          borderRight: "1px solid var(--border-subtle)",
        }}
      >
        {/* Header */}
        <div
          className="px-4 pt-5 pb-3"
          style={{ borderBottom: "1px solid var(--border-subtle)" }}
        >
          <h1 className="text-base font-semibold mb-3" style={{ color: "var(--text-primary)" }}>
            Inbox
          </h1>
          {/* Search */}
          <div
            className="flex items-center gap-2 rounded-lg px-3 py-2"
            style={{ backgroundColor: "var(--bg-input)" }}
          >
            <Search className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--text-muted)" }} />
            <input
              type="text"
              placeholder="Search messages"
              className="bg-transparent text-xs outline-none flex-1 min-w-0"
              style={{ color: "var(--text-primary)" }}
            />
          </div>
          {/* Filter tabs */}
          <div className="flex gap-1 mt-3">
            {filterTabs.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveFilter(tab)}
                className="flex-1 text-[10px] font-semibold py-1 rounded-md transition-colors"
                style={{
                  backgroundColor:
                    activeFilter === tab ? "var(--bg-surface)" : "transparent",
                  color:
                    activeFilter === tab ? "var(--text-primary)" : "var(--text-muted)",
                  border:
                    activeFilter === tab
                      ? "1px solid var(--border)"
                      : "1px solid transparent",
                }}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        {/* Conversation list */}
        <div className="flex-1 overflow-y-auto">
          {filtered.map((c) => {
            const Icon = TypeIcon[c.type];
            const isSelected = c.id === selectedId;
            return (
              <button
                key={c.id}
                onClick={() => setSelectedId(c.id)}
                className="w-full text-left px-4 py-3 transition-colors"
                style={{
                  backgroundColor: isSelected ? "var(--bg-surface)" : "transparent",
                  borderBottom: "1px solid var(--border-subtle)",
                  borderLeft: isSelected ? "2px solid #4f46e5" : "2px solid transparent",
                }}
              >
                <div className="flex items-start gap-2.5">
                  <Icon
                    className="w-3.5 h-3.5 mt-0.5 shrink-0"
                    style={{ color: isSelected ? "#4f46e5" : "var(--text-muted)" }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1 mb-0.5">
                      <span
                        className={cn(
                          "text-xs truncate",
                          c.unread ? "font-semibold" : "font-medium"
                        )}
                        style={{ color: "var(--text-primary)" }}
                      >
                        {c.name}
                      </span>
                      <span className="text-[10px] shrink-0" style={{ color: "var(--text-muted)" }}>
                        {c.time}
                      </span>
                    </div>
                    <p
                      className="text-[11px] truncate"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      {c.preview}
                    </p>
                    <span
                      className="inline-block text-[9px] font-medium mt-1 px-1.5 py-0.5 rounded"
                      style={{
                        backgroundColor: "var(--bg-input)",
                        color: "var(--text-muted)",
                      }}
                    >
                      {c.job}
                    </span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Middle: Chat view ─────────────────────────────── */}
      <div
        className="flex-1 flex flex-col min-w-0"
        style={{ backgroundColor: "var(--bg-surface)" }}
      >
        {/* Chat header */}
        <div
          className="flex items-center justify-between px-6 py-4 shrink-0"
          style={{ borderBottom: "1px solid var(--border-subtle)" }}
        >
          <div>
            <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
              {selected.name}
            </h2>
            <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
              {selected.type.toUpperCase()} · {selected.job}
            </p>
          </div>
          <button
            className="text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
            style={{
              border: "1px solid var(--border)",
              color: "var(--text-secondary)",
              backgroundColor: "var(--bg-surface)",
            }}
          >
            Open job
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          {selected.messages.map((msg) => {
            const isUs = msg.from === "us";
            return (
              <div key={msg.id} className={cn("flex", isUs ? "justify-end" : "justify-start")}>
                <div className={cn("max-w-sm", isUs ? "items-end" : "items-start") + " flex flex-col"}>
                  <div
                    className="px-4 py-2.5 rounded-2xl text-sm leading-relaxed"
                    style={{
                      backgroundColor: isUs ? "var(--bubble-out-bg)" : "var(--bubble-in-bg)",
                      color: isUs ? "var(--bubble-out-text)" : "var(--bubble-in-text)",
                      borderRadius: isUs
                        ? "18px 18px 4px 18px"
                        : "18px 18px 18px 4px",
                    }}
                  >
                    {msg.text}
                  </div>
                  <p
                    className="text-[10px] mt-1 px-1"
                    style={{ color: "var(--text-muted)" }}
                  >
                    {msg.time}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Reply area */}
        <div
          className="shrink-0 px-6 py-4"
          style={{ borderTop: "1px solid var(--border-subtle)" }}
        >
          <textarea
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            placeholder="Reply..."
            rows={2}
            className="w-full resize-none text-sm outline-none bg-transparent"
            style={{ color: "var(--text-primary)" }}
          />
          <div className="flex items-center justify-between mt-3">
            <button style={{ color: "var(--text-muted)" }}>
              <Paperclip className="w-4 h-4" />
            </button>
            <button className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
              <Send className="w-3.5 h-3.5" />
              Send
            </button>
          </div>
        </div>
      </div>

      {/* ── Right: Context panel ──────────────────────────── */}
      <div
        className="flex flex-col shrink-0 overflow-y-auto"
        style={{
          width: "220px",
          borderLeft: "1px solid var(--border-subtle)",
          backgroundColor: "var(--bg-surface-2)",
        }}
      >
        {/* Contact */}
        <div className="px-4 pt-5 pb-4" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
          <p
            className="text-[10px] font-semibold uppercase tracking-widest mb-2"
            style={{ color: "var(--text-muted)" }}
          >
            Contact
          </p>
          <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
            {selected.contact.name}
          </p>
          <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>
            {selected.contact.phone}
          </p>
        </div>

        {/* Active Job */}
        {selected.activeJob && (
          <div
            className="px-4 py-4"
            style={{ borderBottom: "1px solid var(--border-subtle)" }}
          >
            <p
              className="text-[10px] font-semibold uppercase tracking-widest mb-2"
              style={{ color: "var(--text-muted)" }}
            >
              Active Job
            </p>
            <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
              {selected.activeJob.title}
            </p>
            <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>
              {selected.activeJob.time} · {selected.activeJob.tech}
            </p>
          </div>
        )}

        {/* Quick Replies */}
        <div className="px-4 py-4">
          <p
            className="text-[10px] font-semibold uppercase tracking-widest mb-3"
            style={{ color: "var(--text-muted)" }}
          >
            Quick Replies
          </p>
          <div className="space-y-2">
            {quickReplies.map((r) => (
              <button
                key={r}
                onClick={() => setReply(r)}
                className="w-full text-left text-xs px-3 py-2.5 rounded-lg transition-colors"
                style={{
                  border: "1px solid var(--border)",
                  color: "var(--text-secondary)",
                  backgroundColor: "var(--bg-surface)",
                }}
              >
                {r}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
