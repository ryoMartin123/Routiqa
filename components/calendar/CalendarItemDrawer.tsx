"use client";

import Link from "next/link";
import {
  X, Clock, MapPin, CheckCircle, Circle, ChevronRight, Briefcase,
  CalendarClock, User, Tag, AlertTriangle, FileText, MessageSquare,
} from "lucide-react";
import Select from "@/components/ui/Select";
import StatusBadge from "@/components/shared/StatusBadge";
import { getWorkOrder } from "@/lib/jobs/data";
import {
  LAYER_CONFIG, PRIORITY_CONFIG, type CalendarItem, type UnscheduledItem,
} from "@/lib/calendar/types";
import { useComments } from "@/components/providers/CommentsProvider";
import { commentCountForAnchorKey, anchorKey, type CommentAnchor, type AnchorRecordType } from "@/lib/comments/data";

// Map a dispatch item's source to a comment anchor. Jobs/quotes/agreements/
// projects pin to their record (so the thread also shows on that record's page);
// anything else stays dispatch-scoped.
const MOD_TO_TYPE: Record<string, AnchorRecordType> = {
  jobs: "job", quotes: "quote", agreements: "agreement", projects: "project",
};
function itemAnchor(item: CalendarItem | UnscheduledItem): CommentAnchor {
  return {
    recordType: MOD_TO_TYPE[item.sourceModule] ?? "dispatch",
    recordId:   item.sourceId,
    recordLabel: item.customerName ?? item.title,
  };
}

function fmtTime(d: Date): string { return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }); }
function fmtDate(d: Date): string { return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }); }
function fmtDuration(min: number): string { return min >= 60 ? `${Math.floor(min / 60)}h${min % 60 ? ` ${min % 60}m` : ""}` : `${min}m`; }

function recordHref(mod: string, id: string): string | null {
  switch (mod) {
    case "jobs":       return `/jobs/${id}`;
    case "agreements": return `/agreements/${id}`;
    case "projects":   return `/projects/${id}`;
    case "quotes":     return `/quotes/${id}`;
    case "tasks":      return `/tasks`;
    default:           return null;
  }
}

export default function CalendarItemDrawer({
  scheduled, unscheduled, technicians, onClose, onReassign, onSchedule,
}: {
  scheduled?: CalendarItem;
  unscheduled?: UnscheduledItem;
  technicians: string[];
  onClose: () => void;
  onReassign?: (tech: string) => void;
  onSchedule?: () => void;
}) {
  const item = scheduled ?? unscheduled!;
  const cfg = LAYER_CONFIG[item.type];
  const isScheduled = !!scheduled;
  const href = recordHref(item.sourceModule, item.sourceId);

  const { openComposer } = useComments();
  const anchor = itemAnchor(item);
  const commentCount = commentCountForAnchorKey(anchorKey(anchor));
  // Close this drawer and open the comments drawer for the item's anchor.
  function openComments() { onClose(); openComposer(anchor); }

  // Work order summary (scheduled jobs only)
  const wo = isScheduled && scheduled!.sourceModule === "jobs" && scheduled!.type === "job"
    ? getWorkOrder(scheduled!.sourceId) : undefined;
  const done = wo?.checklist.filter(c => c.isComplete).length ?? 0;
  const total = wo?.checklist.length ?? 0;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  const priority = scheduled?.priority ?? unscheduled?.priority;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 z-50 flex flex-col w-[440px] max-w-full"
        style={{ backgroundColor: "var(--bg-surface)", borderLeft: "1px solid var(--border-subtle)", boxShadow: "-4px 0 24px rgba(0,0,0,0.18)" }}>

        {/* Header */}
        <div className="flex items-start justify-between gap-3 px-5 py-4 shrink-0" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
              <StatusBadge label={cfg.label} color={cfg.color} />
              {priority && <span className="inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: PRIORITY_CONFIG[priority].bg, color: PRIORITY_CONFIG[priority].color }}>{PRIORITY_CONFIG[priority].label}</span>}
              {!isScheduled && <span className="inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: "#fef3c7", color: "#92400e" }}>Unscheduled</span>}
            </div>
            <h2 className="text-base font-semibold leading-snug" style={{ color: "var(--text-primary)" }}>{item.title}</h2>
            {item.customerName && <p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>{item.customerName}</p>}
          </div>
          <button onClick={onClose} style={{ color: "var(--text-muted)" }}><X className="w-4 h-4" /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Details */}
          <div className="space-y-2.5">
            {isScheduled
              ? <Row icon={Clock} label="Scheduled" value={scheduled!.allDay ? `${fmtDate(scheduled!.start)} · All day` : `${fmtDate(scheduled!.start)} · ${fmtTime(scheduled!.start)}–${fmtTime(scheduled!.end)}`} />
              : <Row icon={CalendarClock} label="Preferred" value={unscheduled!.preferredDate ?? "No preference"} />}
            {scheduled?.jobType ?? unscheduled?.jobType ? <Row icon={Briefcase} label="Type" value={(scheduled?.jobType ?? unscheduled?.jobType)!} /> : null}
            {(scheduled?.address ?? unscheduled?.address ?? scheduled?.city ?? unscheduled?.city) &&
              <Row icon={MapPin} label="Location" value={scheduled?.address ?? unscheduled?.address ?? scheduled?.city ?? unscheduled?.city ?? ""} />}
            {scheduled?.contact && <Row icon={User} label="Contact" value={scheduled.contact} />}
            {scheduled?.status && <Row icon={Tag} label="Status" value={scheduled.status} />}
            {!isScheduled && <Row icon={Clock} label="Est. duration" value={fmtDuration(unscheduled!.durationMinutes)} />}
            {!isScheduled && <Row icon={AlertTriangle} label="Reason" value={unscheduled!.reason} />}
            {unscheduled?.value && <Row icon={FileText} label="Value" value={unscheduled.value} />}
          </div>

          {/* Description */}
          {(scheduled?.description ?? unscheduled?.description) && (
            <div className="pt-3" style={{ borderTop: "1px solid var(--border-subtle)" }}>
              <p className="text-[10px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: "var(--text-muted)" }}>Description</p>
              <p className="text-sm leading-relaxed whitespace-pre-line" style={{ color: "var(--text-primary)" }}>
                {scheduled?.description ?? unscheduled?.description}
              </p>
            </div>
          )}

          {/* Reassign (scheduled jobs) */}
          {isScheduled && scheduled!.type === "job" && onReassign && (
            <div className="pt-3" style={{ borderTop: "1px solid var(--border-subtle)" }}>
              <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: "var(--text-muted)" }}>Assigned Technician</label>
              <Select size="sm" value={scheduled!.assignedTo ?? ""} onChange={onReassign}
                options={[{ value: "", label: "Unassigned" }, ...technicians.map(t => ({ value: t, label: t }))]} />
            </div>
          )}

          {/* Work order summary */}
          {wo && (
            <div className="pt-3" style={{ borderTop: "1px solid var(--border-subtle)" }}>
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Work Order</p>
                <span className="text-xs font-bold" style={{ color: pct === 100 ? "#10b981" : "var(--text-secondary)" }}>{pct}% · {done}/{total}</span>
              </div>
              <p className="text-sm font-medium mb-2" style={{ color: "var(--text-primary)" }}>{wo.title}</p>
              <div className="h-1.5 rounded-full mb-3" style={{ backgroundColor: "var(--bg-input)" }}>
                <div className="h-1.5 rounded-full" style={{ width: `${pct}%`, backgroundColor: pct === 100 ? "#10b981" : "#4f46e5" }} />
              </div>
              <div className="space-y-1.5">
                {wo.checklist.slice(0, 6).map(c => (
                  <div key={c.id} className="flex items-center gap-2">
                    {c.isComplete ? <CheckCircle className="w-3.5 h-3.5 shrink-0 text-emerald-500" /> : <Circle className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--text-muted)" }} />}
                    <span className="text-xs" style={{ color: c.isComplete ? "var(--text-muted)" : "var(--text-primary)", textDecoration: c.isComplete ? "line-through" : "none" }}>{c.label}</span>
                  </div>
                ))}
                {wo.checklist.length > 6 && <p className="text-xs pl-5" style={{ color: "var(--text-muted)" }}>+{wo.checklist.length - 6} more</p>}
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="px-5 py-4 shrink-0 space-y-2" style={{ borderTop: "1px solid var(--border-subtle)" }}>
          {!isScheduled && onSchedule && (
            <button onClick={onSchedule} className="w-full px-3 py-2 rounded-lg text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 transition-colors">
              Schedule
            </button>
          )}
          <button onClick={openComments}
            className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
            style={{ border: "1px solid var(--border)", color: "var(--text-secondary)", backgroundColor: "var(--bg-surface)" }}>
            <MessageSquare className="w-3.5 h-3.5" />
            {commentCount > 0 ? `Comments · ${commentCount}` : "Comment"}
          </button>
          <div className="flex items-center flex-wrap gap-2">
            {isScheduled && <ActionBtn label="Reschedule" />}
            {isScheduled && <ActionBtn label="Mark Confirmed" />}
            {wo && href && <Link href={href} className="text-xs px-2.5 py-1.5 rounded-lg transition-colors" style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}>Open Work Order</Link>}
            {href && (
              <Link href={href} className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg ml-auto font-medium text-indigo-600 transition-colors" style={{ border: "1px solid #c7d2fe" }}>
                Open {item.sourceModule === "jobs" ? "Job" : "Record"} <ChevronRight className="w-3 h-3" />
              </Link>
            )}
          </div>
          {isScheduled && <ActionBtn label="Cancel Job" danger full />}
        </div>
      </div>
    </>
  );
}

function Row({ icon: Icon, label, value }: { icon: typeof Clock; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2.5">
      <Icon className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: "var(--text-muted)" }} />
      <div className="min-w-0">
        <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>{label}</p>
        <p className="text-sm" style={{ color: "var(--text-primary)" }}>{value}</p>
      </div>
    </div>
  );
}

function ActionBtn({ label, danger, full }: { label: string; danger?: boolean; full?: boolean }) {
  return (
    <button
      className={`text-xs px-2.5 py-1.5 rounded-lg transition-colors ${full ? "w-full" : ""}`}
      style={{ border: `1px solid ${danger ? "#fecaca" : "var(--border)"}`, color: danger ? "#dc2626" : "var(--text-secondary)" }}>
      {label}
    </button>
  );
}
