"use client";

import React, { use, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft, Pencil, Plus,
  Phone, Mail, MapPin, User, Calendar, DollarSign,
  MessageSquare, CheckSquare, Briefcase, FolderKanban,
  TrendingUp, AlertCircle,
} from "lucide-react";
import {
  getLead, getLeadNotes, getLeadTasks,
  LEAD_STAGE_CONFIG, LEAD_SOURCE_LABELS,
  type LeadStage, type LeadNoteType,
} from "@/lib/leads/data";
import { getActivityEvents } from "@/lib/activity/data";
import { EVENT_FILTER_MAP } from "@/lib/activity/types";
import UiSelect from "@/components/ui/Select";
import { companies, locations, serviceAreas } from "@/lib/hierarchy/data";
import { getCustomer } from "@/lib/customers/data";
import { getQuotesForLead, fmt as fmtCurrency } from "@/lib/quotes/data";
import { QUOTE_STATUS_STYLE } from "@/lib/quotes/types";
import QuoteWizard from "@/components/quotes/QuoteWizard";

const TABS = ["Overview", "Activity", "Quotes", "Tasks", "Notes", "Photos & Files", "Communication", "Convert"];

const NOTE_ICON: Record<LeadNoteType, typeof MessageSquare> = {
  note: MessageSquare, call: Phone, email: Mail, visit: MapPin,
};

// ─── Shared primitives ────────────────────────────────────
function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl p-4" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-subtle)", boxShadow: "var(--shadow-card)" }}>
      <p className="text-[10px] font-semibold uppercase tracking-widest mb-3" style={{ color: "var(--text-muted)" }}>{title}</p>
      {children}
    </div>
  );
}

function InfoRow({ icon: Icon, label, value }: { icon: typeof Phone; label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="flex items-center gap-2 shrink-0">
        <Icon className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--text-muted)" }} />
        <span className="text-xs" style={{ color: "var(--text-muted)" }}>{label}</span>
      </div>
      <span className="text-xs font-medium text-right truncate" style={{ color: "var(--text-primary)" }}>{value}</span>
    </div>
  );
}

function SectionCard({ title, count, children }: { title: string; count?: number; children: React.ReactNode }) {
  return (
    <div className="rounded-xl overflow-hidden" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-subtle)", boxShadow: "var(--shadow-card)" }}>
      <div className="flex items-center gap-2 px-4 py-3" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
        <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{title}</p>
        {count !== undefined && count > 0 && (
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ backgroundColor: "var(--bg-input)", color: "var(--text-muted)" }}>{count}</span>
        )}
      </div>
      {children}
    </div>
  );
}

function Row({ children, last }: { children: React.ReactNode; last: boolean }) {
  return (
    <div className="flex items-center px-4 py-3 hover:bg-[var(--bg-surface-2)] transition-colors"
      style={!last ? { borderBottom: "1px solid var(--border-subtle)" } : undefined}>
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

// ─── Overview tab ─────────────────────────────────────────
function OverviewTab({ id }: { id: string }) {
  const lead     = getLead(id)!;
  const notes    = getLeadNotes(id);
  const tasks    = getLeadTasks(id);
  const customer = lead.accountId ? getCustomer(lead.accountId) : null;
  const company  = companies.find(c => c.id === lead.companyId);
  const location = locations.find(l => l.id === lead.locationId);
  const area     = lead.serviceAreaId ? serviceAreas.find(s => s.id === lead.serviceAreaId) : null;
  const stageConfig = LEAD_STAGE_CONFIG[lead.stage];
  const openTasks = tasks.filter(t => t.status !== "completed");

  return (
    <div className="grid grid-cols-3 gap-6">
      {/* ── Left column ─────────────────────────── */}
      <div className="space-y-4">
        <Card title="Lead Info">
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs" style={{ color: "var(--text-muted)" }}>Stage</span>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                style={{ backgroundColor: stageConfig.bg, color: stageConfig.color }}>
                {stageConfig.label}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs" style={{ color: "var(--text-muted)" }}>Source</span>
              <span className="text-xs font-medium" style={{ color: "var(--text-primary)" }}>
                {LEAD_SOURCE_LABELS[lead.source]}
              </span>
            </div>
            {lead.estimatedValue && (
              <div className="flex items-center justify-between">
                <span className="text-xs" style={{ color: "var(--text-muted)" }}>Est. Value</span>
                <span className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>
                  {lead.estimatedValue}
                </span>
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className="text-xs" style={{ color: "var(--text-muted)" }}>Created</span>
              <span className="text-xs font-medium" style={{ color: "var(--text-primary)" }}>{lead.displayDate}</span>
            </div>
          </div>
        </Card>

        <Card title="Assignment">
          <div className="space-y-2.5">
            <InfoRow icon={User}     label="Assigned To" value={lead.assignedTo} />
            {company  && <InfoRow icon={Briefcase} label="Company"  value={company.name} />}
            {location && <InfoRow icon={MapPin}    label="Location" value={location.name} />}
            {area     && <InfoRow icon={MapPin}    label="Area"     value={area.name} />}
          </div>
        </Card>

        {/* Account or prospect */}
        <Card title={customer ? "Linked Account" : "Prospect"}>
          {customer ? (
            <div className="space-y-2.5">
              <Link href={`/customers/${customer.id}`}
                className="flex items-center gap-2.5 hover:opacity-80 transition-opacity">
                <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white text-[10px] font-bold shrink-0">
                  {customer.initials}
                </div>
                <div>
                  <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{customer.name}</p>
                  <p className="text-[10px]" style={{ color: "#4f46e5" }}>View customer →</p>
                </div>
              </Link>
              {customer.phone && <InfoRow icon={Phone} label="Phone" value={customer.phone} />}
              {customer.email && <InfoRow icon={Mail}  label="Email" value={customer.email} />}
            </div>
          ) : (
            <div className="space-y-2.5">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 text-[10px] font-bold shrink-0">
                  {lead.customerInitials}
                </div>
                <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{lead.customerName}</p>
              </div>
              {lead.customerPhone   && <InfoRow icon={Phone}  label="Phone"   value={lead.customerPhone} />}
              {lead.customerEmail   && <InfoRow icon={Mail}   label="Email"   value={lead.customerEmail} />}
              {lead.customerAddress && <InfoRow icon={MapPin} label="Address" value={lead.customerAddress} />}
            </div>
          )}
        </Card>

        {lead.notes && (
          <Card title="Notes">
            <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>{lead.notes}</p>
          </Card>
        )}
      </div>

      {/* ── Right column ────────────────────────── */}
      <div className="col-span-2 space-y-4">
        {/* Upcoming tasks */}
        <SectionCard title="Upcoming Tasks" count={openTasks.length}>
          {openTasks.length === 0 ? <Empty text="No upcoming tasks" /> : (
            openTasks.map((task, i) => {
              const isOverdue = task.status === "overdue";
              return (
                <Row key={task.id} last={i === openTasks.length - 1}>
                  <CheckSquare className="w-4 h-4 shrink-0 mr-3" style={{ color: isOverdue ? "#dc2626" : "var(--text-muted)" }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{task.title}</p>
                    <p className="text-xs mt-0.5" style={{ color: isOverdue ? "#dc2626" : "var(--text-muted)" }}>
                      Due {task.dueDate} · {task.assignedTo}
                    </p>
                  </div>
                  {isOverdue && (
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full ml-3 shrink-0"
                      style={{ backgroundColor: "#fee2e2", color: "#991b1b" }}>Overdue</span>
                  )}
                </Row>
              );
            })
          )}
        </SectionCard>

        {/* Recent notes */}
        <SectionCard title="Recent Activity" count={notes.length}>
          {notes.length === 0 ? <Empty text="No activity yet" /> : (
            notes.slice(0, 4).map((note, i) => {
              const Icon = NOTE_ICON[note.type];
              return (
                <Row key={note.id} last={i === Math.min(3, notes.length - 1)}>
                  <div className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center shrink-0 mr-3">
                    <Icon className="w-3 h-3 text-indigo-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm leading-snug" style={{ color: "var(--text-secondary)" }}>{note.text}</p>
                    <p className="text-[10px] mt-0.5" style={{ color: "var(--text-muted)" }}>{note.user} · {note.date}</p>
                  </div>
                </Row>
              );
            })
          )}
        </SectionCard>

        {/* Converted notice */}
        {(lead.convertedToJobId || lead.convertedToProjectId) && (
          <div className="rounded-xl px-4 py-3 flex items-center gap-3"
            style={{ backgroundColor: "#d1fae5", border: "1px solid #6ee7b7" }}>
            <CheckSquare className="w-4 h-4 shrink-0 text-emerald-600" />
            <div>
              <p className="text-sm font-semibold text-emerald-800">Lead converted</p>
              <p className="text-xs text-emerald-700">
                {lead.convertedToJobId ? `Converted to Job #${lead.convertedToJobId}` : `Converted to Project`}
              </p>
            </div>
          </div>
        )}
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
      <div className="rounded-xl overflow-hidden" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-subtle)", boxShadow: "var(--shadow-card)" }}>
        {tasks.length === 0 ? (
          <div className="py-12 text-center"><p className="text-sm" style={{ color: "var(--text-muted)" }}>No tasks yet</p></div>
        ) : tasks.map((task, i) => {
          const isOverdue   = task.status === "overdue";
          const isCompleted = task.status === "completed";
          return (
            <div key={task.id} className="flex items-center gap-3 px-4 py-3 hover:bg-[var(--bg-surface-2)] transition-colors"
              style={{ borderBottom: i < tasks.length - 1 ? "1px solid var(--border-subtle)" : "none" }}>
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
      <div className="rounded-xl p-4" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-subtle)", boxShadow: "var(--shadow-card)" }}>
        <textarea value={draft} onChange={e => setDraft(e.target.value)}
          placeholder="Add a note, log a call, or record a visit..."
          rows={3}
          className="w-full resize-none text-sm outline-none bg-transparent"
          style={{ color: "var(--text-primary)" }} />
        <div className="flex items-center justify-between mt-3 pt-3" style={{ borderTop: "1px solid var(--border-subtle)" }}>
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
              <div key={note.id} className="rounded-xl p-4" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-subtle)" }}>
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
  const [jobType, setJobType]   = useState("maintenance");
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
            style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-subtle)", boxShadow: "var(--shadow-card)" }}>
            <Briefcase className="w-6 h-6 mb-3" style={{ color: "#4f46e5" }} />
            <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Convert to Job</p>
            <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>A single unit of scheduled work assigned to a technician.</p>
          </button>
          <button onClick={() => setMode("project")}
            className="rounded-xl p-5 text-left transition-all hover:border-indigo-300"
            style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-subtle)", boxShadow: "var(--shadow-card)" }}>
            <FolderKanban className="w-6 h-6 mb-3" style={{ color: "#4f46e5" }} />
            <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Convert to Project</p>
            <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>A larger scope with multiple jobs, phases, or milestones.</p>
          </button>
        </div>
      )}

      {/* Job form */}
      {mode === "job" && (
        <div className="rounded-xl p-5 space-y-4" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-subtle)", boxShadow: "var(--shadow-card)" }}>
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
                options={["maintenance", "repair", "installation", "inspection", "replacement", "estimate", "other"].map(t => ({ value: t, label: t.charAt(0).toUpperCase() + t.slice(1) }))} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Scheduled Date</label>
              <input type="date" value={jobDate} onChange={e => setJobDate(e.target.value)}
                className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                style={{ border: "1px solid var(--border)", backgroundColor: "var(--bg-surface)", color: "var(--text-primary)" }} />
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
        <div className="rounded-xl p-5 space-y-4" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-subtle)", boxShadow: "var(--shadow-card)" }}>
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
const NOTE_TYPE_ICON: Record<LeadNoteType, { icon: typeof MessageSquare; color: string }> = {
  note:  { icon: MessageSquare, color: "#6366f1" },
  call:  { icon: Phone,         color: "#10b981" },
  email: { icon: Mail,          color: "#3b82f6" },
  visit: { icon: MapPin,        color: "#f59e0b" },
};

function LeadActivityTab({ id }: { id: string }) {
  const lead  = getLead(id)!;
  const notes = getLeadNotes(id);

  // Customer-level events filtered to ones relevant to this lead's context
  const customerEvents = lead.accountId
    ? getActivityEvents(lead.accountId).filter(e => {
        const cat = EVENT_FILTER_MAP[e.eventType];
        return cat === "notes" || cat === "communication" || cat === "all";
      }).slice(0, 5)
    : [];

  const hasAnything = notes.length > 0 || customerEvents.length > 0;

  return (
    <div className="space-y-5 max-w-2xl">
      {!hasAnything && (
        <div className="rounded-xl p-10 text-center"
          style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-subtle)" }}>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>No activity yet on this lead.</p>
        </div>
      )}

      {/* Lead notes as timeline */}
      {notes.length > 0 && (
        <div className="rounded-xl overflow-hidden"
          style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-subtle)", boxShadow: "var(--shadow-card)" }}>
          <div className="px-4 py-3" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
            <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Lead Activity</p>
          </div>
          {notes.map((note, i) => {
            const cfg = NOTE_TYPE_ICON[note.type];
            const Icon = cfg.icon;
            return (
              <div key={note.id}
                className="flex items-start gap-3 px-4 py-3"
                style={{ borderBottom: i < notes.length - 1 ? "1px solid var(--border-subtle)" : "none" }}>
                <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5"
                  style={{ backgroundColor: cfg.color + "20" }}>
                  <Icon className="w-3.5 h-3.5" style={{ color: cfg.color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>{note.user}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded capitalize"
                      style={{ backgroundColor: "var(--bg-input)", color: "var(--text-muted)" }}>{note.type}</span>
                    <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>{note.date}</span>
                  </div>
                  <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>{note.text}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Recent customer-level activity if account is linked */}
      {customerEvents.length > 0 && (
        <div className="rounded-xl overflow-hidden"
          style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-subtle)", boxShadow: "var(--shadow-card)" }}>
          <div className="flex items-center justify-between px-4 py-3"
            style={{ borderBottom: "1px solid var(--border-subtle)" }}>
            <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Recent Account Activity</p>
            <Link href={`/customers/${lead.accountId}`}
              className="text-xs font-medium" style={{ color: "#4f46e5", textDecoration: "none" }}>
              View full timeline →
            </Link>
          </div>
          {customerEvents.map((event, i) => (
            <div key={event.id}
              className="flex items-start gap-3 px-4 py-3"
              style={{ borderBottom: i < customerEvents.length - 1 ? "1px solid var(--border-subtle)" : "none" }}>
              <div className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center shrink-0 mt-0.5">
                <MessageSquare className="w-3 h-3 text-indigo-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm" style={{ color: "var(--text-secondary)" }}>{event.title}</p>
                <p className="text-[10px] mt-0.5" style={{ color: "var(--text-muted)" }}>{event.createdBy} · {event.displayDate}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Quotes tab ───────────────────────────────────────────
function LeadQuotesTab({ id }: { id: string }) {
  const [wizard, setWizard] = useState(false);
  const [, forceRefresh] = useState(0);
  const lead = getLead(id);
  const quotes = getQuotesForLead(id);

  return (
    <div className="rounded-xl overflow-hidden" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-subtle)", boxShadow: "var(--shadow-card)" }}>
      {wizard && (
        <QuoteWizard preset={{ customerId: lead?.accountId, leadId: id, lockCustomer: Boolean(lead?.accountId) }}
          onClose={() => setWizard(false)}
          onCreated={() => { setWizard(false); forceRefresh(n => n + 1); }} />
      )}
      <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
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
            style={{ borderBottom: i < quotes.length - 1 ? "1px solid var(--border-subtle)" : "none", textDecoration: "none" }}>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-mono font-medium" style={{ color: "var(--text-primary)" }}>{q.quoteNumber}</p>
              <p className="text-xs mt-0.5 truncate" style={{ color: "var(--text-muted)" }}>{q.title}</p>
            </div>
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0" style={{ backgroundColor: s.bg, color: s.color }}>{s.label}</span>
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
    <div className="rounded-xl p-10 text-center" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-subtle)" }}>
      <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{label}</p>
      <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>Coming in {phase}</p>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────
export default function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [tab, setTab] = useState("Overview");

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
      <div style={{ backgroundColor: "var(--bg-surface)", borderBottom: "1px solid var(--border-subtle)" }}>
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-4 min-w-0">
            <Link href="/leads" className="flex items-center gap-1.5 text-sm shrink-0" style={{ color: "var(--text-secondary)" }}>
              <ArrowLeft className="w-4 h-4" /> Leads
            </Link>
            <div className="w-px h-5 shrink-0" style={{ backgroundColor: "var(--border)" }} />
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 text-sm font-bold shrink-0">
                {lead.customerInitials}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>{lead.customerName}</h1>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                    style={{ backgroundColor: stageConfig.bg, color: stageConfig.color }}>
                    {stageConfig.label}
                  </span>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                    style={{ backgroundColor: "var(--bg-input)", color: "var(--text-secondary)" }}>
                    {LEAD_SOURCE_LABELS[lead.source]}
                  </span>
                  {lead.estimatedValue && (
                    <span className="text-[10px] font-semibold" style={{ color: "var(--text-primary)" }}>
                      {lead.estimatedValue}
                    </span>
                  )}
                </div>
                <p className="text-xs mt-0.5 truncate" style={{ color: "var(--text-muted)" }}>
                  {lead.title} · {lead.locationName}
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm"
              style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}>
              <Pencil className="w-3.5 h-3.5" /> Edit
            </button>
            <button onClick={() => setTab("Convert")}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-indigo-600 hover:bg-indigo-700 text-white transition-colors">
              <TrendingUp className="w-3.5 h-3.5" /> Convert
            </button>
          </div>
        </div>

        {/* Tab bar */}
        <div className="flex items-center gap-0.5 px-6 overflow-x-auto">
          {TABS.map(t => {
            const active = tab === t;
            return (
              <button key={t} onClick={() => setTab(t)}
                className="relative px-3 py-2.5 text-sm font-medium transition-colors whitespace-nowrap shrink-0"
                style={{ color: active ? "#4f46e5" : "var(--text-muted)" }}>
                {t}
                {active && <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-t bg-indigo-600" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto p-6" style={{ backgroundColor: "var(--bg-page)" }}>
        {tab === "Overview"       && <OverviewTab id={id} />}
        {tab === "Activity"       && <LeadActivityTab id={id} />}
        {tab === "Quotes"         && <LeadQuotesTab id={id} />}
        {tab === "Tasks"          && <TasksTab id={id} />}
        {tab === "Notes"          && <NotesTab id={id} />}
        {tab === "Photos & Files" && <StubTab label="Photos & Files" phase="Phase 3" />}
        {tab === "Communication"  && <StubTab label="Communication" phase="Phase 2" />}
        {tab === "Convert"        && <ConvertTab id={id} />}
      </div>
    </div>
  );
}
