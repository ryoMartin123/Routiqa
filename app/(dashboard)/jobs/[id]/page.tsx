"use client";

import { use, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Pencil, CheckCircle, Circle, ChevronRight, Phone, MapPin, User, Clock, Calendar, DollarSign, Briefcase, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { getJob, getWorkOrder, getJobNotes, JOB_STATUS_CONFIG, type JobNoteType } from "@/lib/jobs/data";
import { getProject } from "@/lib/projects/data";
import { getCustomer } from "@/lib/customers/data";

const TABS = ["Overview", "Work Order", "Checklist", "Photos & Files", "Notes", "Customer", "Invoice / Estimate", "History"];

const NOTE_COLORS: Record<JobNoteType, string> = { note: "#6366f1", call: "#10b981", email: "#3b82f6", visit: "#f59e0b" };

// ─── Overview tab ─────────────────────────────────────────
function OverviewTab({ jobId }: { jobId: string }) {
  const job     = getJob(jobId)!;
  const project = job.projectId ? getProject(job.projectId) : null;
  const wo      = getWorkOrder(jobId);
  const notes   = getJobNotes(jobId);
  const s       = JOB_STATUS_CONFIG[job.status];

  const doneItems  = wo?.checklist.filter(i => i.isComplete).length ?? 0;
  const totalItems = wo?.checklist.length ?? 0;
  const pct        = totalItems > 0 ? Math.round((doneItems / totalItems) * 100) : 0;

  return (
    <div className="grid grid-cols-3 gap-6">
      {/* Left: job details */}
      <div className="space-y-4">
        <Card title="Job Details">
          <div className="space-y-2.5">
            <InfoRow icon={Briefcase}  label="Type"        value={job.type.charAt(0).toUpperCase() + job.type.slice(1)} />
            <InfoRow icon={Calendar}   label="Scheduled"   value={`${job.scheduledDate} at ${job.scheduledTime}`} />
            <InfoRow icon={Clock}      label="Duration"    value={`${job.durationMinutes} minutes`} />
            <InfoRow icon={User}       label="Assigned To" value={job.assignedTo} />
            {job.propertyAddress && <InfoRow icon={MapPin} label="Address" value={job.propertyAddress} />}
            {job.priority === "urgent" && (
              <div className="flex items-center gap-2 mt-1 px-3 py-2 rounded-lg" style={{ backgroundColor: "#fee2e2" }}>
                <AlertTriangle className="w-4 h-4 text-red-600" />
                <span className="text-sm font-semibold text-red-700">Urgent Priority</span>
              </div>
            )}
          </div>
        </Card>

        {project && (
          <Card title="Part of Project">
            <Link href={`/projects/${project.id}`} className="flex items-center justify-between group">
              <div>
                <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{project.name}</p>
                <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{project.status} · {project.jobIds.length} jobs</p>
              </div>
              <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" style={{ color: "var(--text-muted)" }} />
            </Link>
          </Card>
        )}

        {(job.estimatedAmount || job.actualAmount) && (
          <Card title="Amount">
            <div className="space-y-2">
              {job.estimatedAmount && (
                <div className="flex justify-between">
                  <span className="text-xs" style={{ color: "var(--text-muted)" }}>Estimated</span>
                  <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{job.estimatedAmount}</span>
                </div>
              )}
              {job.actualAmount && (
                <div className="flex justify-between">
                  <span className="text-xs" style={{ color: "var(--text-muted)" }}>Actual</span>
                  <span className="text-sm font-semibold text-emerald-600">{job.actualAmount}</span>
                </div>
              )}
            </div>
          </Card>
        )}
      </div>

      {/* Right: work order + checklist + notes */}
      <div className="col-span-2 space-y-4">
        {/* Checklist progress */}
        {wo && totalItems > 0 && (
          <div className="rounded-xl p-4" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-subtle)", boxShadow: "var(--shadow-card)" }}>
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Checklist Progress</p>
              <span className="text-sm font-bold" style={{ color: pct === 100 ? "#10b981" : "var(--text-secondary)" }}>{pct}% · {doneItems}/{totalItems}</span>
            </div>
            <div className="h-2 rounded-full" style={{ backgroundColor: "var(--bg-input)" }}>
              <div className="h-2 rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: pct === 100 ? "#10b981" : "#4f46e5" }} />
            </div>
            <div className="mt-3 space-y-1.5">
              {wo.checklist.slice(0, 5).map(item => (
                <div key={item.id} className="flex items-center gap-2">
                  {item.isComplete
                    ? <CheckCircle className="w-3.5 h-3.5 shrink-0 text-emerald-500" />
                    : <Circle      className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--text-muted)" }} />}
                  <span className="text-xs" style={{ color: item.isComplete ? "var(--text-muted)" : "var(--text-primary)", textDecoration: item.isComplete ? "line-through" : "none" }}>
                    {item.label}
                  </span>
                </div>
              ))}
              {wo.checklist.length > 5 && (
                <p className="text-xs pl-5" style={{ color: "var(--text-muted)" }}>+{wo.checklist.length - 5} more items</p>
              )}
            </div>
          </div>
        )}

        {/* Work order summary */}
        {wo && (
          <div className="rounded-xl p-4" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-subtle)", boxShadow: "var(--shadow-card)" }}>
            <p className="text-sm font-semibold mb-2" style={{ color: "var(--text-primary)" }}>Work Order</p>
            <p className="text-sm font-medium mb-2" style={{ color: "var(--text-secondary)" }}>{wo.title}</p>
            <p className="text-xs leading-relaxed whitespace-pre-line" style={{ color: "var(--text-muted)" }}>
              {wo.instructions.split("\n\n")[0]}
            </p>
          </div>
        )}

        {/* Recent notes */}
        {notes.length > 0 && (
          <div className="rounded-xl overflow-hidden" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-subtle)", boxShadow: "var(--shadow-card)" }}>
            <div className="px-4 py-3" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
              <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Notes</p>
            </div>
            {notes.map((note, i) => (
              <div key={note.id} className="flex items-start gap-3 px-4 py-3"
                style={i < notes.length - 1 ? { borderBottom: "1px solid var(--border-subtle)" } : undefined}>
                <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-[9px] font-bold text-white mt-0.5"
                  style={{ backgroundColor: NOTE_COLORS[note.type] }}>
                  {note.userInitials}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm" style={{ color: "var(--text-secondary)" }}>{note.text}</p>
                  <p className="text-[10px] mt-0.5" style={{ color: "var(--text-muted)" }}>{note.user} · {note.date}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Work Order tab ───────────────────────────────────────
function WorkOrderTab({ jobId }: { jobId: string }) {
  const wo = getWorkOrder(jobId);
  if (!wo) return <StubContent label="No work order created for this job." />;
  const doneItems  = wo.checklist.filter(i => i.isComplete).length;
  const pct = wo.checklist.length > 0 ? Math.round((doneItems / wo.checklist.length) * 100) : 0;

  return (
    <div className="max-w-2xl space-y-4">
      <div className="rounded-xl p-6" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-subtle)", boxShadow: "var(--shadow-card)" }}>
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: "var(--text-muted)" }}>Work Order</p>
            <h2 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>{wo.title}</h2>
          </div>
          <span className="text-[10px] font-semibold px-2 py-1 rounded-full"
            style={{ backgroundColor: wo.status === "completed" ? "#d1fae5" : wo.status === "in_progress" ? "#dbeafe" : "var(--bg-input)", color: wo.status === "completed" ? "#065f46" : wo.status === "in_progress" ? "#1e40af" : "var(--text-muted)" }}>
            {wo.status.replace("_", " ")}
          </span>
        </div>
        <div className="mb-4">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>Checklist completion</span>
            <span className="text-xs font-bold" style={{ color: pct === 100 ? "#10b981" : "var(--text-secondary)" }}>{pct}%</span>
          </div>
          <div className="h-1.5 rounded-full" style={{ backgroundColor: "var(--bg-input)" }}>
            <div className="h-1.5 rounded-full" style={{ width: `${pct}%`, backgroundColor: pct === 100 ? "#10b981" : "#4f46e5" }} />
          </div>
        </div>
        <div className="pt-4" style={{ borderTop: "1px solid var(--border-subtle)" }}>
          <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: "var(--text-muted)" }}>Instructions</p>
          <p className="text-sm leading-relaxed whitespace-pre-line" style={{ color: "var(--text-secondary)" }}>{wo.instructions}</p>
        </div>
      </div>
    </div>
  );
}

// ─── Checklist tab ────────────────────────────────────────
function ChecklistTab({ jobId }: { jobId: string }) {
  const wo = getWorkOrder(jobId);
  const [items, setItems] = useState(wo?.checklist ?? []);

  if (!wo) return <StubContent label="No checklist for this job." />;

  function toggle(id: string) {
    setItems(prev => prev.map(item =>
      item.id === id ? { ...item, isComplete: !item.isComplete, completedBy: !item.isComplete ? "Marcus Reyes" : undefined } : item
    ));
  }

  const done = items.filter(i => i.isComplete).length;
  const pct  = items.length > 0 ? Math.round((done / items.length) * 100) : 0;

  return (
    <div className="max-w-xl space-y-4">
      {/* Progress */}
      <div className="rounded-xl p-4" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-subtle)" }}>
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{done} of {items.length} complete</span>
          <span className="text-sm font-bold" style={{ color: pct === 100 ? "#10b981" : "#4f46e5" }}>{pct}%</span>
        </div>
        <div className="h-2 rounded-full" style={{ backgroundColor: "var(--bg-input)" }}>
          <div className="h-2 rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: pct === 100 ? "#10b981" : "#4f46e5" }} />
        </div>
      </div>

      {/* Items */}
      <div className="rounded-xl overflow-hidden" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-subtle)", boxShadow: "var(--shadow-card)" }}>
        {items.map((item, i) => (
          <button
            key={item.id}
            onClick={() => toggle(item.id)}
            className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-[var(--bg-surface-2)]"
            style={i < items.length - 1 ? { borderBottom: "1px solid var(--border-subtle)" } : undefined}
          >
            {item.isComplete
              ? <CheckCircle className="w-5 h-5 shrink-0 text-emerald-500" />
              : <Circle      className="w-5 h-5 shrink-0" style={{ color: "var(--border)" }} />}
            <div className="flex-1 min-w-0">
              <span className={cn("text-sm", item.isComplete ? "line-through" : "")}
                style={{ color: item.isComplete ? "var(--text-muted)" : "var(--text-primary)" }}>
                {item.label}
              </span>
              {item.completedBy && (
                <p className="text-[10px] mt-0.5" style={{ color: "var(--text-muted)" }}>✓ {item.completedBy}</p>
              )}
            </div>
            <span className="text-[10px] shrink-0" style={{ color: "var(--text-muted)" }}>#{item.sortOrder}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Notes tab ────────────────────────────────────────────
function NotesTab({ jobId }: { jobId: string }) {
  const [draft, setDraft] = useState("");
  const notes = getJobNotes(jobId);

  return (
    <div className="max-w-2xl space-y-4">
      <div className="rounded-xl p-4" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-subtle)" }}>
        <textarea value={draft} onChange={e => setDraft(e.target.value)}
          placeholder="Add a note..." rows={3}
          className="w-full resize-none text-sm outline-none bg-transparent"
          style={{ color: "var(--text-primary)" }} />
        <div className="flex justify-end mt-3 pt-3" style={{ borderTop: "1px solid var(--border-subtle)" }}>
          <button disabled={!draft.trim()}
            className="px-3 py-1.5 rounded-lg text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 transition-colors">
            Save Note
          </button>
        </div>
      </div>
      {notes.length === 0
        ? <p className="text-sm text-center py-8" style={{ color: "var(--text-muted)" }}>No notes yet</p>
        : notes.map(note => (
          <div key={note.id} className="rounded-xl p-4" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-subtle)" }}>
            <div className="flex items-start gap-3">
              <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold text-white"
                style={{ backgroundColor: NOTE_COLORS[note.type] }}>
                {note.userInitials}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>{note.user}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded capitalize" style={{ backgroundColor: "var(--bg-input)", color: "var(--text-muted)" }}>{note.type}</span>
                  <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>{note.date}</span>
                </div>
                <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>{note.text}</p>
              </div>
            </div>
          </div>
        ))
      }
    </div>
  );
}

// ─── Customer tab ─────────────────────────────────────────
function CustomerTab({ jobId }: { jobId: string }) {
  const job      = getJob(jobId)!;
  const customer = getCustomer(job.accountId);
  if (!customer) return <StubContent label="Customer record not found." />;
  return (
    <div className="max-w-sm">
      <div className="rounded-xl p-5" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-subtle)", boxShadow: "var(--shadow-card)" }}>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-indigo-600 flex items-center justify-center text-white text-sm font-bold">{customer.initials}</div>
          <div>
            <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{customer.name}</p>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>{customer.locationName}</p>
          </div>
        </div>
        <div className="space-y-2.5">
          <InfoRow icon={Phone} label="Phone" value={customer.phone} />
          {customer.email && <InfoRow icon={Phone} label="Email" value={customer.email} />}
          <InfoRow icon={MapPin} label="Address" value={`${customer.address}, ${customer.city}, ${customer.state}`} />
        </div>
        <div className="mt-4 pt-4" style={{ borderTop: "1px solid var(--border-subtle)" }}>
          <Link href={`/customers/${customer.id}`} className="flex items-center justify-between text-sm font-medium text-indigo-600 hover:text-indigo-700">
            Open customer record <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}

// ─── Stub content ─────────────────────────────────────────
function StubContent({ label }: { label: string }) {
  return (
    <div className="rounded-xl p-10 text-center" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-subtle)" }}>
      <p className="text-sm" style={{ color: "var(--text-muted)" }}>{label}</p>
    </div>
  );
}
function StubTab({ label }: { label: string }) {
  return <div className="rounded-xl p-10 text-center" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-subtle)" }}><p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{label}</p><p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>Coming soon</p></div>;
}

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
    <div className="flex items-start gap-2.5">
      <Icon className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: "var(--text-muted)" }} />
      <div className="min-w-0">
        <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>{label}</p>
        <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{value}</p>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────
export default function JobDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id }    = use(params);
  const [tab, setTab] = useState("Overview");

  const job = getJob(id);
  if (!job) {
    return (
      <div className="p-6">
        <Link href="/jobs" className="flex items-center gap-1.5 text-sm mb-4" style={{ color: "var(--text-secondary)" }}>
          <ArrowLeft className="w-4 h-4" /> Back to Jobs
        </Link>
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>Job not found.</p>
      </div>
    );
  }

  const s       = JOB_STATUS_CONFIG[job.status];
  const project = job.projectId ? getProject(job.projectId) : null;

  return (
    <div className="flex flex-col h-full">
      <div style={{ backgroundColor: "var(--bg-surface)", borderBottom: "1px solid var(--border-subtle)" }}>
        {/* Top row */}
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-4 min-w-0">
            <Link href="/jobs" className="flex items-center gap-1.5 text-sm shrink-0" style={{ color: "var(--text-secondary)" }}>
              <ArrowLeft className="w-4 h-4" /> Jobs
            </Link>
            {project && (
              <>
                <span style={{ color: "var(--text-muted)" }}>›</span>
                <Link href={`/projects/${project.id}`} className="text-sm shrink-0 truncate max-w-[160px]" style={{ color: "var(--text-secondary)" }}>{project.name}</Link>
              </>
            )}
            <div className="w-px h-5 shrink-0" style={{ backgroundColor: "var(--border)" }} />
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>{job.title}</h1>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: s.bg, color: s.color }}>{s.label}</span>
              </div>
              <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{job.customerName} · {job.scheduledDate} at {job.scheduledTime}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm" style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}>
              <Pencil className="w-3.5 h-3.5" /> Edit
            </button>
            <button className="px-3 py-1.5 rounded-lg text-sm font-medium bg-indigo-600 hover:bg-indigo-700 text-white transition-colors">
              Mark Complete
            </button>
          </div>
        </div>
        {/* Tabs */}
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

      <div className="flex-1 overflow-y-auto p-6" style={{ backgroundColor: "var(--bg-page)" }}>
        {tab === "Overview"          && <OverviewTab  jobId={id} />}
        {tab === "Work Order"        && <WorkOrderTab jobId={id} />}
        {tab === "Checklist"         && <ChecklistTab jobId={id} />}
        {tab === "Notes"             && <NotesTab     jobId={id} />}
        {tab === "Customer"          && <CustomerTab  jobId={id} />}
        {tab === "Photos & Files"    && <StubTab label="Photos & Files" />}
        {tab === "Invoice / Estimate"&& <StubTab label="Invoice / Estimate" />}
        {tab === "History"           && <StubTab label="History" />}
      </div>
    </div>
  );
}
