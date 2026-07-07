"use client";

// ─── History feed ─────────────────────────────────────────
// The record activity feed used by Customer AND Job detail pages: day-grouped
// rows with a time gutter, category icon nodes, quieter system entries, and a
// single right-aligned toolbar (search + one animated Filter). Categories are
// MULTI-select checkbox rows (work-order-canvas pattern); rows with a
// destination are fully clickable — the nudging arrow on the right is the only
// "takes you there" cue (no inline "View X" label).

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Search, Star, ArrowDownUp, ArrowUpRight, X, Check,
  UserPlus, User, Home, TrendingUp, Calendar, CheckCircle, Briefcase, ClipboardList,
  FilePen, FileCheck, Receipt, DollarSign, FileText, RefreshCw,
  Image as ImageIcon, Paperclip, MessageSquare, Mail, Smartphone, Phone, CheckSquare,
} from "lucide-react";
import SlidersGlyph from "@/components/shared/SlidersGlyph";
import type { EventType, ActivityEvent } from "@/lib/activity/types";

type EventConfig = {
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  label: string;
};

export const EVENT_CONFIG: Record<EventType, EventConfig> = {
  account_created:    { icon: UserPlus,      label: "Account Created" },
  contact_added:      { icon: User,          label: "Contact Added" },
  property_added:     { icon: Home,          label: "Property Added" },
  lead_created:       { icon: TrendingUp,    label: "Lead Created" },
  lead_stage_changed: { icon: TrendingUp,    label: "Lead Stage Changed" },
  job_created:        { icon: Briefcase,     label: "Job Created" },
  job_scheduled:      { icon: Calendar,      label: "Job Scheduled" },
  job_completed:      { icon: CheckCircle,   label: "Job Completed" },
  work_order_created: { icon: ClipboardList, label: "Work Order Created" },
  quote_created:      { icon: FilePen,       label: "Quote Created" },
  quote_sent:         { icon: FilePen,       label: "Quote Sent" },
  quote_accepted:     { icon: FileCheck,     label: "Quote Accepted" },
  invoice_created:    { icon: Receipt,       label: "Invoice Created" },
  payment_received:   { icon: DollarSign,    label: "Payment Received" },
  agreement_created:  { icon: FileText,      label: "Agreement Created" },
  agreement_renewed:  { icon: RefreshCw,     label: "Agreement Renewed" },
  photo_uploaded:     { icon: ImageIcon,     label: "Photo Uploaded" },
  file_uploaded:      { icon: Paperclip,     label: "File Uploaded" },
  note_added:         { icon: MessageSquare, label: "Note Added" },
  status_changed:     { icon: RefreshCw,     label: "Status Changed" },
  email_sent:         { icon: Mail,          label: "Email Sent" },
  sms_sent:           { icon: Smartphone,    label: "SMS Sent" },
  call_logged:        { icon: Phone,         label: "Call Logged" },
  task_created:       { icon: CheckSquare,   label: "Task Created" },
  task_completed:     { icon: CheckSquare,   label: "Task Completed" },
};

// Filter categories + their accent colors (dark-mode friendly tints).
export type HistoryCategory = "jobs" | "communication" | "notes" | "billing" | "files" | "agreements" | "system";
const HISTORY_CATS: { key: HistoryCategory; label: string }[] = [
  { key: "jobs", label: "Jobs" }, { key: "communication", label: "Communication" },
  { key: "notes", label: "Notes" }, { key: "billing", label: "Billing" }, { key: "files", label: "Files" },
  { key: "agreements", label: "Agreements" }, { key: "system", label: "System" },
];
export const CATEGORY_COLOR: Record<HistoryCategory, string> = {
  jobs: "#239c8d", communication: "#0ea5e9", notes: "#f59e0b", billing: "#8b5cf6", files: "#14b8a6", agreements: "#10b981", system: "#6b7280",
};
const ALL_COLOR = "#239c8d";

export function categoryOf(t: EventType): HistoryCategory {
  switch (t) {
    case "job_created": case "job_scheduled": case "job_completed": case "work_order_created": case "status_changed": return "jobs";
    case "email_sent": case "sms_sent": case "call_logged": return "communication";
    case "note_added": return "notes";
    case "invoice_created": case "payment_received": case "quote_created": case "quote_sent": case "quote_accepted": return "billing";
    case "photo_uploaded": case "file_uploaded": return "files";
    case "agreement_created": case "agreement_renewed": return "agreements";
    default: return "system";
  }
}
// High-signal milestones surfaced by the "Important only" toggle.
const IMPORTANT_EVENTS = new Set<EventType>(["job_scheduled", "job_completed", "payment_received", "invoice_created", "quote_accepted", "agreement_created", "agreement_renewed", "work_order_created"]);
// Auto/system entries that render quieter than human activity.
export const SYSTEM_EVENTS = new Set<EventType>(["account_created", "contact_added", "property_added", "lead_created", "lead_stage_changed"]);

// The contextual destination per event — a HOST-side tab name (customer-tab
// vocabulary; hosts remap via `mapTab`, returning null to make a row inert).
function actionTabFor(t: EventType): string | null {
  switch (t) {
    case "work_order_created": return "WorkOrders";
    case "job_created": case "job_scheduled": case "job_completed": case "status_changed": return "Jobs";
    case "email_sent": case "sms_sent": case "call_logged": return "Communication";
    case "note_added": return "Notes";
    case "invoice_created": case "payment_received": return "Billing";
    case "quote_created": case "quote_sent": case "quote_accepted": return "Billing";
    case "photo_uploaded": case "file_uploaded": return "Photos & Files";
    case "agreement_created": case "agreement_renewed": return "Agreements";
    case "lead_created": case "lead_stage_changed": return "Leads";
    case "contact_added": return "Contacts";
    case "property_added": return "Properties";
    case "task_created": case "task_completed": return "Tasks";
    default: return null;
  }
}

function eventInitials(name: string): string {
  const p = (name || "").trim().split(/\s+/);
  if (!p[0] || name === "—") return "•";
  return (p.length >= 2 ? p[0][0] + p[p.length - 1][0] : name.slice(0, 2)).toUpperCase();
}
function eventTime(iso: string): string | null {
  if (!/T\d{2}:\d{2}/.test(iso)) return null;
  const d = new Date(iso);
  return isNaN(d.getTime()) ? null : d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}
// Relative date headers: Today, Yesterday, then "Mon, Jun 23" (+ year if not current).
function dayHeading(iso: string): string {
  const d = new Date(/T/.test(iso) ? iso : iso + "T00:00:00");
  if (isNaN(d.getTime())) return iso;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const that = new Date(d); that.setHours(0, 0, 0, 0);
  const diff = Math.round((today.getTime() - that.getTime()) / 86_400_000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", ...(sameYear ? {} : { year: "numeric" }) });
}

export default function HistoryFeed({ events, onTab, mapTab = t => t }: {
  /** Newest-first activity list. */
  events: ActivityEvent[];
  /** Navigate the host page to one of ITS tabs. */
  onTab: (tab: string) => void;
  /** Remap the customer-vocabulary destination to a host tab (null = row not clickable). */
  mapTab?: (tab: string) => string | null;
}) {
  const [q, setQ] = useState("");
  // Multi-select categories — empty set = All.
  const [cats, setCats] = useState<Set<HistoryCategory>>(new Set());
  const [newestFirst, setNewestFirst] = useState(true);
  const [importantOnly, setImportantOnly] = useState(false);

  const s = q.trim().toLowerCase();
  const filtered = useMemo(() => {
    const list = events.filter(e => {
      if (cats.size > 0 && !cats.has(categoryOf(e.eventType))) return false;
      if (importantOnly && !IMPORTANT_EVENTS.has(e.eventType)) return false;
      if (s && !`${e.title} ${e.description ?? ""} ${e.createdBy} ${EVENT_CONFIG[e.eventType].label}`.toLowerCase().includes(s)) return false;
      return true;
    });
    return newestFirst ? list : [...list].reverse();
  }, [events, cats, importantOnly, s, newestFirst]);

  const countFor = (key: HistoryCategory | "all") => key === "all" ? events.length : events.filter(e => categoryOf(e.eventType) === key).length;

  // Group consecutive rows by calendar day for the date headers.
  const groups: { day: string; items: typeof filtered }[] = [];
  for (const e of filtered) {
    const day = (e.createdAt || "").slice(0, 10);
    const last = groups[groups.length - 1];
    if (last && last.day === day) last.items.push(e);
    else groups.push({ day, items: [e] });
  }

  // One compact right-aligned toolbar: search + a single animated filter button.
  const [filterOpen, setFilterOpen] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!filterOpen) return;
    const onDown = (e: MouseEvent) => { if (filterRef.current && !filterRef.current.contains(e.target as Node)) setFilterOpen(false); };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [filterOpen]);
  const activeFilterCount = (cats.size > 0 ? 1 : 0) + (importantOnly ? 1 : 0) + (!newestFirst ? 1 : 0);
  function clearFilters() { setCats(new Set()); setImportantOnly(false); setNewestFirst(true); }
  function toggleCat(key: HistoryCategory) {
    setCats(prev => { const n = new Set(prev); if (n.has(key)) n.delete(key); else n.add(key); return n; });
  }

  return (
    <div className="space-y-4">
      {/* Toolbar — everything on the right so the feed starts high */}
      <div className="flex items-center justify-end gap-2">
        <div className="flex items-center gap-2 rounded-lg px-3 py-1.5" style={{ backgroundColor: "var(--bg-input)" }}>
          <Search className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--text-muted)" }} />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search history..." className="bg-transparent text-sm outline-none w-44" style={{ color: "var(--text-primary)" }} />
        </div>
        <div className="relative" ref={filterRef}>
          {/* Colors like the dispatch Filter button — tinted while open or filtering */}
          <button onClick={() => setFilterOpen(o => !o)}
            className="group flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors"
            style={{
              border: `1px solid ${filterOpen || activeFilterCount > 0 ? "var(--accent-soft-border)" : "var(--border)"}`,
              color: filterOpen || activeFilterCount > 0 ? "var(--accent-text)" : "var(--text-secondary)",
              backgroundColor: filterOpen || activeFilterCount > 0 ? "var(--accent-soft-bg)" : "var(--bg-surface)",
            }}>
            <SlidersGlyph active={filterOpen} /> Filter
            {activeFilterCount > 0 && (
              <span className="ml-0.5 text-[10px] font-bold px-1.5 rounded-full text-white" style={{ backgroundColor: "var(--accent-text)" }}>{activeFilterCount}</span>
            )}
          </button>

          {filterOpen && (
            <div className="absolute right-0 top-full mt-1.5 w-80 rounded-xl z-30 p-3.5 space-y-3.5"
              style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "0 12px 32px rgba(0,0,0,0.18)" }}>
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>Filters</span>
                {activeFilterCount > 0 && (
                  <button onClick={clearFilters} className="flex items-center gap-1 text-[11px] font-medium hover:underline" style={{ color: "var(--accent-text)" }}>
                    <X className="w-3 h-3" /> Clear all
                  </button>
                )}
              </div>

              {/* Categories — MULTI-select checkbox rows (same select pattern as
                  linking photos to checklist steps in the work order canvas). */}
              <div>
                <p className="text-[11px] font-semibold mb-1" style={{ color: "var(--text-secondary)" }}>Categories</p>
                <div className="-mx-1.5">
                  {/* All = no category filter */}
                  <button onClick={() => setCats(new Set())}
                    className="w-full flex items-center gap-2.5 px-1.5 py-1.5 rounded-lg text-left transition-colors hover:bg-[var(--bg-surface-2)]">
                    <span className="w-5 h-5 rounded flex items-center justify-center shrink-0"
                      style={{ border: `1.5px solid ${cats.size === 0 ? "var(--copper-soft-border)" : "var(--border)"}`, backgroundColor: cats.size === 0 ? "var(--copper-soft-bg)" : "transparent" }}>
                      {cats.size === 0 && <Check className="w-3 h-3" style={{ color: "var(--copper-text)" }} />}
                    </span>
                    <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: ALL_COLOR }} />
                    <span className="text-sm flex-1 min-w-0 truncate" style={{ color: "var(--text-primary)" }}>All</span>
                    <span className="text-[11px] tabular-nums shrink-0" style={{ color: "var(--text-muted)" }}>{countFor("all")}</span>
                  </button>
                  {HISTORY_CATS.map(c => {
                    const on = cats.has(c.key);
                    return (
                      <button key={c.key} onClick={() => toggleCat(c.key)}
                        className="w-full flex items-center gap-2.5 px-1.5 py-1.5 rounded-lg text-left transition-colors hover:bg-[var(--bg-surface-2)]">
                        <span className="w-5 h-5 rounded flex items-center justify-center shrink-0"
                          style={{ border: `1.5px solid ${on ? "var(--copper-soft-border)" : "var(--border)"}`, backgroundColor: on ? "var(--copper-soft-bg)" : "transparent" }}>
                          {on && <Check className="w-3 h-3" style={{ color: "var(--copper-text)" }} />}
                        </span>
                        <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: CATEGORY_COLOR[c.key] }} />
                        <span className="text-sm flex-1 min-w-0 truncate" style={{ color: "var(--text-primary)" }}>{c.label}</span>
                        <span className="text-[11px] tabular-nums shrink-0" style={{ color: "var(--text-muted)" }}>{countFor(c.key)}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Sort + importance */}
              <div className="flex items-center gap-1.5">
                <button onClick={() => setNewestFirst(v => !v)}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors"
                  style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }} title="Toggle sort order">
                  <ArrowDownUp className="w-3.5 h-3.5" /> {newestFirst ? "Newest first" : "Oldest first"}
                </button>
                <button onClick={() => setImportantOnly(v => !v)}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors"
                  style={importantOnly
                    ? { border: "1px solid #f59e0b59", backgroundColor: "#f59e0b1a", color: "#f59e0b" }
                    : { border: "1px solid var(--border)", color: "var(--text-secondary)" }}>
                  <Star className="w-3.5 h-3.5" style={{ fill: importantOnly ? "#f59e0b" : "none" }} /> Important only
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="py-12 text-center rounded-xl" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)" }}>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>No matching history.</p>
        </div>
      ) : (
        <div className="space-y-5">
          {groups.map(group => (
            <div key={group.day}>
              {/* Date header */}
              <div className="flex items-center gap-2.5 mb-2">
                <p className="text-[11px] font-semibold uppercase tracking-wider shrink-0" style={{ color: "var(--text-secondary)" }}>{dayHeading(group.day)}</p>
                <div className="flex-1 h-px" style={{ backgroundColor: "var(--border-subtle)" }} />
                <span className="text-[10px] shrink-0" style={{ color: "var(--text-muted)" }}>{group.items.length}</span>
              </div>

              <div className="space-y-0.5">
                {group.items.map(event => {
                  const config = EVENT_CONFIG[event.eventType];
                  const Icon = config.icon;
                  const time = eventTime(event.createdAt);
                  const quiet = SYSTEM_EVENTS.has(event.eventType) || event.createdBy === "—";
                  const color = quiet ? "var(--text-muted)" : CATEGORY_COLOR[categoryOf(event.eventType)];
                  const target = (() => { const t = actionTabFor(event.eventType); return t ? mapTab(t) : null; })();
                  return (
                    // Rows with a destination are fully clickable — hover raises the
                    // row and the nudging arrow is the "takes you there" cue.
                    <div key={event.id}
                      onClick={target ? () => onTab(target) : undefined}
                      className={`group flex gap-3 rounded-lg px-2 py-2 -mx-2 transition-all hover:bg-[var(--bg-surface-2)] ${target ? "cursor-pointer hover:-translate-y-px hover:shadow-sm" : ""}`}>
                      {/* Time gutter — connected to the row (wide enough that
                          "12:00 AM" never wraps) */}
                      <div className="w-14 shrink-0 text-right pt-1">
                        <span className="text-[11px] tabular-nums whitespace-nowrap" style={{ color: "var(--text-muted)" }}>{time ?? ""}</span>
                      </div>

                      {/* Category icon node */}
                      <div className="shrink-0 pt-0.5">
                        <span className="w-7 h-7 rounded-lg flex items-center justify-center"
                          style={{ backgroundColor: quiet ? "var(--bg-input)" : color + "1a", border: `1px solid ${quiet ? "var(--border-subtle)" : color + "33"}` }}>
                          <Icon className="w-3.5 h-3.5" style={{ color }} />
                        </span>
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
                            style={{ backgroundColor: quiet ? "var(--bg-input)" : color + "1a", color: quiet ? "var(--text-muted)" : color }}>
                            {config.label}
                          </span>
                          {quiet && <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>System</span>}
                        </div>
                        <p className="text-sm font-medium mt-1 leading-snug" style={{ color: quiet ? "var(--text-secondary)" : "var(--text-primary)" }}>{event.title}</p>
                        {event.description && <p className="text-xs mt-0.5 leading-relaxed" style={{ color: "var(--text-muted)" }}>{event.description}</p>}

                        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                          <span className="inline-flex items-center gap-1.5">
                            <span className="w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold text-white shrink-0" style={{ backgroundColor: event.createdBy === "—" ? "#9ca3af" : "#239c8d" }}>{eventInitials(event.createdBy)}</span>
                            <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>{event.createdBy === "—" ? "System" : event.createdBy}</span>
                          </span>
                        </div>
                      </div>

                      {/* Clickability cue — appears and nudges on hover */}
                      {target && (
                        <div className="shrink-0 self-center pr-1">
                          <ArrowUpRight className="w-3.5 h-3.5 opacity-0 -translate-x-0.5 translate-y-0.5 transition-all group-hover:opacity-100 group-hover:translate-x-0 group-hover:translate-y-0"
                            style={{ color: "var(--accent-text)" }} />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
