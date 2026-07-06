// ─── Inbox AI assistant ───────────────────────────────────
// Drafts customer replies (Claude via /api/ai/reply when a key is set, else a
// local context-aware engine) and decides, for auto-pilot, whether a draft is
// safe for the bot to send on its own vs. hold for human approval.

import { notifyDataChanged } from "@/lib/sync/liveData";
import { recordUsage } from "@/lib/usage/data";
import type { Conversation, TimelineItem } from "./data";

function firstName(name: string): string {
  return name.replace(/\(.*\)/, "").trim().split(/\s+/)[0] || "there";
}
function lastInbound(c: Conversation): Extract<TimelineItem, { kind: "message" }> | undefined {
  for (let i = c.timeline.length - 1; i >= 0; i--) {
    const t = c.timeline[i];
    if (t.kind === "message" && t.from === "customer") return t;
  }
  return undefined;
}
// The latest message is an unanswered customer message.
export function awaitingReply(c: Conversation): boolean {
  const msgs = c.timeline.filter(t => t.kind === "message") as Extract<TimelineItem, { kind: "message" }>[];
  const last = msgs[msgs.length - 1];
  return !!last && last.from === "customer";
}

function linkedSummary(c: Conversation): string {
  return c.linked.map(l => {
    const bits = [l.label];
    if (l.meta?.status) bits.push(l.meta.status);
    if (l.meta?.balance) bits.push(`balance ${l.meta.balance}`);
    if (l.meta?.amount) bits.push(l.meta.amount);
    if (l.meta?.tech) bits.push(`tech ${l.meta.tech}`);
    if (l.meta?.time) bits.push(l.meta.time);
    return `${l.type}: ${bits.join(" · ")}`;
  }).join("; ");
}

function buildRequest(c: Conversation) {
  return {
    customer: c.contact.name || c.name,
    channel: c.channel,
    linked: linkedSummary(c),
    history: (c.timeline.filter(t => t.kind === "message") as Extract<TimelineItem, { kind: "message" }>[])
      .slice(-12).map(m => ({ from: m.from, text: m.text })),
  };
}

// ── Local fallback draft — context-aware, personalized ────
export function localDraft(c: Conversation): string {
  const who = firstName(c.contact.name || c.name);
  const q = (lastInbound(c)?.text || "").toLowerCase();
  const job = c.linked.find(l => l.type === "job");
  const est = c.linked.find(l => l.type === "estimate");
  const inv = c.linked.find(l => l.type === "invoice");
  const agr = c.linked.find(l => l.type === "agreement" || l.type === "maintenance");

  if (/\b(thank|thanks|appreciate|great job|awesome)\b/.test(q))
    return `You're very welcome, ${who}! It was our pleasure — don't hesitate to reach out if you need anything else.`;
  if (job?.meta?.status === "En route" || /\b(on (my|the) way|still on|when|eta|arrive|coming|here yet)\b/.test(q))
    return `Hi ${who}! Yes — ${job?.meta?.tech ? `${job.meta.tech} is` : "your technician is"} on the way${job?.meta?.time ? ` and should arrive around ${job.meta.time}` : " and should arrive shortly"}. See you soon!`;
  if (inv && (inv.meta?.status === "Past due" || /\b(invoice|bill|pay|balance|owe)\b/.test(q)))
    return `Hi ${who}, thanks for reaching out! Your invoice${inv.meta?.balance ? ` balance is ${inv.meta.balance}` : ""}${inv.meta?.due ? ` and is due ${inv.meta.due}` : ""}. You can pay securely online any time, or let us know if you have any questions.`;
  if (est && /\b(estimate|quote|proposal|price|how much)\b/.test(q))
    return `Hi ${who}! Happy to help with the estimate${est.meta?.amount ? ` (${est.meta.amount})` : ""}. Do you have any questions, or would you like to move forward? We're glad to walk you through it.`;
  if (/\b(reschedul|cancel|move|change (the )?(time|date|appointment)|another day)\b/.test(q))
    return `No problem at all, ${who} — we're happy to reschedule. What day and time work best for you and we'll get it on the calendar.`;
  if (agr && /\b(maintenance|tune.?up|membership|plan|service visit)\b/.test(q))
    return `Hi ${who}! You're due for your next maintenance visit. What day works best and we'll get you scheduled with one of our techs.`;
  if (/\b(complete|done|finished|fixed)\b/.test(q))
    return `Thanks so much, ${who}! We're glad everything's taken care of. If you have a moment, we'd really appreciate a quick review — and we're here if anything comes up.`;
  return `Hi ${who}, thanks for reaching out! We'd be glad to help — could you share a little more so we can point you in the right direction? A team member will make sure you're taken care of.`;
}

// ── Draft: Claude when available, else local ──────────────
export async function draftReply(c: Conversation): Promise<{ text: string; source: "claude" | "local" }> {
  // Every draft is a metered AI action against the plan (Settings → Plan & Usage).
  recordUsage("ai");
  try {
    const res = await fetch("/api/ai/reply", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(buildRequest(c)),
    });
    if (res.ok) {
      const d = await res.json();
      if (d?.reply) return { text: String(d.reply).trim(), source: "claude" };
    }
  } catch { /* fall through to local */ }
  return { text: localDraft(c), source: "local" };
}

// ── Auto-pilot: is it safe for the bot to send unattended? ─
const SENSITIVE = /\b(refund|cancel|reschedul|complain|manager|supervisor|lawyer|legal|angry|upset|unhappy|terrible|awful|worst|broken again|still (not|isn'?t) work|leak|no heat|no (a\/?c|cooling)|emergency|urgent|dispute|overcharg|wrong (charge|price)|charge)\b/i;

export function canAutoSend(c: Conversation): { ok: boolean; reason: string } {
  const q = lastInbound(c)?.text || "";
  if (SENSITIVE.test(q)) return { ok: false, reason: "Sensitive topic — held for your review" };
  const inv = c.linked.find(l => l.type === "invoice");
  if (inv?.meta?.status === "Past due" || /\b(invoice|bill|pay|balance|refund)\b/i.test(q))
    return { ok: false, reason: "Billing topic — held for your review" };
  const job = c.linked.find(l => l.type === "job");
  if (job?.meta?.status === "En route" || /\b(on (my|the) way|eta|arrive|coming|when|thank|thanks)\b/i.test(q))
    return { ok: true, reason: "Routine status/acknowledgement" };
  return { ok: false, reason: "Needs a human eye" };
}

// ── Per-conversation auto-pilot flag (localStorage) ───────
const AP_KEY = "crm-inbox-autopilot";
function apRead(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try { return new Set(JSON.parse(localStorage.getItem(AP_KEY) || "[]")); } catch { return new Set(); }
}
export function isAutopilot(id: string): boolean { return apRead().has(id); }
export function setAutopilot(id: string, on: boolean): void {
  const s = apRead();
  if (on) s.add(id); else s.delete(id);
  if (typeof window !== "undefined") localStorage.setItem(AP_KEY, JSON.stringify([...s]));
  notifyDataChanged();
}
