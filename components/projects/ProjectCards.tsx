"use client";

// ─── Projects · Cards view ────────────────────────────────
// A project portfolio — each project as a command-center card (stage, health,
// progress, next step / blocker, value, jobs, tasks, team). The default Projects
// experience (List stays available). Mock/local; derives from existing helpers.

import { MapPin, Calendar, DollarSign, Briefcase, CheckSquare, ArrowRight, AlertTriangle, ChevronRight } from "lucide-react";
import { PROJECT_TYPE_LABELS, type Project } from "@/lib/projects/data";
import { getTasksForProject } from "@/lib/tasks/data";
import { getJobsForProject } from "@/lib/jobs/data";
import { projectTypeLabel, type ProjectStage } from "@/lib/projects/settings";
import { statusBucket, projectHealth, HEALTH_META } from "@/lib/projects/lenses";
import { projectMapSummary } from "@/lib/projects/map";
import StatusBadge from "@/components/shared/StatusBadge";

const OPEN_JOB = (s: string) => !["completed", "closed", "canceled", "invoiced", "no_show"].includes(s);
const initials = (name: string) => { const p = name.trim().split(/\s+/); return (p.length >= 2 ? p[0][0] + p[p.length - 1][0] : name.slice(0, 2)).toUpperCase(); };

export default function ProjectCards({ projects, stagesByKey, onOpen }: {
  projects: Project[]; stagesByKey: Map<string, ProjectStage>; onOpen: (id: string) => void;
}) {
  if (projects.length === 0) {
    return <div className="rounded-xl p-12 text-center" style={{ border: "1px dashed var(--border)" }}><p className="text-sm" style={{ color: "var(--text-muted)" }}>No projects match the current filters.</p></div>;
  }
  return (
    <div className="grid gap-3 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
      {projects.map(p => <Card key={p.id} project={p} stagesByKey={stagesByKey} onOpen={onOpen} />)}
    </div>
  );
}

function Card({ project: p, stagesByKey, onOpen }: { project: Project; stagesByKey: Map<string, ProjectStage>; onOpen: (id: string) => void }) {
  const stage = stagesByKey.get(p.stage ?? "");
  // Progress, next step and blocker all come from ONE map build (the map is the
  // source of truth for project progress now that phases are gone).
  const summary = projectMapSummary(p.id);
  const completed = summary.done;
  const total = summary.total;
  const pct = summary.pct;
  const unit = "steps";

  const jobs = getJobsForProject(p.id);
  const openJobs = jobs.filter(j => OPEN_JOB(j.status)).length;
  const openTasks = getTasksForProject(p.id).filter(t => t.status !== "completed").length;

  const blocker = summary.blocker;
  const next = summary.nextStep;
  const done = statusBucket(p, stagesByKey) === "completed";
  const health = projectHealth(p, { done, blocked: !!blocker });
  const hm = HEALTH_META[health];

  // Team avatars — assignee + distinct job techs.
  const team = [...new Set([p.assignedTo, ...jobs.map(j => j.assignedTo)].filter(Boolean))] as string[];
  const typeLabel = projectTypeLabel(p.type) || PROJECT_TYPE_LABELS[p.type];

  return (
    <button onClick={() => onOpen(p.id)} className="group text-left rounded-xl overflow-hidden flex flex-col transition-all hover:-translate-y-0.5"
      style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" }}>
      <div style={{ height: 3, backgroundColor: hm.color }} />
      <div className="p-4 flex-1 flex flex-col">
        {/* Title + health */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate" style={{ color: "var(--text-primary)" }}>{p.name}</p>
            <p className="text-xs truncate mt-0.5 flex items-center gap-1" style={{ color: "var(--text-muted)" }}>
              {p.customerName}<span style={{ opacity: 0.5 }}>·</span><MapPin className="w-3 h-3 shrink-0" />{p.locationName}
            </p>
          </div>
          {/* Health as a dot + label (moved off the filled pill, matching the CRM). */}
          <StatusBadge label={hm.label} color={hm.color} size="sm" className="shrink-0 mt-0.5" />
        </div>

        {/* Type + stage */}
        <div className="flex items-center gap-1.5 mt-2 flex-wrap">
          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded" style={{ backgroundColor: "var(--bg-input)", color: "var(--text-secondary)" }}>{typeLabel}</span>
          {stage && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded inline-flex items-center gap-1" style={{ backgroundColor: stage.color + "22", color: stage.color }}><span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: stage.color }} />{stage.name}</span>}
        </div>

        {/* Progress */}
        <div className="mt-3">
          <div className="flex items-center justify-between text-[11px] mb-1" style={{ color: "var(--text-muted)" }}>
            <span>{completed}/{total} {unit}</span><span className="font-semibold" style={{ color: pct === 100 ? "#10b981" : "var(--text-secondary)" }}>{pct}%</span>
          </div>
          <div className="h-1.5 rounded-full" style={{ backgroundColor: "var(--bg-input)" }}>
            <div className="h-1.5 rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: pct === 100 ? "#10b981" : stage?.color ?? "#6366f1" }} />
          </div>
        </div>

        {/* Next step / blocker */}
        {blocker ? (
          <div className="flex items-start gap-1.5 mt-3 rounded-lg px-2.5 py-1.5" style={{ backgroundColor: "#fef2f2", border: "1px solid #fecaca" }}>
            <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" style={{ color: "#dc2626" }} />
            <div className="min-w-0"><p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: "#dc2626" }}>Blocked</p><p className="text-xs truncate" style={{ color: "#991b1b" }}>{blocker.blockedReason ?? blocker.title}</p></div>
          </div>
        ) : next ? (
          <div className="flex items-start gap-1.5 mt-3 rounded-lg px-2.5 py-1.5" style={{ backgroundColor: "var(--bg-surface-2)", border: "1px solid var(--border)" }}>
            <ChevronRight className="w-3.5 h-3.5 mt-0.5 shrink-0" style={{ color: "var(--accent-text)" }} />
            <div className="min-w-0"><p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>Next step</p><p className="text-xs truncate" style={{ color: "var(--text-primary)" }}>{next.title}</p></div>
          </div>
        ) : null}

        {/* Meta grid */}
        <div className="grid grid-cols-2 gap-x-3 gap-y-2 mt-3">
          <Meta icon={DollarSign} label="Value" value={p.estimatedValue || "—"} />
          <Meta icon={Calendar} label="Target" value={p.targetDate ?? "—"} />
          <Meta icon={Briefcase} label="Open jobs" value={String(openJobs)} />
          <Meta icon={CheckSquare} label="Open tasks" value={String(openTasks)} />
        </div>

        {/* Footer — team + open */}
        <div className="flex items-center justify-between mt-3 pt-3" style={{ borderTop: "1px solid var(--border)" }}>
          <div className="flex -space-x-1.5">
            {team.slice(0, 3).map((n, i) => (
              <span key={n} title={n} className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold text-white" style={{ backgroundColor: ["#6366f1", "#0ea5e9", "#10b981"][i % 3], boxShadow: "0 0 0 2px var(--bg-surface)" }}>{initials(n)}</span>
            ))}
            {team.length > 3 && <span className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold" style={{ backgroundColor: "var(--bg-input)", color: "var(--text-muted)", boxShadow: "0 0 0 2px var(--bg-surface)" }}>+{team.length - 3}</span>}
            {team.length === 0 && <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>Unassigned</span>}
          </div>
          <span className="text-xs font-medium flex items-center gap-1 transition-all opacity-70 group-hover:opacity-100 group-hover:gap-2" style={{ color: "var(--accent-text)" }}>Open <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-rotate-45" /></span>
        </div>
      </div>
    </button>
  );
}

function Meta({ icon: Icon, label, value }: { icon: typeof DollarSign; label: string; value: string }) {
  return (
    <div className="flex items-center gap-1.5 min-w-0">
      <Icon className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--text-muted)" }} />
      <div className="min-w-0"><span className="text-[10px] block leading-none" style={{ color: "var(--text-muted)" }}>{label}</span><span className="text-xs font-medium truncate block" style={{ color: "var(--text-primary)" }}>{value}</span></div>
    </div>
  );
}
