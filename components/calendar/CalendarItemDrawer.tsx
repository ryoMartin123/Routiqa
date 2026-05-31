"use client";

import Link from "next/link";
import { X, Clock, User, MapPin, CheckCircle, Circle, ChevronRight, Briefcase } from "lucide-react";
import Select from "@/components/ui/Select";
import { getWorkOrder } from "@/lib/jobs/data";
import { LAYER_CONFIG, type CalendarItem } from "@/lib/calendar/types";

function fmtTime(d: Date): string {
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}
function fmtDate(d: Date): string {
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

// Where "Open full record" should navigate, per source module.
function recordHref(item: CalendarItem): string | null {
  switch (item.sourceModule) {
    case "jobs":       return `/jobs/${item.sourceId}`;
    case "agreements": return `/agreements/${item.sourceId}`;
    case "projects":   return `/projects/${item.sourceId}`;
    case "quotes":     return `/quotes/${item.sourceId}`;
    case "tasks":      return `/tasks`;
    default:           return null;
  }
}

export default function CalendarItemDrawer({
  item, technicians, onClose, onReassign,
}: {
  item: CalendarItem;
  technicians: string[];
  onClose: () => void;
  onReassign: (tech: string) => void;
}) {
  const cfg = LAYER_CONFIG[item.type];
  // Work order summary only for job items
  const wo = item.sourceModule === "jobs" && item.type === "job"
    ? getWorkOrder(item.sourceId)
    : undefined;
  const done = wo?.checklist.filter(c => c.isComplete).length ?? 0;
  const total = wo?.checklist.length ?? 0;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  const href = recordHref(item);

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 z-50 flex flex-col w-[440px] max-w-full"
        style={{ backgroundColor: "var(--bg-surface)", borderLeft: "1px solid var(--border-subtle)", boxShadow: "-4px 0 24px rgba(0,0,0,0.18)" }}>

        {/* Header */}
        <div className="flex items-start justify-between gap-3 px-5 py-4 shrink-0" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
          <div className="min-w-0">
            <span className="inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full mb-1.5"
              style={{ backgroundColor: cfg.color + "22", color: cfg.color }}>
              {cfg.label}
            </span>
            <h2 className="text-base font-semibold leading-snug" style={{ color: "var(--text-primary)" }}>{item.title}</h2>
            {item.customerName && <p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>{item.customerName}</p>}
          </div>
          <button onClick={onClose} style={{ color: "var(--text-muted)" }}><X className="w-4 h-4" /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Schedule */}
          <div className="space-y-2.5">
            <Row icon={Clock} label="When" value={item.allDay ? `${fmtDate(item.start)} · All day` : `${fmtDate(item.start)} · ${fmtTime(item.start)}–${fmtTime(item.end)}`} />
            {item.address && <Row icon={MapPin} label="Address" value={item.address} />}
            {item.status && <Row icon={Briefcase} label="Status" value={item.status} />}
          </div>

          {/* Reassign technician */}
          {item.type === "job" && (
            <div className="pt-3" style={{ borderTop: "1px solid var(--border-subtle)" }}>
              <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: "var(--text-muted)" }}>
                Assigned Technician
              </label>
              <Select size="sm" value={item.assignedTo ?? ""} onChange={onReassign}
                options={technicians.map(t => ({ value: t, label: t }))} />
            </div>
          )}

          {/* Work order summary (jobs only) */}
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
                    {c.isComplete
                      ? <CheckCircle className="w-3.5 h-3.5 shrink-0 text-emerald-500" />
                      : <Circle className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--text-muted)" }} />}
                    <span className="text-xs" style={{ color: c.isComplete ? "var(--text-muted)" : "var(--text-primary)", textDecoration: c.isComplete ? "line-through" : "none" }}>
                      {c.label}
                    </span>
                  </div>
                ))}
                {wo.checklist.length > 6 && (
                  <p className="text-xs pl-5" style={{ color: "var(--text-muted)" }}>+{wo.checklist.length - 6} more</p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="px-5 py-4 flex items-center gap-2 shrink-0" style={{ borderTop: "1px solid var(--border-subtle)" }}>
          <button className="px-3 py-1.5 rounded-lg text-sm transition-colors"
            style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}>
            Reschedule
          </button>
          {href && (
            <Link href={href} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-white ml-auto transition-colors" style={{ backgroundColor: "#4f46e5" }}>
              Open record <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          )}
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
