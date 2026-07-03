"use client";

import React, { use, useState, Suspense } from "react";
import Link from "next/link";
import {
  ArrowLeft, Pencil, Plus, Trash2,
  Phone, Mail, MapPin, User, Calendar, DollarSign,
  MessageSquare, CheckSquare, Briefcase, FolderKanban,
  TrendingUp, AlertCircle, Building2, Clock, FileText, Tag,
} from "lucide-react";
import StatusBadge from "@/components/shared/StatusBadge";
import HoverInfo, { Pill } from "@/components/shared/HoverInfo";
import ActionsMenu from "@/components/shared/ActionsMenu";
import {
  getLead, getLeadNotes, getLeadTasks, deleteLead, leadAgeDays,
  LEAD_STAGE_CONFIG, LEAD_SOURCE_LABELS,
  type LeadStage, type LeadNoteType,
} from "@/lib/leads/data";
import LeadEditModal from "@/components/leads/LeadEditModal";
import { getActivityEvents } from "@/lib/activity/data";
import { EVENT_FILTER_MAP } from "@/lib/activity/types";
import { jobTypeLabel } from "@/lib/job-config/data";
import UiSelect from "@/components/ui/Select";
import DatePicker from "@/components/ui/DatePicker";
import { companies, locations, serviceAreas } from "@/lib/hierarchy/data";
import { getCustomer } from "@/lib/customers/data";
import { getQuotesForLead, getQuoteActivity, fmt as fmtCurrency, type QuoteActivityKind } from "@/lib/quotes/data";
import { QUOTE_STATUS_STYLE } from "@/lib/quotes/types";
import { useRouter, useSearchParams } from "next/navigation";
import QuoteTypeChooser from "@/components/quotes/create/QuoteTypeChooser";
import Commentable from "@/components/comments/Commentable";
import DetailTabs from "@/components/shared/DetailTabs";

const TABS = ["Overview", "Activity", "Quotes", "Tasks", "Notes", "Photos & Files", "Communication", "Convert"];

const NOTE_ICON: Record<LeadNoteType, typeof MessageSquare> = {
  note: MessageSquare, call: Phone, email: Mail, visit: MapPin,
};

// ─── Shared primitives (mirrors the Customer overview look) ──
function Card({ title, children, className = "" }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl p-4 ${className}`} style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" }}>
      <p className="text-[10px] font-semibold uppercase tracking-widest mb-3" style={{ color: "var(--text-muted)" }}>{title}</p>
      {children}
    </div>
  );
}

// Icon · muted label · bold value, stacked — the detail-list field used in the
// wide left-hand card (identical to the Customer / Agreement overview).
function DetailField({ icon: Icon, label, value }: { icon?: typeof Phone; label: string; value?: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2.5">
      {Icon && <Icon className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: "var(--text-muted)" }} />}
      <div className="min-w-0 flex-1">
        <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>{label}</p>
        <p className="text-sm font-medium break-words" style={{ color: "var(--text-primary)" }}>{value || "—"}</p>
      </div>
    </div>
  );
}

function SectionCard({
  title, count, action, children, className = "",
}: {
  title: string;
  count?: number;
  action?: { label: string; onClick: () => void };
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-xl overflow-hidden flex flex-col ${className}`} style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" }}>
      <div className="flex items-center justify-between px-4 py-3 shrink-0" style={{ borderBottom: "1px solid var(--border)" }}>
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{title}</p>
          {count !== undefined && count > 0 && (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ backgroundColor: "var(--bg-input)", color: "var(--text-muted)" }}>{count}</span>
          )}
        </div>
        {action && <button onClick={action.onClick} className="text-xs font-medium text-indigo-600 hover:text-indigo-700">{action.label}</button>}
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto">{children}</div>
    </div>
  );
}

function Row({ children, last }: { children: React.ReactNode; last: boolean }) {
  return (
    <div className="flex items-center px-4 py-3 hover:bg-[var(--bg-surface-2)] transition-colors"
      style={!last ? { borderBottom: "1px solid var(--border)" } : undefined}>
      {children}
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="px-4 py-8 text-center">
      <p className="text-sm" style={{ color: "var(--text-muted)" }}>{text}</p>
    </div>
  );
}

// ─── Overview tab (mirrors the Customer overview structure) ──
function OverviewTab({ id, onTab }: { id: string; onTab: (tab: string) => void }) {
  const lead     = getLead(id)!;
  const notes    = getLeadNotes(id);
  const tasks    = getLeadTasks(id);
  const customer = lead.accountId ? getCustomer(lead.accountId) : null;
  const company  = companies.find(c => c.id === lead.companyId);
  const location = locations.find(l => l.id === lead.locationId);
  const area     = lead.serviceAreaId ? serviceAreas.find(s => s.id === lead.serviceAreaId) : null;
  const stageConfig = LEAD_STAGE_CONFIG[lead.stage];
  const quotes   = getQuotesForLead(id);

  const openTasks = tasks.filter(t => t.status !== "completed");
  const ts = (s?: string | null) => { if (!s) return Infinity; const t = new Date(s).getTime(); return isNaN(t) ? Infinity : t; };
  const nextTask = [...openTasks].sort((a, b) => ts(a.dueDate) - ts(b.dueDate))[0] ?? null;

  const openQuotes = quotes.filter(q => !["accepted", "converted", "declined", "expired", "paid"].includes(q.status));
  const quoteValue = quotes.reduce((s, q) => s + q.total, 0);
  const ageDays = leadAgeDays(lead.createdAt);
  const isConverted = Boolean(lead.convertedToJobId || lead.convertedToProjectId);

  // Contact info comes from the linked account when present, else the prospect fields.
  const contactPhone = customer?.phone ?? lead.customerPhone;
  const contactEmail = customer?.email ?? lead.customerEmail;
  const contactAddr  = lead.customerAddress;

  // Compact KPI strip — the lead's at-a-glance state (same card style as Customer).
  const summary: { icon: typeof Briefcase; label: string; value: string; sub?: string; accent?: string }[] = [
    { icon: TrendingUp,  label: "Stage",       value: stageConfig.label, sub: LEAD_SOURCE_LABELS[lead.source], accent: stageConfig.color },
    { icon: DollarSign,  label: "Est. Value",  value: lead.estimatedValue || "—", sub: "Opportunity" },
    { icon: FileText,    label: "Quotes",      value: String(quotes.length), sub: quoteValue > 0 ? `${fmtCurrency(quoteValue)} · ${openQuotes.length} open` : `${openQuotes.length} open` },
    { icon: Clock,       label: "Age",         value: `${ageDays} day${ageDays === 1 ? "" : "s"}`, sub: `Since ${lead.displayDate}` },
    { icon: CheckSquare, label: "Next Task",   value: nextTask ? nextTask.dueDate : "—", sub: nextTask ? nextTask.title : "Nothing scheduled" },
  ];

  return (
    <div className="h-full flex flex-col gap-5">
      {/* ── Summary cards (compact) ─────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2.5 shrink-0">
        {summary.map(c => (
          <div key={c.label} className="rounded-xl px-3 py-2.5" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" }}>
            <div className="flex items-center gap-1.5 mb-1">
              <c.icon className="w-3 h-3" style={{ color: c.accent ?? "var(--text-muted)" }} />
              <p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>{c.label}</p>
            </div>
            <p className="text-sm font-bold leading-tight truncate" style={{ color: c.accent ?? "var(--text-primary)" }}>{c.value}</p>
            {c.sub && <p className="text-[11px] mt-0.5 truncate" style={{ color: "var(--text-muted)" }}>{c.sub}</p>}
          </div>
        ))}
      </div>

      {/* ── Snapshot grid: wide lead details (left) · activity (right) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 shrink-0">
        {/* LEFT — one wide details container */}
        <Card title="Lead Details" className="lg:col-span-2 h-full">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
            <DetailField icon={TrendingUp} label="Lead Title"   value={lead.title} />
            <DetailField icon={Tag}        label="Stage"        value={<span style={{ color: stageConfig.color, fontWeight: 600 }}>{stageConfig.label}</span>} />
            <DetailField icon={Tag}        label="Source"       value={LEAD_SOURCE_LABELS[lead.source]} />
            <DetailField icon={DollarSign} label="Est. Value"   value={lead.estimatedValue} />
            <DetailField icon={User}       label="Assigned To"  value={lead.assignedTo} />
            <DetailField icon={Calendar}   label="Created"      value={`${lead.displayDate} · ${ageDays}d ago`} />
            <DetailField icon={Briefcase}  label="Company"      value={company?.name} />
            <DetailField icon={MapPin}     label="Location"     value={location?.name} />
            {area && <DetailField icon={MapPin} label="Service Area" value={area.name} />}
            <DetailField
              icon={customer ? Building2 : User}
              label={customer ? "Linked Account" : "Prospect"}
              value={customer
                ? <Link href={`/customers/${customer.id}`} className="text-indigo-600 hover:text-indigo-700">{customer.name} →</Link>
                : lead.customerName}
            />
            <DetailField icon={Phone} label="Phone"   value={contactPhone} />
            <DetailField icon={Mail}  label="Email"   value={contactEmail} />
            {contactAddr && <DetailField icon={MapPin} label="Address" value={contactAddr} />}
          </div>
          {lead.notes && (
            <div className="mt-4 pt-4" style={{ borderTop: "1px solid var(--border)" }}>
              <p className="text-[10px] mb-1" style={{ color: "var(--text-muted)" }}>Notes</p>
              <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>{lead.notes}</p>
            </div>
          )}
        </Card>

        {/* RIGHT — what needs doing + recent activity */}
        <div className="h-full flex flex-col gap-4">
          <SectionCard title="Upcoming Tasks" count={openTasks.length} action={{ label: "View all", onClick: () => onTab("Tasks") }} className="flex-1 min-h-0">
            {openTasks.length === 0 ? <Empty text="No upcoming tasks" /> : openTasks.slice(0, 4).map((task, i) => {
              const isOverdue = task.status === "overdue";
              return (
                <Row key={task.id} last={i === Math.min(3, openTasks.length - 1)}>
                  <CheckSquare className="w-4 h-4 shrink-0 mr-3" style={{ color: isOverdue ? "#dc2626" : "var(--text-muted)" }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>{task.title}</p>
                    <p className="text-xs mt-0.5 truncate" style={{ color: isOverdue ? "#dc2626" : "var(--text-muted)" }}>
                      Due {task.dueDate} · {task.assignedTo}
                    </p>
                  </div>
                  {isOverdue && (
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full ml-3 shrink-0"
                      style={{ backgroundColor: "#fee2e2", color: "#991b1b" }}>Overdue</span>
                  )}
                </Row>
              );
            })}
          </SectionCard>

          <SectionCard title="Recent Activity" count={notes.length} action={{ label: "View all", onClick: () => onTab("Activity") }} className="flex-1 min-h-0">
            {notes.length === 0 ? <Empty text="No activity yet" /> : notes.slice(0, 4).map((note, i) => {
              const Icon = NOTE_ICON[note.type];
              return (
                <Row key={note.id} last={i === Math.min(3, notes.length - 1)}>
                  <div className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center shrink-0 mr-3">
                    <Icon className="w-3 h-3 text-indigo-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm leading-snug truncate" style={{ color: "var(--text-secondary)" }}>{note.text}</p>
                    <p className="text-[10px] mt-0.5 truncate" style={{ color: "var(--text-muted)" }}>{note.user} · {note.date}</p>
                  </div>
                </Row>
              );
            })}
          </SectionCard>
        </div>
      </div>

      {/* ── Converted notice (when applicable) ── */}
      {isConverted && (
        <div className="rounded-xl px-4 py-3 flex items-center gap-3 shrink-0"
          style={{ backgroundColor: "#d1fae5", border: "1px solid #6ee7b7" }}>
          <CheckSquare className="w-4 h-4 shrink-0 text-emerald-600" />
          <div>
            <p className="text-sm font-semibold text-emerald-800">Lead converted</p>
            {lead.convertedToJobId ? (
              <Link href={`/jobs/${lead.convertedToJobId}`} className="text-xs font-medium text-emerald-700 hover:text-emerald-800">Converted to Job · View →</Link>
            ) : lead.convertedToProjectId ? (
              <Link href={`/projects/${lead.convertedToProjectId}`} className="text-xs font-medium text-emerald-700 hover:text-emerald-800">Converted to Project · View →</Link>
            ) : (
              <p className="text-xs text-emerald-700">Converted</p>
            )}
          </div>
        </div>
      )}

      {/* ── Quotes — full-width, fills the remaining vertical space ── */}
      <div className="flex-1 min-h-0 rounded-xl flex flex-col overflow-hidden" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" }}>
        <div className="flex items-center justify-between px-4 py-3 shrink-0" style={{ borderBottom: "1px solid var(--border)" }}>
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Quotes</p>
            {quotes.length > 0 && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ backgroundColor: "var(--bg-input)", color: "var(--text-muted)" }}>{quotes.length}</span>}
          </div>
          <button onClick={() => onTab("Quotes")} className="text-xs font-medium text-indigo-600 hover:text-indigo-700">View all</button>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto p-4">
          {quotes.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center py-6">
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>No quotes for this lead yet</p>
              <button onClick={() => onTab("Quotes")} className="mt-1.5 text-xs font-medium text-indigo-600 hover:text-indigo-700">Create a quote →</button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
              {quotes.map(q => {
                const s = QUOTE_STATUS_STYLE[q.status];
                return (
                  <Link key={q.id} href={`/quotes/${q.id}`}
                    className="rounded-lg p-3 transition-colors hover:bg-[var(--bg-surface-2)]"
                    style={{ border: "1px solid var(--border)", textDecoration: "none" }}>
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-mono font-semibold truncate" style={{ color: "var(--text-primary)" }}>{q.quoteNumber}</p>
                      <StatusBadge label={s.label} color={s.color} size="sm" className="shrink-0" />
                    </div>
                    <p className="text-xs mt-1 truncate" style={{ color: "var(--text-muted)" }}>{q.title}</p>
                    <p className="text-sm font-semibold mt-1.5" style={{ color: "var(--text-primary)" }}>{q.total > 0 ? fmtCurrency(q.total) : "TBD"}</p>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Tasks tab ────────────────────────────────────────────
function TasksTab({ id }: { id: string }) {
  const tasks = getLeadTasks(id);
  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-3 py-1.5 rounded-lg transition-colors">
          <Plus className="w-3.5 h-3.5" /> Add Task
        </button>
      </div>
      <div className="rounded-xl overflow-hidden" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" }}>
        {tasks.length === 0 ? (
          <div className="py-12 text-center"><p className="text-sm" style={{ color: "var(--text-muted)" }}>No tasks yet</p></div>
        ) : tasks.map((task, i) => {
          const isOverdue   = task.status === "overdue";
          const isCompleted = task.status === "completed";
          return (
            <div key={task.id} className="flex items-center gap-3 px-4 py-3 hover:bg-[var(--bg-surface-2)] transition-colors"
              style={{ borderBottom: i < tasks.length - 1 ? "1px solid var(--border)" : "none" }}>
              <CheckSquare className="w-4 h-4 shrink-0" style={{ color: isCompleted ? "#10b981" : isOverdue ? "#dc2626" : "var(--text-muted)" }} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium" style={{ color: isCompleted ? "var(--text-muted)" : "var(--text-primary)", textDecoration: isCompleted ? "line-through" : "none" }}>
                  {task.title}
                </p>
                <p className="text-xs mt-0.5" style={{ color: isOverdue ? "#dc2626" : "var(--text-muted)" }}>
                  Due {task.dueDate} · {task.assignedTo}
                </p>
              </div>
              {isOverdue && (
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0"
                  style={{ backgroundColor: "#fee2e2", color: "#991b1b" }}>Overdue</span>
              )}
              {isCompleted && (
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0"
                  style={{ backgroundColor: "#d1fae5", color: "#065f46" }}>Done</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Notes tab ────────────────────────────────────────────
function NotesTab({ id }: { id: string }) {
  const [draft, setDraft] = useState("");
  const notes = getLeadNotes(id);

  return (
    <div className="space-y-4">
      <div className="rounded-xl p-4" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" }}>
        <textarea value={draft} onChange={e => setDraft(e.target.value)}
          placeholder="Add a note, log a call, or record a visit..."
          rows={3}
          className="w-full resize-none text-sm outline-none bg-transparent"
          style={{ color: "var(--text-primary)" }} />
        <div className="flex items-center justify-between mt-3 pt-3" style={{ borderTop: "1px solid var(--border)" }}>
          <div className="flex gap-2">
            {(["note", "call", "email", "visit"] as const).map(t => (
              <button key={t} className="text-[11px] px-2 py-1 rounded-lg capitalize transition-colors"
                style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}>
                {t}
              </button>
            ))}
          </div>
          <button disabled={!draft.trim()}
            className="px-3 py-1.5 rounded-lg text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 transition-colors">
            Save
          </button>
        </div>
      </div>

      {notes.length === 0 ? (
        <p className="text-sm text-center py-8" style={{ color: "var(--text-muted)" }}>No notes yet</p>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {notes.map(note => {
            const Icon = NOTE_ICON[note.type];
            return (
              <div key={note.id} className="rounded-xl p-4" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)" }}>
                <div className="flex items-start gap-3">
                  <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
                    <Icon className="w-3.5 h-3.5 text-indigo-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>{note.user}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded capitalize"
                        style={{ backgroundColor: "var(--bg-input)", color: "var(--text-muted)" }}>{note.type}</span>
                      <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>{note.date}</span>
                    </div>
                    <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>{note.text}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Convert tab ──────────────────────────────────────────
function ConvertTab({ id }: { id: string }) {
  const lead = getLead(id)!;
  const [mode, setMode] = useState<"choose" | "job" | "project" | "done">("choose");
  const [jobTitle, setJobTitle] = useState(lead.title);
  const [jobType, setJobType]   = useState("agreement_visit");
  const [jobDate, setJobDate]   = useState("");
  const [projName, setProjName] = useState(lead.title);

  if (lead.convertedToJobId || lead.convertedToProjectId) {
    return (
      <div className="max-w-lg">
        <div className="rounded-xl p-6 text-center" style={{ backgroundColor: "#d1fae5", border: "1px solid #6ee7b7" }}>
          <CheckSquare className="w-8 h-8 mx-auto mb-3 text-emerald-600" />
          <p className="text-sm font-semibold text-emerald-800">This lead has already been converted.</p>
          {lead.convertedToJobId && (
            <Link href={`/jobs/${lead.convertedToJobId}`}
              className="mt-2 inline-block text-sm font-medium text-emerald-700 hover:text-emerald-800">
              View Job →
            </Link>
          )}
          {lead.convertedToProjectId && (
            <Link href={`/projects/${lead.convertedToProjectId}`}
              className="mt-2 inline-block text-sm font-medium text-emerald-700 hover:text-emerald-800">
              View Project →
            </Link>
          )}
        </div>
      </div>
    );
  }

  if (mode === "done") {
    return (
      <div className="max-w-lg">
        <div className="rounded-xl p-6 text-center" style={{ backgroundColor: "#d1fae5", border: "1px solid #6ee7b7" }}>
          <CheckSquare className="w-8 h-8 mx-auto mb-3 text-emerald-600" />
          <p className="text-sm font-semibold text-emerald-800">Lead converted successfully.</p>
          <p className="text-xs mt-1 text-emerald-700">Connect Supabase to persist the new record.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-xl space-y-4">
      {/* Info banner */}
      <div className="rounded-xl px-4 py-3" style={{ backgroundColor: "#eef2ff", border: "1px solid #c7d2fe" }}>
        <p className="text-xs" style={{ color: "#3730a3" }}>
          Converting this lead marks it as <strong>Won</strong> and creates either a Job or a Project. The lead record is preserved.
        </p>
      </div>

      {/* Choose */}
      {mode === "choose" && (
        <div className="grid grid-cols-2 gap-4">
          <button onClick={() => setMode("job")}
            className="rounded-xl p-5 text-left transition-all hover:border-indigo-300"
            style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" }}>
            <Briefcase className="w-6 h-6 mb-3" style={{ color: "#4f46e5" }} />
            <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Convert to Job</p>
            <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>A single unit of scheduled work assigned to a technician.</p>
          </button>
          <button onClick={() => setMode("project")}
            className="rounded-xl p-5 text-left transition-all hover:border-indigo-300"
            style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" }}>
            <FolderKanban className="w-6 h-6 mb-3" style={{ color: "#4f46e5" }} />
            <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Convert to Project</p>
            <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>A larger scope with multiple jobs, phases, or milestones.</p>
          </button>
        </div>
      )}

      {/* Job form */}
      {mode === "job" && (
        <div className="rounded-xl p-5 space-y-4" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" }}>
          <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>New Job Details</p>
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Job Title</label>
            <input value={jobTitle} onChange={e => setJobTitle(e.target.value)}
              className="w-full rounded-lg px-3 py-2 text-sm outline-none"
              style={{ border: "1px solid var(--border)", backgroundColor: "var(--bg-surface)", color: "var(--text-primary)" }} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Job Type</label>
              <UiSelect value={jobType} onChange={setJobType}
                options={["agreement_visit", "repair", "installation", "inspection", "replacement", "estimate", "other"].map(t => ({ value: t, label: jobTypeLabel(t) }))} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Scheduled Date</label>
              <DatePicker value={jobDate} onChange={setJobDate} placeholder="Pick a date" />
            </div>
          </div>
          <div className="flex gap-2 justify-end pt-1">
            <button onClick={() => setMode("choose")}
              className="px-3 py-1.5 rounded-lg text-sm transition-colors"
              style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}>Back</button>
            <button onClick={() => setMode("done")} disabled={!jobTitle.trim()}
              className="px-4 py-1.5 rounded-lg text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 transition-colors">
              Convert to Job
            </button>
          </div>
        </div>
      )}

      {/* Project form */}
      {mode === "project" && (
        <div className="rounded-xl p-5 space-y-4" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" }}>
          <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>New Project Details</p>
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Project Name</label>
            <input value={projName} onChange={e => setProjName(e.target.value)}
              className="w-full rounded-lg px-3 py-2 text-sm outline-none"
              style={{ border: "1px solid var(--border)", backgroundColor: "var(--bg-surface)", color: "var(--text-primary)" }} />
          </div>
          <div className="flex gap-2 justify-end pt-1">
            <button onClick={() => setMode("choose")}
              className="px-3 py-1.5 rounded-lg text-sm transition-colors"
              style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}>Back</button>
            <button onClick={() => setMode("done")} disabled={!projName.trim()}
              className="px-4 py-1.5 rounded-lg text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 transition-colors">
              Convert to Project
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Activity tab ─────────────────────────────────────────
// Timeline: a small tinted icon on the connector line, then a uniform surface
// container — category pill (left) with the date on the right, the detail, and a
// footer crediting the user/source the activity is tied to. Amber is the default
// accent (the bright blues are gone); calls stay green.
const NOTE_TYPE_META: Record<LeadNoteType, { icon: typeof MessageSquare; color: string; label: string }> = {
  note:  { icon: MessageSquare, color: "#d97706", label: "Note" },
  call:  { icon: Phone,         color: "#059669", label: "Call" },
  email: { icon: Mail,          color: "#d97706", label: "Email" },
  visit: { icon: MapPin,        color: "#d97706", label: "Visit" },
};

function TimelineEvent({ icon: Icon, color, label, title, user, date, time, last }: {
  icon: typeof MessageSquare; color: string; label: string;
  title?: string; user?: string; date?: string; time?: string; last?: boolean;
}) {
  return (
    <div className="flex gap-3">
      {/* Icon + connector */}
      <div className="flex flex-col items-center shrink-0">
        <div className="w-7 h-7 rounded-lg flex items-center justify-center z-10"
          style={{ backgroundColor: color + "1a", border: `1px solid ${color}33` }}>
          <Icon className="w-3.5 h-3.5" style={{ color }} />
        </div>
        {!last && <div className="w-px flex-1 my-1" style={{ backgroundColor: "var(--border-subtle)" }} />}
      </div>

      {/* Content container — uniform regardless of content */}
      <div className="flex-1 min-w-0 rounded-xl px-4 py-3 mb-3 flex flex-col"
        style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-card)", minHeight: 80 }}>
        <div className="flex items-start justify-between gap-3">
          <span className="inline-block text-[10px] font-semibold px-2 py-0.5 rounded-md shrink-0"
            style={{ backgroundColor: color + "1a", color }}>{label}</span>
          {date && (
            <span className="text-right shrink-0 leading-tight">
              <span className="block text-xs" style={{ color: "var(--text-muted)" }}>{date}</span>
              {time && <span className="block text-[11px]" style={{ color: "var(--text-muted)" }}>{time}</span>}
            </span>
          )}
        </div>
        {title && <p className="text-sm font-medium mt-1.5 break-words leading-relaxed" style={{ color: "var(--text-primary)" }}>{title}</p>}
        <div className="flex items-center gap-1.5 mt-auto pt-1.5">
          <User className="w-3 h-3 shrink-0" style={{ color: "var(--text-muted)" }} />
          <span className="text-[11px] truncate" style={{ color: "var(--text-muted)" }}>{user || "System"}</span>
        </div>
      </div>
    </div>
  );
}

// Quote lifecycle events that surface on the lead timeline (noisy kinds like
// "edited"/"note" are omitted). Reuses the FileText/CheckSquare icons already
// imported on this page; amber default, green for approval/conversion.
const QUOTE_KIND_META: Partial<Record<QuoteActivityKind, { icon: typeof FileText; color: string; label: string }>> = {
  created:   { icon: FileText,    color: "#d97706", label: "Quote Created" },
  sent:      { icon: FileText,    color: "#d97706", label: "Quote Sent" },
  approved:  { icon: CheckSquare, color: "#059669", label: "Quote Approved" },
  rejected:  { icon: FileText,    color: "#b91c1c", label: "Quote Declined" },
  converted: { icon: CheckSquare, color: "#059669", label: "Quote Converted" },
};

// A single, chronological activity feed for the lead. Derived live from the lead
// record, its quotes, and any manual notes — so e.g. a quote created against this
// lead shows up here automatically.
interface FeedItem { key: string; icon: typeof FileText; color: string; label: string; title?: string; user: string; date: string; time?: string; ts: number; }

function LeadActivityTab({ id }: { id: string }) {
  const lead   = getLead(id)!;
  const notes  = getLeadNotes(id);
  const quotes = getQuotesForLead(id);

  const parseTs = (d?: string) => { const t = d ? Date.parse(d) : NaN; return isNaN(t) ? 0 : t; };
  // Time-of-day from an ISO timestamp (e.g. "3:14 PM"); blank if unparseable.
  const timeOf = (iso?: string) => { const t = iso ? Date.parse(iso) : NaN; return isNaN(t) ? undefined : new Date(t).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }); };

  const feed: FeedItem[] = [];

  // Lead created — always the origin of the timeline, so pin it to the bottom
  // (nothing can attach to a lead before it exists) regardless of same-day ties.
  feed.push({
    key: `lead-created-${lead.id}`, icon: TrendingUp, color: "#d97706", label: "Lead Created",
    title: lead.title, user: lead.assignedTo && lead.assignedTo !== "Unassigned" ? lead.assignedTo : "System",
    date: lead.displayDate, time: timeOf(lead.createdAt), ts: Number.NEGATIVE_INFINITY,
  });

  // Quote lifecycle — every quote attached to this lead and its key milestones.
  // Order by the precise ISO timestamp when present (so same-day events sort by time).
  for (const q of quotes) {
    for (const a of getQuoteActivity(q)) {
      const meta = QUOTE_KIND_META[a.kind];
      if (!meta) continue;
      feed.push({
        key: `${q.id}-${a.id}`, icon: meta.icon, color: meta.color, label: meta.label,
        title: `${q.quoteNumber} · ${q.title}${q.total > 0 ? ` · ${fmtCurrency(q.total)}` : ""}`,
        user: a.actor, date: a.at, time: timeOf(a.iso), ts: a.iso ? parseTs(a.iso) : parseTs(a.at),
      });
    }
  }

  // Manual lead notes / calls / emails / visits
  for (const n of notes) {
    const cfg = NOTE_TYPE_META[n.type];
    feed.push({ key: n.id, icon: cfg.icon, color: cfg.color, label: cfg.label, title: n.text, user: n.user, date: n.date, ts: parseTs(n.date) });
  }

  feed.sort((a, b) => b.ts - a.ts); // newest at top, oldest (lead created) at bottom

  // Customer-level events filtered to ones relevant to this lead's context
  const customerEvents = lead.accountId
    ? getActivityEvents(lead.accountId).filter(e => {
        const cat = EVENT_FILTER_MAP[e.eventType];
        return cat === "notes" || cat === "communication" || cat === "all";
      }).slice(0, 5)
    : [];

  const hasAnything = feed.length > 0 || customerEvents.length > 0;

  return (
    <div className="space-y-6">
      {!hasAnything && (
        <div className="rounded-xl p-10 text-center"
          style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)" }}>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>No activity yet on this lead.</p>
        </div>
      )}

      {/* Unified lead activity timeline */}
      {feed.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest mb-3" style={{ color: "var(--text-muted)" }}>Lead Activity</p>
          <div>
            {feed.map((item, i) => (
              <TimelineEvent key={item.key} icon={item.icon} color={item.color} label={item.label}
                title={item.title} user={item.user} date={item.date} time={item.time} last={i === feed.length - 1} />
            ))}
          </div>
        </div>
      )}

      {/* Recent customer-level activity if account is linked */}
      {customerEvents.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>Recent Account Activity</p>
            <Link href={`/customers/${lead.accountId}`}
              className="text-xs font-medium" style={{ color: "#4f46e5", textDecoration: "none" }}>
              View full timeline →
            </Link>
          </div>
          <div>
            {customerEvents.map((event, i) => (
              <TimelineEvent key={event.id} icon={MessageSquare} color="#d97706" label="Account"
                title={event.title} user={event.createdBy} date={event.displayDate} last={i === customerEvents.length - 1} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Quotes tab ───────────────────────────────────────────
function LeadQuotesTab({ id }: { id: string }) {
  const [wizard, setWizard] = useState(false);
  const lead = getLead(id);
  const quotes = getQuotesForLead(id);

  return (
    <div className="rounded-xl overflow-hidden" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" }}>
      {wizard && (
        <QuoteTypeChooser preset={{ customerId: lead?.accountId, leadId: id, lockCustomer: Boolean(lead?.accountId) }}
          onClose={() => setWizard(false)} />
      )}
      <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
        <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Quotes ({quotes.length})</p>
        <button onClick={() => setWizard(true)} className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg"
          style={{ backgroundColor: "#4f46e5", color: "#fff" }}>
          <Plus className="w-3.5 h-3.5" /> New Quote
        </button>
      </div>
      {quotes.length === 0 ? (
        <div className="px-4 py-10 text-center"><p className="text-sm" style={{ color: "var(--text-muted)" }}>No quotes for this lead yet.</p></div>
      ) : quotes.map((q, i) => {
        const s = QUOTE_STATUS_STYLE[q.status];
        return (
          <Link key={q.id} href={`/quotes/${q.id}`}
            className="flex items-center gap-4 px-4 py-3 hover:bg-[var(--bg-surface-2)] transition-colors"
            style={{ borderBottom: i < quotes.length - 1 ? "1px solid var(--border)" : "none", textDecoration: "none" }}>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-mono font-medium" style={{ color: "var(--text-primary)" }}>{q.quoteNumber}</p>
              <p className="text-xs mt-0.5 truncate" style={{ color: "var(--text-muted)" }}>{q.title}</p>
            </div>
            <StatusBadge label={s.label} color={s.color} className="shrink-0" />
            <span className="text-sm font-semibold shrink-0" style={{ color: "var(--text-primary)" }}>{q.total > 0 ? fmtCurrency(q.total) : "TBD"}</span>
          </Link>
        );
      })}
    </div>
  );
}

// ─── Stub tab ─────────────────────────────────────────────
function StubTab({ label, phase }: { label: string; phase: string }) {
  return (
    <div className="rounded-xl p-10 text-center" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)" }}>
      <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{label}</p>
      <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>Coming in {phase}</p>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────
function LeadDetailContent({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();
  // Tab is URL-synced (?tab=) so comment deep-links land on the right tab.
  const [tab, setTabState] = useState(() => { const t = searchParams.get("tab"); return t && TABS.includes(t) ? t : "Overview"; });
  function setTab(t: string) {
    setTabState(t);
    router.replace(`/leads/${id}?tab=${encodeURIComponent(t)}`, { scroll: false });
  }
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  // Page reads the lead store directly; bump this to re-render after an edit.
  const [refreshKey, setRefreshKey] = useState(0);

  const lead = getLead(id);

  if (!lead) {
    return (
      <div className="p-6">
        <Link href="/leads" className="flex items-center gap-1.5 text-sm mb-4" style={{ color: "var(--text-secondary)" }}>
          <ArrowLeft className="w-4 h-4" /> Back to Leads
        </Link>
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>Lead not found.</p>
      </div>
    );
  }

  const stageConfig = LEAD_STAGE_CONFIG[lead.stage];

  return (
    <div className="flex flex-col h-full">
      {/* Sticky header */}
      <div style={{ backgroundColor: "var(--bg-surface)", borderBottom: "1px solid var(--border)" }}>
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-4 min-w-0">
            <Link href="/leads" className="flex items-center gap-1.5 text-sm shrink-0" style={{ color: "var(--text-secondary)" }}>
              <ArrowLeft className="w-4 h-4" /> Leads
            </Link>
            <div className="w-px h-5 shrink-0" style={{ backgroundColor: "var(--border)" }} />
            <Commentable anchor={{ recordType: "lead", recordId: id, recordLabel: lead.customerName }}>
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: "var(--bg-input)" }}>
                <TrendingUp className="w-4 h-4" style={{ color: "var(--text-muted)" }} />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h1 className="text-base font-semibold truncate" style={{ color: "var(--text-primary)" }}>{lead.customerName}</h1>
                  <HoverInfo rows={[
                    { label: "Stage",  node: <Pill text={stageConfig.label} style={{ backgroundColor: stageConfig.bg, color: stageConfig.color }} /> },
                    { label: "Source", node: <Pill text={LEAD_SOURCE_LABELS[lead.source]} style={{ backgroundColor: "var(--bg-input)", color: "var(--text-secondary)" }} /> },
                    ...(lead.estimatedValue
                      ? [{ label: "Value", node: <span className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>{lead.estimatedValue}</span> }]
                      : []),
                  ]} />
                </div>
                <p className="text-xs mt-0.5 truncate" style={{ color: "var(--text-muted)" }}>
                  {lead.title} · {lead.locationName}
                </p>
              </div>
            </div>
            </Commentable>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button onClick={() => setTab("Convert")}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-indigo-600 hover:bg-indigo-700 text-white transition-colors">
              <TrendingUp className="w-3.5 h-3.5" /> Convert
            </button>
            <ActionsMenu actions={[
              { label: "Edit lead", icon: Pencil, onClick: () => setEditOpen(true) },
              { label: "Convert lead", icon: TrendingUp, onClick: () => setTab("Convert") },
              { label: "Delete lead", icon: Trash2, onClick: () => setConfirmDelete(true), danger: true, separated: true },
            ]} />
          </div>
        </div>

        {/* Sub-tabs — glossy light-amber (comment-mode accent) */}
        <DetailTabs tabs={TABS} active={tab} onChange={setTab} className="px-6 py-2" />
      </div>

      {/* Tab content */}
      <div key={refreshKey} className="flex-1 overflow-y-auto p-6" style={{ backgroundColor: "var(--bg-page)" }}>
        {tab === "Overview"       && <OverviewTab id={id} onTab={setTab} />}
        {tab === "Activity"       && <LeadActivityTab id={id} />}
        {tab === "Quotes"         && <LeadQuotesTab id={id} />}
        {tab === "Tasks"          && <TasksTab id={id} />}
        {tab === "Notes"          && <NotesTab id={id} />}
        {tab === "Photos & Files" && <StubTab label="Photos & Files" phase="Phase 3" />}
        {tab === "Communication"  && <StubTab label="Communication" phase="Phase 2" />}
        {tab === "Convert"        && <ConvertTab id={id} />}
      </div>

      {editOpen && (
        <LeadEditModal
          lead={lead}
          onClose={() => setEditOpen(false)}
          onSaved={() => { setEditOpen(false); setRefreshKey(k => k + 1); }}
        />
      )}

      {confirmDelete && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setConfirmDelete(false)}>
          <div className="w-full max-w-md rounded-2xl overflow-hidden" onClick={e => e.stopPropagation()}
            style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "0 16px 48px rgba(0,0,0,0.24)" }}>
            <div className="px-6 py-5 flex items-start gap-3">
              <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: "#fee2e2" }}>
                <AlertCircle className="w-5 h-5" style={{ color: "#dc2626" }} />
              </div>
              <div>
                <h2 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>Delete lead?</h2>
                <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
                  This permanently removes the lead <span className="font-medium" style={{ color: "var(--text-primary)" }}>{lead.title}</span> for {lead.customerName}. The customer account is not affected. This can&apos;t be undone.
                </p>
              </div>
            </div>
            <div className="px-6 py-4 flex justify-end gap-2" style={{ borderTop: "1px solid var(--border)" }}>
              <button onClick={() => setConfirmDelete(false)} className="px-4 py-2 rounded-lg text-sm font-medium" style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}>Cancel</button>
              <button onClick={() => { deleteLead(id); router.push("/leads"); }} className="px-4 py-2 rounded-lg text-sm font-medium text-white" style={{ backgroundColor: "#dc2626" }}>Delete Lead</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function LeadDetailPage(props: { params: Promise<{ id: string }> }) {
  // Suspense boundary required because the content reads useSearchParams.
  return <Suspense fallback={null}><LeadDetailContent {...props} /></Suspense>;
}
