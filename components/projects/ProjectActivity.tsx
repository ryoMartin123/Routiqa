"use client";

// ─── CRM Project · Timeline (activity feed) ───────────────
// The project's interactive workflow lives in the Map tab; this Timeline is a
// read-only activity history DERIVED from the same map nodes — mirroring the
// "Activity" tab on a lead / agreement. Date column-ish on the left, a small
// tinted status icon on the connector line, then a clean surface card with a
// status pill, the step, and who owns it. Mock/local.

import { useMemo } from "react";
import {
  Layers, Flag, Briefcase, CheckSquare, ClipboardList, Package, ShoppingCart,
  HardHat, FileText, Receipt, FolderPlus, User,
} from "lucide-react";
import { getProject } from "@/lib/projects/data";
import { getProjectMap, NODE_STATUS_META, NODE_TYPE_LABEL, type MapNodeType } from "@/lib/projects/map";

const TYPE_ICON: Record<MapNodeType, typeof Layers> = {
  phase: Layers, milestone: Flag, job: Briefcase, task: CheckSquare, work_order: ClipboardList,
  material_request: Package, purchase_order: ShoppingCart, subcontractor: HardHat, document: FileText, billing: Receipt,
};

interface Entry { icon: typeof Layers; color: string; label: string; title: string; meta?: string; user?: string; date?: string; }

export default function ProjectActivity({ projectId }: { projectId: string }) {
  const entries = useMemo<Entry[]>(() => {
    const project = getProject(projectId);
    const nodes = getProjectMap(projectId);
    const out: Entry[] = [];
    // Origin — the project itself.
    out.push({ icon: FolderPlus, color: "#d97706", label: "Project Created", title: project?.name ?? "Project", user: project?.assignedTo, date: project?.startDate });
    // Each workflow step, in order, with its live status.
    for (const n of nodes) {
      const sm = NODE_STATUS_META[n.status];
      const meta = [n.group, NODE_TYPE_LABEL[n.type], n.linkedLabel ? `${n.linkedApp ?? ""} ${n.linkedLabel}`.trim() : ""].filter(Boolean).join(" · ");
      out.push({ icon: TYPE_ICON[n.type], color: sm.color, label: sm.label, title: n.title, meta, user: n.assignedTo, date: n.dueDate });
    }
    return out;
  }, [projectId]);

  if (entries.length === 0) {
    return (
      <div className="py-12 text-center rounded-xl" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-subtle)" }}>
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>No activity yet</p>
      </div>
    );
  }

  return (
    <div className="w-full">
      {entries.map((e, i) => {
        const Icon = e.icon;
        const last = i === entries.length - 1;
        return (
          <div key={i} className="flex gap-3">
            {/* Icon + connector */}
            <div className="flex flex-col items-center shrink-0">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center z-10"
                style={{ backgroundColor: e.color + "1a", border: `1px solid ${e.color}33` }}>
                <Icon className="w-3.5 h-3.5" style={{ color: e.color }} />
              </div>
              {!last && <div className="w-px flex-1 my-1" style={{ backgroundColor: "var(--border-subtle)" }} />}
            </div>

            {/* Content container — uniform regardless of content */}
            <div className="flex-1 min-w-0 rounded-xl px-4 py-3 mb-3 flex flex-col"
              style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-subtle)", boxShadow: "var(--shadow-card)", minHeight: 76 }}>
              <div className="flex items-start justify-between gap-3">
                <span className="inline-block text-[10px] font-semibold px-2 py-0.5 rounded-md shrink-0"
                  style={{ backgroundColor: e.color + "1a", color: e.color }}>{e.label}</span>
                {e.date && <span className="text-xs shrink-0" style={{ color: "var(--text-muted)" }}>{e.date}</span>}
              </div>
              <p className="text-sm font-medium mt-1.5 break-words leading-relaxed" style={{ color: "var(--text-primary)" }}>{e.title}</p>
              {e.meta && <p className="text-[11px] mt-0.5 truncate" style={{ color: "var(--text-muted)" }}>{e.meta}</p>}
              <div className="flex items-center gap-1.5 mt-auto pt-1.5">
                <User className="w-3 h-3 shrink-0" style={{ color: "var(--text-muted)" }} />
                <span className="text-[11px] truncate" style={{ color: "var(--text-muted)" }}>{e.user || "System"}</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
