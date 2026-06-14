"use client";

// Communication: agreement-related messages. Local/mock entries for now (no
// comms module yet) — emails, texts, calls, voicemails, renewal reminders.

import { useState } from "react";
import { Mail, MessageSquare, Phone, Voicemail, Bell, Plus, ArrowDownLeft, ArrowUpRight } from "lucide-react";
import UiSelect from "@/components/ui/Select";
import { type CustomerAgreement } from "@/lib/agreements/data";
import { Card, SectionLabel } from "./shared";

type CommType = "email" | "text" | "call" | "voicemail" | "reminder";
interface Comm { id: string; type: CommType; direction: "in" | "out"; summary: string; by: string; at: string; }

const TYPE_META: Record<CommType, { icon: typeof Mail; color: string; label: string }> = {
  email:     { icon: Mail,          color: "#6366f1", label: "Email" },
  text:      { icon: MessageSquare, color: "#10b981", label: "Text" },
  call:      { icon: Phone,         color: "#0891b2", label: "Call" },
  voicemail: { icon: Voicemail,     color: "#f59e0b", label: "Voicemail" },
  reminder:  { icon: Bell,          color: "#ef4444", label: "Renewal reminder" },
};

function now(): string {
  return new Date().toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}

export default function CommunicationTab({ agreement }: { agreement: CustomerAgreement }) {
  const [items, setItems] = useState<Comm[]>(() => [
    { id: "c1", type: "email", direction: "out", summary: `Agreement sent to ${agreement.customer}`, by: agreement.assignedTo, at: agreement.startDate },
    { id: "c2", type: "text", direction: "out", summary: "Visit reminder sent", by: "Automation", at: agreement.startDate },
    { id: "c3", type: "call", direction: "in", summary: "Customer confirmed schedule", by: agreement.assignedTo, at: agreement.startDate },
  ]);
  const [type, setType] = useState<CommType>("email");
  const [draft, setDraft] = useState("");

  function add() {
    const t = draft.trim(); if (!t) return;
    setItems(p => [{ id: `c-${Date.now()}`, type, direction: "out", summary: t, by: "You", at: now() }, ...p]);
    setDraft("");
  }

  return (
    <div className="space-y-4 max-w-2xl">
      <Card className="p-4">
        <SectionLabel>Log Communication</SectionLabel>
        <div className="flex items-center gap-2 mt-2">
          <div className="w-36 shrink-0">
            <UiSelect size="sm" value={type} onChange={v => setType(v as CommType)}
              options={(Object.keys(TYPE_META) as CommType[]).map(k => ({ value: k, label: TYPE_META[k].label }))} />
          </div>
          <input value={draft} onChange={e => setDraft(e.target.value)} placeholder="What was communicated?"
            onKeyDown={e => { if (e.key === "Enter") add(); }}
            className="flex-1 rounded-lg px-3 py-2 text-sm outline-none" style={{ border: "1px solid var(--border)", backgroundColor: "var(--bg-surface)", color: "var(--text-primary)" }} />
          <button onClick={add} disabled={!draft.trim()}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-40 cursor-pointer transition hover:brightness-110 disabled:cursor-not-allowed" style={{ backgroundColor: "#4f46e5" }}>
            <Plus className="w-3.5 h-3.5" /> Log
          </button>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="px-4 py-3" style={{ borderBottom: "1px solid var(--border-subtle)", backgroundColor: "var(--bg-surface-2)" }}>
          <SectionLabel>History ({items.length})</SectionLabel>
        </div>
        {items.map((c, i) => {
          const m = TYPE_META[c.type];
          const Icon = m.icon;
          const Dir = c.direction === "in" ? ArrowDownLeft : ArrowUpRight;
          return (
            <div key={c.id} className="flex items-start gap-3 px-4 py-3" style={{ borderBottom: i < items.length - 1 ? "1px solid var(--border-subtle)" : "none" }}>
              <span className="w-7 h-7 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: m.color + "20" }}>
                <Icon className="w-3.5 h-3.5" style={{ color: m.color }} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{c.summary}</p>
                <p className="text-[11px] mt-0.5 flex items-center gap-1" style={{ color: "var(--text-muted)" }}>
                  <Dir className="w-3 h-3" /> {m.label} · {c.by} · {c.at}
                </p>
              </div>
            </div>
          );
        })}
      </Card>
    </div>
  );
}
