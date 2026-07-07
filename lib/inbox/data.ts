// ─── Communications / Inbox data layer ────────────────────
// The CRM's customer-communication command center. A Conversation is the thread
// with one customer across channels (SMS / email / call / voicemail / automated)
// PLUS the CRM events that happened around it (estimate sent, invoice paid, tech
// en route, job completed…) and internal notes — all on one timeline. It carries
// the operational metadata the office needs: status, owner, linked job/estimate/
// invoice, tags, and unread/needs-response state.
//
// localStorage-backed (consistent with the app's non-jobs stores); seeded with
// realistic service-business threads. Swap the store for the backend later.

import type { LucideIcon } from "lucide-react";
import {
  MessageSquare, Mail, Phone, Voicemail, Bot, StickyNote,
} from "lucide-react";
import { notifyDataChanged, invalidateOnStorage } from "@/lib/sync/liveData";
import { getStaffedUsers } from "@/lib/users/data";

// ── Channels ──
export type InboxChannel = "sms" | "email" | "call" | "voicemail" | "automated" | "internal";
export const CHANNEL_META: Record<InboxChannel, { label: string; icon: LucideIcon; color: string }> = {
  sms:       { label: "SMS",       icon: MessageSquare, color: "#0f8578" },
  email:     { label: "Email",     icon: Mail,          color: "#0891b2" },
  call:      { label: "Call",      icon: Phone,         color: "#059669" },
  voicemail: { label: "Voicemail", icon: Voicemail,     color: "#a855f7" },
  automated: { label: "Automated", icon: Bot,           color: "#6b7280" },
  internal:  { label: "Internal",  icon: StickyNote,    color: "#f59e0b" },
};

// ── Statuses ──
export type ConvStatus =
  | "open" | "needs_response" | "waiting" | "follow_up" | "resolved" | "urgent" | "internal_review" | "archived";
export const STATUS_META: Record<ConvStatus, { label: string; color: string }> = {
  open:            { label: "Open",             color: "#6b7280" },
  needs_response:  { label: "Needs response",   color: "#dc2626" },
  waiting:         { label: "Waiting on customer", color: "#a855f7" },
  follow_up:       { label: "Follow-up due",    color: "#f59e0b" },
  resolved:        { label: "Resolved",         color: "#16a34a" },
  urgent:          { label: "Urgent",           color: "#dc2626" },
  internal_review: { label: "Internal review",  color: "#0891b2" },
  archived:        { label: "Archived",         color: "#9ca3af" },
};

// ── Linked CRM records ──
export type LinkedType = "job" | "estimate" | "invoice" | "maintenance" | "agreement";
export const LINKED_META: Record<LinkedType, { label: string; color: string }> = {
  job:         { label: "Job",         color: "#0f8578" },
  estimate:    { label: "Estimate",    color: "#8b5cf6" },
  invoice:     { label: "Invoice",     color: "#0891b2" },
  maintenance: { label: "Maintenance", color: "#16a34a" },
  agreement:   { label: "Agreement",   color: "#16a34a" },
};
export interface LinkedRecord {
  type: LinkedType;
  label: string;                       // e.g. "AC Tune-Up", "EST-1188"
  href?: string;                       // deep link into the CRM
  meta?: Record<string, string>;       // status/amount/tech/time/balance/due…
}

// ── Timeline ──
export type EventKind =
  | "job_created" | "appointment_scheduled" | "tech_assigned" | "tech_en_route" | "tech_arrived" | "job_completed"
  | "estimate_sent" | "estimate_viewed" | "estimate_approved" | "invoice_sent" | "payment_received" | "review_requested";

export type TimelineItem =
  | { kind: "message"; id: string; from: "customer" | "us"; channel: InboxChannel; text: string; time: string }
  | { kind: "note";    id: string; author: string; text: string; time: string }
  | { kind: "call";    id: string; direction: "inbound" | "outbound" | "missed"; voicemail?: string; durationSec?: number; time: string }
  | { kind: "event";   id: string; event: EventKind; label: string; time: string };

export interface Conversation {
  id: string;
  name: string;
  company?: boolean;
  accountId?: string;                  // real customer id when linked
  contact: { name: string; phone: string; email?: string; pref?: "sms" | "email" | "call" };
  channel: InboxChannel;               // primary / most-recent channel
  status: ConvStatus;
  ownerId?: string;
  ownerName?: string;
  tags: string[];
  linked: LinkedRecord[];
  unread: boolean;
  needsResponse: boolean;
  followUpDue?: string;
  lastActivity: string;                // human label ("9:02 AM", "Yesterday")
  customerStatus?: string;             // "Customer" | "Prospect" | "VIP"
  propertyLabel?: string;
  timeline: TimelineItem[];
}

// Derive the queue preview line from the most meaningful timeline item.
export function previewOf(c: Conversation): string {
  for (let i = c.timeline.length - 1; i >= 0; i--) {
    const t = c.timeline[i];
    if (t.kind === "message") return t.text;
    if (t.kind === "call") return t.direction === "missed" ? `Missed call${t.voicemail ? " · voicemail" : ""}` : "Call";
    if (t.kind === "event") return t.label;
  }
  return "";
}

// ── Seed ──────────────────────────────────────────────────
const SEED: Conversation[] = [
  {
    id: "cv-1", name: "Ryo Martin", contact: { name: "Ryo Martin", phone: "(706) 555-0142", email: "ryo.martin@example.com", pref: "sms" },
    channel: "sms", status: "needs_response", ownerName: "Marcus Reyes", tags: ["Repeat"], unread: true, needsResponse: true,
    lastActivity: "9:02 AM", customerStatus: "Customer", propertyLabel: "412 Oak St · Augusta, GA",
    linked: [{ type: "job", label: "AC Tune-Up", href: "/jobs", meta: { status: "En route", time: "Today · 9:00 AM", tech: "Marcus Reyes" } }],
    timeline: [
      { kind: "event", id: "e1", event: "appointment_scheduled", label: "Appointment scheduled · Today 9:00 AM", time: "Mon" },
      { kind: "event", id: "e2", event: "tech_en_route", label: "Marcus is en route", time: "8:45 AM" },
      { kind: "message", id: "m1", from: "customer", channel: "sms", text: "Hi, are we still on for this morning?", time: "8:48 AM" },
      { kind: "message", id: "m2", from: "us", channel: "sms", text: "Yes! Marcus is on the way 🚐", time: "8:50 AM" },
      { kind: "message", id: "m3", from: "customer", channel: "sms", text: "Sounds good, see you at 9!", time: "9:02 AM" },
    ],
  },
  {
    id: "cv-2", name: "Brecht Holdings", company: true, contact: { name: "Facilities Team", phone: "(706) 555-0188", email: "facilities@brechtholdings.com", pref: "email" },
    channel: "email", status: "follow_up", ownerName: "Sarah Chen", tags: ["Commercial"], unread: true, needsResponse: true, followUpDue: "Due today",
    lastActivity: "8:30 AM", customerStatus: "VIP", propertyLabel: "Rooftop · Brecht Tower",
    linked: [{ type: "estimate", label: "EST-1188 · Rooftop Unit", href: "/quotes", meta: { status: "Viewed", amount: "$48,420", sent: "Jun 18" } }],
    timeline: [
      { kind: "event", id: "e1", event: "estimate_sent", label: "Estimate EST-1188 sent · $48,420", time: "Jun 18" },
      { kind: "event", id: "e2", event: "estimate_viewed", label: "Customer viewed the estimate", time: "Jun 19" },
      { kind: "message", id: "m1", from: "customer", channel: "email", text: "Following up on the rooftop replacement — can you send the updated proposal?", time: "8:30 AM" },
      { kind: "note", id: "n1", author: "Sarah Chen", text: "Decision-maker is the CFO; loop in pricing before resending.", time: "8:35 AM" },
    ],
  },
  {
    id: "cv-3", name: "Southern Rentals", company: true, contact: { name: "Dana Pierce", phone: "(803) 555-0177" },
    channel: "voicemail", status: "urgent", ownerName: "Luis Romero", tags: ["No-cool"], unread: true, needsResponse: true,
    lastActivity: "Yesterday", customerStatus: "Customer", propertyLabel: "Unit 4B · Aiken, SC",
    linked: [{ type: "job", label: "Furnace Repair — Unit 4B", href: "/jobs", meta: { status: "Scheduled", time: "Jun 12 · 1:00 PM", tech: "Luis Romero" } }],
    timeline: [
      { kind: "call", id: "c1", direction: "missed", voicemail: "Hi, the heat is out again in 4B — tenants are calling. Please call back ASAP.", durationSec: 42, time: "4:15 PM" },
    ],
  },
  {
    id: "cv-4", name: "Vance Property Group", company: true, contact: { name: "Ops Desk", phone: "(706) 555-0166", email: "ops@vancepg.com", pref: "email" },
    channel: "email", status: "waiting", ownerName: "Sarah Chen", tags: [], unread: false, needsResponse: false,
    lastActivity: "Yesterday", customerStatus: "Customer", propertyLabel: "1 Main St · Evans, GA",
    linked: [{ type: "invoice", label: "INV-2041 · Compressor Repair", href: "/invoices", meta: { status: "Past due", balance: "$640.00", due: "Jun 20" } }],
    timeline: [
      { kind: "event", id: "e1", event: "job_completed", label: "Job completed · Compressor Repair", time: "Jun 14" },
      { kind: "event", id: "e2", event: "invoice_sent", label: "Invoice INV-2041 sent · $640.00", time: "Jun 14" },
      { kind: "message", id: "m1", from: "us", channel: "email", text: "Just a friendly reminder that invoice INV-2041 ($640.00) is now past due. You can pay online any time.", time: "Yesterday" },
    ],
  },
  {
    id: "cv-5", name: "Augusta Community Center", company: true, contact: { name: "Front Office", phone: "(706) 555-0133", email: "info@augustacc.org", pref: "email" },
    channel: "email", status: "open", ownerName: "Sarah Chen", tags: ["New lead"], unread: false, needsResponse: true,
    lastActivity: "Mon", customerStatus: "Prospect", propertyLabel: "Augusta, GA",
    linked: [{ type: "estimate", label: "New system — walkthrough", meta: { status: "Requested" } }],
    timeline: [
      { kind: "message", id: "m1", from: "customer", channel: "email", text: "We'd like to schedule a walkthrough for a new system estimate.", time: "Mon · 11:20 AM" },
    ],
  },
  {
    id: "cv-6", name: "Giesbrecht Property Group", company: true, contact: { name: "Ops Desk", phone: "(706) 555-0211", email: "ops@giesbrechtpg.com", pref: "sms" },
    channel: "sms", status: "resolved", ownerName: "Marcus Reyes", tags: ["Maintenance"], unread: false, needsResponse: false,
    lastActivity: "Yesterday", customerStatus: "Customer", propertyLabel: "Multi-site",
    linked: [{ type: "agreement", label: "Gold Maintenance Plan", meta: { status: "Active", nextVisit: "Sep 2026" } }],
    timeline: [
      { kind: "event", id: "e1", event: "job_completed", label: "Quarterly inspection completed", time: "Jun 13" },
      { kind: "message", id: "m1", from: "us", channel: "sms", text: "Inspection complete — report attached. Anything else we can help with?", time: "2:10 PM" },
      { kind: "message", id: "m2", from: "customer", channel: "sms", text: "Thanks for the quick service!", time: "2:40 PM" },
      { kind: "event", id: "e2", event: "review_requested", label: "Review request sent", time: "2:45 PM" },
    ],
  },
];

// ── Store ─────────────────────────────────────────────────
const KEY = "crm-inbox-conversations";
let _convos: Conversation[] | null = null;
function store(): Conversation[] {
  if (_convos) return _convos;
  if (typeof window === "undefined") return SEED;
  try { const r = localStorage.getItem(KEY); _convos = r ? JSON.parse(r) : SEED; }
  catch { _convos = SEED; }
  return _convos!;
}
function persist() { try { localStorage.setItem(KEY, JSON.stringify(_convos ?? [])); } catch { /* ignore */ } }
invalidateOnStorage([KEY], () => { _convos = null; });

function mutate(id: string, fn: (c: Conversation) => Conversation): Conversation | undefined {
  let out: Conversation | undefined;
  _convos = store().map(c => (c.id === id ? (out = fn(c)) : c));
  if (out) { persist(); notifyDataChanged(); }
  return out;
}

export function getConversations(): Conversation[] { return store().slice(); }
export function getConversation(id: string): Conversation | undefined { return store().find(c => c.id === id); }

function nowLabel(): string { return new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }); }

export function markRead(id: string): void { mutate(id, c => ({ ...c, unread: false })); }

export function sendMessage(id: string, channel: InboxChannel, text: string): void {
  mutate(id, c => ({
    ...c, channel, unread: false, needsResponse: false, lastActivity: "now",
    status: c.status === "needs_response" || c.status === "urgent" ? "open" : c.status,
    timeline: [...c.timeline, { kind: "message", id: `m-${Date.now()}`, from: "us", channel, text, time: nowLabel() }],
  }));
}
export function addNote(id: string, author: string, text: string): void {
  mutate(id, c => ({ ...c, timeline: [...c.timeline, { kind: "note", id: `n-${Date.now()}`, author, text, time: nowLabel() }] }));
}
export function setStatus(id: string, status: ConvStatus): void {
  mutate(id, c => ({ ...c, status, needsResponse: status === "needs_response" || status === "urgent" ? true : status === "resolved" ? false : c.needsResponse }));
}
export function assignOwner(id: string, ownerName: string): void { mutate(id, c => ({ ...c, ownerName })); }

// Office users available to own a conversation (real staffed users, with a fallback).
export function getOwners(): string[] {
  try {
    const names = getStaffedUsers().map(u => u.fullName).filter(Boolean);
    if (names.length) return names;
  } catch { /* ignore */ }
  return ["Marcus Reyes", "Sarah Chen", "Luis Romero", "Dana W."];
}

// ── Templates + context-aware suggestions ─────────────────
export const QUICK_TEMPLATES: { label: string; text: string }[] = [
  { label: "On the way",        text: "Your technician is on the way and should arrive shortly." },
  { label: "Running late",      text: "We're running about 15 minutes behind — thanks for your patience." },
  { label: "Job complete",      text: "All done! Thanks for choosing us. Your invoice is on the way." },
  { label: "Estimate follow-up",text: "Just following up on the estimate we sent — happy to answer any questions." },
  { label: "Invoice reminder",  text: "A friendly reminder that your invoice is due. You can pay online any time." },
  { label: "Reschedule",        text: "No problem — what day works best to reschedule your visit?" },
  { label: "Maintenance reminder", text: "It's time for your seasonal maintenance visit. When works for you?" },
  { label: "Thank you / review",text: "Thanks again for your business! If you have a moment, we'd love a quick review." },
];

// Suggest the most relevant reply based on the conversation's linked records/events.
export function suggestedReplies(c: Conversation): { label: string; text: string }[] {
  const out: { label: string; text: string }[] = [];
  const has = (t: LinkedType) => c.linked.find(l => l.type === t);
  const job = has("job");
  if (job?.meta?.status === "En route") out.push(QUICK_TEMPLATES[0]);
  if (job?.meta?.status === "Completed" || c.timeline.some(t => t.kind === "event" && t.event === "job_completed")) out.push(QUICK_TEMPLATES[2], QUICK_TEMPLATES[7]);
  const est = has("estimate");
  if (est && est.meta?.status !== "Approved") out.push(QUICK_TEMPLATES[3]);
  const inv = has("invoice");
  if (inv && (inv.meta?.status === "Past due" || inv.meta?.balance)) out.push(QUICK_TEMPLATES[4]);
  if (has("agreement") || has("maintenance")) out.push(QUICK_TEMPLATES[6]);
  // de-dupe, keep up to 3
  const seen = new Set<string>();
  return out.filter(x => !seen.has(x.label) && seen.add(x.label)).slice(0, 3);
}

// Queue views.
export type QueueView =
  | "all" | "needs_response" | "unread" | "waiting" | "follow_up" | "missed"
  | "sms" | "email" | "call" | "jobs" | "estimates" | "invoices" | "maintenance" | "archived";

export function matchesView(c: Conversation, v: QueueView): boolean {
  switch (v) {
    case "all":            return c.status !== "archived";
    case "needs_response": return c.needsResponse && c.status !== "archived";
    case "unread":         return c.unread && c.status !== "archived";
    case "waiting":        return c.status === "waiting";
    case "follow_up":      return c.status === "follow_up" || !!c.followUpDue;
    case "missed":         return c.timeline.some(t => t.kind === "call" && t.direction === "missed");
    case "sms":            return c.channel === "sms";
    case "email":          return c.channel === "email";
    case "call":           return c.channel === "call" || c.channel === "voicemail";
    case "jobs":           return c.linked.some(l => l.type === "job");
    case "estimates":      return c.linked.some(l => l.type === "estimate");
    case "invoices":       return c.linked.some(l => l.type === "invoice");
    case "maintenance":    return c.linked.some(l => l.type === "maintenance" || l.type === "agreement");
    case "archived":       return c.status === "archived";
  }
}
