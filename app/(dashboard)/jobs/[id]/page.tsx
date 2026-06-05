"use client";

import React, { use, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, CheckCircle, Circle, ChevronRight, Phone, MapPin, User, Clock, Calendar, DollarSign, Briefcase, AlertTriangle, Camera, ListChecks, Plus, Trash2, Ban, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { getJob, updateJob, deleteJob, getWorkOrder, getJobNotes, resolveJobStatus, type JobNoteType, type JobStatus } from "@/lib/jobs/data";
import UiSelect from "@/components/ui/Select";
import { getJobStatuses } from "@/lib/job-config/data";
import {
  suggestTemplateForJobType, getChecklist, getPhotos, getInstructions,
  CHECKLIST_TYPE_LABELS, type ChecklistItem as TemplateChecklistItem,
} from "@/lib/work-order-templates/data";
import { getProject } from "@/lib/projects/data";
import { getCustomer } from "@/lib/customers/data";
import { getQuotesForJob, getInvoicesForJob, createInvoiceFromJob, fmt } from "@/lib/quotes/data";
import { QUOTE_STATUS_STYLE, INVOICE_STATUS_STYLE } from "@/lib/quotes/types";
import PhotoGallery from "@/components/files/PhotoGallery";
import QuickCreateQuoteModal from "@/components/quotes/QuickCreateQuoteModal";

const TABS = ["Overview", "Work Order", "Checklist", "Photos & Files", "Notes", "Customer", "Invoice / Estimate", "History"];

const NOTE_COLORS: Record<JobNoteType, string> = { note: "#6366f1", call: "#10b981", email: "#3b82f6", visit: "#f59e0b" };

// ─── Overview tab ─────────────────────────────────────────
function OverviewTab({ jobId }: { jobId: string }) {
  const job     = getJob(jobId)!;
  const project = job.projectId ? getProject(job.projectId) : null;
  const wo      = getWorkOrder(jobId);
  const notes   = getJobNotes(jobId);
  const s       = resolveJobStatus(job.status, getJobStatuses().filter(st => st.active));

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
// Badge color per checklist item type
const CHECK_TYPE_BADGE: Record<string, { bg: string; color: string }> = {
  checkbox:   { bg: "var(--bg-input)", color: "var(--text-secondary)" },
  short_text: { bg: "#e0e7ff", color: "#3730a3" },
  long_text:  { bg: "#e0e7ff", color: "#3730a3" },
  number:     { bg: "#dbeafe", color: "#1e40af" },
  dropdown:   { bg: "#ede9fe", color: "#5b21b6" },
  photo:      { bg: "#eff6ff", color: "#2563eb" },
  signature:  { bg: "#fce7f3", color: "#9d174d" },
  datetime:   { bg: "#fef3c7", color: "#92400e" },
};

function WorkOrderTab({ jobId }: { jobId: string }) {
  const job = getJob(jobId)!;
  const template = suggestTemplateForJobType(job.type);

  if (!template) return <StubContent label="No work order template configured. Add one in Settings → Work Orders." />;

  const checklist    = getChecklist(template.id).filter(c => c.active);
  const photos       = getPhotos(template.id);
  const instructions = getInstructions(template.id);
  const requiredCount = checklist.filter(c => c.required).length;

  return (
    <div className="max-w-2xl space-y-4">
      {/* Template header */}
      <div className="rounded-xl p-6" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-subtle)", boxShadow: "var(--shadow-card)" }}>
        <div className="flex items-start justify-between mb-1">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: "var(--text-muted)" }}>Work Order Template</p>
            <h2 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>{template.name}</h2>
          </div>
          <span className="text-[10px] font-semibold px-2 py-1 rounded-full flex items-center gap-1"
            style={{ backgroundColor: "#e0e7ff", color: "#4f46e5" }}>
            <ListChecks className="w-3 h-3" /> Suggested by job type
          </span>
        </div>
        {template.description && (
          <p className="text-sm mt-2" style={{ color: "var(--text-secondary)" }}>{template.description}</p>
        )}
        <div className="flex flex-wrap gap-2 mt-3">
          <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ backgroundColor: "var(--bg-input)", color: "var(--text-muted)" }}>
            {checklist.length} checklist items
          </span>
          <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ backgroundColor: "var(--bg-input)", color: "var(--text-muted)" }}>
            {requiredCount} required
          </span>
          <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ backgroundColor: "var(--bg-input)", color: "var(--text-muted)" }}>
            {photos.length} photo rules
          </span>
        </div>
      </div>

      {/* Instructions */}
      {(instructions.internal || instructions.safety) && (
        <div className="rounded-xl p-5 space-y-4" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-subtle)", boxShadow: "var(--shadow-card)" }}>
          {instructions.internal && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest mb-1.5" style={{ color: "var(--text-muted)" }}>Field Instructions</p>
              <p className="text-sm leading-relaxed whitespace-pre-line" style={{ color: "var(--text-secondary)" }}>{instructions.internal}</p>
            </div>
          )}
          {instructions.safety && (
            <div className="rounded-lg px-3 py-2" style={{ backgroundColor: "#fffbeb", border: "1px solid #fde68a" }}>
              <p className="text-[10px] font-semibold uppercase tracking-widest mb-1 text-amber-700">Safety Notes</p>
              <p className="text-xs leading-relaxed text-amber-800 whitespace-pre-line">{instructions.safety}</p>
            </div>
          )}
        </div>
      )}

      {/* Checklist preview */}
      <div className="rounded-xl overflow-hidden" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-subtle)", boxShadow: "var(--shadow-card)" }}>
        <div className="px-4 py-3" style={{ borderBottom: "1px solid var(--border-subtle)", backgroundColor: "var(--bg-surface-2)" }}>
          <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Checklist</p>
        </div>
        {checklist.length === 0 ? (
          <div className="px-4 py-6 text-center"><p className="text-sm" style={{ color: "var(--text-muted)" }}>No checklist items on this template.</p></div>
        ) : checklist.map((c, i) => {
          const badge = CHECK_TYPE_BADGE[c.type] ?? CHECK_TYPE_BADGE.checkbox;
          return (
            <div key={c.id} className="flex items-center gap-3 px-4 py-2.5"
              style={{ borderBottom: i < checklist.length - 1 ? "1px solid var(--border-subtle)" : "none" }}>
              <Circle className="w-4 h-4 shrink-0" style={{ color: "var(--border)" }} />
              <span className="text-sm flex-1" style={{ color: "var(--text-primary)" }}>{c.label}</span>
              {c.required && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ backgroundColor: "#fee2e2", color: "#991b1b" }}>Required</span>}
              <span className="text-[9px] font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: badge.bg, color: badge.color }}>{CHECKLIST_TYPE_LABELS[c.type]}</span>
            </div>
          );
        })}
      </div>

      {/* Required photos */}
      <div className="rounded-xl overflow-hidden" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-subtle)", boxShadow: "var(--shadow-card)" }}>
        <div className="flex items-center gap-2 px-4 py-3" style={{ borderBottom: "1px solid var(--border-subtle)", backgroundColor: "var(--bg-surface-2)" }}>
          <Camera className="w-4 h-4" style={{ color: "#2563eb" }} />
          <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Required Photos</p>
        </div>
        {photos.length === 0 ? (
          <div className="px-4 py-6 text-center"><p className="text-sm" style={{ color: "var(--text-muted)" }}>No required photo rules on this template.</p></div>
        ) : photos.map((p, i) => (
          <div key={p.id} className="flex items-center gap-3 px-4 py-2.5"
            style={{ borderBottom: i < photos.length - 1 ? "1px solid var(--border-subtle)" : "none" }}>
            <Camera className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--text-muted)" }} />
            <span className="text-sm flex-1" style={{ color: "var(--text-primary)" }}>{p.category}</span>
            {p.notes && <span className="text-[11px] truncate max-w-48" style={{ color: "var(--text-muted)" }}>{p.notes}</span>}
            <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>min {p.minCount}</span>
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded"
              style={{ backgroundColor: p.required ? "#fee2e2" : "var(--bg-input)", color: p.required ? "#991b1b" : "var(--text-muted)" }}>
              {p.required ? "Required" : "Optional"}
            </span>
          </div>
        ))}
      </div>

      {/* Materials & completion */}
      {(instructions.materials || instructions.completion || instructions.customerFacing) && (
        <div className="grid grid-cols-2 gap-4">
          {instructions.materials && (
            <div className="rounded-xl p-4" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-subtle)", boxShadow: "var(--shadow-card)" }}>
              <p className="text-[10px] font-semibold uppercase tracking-widest mb-1.5" style={{ color: "var(--text-muted)" }}>Materials / Notes</p>
              <p className="text-xs leading-relaxed whitespace-pre-line" style={{ color: "var(--text-secondary)" }}>{instructions.materials}</p>
            </div>
          )}
          {instructions.completion && (
            <div className="rounded-xl p-4" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-subtle)", boxShadow: "var(--shadow-card)" }}>
              <p className="text-[10px] font-semibold uppercase tracking-widest mb-1.5" style={{ color: "var(--text-muted)" }}>Completion Requirements</p>
              <p className="text-xs leading-relaxed whitespace-pre-line" style={{ color: "var(--text-secondary)" }}>{instructions.completion}</p>
            </div>
          )}
          {instructions.customerFacing && (
            <div className="rounded-xl p-4" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-subtle)", boxShadow: "var(--shadow-card)" }}>
              <p className="text-[10px] font-semibold uppercase tracking-widest mb-1.5" style={{ color: "var(--text-muted)" }}>Customer-Facing Notes</p>
              <p className="text-xs leading-relaxed whitespace-pre-line" style={{ color: "var(--text-secondary)" }}>{instructions.customerFacing}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Checklist tab — interactive, driven by the template ──
function ChecklistTab({ jobId }: { jobId: string }) {
  const job = getJob(jobId)!;
  const template = suggestTemplateForJobType(job.type);
  const templateItems: TemplateChecklistItem[] = template ? getChecklist(template.id).filter(c => c.active) : [];

  // Local execution state for this job's work order instance.
  const [done, setDone] = useState<Record<string, boolean>>({});

  if (!template || templateItems.length === 0) {
    return <StubContent label="No checklist configured for this job type. Add items in Settings → Work Orders → Checklists." />;
  }

  function toggle(id: string) { setDone(prev => ({ ...prev, [id]: !prev[id] })); }

  // Only checkbox/photo/signature items are "completable"; others are data fields.
  const completable = templateItems.filter(c => ["checkbox", "photo", "signature"].includes(c.type));
  const doneCount = completable.filter(c => done[c.id]).length;
  const pct = completable.length > 0 ? Math.round((doneCount / completable.length) * 100) : 0;

  return (
    <div className="max-w-xl space-y-4">
      {/* Progress */}
      <div className="rounded-xl p-4" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-subtle)" }}>
        <div className="flex items-center justify-between mb-1">
          <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{doneCount} of {completable.length} complete</span>
          <span className="text-sm font-bold" style={{ color: pct === 100 ? "#10b981" : "#4f46e5" }}>{pct}%</span>
        </div>
        <p className="text-[10px] mb-2" style={{ color: "var(--text-muted)" }}>Template: {template.name}</p>
        <div className="h-2 rounded-full" style={{ backgroundColor: "var(--bg-input)" }}>
          <div className="h-2 rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: pct === 100 ? "#10b981" : "#4f46e5" }} />
        </div>
      </div>

      {/* Items rendered by type */}
      <div className="rounded-xl overflow-hidden" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-subtle)", boxShadow: "var(--shadow-card)" }}>
        {templateItems.map((item, i) => {
          const isCompletable = ["checkbox", "photo", "signature"].includes(item.type);
          const checked = done[item.id];
          const border = i < templateItems.length - 1 ? { borderBottom: "1px solid var(--border-subtle)" } : undefined;
          const badge = CHECK_TYPE_BADGE[item.type] ?? CHECK_TYPE_BADGE.checkbox;

          if (isCompletable) {
            return (
              <button key={item.id} onClick={() => toggle(item.id)}
                className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-[var(--bg-surface-2)]" style={border}>
                {checked
                  ? <CheckCircle className="w-5 h-5 shrink-0 text-emerald-500" />
                  : <Circle className="w-5 h-5 shrink-0" style={{ color: "var(--border)" }} />}
                <span className={cn("text-sm flex-1", checked ? "line-through" : "")}
                  style={{ color: checked ? "var(--text-muted)" : "var(--text-primary)" }}>{item.label}</span>
                {item.required && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ backgroundColor: "#fee2e2", color: "#991b1b" }}>Required</span>}
                <span className="text-[9px] font-semibold px-2 py-0.5 rounded-full shrink-0" style={{ backgroundColor: badge.bg, color: badge.color }}>{CHECKLIST_TYPE_LABELS[item.type]}</span>
              </button>
            );
          }
          // Data-entry items (text/number/dropdown/datetime) shown as labeled inputs
          return (
            <div key={item.id} className="px-4 py-3" style={border}>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{item.label}</span>
                {item.required && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ backgroundColor: "#fee2e2", color: "#991b1b" }}>Required</span>}
                <span className="text-[9px] font-semibold px-2 py-0.5 rounded-full ml-auto" style={{ backgroundColor: badge.bg, color: badge.color }}>{CHECKLIST_TYPE_LABELS[item.type]}</span>
              </div>
              {item.type === "long_text" ? (
                <textarea rows={2} placeholder="Enter…" className="w-full rounded-lg px-3 py-1.5 text-sm outline-none resize-none"
                  style={{ border: "1px solid var(--border)", backgroundColor: "var(--bg-surface-2)", color: "var(--text-primary)" }} />
              ) : (
                <input type={item.type === "number" ? "number" : item.type === "datetime" ? "datetime-local" : "text"} placeholder="Enter…"
                  className="w-full rounded-lg px-3 py-1.5 text-sm outline-none"
                  style={{ border: "1px solid var(--border)", backgroundColor: "var(--bg-surface-2)", color: "var(--text-primary)" }} />
              )}
            </div>
          );
        })}
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

// ─── Job financials tab ───────────────────────────────────
function JobFinancialsTab({ jobId }: { jobId: string }) {
  const router = useRouter();
  const [wizard, setWizard] = useState(false);
  const [, forceRefresh] = useState(0);
  const job      = getJob(jobId);
  const quotes   = getQuotesForJob(jobId);
  const invoices = getInvoicesForJob(jobId);

  function makeInvoice() {
    const inv = createInvoiceFromJob(jobId);
    if (inv) router.push(`/invoices/${inv.id}`);
  }

  function Section({ title, onNew, newLabel = "New Quote", children }: { title: string; onNew?: () => void; newLabel?: string; children: React.ReactNode }) {
    return (
      <div className="rounded-xl overflow-hidden" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-subtle)", boxShadow: "var(--shadow-card)" }}>
        <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
          <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{title}</p>
          {onNew && (
            <button onClick={onNew} className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg"
              style={{ backgroundColor: "#4f46e5", color: "#fff" }}>
              <Plus className="w-3.5 h-3.5" /> {newLabel}
            </button>
          )}
        </div>
        {children}
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      {wizard && job && (
        <QuickCreateQuoteModal preset={{ customerId: job.accountId, jobId, lockCustomer: true }}
          onClose={() => setWizard(false)}
          onContinue={(qid) => { setWizard(false); router.push(`/quotes/${qid}/builder`); }} />
      )}
      <Section title={`Quotes (${quotes.length})`} onNew={() => setWizard(true)}>
        {quotes.length === 0 ? (
          <div className="px-4 py-8 text-center"><p className="text-sm" style={{ color: "var(--text-muted)" }}>No quotes for this job</p></div>
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
              <span className="text-sm font-semibold shrink-0" style={{ color: "var(--text-primary)" }}>{q.total > 0 ? fmt(q.total) : "TBD"}</span>
              <ChevronRight className="w-4 h-4 shrink-0" style={{ color: "var(--text-muted)" }} />
            </Link>
          );
        })}
      </Section>

      <Section title={`Invoices (${invoices.length})`} onNew={makeInvoice} newLabel="Create Invoice">
        {invoices.length === 0 ? (
          <div className="px-4 py-8 text-center"><p className="text-sm" style={{ color: "var(--text-muted)" }}>No invoices for this job</p></div>
        ) : invoices.map((inv, i) => {
          const s = INVOICE_STATUS_STYLE[inv.status];
          return (
            <Link key={inv.id} href={`/invoices/${inv.id}`}
              className="flex items-center gap-4 px-4 py-3 hover:bg-[var(--bg-surface-2)] transition-colors"
              style={{ borderBottom: i < invoices.length - 1 ? "1px solid var(--border-subtle)" : "none", textDecoration: "none" }}>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-mono font-medium" style={{ color: "var(--text-primary)" }}>{inv.invoiceNumber}</p>
                <p className="text-xs mt-0.5 truncate" style={{ color: "var(--text-muted)" }}>{inv.title}</p>
              </div>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0" style={{ backgroundColor: s.bg, color: s.color }}>{s.label}</span>
              <div className="text-right shrink-0">
                <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{fmt(inv.total)}</p>
                {inv.balanceDue > 0 && <p className="text-[10px]" style={{ color: inv.status === "past_due" ? "#dc2626" : "var(--text-muted)" }}>{fmt(inv.balanceDue)} due</p>}
              </div>
              <ChevronRight className="w-4 h-4 shrink-0" style={{ color: "var(--text-muted)" }} />
            </Link>
          );
        })}
      </Section>
    </div>
  );
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
  const router    = useRouter();
  const [tab, setTab] = useState("Overview");
  const [job, setJob] = useState(() => getJob(id));
  const [confirmDelete, setConfirmDelete] = useState(false);
  const refresh = () => setJob(getJob(id));

  function changeStatus(next: string) {
    const patch: { status: JobStatus; completedDate?: string } = { status: next as JobStatus };
    if (next === "completed") patch.completedDate = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    updateJob(id, patch);
    refresh();
  }

  // Cancel = reversible. Reactivate clears the schedule so it returns to the
  // dispatch queue (unscheduled) ready to re-book. Delete = permanent.
  function cancelJob()     { updateJob(id, { status: "canceled" }); refresh(); }
  function reactivateJob() { updateJob(id, { status: "new", scheduledDate: "", scheduledTime: "", assignedTo: "", assignedToInitials: "" }); refresh(); }
  function doDelete()      { deleteJob(id); router.push("/jobs"); }

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

  const s       = resolveJobStatus(job.status, getJobStatuses().filter(st => st.active));
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
            <div className="w-44">
              <UiSelect size="sm" value={job.status} onChange={changeStatus}
                options={getJobStatuses().filter(st => st.active).map(st => ({ value: st.key, label: st.name }))} />
            </div>
            {job.status === "canceled" ? (
              <button onClick={reactivateJob}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-indigo-600 hover:bg-indigo-700 text-white transition-colors">
                <RotateCcw className="w-3.5 h-3.5" /> Reactivate
              </button>
            ) : (
              <>
                {job.status !== "completed" && (
                  <button onClick={() => changeStatus("completed")}
                    className="px-3 py-1.5 rounded-lg text-sm font-medium bg-indigo-600 hover:bg-indigo-700 text-white transition-colors">
                    Mark Complete
                  </button>
                )}
                {job.status !== "completed" && (
                  <button onClick={cancelJob}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
                    style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}>
                    <Ban className="w-3.5 h-3.5" /> Cancel
                  </button>
                )}
              </>
            )}
            <button onClick={() => setConfirmDelete(true)} title="Delete job permanently"
              className="p-2 rounded-lg transition-colors hover:bg-red-50"
              style={{ color: "#dc2626", border: "1px solid var(--border)" }}>
              <Trash2 className="w-4 h-4" />
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
        {tab === "Photos & Files"    && <PhotoGallery recordLevel="job" scope={{ accountId: job.accountId, jobId: id, projectId: job.projectId }} accountName={job.customerName} />}
        {tab === "Invoice / Estimate"&& <JobFinancialsTab jobId={id} />}
        {tab === "History"           && <StubTab label="History" />}
      </div>

      {/* Delete confirmation */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setConfirmDelete(false)}>
          <div className="w-full max-w-sm rounded-2xl p-6" onClick={e => e.stopPropagation()}
            style={{ backgroundColor: "var(--bg-surface)", boxShadow: "0 16px 48px rgba(0,0,0,0.24)" }}>
            <div className="flex items-center gap-2.5 mb-2">
              <div className="w-9 h-9 rounded-full flex items-center justify-center" style={{ backgroundColor: "#fee2e2" }}>
                <Trash2 className="w-4 h-4 text-red-600" />
              </div>
              <p className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>Delete this job?</p>
            </div>
            <p className="text-sm mb-5" style={{ color: "var(--text-secondary)" }}>
              &ldquo;{job.title}&rdquo; will be permanently removed — this can&apos;t be undone. To keep a record, use <span className="font-medium">Cancel</span> instead.
            </p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setConfirmDelete(false)} className="px-3 py-2 rounded-lg text-sm"
                style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}>Keep job</button>
              <button onClick={doDelete} className="px-4 py-2 rounded-lg text-sm font-medium text-white" style={{ backgroundColor: "#dc2626" }}>
                Delete permanently
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
